'use strict';

const USAGE = `
Usage: wp-gutenberg-compat <command> [options]

Commands:
    analyze                  Analyze compatibility and print recommendations
    install                  Install all recommended compatible package versions and print a report.
    info [package...]        Display tool info, or the compatibility matrix for given @wordpress/* package(s).

Analyze options:
    --dir <path>                     Directory to analyze (default: current working directory)
    --wp <version>                   Override the minimum WordPress version (e.g. 6.5). Works in both local and remote mode.
    --remote <url>                   Fetch a remote package.json URL and check @wordpress/* ranges against compat data.
                                     Requires --wp <version>. No local clone or node_modules needed.
    --help                           Show this help message

Install options:
    --dir <path>                     Directory to install (default: current working directory)
    --help                           Show this help message

Info options:
    [package...]                     One or more @wordpress/* package names (e.g. @wordpress/block-editor)
    --help                           Show this help message

Examples:
    wp-gutenberg-compat analyze
    wp-gutenberg-compat analyze --wp 6.4
    wp-gutenberg-compat analyze --remote https://raw.githubusercontent.com/user/my-plugin/main/package.json --wp 6.5
`.trim();

module.exports = {
    USAGE,
};
