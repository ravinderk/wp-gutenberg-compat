const path = require('node:path');
const fs = require('node:fs');
const { findProjectRoot } = require('./discover-wp-packages.js');

/**
 * Scan the project root for a main plugin PHP file or theme style.css
 * and read its "Requires at least" header.
 *
 * @param {string} startDir
 * @returns {{ version: string|null, projectType: 'plugin'|'theme'|null, pluginFile: string|null }}
 */
function findWpVersionFromHeader(startDir) {
    const dir = findProjectRoot(startDir);
    if (!dir) return { version: null, projectType: null, pluginFile: null };

    const requiresAtLeastPattern = /Requires\s+at\s+least:\s*([\d.]+)/i;

    // Check for plugin file: {dirName}.php
    const dirName = path.basename(dir);
    const pluginFileName = `${dirName}.php`;
    const pluginFile = path.join(dir, pluginFileName);
    if (fs.existsSync(pluginFile)) {
        try {
            const content = fs.readFileSync(pluginFile, 'utf8');
            const match = content.match(requiresAtLeastPattern);
            if (match) return { version: match[1], projectType: 'plugin', pluginFile: pluginFileName };
        } catch {
            // Ignore read errors
        }
        return { version: null, projectType: 'plugin', pluginFile: pluginFileName };
    }

    // Check for theme: style.css
    const styleFile = path.join(dir, 'style.css');
    if (fs.existsSync(styleFile)) {
        try {
            const content = fs.readFileSync(styleFile, 'utf8');
            const match = content.match(requiresAtLeastPattern);
            if (match) return { version: match[1], projectType: 'theme', pluginFile: null };
        } catch {
            // Ignore read errors
        }
        return { version: null, projectType: 'theme', pluginFile: null };
    }

    return { version: null, projectType: null, pluginFile: null };
}

/**
 * Read the installed version of a package from node_modules.
 *
 * @param {string} pkgName
 * @param {string} startDir
 * @returns {string|null}
 */
function getInstalledVersion(pkgName, startDir) {
    try {
        const pkgJsonPath = require.resolve(`${pkgName}/package.json`, {
            paths: [startDir],
        });
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        return pkg.version || null;
    } catch {
        return null;
    }
}

module.exports = { findWpVersionFromHeader, getInstalledVersion };
