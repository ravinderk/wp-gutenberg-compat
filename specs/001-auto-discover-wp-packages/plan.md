# Implementation Plan: Auto-Discover WordPress Packages

**Branch**: `001-auto-discover-wp-packages` | **Date**: 2025-07-14 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-auto-discover-wp-packages/spec.md`

## Summary

Add a `discoverWpPackages(projectRoot)` utility that reads `package.json` and returns
all `@wordpress/*` package names from `dependencies` and `devDependencies` (deduplicated,
no versions). Enhance the `no-incompatible-version` rule to call this utility once per
lint run (cached by project root), then report incompatibilities at `Program:enter` for
every discovered package — independently of whether that package appears as an import in
the file being linted. The existing `ImportDeclaration` handler is retained, narrowed to
packages **not** already covered by discovery, preserving full backwards compatibility
(FR-008, FR-009).

## Technical Context

**Language/Version**: JavaScript (ESM), Node.js ≥ 18 (LTS)  
**Primary Dependencies**: `eslint` (peer, ≥ 8.0.0); `@wp-gutenberg-compat/data` (internal workspace package)  
**Storage**: Filesystem only — `package.json` read via `node:fs`; no database  
**Testing**: Vitest 3.x + ESLint `RuleTester` (flat-config mode)  
**Target Platform**: Node.js developer workstation / CI (Linux, macOS, Windows)  
**Project Type**: ESLint plugin (npm library)  
**Performance Goals**: ≤ 10 ms overhead per file (constitution Principle III); `package.json` read at most once per lint run per project root (SC-002)  
**Constraints**: Zero new runtime dependencies (constitution Technology & Constraints); no network access; ESLint 8 + 9 flat-config compatibility  
**Scale/Scope**: Single `package.json` per project root; monorepo workspace-level discovery explicitly out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Accuracy-First** | ✅ PASS | Discovery adds no false positives: packages absent from compat data are silently skipped (spec Assumption 5). Malformed `package.json` falls back to empty list — no spurious warnings (FR-003, FR-004). |
| **II. Zero-Config Defaults** | ✅ PASS | Discovery is automatic; no new configuration options required. Existing `requiresAtLeast` / `dataPath` options unchanged (FR-009). `context.getCwd()` / `context.cwd` resolved transparently. |
| **III. Performance** | ✅ PASS | Module-level `Map` cache (keyed by project root) ensures `package.json` is read from disk exactly once per lint process invocation (SC-002, SC-004). `getInstalledVersion` is already called per package; no change to its call frequency. |
| **IV. Test-Driven Development** | ✅ PASS | New utility gets its own test file. Rule tests are expanded with discovery-specific valid/invalid cases. All existing tests must pass unmodified (SC-005). |
| **V. Strict Semantic Versioning** | ✅ PASS | Feature adds new proactive behaviour; no existing warnings are removed or changed. Classified as **MINOR** (new capability, backwards-compatible). Utility is internal; not part of public API. |

**Result**: All gates pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-auto-discover-wp-packages/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── discover-wp-packages.md
└── tasks.md             ← Phase 2 output (speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/eslint-plugin/
├── src/
│   ├── index.js                          (no change)
│   ├── rules/
│   │   └── no-incompatible-version.js    (modified — add discovery + cache)
│   └── utils/                            (new directory)
│       └── discover-wp-packages.js       (new file)
└── tests/
    ├── no-incompatible-version.test.js   (modified — add discovery test cases)
    └── discover-wp-packages.test.js      (new file)
```

**Structure Decision**: Single-package layout; new `utils/` sub-directory under `src/`
mirrors conventional ESLint plugin structure and isolates the utility from rule logic.

## Complexity Tracking

> No constitution violations detected — section intentionally omitted.

---

## Phase 0: Research

> All questions resolved from codebase inspection and ESLint documentation.
> Full findings consolidated in [`research.md`](./research.md).

### R-01 — ESLint context API: how to get project root

**Question**: How do we reliably obtain the project root (directory containing
`package.json`) from inside a rule's `create()` function across ESLint 8 and 9?

**Decision**: Use `context.getCwd()` (ESLint 8) with a fallback to `context.cwd`
(ESLint 9 flat config) and a final fallback to `path.dirname(filename)`.

**Rationale**: ESLint 8 exposes `context.getCwd()` as a method; ESLint 9 renamed it
to a property (`context.cwd`). The existing rule already guards against ESLint 8/9
differences for `filename` (`context.filename || context.getFilename()`), so the
same dual-API pattern is idiomatic and safe.

**Alternatives considered**:
- `process.cwd()` — rejected because ESLint can be invoked from a different working
  directory than the project root; this would produce wrong results in monorepos and
  certain CI setups.
- Walking up from `filename` — acceptable as the final fallback (mirrors what
  `findWpVersionFromPackageJson` already does) but less reliable as a primary
  strategy because symlinked or out-of-tree files could produce an incorrect root.

---

### R-02 — Cache lifetime: module-level Map vs. per-run context

**Question**: Should the discovery result cache be module-level (persists across
lint runs within the same Node process, e.g. `eslint --fix --watch`) or should it
be scoped to a single `Program` context?

**Decision**: Module-level `Map` keyed by **absolute project root path**, identical
to how `compatDataCache` already works in the rule. Reading `package.json` once per
project root per process lifetime is safe because `package.json` changes require a
new lint invocation.

**Rationale**: ESLint docs recommend module-level caches for data that is stable
across files in the same run. The existing `compatDataCache` (also module-level)
sets this precedent. FR-006 requires "once per lint run, not once per file"; a
`Map` keyed by resolved project root satisfies this without introducing new
ESLint-internal lifecycle hooks.

**Alternatives considered**:
- Shared context via `context.getScope()` / `context.settings` — too indirect; does
  not survive across separate `create()` invocations for different files.
- Invalidation on watch mode — out of scope; a process restart clears the module
  anyway.

---

### R-03 — Where to report proactive (non-import) warnings

**Question**: For packages that are in `package.json` but not imported in the
current file, which AST node should `context.report()` target?

**Decision**: Report on the `Program` node (the root of the AST) using a new
`messageId` (`incompatibleInstalled`) that makes clear the warning is
project-level, not tied to a specific import statement.

**Rationale**: ESLint requires every `context.report()` call to reference a valid
node in the current file's AST. The `Program` node is always present and is the
conventional target for file-level or project-level diagnostics (e.g., `no-var`
header warnings). A distinct `messageId` lets tooling and users distinguish
"you imported something incompatible" from "you have something incompatible
installed that this file doesn't use".

**Alternatives considered**:
- Report on the first `ImportDeclaration` of the file — ambiguous; the warning
  would appear on a different import than the problematic one.
- Suppress warnings for files that don't import the package — violates FR-007
  ("regardless of whether that package has been encountered as an import in the
  current file").

---

### R-04 — Deduplication: discovered vs. imported packages

**Question**: If a package is both discovered in `package.json` AND imported in
the current file, should we report once or twice?

**Decision**: Report exactly once, on the `ImportDeclaration` node (most precise
location). When the `ImportDeclaration` handler fires for a discovered package,
it takes ownership of reporting; the `Program:exit` handler skips that package.
This is tracked via a `Set` of package names already reported during
`ImportDeclaration` processing.

**Rationale**: SC-003 requires zero duplicate warnings. Reporting on the more
specific node (the import statement) is better DX than the Program node. The
`ImportDeclaration` handler therefore runs its existing logic for ALL
`@wordpress/*` imports (discovered or not); the `Program:exit` handler covers
only the remainder.

**Alternatives considered**:
- Always report on `Program` for discovered packages, suppress `ImportDeclaration`
  for those packages — loses import-site precision for discovered packages.
- Report both (Program + ImportDeclaration) — violates SC-003 (duplicates).

---

### R-05 — Handling `context.getCwd()` in RuleTester

**Question**: ESLint's `RuleTester` may not call `getCwd()` / expose `cwd` by
default. How do we test the discovery path in isolation?

**Decision**: The new utility is tested independently via
`discover-wp-packages.test.js`. Rule-level discovery tests pass `filename` pointing
to a temp fixture directory that contains a valid `package.json`; because
`context.getCwd()` in test contexts typically returns the process CWD, the fallback
chain (getCwd → cwd → dirname(filename)) will resolve to the fixture directory when
the `filename` is set correctly. An additional fallback: if neither getCwd nor cwd
resolves to a directory containing `package.json`, the rule falls back to walking up
from `path.dirname(filename)` — same as the existing `findWpVersionFromPackageJson`
walk.

**Alternatives considered**:
- Mocking `context.getCwd()` — RuleTester does not expose easy hooks for this;
  the fixture-directory approach is simpler and tests the real code path.


---

## Phase 1: Design & Contracts

### Data Model

> Full entity definitions in [`data-model.md`](./data-model.md).

#### Entity: `DiscoveryResult`

Returned by `discoverWpPackages(projectRoot)`.

| Field | Type | Description |
|-------|------|-------------|
| `packages` | `string[]` | Deduplicated `@wordpress/*` package names found in `dependencies` ∪ `devDependencies`. No version strings — names only. |

**Invariants**:
- Every element begins with `@wordpress/`
- No duplicates (Set-based deduplication before return)
- Empty array `[]` is the valid "nothing found / error" value — never `null` / `undefined`

#### Entity: `DiscoveryCache`

Module-level singleton in `no-incompatible-version.js`.

| Field | Type | Description |
|-------|------|-------------|
| _(key)_ | `string` | Absolute project root path |
| _(value)_ | `string[]` | Cached `DiscoveryResult.packages` array |

**Invariants**:
- Populated at most once per unique project root per process lifetime
- Never mutated after first write (treat as immutable once set)

#### Entity: `ProactiveIncompatibility`

Computed per `create()` invocation (per file) from `DiscoveryCache`.

| Field | Type | Description |
|-------|------|-------------|
| `pkgName` | `string` | `@wordpress/*` package name |
| `installedVersion` | `string` | Resolved from `node_modules` (pre-release stripped) |
| `requiredWp` | `string` | WP version from compat data |
| `minWp` | `string` | Declared minimum WP version for this project |

**State transition**: A `ProactiveIncompatibility` starts as "pending" when
computed in `Program:enter`. If the same `pkgName` is encountered in an
`ImportDeclaration` node, it moves to "reported-on-import" and is removed from
the pending set. At `Program:exit`, all remaining pending items are reported on
the `Program` node.

---

### Interface Contracts

> Full contract definition in [`contracts/discover-wp-packages.md`](./contracts/discover-wp-packages.md).

#### `discoverWpPackages(projectRoot: string): string[]`

```
Input:  projectRoot — absolute filesystem path to the directory that
                      should contain package.json.
Output: Deduplicated array of @wordpress/* package name strings.
        Returns [] on any error (missing file, parse failure, no @wordpress entries).
Side-effects:
        Emits console.warn() if package.json exists but cannot be parsed (FR-004).
        Does NOT throw under any condition.
```

**Error contract**:

| Condition | Behaviour |
|-----------|-----------|
| `package.json` not found (`ENOENT`) | Return `[]` silently |
| `package.json` unreadable (permissions) | Return `[]` silently |
| `package.json` invalid JSON | `console.warn(...)` then return `[]` |
| No `dependencies` / `devDependencies` keys | Return `[]` silently |
| Zero `@wordpress/*` entries | Return `[]` silently |

#### `no-incompatible-version` rule — enhanced `create()` contract

```
New messageIds added:
  incompatibleInstalled:
    "'{{pkgName}}' version {{installedVersion}} requires WordPress {{requiredWp}},
     but your plugin declares a minimum of WordPress {{minWp}}. Either upgrade your
     minimum WP version or downgrade the package. (Detected from package.json)"

Existing messageIds:
  incompatible  — UNCHANGED (reported on ImportDeclaration nodes)

Reporting nodes:
  ImportDeclaration  — packages imported in this file (discovered or undiscovered)
  Program            — discovered packages NOT imported in this file

Deduplication guarantee:
  Each package produces at most one warning per file, on the most specific node.
```

---

### Quickstart

> Full developer guide in [`quickstart.md`](./quickstart.md).

**Key implementation steps** (ordered by dependency):

1. **Create `packages/eslint-plugin/src/utils/discover-wp-packages.js`**
   - Export a single named function `discoverWpPackages(projectRoot)`
   - Use `node:fs` (sync read — acceptable because called once and cached)
   - Filter `Object.keys(deps)` for entries starting with `@wordpress/`
   - Deduplicate with `[...new Set([...deps, ...devDeps])]`

2. **Add `discover-wp-packages.test.js`**
   - Test: valid `package.json` with mixed wp/non-wp packages → correct list
   - Test: `package.json` with both `dependencies` and `devDependencies` containing
     the same package → single entry returned
   - Test: missing `package.json` → returns `[]`, no throw
   - Test: malformed JSON → returns `[]`, `console.warn` called
   - Test: `package.json` with no `dependencies`/`devDependencies` → returns `[]`
   - Test: `package.json` with zero `@wordpress/*` packages → returns `[]`

3. **Modify `no-incompatible-version.js`**
   - Import `discoverWpPackages` at the top of the module
   - Add module-level `const discoveryCache = new Map()`
   - In `create()`, determine `projectRoot`:
     ```js
     const projectRoot =
       (context.getCwd && context.getCwd()) ||
       context.cwd ||
       fileDir;
     ```
   - Call `discoverWpPackages` with cache:
     ```js
     if (!discoveryCache.has(projectRoot)) {
       discoveryCache.set(projectRoot, discoverWpPackages(projectRoot));
     }
     const discoveredPackages = discoveryCache.get(projectRoot);
     ```
   - Compute proactive incompatibilities set in `create()` body (not in a handler)
     so it runs once per file
   - Track import-reported packages in a `Set` local to the `create()` closure
   - Update `ImportDeclaration` handler: run existing logic; on report, add to
     the "reported" set
   - Add `Program:exit` handler: for each proactive incompatibility whose
     `pkgName` is NOT in the "reported" set, call `context.report()` on the
     `programNode` with `messageId: 'incompatibleInstalled'`

4. **Add discovery-related test cases to `no-incompatible-version.test.js`**
   - Add fixture `package.json` to `fixtureDir` in `beforeAll`
   - Valid case: discovered package whose WP requirement is met → no Program warning
   - Invalid case: discovered package whose WP requirement exceeds `minWp` but NOT
     imported in file → error on `Program` node with `incompatibleInstalled`
   - Invalid case: discovered package whose WP requirement exceeds `minWp` AND IS
     imported in file → exactly ONE error on `ImportDeclaration` node with
     `incompatible` (not on `Program`)
   - Valid case: `package.json` absent (no file in fixture) → rule falls back to
     import-based detection; no crash

---

### Constitution Check (Post-Design)

| Principle | Post-Design Status | Notes |
|-----------|-------------------|-------|
| **I. Accuracy-First** | ✅ PASS | No change to compat data lookups. Proactive check uses same `getRequiredWpVersion` + `compareVersions` logic. Empty discovery list = zero new warnings. |
| **II. Zero-Config** | ✅ PASS | `projectRoot` resolved automatically; no new options added to rule schema. |
| **III. Performance** | ✅ PASS | `discoverWpPackages` reads one file synchronously, called once per project root per process. Proactive incompatibility set computed once per `create()` call (not per node visit). |
| **IV. TDD** | ✅ PASS | Utility has dedicated test file. Rule tests extended. SC-005 (existing tests unchanged) verified by keeping all existing test cases intact. |
| **V. Semver** | ✅ PASS | Additive change. New `incompatibleInstalled` messageId added; `incompatible` messageId unchanged. Classified as MINOR. |

