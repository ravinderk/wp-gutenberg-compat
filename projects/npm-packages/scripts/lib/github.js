import { sleep } from './utils.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function headers() {
    const h = { Accept: 'application/vnd.github+json' };
    if (GITHUB_TOKEN) {
        h.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }
    return h;
}

async function fetchWithRetry(url, { useAuth = false, maxAttempts = 3 } = {}, attempt = 1) {
    const res = await fetch(url, useAuth ? { headers: headers() } : undefined);

    if (res.status === 429 || res.status === 403) {
        if (attempt > maxAttempts) throw new Error(`Rate-limited after ${maxAttempts} retries: ${url}`);
        const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
        console.warn(`Rate-limited, retrying in ${retryAfter}s (attempt ${attempt})…`);
        await sleep(retryAfter * 1000);
        return fetchWithRetry(url, { useAuth, maxAttempts }, attempt + 1);
    }

    if (!res.ok) {
        if (attempt > maxAttempts) throw new Error(`HTTP ${res.status} after ${maxAttempts} retries: ${url}`);
        await sleep(2 ** attempt * 1000);
        return fetchWithRetry(url, { useAuth, maxAttempts }, attempt + 1);
    }

    return res;
}

export async function fetchJSON(url) {
    const res = await fetchWithRetry(url, { useAuth: true });
    return res.json();
}

export async function fetchText(url) {
    const res = await fetchWithRetry(url);
    return res.text();
}
