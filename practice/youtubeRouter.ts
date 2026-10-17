import { z } from 'zod';
import { router, procedure } from '../backend/src/trpc.js';
import { YoutubeTranscript } from 'youtube-transcript'
import { aiResponse } from '../backend/src/aiResponser.js';
import { TRPCError } from '@trpc/server';
import { vi } from 'zod/v4/locales';
import { text } from 'node:stream/consumers';

export const youtubeRouter = router({
    getYoutubeTranscript: procedure
        .input(z.object({
            videoUrl: z.string().url(),
            language: z.string()
        }))
        .mutation(async ({ input }) => {
            try {
                const initialInterval = 60;
                let currentBucket = -1;
                let { videoUrl, language } = input;
                const transcript = await YoutubeTranscript.fetchTranscript(videoUrl);
                const transcriptText = transcript.reduce((acc, item) => {
                    const seconds = Math.floor(item.offset / 1000);
                    const bucket = Math.floor(seconds / initialInterval) * initialInterval;

                    if (bucket !== currentBucket) {
                        currentBucket = bucket;
                        return `${acc}\n[${bucket}s] ${item.text}`
                    }
                    return `${acc} ${item.text}`
                }, "").trim();
                const aiResponses = await aiResponse(transcriptText, language);
                return {
                    sucess: true,
                    output: aiResponses
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