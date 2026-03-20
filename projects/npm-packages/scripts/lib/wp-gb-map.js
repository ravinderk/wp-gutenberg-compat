import { fetchText } from './github.js';
import { compareVersions } from './utils.js';

const RAW_GH = 'https://raw.githubusercontent.com';
const REPO = 'WordPress/gutenberg';

/**
 * Fetch the WP ↔ Gutenberg version table from the upstream Gutenberg repo.
 * Returns a map like { "6.8": "20.4", … } (only entries with WP >= 6.4).
 * Returns an empty object on failure so callers can fall back to existing data.
 */
export async function fetchUpstreamWpGbEntries() {
    const url = `${RAW_GH}/${REPO}/trunk/docs/contributors/versions-in-wordpress.md`;
    try {
        const md = await fetchText(url);
        const map = parseWpGbMarkdownTable(md);
        console.log(`Parsed ${Object.keys(map).length} entries from upstream WP↔GB table`);
        return map;
    } catch (err) {
        console.warn(`Could not fetch upstream WP↔GB map: ${err.message}`);
        return {};
    }
}

/**
 * Parse the markdown table from versions-in-wordpress.md.
 * Expected rows like: | [WordPress 6.8](https://…) | [Gutenberg 20.4](https://…) |
 */
export function parseWpGbMarkdownTable(md) {
    const map = {};
    const rowRe = /\|\s*\[?\s*WordPress\s+([\d.]+)\s*\]?[^|]*\|\s*\[?\s*Gutenberg\s+([\d.]+)\s*\]?/gi;
    let match;
    while ((match = rowRe.exec(md)) !== null) {
        const wpVersion = match[1].replace(/\.x$/, '');
        const gbVersion = match[2];
        if (compareVersions(wpVersion, '6.4') >= 0) {
            map[wpVersion] = gbVersion;
        }
    }
    return map;
}
