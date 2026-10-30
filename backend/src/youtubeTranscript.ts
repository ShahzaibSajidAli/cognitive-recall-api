import { fetch as undiciFetch, ProxyAgent } from 'undici';

type CaptionTrack = {
    baseUrl: string;
    languageCode?: string;
    kind?: string;
};

export type TranscriptItem = {
    text: string;
    offset: number;
    duration: number;
};

type PlayerResponse = {
    captions?: {
        playerCaptionsTracklistRenderer?: {
            captionTracks?: CaptionTrack[];
        };
    };
};

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

function extractYoutubeVideoId(videoUrl: string): string {
    const match = videoUrl.match(
        /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
    );

    if (!match?.[1]) {
        throw new Error('Invalid YouTube video URL.');
    }

    return match[1];
}

function decodeXmlEntities(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function selectCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
    return tracks.find((track) => track.languageCode === 'en' && track.kind !== 'asr') ??
        tracks.find((track) => track.languageCode === 'en' && track.kind === 'asr') ??
        tracks.find((track) => track.kind !== 'asr') ??
        tracks.find((track) => track.kind === 'asr');
}

export async function fetchTranscriptWithFallback(
    videoUrl: string
): Promise<TranscriptItem[]> {
    const response = await proxiedFetch(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'ANDROID',
                        clientVersion: '20.10.38'
                    }
                },
                videoId: extractYoutubeVideoId(videoUrl)
            })
        }
    );

    if (!response.ok) {
        throw new Error(`InnerTube request failed with status ${response.status}.`);
    }

    const playerResponse = await response.json() as PlayerResponse;
    const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const selectedTrack = selectCaptionTrack(tracks);

    if (!selectedTrack) {
        throw new Error('No manual or auto-generated captions are available.');
    }

    const captionResponse = await proxiedFetch(selectedTrack.baseUrl, {
        headers: {
            'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
        }
    });

    if (!captionResponse.ok) {
        throw new Error(`Caption request failed with status ${captionResponse.status}.`);
    }

    const xml = await captionResponse.text();
    return [...xml.matchAll(
        /<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
    )].flatMap(([, start, duration, text]) => {
        if (!start || !duration || text === undefined) {
            return [];
        }

        return [{
            text: decodeXmlEntities(text.replace(/<[^>]+>/g, '')),
            offset: Number.parseFloat(start) * 1000,
            duration: Number.parseFloat(duration) * 1000
        }];
    });
}
