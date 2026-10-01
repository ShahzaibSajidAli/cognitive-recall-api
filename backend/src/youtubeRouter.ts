import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { YoutubeTranscript } from 'youtube-transcript'

export const youtubeRouter = router({
    getTranscript: procedure 
    .input(
        z.object({
            videoUrl: z.string().url({message: 'Invalid Youtube URL Format'}),
            lang: z.string().optional()
        })
    )
    .mutation(async ({input}) => {
        let transcriptData;
        try {
            const { videoUrl } = input;
            transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl, {
                lang: input.lang || 'en'
            });
            return {
                success: true,
                transcript: transcriptData
            }
        }
        catch(error) {
            try {
                transcriptData = await YoutubeTranscript.fetchTranscript(input.videoUrl);
                return {
                    success: true,
                    transcript: transcriptData
                }
            }
            catch(fallbackError) {
                console.error("tRPC transcript fetch failed", fallbackError);
                throw new Error('Could not fetch transcript. Ensure the video has captions.');
            }
        }
    })
})

export type youtubeRouterType = typeof youtubeRouter;