import fs from 'node:fs';
import path from 'node:path';

/** Module-level cache keyed by resolved project root. */
const cache = new Map<string, string[]>();

/**
 * Walk up from startDir to find the nearest directory containing package.json.
 * Returns that directory path, or null if not found.
 */
export function findProjectRoot(startDir: string): string | null {
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
 */
export function discoverWpPackages(startDir: string): string[] {
    const root = findProjectRoot(startDir);
    if (!root) return [];

    const cached = cache.get(root);
    if (cached !== undefined) return cached;

    const pkgPath = path.join(root, 'package.json');
    let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as typeof pkg;
    } catch (err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code !== 'ENOENT') {
            console.warn(`[wp-gutenberg-compat] Could not parse ${pkgPath}: ${nodeErr.message}`);
        }
        cache.set(root, []);
        return [];
    }

    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    const wpPkgs = [...new Set([...deps, ...devDeps])].filter((k) => k.startsWith('@wordpress/'));
    cache.set(root, wpPkgs);
    return wpPkgs;
}

/**
 * Clear the module-level cache (for testing only).
 */
export function clearDiscoverCache(): void {
    cache.clear();
}
