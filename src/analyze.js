const path = require('node:path');
const fs = require('node:fs');
const { discoverWpPackages, findProjectRoot } = require('./utils/discover-wp-packages.js');

function loadCompatData(customPath) {
    if (customPath) {
        return JSON.parse(fs.readFileSync(path.resolve(customPath), 'utf8'));
    }
    return require('./data/compat-data.json');
}

/**
 * Scan the project root for a main plugin PHP file or theme style.css
 * and read its "Requires at least" header.
 *
 * @param {string} startDir
 * @returns {{ version: string|null, projectType: 'plugin'|'theme'|null, pluginFile: string|null }}
 */
function findWpVersionFromHeader(startDir) {
    const dir = findProjectRoot(startDir);
    if (!dir) return { version: null, projectType: null, pluginFile: null };

    const requiresAtLeastPattern = /Requires\s+at\s+least:\s*([\d.]+)/i;

    // Check for plugin file: {dirName}.php
    const dirName = path.basename(dir);
    const pluginFileName = `${dirName}.php`;
    const pluginFile = path.join(dir, pluginFileName);
    if (fs.existsSync(pluginFile)) {
        try {
            const content = fs.readFileSync(pluginFile, 'utf8');
            const match = content.match(requiresAtLeastPattern);
            if (match) return { version: match[1], projectType: 'plugin', pluginFile: pluginFileName };
        } catch {
            // Ignore read errors
        }
        return { version: null, projectType: 'plugin', pluginFile: pluginFileName };
    }

    // Check for theme: style.css
    const styleFile = path.join(dir, 'style.css');
    if (fs.existsSync(styleFile)) {
        try {
            const content = fs.readFileSync(styleFile, 'utf8');
            const match = content.match(requiresAtLeastPattern);
            if (match) return { version: match[1], projectType: 'theme', pluginFile: null };
        } catch {
            // Ignore read errors
        }
        return { version: null, projectType: 'theme', pluginFile: null };
    }

    return { version: null, projectType: null, pluginFile: null };
}

/**
 * Compare two WP version strings. Returns > 0 if a > b.
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

/**
 * Strip pre-release suffix: "28.0.0-rc.1" → "28.0.0"
 */
function stripPreRelease(version) {
    return version.replace(/-.*$/, '');
}

/**
 * Read the installed version of a package from node_modules.
 */
function getInstalledVersion(pkgName, startDir) {
    try {
        const pkgJsonPath = require.resolve(`${pkgName}/package.json`, {
            paths: [startDir],
        });
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        return pkg.version || null;
    } catch {
        return null;
    }
}

/**
 * Look up which WP version is required for a given @wordpress/* package
 * at a given installed version.
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
 * Analyze @wordpress/* packages in a project for WordPress version compatibility.
 *
 * @param {object} [options]
 * @param {string} [options.dir=process.cwd()]  Project directory to analyze.
 * @param {string|null} [options.dataPath=null]  Path to a custom compat-data.json file.
 * @returns {Array<object>}  Array of issues found. Empty array means everything is compatible.
 *
 * Issue shapes:
 *   { type: 'missing-min-wp', projectType: 'plugin'|'theme'|null, pluginFile: string|null }
 *   { type: 'incompatible', pkgName, installedVersion, requiredWp, minWp, recommendedVersion }
 */
function analyze({ dir = process.cwd(), dataPath = null } = {}) {
    const issues = [];

    let compatData;
    try {
        compatData = loadCompatData(dataPath);
    } catch {
        return issues;
    }

    const { version: minWp, projectType, pluginFile } = findWpVersionFromHeader(dir);

    if (!minWp) {
        issues.push({ type: 'missing-min-wp', projectType, pluginFile });
        return issues;
    }

    const packages = discoverWpPackages(dir);

    for (const pkgName of packages) {
        const installedVersion = getInstalledVersion(pkgName, dir);
        if (!installedVersion) continue;
        const requiredWp = getRequiredWpVersion(compatData, pkgName, installedVersion);
        if (!requiredWp) continue;
        if (compareVersions(requiredWp, minWp) > 0) {
            const recommendedVersion = getRecommendedVersionForWp(compatData, pkgName, minWp);
            issues.push({
                type: 'incompatible',
                pkgName,
                installedVersion: stripPreRelease(installedVersion),
                requiredWp,
                minWp,
                recommendedVersion,
            });
        }
    }

    return issues;
}

module.exports = { analyze };
