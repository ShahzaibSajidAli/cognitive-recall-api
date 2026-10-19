import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { aiResponse } from './aiResponser.js';
import { TRPCError } from '@trpc/server';
import { HttpsProxyAgent } from 'https-proxy-agent';

function cleanVideoId(url: string): string | null {
  try {
    // A bulletproof parser that doesn't rely on regex index arrays
    const parsedUrl = new URL(url);
    
    if (parsedUrl.hostname.includes('youtu.be')) {
      const pathId = parsedUrl.pathname.slice(1).split('&').shift();
      return pathId || null;
    }
    
    const searchId = parsedUrl.searchParams.get('v');
    if (searchId) return searchId;

    // Direct string extraction fallback if query parameters are missing
    const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch && embedMatch.length > 1) {
      return embedMatch.pop() || null;
    }

    return null;
  } catch {
    // If standard URL parsing fails, extract using simple string slicing mechanics
    const watchMatch = url.match(/v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch && watchMatch.length > 1) {
      return watchMatch.pop() || null;
    }
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
                
                const proxyAgent = new HttpsProxyAgent(process.env.SCRAPERAPI_PROXY || "");
                const videoId = cleanVideoId(videoUrl);
                
                if (!videoId) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid YouTube URL string.' });
                }

                // Target the core Web InnerTube endpoint for seamless data streaming
                const targetUrl = 'https://youtube.com';

                const response = await fetch(targetUrl, {
                    method: 'POST',
                    agent: proxyAgent,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    body: JSON.stringify({
                        context: {
                            client: {
                                clientName: 'WEB',
                                clientVersion: '2.20240110.00.00',
                                hl: language || 'en',
                                gl: 'US',
                                utcOffsetMinutes: 0
                            }
                        },
                        videoId: videoId
                    })
                } as any);

                if (!response.ok) {
                    throw new Error(`YouTube API returned HTTP status ${response.status}`);
                }

                const data: any = await response.json();

                // Dig through the nested response tree safely using optional chaining
                const actions = data.actions;
                if (!actions || actions.length === 0) {
                    throw new Error('Transcripts are disabled or unavailable for this video.');
                }

                const updateAction = actions.shift()?.updateTranscriptAction;
                const renderer = updateAction?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups;

                if (!renderer) {
                    throw new Error('Transcripts are disabled or unavailable for this video.');
                }

                const formattedOutput = renderer.map((group: any) => {
                    const cueContainer = group.transcriptCueGroupRenderer?.cues;
                    if (!cueContainer || cueContainer.length === 0) return null;
                    
                    const cue = cueContainer.slice(0, 1).shift()?.transcriptCueRenderer;
                    if (!cue) return null;

                    return {
                        text: cue.startMessage?.runs?.map((r: any) => r.text).join('') || '',
                        duration: parseInt(cue.durationMs || '0', 10),
                        offset: parseInt(cue.startOffsetMs || '0', 10)
                    };
                }).filter(Boolean);

                if (formattedOutput.length === 0) {
                    throw new Error('No transcript data could be derived from response.');
                }

                // Condense text chunks into 60-second timestamped paragraph intervals
                const transcriptText = formattedOutput.reduce((acc: string, item: any) => {
                    const seconds = Math.floor(item.offset / 1000);
                    const bucket = Math.floor(seconds / intervalSeconds) * intervalSeconds;

                    if (bucket !== currentBucket) {
                        currentBucket = bucket;
                        return `${acc}\n[${bucket}s] ${item.text}`;
                    }

                    return `${acc} ${item.text}`;
                }, "").trim();

                // Pass the clean text block to the AI pipeline
                const aiOutput = await aiResponse(transcriptText, language);
                
                return {
                    success: true,
                    output: aiOutput
                };

            } catch (error: any) {
                console.error("getTranscript failed:", error);
                
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
