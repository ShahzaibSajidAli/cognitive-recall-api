const btn = document.getElementById('btn');
const output = document.getElementById('output');
if (btn) {
    btn.addEventListener('click', async () => {
        console.log('Button clicked! Sending command to background worker..');
        try {
            if (output) {
                output.textContent = 'Fetching transcript...';
            }
            await chrome.runtime.sendMessage({
                action: 'TRIGGER_FETCH'
            })
            console.log('Message sent to background worker successfully.');

        }
        catch (error) {
            console.error('Failed to send message to background worker.', error);
            chrome.runtime.lastError && console.error('Runtime error:', chrome.runtime.lastError);
            if (output) {
                output.textContent = 'Error: Could not send message to background worker.';
            }
        }
    });

}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'FETCH_SUCCESS') {
        console.log('Popup received transcript from background worker:', message.transcript);
        if (output) {
            output.textContent = message.transcript && message.transcript.length > 0 ? message.transcript.map((item: { text: string }) => item.text).join(' ') : 'No transcript available for this video.';
        }

    }
    if (message.action === 'FETCH_ERROR') {
        console.error('Popup received error from background worker:', message.error);
        if (output) {
            output.textContent = `Error: ${message.error}`;
        }
    }
})