'use strict';

const USAGE = `
Usage: wp-gutenberg-compat <command> [options]

Commands:
    analyze                  Analyze compatibility and print recommendations
    install                  Install all recommended compatible package versions and print a report.
    info [package...]        Display tool info, or the compatibility matrix for given @wordpress/* package(s).

Analyze options:
    --dir <path>                     Directory to analyze (default: current working directory)
    --help                           Show this help message

Install options:
    --dir <path>                     Directory to install (default: current working directory)
    --help                           Show this help message

Info options:
    [package...]                     One or more @wordpress/* package names (e.g. @wordpress/block-editor)
    --help                           Show this help message
`.trim();

module.exports = {
    USAGE,
};
