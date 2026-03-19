'use strict';

const { analyze } = require('../analyze.js');
const { findProjectRoot } = require('../utils/discover-wp-packages.js');
const { collectRecommendedInstallSpecs } = require('./install-planning.js');
const { detectPackageManager, runInstall } = require('./install-exec.js');
const {
    formatNoAutomaticDowngradeMessage,
    formatIssuesReport,
    printInstallReport,
    printSuggestedInstallCommands,
} = require('./output.js');

function runAnalyze(options) {
    const issues = analyze(options);

    if (issues.length === 0) {
        console.log('✔ All @wordpress/* packages are compatible with your minimum WordPress version.');
        return { exitCode: 0, issues, packageSpecs: [] };
    }

    console.error(formatIssuesReport(issues));

    const packageSpecs = collectRecommendedInstallSpecs(issues);
    const projectDir = findProjectRoot(options.dir) || options.dir;
    const packageManager = detectPackageManager(projectDir);
    printSuggestedInstallCommands(packageSpecs, packageManager);

    return { exitCode: 1, issues, packageSpecs };
}

function runInstallCommand(options) {
    if (options.unexpectedArgs.length > 0) {
        console.error(`✘ The install command does not accept extra arguments: ${options.unexpectedArgs.join(', ')}`);
        console.error('  Usage: wp-gutenberg-compat install [--dir <path>]');
        return 1;
    }

    const { issues, packageSpecs } = runAnalyze(options);

    if (issues.length === 0) {
        return 0;
    }

    if (packageSpecs.length === 0) {
        console.error(`\n${formatNoAutomaticDowngradeMessage(issues)}`);
        return 1;
    }

    printInstallReport(issues, packageSpecs);

    const projectDir = findProjectRoot(options.dir) || options.dir;
    const packageManager = detectPackageManager(projectDir);
    if (!packageManager) {
        console.error('✘ Could not determine a single package manager from lockfiles.');
        console.error(
            '  Add exactly one lockfile (bun.lockb/bun.lock, pnpm-lock.yaml, yarn.lock, package-lock.json or npm-shrinkwrap.json),',
        );
        console.error('  or run one of the equivalent direct package-manager commands shown above.');
        return 1;
    }

    const ok = runInstall(projectDir, packageManager, packageSpecs);
    if (!ok) {
        console.error('✘ Installation failed.');
        return 1;
    }

    return 0;
}

module.exports = {
    runAnalyze,
    runInstallCommand,
};
