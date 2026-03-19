'use strict';

const { buildInstallCommand } = require('./install-exec.js');

function formatIssue(issue) {
    if (issue.type === 'missing-min-wp') {
        if (issue.projectType === 'plugin') {
            return `✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your plugin's main PHP file header (${issue.pluginFile}).`;
        }
        if (issue.projectType === 'theme') {
            return `✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your theme's style.css header.`;
        }
        return "✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your plugin's main PHP file header or theme's style.css header.";
    }

    if (issue.type === 'incompatible') {
        const recommendation = issue.recommendedVersion
            ? ` Recommended compatible version: ${issue.pkgName}@${issue.recommendedVersion}.`
            : '';

        return (
            `✘ '${issue.pkgName}' version ${issue.installedVersion} requires WordPress ${issue.requiredWp}, ` +
            `but your plugin declares a minimum of WordPress ${issue.minWp}. ` +
            `Either upgrade your minimum WP version or downgrade the package.${recommendation}`
        );
    }

    return `✘ Unknown issue: ${JSON.stringify(issue)}`;
}

function printInstallReport(issues, selectedSpecs, missingPackages, options) {
    const requestedMode = options.installAll ? 'all' : 'selected';
    const incompatibleCount = issues.filter((issue) => issue.type === 'incompatible').length;

    console.error('\nInstall report:');
    console.error(`  Incompatible packages found: ${incompatibleCount}`);
    console.error(`  Install mode: ${requestedMode}`);
    console.error(`  Packages selected for install: ${selectedSpecs.length}`);

    if (selectedSpecs.length > 0) {
        console.error('  Selected package specs:');
        for (const spec of selectedSpecs) {
            console.error(`    - ${spec}`);
        }
    }

    if (missingPackages.length > 0) {
        console.error('  Requested packages with no recommended downgrade:');
        for (const pkgName of missingPackages) {
            console.error(`    - ${pkgName}`);
        }
    }
}

function printSuggestedInstallCommands(packageSpecs) {
    if (packageSpecs.length === 0) return;

    console.error('\nSuggested next step:');
    console.error('  wp-gutenberg-compat install --all');

    console.error('\nEquivalent direct package-manager commands:');
    for (const pm of ['npm', 'yarn', 'pnpm', 'bun']) {
        const command = buildInstallCommand(pm, packageSpecs);
        console.error(`  ${command}`);
    }
}

module.exports = {
    formatIssue,
    printInstallReport,
    printSuggestedInstallCommands,
};
