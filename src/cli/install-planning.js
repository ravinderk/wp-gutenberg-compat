'use strict';

function toPatchRange(version) {
    return `~${version}`;
}

function collectRecommendedInstallSpecs(issues) {
    const seen = new Set();
    const specs = [];

    for (const issue of issues) {
        if (issue.type !== 'incompatible' || !issue.recommendedVersion) continue;
        const spec = `${issue.pkgName}@${toPatchRange(issue.recommendedVersion)}`;
        if (seen.has(spec)) continue;
        seen.add(spec);
        specs.push(spec);
    }

    return specs;
}

module.exports = {
    collectRecommendedInstallSpecs,
};
