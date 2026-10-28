import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { YoutubeTranscript } from 'youtube-transcript'
import { aiResponse } from './aiResponser.js';
import { TRPCError } from '@trpc/server';
import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { typescriptTranscript } from './mockfiles/mockTranscript.js'

// For Mock Testing
const rand = (min: number, max: number) =>
    min + Math.random() * (max - min);

async function mockDelay(min: number, max: number) {
    const ms = rand(min, max);
    await new Promise<void>((resolve) => globalThis.setTimeout(() => resolve(), ms))
}

const dispatcher = new ProxyAgent({
    uri: process.env.SCRAPERAPI_PROXY!,
    proxyTls: { rejectUnauthorized: false },
    requestTls: { rejectUnauthorized: false }
});

const proxiedFetch = ((url: any, init?: any) =>
    undiciFetch(url, { ...init, dispatcher })) as unknown as typeof globalThis.fetch;

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
                if (process.env.MOCK_TRANSCRIPT === 'true') {
                    await mockDelay(4000, 9000);
                    const mockTranscript = typescriptTranscript;
                    const transcriptText = mockTranscript.reduce((acc, item) => {
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
                } else {
                    const transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl, {
                        fetch: proxiedFetch,
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