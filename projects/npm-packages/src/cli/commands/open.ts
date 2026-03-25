import { spawn } from 'node:child_process';
import { app } from '../../app.js';
import { loadCompatData, getRecommendedVersionForWp } from '../../utils/compat-data.js';
import { getInstalledVersion } from '../../utils/wp-header.js';
import { compareVersions } from '../../utils/version.js';
import type { CliOptions } from '../../types/index.js';

/**
 * Return the highest version tracked in compat-data for a given package.
 */
export function getLatestCompatVersion(pkgEntry: Record<string, unknown>): string | null {
    let best: string | null = null;
    for (const ver of Object.keys(pkgEntry)) {
        if (!best || compareVersions(ver, best) > 0) {
            best = ver;
        }
    }
    return best;
}

/**
 * Open a URL in the default browser using a platform-appropriate command.
 * Uses spawn with an argument array to avoid shell injection.
 */
export function openUrl(url: string): void {
    let child;
    if (process.platform === 'darwin') {
        child = spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else if (process.platform === 'win32') {
        child = spawn('cmd', ['/c', 'start', '', url], { detached: true, shell: false, stdio: 'ignore' });
    } else {
        child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
    child.on('error', () => {
        // Silently ignore errors — the user will see the URL in the confirmation line
    });
    child.unref();
}

export function runOpen(options: CliOptions, urlOpener: (url: string) => void = openUrl): number {
    const reporter = app.make('Reporter');
    const { openPackage, wp, dir, dataPath } = options;

    if (!openPackage) {
        reporter.error('Usage: wp-gutenberg-compat open <package> [--wp <version>]').print();
        return 1;
    }

    if (!openPackage.startsWith('@wordpress/')) {
        reporter.error(`'${openPackage}' is not a @wordpress/* package.`).print();
        return 1;
    }

    const compatData = loadCompatData(dataPath);
    const pkgEntry = compatData.packages[openPackage];

    if (!pkgEntry) {
        reporter.error(`'${openPackage}' is not tracked in compat data.`).print();
        return 1;
    }

    let version: string | null = null;

    if (wp) {
        version = getRecommendedVersionForWp(compatData, openPackage, wp);
        if (!version) {
            reporter
                .error(`No compatible version of '${openPackage}' found for WordPress ${wp} in compat data.`)
                .print();
            return 1;
        }
    } else {
        const startDir = dir || process.cwd();
        version = getInstalledVersion(openPackage, startDir);

        if (!version) {
            version = getLatestCompatVersion(pkgEntry);
            if (!version) {
                reporter.error(`Could not resolve a version for '${openPackage}'.`).print();
                return 1;
            }
        }
    }

    const url = `https://www.npmjs.com/package/${openPackage}/v/${version}`;
    reporter.log(`Opening ${openPackage}@${version} on npmjs.com...`).print();
    urlOpener(url);
    return 0;
}
