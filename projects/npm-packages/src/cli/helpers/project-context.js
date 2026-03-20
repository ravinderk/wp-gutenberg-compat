'use strict';

const { findProjectRoot } = require('../../utils/discover-wp-packages.js');
const { detectPackageManager } = require('../install-exec.js');

function resolveProjectContext(dir) {
    const projectDir = findProjectRoot(dir) || dir;
    const packageManager = detectPackageManager(projectDir);
    return { projectDir, packageManager };
}

module.exports = {
    resolveProjectContext,
};
