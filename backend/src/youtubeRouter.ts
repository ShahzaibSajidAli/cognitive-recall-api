import { z } from 'zod';
import { router, procedure } from './trpc.js';
import { YoutubeTranscript, YoutubeTranscriptDisabledError } from 'youtube-transcript'
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

const proxyValue = process.env.SCRAPERAPI_PROXY?.trim();
if (!proxyValue) {
    throw new Error('SCRAPERAPI_PROXY is required to fetch YouTube transcripts.');
}

const proxyUri = /^[a-z][a-z\d+\-.]*:\/\//i.test(proxyValue)
    ? proxyValue
    : `http://${proxyValue}`;

const dispatcher = new ProxyAgent({
    uri: proxyUri,
    proxyTls: { rejectUnauthorized: false },
    requestTls: { rejectUnauthorized: false }
});

const proxiedFetch = ((url: any, init?: any) =>
    undiciFetch(url, { ...init, dispatcher })) as unknown as typeof globalThis.fetch;

const YOUTUBE_INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const YOUTUBE_INNERTUBE_CLIENT_VERSION = '20.10.38';

function extractYoutubeVideoId(videoUrl: string): string | undefined {
    const match = videoUrl.match(
        /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
    );
    return match?.[1];
}

async function inspectInnerTubeMetadata(videoUrl: string): Promise<void> {
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

        console.info('[youtube-debug] InnerTube metadata:', {
            videoId,
            status: response.status,
            ok: response.ok,
            playabilityStatus: playerResponse.playabilityStatus?.status ?? 'missing',
            hasCaptionTracks: tracks.length > 0,
            captionTracks: tracks.map((track) => ({
                languageCode: track.languageCode ?? 'unknown',
                name: track.name?.simpleText ?? 'unknown',
                kind: track.kind ?? 'manual'
            }))
        });
    } catch (error) {
        console.error('[youtube-debug] InnerTube metadata request failed:', error);
    }
}

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
                    if (process.env.DEBUG_YOUTUBE_METADATA === 'true') {
                        await inspectInnerTubeMetadata(videoUrl);
                    }

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
                    // const aiOutput = await aiResponse(transcriptText, language);
                    return {
                        success: true,
                        output: transcriptText
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
        })
})

export type youtubeRouterType = typeof youtubeRouter;