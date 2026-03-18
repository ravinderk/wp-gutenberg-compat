---
feature: "001-auto-discover-wp-packages"
spec: "./spec.md"
plan: "./plan.md"
created: "2025-07-14"
---

# Tasks: Auto-Discover WordPress Packages (001)

**Input**: Design documents from `/specs/001-auto-discover-wp-packages/`  
**Source**: `plan.md` (tech stack, structure), `spec.md` (user stories P1–P3), `data-model.md` (entities), `contracts/discover-wp-packages.md` (interface contract), `quickstart.md` (implementation guide)

**Tech stack**: JavaScript (ESM), Node.js ≥ 18, Vitest 3.x, ESLint `RuleTester`  
**Target files**:
- `packages/eslint-plugin/src/utils/discover-wp-packages.js` ← **new**
- `packages/eslint-plugin/tests/discover-wp-packages.test.js` ← **new**
- `packages/eslint-plugin/src/rules/no-incompatible-version.js` ← **modified**
- `packages/eslint-plugin/tests/no-incompatible-version.test.js` ← **modified**

---

## Phase 1: Setup

**Purpose**: Confirm baseline health before any code changes.

- [ ] T001 Run `npm test --workspace packages/eslint-plugin` and confirm all existing tests pass (baseline for SC-005)

---

## Phase 2: Foundational — `discoverWpPackages` Utility

**Purpose**: Create the core utility that all user stories depend on. This phase MUST complete before any rule changes begin.

**⚠️ CRITICAL**: Phases 3–5 all import and invoke `discoverWpPackages`. Do not start them until T002–T003 are complete.

- [ ] T002 Create `packages/eslint-plugin/src/utils/discover-wp-packages.js` exporting `discoverWpPackages(projectRoot)` — reads `package.json` at `path.join(projectRoot, 'package.json')`, merges `dependencies` and `devDependencies` keys via `[...new Set([...deps, ...devDeps])]`, filters for names starting with `@wordpress/`, returns `[]` (never throws) on `ENOENT` or any other error; emits `console.warn('[wp-gutenberg-compat] Could not parse <path>: <message>')` only when the file exists but contains invalid JSON
- [ ] T003 [P] Create `packages/eslint-plugin/tests/discover-wp-packages.test.js` with Vitest scaffold: import `{ discoverWpPackages }` from `'../src/utils/discover-wp-packages.js'`, add `beforeEach`/`afterEach` helpers that write and clean up a temporary directory using `fs.mkdtempSync(path.join(os.tmpdir(), 'gb-disc-test-'))` for use as `projectRoot` in all test cases

**Checkpoint**: `discoverWpPackages` is importable and both files exist — rule modification can now begin.

---

## Phase 3: User Story 1 — Proactive Incompatibility Warnings on First Import (Priority: P1) 🎯 MVP

**Goal**: The `no-incompatible-version` rule reads `package.json` once per lint run and reports `incompatibleInstalled` warnings for every discovered `@wordpress/*` package whose WordPress version requirement exceeds the project's declared minimum — even when that package hasn't been imported in the current file. When a discovered package IS also imported, exactly one warning fires on the `ImportDeclaration` node (not on `Program`).

**Independent Test**: Create a temp project with a single JS file that imports `@wordpress/block-editor`, set `minWp` below the package's requirement, run ESLint — confirm a single `incompatible` error on the `ImportDeclaration` node. Then create a second JS file in the same project that does NOT import the package — confirm the `incompatibleInstalled` error fires on the `Program` node. Confirm no duplicate warnings.

### Tests for User Story 1

- [ ] T004 [P] [US1] Add US1 happy-path unit tests to `packages/eslint-plugin/tests/discover-wp-packages.test.js`:
  - valid `package.json` with `@wordpress/components` in `dependencies` only → returns `['@wordpress/components']`
  - valid `package.json` with both `@wordpress/components` and `react` in `dependencies` → returns only `['@wordpress/components']`
  - valid `package.json` with zero `@wordpress/*` entries → returns `[]`
  - valid `package.json` with empty `dependencies: {}` and no `devDependencies` key → returns `[]`

