import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { aiResponse } from './aiResponser.js';
import { TRPCError } from '@trpc/server';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { YoutubeTranscript } from 'youtube-transcript';

function cleanVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  // Safe extraction matching index 2 without using markdown brackets
  if (match && match.length > 2) {
    const videoId = match.slice(2, 3).shift();
    if (videoId && videoId.length === 11) {
      return videoId;
    }
  }
  
  // Fallback url query string parameter parser
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('youtu.be')) {
      const pathId = parsedUrl.pathname.slice(1).split('&').shift();
      return pathId || null;
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
                
                const proxyAgent = new HttpsProxyAgent(process.env.SCRAPERAPI_PROXY || "");
                const videoId = cleanVideoId(videoUrl);
                
                if (!videoId) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid YouTube URL string.' });
                }

                // Leverage the standard library wrapper which handles inner token signatures dynamically
                const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
                    lang: language || 'en',
                    fetch: (url: any, init?: any) => {
                        return globalThis.fetch(url, {
                            ...init,
                            agent: proxyAgent
                            // Custom User-Agent removed to protect the mobile endpoint payload signature
                        } as any);
                    }
                });

                if (!transcriptData || transcriptData.length === 0) {
                    throw new Error('Transcripts are disabled or unavailable for this video.');
                }

                // Map standard properties seamlessly into the 60s buckets
                const transcriptText = transcriptData.reduce((acc: string, item: any) => {
                    const seconds = Math.floor(item.offset / 1000);
                    const bucket = Math.floor(seconds / intervalSeconds) * intervalSeconds;

                    if (bucket !== currentBucket) {
                        currentBucket = bucket;
                        return `${acc}\n[${bucket}s] ${item.text}`;
                    }

                    return `${acc} ${item.text}`;
                }, "").trim();

                // Run your AI question layer module layout using the built text blocks
                const aiOutput = await aiResponse(transcriptText, language);
                
                return {
                    success: true,
                    output: aiOutput
                };

            } catch (error: any) {
                console.error("getTranscript pipeline failure:", error);
                
                if (error.message?.includes('disabled') || error.name?.includes('Disabled')) {
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