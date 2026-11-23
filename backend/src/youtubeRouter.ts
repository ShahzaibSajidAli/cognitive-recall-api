import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './trpc.js';
import { YoutubeTranscript, YoutubeTranscriptDisabledError } from 'youtube-transcript';
import { aiResponseForTranscript, aiResponseForFollowUp } from './aiResponser.js';
import { TRPCError } from '@trpc/server';
import { typescriptTranscript } from './mockfiles/mockTranscript.js';
import { proxiedFetch } from './adapters/proxyProvider.js';
import { eq, and } from 'drizzle-orm';
import { users, videos, type TranscriptOutput, type VideoQuestions } from './db/drizzle/schema/schema.js';
import { createSession } from "./auth/auth.js";
import { hash, verify, argon2id } from 'argon2';
import { refreshTokens } from './db/drizzle/schema/schema.js';
import { verifyRefreshToken } from './auth/auth.js';
import { config } from './config.js';
import { SUPPORTED_LANGUAGES } from '../../shared/languages.js';
// For Mock Testing
const rand = (min: number, max: number) =>
    min + Math.random() * (max - min);

async function mockDelay(min: number, max: number) {
    const ms = rand(min, max);
    await new Promise<void>((resolve) => globalThis.setTimeout(() => resolve(), ms))
}

const YOUTUBE_INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const YOUTUBE_INNERTUBE_CLIENT_VERSION = '20.10.38';
const DUMMY_ARGON2ID_HASH = '$argon2id$v=19$m=65536,t=3,p=4$tq+WSYZUCUPlxr9xDH4xFQ$wQPh4FeAmb655IJ/szkD2JtuTkYGIPPlBir6Nj3ebaU';

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

function buildTranscriptOutput(
    questions: VideoQuestions,
    educational: boolean
): TranscriptOutput {
    return {
        educational,
        questions
    };
}

function isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && error.code === '23505') return true;
    if ('cause' in error) {
        const cause = error.cause;
        return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
    }
    return false;
}

export const youtubeRouter = router({
    signUp: publicProcedure
        .input(
            z.object({
                username: z.string().min(5, { message: 'Username must be at least 5 characters' }).trim(),
                email: z.email().trim().toLowerCase(),
                password: z.string().min(8)
            })
        ).mutation(async ({ ctx, input }) => {
            const { username, email, password } = input;
            const hashedPassword = await hash(password, { type: argon2id });

            let newUser: { id: string; email: string } | undefined;
            try {
                [newUser] = await ctx.db.insert(users).values({
                    username: username,
                    email: email,
                    password: hashedPassword
                }).returning({ id: users.id, email: users.email });
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: 'Email already registered'
                    });
                }
                throw error;
            }
            const { accessToken, refreshToken } = await createSession(newUser!.id)
            return {
                success: true,
                accessToken: accessToken,
                refreshToken: refreshToken
            }
        }),
    login: publicProcedure
        .input(
            z.object({
                email: z.email().trim().toLowerCase(),
                password: z.string().min(8)
            })).mutation(async ({ ctx, input }) => {
                const { email, password } = input;
                const [fetchUser] = await ctx.db.select().from(users).where(eq(users.email, email));

                if (!fetchUser) {
                    await verify(DUMMY_ARGON2ID_HASH, password);
                    throw new TRPCError({
                        code: 'UNAUTHORIZED', message: 'Invalid Email or Password'
                    })
                }

                if (!await verify(fetchUser.password, password)) {
                    throw new TRPCError({
                        code: 'UNAUTHORIZED', message: 'Invalid Email or Password'
                    })
                }
                const { accessToken, refreshToken } = await createSession(fetchUser.id)
                return { success: true, accessToken: accessToken, refreshToken: refreshToken }
            }),
    logout: publicProcedure
        .input(
            z.object({
                refreshToken: z.string(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { refreshToken } = input;
            const payload = await verifyRefreshToken(refreshToken);

            if (payload) {

                await ctx.db.delete(refreshTokens).where(and(eq(refreshTokens.id, payload.tokenId),
                    eq(refreshTokens.userId, payload.userId)))
            }

            return { success: true }
        }),
    refresh: publicProcedure.input(
        z.object({
            refreshToken: z.string(),
        })
    ).mutation(async ({ ctx, input }) => {
        const payload = await verifyRefreshToken(input.refreshToken);

        if (!payload) {
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired refresh token'
            });
        }

        const [session] = await ctx.db
            .select()
            .from(refreshTokens)
            .where(eq(refreshTokens.id, payload.tokenId));

        if (!session) {
            await ctx.db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.userId));
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Refresh session is invalid or expired'
            });
        }

        if (
            session.userId !== payload.userId ||
            session.expiresAt <= new Date()
        ) {
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Refresh session is invalid or expired'
            });
        }

        // Rotate the refresh session: revoke the old one before creating a replacement.
        await ctx.db.delete(refreshTokens).where(eq(refreshTokens.id, payload.tokenId));

        const { accessToken, refreshToken } = await createSession(payload.userId);

        return {
            success: true,
            accessToken,
            refreshToken
        };
    }),
    getTranscript: protectedProcedure
        .input(
            z.object({
                videoUrl: z.string().min(1, { message: 'URL cannot be empty' }),
                language: z.enum(SUPPORTED_LANGUAGES) 
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const intervalSeconds = 60;
                let currentBucket = -1;
                const { videoUrl, language } = input;
                if (config.MOCK_TRANSCRIPT === 'true') {
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
                    if (!aiOutput) {
                        throw new Error('Failed to generate questions from transcript.');
                    }
                    return {
                        success: true,
                        output: buildTranscriptOutput(
                            aiOutput.questions,
                            !('educational' in aiOutput) || aiOutput.educational
                        ),
                        message: language
                    }

                } else {
                    // Database Check: If the video already exists in the database, returns the stored questions and coding practices
                    const [existingVideo] = await ctx.db.select().from(videos).where(and(
                        eq(videos.videoId, extractYoutubeVideoId(videoUrl) || 'unknown'),
                        eq(videos.language, language)
                    ));

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
                            const videoValues: typeof videos.$inferInsert = {
                                videoId: extractYoutubeVideoId(videoUrl) || 'unknown',
                                language,
                                educational: !('educational' in aiOutput) || aiOutput.educational,
                                questions: aiOutput.questions
                            };
                            await ctx.db.insert(videos).values([videoValues])

                            return {
                                success: true,
                                output: buildTranscriptOutput(
                                    aiOutput.questions,
                                    !('educational' in aiOutput) || aiOutput.educational
                                ),
                                message: innerTubeRequest!.languageCode
                            }
                        }
                        else {
                            throw new TRPCError({
                                code: 'NOT_FOUND',
                                message: 'This video has no captions available.'
                            });
                        }
                    }
                    else {
                        // If the video already exists in the database, return the stored questions and coding practices
                        const response = {
                            success: true,
                            output: buildTranscriptOutput(existingVideo.questions, existingVideo.educational),
                            message: 'Retrieved from database'
                        };

                        return response;
                    }
                }
            }
            catch (error) {
                if (error instanceof TRPCError) throw error;
                ctx.req.log.error({ err: error }, "getTranscript failed");
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