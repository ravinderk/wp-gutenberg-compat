'use strict';

const path = require('node:path');

function parseArgs(argv) {
    const args = argv.slice(2); // drop node + script
    const options = {
        dir: process.cwd(),
        unexpectedArgs: [],
        infoPackages: [],
        openPackage: null,
        remote: null,
        wp: null,
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === 'analyze' || args[i] === 'install') continue;

        if (args[i] === 'info') {
            // Collect all remaining non-flag args as package names for info command
            for (let j = i + 1; j < args.length; j++) {
                if (args[j] !== '--help' && args[j] !== '-h' && !args[j].startsWith('-')) {
                    options.infoPackages.push(args[j]);
                }
            }
            break;
        }

        if (args[i] === 'open') {
            // The next non-flag argument is the package name
            for (let j = i + 1; j < args.length; j++) {
                if (args[j] === '--wp' && args[j + 1]) {
                    options.wp = args[++j];
                } else if (args[j] !== '--help' && args[j] !== '-h' && !args[j].startsWith('-')) {
                    options.openPackage = args[j];
                }
            }
            break;
        }

        if ((args[i] === '--dir' || args[i] === '-d') && args[i + 1]) {
            options.dir = path.resolve(args[++i]);
            continue;
        }

        if (args[i] === '--remote' && args[i + 1]) {
            options.remote = args[++i];
            continue;
        }

        if (args[i] === '--wp' && args[i + 1]) {
            options.wp = args[++i];
            continue;
        }

        if (args[i] !== '--help' && args[i] !== '-h') {
            options.unexpectedArgs.push(args[i]);
        }
    }

    return options;
}

module.exports = {
    parseArgs,
};
