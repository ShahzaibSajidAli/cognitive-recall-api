import { any, z } from 'zod';
import { router, procedure } from './trpc.js';
import { aiResponse } from './aiResponser.js';
import { TRPCError } from '@trpc/server';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getSubtitles } from 'youtube-captions-scraper';

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
                const transcriptData = await getSubtitles({
                    videoID: videoUrl.split('v=')[1] || videoUrl.split('/').pop() || '',
                    lang: language,
                    format: 'json',
                    agent: proxyAgent
                });
                const formatedTranscript = transcriptData.map((item: { text: any; offset: any; }) => ({
                    text: item.text,
                    offset: item.offset
                }));
                
                const transcriptText = formatedTranscript.reduce((acc: any, item: { offset: number; text: any; }) => {
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