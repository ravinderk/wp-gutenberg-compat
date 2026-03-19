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

function getPackageNameFromSpec(spec) {
    const atIndex = spec.lastIndexOf('@');
    if (atIndex <= 0) return spec;
    return spec.slice(0, atIndex);
}

function resolveInstallSpecs(packageSpecs, options) {
    const { installAll, packageNames } = options;

    if (installAll && packageNames.length > 0) {
        return {
            ok: false,
            reason: "Use either '--all' or package names, not both.",
            selectedSpecs: [],
            missingPackages: [],
        };
    }

    if (!installAll && packageNames.length === 0) {
        return {
            ok: false,
            reason: "Specify package name(s) or use '--all'.",
            selectedSpecs: [],
            missingPackages: [],
        };
    }

    if (installAll) {
        return {
            ok: true,
            selectedSpecs: packageSpecs,
            missingPackages: [],
        };
    }

    const uniqueRequested = [...new Set(packageNames)];
    const specByPackage = new Map();
    for (const spec of packageSpecs) {
        specByPackage.set(getPackageNameFromSpec(spec), spec);
    }

    const selectedSpecs = [];
    const missingPackages = [];

    for (const pkgName of uniqueRequested) {
        const matchedSpec = specByPackage.get(pkgName);
        if (matchedSpec) {
            selectedSpecs.push(matchedSpec);
            continue;
        }
        missingPackages.push(pkgName);
    }

    return {
        ok: true,
        selectedSpecs,
        missingPackages,
    };
}

module.exports = {
    collectRecommendedInstallSpecs,
    getPackageNameFromSpec,
    resolveInstallSpecs,
};
