# Research: Auto-Discover WordPress Packages (001)

**Branch**: `001-auto-discover-wp-packages` | **Date**: 2025-07-14  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## R-01 — ESLint context API: obtaining the project root

**Decision**: Use `context.getCwd()` (ESLint 8) with fallback to `context.cwd`
(ESLint 9) and final fallback to `path.dirname(filename)`.

**Rationale**: ESLint 8 exposes `context.getCwd()` as a callable method; ESLint 9
flat-config renames it to a plain property (`context.cwd`). The existing rule already
guards ESLint 8/9 differences for filename resolution
(`context.filename || context.getFilename()`), so the same dual-API guard is idiomatic.
The filesystem-walk fallback mirrors `findWpVersionFromPackageJson` already in the rule.

**Alternatives considered**:
- `process.cwd()` — rejected; ESLint can be run from a directory other than the
  project root, especially in monorepos and certain CI environments.
- Requiring user configuration (e.g., `projectRoot` option) — rejected; violates
  Zero-Config Defaults (constitution Principle II).

**Sources**: ESLint 8 API docs (`context.getCwd`); ESLint 9 migration guide (flat
config, `context.cwd`); existing rule code in `no-incompatible-version.js`.

---

## R-02 — Cache strategy: module-level Map

**Decision**: Module-level `Map<string, string[]>` keyed by absolute project root
path, populated at most once per project root per process lifetime.

**Rationale**: The existing `compatDataCache` (also module-level) sets the precedent
within this codebase. Module-level caches survive across multiple `create()` calls
(one per file) within the same ESLint lint run, satisfying FR-006. The `Map` key is
the absolute project root so multiple roots (e.g., nested packages linted together)
are handled correctly.

**Alternatives considered**:
- `WeakMap` — unsuitable; keys must be objects, not strings.
- Per-file cache (inside `create()`) — satisfies FR-006 for single-file runs but
  would re-read `package.json` for every file in a multi-file run. Rejected.
- `context.settings` shared object — ESLint settings are user-facing; inappropriate
  for internal plugin state.

---

## R-03 — Reporting node for non-import proactive warnings

**Decision**: Report on the `Program` node with a new `messageId`
(`incompatibleInstalled`) at `Program:exit` for packages that were discovered in
`package.json` but not imported in the current file.

**Rationale**: `context.report()` requires an AST node from the current file. The
`Program` node is universally present and is the conventional target for file-level
warnings in the ESLint ecosystem. A distinct `messageId` helps users and tooling
(e.g., `// eslint-disable`) distinguish this proactive diagnostic from the import-site
diagnostic.

**Alternatives considered**:
- Report on the first `ImportDeclaration` — confusing; the problematic package is
  not the one being imported.
- Suppress for files with no imports — violates FR-007 ("regardless of whether that
  package has been encountered as an import in the current file").
- Emit a `console.warn` instead of `context.report()` — not surfaced in ESLint
  output; not actionable via `eslint-disable`.

---

## R-04 — Deduplication: discovered + imported in the same file

**Decision**: Report on the `ImportDeclaration` node (most specific) when a
discovered-incompatible package is also imported in the current file. Track reported
packages in a `Set` within the `create()` closure; `Program:exit` skips packages
in that set.

**Rationale**: Reporting on the import line is better DX than the program line.
Prevents duplicate warnings for the same package in the same file, satisfying SC-003.

**Alternatives considered**:
- Always use `Program` for discovered packages — worse DX; loses import-site context.
- Report both nodes — violates SC-003 (zero duplicates).

---

## R-05 — Testing `context.getCwd()` in RuleTester

**Decision**: Test the utility in isolation (`discover-wp-packages.test.js`). For
rule-level discovery tests, write a `package.json` fixture into the temp `fixtureDir`
used by `beforeAll`; the fallback to `path.dirname(filename)` ensures the rule finds
it when `filename` is set to a path inside `fixtureDir`.

**Rationale**: `RuleTester` in ESLint 8/9 does not mock `context.getCwd()` by
default. The fallback chain (`getCwd → cwd → dirname(filename)`) ensures tests work
without needing to stub ESLint internals.

**Alternatives considered**:
- Monkey-patching `context.getCwd` in the test — fragile; depends on RuleTester
  internals that differ between ESLint 8 and 9.
- Adding a `projectRoot` rule option purely for tests — adds unnecessary public API
  surface.

---

## R-06 — Node.js `fs` sync vs. async

**Decision**: Use synchronous `fs.readFileSync` (consistent with all existing
filesystem calls in the rule).

**Rationale**: ESLint rules execute synchronously; the rule visitor callbacks are not
async. All existing filesystem calls in `no-incompatible-version.js`
(`findWpVersionFromPackageJson`, `findWpVersionFromPluginHeader`, `getInstalledVersion`)
use sync `fs` APIs. Introducing an async utility would require significant refactoring
of the rule's `create()` function and is inconsistent with the established pattern.
The cost is acceptable because the read is guarded by the module-level cache (one read
per project root per process).

**Alternatives considered**:
- `fs.readFileSync` with a try/catch per the error contract — chosen.
- `fs.promises.readFile` — requires making `create()` async, incompatible with
  ESLint's synchronous rule API.

---

## R-07 — `@wordpress/` prefix filtering

**Decision**: Use `String.prototype.startsWith('@wordpress/')` to identify
WordPress packages in the dependency lists.

**Rationale**: All WordPress core JavaScript packages follow the `@wordpress/`
npm scope convention. This is the same check the rule already uses in
`ImportDeclaration` (`source.startsWith('@wordpress/')`).

**Alternatives considered**:
- Regex `/^@wordpress\//` — equivalent; `startsWith` is more readable.
- Checking against a known allowlist — overly restrictive; new `@wordpress/*`
  packages would require updating the allowlist.

---

## Summary of Decisions

| ID | Decision |
|----|----------|
| R-01 | `context.getCwd()` (ESLint 8) → `context.cwd` (ESLint 9) → `dirname(filename)` |
| R-02 | Module-level `Map` cache keyed by absolute project root |
| R-03 | `Program` node + `incompatibleInstalled` messageId for non-import proactive warnings |
| R-04 | `ImportDeclaration` takes precedence; `Program:exit` skips already-reported packages |
| R-05 | Utility tested in isolation; rule tests use `filename`-in-fixtureDir fallback |
| R-06 | Synchronous `fs.readFileSync` (consistent with rest of rule) |
| R-07 | `startsWith('@wordpress/')` filter |
