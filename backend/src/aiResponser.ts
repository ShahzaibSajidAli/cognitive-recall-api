import { generateText, Output } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import z from 'zod';
import { setTimeout } from 'timers/promises';
import { typescriptTranscriptQuestions } from './mockfiles/mockAiResponse.js';


// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename);
const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
]

const localEnvPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

if (localEnvPath) {
    dotenv.config({ path: localEnvPath });
}
else {
    console.log("Production Environment Detected!. Using cloud injected variables.")
}

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Error: GEMINI_API_KEY is missing. Check your parent directory's .env file.");
    console.error(`Attempted to read from: ${path.resolve(process.cwd(), '.env')}`);
    process.exit(1);
}

const rand = (min: number, max: number) =>
    min + Math.random() * (max - min);

async function mockDelay(min: number, max: number) {
    const ms = rand(min, max);
    await new Promise<void>((resolve) => globalThis.setTimeout(() => resolve(), ms));
}
const geminiAI = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY!
});

const aiModel = geminiAI("gemini-3.1-flash-lite");

const SYSTEM_PROMPT_FOR_TRANSCRIPT = `
You are a Socratic tutor that turns a YouTube video transcript into active-recall study material.

GROUNDING RULES (highest priority)
1. Use ONLY information stated in the transcript. Never add outside facts, examples, or topics.
2. Every question must be answerable from a specific passage of the transcript.
3. Every timestampSeconds must be copied from a [Ns] marker in the transcript, at the line where the answer is given. Never invent or estimate a timestamp.
4. If the transcript is too short, unclear, or empty of educational content, return fewer items instead of padding. An empty array is valid.
5. Ignore sponsor reads, intros, "like and subscribe", and small talk.

QUESTION QUALITY
- Write Socratic questions that test understanding: "why", "how", "what would happen if", "what is the difference between". Avoid yes/no questions and trivia such as names, numbers, or exact wording.
- Cover the video's main ideas in order, spread across the whole video rather than only the start.
- Each question must stand alone: a learner who has not just watched the video should still understand it, so never write "the speaker said" or "in this part".
- One idea per question; no duplicates or near-duplicates.

CODING PRACTICE
- Create exercises ONLY when the video teaches programming, scripting, query writing, configuration, or a formula-based technique.
- Each exercise must practice a concept the video actually explains, and the task must be a clear action ("Write a function that...", "Fix the bug in...").
- Provide short starter code (3-25 lines) that is syntactically valid, with TODO comments marking what the learner must complete. Do not give the full solution.
- Use the language and tools used in the video. If none is stated, choose the most natural one.
- If the video is not about code, return an empty coding array. Do not invent unrelated code.

OUTPUT LANGUAGE
- Write all questions and tasks in the requested target language. Keep code, identifiers, and technical terms in their original form.
`.trim();

const buildPromptForTranscript = (opts: { transcriptText: string, language: string, videoTitle?: string }) => `
Target language: ${opts.language}
${opts.videoTitle ? `Video title: ${opts.videoTitle}\n` : ''}
Each line of the transcript below starts with its time in seconds, like [125s].

<transcript>
${opts.transcriptText}
</transcript>

Task:
1. Write 8-12 Socratic questions (fewer if the transcript is short), each with the timestampSeconds where its answer appears.
2. If the video teaches code, write 2-4 practice exercises as described in your rules; otherwise return an empty coding array.
3. Before finalizing, check each question against the transcript. Remove any you cannot support with a specific line.
`.trim()

const buildPromptForFollowUp = (opts: { answers: any[], originalQuestions: any[], followUpQuestions?: string[] }) => `
You are a Socratic tutor that generates follow-up questions based on a learner's previous answers (${opts.answers.join(', ')}). OR Previous Follow up questions asked and their answers: ${opts.followUpQuestions ? opts.followUpQuestions.join(', ') : 'None'} if available.
If the learner's previous answers score less than 50, you must generate fewer questions and focus on the most important concepts.
If the learner's previous answers score 50-90, you must generate more questions and cover a wider range of concepts.
If the learner's previous answers score 90-100, you don't need to generate any follow-up questions.
Task:
1. Write 5-8 Socratic questions (fewer if the answers are short), each with the timestampSeconds where its answer appears.
2. Before finalizing, check each question against the answers. Remove any you cannot support with a specific line.
3. Score the quality of the user's previous answers on a scale from 0 to 100, where 0 is very poor and 100 is excellent.
`.trim()

const SYSTEM_PROMPT_FOR_FOLLOW_UP = `
You are a Socratic tutor that generates follow-up questions based on a learner's previous answers.

GROUNDING RULES (highest priority)
1. Use ONLY information stated in the user 's previous answers. Never add outside facts, examples, or topics.
2. Every question must be answerable from a specific passage of the user's previous answers.
3. If the user's previous answers are too short, unclear, or empty of educational content, return fewer items instead of padding. An empty array is valid.

QUESTION QUALITY
- Write Socratic questions that test understanding: "why", "how", "what would happen if", "what is the difference between". Avoid yes/no questions and trivia such as names, numbers, or exact wording.
- Cover the main ideas in order, spread across the whole set of previous answers rather than only the start.
- Each question must stand alone: a learner who has not just read the previous answers should still understand it, so never write "the user said" or "in this part".
- One idea per question; no duplicates or near-duplicates.

OUTPUT LANGUAGE
- Write all questions in the requested target language. Keep code, identifiers, and technical terms in their original form.
`.trim();

