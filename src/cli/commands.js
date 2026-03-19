'use strict';

const { analyze } = require('../analyze.js');
const { collectRecommendedInstallSpecs } = require('./install-planning.js');
const { runInstall } = require('./install-exec.js');
const { resolveProjectContext } = require('./helpers/project-context.js');
const { printMissingPackageManagerError, printUnexpectedInstallArgsError } = require('./helpers/install-validation.js');
const {
    formatNoAutomaticDowngradeMessage,
    formatIssuesReport,
    printInstallReport,
    printSuggestedInstallCommands,
} = require('./output.js');
const { buildAsciiTable } = require('./table.js');

function loadCompatData(dataPath) {
    if (dataPath) {
        const fs = require('node:fs');
        const path = require('node:path');
        return JSON.parse(fs.readFileSync(path.resolve(dataPath), 'utf8'));
    }
    return require('../data/compat-data.json');
}

function runInfo(options) {
    const compatData = loadCompatData(options.dataPath);

    if (!options.infoPackages || options.infoPackages.length === 0) {
        // Mode 1: no arguments — display tool version, supported package managers, and WP versions
        const pkg = require('../../package.json');
        const version = pkg.version;

        const generated = compatData.generated ? compatData.generated.slice(0, 10) : 'unknown';
        const lastGutenbergTag = compatData.lastGutenbergTag || 'unknown';

        const lines = [];
        lines.push(`wp-gutenberg-compat version: ${version}`);
        lines.push('');
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

        console.log(lines.join('\n'));
        return 0;
    }

    // Mode 2: with package name(s) — display the full compatibility matrix for each package
    let exitCode = 0;

    for (const pkgName of options.infoPackages) {
        if (!pkgName.startsWith('@wordpress/')) {
            console.error(`\n✘ '${pkgName}' is not tracked in compat data.`);
            exitCode = 1;
            continue;
        }

        const pkgEntry = compatData.packages[pkgName];
        if (!pkgEntry) {
            console.error(`\n✘ '${pkgName}' is not tracked in compat data.`);
            exitCode = 1;
            continue;
        }

        const rows = Object.entries(pkgEntry).map(([version, info]) => [version, info.wordpress, info.gutenberg]);
        const table = buildAsciiTable(['Version', 'WordPress', 'Gutenberg'], rows);

        console.log(`\n${pkgName}\n`);
        console.log(table.replace(/^/gm, '  '));
    }

    return exitCode;
}

function runAnalyze(options) {
    const showSuggestedCommands = options.showSuggestedCommands !== false;
    const issues = analyze(options);

    if (issues.length === 0) {
        console.log('\n✔ All @wordpress/* packages are compatible with your minimum WordPress version.\n');
        return { exitCode: 0, issues, packageSpecs: [] };
    }

    console.error(`\n${formatIssuesReport(issues)}\n`);

    const packageSpecs = collectRecommendedInstallSpecs(issues);
    if (showSuggestedCommands) {
        const { packageManager } = resolveProjectContext(options.dir);
        printSuggestedInstallCommands(packageSpecs, packageManager);
    }

    return { exitCode: 1, issues, packageSpecs };
}

function runInstallCommand(options) {
    if (options.unexpectedArgs.length > 0) {
        printUnexpectedInstallArgsError(options.unexpectedArgs);
        return 1;
    }

    const { issues, packageSpecs } = runAnalyze({ ...options, showSuggestedCommands: false });

    if (issues.length === 0) {
        return 0;
    }

    if (packageSpecs.length === 0) {
        console.error(`\n${formatNoAutomaticDowngradeMessage(issues)}\n`);
        return 1;
    }

    printInstallReport(issues, packageSpecs);

    const { projectDir, packageManager } = resolveProjectContext(options.dir);
    if (!packageManager) {
        printMissingPackageManagerError();
        return 1;
    }

    const ok = runInstall(projectDir, packageManager, packageSpecs);
    if (!ok) {
        console.error('\n✘ Installation failed.\n');
        return 1;
    }

    return 0;
}

module.exports = {
    runAnalyze,
    runInfo,
    runInstallCommand,
};
