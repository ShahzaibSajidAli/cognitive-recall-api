import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { YoutubeTranscript } from 'youtube-transcript'
import { aiResponse } from './aiResponser.js';

export const youtubeRouter = router({
    getTranscript: procedure 
    .input(
        z.object({
            videoUrl: z.string().min(1, { message: 'URL cannot be empty' }),
            language: z.string()
        })
    )
    .mutation(async ({input}) => {
        try {
            const { videoUrl, language } = input;
            const transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl);
            const aiOutput = await aiResponse(transcriptData, language);
            return {
                success: true,
                output: aiOutput
            }
        }
        catch(error) {
                console.error("tRPC transcript fetch failed", error);
                throw new Error('Could not fetch transcript. Ensure the video has captions.');
        }
    })
})

export type youtubeRouterType = typeof youtubeRouter;