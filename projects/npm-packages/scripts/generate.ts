#!/usr/bin/env node

/**
 * Data scraper for wp-gutenberg-compat.
 *
 * Maps WordPress versions → Gutenberg versions → @wordpress/* package versions
 * and writes the result to src/data/compat-data.json.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... tsx scripts/generate.ts
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { tagBaseVersion, invertMap } from './lib/utils.js';
import { fetchUpstreamWpGbEntries } from './lib/wp-gb-map.js';
import { fetchGutenbergTags, fetchPackageVersionsForTag } from './lib/gutenberg.js';
import type { CompatData } from '../src/types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'compat-data.json');

async function main(): Promise<void> {
    // 1. Load existing compat data
    let existing: CompatData;
    try {
        existing = JSON.parse(await readFile(DATA_FILE, 'utf8')) as CompatData;
    } catch {
        existing = {
            generated: null,
            lastGutenbergTag: null,
            scrapedVersions: [],
            wpGutenbergMap: {},
            packages: {},
        };
    }

    // 2. Merge WP ↔ GB map: start from existing, add any new upstream entries
    const wpGbMap: Record<string, string> = { ...(existing.wpGutenbergMap ?? {}) };
    const upstream = await fetchUpstreamWpGbEntries();
    let newEntries = 0;
    for (const [wp, gb] of Object.entries(upstream)) {
        if (!wpGbMap[wp]) {
            wpGbMap[wp] = gb;
            newEntries++;
            console.log(`  New entry: WordPress ${wp} → Gutenberg ${gb}`);
        }
    }
    if (newEntries > 0) {
        console.log(`Added ${newEntries} new WP↔GB mapping(s)`);
    } else {
        console.log('No new WP↔GB entries found upstream');
    }

    // 3. Build a set of Gutenberg base versions we care about
    const relevantGbVersions = new Set(Object.values(wpGbMap));

    // 4. Fetch Gutenberg tags, filter to relevant, deduplicate
    console.log('Fetching Gutenberg tags…');
    const allTags = await fetchGutenbergTags();

    const seenBases = new Set<string>();
    const tagsToScrape: { name: string; sha: string; gbBase: string }[] = [];
    for (const tag of allTags) {
        const base = tagBaseVersion(tag.name);
        if (relevantGbVersions.has(base) && !seenBases.has(base)) {
            seenBases.add(base);
            tagsToScrape.push({ ...tag, gbBase: base });
        }
    }

    // 5. Filter to only GB base versions not yet scraped
    const alreadyScraped = new Set<string>(existing.scrapedVersions ?? []);
    const tagsToProcess = tagsToScrape.filter((t) => !alreadyScraped.has(t.gbBase));

    if (tagsToProcess.length === 0) {
        console.log('All relevant Gutenberg versions already scraped. Nothing to do.');
        process.exit(0);
    }

    console.log(
        `Scraping ${tagsToProcess.length} new GB version(s): ${tagsToProcess.map((t) => t.gbBase).join(', ')}…`,
    );

    // 6. Scrape package versions for each new tag and merge with existing data
    const gbToWp = invertMap(wpGbMap);
    const packages: CompatData['packages'] = existing.packages ?? {};
    const newlyScraped: string[] = [];

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
    const data: CompatData = {
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
