#!/usr/bin/env node

/**
 * Data scraper for gutenberg-compat.
 *
 * Maps WordPress versions → Gutenberg versions → @wordpress/* package versions
 * and writes the result to packages/data/compat-data.json.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node scripts/generate.js
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'packages', 'data', 'compat-data.json');
const FALLBACK_MAP_FILE = path.join(__dirname, 'wp-gb-map.json');

const GITHUB_API = 'https://api.github.com';
const RAW_GH = 'https://raw.githubusercontent.com';
const REPO = 'WordPress/gutenberg';

/** Packages we track (the most commonly imported @wordpress/* packages). */
const TRACKED_PACKAGES = [
  'components',
  'block-editor',
  'blocks',
  'data',
  'element',
  'hooks',
  'i18n',
  'api-fetch',
  'compose',
  'notices',
  'primitives',
  'icons',
  'core-data',
];

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
 * For a given Gutenberg tag, fetch the package.json version for each tracked package.
 * Uses raw.githubusercontent.com (no rate limit).
 */
async function fetchPackageVersionsForTag(tagName) {
  const versions = {};

  await Promise.all(
    TRACKED_PACKAGES.map(async (pkg) => {
      const url = `${RAW_GH}/${REPO}/${tagName}/packages/${pkg}/package.json`;
      try {
        const text = await fetchText(url);
        const json = JSON.parse(text);
        if (json.version) {
          versions[`@wordpress/${pkg}`] = json.version;
        }
      } catch {
        // Package didn't exist in this tag — skip
      }
    }),
  );

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
    existing = { generated: null, lastGutenbergTag: null, wpGutenbergMap: {}, packages: {} };
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

  // 5. Check for new tags vs existing data
  const latestTag = tagsToScrape[0];
  if (existing.lastGutenbergTag && latestTag) {
    const existingVer = existing.lastGutenbergTag.replace(/^v/, '');
    const latestVer = latestTag.name.replace(/^v/, '');
    if (compareVersions(latestVer, existingVer) <= 0) {
      console.log(`No new Gutenberg tags detected (latest: ${latestTag.name}). Nothing to do.`);
      process.exit(0);
    }
    console.log(`New tag detected: ${latestTag.name} (was ${existing.lastGutenbergTag})`);
  }

  // 6. Scrape package versions for each relevant tag
  console.log(`Scraping ${tagsToScrape.length} Gutenberg tags…`);

  // Build a reverse lookup: gbBase → wpVersion
  const gbToWp = {};
  for (const [wp, gb] of Object.entries(wpGbMap)) {
    gbToWp[gb] = wp;
  }

  const packages = {};

  for (const tag of tagsToScrape) {
    console.log(`  ${tag.name} (GB ${tag.gbBase}, WP ${gbToWp[tag.gbBase]})…`);
    const versions = await fetchPackageVersionsForTag(tag.name);

    for (const [pkgName, pkgVer] of Object.entries(versions)) {
      if (!packages[pkgName]) packages[pkgName] = {};
      packages[pkgName][pkgVer] = {
        gutenberg: tag.gbBase,
        wordpress: gbToWp[tag.gbBase],
      };
    }
  }

  // 7. Build final data object
  const data = {
    generated: new Date().toISOString(),
    lastGutenbergTag: latestTag ? latestTag.name : existing.lastGutenbergTag,
    wpGutenbergMap: wpGbMap,
    packages,
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
