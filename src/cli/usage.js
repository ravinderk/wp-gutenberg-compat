'use strict';

const USAGE = `
Usage: wp-gutenberg-compat <command> [options]

Commands:
    analyze    Analyze compatibility and print recommendations
    install    Install recommended compatible package versions. Requires either one or more package names, or --all.

Analyze options:
    --dir <path>                     Directory to analyze (default: current working directory)
    --help                           Show this help message

Install options:
    --all                            Install all recommended compatible package versions
    --dir <path>                     Directory to install (default: current working directory)
    <package-name> [...]             Install only the listed package(s), e.g. @wordpress/components
    --help                           Show this help message
`.trim();

module.exports = {
    USAGE,
};
