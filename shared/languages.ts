
export const SUPPORTED_LANGUAGES = ['en', 'es', 'ur', 'hi', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];