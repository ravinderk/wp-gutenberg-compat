#!/usr/bin/env node
'use strict';

const { parseArgs } = require('./cli/args.js');
const { USAGE } = require('./cli/usage.js');
const { buildInstallArgs, buildInstallCommand, detectPackageManager } = require('./cli/install-exec.js');
const { collectRecommendedInstallSpecs } = require('./cli/install-planning.js');
const { Reporter, formatIssue, buildInstallReport } = require('./cli/output.js');
const { runAnalyze, runInfo, runInstallCommand } = require('./cli/commands.js');

function main() {
    const [, , command, ...rest] = process.argv;

    if (!command || command === '--help' || command === '-h') {
        new Reporter().log(USAGE).print();
        process.exit(0);
    }

    if (command !== 'analyze' && command !== 'install' && command !== 'info') {
        new Reporter().error(`Unknown command: ${command}`).block(USAGE).print();
        process.exit(1);
    }

    if (rest.includes('--help') || rest.includes('-h')) {
        new Reporter().log(USAGE).print();
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

    Promise.resolve(runInstallCommand(options)).then((exitCode) => process.exit(exitCode));
}

if (require.main === module) {
    main();
}

module.exports = {
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
};
