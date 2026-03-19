'use strict';

const path = require('node:path');

function parseArgs(argv) {
    const args = argv.slice(2); // drop node + script
    const options = {
        dir: process.cwd(),
        unexpectedArgs: [],
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === 'analyze' || args[i] === 'install') continue;

        if ((args[i] === '--dir' || args[i] === '-d') && args[i + 1]) {
            options.dir = path.resolve(args[++i]);
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
