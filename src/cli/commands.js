'use strict';

const { analyze } = require('../analyze.js');
const { findProjectRoot } = require('../utils/discover-wp-packages.js');
const { collectRecommendedInstallSpecs, resolveInstallSpecs } = require('./install-planning.js');
const { detectPackageManager, runInstall } = require('./install-exec.js');
const { formatIssue, printInstallReport, printSuggestedInstallCommands } = require('./output.js');

function runAnalyze(options) {
    const issues = analyze(options);

    if (issues.length === 0) {
        console.log('✔ All @wordpress/* packages are compatible with your minimum WordPress version.');
        return { exitCode: 0, issues, packageSpecs: [] };
    }

    for (const issue of issues) {
        console.error(formatIssue(issue));
    }

    const packageSpecs = collectRecommendedInstallSpecs(issues);
    printSuggestedInstallCommands(packageSpecs);

    return { exitCode: 1, issues, packageSpecs };
}

function runInstallCommand(options) {
    const { issues, packageSpecs } = runAnalyze(options);

    if (issues.length === 0) {
        return 0;
    }

    if (packageSpecs.length === 0) {
        console.error('No compatible downgrade suggestions are available to install automatically.');
        return 1;
    }

    const resolution = resolveInstallSpecs(packageSpecs, options);
    if (!resolution.ok) {
        console.error(`✘ ${resolution.reason}`);
        console.error('  Usage: wp-gutenberg-compat install <package-name> [...] | --all');
        return 1;
    }

    const { selectedSpecs, missingPackages } = resolution;
    printInstallReport(issues, selectedSpecs, missingPackages, options);

    if (selectedSpecs.length === 0) {
        console.error('✘ No requested packages have a recommended compatible downgrade to install.');
        return 1;
    }

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

    const ok = runInstall(projectDir, packageManager, selectedSpecs);
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
