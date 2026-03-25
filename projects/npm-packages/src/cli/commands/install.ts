import { app } from '../../app.js';
import { runInstall } from '../install-exec.js';
import { resolveProjectContext } from '../helpers/project-context.js';
import { buildMissingPackageManagerError, buildUnexpectedInstallArgsError } from '../helpers/install-validation.js';
import { formatNoAutomaticDowngradeMessage, buildInstallReport } from '../output.js';
import { runAnalyze } from './analyze.js';
import type { CliOptions } from '../../types/index.js';

export async function runInstallCommand(options: CliOptions): Promise<number> {
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
