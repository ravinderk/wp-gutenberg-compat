import { sleep } from './utils.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (GITHUB_TOKEN) {
        h.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }
    return h;
}

async function fetchWithRetry(
    url: string,
    { useAuth = false, maxAttempts = 3 }: { useAuth?: boolean; maxAttempts?: number } = {},
    attempt = 1,
): Promise<Response> {
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

export async function fetchJSON<T = unknown>(url: string): Promise<T> {
    const res = await fetchWithRetry(url, { useAuth: true });
    return res.json() as Promise<T>;
}

export async function fetchText(url: string): Promise<string> {
    const res = await fetchWithRetry(url);
    return res.text();
}
