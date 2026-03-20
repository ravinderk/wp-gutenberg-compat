'use strict';

const { runInfo } = require('./commands/info.js');
const { runAnalyze } = require('./commands/analyze.js');
const { runInstallCommand } = require('./commands/install.js');

module.exports = {
    runInfo,
    runAnalyze,
    runInstallCommand,
};
