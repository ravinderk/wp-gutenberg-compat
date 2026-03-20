#!/usr/bin/env node

/**
 * Data scraper for wp-gutenberg-compat.
 *
 * Maps WordPress versions → Gutenberg versions → @wordpress/* package versions
 * and writes the result to src/data/compat-data.json.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node scripts/generate.js
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'compat-data.json');
const FALLBACK_MAP_FILE = path.join(__dirname, 'wp-gb-map.json');

const GITHUB_API = 'https://api.github.com';
const RAW_GH = 'https://raw.githubusercontent.com';
const REPO = 'WordPress/gutenberg';

/** Cache of discovered package directories per Gutenberg tag. */
const packageListCache = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function headers() {
    const h = { Accept: 'application/vnd.github+json' };
    if (GITHUB_TOKEN) {
        h.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }
    return h;
}

async function fetchJSON(url, attempt = 1) {
    const res = await fetch(url, { headers: headers() });

    if (res.status === 429 || res.status === 403) {
        if (attempt > 3) throw new Error(`Rate-limited after 3 retries: ${url}`);
        const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
        console.warn(`Rate-limited, retrying in ${retryAfter}s (attempt ${attempt})…`);
        await sleep(retryAfter * 1000);
        return fetchJSON(url, attempt + 1);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
}

async function fetchText(url, attempt = 1) {
    const res = await fetch(url);
    if (!res.ok) {
        if (attempt > 3) throw new Error(`Failed after 3 retries: ${url}`);
        await sleep(2 ** attempt * 1000);
        return fetchText(url, attempt + 1);
    }
    return res.text();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compare two semver-style version strings (e.g. "21.9" > "20.4").
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

// ---------------------------------------------------------------------------
// WP ↔ Gutenberg version map
// ---------------------------------------------------------------------------

async function fetchWpGbMap() {
    const url = `${RAW_GH}/${REPO}/trunk/docs/contributors/versions-in-wordpress.md`;
    try {
        const md = await fetchText(url);
        const map = parseWpGbMarkdownTable(md);
        if (Object.keys(map).length > 0) {
            console.log(`Parsed WP↔GB map from upstream (${Object.keys(map).length} entries)`);
            return map;
        }
    } catch (err) {
        console.warn(`Failed to fetch upstream WP↔GB map: ${err.message}`);
    }

    console.log('Using static fallback WP↔GB map');
    const raw = await readFile(FALLBACK_MAP_FILE, 'utf8');
    return JSON.parse(raw);
}

/**
 * Parse the markdown table from versions-in-wordpress.md.
 * Expected rows like: | [WordPress 6.8](https://…) | [Gutenberg 20.4](https://…) |
 * We extract the version numbers and return { "6.8": "20.4", … }.
 */
function parseWpGbMarkdownTable(md) {
    const map = {};
    const rowRe = /\|\s*\[?\s*WordPress\s+([\d.]+)\s*\]?[^|]*\|\s*\[?\s*Gutenberg\s+([\d.]+)\s*\]?/gi;
    let match;
    while ((match = rowRe.exec(md)) !== null) {
        const wpVersion = match[1].replace(/\.x$/, '');
        const gbVersion = match[2];
        // Only track WP >= 6.4
        if (compareVersions(wpVersion, '6.4') >= 0) {
            map[wpVersion] = gbVersion;
        }
    }
    return map;
}

// ---------------------------------------------------------------------------
// Gutenberg tag → package version scraping
// ---------------------------------------------------------------------------

/**
 * Fetch all Gutenberg tags from GitHub, filtering to release tags (vNN.N.N).
 * Returns an array of { name, sha } sorted descending by version.
 */
async function fetchGutenbergTags() {
    const tags = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const url = `${GITHUB_API}/repos/${REPO}/tags?per_page=${perPage}&page=${page}`;
        const batch = await fetchJSON(url);
        if (batch.length === 0) break;
        for (const tag of batch) {
            // Match release tags like v17.7.0, v20.4.0, etc.
            if (/^v\d+\.\d+\.\d+$/.test(tag.name)) {
                tags.push({ name: tag.name, sha: tag.commit.sha });
            }
        }
        if (batch.length < perPage) break;
        page++;
    }

    // Sort descending
    tags.sort((a, b) => {
        const va = a.name.slice(1); // remove leading 'v'
        const vb = b.name.slice(1);
        return compareVersions(vb, va);
    });

    return tags;
}

/**
 * Discover all package directory names under packages/ for a given Gutenberg tag.
 * Uses the GitHub Contents API and caches results per tag.
 */
async function discoverPackageDirs(tagName) {
    if (packageListCache.has(tagName)) return packageListCache.get(tagName);

    const url = `${GITHUB_API}/repos/${REPO}/contents/packages?ref=${tagName}`;
    const entries = await fetchJSON(url);
    const dirs = entries.filter((entry) => entry.type === 'dir').map((entry) => entry.name);

    packageListCache.set(tagName, dirs);
    return dirs;
}

/**
 * For a given Gutenberg tag, discover all public @wordpress/* packages and
 * return their versions. Excludes private packages and directories without
 * a valid package.json.
 */
async function fetchPackageVersionsForTag(tagName) {
    const dirs = await discoverPackageDirs(tagName);
    const versions = {};

    // Process in batches of 20 to avoid overwhelming the network
    const BATCH_SIZE = 20;
    for (let i = 0; i < dirs.length; i += BATCH_SIZE) {
        const batch = dirs.slice(i, i + BATCH_SIZE);
        await Promise.all(
            batch.map(async (dir) => {
                const url = `${RAW_GH}/${REPO}/${tagName}/packages/${dir}/package.json`;
                try {
                    const text = await fetchText(url);
                    const json = JSON.parse(text);
                    if (json.private || !json.name || !json.name.startsWith('@wordpress/') || !json.version) {
                        return;
                    }
                    versions[json.name] = json.version;
                } catch {
                    // No package.json or fetch failed — skip
                }
            }),
        );
    }

    return versions;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    // 1. Load existing compat data
    let existing;
    try {
        existing = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    } catch {
        existing = { generated: null, lastGutenbergTag: null, scrapedVersions: [], wpGutenbergMap: {}, packages: {} };
    }

    // 2. Fetch WP ↔ GB map
    const wpGbMap = await fetchWpGbMap();

    // 3. Build a set of Gutenberg base versions we care about (from the map values)
    //    e.g. { "21.9", "20.4", "19.3", … }
    const relevantGbVersions = new Set(Object.values(wpGbMap));

    // 4. Fetch Gutenberg tags
    console.log('Fetching Gutenberg tags…');
    const allTags = await fetchGutenbergTags();

    // Filter to only the .0 patch tags that match our relevant GB versions
    const relevantTags = allTags.filter((t) => {
        const ver = t.name.slice(1); // e.g. "21.9.0"
        const base = ver.split('.').slice(0, 2).join('.'); // "21.9"
        return relevantGbVersions.has(base);
    });

    // Deduplicate: keep only the first (latest patch) for each base version
    const seenBases = new Set();
    const tagsToScrape = [];
    for (const tag of relevantTags) {
        const base = tag.name.slice(1).split('.').slice(0, 2).join('.');
        if (!seenBases.has(base)) {
            seenBases.add(base);
            tagsToScrape.push({ ...tag, gbBase: base });
        }
    }

    // 5. Filter to only GB base versions not yet scraped
    const alreadyScraped = new Set(existing.scrapedVersions ?? []);
    const tagsToProcess = tagsToScrape.filter((t) => !alreadyScraped.has(t.gbBase));

    if (tagsToProcess.length === 0) {
        console.log('All relevant Gutenberg versions already scraped. Nothing to do.');
        process.exit(0);
    }

    console.log(
        `Scraping ${tagsToProcess.length} new GB version(s): ${tagsToProcess.map((t) => t.gbBase).join(', ')}…`,
    );

    // 6. Scrape package versions for each new tag and merge with existing data

    // Build a reverse lookup: gbBase → wpVersion
    const gbToWp = {};
    for (const [wp, gb] of Object.entries(wpGbMap)) {
        gbToWp[gb] = wp;
    }

    const packages = existing.packages ?? {};
    const newlyScraped = [];

    for (const tag of tagsToProcess) {
        console.log(`  ${tag.name} (GB ${tag.gbBase}, WP ${gbToWp[tag.gbBase]})…`);
        const versions = await fetchPackageVersionsForTag(tag.name);

        for (const [pkgName, pkgVer] of Object.entries(versions)) {
            if (!packages[pkgName]) packages[pkgName] = {};
            packages[pkgName][pkgVer] = {
                gutenberg: tag.gbBase,
                wordpress: gbToWp[tag.gbBase],
            };
        }

        newlyScraped.push(tag.gbBase);
    }

    // 7. Build final data object
    const latestTag = tagsToScrape[0];
    const scrapedVersions = [...new Set([...(existing.scrapedVersions ?? []), ...newlyScraped])];
    const sortedPackages = Object.fromEntries(
        Object.keys(packages)
            .sort()
            .map((k) => [k, packages[k]]),
    );
    const data = {
        generated: new Date().toISOString(),
        lastGutenbergTag: latestTag ? latestTag.name : existing.lastGutenbergTag,
        scrapedVersions,
        wpGutenbergMap: wpGbMap,
        packages: sortedPackages,
    };

    // 8. Write
    await writeFile(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${DATA_FILE}`);
    console.log(`  Packages: ${Object.keys(packages).length}`);
    console.log(`  WP versions: ${Object.keys(wpGbMap).join(', ')}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
