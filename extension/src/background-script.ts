import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
// Make sure this path points correctly to your backend type definition
import type { youtubeRouterType } from "../../backend/src/youtubeRouter";

export const trpcClient = createTRPCProxyClient<youtubeRouterType>({
    links: [
        httpBatchLink({
            url: 'http://localhost:3000/trpc'
        })
    ]
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 🚨 FIX: Remove 'sender.tab' validation from here because the sender is your popup window, not the webpage!
    if (message.action === 'TRIGGER_FETCH') {
        console.log('Background script received message from popup.ts', message);

        (async () => {
            try {
                const [tab]: chrome.tabs.Tab[] = await chrome.tabs.query({
                    active: true,
                    currentWindow: true
                });

                if (!tab || !tab.url) {
                    sendResponse({ success: false, error: 'No active tab found or tab has no URL.' });
                    return;
                }

                const currentUrl = tab.url;

                // 🔒 Security Check: Validate the target URL inside the tab context instead
                if (!currentUrl.includes('://youtube.com')) {
                    sendResponse({ success: false, error: 'Please open a valid YouTube video page.' });
                    return;
                }

                console.log('Extension captured active URL:', currentUrl);

                // This variable initializes properly within the logical pathway
                const response = await trpcClient.getTranscript.mutate({
                    videoUrl: currentUrl
                });

                sendResponse({ success: true, transcript: response.transcript });
                console.log('Success! Backend sent back the transcript:', response.transcript);
            }
            catch (error: any) {
                console.error('Failed to communicate with backend.', error);
                sendResponse({ success: false, error: error.message || 'Unknown error occurred.' });
            }
        })();
        return true; // Indicates that the response will be sent asynchronously
    }
});
