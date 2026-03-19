'use strict';

function printUnexpectedInstallArgsError(unexpectedArgs) {
    console.error(`✘ The install command does not accept extra arguments: ${unexpectedArgs.join(', ')}`);
    console.error('  Usage: wp-gutenberg-compat install [--dir <path>]');
}

function printMissingPackageManagerError() {
    console.error('\n✘ Could not determine a single package manager from lockfiles.');
    console.error(
        '  Add exactly one lockfile (bun.lockb/bun.lock, pnpm-lock.yaml, yarn.lock, package-lock.json or npm-shrinkwrap.json),',
    );
    console.error('  then run this command again.\n');
}

module.exports = {
    printMissingPackageManagerError,
    printUnexpectedInstallArgsError,
};
