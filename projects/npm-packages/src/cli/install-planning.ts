import type { CompatIssue, IncompatibleIssue } from '../types/index.js';

export function collectRecommendedInstallSpecs(issues: CompatIssue[]): string[] {
    const seen = new Set<string>();
    const specs: string[] = [];

    for (const issue of issues) {
        if (issue.type !== 'incompatible') continue;
        const incompatible = issue as IncompatibleIssue;
        if (!incompatible.recommendedVersion) continue;
        const spec = `${incompatible.pkgName}@~${incompatible.recommendedVersion}`;
        if (seen.has(spec)) continue;
        seen.add(spec);
        specs.push(spec);
    }

    return specs;
}
