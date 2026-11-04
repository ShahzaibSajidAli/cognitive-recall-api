import { fetch as undiciFetch, ProxyAgent } from 'undici';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
];

const localEnvPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

if (localEnvPath) {
    dotenv.config({ path: localEnvPath });
} else {
    console.log('Production Environment Detected!. Using cloud injected variables.');
}

const SCRAPERAPI_PROXY = process.env.SCRAPERAPI_PROXY?.trim();
const ZENROWS_PROXY = process.env.ZENROWS_PROXY?.trim();

console.log(`[proxyProvider] SCRAPERAPI_PROXY: ${SCRAPERAPI_PROXY}`);
console.log(`[proxyProvider] ZENROWS_PROXY: ${ZENROWS_PROXY}`);

const SCRAPERAPI_URI = /^[a-z][a-z\d+\-.]*:\/\//i.test(SCRAPERAPI_PROXY || '')
    ? SCRAPERAPI_PROXY
    : `http://${SCRAPERAPI_PROXY}`;

const ZENROWS_URI = /^[a-z][a-z\d+\-.]*:\/\//i.test(ZENROWS_PROXY || '')
    ? ZENROWS_PROXY
    : `http://${ZENROWS_PROXY}`;

// Fetch API Key from the URI if present
function fetchApiKeyFromUri(uri: string | undefined): string | undefined {
    const url = new URL(uri!);
    return url.password;
}

let Switchable = {
    SCRAPERAPI: 'YES',
    ZENROWS: 'YES',
};

let currentProvider: 'SCRAPERAPI' | 'ZENROWS';

if (Switchable.SCRAPERAPI === 'YES') {
    currentProvider = 'SCRAPERAPI';
} else {
    currentProvider = 'ZENROWS';
}

let requestCount = 0;
const MAX_REQUESTS_PER_PROVIDER = 6;

function switchProvider() {
    if (Switchable['SCRAPERAPI'] === 'NO' && Switchable['ZENROWS'] === 'NO') {
        console.error(`[proxyProvider] Both providers have exhausted their credits. Please check your API keys and usage limits.`);
        throw new Error('Both providers have exhausted their credits.');
    }

    if (currentProvider === 'SCRAPERAPI') {
        currentProvider = 'ZENROWS';
    } else {
        currentProvider = 'SCRAPERAPI';
    }
    requestCount = 0;
}

const scraperDispatcher = new ProxyAgent({
    uri: SCRAPERAPI_URI!,
    proxyTls: { rejectUnauthorized: false },
    requestTls: { rejectUnauthorized: false },
});

const zenrowsDispatcher = new ProxyAgent({
    uri: ZENROWS_URI!,
    proxyTls: { rejectUnauthorized: false },
    requestTls: { rejectUnauthorized: false },
});

function getDispatcher(): ProxyAgent {
    if (currentProvider === 'SCRAPERAPI') {
        return scraperDispatcher;
    }
    return zenrowsDispatcher;
}

async function limitExceededCheck(key: string) {
    if (key === 'SCRAPERAPI') {
        const apiKey = fetchApiKeyFromUri(SCRAPERAPI_URI);
        const response = await globalThis
            .fetch(`http://api.scraperapi.com/account?api_key=${apiKey}`)
            .then(response => response.json());

        if (response.requestCount >= response.requestLimit) {
            console.warn(`[proxyProvider] ScraperAPI credits exhausted. Switching provider.`);
            Switchable['SCRAPERAPI'] = 'NO';
            return true;
        } else {
            Switchable['SCRAPERAPI'] = 'YES';
            return false;
        }
    }

    if (key === 'ZENROWS') {
        const apiKey = fetchApiKeyFromUri(ZENROWS_URI);
        const response = await globalThis.fetch('https://api.zenrows.com/v1/account', {
            method: 'GET',
            headers: {
                'X-API-KEY': apiKey!,
            },
        }).then(response => response.json());

        if (response.requestCount >= response.requestLimit) {
            console.warn(`[proxyProvider] ZenRows credits exhausted. Switching provider.`);
            Switchable['ZENROWS'] = 'NO';
            return true;
        } else {
            Switchable['ZENROWS'] = 'YES';
            return false;
        }
    }
}

export async function proxiedFetch(url: any, init?: any): Promise<Response> {
    const response = await limitExceededCheck(currentProvider);

    if (response === true) {
        switchProvider();
    }

    requestCount++;

    if (requestCount >= MAX_REQUESTS_PER_PROVIDER) {
        if (!response) {
            switchProvider();
        }
    }

    const dispatcher = getDispatcher();
    return undiciFetch(url, { ...init, dispatcher }) as unknown as Promise<Response>;
}
