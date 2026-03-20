const { discoverWpPackages } = require('./utils/discover-wp-packages.js');
const { compareVersions, stripPreRelease } = require('./utils/version.js');
const {
    loadCompatData,
    getRequiredWpVersion,
    getRecommendedVersionForWp,
    resolveRangeInCompatData,
} = require('./utils/compat-data.js');
const { findWpVersionFromHeader, getInstalledVersion } = require('./utils/wp-header.js');

/**
 * Analyze @wordpress/* packages in a project for WordPress version compatibility.
 *
 * @param {object} [options]
 * @param {string} [options.dir=process.cwd()]  Project directory to analyze.
 * @param {string|null} [options.dataPath=null]  Path to a custom compat-data.json file.
 * @param {string|null} [options.wp=null]  Override minimum WordPress version.
 * @returns {Array<object>}  Array of issues found. Empty array means everything is compatible.
 *
 * Issue shapes:
 *   { type: 'missing-min-wp', projectType: 'plugin'|'theme'|null, pluginFile: string|null }
 *   { type: 'incompatible', pkgName, installedVersion, requiredWp, minWp, recommendedVersion }
 */
function analyze({ dir = process.cwd(), dataPath = null, wp = null } = {}) {
    const issues = [];

    let compatData;
    try {
        compatData = loadCompatData(dataPath);
    } catch {
        return issues;
    }

    let minWp = wp;
    let projectType = null;
    let pluginFile = null;

    if (!minWp) {
        ({ version: minWp, projectType, pluginFile } = findWpVersionFromHeader(dir));
    }

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

/**
 * Analyze @wordpress/* packages from a remote package.json URL.
 *
 * @param {object} options
 * @param {string} options.remote   URL of the remote package.json to fetch.
 * @param {string} options.wp       Minimum WordPress version (required).
 * @param {string|null} [options.dataPath=null]  Path to a custom compat-data.json file.
 * @returns {Promise<Array<object>>}  Array of issues found.
 */
async function analyzeRemote({ remote, wp, dataPath = null } = {}) {
    const issues = [];

    let compatData;
    try {
        compatData = loadCompatData(dataPath);
    } catch {
        return issues;
    }

    const minWp = wp;

    let pkgJson;
    let response;
    try {
        response = await fetch(remote);
    } catch (err) {
        throw new Error(`Failed to fetch remote package.json from ${remote}: ${err.message}`);
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch remote package.json from ${remote}: HTTP ${response.status}`);
    }

    let text;
    try {
        text = await response.text();
        pkgJson = JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON returned from ${remote}`);
    }

    const allDeps = {
        ...(pkgJson.dependencies || {}),
        ...(pkgJson.devDependencies || {}),
    };

    for (const [pkgName, range] of Object.entries(allDeps)) {
        if (!pkgName.startsWith('@wordpress/')) continue;

        const resolvedVersion = resolveRangeInCompatData(compatData, pkgName, range);
        if (!resolvedVersion) continue;

        const requiredWp = getRequiredWpVersion(compatData, pkgName, resolvedVersion);
        if (!requiredWp) continue;

        if (compareVersions(requiredWp, minWp) > 0) {
            const recommendedVersion = getRecommendedVersionForWp(compatData, pkgName, minWp);
            issues.push({
                type: 'incompatible',
                pkgName,
                installedVersion: resolvedVersion,
                requiredWp,
                minWp,
                recommendedVersion,
            });
        }
    }

    return issues;
}

module.exports = { analyze, analyzeRemote, resolveRangeInCompatData };
