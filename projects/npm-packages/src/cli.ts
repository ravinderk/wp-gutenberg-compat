#!/usr/bin/env node
import { app } from './app.js';
import { parseArgs } from './cli/args.js';
import { USAGE } from './cli/usage.js';
import { buildInstallArgs, buildInstallCommand, detectPackageManager } from './cli/install-exec.js';
import { collectRecommendedInstallSpecs } from './cli/install-planning.js';
import { formatIssue, buildInstallReport } from './cli/output.js';
import { runAnalyze, runInfo, runInstallCommand, runOpen } from './cli/commands.js';

export function main(): void {
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

export {
    app,
    buildInstallArgs,
    buildInstallCommand,
    collectRecommendedInstallSpecs,
    detectPackageManager,
    formatIssue,
    parseArgs,
    buildInstallReport,
    runAnalyze,
    runInfo,
    runInstallCommand,
    runOpen,
};
