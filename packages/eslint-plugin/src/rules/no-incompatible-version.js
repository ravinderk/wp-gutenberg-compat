const path = require('node:path');
const fs = require('node:fs');
const { discoverWpPackages, findProjectRoot } = require('../utils/discover-wp-packages.js');

/** Cache compat data across files within the same lint run. */
let compatDataCache = null;

/** Cache discovered @wordpress packages keyed by resolved project root. */
const discoveryCache = new Map();

/** Track project roots where the missingMinWp error has already been reported. */
const missingMinWpReported = new Set();

/** Track project-root + package combos where the incompatible error has already been reported. */
const incompatibleReported = new Set();

function loadCompatData(customPath) {
  if (compatDataCache) return compatDataCache;

  if (customPath) {
    compatDataCache = JSON.parse(fs.readFileSync(customPath, 'utf8'));
  } else {
    compatDataCache = require('../data/compat-data.json');
  }

  return compatDataCache;
}

/**
 * Scan the project root for a main plugin PHP file or theme style.css
 * and read its "Requires at least" header.
 *
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
 * Compare two WP version strings.  Returns > 0 if a > b.
 */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Strip pre-release suffix: "28.0.0-rc.1" → "28.0.0"
 */
function stripPreRelease(version) {
  return version.replace(/-.*$/, '');
}

/**
 * Given a package name (e.g. "@wordpress/components"), read its installed
 * version from node_modules.
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

/**
 * Look up which WP version is required for a given @wordpress/* package
 * at a given version.
 *
 * The compat data maps exact package versions to { gutenberg, wordpress }.
 * We find the entry whose version is <= the installed version and return
 * the highest-matched WP requirement.
 */
function getRequiredWpVersion(compatData, pkgName, installedVersion) {
  const pkgEntry = compatData.packages[pkgName];
  if (!pkgEntry) return null;

  const cleaned = stripPreRelease(installedVersion);

  // Direct match
  if (pkgEntry[cleaned]) {
    return pkgEntry[cleaned].wordpress;
  }

  // Find the highest package version that is <= the installed version
  let bestMatch = null;
  let bestWp = null;

  for (const [ver, info] of Object.entries(pkgEntry)) {
    if (compareVersions(ver, cleaned) <= 0) {
      if (!bestMatch || compareVersions(ver, bestMatch) > 0) {
        bestMatch = ver;
        bestWp = info.wordpress;
      }
    }
  }

  return bestWp;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow @wordpress/* packages at versions incompatible with the declared minimum WordPress version.',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          dataPath: {
            type: 'string',
            description: 'Path to a custom compat-data.json file',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      incompatible:
        "'{{pkgName}}' version {{installedVersion}} requires WordPress {{requiredWp}}, but your plugin declares a minimum of WordPress {{minWp}}. Either upgrade your minimum WP version or downgrade the package.",
      missingMinWp:
        "Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your plugin's main PHP file header or theme's style.css header.",
      missingMinWpPlugin:
        "Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your plugin's main PHP file header ({{pluginFile}}).",
      missingMinWpTheme:
        "Could not determine the minimum WordPress version. Add 'Requires at least: X.Y' to your theme's style.css header.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const filename = context.filename || context.getFilename();
    const fileDir = path.dirname(filename);

    // Resolve minimum WP version from plugin/theme file header
    const { version: minWp, projectType, pluginFile } = findWpVersionFromHeader(fileDir);

    if (!minWp) {
      // Resolve project root to report this error only once per project.
      const projectRoot = findProjectRoot(fileDir) || fileDir;

      if (missingMinWpReported.has(projectRoot)) {
        return {};
      }
      missingMinWpReported.add(projectRoot);

      let messageId = 'missingMinWp';
      let data;
      if (projectType === 'plugin') {
        messageId = 'missingMinWpPlugin';
        data = { pluginFile };
      } else if (projectType === 'theme') {
        messageId = 'missingMinWpTheme';
      }

      return {
        Program(node) {
          context.report({ node, messageId, data });
        },
      };
    }

    let compatData;
    try {
      compatData = loadCompatData(options.dataPath);
    } catch {
      // Data not available — skip rule
      return {};
    }

    // Resolve project root for deduplication.
    const projectRoot = findProjectRoot(fileDir) || fileDir;

    // Discover installed @wordpress/* packages from the nearest package.json.
    if (!discoveryCache.has(projectRoot)) {
      discoveryCache.set(projectRoot, discoverWpPackages(fileDir));
    }
    const discoveredPackages = discoveryCache.get(projectRoot);

    return {
      Program(programNode) {
        for (const pkgName of discoveredPackages) {
          const cacheKey = `${projectRoot}\0${pkgName}`;
          if (incompatibleReported.has(cacheKey)) continue;

          const installedVersion = getInstalledVersion(pkgName, fileDir);
          if (!installedVersion) continue;
          const requiredWp = getRequiredWpVersion(compatData, pkgName, installedVersion);
          if (!requiredWp) continue;
          if (compareVersions(requiredWp, minWp) > 0) {
            incompatibleReported.add(cacheKey);
            context.report({
              node: programNode,
              messageId: 'incompatible',
              data: {
                pkgName,
                installedVersion: stripPreRelease(installedVersion),
                requiredWp,
                minWp,
              },
            });
          }
        }
      },
    };
  },
};

module.exports = rule;
