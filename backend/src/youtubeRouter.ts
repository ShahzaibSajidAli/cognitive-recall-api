import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { YoutubeTranscript } from 'youtube-transcript'
import { aiResponse } from './aiResponser.js';
import { TRPCError } from '@trpc/server';
import { HttpsProxyAgent } from 'https-proxy-agent';

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
                const transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl, {
                    fetch: (url: any, init?: any) => {
                        return globalThis.fetch(url, {
                            ...init,
                            agent: proxyAgent,
                            headers: {
                                ...init?.headers,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.5',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'Connection': 'keep-alive',
                                'Upgrade-Insecure-Requests': '1',
                                'Sec-Fetch-Dest': 'document',
                                'Sec-Fetch-Mode': 'navigate',
                                'Sec-Fetch-Site': 'none',
                                'Sec-Fetch-User': '?1'
                            }
                        } as any);
                    }
                });
                const transcriptText = transcriptData.reduce((acc, item) => {
                    const seconds = Math.floor(item.offset / 1000);
                    const bucket = Math.floor(seconds / intervalSeconds) * intervalSeconds;

                    if (bucket !== currentBucket) {
                        currentBucket = bucket;
                        return `${acc}\n[${bucket}s] ${item.text}`
                    }

                    return `${acc} ${item.text}`
                }, "").trim();
                const aiOutput = await aiResponse(transcriptText, language);
                return {
                    success: true,
                    output: aiOutput
                }
            }
            catch (error) {
                console.error("getTranscript failed:", error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch transcript or generate questions. Please check the URL and try again.',
                });
            }
        })
})

export type youtubeRouterType = typeof youtubeRouter;