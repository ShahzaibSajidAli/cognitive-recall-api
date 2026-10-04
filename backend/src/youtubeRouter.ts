import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { YoutubeTranscript } from 'youtube-transcript'
import { aiResponse } from './aiResponser.js';
import { TRPCError } from '@trpc/server';

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
                const { videoUrl, language } = input;
                const transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl);
                const transcriptText = transcriptData.map(item => `[${Math.floor(item.offset / 1000)}s] ${item.text}`).join('\n');
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