# Data Model: Auto-Discover WordPress Packages (001)

**Branch**: `001-auto-discover-wp-packages` | **Date**: 2025-07-14

---

## Entities

### 1. `DiscoveryResult` (value object)

The output of `discoverWpPackages(projectRoot)`.

| Field | Type | Constraints |
|-------|------|-------------|
| `packages` | `string[]` | Each element starts with `@wordpress/`; no duplicates; length ≥ 0 |

**Notes**:
- Version strings are intentionally excluded. The utility is concerned only with
  *which* WordPress packages are present, not *which versions* are installed. Version
  resolution is already handled by `getInstalledVersion()` in the rule.
- Order is not guaranteed and must not be relied upon by callers.
- The empty array `[]` is the canonical "nothing found / error" value; the function
  never returns `null` or `undefined`.

---

### 2. `DiscoveryCache` (module-level singleton, internal)

Lives in `packages/eslint-plugin/src/rules/no-incompatible-version.js`.

| Key | Type | Value Type | Description |
|-----|------|-----------|-------------|
| `projectRoot` | `string` (absolute path) | `string[]` | Cached `DiscoveryResult.packages` for that root |

**Invariants**:
- Keyed by the absolute, normalised path returned by `context.getCwd()` / `context.cwd`
  / `path.dirname(filename)`.
- Written once per key per process lifetime; never mutated after first write.
- Safe to read from multiple `create()` invocations (different files in the same run)
  concurrently because ESLint rule processing is synchronous.

---

### 3. `ProactiveIncompatibility` (ephemeral, per-file)

Computed inside `create()` for each file that is linted. Not persisted.

| Field | Type | Source |
|-------|------|--------|
| `pkgName` | `string` | From `DiscoveryResult.packages` |
| `installedVersion` | `string` | `getInstalledVersion(pkgName, fileDir)` (pre-release stripped) |
| `requiredWp` | `string` | `getRequiredWpVersion(compatData, pkgName, installedVersion)` |
| `minWp` | `string` | Resolved from rule options / `package.json` / PHP header |

**State machine**:

```
[computed]  →  [pending]  →  [reported-on-import]
                          ↘  [reported-on-program]
```

- **pending**: Computed in `create()` body after resolving `minWp` and
  `discoveredPackages`. A package enters this state when
  `compareVersions(requiredWp, minWp) > 0`.
- **reported-on-import**: The `ImportDeclaration` handler fires for this package.
  The handler reports on the `ImportDeclaration` node and removes the package from
  the pending set.
- **reported-on-program**: `Program:exit` fires. Any package still in the pending
  set is reported on the `Program` node with `messageId: 'incompatibleInstalled'`.

**Invariant**: A package moves to exactly one of `reported-on-import` or
`reported-on-program` at most once per file (guarantees SC-003: zero duplicates).

---

## Validation Rules

| Rule | Entity | Condition |
|------|--------|-----------|
| V-01 | `DiscoveryResult` | All package names must start with `@wordpress/` |
| V-02 | `DiscoveryResult` | No duplicate package names (enforced by `Set` during construction) |
| V-03 | `DiscoveryCache` | Keys must be absolute paths (enforced by `path.resolve`) |
| V-04 | `ProactiveIncompatibility` | Only created when `installedVersion` is non-null AND `requiredWp` is non-null AND `compareVersions(requiredWp, minWp) > 0` |

---

## Relationships

```
package.json (filesystem)
    │
    │  read once per projectRoot
    ▼
discoverWpPackages(projectRoot)
    │  returns
    ▼
DiscoveryResult.packages[]
    │
    │  cached in
    ▼
DiscoveryCache (Map)
    │
    │  consumed per file in create()
    ▼
ProactiveIncompatibility[] (pending set)
    │
    ├──► ImportDeclaration node   ← reported here if package is imported
    │
    └──► Program node             ← reported here if package is NOT imported
```
