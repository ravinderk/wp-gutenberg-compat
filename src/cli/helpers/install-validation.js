'use strict';

function buildUnexpectedInstallArgsError(reporter, unexpectedArgs) {
    reporter.error(`The install command does not accept extra arguments: ${unexpectedArgs.join(', ')}`);
    reporter.info('  Usage: wp-gutenberg-compat install [--dir <path>]');
}

function buildMissingPackageManagerError(reporter) {
    reporter.error('Could not determine a single package manager from lockfiles.');
    reporter.info(
        [
            '  Add exactly one lockfile (bun.lockb/bun.lock, pnpm-lock.yaml, yarn.lock, package-lock.json or npm-shrinkwrap.json),',
            '  then run this command again.',
        ].join('\n'),
    );
}

module.exports = {
    buildMissingPackageManagerError,
    buildUnexpectedInstallArgsError,
};
