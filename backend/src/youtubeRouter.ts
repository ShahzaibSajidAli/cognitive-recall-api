import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { YoutubeTranscript } from 'youtube-transcript'

export const youtubeRouter = router({
    getTranscript: procedure 
    .input(
        z.object({
            videoUrl: z.string().url({message: 'Invalid Youtube URL Format'})
        })
    )
    .mutation(async ({input}) => {
        try {
            const { videoUrl } = input;

            const transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl);

            return {
                success: true,
                transcript: transcriptData
            }
        }
        catch(error) {
            console.error("tRPC transcript fetch failed", error);
            throw new Error('Could not fetch transcript. Ensure the video has captions.');
        }
    })
})

export type youtubeRouterType = typeof youtubeRouter;