const FollowUpQuestions = z.object({
    questions: z.object({
        general: z.array(z.object({
            question: z.string().describe("A clear question about the concept a learner should be able to answer after watching the video"),
            timestampSeconds: z.number().describe("Second in the video where the answer is discussed; use the transcript's [Ns] markers"),
        })),
        coding: z.array(z.object({
            task: z.string().describe("A short practice task the learner should complete"),
            code: z.string().describe("Starter or example code for the task"),
            lang: z.string().describe("Syntax highlighter language id, e.g. 'typescript'"),
            filename: z.string().describe("Label for the code block, e.g. 'app.ts'"),
        })),
    }),
    isMastered: z.boolean().describe("Indicates if the learner has mastered the concepts based on their previous answers"),
    score: z.number().describe("A score indicating the quality of the user's previous answers, on a scale from 0 to 100"),
});

const TranscriptQuestions = z.object({
    title: z.string().describe("The title of the YouTube video"),
    language: z.string().describe("Language code of the output, e.g. 'en'"),
    questions: z.object({
        general: z.array(z.object({
            question: z.string().describe("A clear question about the concept a learner should be able to answer after watching the video"),
            timestampSeconds: z.number().describe("Second in the video where the answer is discussed; use the transcript's [Ns] markers"),
        })).describe("Conceptual questions based on the concept"),
        coding: z.array(z.object({
            task: z.string().describe("A short practice task the learner should complete"),
            code: z.string().describe("Starter or example code for the task"),
            lang: z.string().describe("Syntax highlighter language id, e.g. 'typescript'"),
            filename: z.string().describe("Label for the code block, e.g. 'app.ts'"),
        })).describe("Coding practice exercises related to the video or Empty if no coding task needed"),
    }),
    isMastered: z.boolean().describe("Indicates if the learner has mastered concepts based on their answers"),
    score: z.number().describe("A score indicating the quality of the user's answers, on a scale from 0 to 100"),
    educational: z.boolean().describe("Tells if the video is related to coding and educational or not")
});

// For Mock Testing Providing Mock JSON
const mockTranscriptQuestionsData = {
    title: "Building Scalable tRPC Microservices in Docker",
    language: "en",
    questions: typescriptTranscriptQuestions,
    educational: true
};

export const aiResponseForTranscript = async (transcript: string, language: string) => {
    if (process.env.MOCK_AI === 'true') {
        await mockDelay(5000, 15000);
        return {
            questions: {
                general: [
                    {
                        question: "What is tRPC and how does it help in building scalable microservices?",
                        timestampSeconds: 45
                    },
                    {
                        question: "How does Docker contribute to the scalability of microservices?",
                        timestampSeconds: 120
                    }
                ],
                coding: [
                    {
                        task: "Write a simple tRPC procedure for fetching user data.",
                        code: "// TODO: Implement a tRPC procedure to fetch user data\nexport const getUser = t.procedure.query(async ({ ctx }) => {\n  // ...\n});",
                        lang: "typescript",
                        filename: "userRouter.ts"
                    }
                ]
            },
            isMastered: false,
            score: 75,
            // Optionally add more mock fields as needed for your tests
        };
    }
    const maxAttempts = 3;

    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
        try {
            console.log(`Generating questions (Attempt ${attempts}/${maxAttempts})...`);

            const { output } = await generateText({
                model: aiModel,
                output: Output.object({
                    schema: TranscriptQuestions
                }),
                system: SYSTEM_PROMPT_FOR_TRANSCRIPT,
                prompt: buildPromptForTranscript({ transcriptText: transcript, language }),
                temperature: 0.3,
                maxRetries: 0,
                providerOptions: {
                    google: {
                        thinkingConfig: { thinkingBudget: 0 },
                    },
                },
            });

            return output; // Exit immediately on success
        } catch (error: any) {
            const isRateLimited = error?.message?.includes("Rate limit exceeded") || error?.message?.includes("429") || error?.status === 429;
            const waitTime = isRateLimited ? 65_000 : attempts * 10_000; // 65s for rate limit, else exponential backoff
            console.error(`Error on attempt ${attempts}:`, error?.message || error);

            if (attempts < maxAttempts) {
                console.log(`Waiting ${waitTime / 1000}s for rolling token limits to clear...`);
                await setTimeout(waitTime);
            } else {
                throw new Error('Failed to generate questions after multiple attempts. Please try again later.');
            }
        }
    }
};

export const aiResponseForFollowUp = async (answers: any[], originalQuestions: any[], followUpQuestions: string[]) => {
    if (process.env.MOCK_AI === 'true') {
        await mockDelay(5000, 15000);
        return mockTranscriptQuestionsData;
    }
    const maxAttempts = 3;

    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
        try {
            console.log(`Generating questions (Attempt ${attempts}/${maxAttempts})...`);

            const { output } = await generateText({
                model: aiModel,
                output: Output.object({
                    schema: FollowUpQuestions
                }),
                system: SYSTEM_PROMPT_FOR_FOLLOW_UP,
                prompt: buildPromptForFollowUp({ answers, originalQuestions, followUpQuestions }),
                temperature: 0.3,
                maxRetries: 0,
                providerOptions: {
                    google: {
                        thinkingConfig: { thinkingBudget: 0 },
                    },
                },
            });

            return output; // Exit immediately on success
        } catch (error: any) {
            const isRateLimited = error?.message?.includes("Rate limit exceeded") || error?.message?.includes("429") || error?.status === 429;
            const waitTime = isRateLimited ? 65_000 : attempts * 10_000; // 65s for rate limit, else exponential backoff
            console.error(`Error on attempt ${attempts}:`, error?.message || error);

            if (attempts < maxAttempts) {
                console.log(`Waiting ${waitTime / 1000}s for rolling token limits to clear...`);
                await setTimeout(waitTime);
            } else {
                throw new Error('Failed to generate questions after multiple attempts. Please try again later.');
            }
        }
    }
};