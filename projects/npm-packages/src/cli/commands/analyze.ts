import { app } from '../../app.js';
import { analyze, analyzeRemote } from '../../analyze.js';
import { collectRecommendedInstallSpecs } from '../install-planning.js';
import { resolveProjectContext } from '../helpers/project-context.js';
import { formatIssuesReport, buildSuggestedInstallCommands, buildRemoteSuggestedAction } from '../output.js';
import type { CliOptions, AnalyzeResult } from '../../types/index.js';

export async function runAnalyze(options: CliOptions): Promise<AnalyzeResult> {
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
            issues = await analyzeRemote({ remote: options.remote, wp: options.wp!, dataPath: options.dataPath });
        } catch (err) {
            const reporter = app.make('Reporter');
            reporter.error((err as Error).message);
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
