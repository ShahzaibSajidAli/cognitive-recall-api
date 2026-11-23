import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env')
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

dotenv.config(envPath ? { path: envPath } : {});

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
    SCRAPER_PROXY1: z.string().min(1).optional(),
    SCRAPER_PROXY2: z.string().min(1).optional(),
    ALLOWED_ORIGIN: z.string().min(1).default('*'),
    MOCK_TRANSCRIPT: z.enum(['true', 'false']).default('false'),
    MOCK_AI: z.enum(['true', 'false']).default('false'),
    DATABASE_CA_CERT: z.string().min(1).optional()
}).superRefine((value, ctx) => {
    if (value.MOCK_TRANSCRIPT !== 'true') {
        if (!value.SCRAPER_PROXY1) {
            ctx.addIssue({
                code: 'custom',
                path: ['SCRAPER_PROXY1'],
                message: 'SCRAPER_PROXY1 is required when MOCK_TRANSCRIPT is not true'
            });
        }
        if (!value.SCRAPER_PROXY2) {
            ctx.addIssue({
                code: 'custom',
                path: ['SCRAPER_PROXY2'],
                message: 'SCRAPER_PROXY2 is required when MOCK_TRANSCRIPT is not true'
            });
        }
    }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const details = parsed.error.issues
        .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
}

export const config = parsed.data;
