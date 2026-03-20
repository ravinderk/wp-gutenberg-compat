'use strict';

function loadCompatData(dataPath) {
    if (dataPath) {
        const fs = require('node:fs');
        const path = require('node:path');
        return JSON.parse(fs.readFileSync(path.resolve(dataPath), 'utf8'));
    }
    return require('../../data/compat-data.json');
}

module.exports = { loadCompatData };
