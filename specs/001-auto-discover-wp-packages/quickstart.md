# Quickstart: Implementing Auto-Discover WordPress Packages (001)

**Branch**: `001-auto-discover-wp-packages` | **Date**: 2025-07-14

This guide walks a developer through implementing the feature end-to-end. Tasks are
ordered so each step compiles and tests pass after each one.

---

## Prerequisites

```bash
# From repo root
npm install          # install all workspace dependencies
npm test             # confirm all existing tests pass before you start
```

---

## Step 1 — Create the utility module

**File**: `packages/eslint-plugin/src/utils/discover-wp-packages.js`

```js
import fs from 'node:fs';
import path from 'node:path';

/**
 * Read the project's package.json and return all @wordpress/* package names
 * found in dependencies and devDependencies (deduplicated).
 *
 * @param {string} projectRoot - Absolute path to the directory containing package.json.
 * @returns {string[]} Deduplicated @wordpress/* package name strings. Returns [] on error.
 */
export function discoverWpPackages(projectRoot) {
    const pkgPath = path.join(projectRoot, 'package.json');
    let pkg;

    try {
        const content = fs.readFileSync(pkgPath, 'utf8');
        pkg = JSON.parse(content);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.warn(`[wp-gutenberg-compat] Could not parse ${pkgPath}: ${err.message}`);
        }
        return [];
    }

    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const all = [...new Set([...deps, ...devDeps])];

    return all.filter((name) => name.startsWith('@wordpress/'));
}
```

---

## Step 2 — Write utility unit tests

**File**: `packages/eslint-plugin/tests/discover-wp-packages.test.js`

Key test cases to cover (in order of spec priority):

| #   | Scenario                                                            | Expected result                  |
| --- | ------------------------------------------------------------------- | -------------------------------- |
| 1   | Valid `package.json` with `@wordpress/components` in `dependencies` | `['@wordpress/components']`      |
| 2   | Same package in both `dependencies` and `devDependencies`           | Single entry (no duplicate)      |
| 3   | `@wordpress/*` packages in `devDependencies` only                   | All returned                     |
| 4   | Non-`@wordpress` packages only                                      | `[]`                             |
| 5   | Missing `package.json`                                              | `[]`, no throw                   |
| 6   | Invalid JSON in `package.json`                                      | `[]`, `console.warn` called once |
| 7   | `package.json` with no `dependencies`/`devDependencies` keys        | `[]`                             |
| 8   | `package.json` with empty `dependencies: {}`                        | `[]`                             |

Run after writing: `npm test --workspace packages/eslint-plugin`

---

## Step 3 — Modify `no-incompatible-version.js`

**File**: `packages/eslint-plugin/src/rules/no-incompatible-version.js`

### 3a — Add import at the top of the module

```js
import { discoverWpPackages } from '../utils/discover-wp-packages.js';
```

### 3b — Add module-level cache (alongside existing `compatDataCache`)

```js
/** Cache discovered @wordpress/* packages per project root for the lint run. */
const discoveryCache = new Map();
```

### 3c — Add new messageId to `rule.meta.messages`

```js
messages: {
  // EXISTING — unchanged
  incompatible:
    "'{{pkgName}}' version {{installedVersion}} requires WordPress {{requiredWp}}, " +
    "but your plugin declares a minimum of WordPress {{minWp}}. Either upgrade " +
    "your minimum WP version or downgrade the package.",

  // NEW — reported on Program node for packages discovered but not imported
  incompatibleInstalled:
    "'{{pkgName}}' version {{installedVersion}} requires WordPress {{requiredWp}}, " +
    "but your plugin declares a minimum of WordPress {{minWp}}. Either upgrade " +
    "your minimum WP version or downgrade the package. (Detected from package.json)",
},
```

### 3d — Update `create()` function

Replace the existing `create(context)` body with the enhanced version:

