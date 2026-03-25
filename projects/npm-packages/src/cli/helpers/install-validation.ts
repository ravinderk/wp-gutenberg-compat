import type { Reporter } from '../output.js';

export function buildUnexpectedInstallArgsError(reporter: Reporter, unexpectedArgs: string[]): void {
    reporter.error(`The install command does not accept extra arguments: ${unexpectedArgs.join(', ')}`);
    reporter.info('  Usage: wp-gutenberg-compat install [--dir <path>]');
}

export function buildMissingPackageManagerError(reporter: Reporter): void {
    reporter.error('Could not determine a single package manager from lockfiles.');
    reporter.info(
        [
            '  Add exactly one lockfile (bun.lockb/bun.lock, pnpm-lock.yaml, yarn.lock, package-lock.json or npm-shrinkwrap.json),',
            '  then run this command again.',
        ].join('\n'),
    );
}
