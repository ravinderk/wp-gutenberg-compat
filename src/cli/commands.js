'use strict';

const { analyze, analyzeRemote } = require('../analyze.js');
const { collectRecommendedInstallSpecs } = require('./install-planning.js');
const { runInstall } = require('./install-exec.js');
const { resolveProjectContext } = require('./helpers/project-context.js');
const { buildMissingPackageManagerError, buildUnexpectedInstallArgsError } = require('./helpers/install-validation.js');
const {
    Reporter,
    formatNoAutomaticDowngradeMessage,
    formatIssuesReport,
    buildInstallReport,
    buildSuggestedInstallCommands,
    buildRemoteSuggestedAction,
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

        new Reporter().log(lines.join('\n')).print();
        return 0;
    }

    // Mode 2: with package name(s) — display the full compatibility matrix for each package
    const reporter = new Reporter();
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

async function runAnalyze(options) {
    if (options.remote && !options.wp) {
        const reporter = new Reporter();
        reporter.error('--remote requires --wp <version>');
        reporter.print();
        return { exitCode: 1, issues: [], packageSpecs: [] };
    }

    const showSuggestedCommands = options.showSuggestedCommands !== false;

    let issues;
    if (options.remote) {
        try {
            issues = await analyzeRemote(options);
        } catch (err) {
            const reporter = new Reporter();
            reporter.error(err.message);
            reporter.print();
            return { exitCode: 1, issues: [], packageSpecs: [] };
        }
    } else {
        issues = analyze(options);
    }

    if (issues.length === 0) {
        const reporter = new Reporter();
        reporter.success('All @wordpress/* packages are compatible with your minimum WordPress version.');
        reporter.print();
        return { exitCode: 0, issues, packageSpecs: [] };
    }

    const reporter = new Reporter();
    reporter.block(formatIssuesReport(issues));

    const packageSpecs = collectRecommendedInstallSpecs(issues);
    if (showSuggestedCommands) {
        if (options.remote) {
            buildRemoteSuggestedAction(reporter, packageSpecs);
        } else {
            const { packageManager } = resolveProjectContext(options.dir);
            buildSuggestedInstallCommands(reporter, packageSpecs, packageManager);
        }
    }

    reporter.print();
    return { exitCode: 1, issues, packageSpecs };
}

async function runInstallCommand(options) {
    if (options.unexpectedArgs.length > 0) {
        const reporter = new Reporter();
        buildUnexpectedInstallArgsError(reporter, options.unexpectedArgs);
        reporter.print();
        return 1;
    }

    const { issues, packageSpecs } = await runAnalyze({ ...options, showSuggestedCommands: false });

    if (issues.length === 0) {
        return 0;
    }

    if (packageSpecs.length === 0) {
        const reporter = new Reporter();
        reporter.error(formatNoAutomaticDowngradeMessage(issues));
        reporter.print();
        return 1;
    }

    const reporter = new Reporter();
    buildInstallReport(reporter, issues, packageSpecs);

    const { projectDir, packageManager } = resolveProjectContext(options.dir);
    if (!packageManager) {
        buildMissingPackageManagerError(reporter);
        reporter.print();
        return 1;
    }

    reporter.print();

    const ok = runInstall(projectDir, packageManager, packageSpecs);
    if (!ok) {
        const failReporter = new Reporter();
        failReporter.error('Installation failed.');
        failReporter.print();
        return 1;
    }

    return 0;
}

module.exports = {
    runAnalyze,
    runInfo,
    runInstallCommand,
};
