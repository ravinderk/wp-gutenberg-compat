const path = require('node:path');
const fs = require('node:fs');
const semver = require('semver');
const { compareVersions, stripPreRelease } = require('./version.js');

function loadCompatData(customPath) {
    if (customPath) {
        return JSON.parse(fs.readFileSync(path.resolve(customPath), 'utf8'));
    }
    return require('../data/compat-data.json');
}

/**
 * Look up which WP version is required for a given @wordpress/* package
 * at a given installed version.
 *
 * @param {object} compatData
 * @param {string} pkgName
 * @param {string} installedVersion
 * @returns {string|null}
 */
function getRequiredWpVersion(compatData, pkgName, installedVersion) {
    const pkgEntry = compatData.packages[pkgName];
    if (!pkgEntry) return null;

    const cleaned = stripPreRelease(installedVersion);

    if (pkgEntry[cleaned]) {
        return pkgEntry[cleaned].wordpress;
    }

    // Find the highest package version that is <= the installed version
    let bestMatch = null;
    let bestWp = null;

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
 *
 * @param {object} compatData
 * @param {string} pkgName
 * @param {string} minWp
 * @returns {string|null}
 */
function getRecommendedVersionForWp(compatData, pkgName, minWp) {
    const pkgEntry = compatData.packages[pkgName];
    if (!pkgEntry) return null;

    let bestVersion = null;

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
 *
 * @param {object} compatData
 * @param {string} pkgName
 * @param {string} range  semver range (e.g. "^28.0.0")
 * @returns {string|null}  highest matching version, or null if none found
 */
function resolveRangeInCompatData(compatData, pkgName, range) {
    const pkgEntry = compatData.packages[pkgName];
    if (!pkgEntry) return null;
    const versions = Object.keys(pkgEntry);
    return semver.maxSatisfying(versions, range);
}

module.exports = {
    loadCompatData,
    getRequiredWpVersion,
    getRecommendedVersionForWp,
    resolveRangeInCompatData,
};
