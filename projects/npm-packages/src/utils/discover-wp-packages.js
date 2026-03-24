const fs = require('node:fs');
const path = require('node:path');

/** Module-level cache keyed by resolved project root. */
const cache = new Map();

/**
 * Walk up from startDir to find the nearest directory containing package.json.
 * Returns that directory path, or null if not found.
 *
 * @param {string} startDir
 * @returns {string|null}
 */
function findProjectRoot(startDir) {
    let dir = startDir;
    while (true) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

/**
 * Discover all @wordpress/* package names listed in dependencies and
 * devDependencies of the nearest package.json found above startDir.
 *
 * Returns an empty array on any error. Never throws.
 * Emits console.warn (with '[wp-gutenberg-compat]' prefix) only when the file
 * exists but contains invalid JSON.
 * Results are cached by resolved project root for the duration of the process.
 *
 * @param {string} startDir  Directory to start the upward search from.
 * @returns {string[]}
 */
function discoverWpPackages(startDir) {
    const root = findProjectRoot(startDir);
    if (!root) return [];

    if (cache.has(root)) return cache.get(root);

    const pkgPath = path.join(root, 'package.json');
    let pkg;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (err) {
        // Only warn when the file exists but JSON is malformed
        if (err.code !== 'ENOENT') {
            console.warn(`[wp-gutenberg-compat] Could not parse ${pkgPath}: ${err.message}`);
        }
        cache.set(root, []);
        return [];
    }

    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const wpPkgs = [...new Set([...deps, ...devDeps])].filter((k) => k.startsWith('@wordpress/'));
    cache.set(root, wpPkgs);
    return wpPkgs;
}

/**
 * Clear the module-level cache (for testing only).
 */
function clearDiscoverCache() {
    cache.clear();
}

module.exports = { discoverWpPackages, clearDiscoverCache, findProjectRoot };
