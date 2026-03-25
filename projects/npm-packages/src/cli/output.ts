import { buildInstallCommand } from './install-exec.js';
import { buildAsciiTable } from './table.js';
import { Reporter } from '../services/reporter.js';
import type { CompatIssue, IncompatibleIssue, MissingMinWpIssue, PackageManager } from '../types/index.js';

export { Reporter };

function formatRecommendedRange(version: string | null): string | null {
    return version ? `~${version}` : null;
}

export function formatIssue(issue: CompatIssue): string {
    if (issue.type === 'missing-min-wp') {
        const missingIssue = issue as MissingMinWpIssue;
        if (missingIssue.projectType === 'plugin') {
            return `✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your plugin's main PHP file header (${missingIssue.pluginFile}).`;
        }
        if (missingIssue.projectType === 'theme') {
            return `✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your theme's style.css header.`;
        }
        return "✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your plugin's main PHP file header or theme's style.css header.";
    }

    if (issue.type === 'incompatible') {
        const incompatible = issue as IncompatibleIssue;
        const recommendedRange = formatRecommendedRange(incompatible.recommendedVersion);
        const recommendation = recommendedRange
            ? ` Recommended compatible version: ${incompatible.pkgName}@${recommendedRange}.`
            : '';

        return (
            `✘ '${incompatible.pkgName}' version ${incompatible.installedVersion} requires WordPress ${incompatible.requiredWp}, ` +
            `but your plugin declares a minimum of WordPress ${incompatible.minWp}. ` +
            `Either upgrade your minimum WP version or downgrade the package.${recommendation}`
        );
    }

    return `✘ Unknown issue: ${JSON.stringify(issue)}`;
}

export function formatIssuesReport(issues: CompatIssue[]): string {
    const messages: string[] = [];
    const nonTabularIssues = issues.filter((issue) => issue.type !== 'incompatible');
    const incompatibleIssues = issues.filter((issue): issue is IncompatibleIssue => issue.type === 'incompatible');

    for (const issue of nonTabularIssues) {
        messages.push(formatIssue(issue));
    }

    if (incompatibleIssues.length > 0) {
        const rows = incompatibleIssues.map((issue) => [
            issue.pkgName,
            issue.installedVersion,
            issue.requiredWp,
            issue.minWp,
            formatRecommendedRange(issue.recommendedVersion) ?? 'none',
        ]);

        const heading = `Compatibility issues (${incompatibleIssues.length})`;
        messages.push(`${heading}\n${'-'.repeat(heading.length)}`);
        messages.push(buildAsciiTable(['Package', 'Installed', 'Needs WP', 'Plugin Min', 'Suggested'], rows));
    }

    return messages.join('\n\n');
}

export function formatNoAutomaticDowngradeMessage(issues: CompatIssue[]): string {
    const incompatiblePackages = issues
        .filter((issue): issue is IncompatibleIssue => issue.type === 'incompatible')
        .map((issue) => issue.pkgName);

    if (incompatiblePackages.length === 1) {
        return `No automatic downgrade is available for ${incompatiblePackages[0]}.`;
    }

    return 'No automatic downgrades are available for the incompatible package(s).';
}

export function buildInstallReport(reporter: Reporter, issues: CompatIssue[], packageSpecs: string[]): void {
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

export function buildSuggestedInstallCommands(
    reporter: Reporter,
    packageSpecs: string[],
    detectedPackageManager: PackageManager | null = null,
): void {
    if (packageSpecs.length === 0) return;

    const packageManagers: PackageManager[] = detectedPackageManager
        ? [detectedPackageManager]
        : ['npm', 'yarn', 'pnpm', 'bun'];
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

export function buildRemoteSuggestedAction(reporter: Reporter, packageSpecs: string[]): void {
    if (packageSpecs.length === 0) return;

    reporter.block(
        'Suggested action (remote project):',
        '  The following packages should be installed at a compatible version in that project:',
        ...packageSpecs.map((spec) => `    - ${spec}`),
    );
}
