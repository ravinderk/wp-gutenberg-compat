import path from 'node:path';
import fs from 'node:fs';
import semver from 'semver';
import { compareVersions, stripPreRelease } from './version.js';
import type { CompatData } from '../types/index.js';

export function loadCompatData(customPath?: string | null): CompatData {
    if (customPath) {
        return JSON.parse(fs.readFileSync(path.resolve(customPath), 'utf8')) as CompatData;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../data/compat-data.json') as CompatData;
}

/**
 * Look up which WP version is required for a given @wordpress/* package
 * at a given installed version.
 */
export function getRequiredWpVersion(compatData: CompatData, pkgName: string, installedVersion: string): string | null {
    const pkgEntry = compatData.packages[pkgName];
    if (!pkgEntry) return null;

    const cleaned = stripPreRelease(installedVersion);

    if (pkgEntry[cleaned]) {
        return pkgEntry[cleaned].wordpress;
    }

    // Find the highest package version that is <= the installed version
    let bestMatch: string | null = null;
    let bestWp: string | null = null;

    for (const [ver, info] of Object.entries(pkgEntry)) {
        if (compareVersions(ver, cleaned) <= 0) {
            if (!bestMatch || compareVersions(ver, bestMatch) > 0) {
                bestMatch = ver;
                bestWp = info.wordpress;
            }
        }
    }

    return bestWp;
}

/**
 * Find the highest package version that supports the project's min WP version.
 */
export function getRecommendedVersionForWp(compatData: CompatData, pkgName: string, minWp: string): string | null {
    const pkgEntry = compatData.packages[pkgName];
    if (!pkgEntry) return null;

    let bestVersion: string | null = null;

    for (const [ver, info] of Object.entries(pkgEntry)) {
        if (compareVersions(info.wordpress, minWp) <= 0) {
            if (!bestVersion || compareVersions(ver, bestVersion) > 0) {
                bestVersion = ver;
            }
        }
    }

    return bestVersion;
}

/**
 * Resolve a semver range to the highest matching version present in compat data
 * for a given package.
 */
export function resolveRangeInCompatData(compatData: CompatData, pkgName: string, range: string): string | null {
    const pkgEntry = compatData.packages[pkgName];
    if (!pkgEntry) return null;
    const versions = Object.keys(pkgEntry);

    const exact = semver.maxSatisfying(versions, range);
    if (exact) return exact;

    // Fallback: the range's minimum may be higher than any tracked version
    const minVer = semver.minVersion(range);
    if (!minVer) return null;

    let best: string | null = null;
    for (const v of versions) {
        if (semver.lte(v, minVer) && (!best || semver.gt(v, best))) {
            best = v;
        }
    }
    return best;
}
