'use strict';

const { buildInstallCommand } = require('./install-exec.js');
const { buildAsciiTable } = require('./table.js');
const { Reporter } = require('../services/reporter.js');

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

function buildInstallReport(reporter, issues, packageSpecs) {
    const incompatibleCount = issues.filter((issue) => issue.type === 'incompatible').length;

    const lines = ['Install summary:'];
    lines.push(`  Incompatible packages found: ${incompatibleCount}`);
    lines.push(`  Packages selected for install: ${packageSpecs.length}`);

    if (packageSpecs.length > 0) {
        lines.push('  Recommended package specs:');
        for (const spec of packageSpecs) {
            lines.push(`    - ${spec}`);
        }
    }

    reporter.block(lines.join('\n'));
}

function buildSuggestedInstallCommands(reporter, packageSpecs, detectedPackageManager = null) {
    if (packageSpecs.length === 0) return;

    const packageManagers = detectedPackageManager ? [detectedPackageManager] : ['npm', 'yarn', 'pnpm', 'bun'];
    const pmLines = packageManagers.map((pm) => `  ${buildInstallCommand(pm, packageSpecs)}`);

    reporter.block(
        '\n',
        'Suggested next step:',
        '  wp-gutenberg-compat install',
        '',
        'Equivalent direct package-manager commands:',
        ...pmLines,
    );
}

function buildRemoteSuggestedAction(reporter, packageSpecs) {
    if (packageSpecs.length === 0) return;

    reporter.block(
        'Suggested action (remote project):',
        '  The following packages should be installed at a compatible version in that project:',
        ...packageSpecs.map((spec) => `    - ${spec}`),
    );
}

module.exports = {
    Reporter,
    formatIssuesReport,
    formatNoAutomaticDowngradeMessage,
    formatIssue,
    buildInstallReport,
    buildSuggestedInstallCommands,
    buildRemoteSuggestedAction,
};
