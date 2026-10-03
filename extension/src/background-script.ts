import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { youtubeRouterType } from "../../backend/src/youtubeRouter";

export const trpcClient = createTRPCProxyClient<youtubeRouterType>({
    links: [
        httpBatchLink({
            url: 'http://localhost:3000/trpc'
        })
    ]
});

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
        });

        console.log('Success! Backend sent back the transcript:', response.output);
        sendResponse({ success: true, output: response.output });
    }
    catch (error: any) {
        console.error('Fatal failure inside asynchronous execution path:', error);
        sendResponse({ success: false, error: error.message || 'Unknown network error occurred.' });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TRIGGER_FETCH') {
        console.log('Background script received message from popup.ts');
        handleFetch(sendResponse, message.language);
        return true; // Keeps channel alive safely
    }
});
