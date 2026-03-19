#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { analyze } = require('./analyze.js');

const USAGE = `
Usage: wp-gutenberg-compat analyze [options]

Options:
  --dir <path>  Directory to analyze (default: current working directory)
  --help        Show this help message
`.trim();

function parseArgs(argv) {
    const args = argv.slice(2); // drop node + script
    const options = { dir: process.cwd() };

    for (let i = 0; i < args.length; i++) {
        if ((args[i] === '--dir' || args[i] === '-d') && args[i + 1]) {
            options.dir = path.resolve(args[++i]);
        }
    }

    return options;
}

function formatIssue(issue) {
    if (issue.type === 'missing-min-wp') {
        if (issue.projectType === 'plugin') {
            return `✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your plugin's main PHP file header (${issue.pluginFile}).`;
        }
        if (issue.projectType === 'theme') {
            return `✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your theme's style.css header.`;
        }
        return `✘ Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your plugin's main PHP file header or theme's style.css header.`;
    }

    if (issue.type === 'incompatible') {
        return (
            `✘ '${issue.pkgName}' version ${issue.installedVersion} requires WordPress ${issue.requiredWp}, ` +
            `but your plugin declares a minimum of WordPress ${issue.minWp}. ` +
            `Either upgrade your minimum WP version or downgrade the package.`
        );
    }

    return `✘ Unknown issue: ${JSON.stringify(issue)}`;
}

function main() {
    const [, , command, ...rest] = process.argv;

    if (!command || command === '--help' || command === '-h') {
        console.log(USAGE);
        process.exit(0);
    }

    if (command !== 'analyze') {
        console.error(`Unknown command: ${command}\n`);
        console.error(USAGE);
        process.exit(1);
    }

    if (rest.includes('--help') || rest.includes('-h')) {
        console.log(USAGE);
        process.exit(0);
    }

    const options = parseArgs(process.argv);
    const issues = analyze(options);

    if (issues.length === 0) {
        console.log('✔ All @wordpress/* packages are compatible with your minimum WordPress version.');
        process.exit(0);
    }

    for (const issue of issues) {
        console.error(formatIssue(issue));
    }

    process.exit(1);
}

main();
