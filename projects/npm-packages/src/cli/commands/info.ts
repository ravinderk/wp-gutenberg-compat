import { app } from '../../app.js';
import { buildAsciiTable } from '../table.js';
import { loadCompatData } from '../../utils/compat-data.js';
import { findWpVersionFromHeader } from '../../utils/wp-header.js';
import type { CliOptions } from '../../types/index.js';

export function runInfo(options: CliOptions): number {
    const compatData = loadCompatData(options.dataPath);

    if (!options.infoPackages || options.infoPackages.length === 0) {
        // Mode 1: no arguments — display tool version, supported package managers, and WP versions
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pkg = require('../../../package.json') as { version: string };
        const version = pkg.version;

        const generated = compatData.generated ? compatData.generated.slice(0, 10) : 'unknown';
        const lastGutenbergTag = compatData.lastGutenbergTag ?? 'unknown';

        const lines: string[] = [];
        lines.push(`wp-gutenberg-compat version: ${version}`);
        lines.push('');

        const startDir = options.dir || process.cwd();
        const { version: wpVersion, projectType, pluginFile } = findWpVersionFromHeader(startDir);
        if (projectType) {
            const name = projectType === 'theme' ? 'style.css' : pluginFile;
            const label = (text: string) => `  ${text.padEnd(20)}`;
            lines.push('Project');
            lines.push('-------');
            lines.push(`${label('Type:')}${projectType}`);
            lines.push(`${label('Name:')}${name}`);
            if (wpVersion) {
                lines.push(`${label('Requires at least:')}${wpVersion}`);
            }
            lines.push('');
        }

        lines.push('Supported package managers');
        lines.push('--------------------------');
        lines.push('  npm   (package-lock.json, npm-shrinkwrap.json)');
        lines.push('  yarn  (yarn.lock)');
        lines.push('  pnpm  (pnpm-lock.yaml)');
        lines.push('  bun   (bun.lockb, bun.lock)');
        lines.push('');
        lines.push('Supported WordPress versions');
        lines.push('----------------------------');

        const wpVersions = Object.entries(compatData.wpGutenbergMap);
        const rows = wpVersions.map(([wp, gutenberg]) => [wp, gutenberg]);
        lines.push(buildAsciiTable(['WordPress', 'Gutenberg'], rows));
        lines.push('');
        lines.push(`Compat data last updated: ${generated} (Gutenberg ${lastGutenbergTag})`);

        app.make('Reporter').log(lines.join('\n')).print();
        return 0;
    }

    // Mode 2: with package name(s) — display the full compatibility matrix for each package
    const reporter = app.make('Reporter');
    let exitCode = 0;

    for (const pkgName of options.infoPackages) {
        if (!pkgName.startsWith('@wordpress/')) {
            reporter.error(`'${pkgName}' is not tracked in compat data.`);
            exitCode = 1;
            continue;
        }

        const pkgEntry = compatData.packages[pkgName];
        if (!pkgEntry) {
            reporter.error(`'${pkgName}' is not tracked in compat data.`);
            exitCode = 1;
            continue;
        }

        const rows = Object.entries(pkgEntry).map(([version, info]) => [version, info.wordpress, info.gutenberg]);
        const table = buildAsciiTable(['Version', 'WordPress', 'Gutenberg'], rows);

        reporter.log(`${pkgName}\n\n${table.replace(/^/gm, '  ')}`);
    }

    reporter.print();
    return exitCode;
}
