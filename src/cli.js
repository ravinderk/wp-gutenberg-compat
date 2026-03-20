#!/usr/bin/env node
'use strict';

const { parseArgs } = require('./cli/args.js');
const { USAGE } = require('./cli/usage.js');
const { buildInstallArgs, buildInstallCommand, detectPackageManager } = require('./cli/install-exec.js');
const { collectRecommendedInstallSpecs } = require('./cli/install-planning.js');
const { formatIssue, printInstallReport } = require('./cli/output.js');
const { runAnalyze, runInfo, runInstallCommand } = require('./cli/commands.js');

function main() {
    const [, , command, ...rest] = process.argv;

    if (!command || command === '--help' || command === '-h') {
        console.log(USAGE);
        process.exit(0);
    }

    if (command !== 'analyze' && command !== 'install' && command !== 'info') {
        console.error(`Unknown command: ${command}\n`);
        console.error(USAGE);
        process.exit(1);
    }

    if (rest.includes('--help') || rest.includes('-h')) {
        console.log(USAGE);
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
    printInstallReport,
    runAnalyze,
    runInfo,
    runInstallCommand,
};
