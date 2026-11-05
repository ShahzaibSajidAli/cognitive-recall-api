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

const SCRAPER_PROXY1 = process.env.SCRAPER_PROXY1?.trim();
const SCRAPER_PROXY2 = process.env.SCRAPER_PROXY2?.trim();

console.log(`[proxyProvider] SCRAPER_PROXY1 configured: ${Boolean(SCRAPER_PROXY1)}`);
console.log(`[proxyProvider] SCRAPER_PROXY2 configured: ${Boolean(SCRAPER_PROXY2)}`);

function normalizeProxyUri(proxy: string | undefined, name: string): string {
    if (!proxy) {
        throw new Error(`${name} is required.`);
    }

    return /^[a-z][a-z\d+\-.]*:\/\//i.test(proxy)
        ? proxy
        : `http://${proxy}`;
}

const scraperProxy1Uri = normalizeProxyUri(SCRAPER_PROXY1, 'SCRAPER_PROXY1');
const scraperProxy2Uri = normalizeProxyUri(SCRAPER_PROXY2, 'SCRAPER_PROXY2');

// Fetch API Key from the URI if present
function fetchApiKeyFromUri(uri: string | undefined): string | undefined {
    const url = new URL(uri!);
    return url.password;
}

let Switchable = {
    SCRAPER_PROXY1: 'YES',
    SCRAPER_PROXY2: 'YES',
};

let currentProvider: 'SCRAPER_PROXY1' | 'SCRAPER_PROXY2';

if (Switchable.SCRAPER_PROXY1 === 'YES') {
    currentProvider = 'SCRAPER_PROXY1';
} else {
    currentProvider = 'SCRAPER_PROXY2';
}

let requestCount = 0;
const MAX_REQUESTS_PER_PROVIDER = 6;

function switchProvider() {
    if (Switchable.SCRAPER_PROXY1 === 'NO' && Switchable.SCRAPER_PROXY2 === 'NO') {
        console.error('[proxyProvider] Both ScraperAPI proxies have exhausted their credits.');
        throw new Error('Both ScraperAPI proxies have exhausted their credits.');
    }

    if (currentProvider === 'SCRAPER_PROXY1') {
        currentProvider = 'SCRAPER_PROXY2';
    } else {
        currentProvider = 'SCRAPER_PROXY1';
    }
    requestCount = 0;
}

const scraperProxy1Dispatcher = new ProxyAgent({
    uri: scraperProxy1Uri,
    proxyTls: { rejectUnauthorized: false },
    requestTls: { rejectUnauthorized: false },
});

const scraperProxy2Dispatcher = new ProxyAgent({
    uri: scraperProxy2Uri,
    proxyTls: { rejectUnauthorized: false },
    requestTls: { rejectUnauthorized: false },
});

function getDispatcher(): ProxyAgent {
    if (currentProvider === 'SCRAPER_PROXY1') {
        return scraperProxy1Dispatcher;
    }
    return scraperProxy2Dispatcher;
}

async function limitExceededCheck(key: 'SCRAPER_PROXY1' | 'SCRAPER_PROXY2') {
    const uri = key === 'SCRAPER_PROXY1'
        ? scraperProxy1Uri
        : scraperProxy2Uri;
    const apiKey = fetchApiKeyFromUri(uri);
    const response = await globalThis
        .fetch(`http://api.scraperapi.com/account?api_key=${encodeURIComponent(apiKey ?? '')}`)
        .then(response => response.json());

    if (response.requestCount >= response.requestLimit) {
        console.warn(`[proxyProvider] ${key} credits exhausted. Switching proxy.`);
        Switchable[key] = 'NO';
        return true;
    }

    Switchable[key] = 'YES';
    return false;
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
