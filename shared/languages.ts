import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'ur', 'hi', 'fr'] as const;
export const languageSchema = z.enum(SUPPORTED_LANGUAGES);
