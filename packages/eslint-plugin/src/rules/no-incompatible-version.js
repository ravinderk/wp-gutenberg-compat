import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { discoverWpPackages } from '../utils/discover-wp-packages.js';

const require = createRequire(import.meta.url);

/** Cache compat data across files within the same lint run. */
let compatDataCache = null;

/** Cache discovered @wordpress packages keyed by resolved project root. */
const discoveryCache = new Map();

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
 * Walk up from `startDir` looking for the nearest package.json that
 * contains a `wordpress.requiresAtLeast` field.
 */
function findWpVersionFromPackageJson(startDir) {
  let dir = startDir;
  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.wordpress && pkg.wordpress.requiresAtLeast) {
          return pkg.wordpress.requiresAtLeast;
        }
      } catch {
        // Ignore parse errors and keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Scan the project root for a main plugin PHP file and read its
 * "Requires at least" header.
 */
function findWpVersionFromPluginHeader(startDir) {
  let dir = startDir;
  // Walk up to find the project root (directory containing package.json)
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) break;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }

  const dirName = path.basename(dir);
  const pluginFile = path.join(dir, `${dirName}.php`);

  if (!fs.existsSync(pluginFile)) return null;

  try {
    const content = fs.readFileSync(pluginFile, 'utf8');
    const match = content.match(/Requires\s+at\s+least:\s*([\d.]+)/i);
    if (match) return match[1];
  } catch {
    // Ignore read errors
  }

  return null;
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
        'Disallow importing @wordpress/* packages at versions incompatible with the declared minimum WordPress version.',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          requiresAtLeast: {
            type: 'string',
            description: 'Minimum WordPress version (e.g. "6.5")',
          },
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
      incompatibleInstalled:
        "'{{pkgName}}' version {{installedVersion}} requires WordPress {{requiredWp}}, but your plugin declares a minimum of WordPress {{minWp}}. Either upgrade your minimum WP version or downgrade the package. (Detected from package.json)",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const filename = context.filename || context.getFilename();
    const fileDir = path.dirname(filename);

    // Resolve minimum WP version: option > package.json > PHP header
    const minWp =
      options.requiresAtLeast ||
      findWpVersionFromPackageJson(fileDir) ||
      findWpVersionFromPluginHeader(fileDir);

    if (!minWp) {
      // Cannot determine minimum WP version — skip rule silently
      return {};
    }

    let compatData;
    try {
      compatData = loadCompatData(options.dataPath);
    } catch {
      // Data not available — skip rule
      return {};
    }

    // Discover installed @wordpress/* packages from the nearest package.json.
    // Use fileDir as the starting point so that:
    //   - In tests the fixture directory (which contains the test package.json) is found directly.
    //   - In real projects the utility walks up from the source file to find the project root.
    if (!discoveryCache.has(fileDir)) {
      discoveryCache.set(fileDir, discoverWpPackages(fileDir));
    }
    const discoveredPackages = discoveryCache.get(fileDir);

    // Build a map of discovered packages that are incompatible with minWp.
    // Keyed by package name → { installedVersion, requiredWp }.
    const proactiveMap = new Map();
    for (const pkgName of discoveredPackages) {
      const installedVersion = getInstalledVersion(pkgName, fileDir);
      if (!installedVersion) continue;
      const requiredWp = getRequiredWpVersion(compatData, pkgName, installedVersion);
      if (!requiredWp) continue;
      if (compareVersions(requiredWp, minWp) > 0) {
        proactiveMap.set(pkgName, {
          installedVersion: stripPreRelease(installedVersion),
          requiredWp,
        });
      }
    }

    // Track packages already reported via ImportDeclaration to avoid duplicates.
    const reportedByImport = new Set();

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (!source || !source.startsWith('@wordpress/')) return;

        const installedVersion = getInstalledVersion(source, fileDir);
        if (!installedVersion) return;

        const requiredWp = getRequiredWpVersion(compatData, source, installedVersion);
        if (!requiredWp) return;

        if (compareVersions(requiredWp, minWp) > 0) {
          context.report({
            node,
            messageId: 'incompatible',
            data: {
              pkgName: source,
              installedVersion: stripPreRelease(installedVersion),
              requiredWp,
              minWp,
            },
          });
          // Mark as reported so Program:exit skips it.
          reportedByImport.add(source);
        }
      },

      'Program:exit'(programNode) {
        for (const [pkgName, { installedVersion, requiredWp }] of proactiveMap) {
          if (reportedByImport.has(pkgName)) continue;
          context.report({
            node: programNode,
            messageId: 'incompatibleInstalled',
            data: { pkgName, installedVersion, requiredWp, minWp },
          });
        }
      },
    };
  },
};

export default rule;
