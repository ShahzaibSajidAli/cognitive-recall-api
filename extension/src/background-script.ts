import { createTRPCProxyClient, httpBatchLink, type inferRouterProxyClient } from "@trpc/client";
import type { youtubeRouterType } from "../../backend/src/youtubeRouter";

export const trpcClient: inferRouterProxyClient<youtubeRouterType> = createTRPCProxyClient<youtubeRouterType>({
    links: [
        httpBatchLink({
            url: import.meta.env.PUBLIC_IP,
            async headers() {
                const { accessToken } = await chrome.storage.local.get("accessToken");
                return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
            },
            fetch(url, options) {
                const timeoutSignal = AbortSignal.timeout(120_000);

                const combinedSignal = options?.signal ? AbortSignal.any([options?.signal, timeoutSignal]) : timeoutSignal;
                return fetch(url, {
                    ...options,
                    signal: combinedSignal
                })
            }
        })
    ]
});

let refreshInFlight: Promise<void> | null = null;

function refreshSession(): Promise<void> {
    if (refreshInFlight) return refreshInFlight;

    const promise = (async () => {
        const { refreshToken } = await chrome.storage.local.get("refreshToken") as { refreshToken?: string };
        if (!refreshToken) {
            throw new Error("No refresh token found.");
        }

        const result = await trpcClient.refresh.mutate({ refreshTokens: refreshToken });
        await chrome.storage.local.set({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken ?? refreshToken
        });
    })();
    refreshInFlight = promise;

    void promise.then(
        () => {
            if (refreshInFlight === promise) refreshInFlight = null;
        },
        () => {
            if (refreshInFlight === promise) refreshInFlight = null;
        }
    );
    return promise;
}

function isUnauthorizedError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;

    if ('data' in error) {
        const data = error.data;
        if (typeof data === 'object' && data !== null && 'code' in data && data.code === 'UNAUTHORIZED') {
            return true;
        }
    }

    return 'message' in error && typeof error.message === 'string'
        && error.message.toUpperCase().includes('UNAUTHORIZED');
}

async function handleFetch(sendResponse: (response: any) => void, lang: string) {
    try {
        console.log('handleFetch routine started. Querying active tab...');

        // Use destructuring [tab] to cleanly pull index 0 directly out of the array
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tab || !tab.url) {
            console.log('Validation failed: No active tab or URL properties found.');
            sendResponse({ success: false, error: 'No active tab found or tab has no URL.' });
            return;
        }

        const currentUrl = tab.url;
        console.log('Extension captured active URL:', currentUrl);

        // Standardized validation rule checking
        if (!currentUrl.includes('youtube.com') && !currentUrl.includes('youtu.be')) {
            console.log('Validation failed: URL is not a YouTube path.');
            sendResponse({ success: false, error: 'Please open a valid YouTube video page.' });
            return;
        }

        console.log('Sending mutation request to tRPC Fastify backend...');

        const response = await trpcClient.getTranscript.mutate({
            videoUrl: currentUrl,
            language: lang
        })!;

        console.log('Mutation request completed. Backend response:', response?.output);

        console.log('Success! Backend sent back the transcript:', response!.output);
        sendResponse({
            success: true, output: response!.output, message: response!.message
        });
    }
    catch (error: unknown) {
        if (isUnauthorizedError(error)) {
            try {
                await refreshSession();

                const [tab] = await chrome.tabs.query({
                    active: true,
                    currentWindow: true
                });
                if (!tab?.url) {
                    sendResponse({ success: false, error: 'No active tab found or tab has no URL.' });
                    return;
                }

                const retryResponse = await trpcClient.getTranscript.mutate({
                    videoUrl: tab.url,
                    language: lang
                });
                sendResponse({
                    success: true,
                    output: retryResponse.output,
                    message: retryResponse.message
                });
                return;
            } catch (refreshError) {
                await chrome.storage.local.remove(["accessToken", "refreshToken"]);
                sendResponse({
                    success: false,
                    error: 'Please log in again.',
                    cause: refreshError
                });
                return;
            }
        }

        console.error('Fatal failure inside asynchronous execution path:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown network error occurred.'
        });
    }
}

async function handleAuthentication(sendResponse: (response: any) => void, action: string, opts: any) {
    try {
        if (action === "signup") {
            await trpcClient.signUp.mutate({
                username: opts.username,
                email: opts.email,
                password: opts.password
            });
            sendResponse({ success: true });
            return;
        }

        if (action === "login") {
            const { accessToken, refreshToken } = await trpcClient.login.mutate({
                email: opts.email,
                password: opts.password
            });
            await chrome.storage.local.set({ accessToken, refreshToken });
            sendResponse({ success: true });
            return;
        }

        if (action === "refresh") {
            await refreshSession();
            sendResponse({ success: true });
            return;
        }

        if (action === "logout") {
            const { refreshToken } = await chrome.storage.local.get("refreshToken") as {
                refreshToken?: string;
            };
            try {
                if (refreshToken) {
                    await trpcClient.logout.mutate({ refreshToken });
                }
            } finally {
                await chrome.storage.local.remove(["accessToken", "refreshToken"]);
            }
            sendResponse({ success: true });
            return;
        }

        sendResponse({ success: false, error: `Unsupported authentication action: ${action}` });
    } catch (error: any) {
        const defaultMessage = `${action.charAt(0).toUpperCase()}${action.slice(1)} failed.`;
        sendResponse({ success: false, error: error.message || defaultMessage });
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'TRIGGER_FETCH') {
        console.log('Background script received message from popup.ts');
        handleFetch(sendResponse, message.language);
        return true; // Keeps channel alive safely
    }

    if (message.action === 'TRIGGER_SIGNUP') {
        console.log('Background script received message from popup.ts');
        handleAuthentication(sendResponse, "signup", message);
        return true;
    }

    if (message.action === 'TRIGGER_LOGIN') {
        console.log('Background script received message from popup.ts');
        handleAuthentication(sendResponse, "login", message);
        return true;
    }

    if (message.action === 'TRIGGER_LOGOUT') {
        console.log('Background script received message from popup.ts');
        handleAuthentication(sendResponse, "logout", message);
        return true;
    }

    if (message.action === 'TRIGGER_REFRESH') {
        console.log('Background script received message from popup.ts');
        handleAuthentication(sendResponse, "refresh", message);
        return true;
    }
});
