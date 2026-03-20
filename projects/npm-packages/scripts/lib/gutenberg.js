import { fetchJSON, fetchText } from './github.js';
import { compareVersions } from './utils.js';

const GITHUB_API = 'https://api.github.com';
const RAW_GH = 'https://raw.githubusercontent.com';
const REPO = 'WordPress/gutenberg';

/** Cache of discovered package directories per Gutenberg tag. */
const packageListCache = new Map();

/**
 * Fetch all Gutenberg tags from GitHub, filtering to release tags (vNN.N.N).
 * Returns an array of { name, sha } sorted descending by version.
 */
export async function fetchGutenbergTags() {
    const tags = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const url = `${GITHUB_API}/repos/${REPO}/tags?per_page=${perPage}&page=${page}`;
        const batch = await fetchJSON(url);
        if (batch.length === 0) break;
        for (const tag of batch) {
            if (/^v\d+\.\d+\.\d+$/.test(tag.name)) {
                tags.push({ name: tag.name, sha: tag.commit.sha });
            }
        }
        if (batch.length < perPage) break;
        page++;
    }

    tags.sort((a, b) => compareVersions(b.name.slice(1), a.name.slice(1)));
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
export async function fetchPackageVersionsForTag(tagName) {
    const dirs = await discoverPackageDirs(tagName);
    const versions = {};

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
