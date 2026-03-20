'use strict';

const { app } = require('../../app.js');
const { analyze, analyzeRemote } = require('../../analyze.js');
const { collectRecommendedInstallSpecs } = require('../install-planning.js');
const { resolveProjectContext } = require('../helpers/project-context.js');
const { formatIssuesReport, buildSuggestedInstallCommands, buildRemoteSuggestedAction } = require('../output.js');

async function runAnalyze(options) {
    if (options.remote && !options.wp) {
        const reporter = app.make('Reporter');
        reporter.error('--remote requires --wp <version>');
        reporter.print();
        return { exitCode: 1, issues: [], packageSpecs: [] };
    }

    const showSuggestedCommands = options.showSuggestedCommands !== false;

    let issues;
    if (options.remote) {
        try {
            issues = await analyzeRemote(options);
        } catch (err) {
            const reporter = app.make('Reporter');
            reporter.error(err.message);
            reporter.print();
            return { exitCode: 1, issues: [], packageSpecs: [] };
        }
    } else {
        issues = analyze(options);
    }

    if (issues.length === 0) {
        const reporter = app.make('Reporter');
        reporter.success('All @wordpress/* packages are compatible with your minimum WordPress version.');
        reporter.print();
        return { exitCode: 0, issues, packageSpecs: [] };
    }

    const reporter = app.make('Reporter');
    reporter.block(formatIssuesReport(issues));

    const packageSpecs = collectRecommendedInstallSpecs(issues);
    if (showSuggestedCommands) {
        if (options.remote) {
            buildRemoteSuggestedAction(reporter, packageSpecs);
        } else {
            const { packageManager } = resolveProjectContext(options.dir);
            buildSuggestedInstallCommands(reporter, packageSpecs, packageManager);
        }
    }

    reporter.print();
    return { exitCode: 1, issues, packageSpecs };
}

module.exports = { runAnalyze };