- [ ] T005 [P] [US1] Add US1 integration test cases to `packages/eslint-plugin/tests/no-incompatible-version.test.js`:
  - **Invalid**: write `package.json` with `@wordpress/components` in `dependencies` (installed version 28.0.0, requires WP 6.8) to `fixtureDir`; lint a file that does NOT import it; `filename` set to `path.join(fixtureDir, 'test-file.js')`; `requiresAtLeast: '6.5'` → expect one error with `messageId: 'incompatibleInstalled'` on the `Program` node, message mentions package name and required WP version
  - **Valid**: same setup but `requiresAtLeast: '6.8'` (requirement met) → no errors
  - **Invalid (dedup)**: same setup but the file ALSO imports `@wordpress/components` → expect exactly one error with `messageId: 'incompatible'` on the `ImportDeclaration` node, zero errors with `messageId: 'incompatibleInstalled'`

### Implementation for User Story 1

- [ ] T006 [US1] Add `incompatibleInstalled` to the `messages` object in rule `meta` in `packages/eslint-plugin/src/rules/no-incompatible-version.js`: `"'{{pkgName}}' version {{installedVersion}} requires WordPress {{requiredWp}}, but your plugin declares a minimum of WordPress {{minWp}}. Either upgrade your minimum WP version or downgrade the package. (Detected from package.json)"`
- [ ] T007 [US1] Add `import { discoverWpPackages } from '../utils/discover-wp-packages.js'` and declare module-level `const discoveryCache = new Map()` at the top of `packages/eslint-plugin/src/rules/no-incompatible-version.js` (place alongside the existing `let compatDataCache`)
- [ ] T008 [US1] Add `projectRoot` resolution at the top of `create()` in `packages/eslint-plugin/src/rules/no-incompatible-version.js` using the fallback chain: `const projectRoot = (context.getCwd && context.getCwd()) || context.cwd || fileDir`; then populate the discovery cache: `if (!discoveryCache.has(projectRoot)) { discoveryCache.set(projectRoot, discoverWpPackages(projectRoot)); }` and assign `const discoveredPackages = discoveryCache.get(projectRoot)`
- [ ] T009 [US1] Compute proactive incompatibilities once per `create()` call (not inside a handler) in `packages/eslint-plugin/src/rules/no-incompatible-version.js`: iterate `discoveredPackages`, call `getInstalledVersion` and `getRequiredWpVersion` for each, collect entries where `compareVersions(requiredWp, minWp) > 0` into a `Map` keyed by package name (`proactiveMap`); also declare `const reportedByImport = new Set()` in the same closure
- [ ] T010 [US1] Update the `return` value of `create()` in `packages/eslint-plugin/src/rules/no-incompatible-version.js` to include both the updated `ImportDeclaration` handler and a new `'Program:exit'` handler:
  - In `ImportDeclaration`: after calling `context.report(...)`, add `reportedByImport.add(source)` so the package is tracked as already warned
  - In `'Program:exit'(programNode)`: iterate `proactiveMap`; for each entry whose `pkgName` is NOT in `reportedByImport`, call `context.report({ node: programNode, messageId: 'incompatibleInstalled', data: { pkgName, installedVersion, requiredWp, minWp } })`

**Checkpoint**: US1 fully functional. Run `npm test --workspace packages/eslint-plugin` — all new T004/T005 cases should pass, and all pre-existing cases must still pass (SC-005).

---

## Phase 4: User Story 2 — Packages in devDependencies Are Also Checked (Priority: P2)

**Goal**: `discoverWpPackages` returns `@wordpress/*` packages from `devDependencies` as well as `dependencies`. A package listed in both sections appears exactly once in the result. The rule warns for devDep-only packages identically to dependency packages.

**Independent Test**: Create a `package.json` with a `@wordpress/*` package in `devDependencies` only (no `dependencies` key). Run `discoverWpPackages` — confirm the package is returned. Run ESLint on a file that doesn't import it — confirm `incompatibleInstalled` fires.

### Tests for User Story 2

- [ ] T011 [P] [US2] Add US2 unit tests to `packages/eslint-plugin/tests/discover-wp-packages.test.js`:
  - `package.json` with `@wordpress/scripts` in `devDependencies` only → returns `['@wordpress/scripts']`
  - `package.json` with `@wordpress/components` in both `dependencies` and `devDependencies` → returns array with exactly one `'@wordpress/components'` entry (length 1, no duplicate)
  - `package.json` with `@wordpress/components` in `dependencies` and `@wordpress/scripts` in `devDependencies` → returns both names (length 2)

