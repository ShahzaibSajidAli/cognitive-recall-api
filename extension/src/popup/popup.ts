import { TRPCError } from "@trpc/server";

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
                const questions = response.output.questions.coding;
                output.innerHTML = "";
                for(const question of questions) {
                    const questionCard = document.createElement("div");
                    questionCard.className = "question-card"
                    questionCard.innerHTML = `<h3 class=question-text>Task: ${question.task} & Code: ${question.code}</h3>`;
                    output.appendChild(questionCard); 
                }
            }
        }
        catch (error: any) {
            // 5. Handle System/Channel disconnection errors
            loader?.classList.add('hidden');
            output.classList.add('error-text');
            output.textContent = 'Error: Could not reach extension background script.';
            console.error('Failed to communicate with background worker.', error);
            chrome.runtime.lastError && console.error('Runtime error:', chrome.runtime.lastError);
            if(error instanceof Error) {
                throw new TRPCError({
                    message: error.message,
                    cause: error.cause,
                    code: "PARSE_ERROR"
                })
            }
        }
    });
}
