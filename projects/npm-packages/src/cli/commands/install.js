'use strict';

const { app } = require('../../app.js');
const { runInstall } = require('../install-exec.js');
const { resolveProjectContext } = require('../helpers/project-context.js');
const {
    buildMissingPackageManagerError,
    buildUnexpectedInstallArgsError,
} = require('../helpers/install-validation.js');
const { formatNoAutomaticDowngradeMessage, buildInstallReport } = require('../output.js');
const { runAnalyze } = require('./analyze.js');

async function runInstallCommand(options) {
    if (options.unexpectedArgs.length > 0) {
        const reporter = app.make('Reporter');
        buildUnexpectedInstallArgsError(reporter, options.unexpectedArgs);
        reporter.print();
        return 1;
    }

    const { issues, packageSpecs } = await runAnalyze({ ...options, showSuggestedCommands: false });

    if (issues.length === 0) {
        return 0;
    }

    if (packageSpecs.length === 0) {
        const reporter = app.make('Reporter');
        reporter.error(formatNoAutomaticDowngradeMessage(issues));
        reporter.print();
        return 1;
    }

    const reporter = app.make('Reporter');
    buildInstallReport(reporter, issues, packageSpecs);

    const { projectDir, packageManager } = resolveProjectContext(options.dir);
    if (!packageManager) {
        buildMissingPackageManagerError(reporter);
        reporter.print();
        return 1;
    }

    reporter.print();

    const ok = runInstall(projectDir, packageManager, packageSpecs);
    if (!ok) {
        const failReporter = app.make('Reporter');
        failReporter.error('Installation failed.');
        failReporter.print();
        return 1;
    }

    return 0;
}

module.exports = { runInstallCommand };
