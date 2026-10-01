const btn = document.getElementById('btn');
const output = document.getElementById('output');
const outputWrapper = document.getElementById('output-wrapper');
const loader = document.getElementById('loader');
const inputLang = document.getElementById('inputLanguage') as HTMLInputElement;


if (!btn || !output || !inputLang) {
    console.log("Required DOM elements ('btn' or 'output' or 'inputLang') were not found");
}
else {
    btn.addEventListener('click', async () => {
        const targetLang = inputLang.value.trim() || 'en'; // Falls back to English if empty string
        if(!targetLang) {
            output.textContent = 'Error: Please type a language before fetching.'
            return
        }
        console.log('Button clicked! Sending command to background worker..');
        try {
            // 1. Immediately set loading state
            outputWrapper?.classList.remove('hidden');
            loader?.classList.remove('hidden');
            output.classList.remove('error-text');
            output.textContent = '';
            
            // 2. Await the response from background.ts
            const response = await chrome.runtime.sendMessage({
                action: 'TRIGGER_FETCH',
                language: targetLang
            });
            console.log('Message sent to background worker successfully.');

            loader?.classList.add('hidden');

            // 3. Handle Application/Backend errors
            if (!response || !response.success) {
                const errorMsg = response?.error || 'Unknown error occurred.';
                console.log('Fetch error:', errorMsg);
                output.textContent = `Error: ${errorMsg}`; // <-- FIXED: Updates UI on error
            }
            // 4. Handle Successful responses
            else {
                const text = response.transcript.map((item: any) => item.text);
                const paragraph = text.join(' ');
                
                // <-- FIXED: Assigned the clean paragraph string instead of raw array
                output.textContent = paragraph || 'No transcript available for this video.'; 
            }
        }
        catch (error: any) {
            // 5. Handle System/Channel disconnection errors
            loader?.classList.add('hidden');
            output.classList.add('error-text');
            output.textContent = 'Error: Could not reach extension backround script.';
            console.error('Failed to communicate with background worker.', error);
            chrome.runtime.lastError && console.error('Runtime error:', chrome.runtime.lastError);
            output.textContent = 'Error: Could not reach extension background script.';
        }
    });
}