```js
create(context) {
  const options = context.options[0] || {};
  const filename = context.filename || context.getFilename();
  const fileDir = path.dirname(filename);

  // Resolve minimum WP version: option > package.json > PHP header
  const minWp =
    options.requiresAtLeast ||
    findWpVersionFromPackageJson(fileDir) ||
    findWpVersionFromPluginHeader(fileDir);

  if (!minWp) return {};

  let compatData;
  try {
    compatData = loadCompatData(options.dataPath);
  } catch {
    return {};
  }

  // ── NEW: discover installed @wordpress/* packages ──────────────────────
  const projectRoot =
    (context.getCwd && context.getCwd()) ||
    context.cwd ||
    fileDir;

  if (!discoveryCache.has(projectRoot)) {
    discoveryCache.set(projectRoot, discoverWpPackages(projectRoot));
  }
  const discoveredPackages = discoveryCache.get(projectRoot);

  // Pre-compute which discovered packages are incompatible (pending set).
  // Keyed by pkgName; value is the data needed for context.report().
  const pendingIncompatible = new Map();
  for (const pkgName of discoveredPackages) {
    const installedVersion = getInstalledVersion(pkgName, fileDir);
    if (!installedVersion) continue;
    const requiredWp = getRequiredWpVersion(compatData, pkgName, installedVersion);
    if (!requiredWp) continue;
    if (compareVersions(requiredWp, minWp) > 0) {
      pendingIncompatible.set(pkgName, {
        installedVersion: stripPreRelease(installedVersion),
        requiredWp,
        minWp,
      });
    }
  }

  // Track packages reported via ImportDeclaration to avoid duplicates.
  const reportedViaImport = new Set();
  let programNode = null;
  // ── END NEW ────────────────────────────────────────────────────────────

  return {
    // NEW: capture Program node reference for later use
    Program(node) {
      programNode = node;
    },

    ImportDeclaration(node) {
      const source = node.source.value;
      if (!source || !source.startsWith('@wordpress/')) return;

      const installedVersion = getInstalledVersion(source, fileDir);
      if (!installedVersion) return;

      const requiredWp = getRequiredWpVersion(compatData, source, installedVersion);
      if (!requiredWp) return;

      if (compareVersions(requiredWp, minWp) > 0) {
        // Mark as handled so Program:exit doesn't double-report
        reportedViaImport.add(source);
        // Remove from pending (if present) — import-site wins
        pendingIncompatible.delete(source);

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
      } else {
        // Compatible import — still remove from pending to avoid false Program report
        pendingIncompatible.delete(source);
      }
    },

    // NEW: report remaining discovered-but-not-imported incompatible packages
    'Program:exit'() {
      for (const [pkgName, data] of pendingIncompatible) {
        if (reportedViaImport.has(pkgName)) continue; // defensive check
        context.report({
          node: programNode,
          messageId: 'incompatibleInstalled',
          data: { pkgName, ...data },
        });
      }
    },
  };
},
```

**Key invariants preserved**:

- All existing valid/invalid behaviour is unchanged for the `ImportDeclaration` path.
- `pendingIncompatible.delete(source)` is called even when the import is
  _compatible_, preventing a stale Program-node warning if the installed version
  changed between `create()` and `ImportDeclaration` handling.

---

## Step 4 — Add discovery test cases to the rule test file

**File**: `packages/eslint-plugin/tests/no-incompatible-version.test.js`

In `beforeAll`, write a `package.json` into `fixtureDir`:

```js
// packages.json in fixtureDir for discovery tests
fs.writeFileSync(
    path.join(fixtureDir, 'package.json'),
    JSON.stringify({
        dependencies: { '@wordpress/components': '^28.0.0' },
        devDependencies: { '@wordpress/block-editor': '^11.0.0' },
    }),
);
```

Add to the `valid` array:

```js
// Discovered package (@wordpress/block-editor 11.0.0 requires 6.5) — minWp meets requirement
// No warning even though block-editor is in package.json
{
  code: "const x = 1;",  // no imports at all
  options: [{ requiresAtLeast: '6.5', dataPath }],
  filename: path.join(fixtureDir, 'test-file.js'),
},
```

Add to the `invalid` array:

```js
// Discovered package (@wordpress/components 28.0.0 requires 6.8) NOT imported in this file
// → reported on Program node with incompatibleInstalled messageId
{
  code: "const x = 1;",
  options: [{ requiresAtLeast: '6.5', dataPath }],
  filename: path.join(fixtureDir, 'test-file.js'),
  errors: [{ messageId: 'incompatibleInstalled' }],
},

// Same discovered incompatible package IS imported in this file
// → exactly ONE error on the ImportDeclaration node (incompatible), NOT on Program
{
  code: "import { ProgressBar } from '@wordpress/components';",
  options: [{ requiresAtLeast: '6.5', dataPath }],
  filename: path.join(fixtureDir, 'test-file.js'),
  errors: [{ messageId: 'incompatible' }],
},
```

Run the full test suite:

```bash
npm test
```

All pre-existing tests must still pass (SC-005).

---

## Step 5 — Update agent context

```bash
# From repo root
bash .specify/scripts/bash/update-agent-context.sh copilot
```

---

## Verification Checklist

- [ ] `npm test` passes with zero failures
- [ ] New utility test covers all 8 scenarios in Step 2
- [ ] `incompatibleInstalled` messageId fires on `Program` node when package not imported
- [ ] `incompatible` messageId fires on `ImportDeclaration` node when package is imported
- [ ] No duplicate warnings (same package → at most one error per file)
- [ ] No warnings when `package.json` is absent (fallback to import-based detection)
- [ ] No warnings when `minWp` cannot be resolved (existing behaviour unchanged)
- [ ] `discoveryCache` populated exactly once per `projectRoot` across multiple files
