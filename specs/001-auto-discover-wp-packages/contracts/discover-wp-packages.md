# Contract: `discoverWpPackages` Utility

**Module**: `packages/eslint-plugin/src/utils/discover-wp-packages.js`  
**Branch**: `001-auto-discover-wp-packages` | **Date**: 2025-07-14

---

## Function Signature

```js
/**
 * Read the project's package.json and return all @wordpress/* package names
 * found in dependencies and devDependencies (deduplicated).
 *
 * @param {string} projectRoot - Absolute path to the directory containing package.json.
 * @returns {string[]} Deduplicated array of @wordpress/* package name strings.
 *                     Returns [] on any error condition; never throws.
 */
export function discoverWpPackages(projectRoot) { ... }
```

---

## Input Contract

| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| `projectRoot` | `string` | Yes | Should be an absolute path. Relative paths are accepted but the `package.json` search is anchored to it. |

---

## Output Contract

| Condition | Return Value | Side Effect |
|-----------|-------------|-------------|
| Happy path — `package.json` found and parseable with ≥1 `@wordpress/*` entries | `string[]` with those package names, deduplicated, no empty strings | None |
| `package.json` found, parseable, zero `@wordpress/*` entries | `[]` | None |
| `package.json` found, parseable, no `dependencies`/`devDependencies` keys | `[]` | None |
| `package.json` not found (`ENOENT`) | `[]` | None |
| `package.json` not readable (permissions error) | `[]` | None |
| `package.json` exists but contains invalid JSON | `[]` | `console.warn('[gutenberg-compat] Could not parse <path>: <message>')` |
| Same `@wordpress/*` package in both `dependencies` and `devDependencies` | Single entry in returned array | None |

**Guarantee**: The function **never throws** under any condition. All error paths
return `[]`.

---

## Behaviour Specification

### Algorithm

```
1. Construct pkgPath = path.join(projectRoot, 'package.json')
2. Try:
     content = fs.readFileSync(pkgPath, 'utf8')
     pkg = JSON.parse(content)
   Catch ENOENT:
     return []
   Catch SyntaxError or other:
     console.warn('[gutenberg-compat] Could not parse <pkgPath>: <err.message>')
     return []
3. deps    = Object.keys(pkg.dependencies    || {})
4. devDeps = Object.keys(pkg.devDependencies || {})
5. all     = [...new Set([...deps, ...devDeps])]
6. return all.filter(name => name.startsWith('@wordpress/'))
```

### Deduplication

Uses `Set` construction in step 5. A package listed in both `dependencies` and
`devDependencies` appears exactly once in the output (FR-002, SC-003).

### No version information

The function reads only the **keys** of `dependencies` / `devDependencies`. The
values (version range strings) are intentionally discarded. Installed version
resolution is the responsibility of `getInstalledVersion()` in the rule.

---

## Usage in `no-incompatible-version.js`

```js
// Module-level cache — populated at most once per project root per process
const discoveryCache = new Map();

// Inside create(context):
const projectRoot =
  (context.getCwd && context.getCwd()) ||
  context.cwd ||
  path.dirname(filename);

if (!discoveryCache.has(projectRoot)) {
  discoveryCache.set(projectRoot, discoverWpPackages(projectRoot));
}
const discoveredPackages = discoveryCache.get(projectRoot);
```

---

## New Rule `messageId`

```js
// Added to rule.meta.messages:
incompatibleInstalled:
  "'{{pkgName}}' version {{installedVersion}} requires WordPress {{requiredWp}}, " +
  "but your plugin declares a minimum of WordPress {{minWp}}. " +
  "Either upgrade your minimum WP version or downgrade the package. " +
  "(Detected from package.json)"
```

This messageId is used when reporting on the `Program` node for packages discovered
in `package.json` that are not imported in the current file.

The existing `incompatible` messageId (used for `ImportDeclaration` reports) is
**unchanged** (FR-009).

---

## Non-Goals

- This utility does **not** resolve package versions from `package.json` version
  range strings (e.g., `"^28.0.0"`). Version resolution uses `node_modules`.
- This utility does **not** walk up the directory tree looking for a parent
  `package.json`. It reads exactly one file at `path.join(projectRoot, 'package.json')`.
- This utility does **not** scan `peerDependencies` or `optionalDependencies`.
  Only `dependencies` and `devDependencies` are in scope (spec FR-001).
- Monorepo workspace-level aggregation is explicitly out of scope.

---

## Export

The module exports a single named export:

```js
export { discoverWpPackages };
```

No default export. The module is internal and not re-exported from
`packages/eslint-plugin/src/index.js`.
