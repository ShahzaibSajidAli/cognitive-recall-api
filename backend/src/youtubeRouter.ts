import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './trpc.js';
import { YoutubeTranscript, YoutubeTranscriptDisabledError } from 'youtube-transcript'
import { aiResponseForTranscript, aiResponseForFollowUp } from './aiResponser.js';
import { TRPCError } from '@trpc/server';
import { typescriptTranscript } from './mockfiles/mockTranscript.js';
import { proxiedFetch } from './adapters/proxyProvider.js';
import { eq } from 'drizzle-orm';
import { users, videos } from './db/drizzle/schema/schema.js';
import { clearAuthCookies, createSessionAndSetCookies } from "./auth/auth.js";
import { hash, verify, argon2id } from 'argon2';

// For Mock Testing
const rand = (min: number, max: number) =>
    min + Math.random() * (max - min);

async function mockDelay(min: number, max: number) {
    const ms = rand(min, max);
    await new Promise<void>((resolve) => globalThis.setTimeout(() => resolve(), ms))
}

const YOUTUBE_INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const YOUTUBE_INNERTUBE_CLIENT_VERSION = '20.10.38';

function extractYoutubeVideoId(videoUrl: string): string | undefined {
    const match = videoUrl.match(
        /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
    );
    return match?.[1];
}

async function inspectInnerTubeMetadata(videoUrl: string) {
    const videoId = extractYoutubeVideoId(videoUrl);
    if (!videoId) {
        console.warn('[youtube-debug] Could not extract a YouTube video ID.');
        return;
    }

    try {
        const response = await proxiedFetch(YOUTUBE_INNERTUBE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': `com.google.android.youtube/${YOUTUBE_INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'ANDROID',
                        clientVersion: YOUTUBE_INNERTUBE_CLIENT_VERSION
                    }
                },
                videoId
            })
        });

        const body: unknown = await response.json();
        console.log(body);
        const playerResponse = body && typeof body === 'object'
            ? body as {
                playabilityStatus?: { status?: string };
                captions?: {
                    playerCaptionsTracklistRenderer?: {
                        captionTracks?: Array<{
                            languageCode?: string;
                            name?: { simpleText?: string };
                            kind?: string;
                        }>;
                    };
                };
            }
            : {};

        const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

        const tracksMap = tracks.map((track) => ({
            languageCode: track.languageCode ?? 'unknown',
            name: track.name?.simpleText ?? 'unknown',
            kind: track.kind ?? 'manual'
        }))
        const result = tracksMap[0];
        return {
            languageCode: result?.languageCode,
            name: result?.name,
            kind: result?.kind
        }
    } catch (error) {
        console.error('[youtube-debug] InnerTube metadata request failed:', error);
    }
}

export const youtubeRouter = router({
    signUp: publicProcedure
        .input(
            z.object({
                username: z.string().min(5, { message: 'Username cannot be empty' }).trim(),
                email: z.email().trim().toLowerCase(),
                password: z.string().min(8)
            })
        ).mutation(async ({ ctx, input }) => {
            const { username, email, password } = input;
            const hashedPassword = await hash(password, { type: argon2id });

            const [newUser] = await ctx.db.insert(users).values([{
                username: username,
                email: email,
                password: hashedPassword
            } as any])
                .returning({ id: users.id, email: users.email });
            createSessionAndSetCookies(ctx.res, newUser!.id)
            return { success: true}
        }),
    login: publicProcedure
        .input(
            z.object({
                email: z.email().trim().toLowerCase(),
                password: z.string().min(8)
            })).mutation(async ({ ctx, input }) => {
                const { email, password } = input;
                const [fetchUser] = await ctx.db.select().from(users).where(eq(users.email, email));

                if (!fetchUser || !await verify(fetchUser.password, password)) {
                    throw new TRPCError({
                        code: 'UNAUTHORIZED', message: 'Invalid email or password'
                    })
                }

                await createSessionAndSetCookies(ctx.res, fetchUser.id)
                return { success: true }
            }),
    logout: protectedProcedure
        .mutation(({ ctx }) => {
            clearAuthCookies(ctx.res);
            return { success: true }
        }),
    getTranscript: protectedProcedure
        .input(
            z.object({
                videoUrl: z.string().min(1, { message: 'URL cannot be empty' }),
                language: z.string()
            })
        )
        .mutation(async ({ ctx, input }) => {
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
                    const aiOutput = await aiResponseForTranscript(transcriptText, language);
                    return {
                        success: true,
                        output: aiOutput,
                        message: language
                    }

                } else {
                    // Database Check: If the video already exists in the database, returns the stored questions and coding practices
                    const [existingVideo] = await ctx.db.select().from(videos).where(eq(videos.videoId,
                        (extractYoutubeVideoId(videoUrl) || 'unknown')
                    ));
                    console.log('Database check for existing video entry completed. Existing video found:', existingVideo);

                    if (!existingVideo) {
                        const innerTubeRequest = await inspectInnerTubeMetadata(videoUrl);
                        let transcriptData;
                        if (
                            innerTubeRequest?.languageCode !== undefined &&
                            innerTubeRequest.languageCode !== 'unknown'
                        ) {
                            transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl, {
                                fetch: proxiedFetch,
                                lang: innerTubeRequest.languageCode
                            });
                            console.log(innerTubeRequest.languageCode)

                            const transcriptText = transcriptData.reduce((acc, item) => {
                                const seconds = Math.floor(item.offset / 1000);
                                const bucket = Math.floor(seconds / intervalSeconds) * intervalSeconds;

                                if (bucket !== currentBucket) {
                                    currentBucket = bucket;
                                    return `${acc}\n[${bucket}s] ${item.text}`
                                }

                                return `${acc} ${item.text}`
                            }, "").trim();
                            const aiOutput = await aiResponseForTranscript(transcriptText, language);
                            if (!aiOutput) {
                                throw new Error('Failed to generate questions from transcript.');
                            }

                            // Insert the AI output into the database
                            await ctx.db.insert(videos).values([
                                {
                                    videoId: extractYoutubeVideoId(videoUrl) || 'unknown',
                                    questions: aiOutput?.questions as any
                                } as any
                            ])

                            console.log('New video entry added to the database.');
                            console.log('AI output generated and returned:', aiOutput);
                            return {
                                success: true,
                                output: aiOutput,
                                message: innerTubeRequest!.languageCode
                            }
                        }
                    }
                    else {
                        // If the video already exists in the database, return the stored questions and coding practices
                        const response = {
                            success: true,
                            output: {
                                questions: existingVideo.questions.general,
                                codingPractices: existingVideo.questions.coding
                            },
                            message: 'Retrieved from database'
                        };

                        console.log('Video already exists in the database. Returning stored questions and coding practices. Questions:', response.output.questions, 'Coding Practices:', response.output.codingPractices
                        );
                        return response;
                    }
                }
            }
            catch (error) {
                console.error("getTranscript failed:", error);
                const message = error instanceof YoutubeTranscriptDisabledError
                    ? 'YouTube reports that transcripts are disabled or unavailable for this video.'
                    : 'Failed to fetch transcript or generate questions. Please check the proxy configuration and try again.';
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message,
                    cause: error
                });
            }
        }),

})

export type youtubeRouterType = typeof youtubeRouter;