- [ ] T012 [P] [US2] Add US2 integration test cases to `packages/eslint-plugin/tests/no-incompatible-version.test.js`:
  - **Invalid**: write `package.json` with `@wordpress/components` (28.0.0, requires WP 6.8) in `devDependencies` only; lint a file that does NOT import it; `requiresAtLeast: '6.5'` → one `incompatibleInstalled` error on `Program` node
  - **Valid (no duplicate)**: write `package.json` with `@wordpress/components` in both `dependencies` AND `devDependencies`; lint a file that imports it; `requiresAtLeast: '6.5'` → exactly one `incompatible` error on `ImportDeclaration`, zero `incompatibleInstalled` errors

**Checkpoint**: US2 fully functional. devDeps discovered and deduplicated correctly. Run `npm test --workspace packages/eslint-plugin`.

---

## Phase 5: User Story 3 — Graceful Handling of Missing or Malformed package.json (Priority: P3)

**Goal**: When `package.json` is absent, unreadable, contains invalid JSON, or has no `dependencies`/`devDependencies` keys, `discoverWpPackages` returns `[]` without throwing. The rule falls back to import-based checking only (existing `ImportDeclaration` handler), with zero unhandled exceptions. A clear `console.warn` is emitted for the JSON parse failure case.

**Independent Test**: Delete `package.json` from the fixture directory and run ESLint on a file that imports a `@wordpress/*` package with a known incompatibility — confirm the rule still fires an `incompatible` warning (import-based path) and the process does not crash.

### Tests for User Story 3

