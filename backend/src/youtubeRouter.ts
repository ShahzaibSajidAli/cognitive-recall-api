import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { aiResponse } from './aiResponser.js';
import { TRPCError } from '@trpc/server';
import { HttpsProxyAgent } from 'https-proxy-agent';

function cleanVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  
  // Fallback parser for messy browser string captures
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('youtu.be')) {
      return parsedUrl.pathname.slice(1).split('&')[0] ?? null;
    }
    return parsedUrl.searchParams.get('v') ?? null;
  } catch {
    return null;
  }
}

export const youtubeRouter = router({
    getTranscript: procedure
        .input(
            z.object({
                videoUrl: z.string().min(1, { message: 'URL cannot be empty' }),
                language: z.string()
            })
        )
        .mutation(async ({ input }) => {
            try {
                const intervalSeconds = 60;
                let currentBucket = -1;
                const { videoUrl, language } = input;
                
                // Initialize proxy tunnel via environment configuration
                const proxyAgent = new HttpsProxyAgent(process.env.SCRAPERAPI_PROXY || "");
                const videoId = cleanVideoId(videoUrl);
                
                if (!videoId) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid YouTube URL string.' });
                }

                // Target the exact internal InnerTube mobile API endpoint
                const targetUrl = 'https://youtube.com';

                const response = await fetch(targetUrl, {
                    method: 'POST',
                    agent: proxyAgent,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
                    },
                    body: JSON.stringify({
                        context: {
                            client: {
                                clientName: 'ANDROID',
                                clientVersion: '20.10.38',
                                hl: language || 'en'
                            }
                        },
                        videoId: videoId
                    })
                } as any);

                if (!response.ok) {
                    throw new Error(`YouTube API returned HTTP status ${response.status}`);
                }

                const data: any = await response.json();

                // Safely dig into YouTube's inner transcript UI array tree
                const renderer = data.actions?.[0]?.updateTranscriptAction?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups;

                if (!renderer) {
                    throw new Error('Transcripts are disabled or unavailable for this video.');
                }

                const formattedOutput = renderer.map((group: any) => {
                    const cue = group.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer;
                    return {
                        text: cue.startMessage.runs.map((r: any) => r.text).join(''),
                        duration: parseInt(cue.durationMs || '0', 10),
                        offset: parseInt(cue.startOffsetMs || '0', 10)
                    };
                });

                // Condense text chunks into 60-second timestamped paragraph intervals
                const transcriptText = formattedOutput.reduce((acc: string, item: { offset: number; text: string; }) => {
                    const seconds = Math.floor(item.offset / 1000);
                    const bucket = Math.floor(seconds / intervalSeconds) * intervalSeconds;

                    if (bucket !== currentBucket) {
                        currentBucket = bucket;
                        return `${acc}\n[${bucket}s] ${item.text}`;
                    }

                    return `${acc} ${item.text}`;
                }, "").trim();

                // Pass the cleaned transcript block data to your AI processing layer
                const aiOutput = await aiResponse(transcriptText, language);
                
                return {
                    success: true,
                    output: aiOutput
                };

            } catch (error: any) {
                console.error("getTranscript failed:", error);
                
                // Bubble a clean client message if transcripts are missing natively
                if (error.message?.includes('disabled or unavailable')) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'Subtitles are disabled or not available for this specific video.',
                    });
                }

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch transcript or generate questions. Please check the URL and try again.',
                });
            }
        })
});

export type youtubeRouterType = typeof youtubeRouter;
