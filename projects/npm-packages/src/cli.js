#!/usr/bin/env node
'use strict';

const { app } = require('./app.js');
const { parseArgs } = require('./cli/args.js');
const { USAGE } = require('./cli/usage.js');
const { buildInstallArgs, buildInstallCommand, detectPackageManager } = require('./cli/install-exec.js');
const { collectRecommendedInstallSpecs } = require('./cli/install-planning.js');
const { formatIssue, buildInstallReport } = require('./cli/output.js');
const { runAnalyze, runInfo, runInstallCommand, runOpen } = require('./cli/commands.js');

function main() {
    const [, , command, ...rest] = process.argv;

    if (!command || command === '--help' || command === '-h') {
        app.make('Reporter').log(USAGE).print();
        process.exit(0);
    }

    if (command !== 'analyze' && command !== 'install' && command !== 'info' && command !== 'open') {
        app.make('Reporter').error(`Unknown command: ${command}`).block(USAGE).print();
        process.exit(1);
    }

    if (rest.includes('--help') || rest.includes('-h')) {
        app.make('Reporter').log(USAGE).print();
        process.exit(0);
    }

    const options = parseArgs(process.argv);

    if (command === 'analyze') {
        Promise.resolve(runAnalyze(options)).then(({ exitCode }) => process.exit(exitCode));
        return;
    }

    if (command === 'info') {
        process.exit(runInfo(options));
    }

    if (command === 'open') {
        process.exit(runOpen(options));
    }

    Promise.resolve(runInstallCommand(options)).then((exitCode) => process.exit(exitCode));
}

if (require.main === module) {
    main();
}

module.exports = {
    app,
    buildInstallArgs,
    buildInstallCommand,
    collectRecommendedInstallSpecs,
    detectPackageManager,
    formatIssue,
    main,
    parseArgs,
    buildInstallReport,
    runAnalyze,
    runInfo,
    runInstallCommand,
    runOpen,
};
