import { generateText, Output } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import z from 'zod';

// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename);
const localEnvPath = path.resolve(process.cwd(), '.env')

if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
}
else {
    console.log("Production Environment Detected!. Using cloud injected variables.")
}

if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ Error: OPENROUTER_API_KEY is missing. Check your parent directory's .env file.");
    console.error(`Attempted to read from: ${path.resolve(process.cwd(), '.env')}`);
    process.exit(1);
}

const geminiAI = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY!,
})

const TranscriptQuestions = z.object({
    title: z.string().describe("The Title of The Youtube Video"),
    language: z.string().describe("The language of the transcript, e.g., 'en' for English."),
    questions: z.array(z.string()).describe("The array of questions related to the transcript."),
    timestamps: z.array(z.string()).describe("The array of timestamps corresponding to each question.If a question does not have a timestamp, it should be represented as an empty string."),
    codingPractices: z.object({
        code: z.array(z.string()).describe("The array of code snippets that demonstrate coding practices relevant to the transcript content."),
        lang: z
            .string()
            .default("text")
            .describe("The programming language identifier used by the syntax highlighter, such as 'typescript' or 'json'."),

        filename: z
            .string()
            .optional()
            .describe("An optional label or system file path displayed at the top bar of the code block layout."),

        highlightLines: z
            .array(z.number())
            .optional()
            .describe("An optional list of absolute 1-indexed line numbers that should receive visual emphasis or highlight animations."),

        diff: z
            .object({
                added: z.array(z.number()).describe("Line numbers containing newly introduced code modifications."),
                removed: z.array(z.number()).describe("Line numbers containing removed or deprecated code blocks."),
            })
            .optional()
            .describe("Metadata highlighting line-by-line diff variations inside git or code change snippets."),
    }).describe("Defines the exact structure, constraints, and runtime attributes for processing browser code elements."),
})

export const aiResponse = async (transcript: unknown, language: string) => {
    try {
        console.log("Generating questions based on the transcript and translating to:", language);
        const { output } = await generateText({
            model: geminiAI("gemini-3.8-flash"),
            output: Output.object({
                schema: TranscriptQuestions
            }),
            system: "You are a precise data extraction agent. You must respond ONLY with a clean JSON object conforming strictly to the requested schema. No markdown backticks, no introductory text.",
            prompt: `You are a helpful assistant that generates questions based on the transcript of a youtube video. You have the following transcript: ${transcript}. Now, generate a list of questions that are relevant to the content of the transcript. The questions should be clear, concise, and thought-provoking. Additionally, even if there are no coding practices in the video, you must provide a coding practice example that is relevant to the content of the transcript. The coding practice should include a code snippet, the programming language used, and any relevant explanations or comments. This is the target language for the questions and coding practices: ${language}. Sometimes you mismatch with the transcript of the video so never do that and force yourself to match the transcript`,
            providerOptions: {
                openrouter: {
                    mode: 'json',
                }
            }
        })
        const parsedOutput = TranscriptQuestions.parse(output);
        console.log("Questions:", parsedOutput.questions);
        console.log("Timestamps:", parsedOutput.timestamps);
        console.log("Coding Practices:", parsedOutput.codingPractices.code);
        return parsedOutput;
    }
    catch (error: any) {
        console.error("Error generating questions:", error);
        throw new Error('Failed to generate questions. Please check the transcript and try again.');
    }
}
