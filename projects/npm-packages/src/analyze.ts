import { discoverWpPackages } from './utils/discover-wp-packages.js';
import { compareVersions, stripPreRelease } from './utils/version.js';
import {
    loadCompatData,
    getRequiredWpVersion,
    getRecommendedVersionForWp,
    resolveRangeInCompatData,
} from './utils/compat-data.js';
import { findWpVersionFromHeader, getInstalledVersion } from './utils/wp-header.js';
import type { CompatData, CompatIssue, MissingMinWpIssue, IncompatibleIssue } from './types/index.js';

interface AnalyzeOptions {
    dir?: string;
    dataPath?: string | null;
    wp?: string | null;
}

interface AnalyzeRemoteOptions {
    remote: string;
    wp: string;
    dataPath?: string | null;
}

/**
 * Analyze @wordpress/* packages in a project for WordPress version compatibility.
 *
 * @returns Array of issues found. Empty array means everything is compatible.
 */
export function analyze({ dir = process.cwd(), dataPath = null, wp = null }: AnalyzeOptions = {}): CompatIssue[] {
    const issues: CompatIssue[] = [];

    let compatData: CompatData;
    try {
        compatData = loadCompatData(dataPath);
    } catch {
        return issues;
    }

    let minWp: string | null = wp;
    let projectType: MissingMinWpIssue['projectType'] = null;
    let pluginFile: string | null = null;

    if (!minWp) {
        const header = findWpVersionFromHeader(dir);
        minWp = header.version;
        projectType = header.projectType;
        pluginFile = header.pluginFile;
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
            const issue: IncompatibleIssue = {
                type: 'incompatible',
                pkgName,
                installedVersion: stripPreRelease(installedVersion),
                requiredWp,
                minWp,
                recommendedVersion,
            };
            issues.push(issue);
        }
    }

    return issues;
}

/**
 * Analyze @wordpress/* packages from a remote package.json URL.
 */
export async function analyzeRemote({ remote, wp, dataPath = null }: AnalyzeRemoteOptions): Promise<CompatIssue[]> {
    const issues: CompatIssue[] = [];

    let compatData: CompatData;
    try {
        compatData = loadCompatData(dataPath);
    } catch {
        return issues;
    }

    const minWp = wp;

    let response: Response;
    try {
        response = await fetch(remote);
    } catch (err) {
        throw new Error(`Failed to fetch remote package.json from ${remote}: ${(err as Error).message}`);
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch remote package.json from ${remote}: HTTP ${response.status}`);
    }

    let pkgJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
        const text = await response.text();
        pkgJson = JSON.parse(text) as typeof pkgJson;
    } catch {
        throw new Error(`Invalid JSON returned from ${remote}`);
    }

    const allDeps: Record<string, string> = {
        ...(pkgJson.dependencies ?? {}),
        ...(pkgJson.devDependencies ?? {}),
    };

    for (const [pkgName, range] of Object.entries(allDeps)) {
        if (!pkgName.startsWith('@wordpress/')) continue;

        const resolvedVersion = resolveRangeInCompatData(compatData, pkgName, range);
        if (!resolvedVersion) continue;

        const requiredWp = getRequiredWpVersion(compatData, pkgName, resolvedVersion);
        if (!requiredWp) continue;

        if (compareVersions(requiredWp, minWp) > 0) {
            const recommendedVersion = getRecommendedVersionForWp(compatData, pkgName, minWp);
            const issue: IncompatibleIssue = {
                type: 'incompatible',
                pkgName,
                installedVersion: resolvedVersion,
                requiredWp,
                minWp,
                recommendedVersion,
            };
            issues.push(issue);
        }
    }

    return issues;
}

export { resolveRangeInCompatData };
