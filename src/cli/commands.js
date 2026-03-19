'use strict';

const { analyze } = require('../analyze.js');
const { collectRecommendedInstallSpecs } = require('./install-planning.js');
const { runInstall } = require('./install-exec.js');
const { resolveProjectContext } = require('./helpers/project-context.js');
const { printMissingPackageManagerError, printUnexpectedInstallArgsError } = require('./helpers/install-validation.js');
const {
    formatNoAutomaticDowngradeMessage,
    formatIssuesReport,
    printInstallReport,
    printSuggestedInstallCommands,
} = require('./output.js');

function runAnalyze(options) {
    const showSuggestedCommands = options.showSuggestedCommands !== false;
    const issues = analyze(options);

    if (issues.length === 0) {
        console.log('✔ All @wordpress/* packages are compatible with your minimum WordPress version.');
        return { exitCode: 0, issues, packageSpecs: [] };
    }

    console.error(`\n${formatIssuesReport(issues)}\n`);

    const packageSpecs = collectRecommendedInstallSpecs(issues);
    if (showSuggestedCommands) {
        const { packageManager } = resolveProjectContext(options.dir);
        printSuggestedInstallCommands(packageSpecs, packageManager);
    }

    return { exitCode: 1, issues, packageSpecs };
}

function runInstallCommand(options) {
    if (options.unexpectedArgs.length > 0) {
        printUnexpectedInstallArgsError(options.unexpectedArgs);
        return 1;
    }

    const { issues, packageSpecs } = runAnalyze({ ...options, showSuggestedCommands: false });

    if (issues.length === 0) {
        return 0;
    }

    if (packageSpecs.length === 0) {
        console.error(`\n${formatNoAutomaticDowngradeMessage(issues)}\n`);
        return 1;
    }

    printInstallReport(issues, packageSpecs);

    const { projectDir, packageManager } = resolveProjectContext(options.dir);
    if (!packageManager) {
        printMissingPackageManagerError();
        return 1;
    }

    const ok = runInstall(projectDir, packageManager, packageSpecs);
    if (!ok) {
        console.error('\n✘ Installation failed.\n');
        return 1;
    }

    return 0;
}

module.exports = {
    runAnalyze,
    runInstallCommand,
};
