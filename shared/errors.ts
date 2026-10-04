const ERRORS = {
    NO_CAPTIONS: {
        message: 'Could not fetch transcript. Ensure the video has captions.',
        retryable: false,
        code: 'NOT_FOUND',
    },

    RATE_LIMITED: {
        message: 'Rate limit exceeded. Please try again later.',
        retryable: true,
        code: 'TOO_MANY_REQUESTS',
    },

    SERVER_CONFIG: {
        message: 'Server configuration error. Please contact support.',
        retryable: false,
        code: 'INTERNAL_SERVER_ERROR',
    },

    INVALID_URL: {
        message: 'Invalid YouTube URL. Please provide a valid video link.',
        retryable: false,
        code: 'BAD_REQUEST',
    },

    VIDEO_UNAVAILABLE: {
        message: 'The requested video is unavailable. It may have been removed or set to private.',
        retryable: false,
        code: 'NOT_FOUND',
    },

    VIDEO_TOO_LONG: {
        message: 'The video is too long to process. Please select a shorter video.',
        retryable: false,
        code: 'BAD_REQUEST',
    },

    NOT_EDUCATIONAL: {
        message: 'The video does not appear to be educational or relevant to programming, scripting, query writing, configuration, or formula-based techniques.',
        retryable: false,
        code: 'BAD_REQUEST',
    },

    AI_TIMEOUT: {
        message: 'The AI service timed out while processing the transcript. Please try again later.',
        retryable: true,
        code: 'GATEWAY_TIMEOUT',
    },

    AI_BAD_OUTPUT: {
        message: 'The AI service returned an unexpected output. Please try again later.',
        retryable: true,
        code: 'INTERNAL_SERVER_ERROR',
    },

    UNKNOWN_ERROR: {
        message: 'An unknown error occurred. Please try again later.',
        retryable: true,
        code: 'INTERNAL_SERVER_ERROR',
    },
} as const;

export type ErrorKey = keyof typeof ERRORS;

export const getErrorResponse = (errorKey: ErrorKey) => {
    const error = ERRORS[errorKey];
    return {
        message: error.message,
        retryable: error.retryable,
        code: error.code,
    };
};