- [ ] T013 [P] [US3] Add US3 unit tests to `packages/eslint-plugin/tests/discover-wp-packages.test.js`:
  - directory with no `package.json` → returns `[]`, does not throw
  - `package.json` containing `{ invalid json` → returns `[]`, `console.warn` called exactly once with a message containing `'[wp-gutenberg-compat]'` and the file path
  - `package.json` with `{}` (no `dependencies` or `devDependencies` keys) → returns `[]`, no warning emitted
  - `package.json` with `{ "dependencies": {}, "devDependencies": {} }` → returns `[]`, no warning emitted
  - (spy on `console.warn` using Vitest's `vi.spyOn` in a `beforeEach`/`afterEach` to assert call counts)

- [ ] T014 [P] [US3] Add US3 integration test cases to `packages/eslint-plugin/tests/no-incompatible-version.test.js`:
  - **Valid (no crash, import still works)**: do NOT write any `package.json` to `fixtureDir`; lint a file that imports `@wordpress/block-editor` (installed 11.0.0, requires WP 6.5); `requiresAtLeast: '6.4'` → one `incompatible` error on `ImportDeclaration` (import-based detection still works), no unhandled error
  - **Valid (malformed, import still works)**: write `{ invalid` to `fixtureDir/package.json`; lint the same file with same options → same `incompatible` error on `ImportDeclaration`, no crash, no `incompatibleInstalled` error (discovery returned `[]`)
  - **Valid (no-keys, import still works)**: write `{}` to `fixtureDir/package.json`; lint same file → `incompatible` error on `ImportDeclaration`, no `incompatibleInstalled` error

**Checkpoint**: All three user stories fully functional with robust error handling. Run `npm test --workspace packages/eslint-plugin`.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Backward-compatibility validation, API boundary enforcement, and final verification.

- [ ] T015 Verify `packages/eslint-plugin/src/index.js` does NOT export `discoverWpPackages` — the utility is internal-only per spec Assumption 5; confirm the public API surface is unchanged (only `no-incompatible-version` rule exported)
- [ ] T016 [P] Run the full test suite (`npm test --workspace packages/eslint-plugin`) and confirm: (a) zero pre-existing test cases are modified or removed (SC-005), (b) all new test cases in `discover-wp-packages.test.js` and the extended `no-incompatible-version.test.js` pass, (c) no TypeScript/linting errors

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup               → No dependencies; start immediately
Phase 2: Foundational        → Depends on Phase 1 (T001 baseline)
Phase 3: US1                 → Depends on Phase 2 (T002, T003)
Phase 4: US2                 → Depends on Phase 2 (T002, T003); can run after Phase 3 or in parallel
Phase 5: US3                 → Depends on Phase 2 (T002, T003); can run after Phase 3 or in parallel
Final Phase: Polish          → Depends on Phases 3, 4, 5 all complete
```

### Within Phase 3 (US1) — strict order

```
T006 (add messageId) → T007 (import + cache) → T008 (projectRoot resolution) 
  → T009 (proactiveMap computation) → T010 (handlers)
```

Tests T004 and T005 can be written concurrently with implementation (TDD style: write first, see them fail, then implement).

### Parallel Opportunities Within Each Phase

```
Phase 2:  T003 can be written while T002 is being implemented (different files)
Phase 3:  T004 [P] and T005 [P] can be written in parallel with T006–T010 implementation
Phase 4:  T011 [P] and T012 [P] can be written in parallel with each other
Phase 5:  T013 [P] and T014 [P] can be written in parallel with each other
```

---

## Parallel Execution Example: US1 (Phase 3)

```bash
# Write tests first (TDD), can be parallelized with implementation:
Task A: "Add US1 unit tests to discover-wp-packages.test.js" (T004)
Task B: "Add US1 integration tests to no-incompatible-version.test.js" (T005)

# Implementation runs sequentially in order:
Task C: T006 → T007 → T008 → T009 → T010

# Validate:
npm test --workspace packages/eslint-plugin
```

---

## Implementation Strategy

### MVP (User Story 1 Only — Phases 1–3)

1. **Phase 1**: Confirm existing tests pass
2. **Phase 2**: Create `discover-wp-packages.js` utility + test scaffold (T002, T003)
3. **Phase 3**: Add `incompatibleInstalled` messageId, wire discovery into rule, add dedup handlers (T006–T010); write and pass US1 tests (T004, T005)
4. **STOP and VALIDATE**: `npm test` — all new + existing cases pass
5. MVP deliverable: Rule now proactively warns for packages in `dependencies` ✅

### Incremental Delivery

- After Phase 3 (US1 MVP): Core value delivered — proactive warnings from `package.json`
- After Phase 4 (US2): `devDependencies` also covered — broader safety net
- After Phase 5 (US3): Robust in hostile environments — no crashes on missing/broken `package.json`
- After Final Phase: Release-ready — SC-005 confirmed, public API surface unchanged

### Summary

| Phase | Tasks | New Files | Modified Files |
|-------|-------|-----------|----------------|
| 1: Setup | 1 | — | — |
| 2: Foundational | 2 | `src/utils/discover-wp-packages.js`, `tests/discover-wp-packages.test.js` | — |
| 3: US1 (P1 MVP) | 7 | — | `src/rules/no-incompatible-version.js`, `tests/no-incompatible-version.test.js` |
| 4: US2 (P2) | 2 | — | `tests/discover-wp-packages.test.js`, `tests/no-incompatible-version.test.js` |
| 5: US3 (P3) | 2 | — | `tests/discover-wp-packages.test.js`, `tests/no-incompatible-version.test.js` |
| Final: Polish | 2 | — | — |
| **Total** | **16** | **2** | **2** |

### Parallel Opportunities Identified

- T003 (test scaffold) ∥ T002 (utility implementation)
- T004 (US1 utility tests) ∥ T005 (US1 rule tests) ∥ T006–T010 (US1 implementation)
- T011 (US2 utility tests) ∥ T012 (US2 rule tests)
- T013 (US3 utility tests) ∥ T014 (US3 rule tests)

### Independent Test Criteria Per Story

| Story | Independent Test | Pass Signal |
|-------|-----------------|-------------|
| US1 | Lint a file importing incompatible `@wordpress/block-editor`; also lint a file that doesn't import it but the package is in `package.json` | `incompatible` on `ImportDeclaration`; `incompatibleInstalled` on `Program`; no duplicates |
| US2 | `package.json` with `@wordpress/scripts` in `devDependencies` only | `discoverWpPackages` returns the name; rule fires `incompatibleInstalled` for it |
| US3 | ESLint run against a project with no `package.json` | Process completes, import-based `incompatible` warning still fires, zero crashes |
