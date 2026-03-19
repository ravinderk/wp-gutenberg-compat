'use strict';

const USAGE = `
Usage: wp-gutenberg-compat <command> [options]

Commands:
    analyze    Analyze compatibility and print recommendations
    install    Install all recommended compatible package versions and print a report.

Analyze options:
    --dir <path>                     Directory to analyze (default: current working directory)
    --help                           Show this help message

Install options:
    --dir <path>                     Directory to install (default: current working directory)
    --help                           Show this help message
`.trim();

module.exports = {
    USAGE,
};
