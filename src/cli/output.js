'use strict';

const { buildInstallCommand } = require('./install-exec.js');
const { buildAsciiTable } = require('./table.js');

function formatRecommendedRange(version) {
    return version ? `~${version}` : null;
}

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
        const recommendedRange = formatRecommendedRange(issue.recommendedVersion);
        const recommendation = recommendedRange
            ? ` Recommended compatible version: ${issue.pkgName}@${recommendedRange}.`
            : '';

        return (
            `✘ '${issue.pkgName}' version ${issue.installedVersion} requires WordPress ${issue.requiredWp}, ` +
            `but your plugin declares a minimum of WordPress ${issue.minWp}. ` +
            `Either upgrade your minimum WP version or downgrade the package.${recommendation}`
        );
    }

    return `✘ Unknown issue: ${JSON.stringify(issue)}`;
}

function formatIssuesReport(issues) {
    const messages = [];
    const nonTabularIssues = issues.filter((issue) => issue.type !== 'incompatible');
    const incompatibleIssues = issues.filter((issue) => issue.type === 'incompatible');

    for (const issue of nonTabularIssues) {
        messages.push(formatIssue(issue));
    }

    if (incompatibleIssues.length > 0) {
        const rows = incompatibleIssues.map((issue) => [
            issue.pkgName,
            issue.installedVersion,
            issue.requiredWp,
            issue.minWp,
            formatRecommendedRange(issue.recommendedVersion) || 'none',
        ]);

        const heading = `Compatibility issues (${incompatibleIssues.length})`;
        messages.push(`${heading}\n${'-'.repeat(heading.length)}`);
        messages.push(buildAsciiTable(['Package', 'Installed', 'Needs WP', 'Plugin Min', 'Suggested'], rows));
    }

    return messages.join('\n\n');
}

function formatNoAutomaticDowngradeMessage(issues) {
    const incompatiblePackages = issues.filter((issue) => issue.type === 'incompatible').map((issue) => issue.pkgName);

    if (incompatiblePackages.length === 1) {
        return `No automatic downgrade is available for ${incompatiblePackages[0]}.`;
    }

    return 'No automatic downgrades are available for the incompatible package(s).';
}

function printInstallReport(issues, packageSpecs) {
    const incompatibleCount = issues.filter((issue) => issue.type === 'incompatible').length;

    console.error('\nInstall summary:');
    console.error(`  Incompatible packages found: ${incompatibleCount}`);
    console.error(`  Packages selected for install: ${packageSpecs.length}`);

    if (packageSpecs.length > 0) {
        console.error('  Recommended package specs:');
        for (const spec of packageSpecs) {
            console.error(`    - ${spec}`);
        }
    }
}

function printSuggestedInstallCommands(packageSpecs, detectedPackageManager = null) {
    if (packageSpecs.length === 0) return;

    console.error('\nSuggested next step:');
    console.error('  wp-gutenberg-compat install');

    console.error('\nEquivalent direct package-manager commands:');
    const packageManagers = detectedPackageManager ? [detectedPackageManager] : ['npm', 'yarn', 'pnpm', 'bun'];
    for (const pm of packageManagers) {
        const command = buildInstallCommand(pm, packageSpecs);
        console.error(`  ${command}`);
    }

    console.error('');
}

function printRemoteSuggestedAction(packageSpecs) {
    if (packageSpecs.length === 0) return;

    console.error('\nSuggested action (remote project):');
    console.error('  The following packages should be installed at a compatible version in that project:');
    for (const spec of packageSpecs) {
        console.error(`    - ${spec}`);
    }
    console.error('');
}

module.exports = {
    formatIssuesReport,
    formatNoAutomaticDowngradeMessage,
    formatIssue,
    printInstallReport,
    printSuggestedInstallCommands,
    printRemoteSuggestedAction,
};
