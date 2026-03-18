# Feature Specification: Auto-Discover WordPress Packages

**Feature Branch**: `001-auto-discover-wp-packages`
**Created**: 2025-07-14
**Status**: Draft
**Input**: User description: "Automatically discover all @wordpress/* packages installed in the project by scanning package.json dependencies (rather than only checking them when encountered as an import). Add a utility function discoverWpPackages(projectRoot) that reads the project's package.json and returns a list of all @wordpress/* package names found in dependencies and devDependencies. Enhance the no-incompatible-version rule to use this utility so it can proactively warn about packages even if they appear for the first time in a file."

## Overview

The `no-incompatible-version` rule currently only evaluates a `@wordpress/*` package when it is explicitly encountered as an import statement in the file being linted. This means a developer can miss version-incompatibility warnings entirely if a package is installed but appears in only one file — specifically the first file that imports it. This feature adds upfront discovery of all installed `@wordpress/*` packages from the project's `package.json`, enabling the rule to warn proactively regardless of import order or file context.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Proactive Incompatibility Warnings on First Import (Priority: P1)

A developer adds `@wordpress/block-editor` to their WordPress plugin's `package.json` as a dependency. The package requires a higher WordPress version than the plugin's declared minimum. When the developer runs ESLint on any file that imports from `@wordpress/block-editor`, the `no-incompatible-version` rule immediately warns them — even if this is the very first time this package appears in the codebase.

**Why this priority**: This is the core value of the feature. Without upfront discovery the rule already warns on encounter, so P1 preserves and strengthens existing behavior by ensuring warnings are consistent from the first encounter onward, with no gap caused by initialization order.

**Independent Test**: Can be fully tested by creating a project with a single JavaScript file that imports a `@wordpress/*` package whose minimum WP version exceeds the declared minimum, running ESLint, and confirming the warning is present.

**Acceptance Scenarios**:

1. **Given** a project with `@wordpress/block-editor` in `dependencies` and a declared minimum WordPress version below its requirement, **When** ESLint lints a file that contains `import { InnerBlocks } from '@wordpress/block-editor'`, **Then** the `no-incompatible-version` rule produces a warning naming the package and the required WordPress version.
2. **Given** the same project, **When** ESLint lints a second file that also imports `@wordpress/block-editor`, **Then** the warning is produced again (consistent behavior across files).
3. **Given** a project where the declared minimum WordPress version meets all installed `@wordpress/*` package requirements, **When** ESLint runs, **Then** no warnings are produced.

---

### User Story 2 — Packages in devDependencies Are Also Checked (Priority: P2)

A developer installs `@wordpress/scripts` as a devDependency for their build toolchain. If this package requires a higher WordPress version than the plugin's declared minimum, they should be warned even though it is a dev-only dependency.

**Why this priority**: Dev tooling packages can indirectly reflect the runtime WordPress version targeted by the project. Omitting devDependencies would create a gap where incompatible packages go unchecked. P2 because it extends the P1 behavior to a broader set of packages rather than introducing a new capability.

**Independent Test**: Can be fully tested by placing a `@wordpress/*` package exclusively in `devDependencies`, running ESLint on a file that imports it, and confirming the warning is present.

**Acceptance Scenarios**:

1. **Given** a project with `@wordpress/scripts` in `devDependencies` only (not in `dependencies`), **When** ESLint lints a file importing it and the version requirement is not met, **Then** the `no-incompatible-version` rule produces a warning.
2. **Given** a project where the same package appears in both `dependencies` and `devDependencies`, **When** ESLint runs, **Then** exactly one warning is reported (no duplicates) per incompatible import.

---

### User Story 3 — Graceful Handling of Missing or Malformed package.json (Priority: P3)

A developer runs ESLint in an environment where no `package.json` is present (e.g., a standalone file editor) or where `package.json` is syntactically broken. The `no-incompatible-version` rule should still function — falling back to checking imports as they are encountered — without crashing ESLint or emitting confusing internal errors.

**Why this priority**: Robustness concern. The absence of a `package.json` should degrade gracefully to the pre-feature behavior rather than breaking the lint run. Lower priority because it is a failure path rather than the happy path.

**Independent Test**: Can be fully tested by running ESLint on a project directory that has no `package.json` and confirming that the lint run completes without unhandled exceptions, and that import-based warnings still work normally.

**Acceptance Scenarios**:

1. **Given** a project with no `package.json`, **When** ESLint runs the `no-incompatible-version` rule, **Then** the rule still evaluates imports as they are encountered and does not throw an unhandled error.
2. **Given** a project with a `package.json` that contains invalid JSON, **When** ESLint runs, **Then** the rule logs a clear, actionable warning (not a stack trace) and falls back to import-based checking.
3. **Given** a project with a `package.json` that has no `dependencies` or `devDependencies` keys, **When** ESLint runs, **Then** the rule functions normally with zero discovered packages and relies solely on import-based detection.

---

### Edge Cases

- What happens when a `@wordpress/*` package appears in both `dependencies` and `devDependencies`? → Deduplication must ensure only one entry is returned by the discovery utility.
- What happens when the project root cannot be determined (e.g., ESLint is run from an unexpected working directory)? → The rule falls back to the directory of the file being linted, then walks upward to find the nearest `package.json`.
- What happens in a monorepo where multiple `package.json` files exist? → The utility reads the closest `package.json` found by walking upward from the project root provided; workspace-level discovery is out of scope for this feature.
- What happens when `package.json` exists but lists zero `@wordpress/*` packages? → The utility returns an empty list; no warnings are produced from discovery alone.
- What happens when a `@wordpress/*` package is installed but has no compatibility data entry? → The rule's existing behavior for unknown packages applies (no false positive).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST provide a utility function `discoverWpPackages(projectRoot)` that accepts a filesystem path and returns the deduplicated list of all `@wordpress/*` package names found in that project's `package.json` `dependencies` and `devDependencies` combined.
- **FR-002**: `discoverWpPackages` MUST return a plain list of package name strings (e.g., `["@wordpress/block-editor", "@wordpress/scripts"]`) with no duplicates, in any order.
- **FR-003**: `discoverWpPackages` MUST handle a missing `package.json` by returning an empty list without throwing.
- **FR-004**: `discoverWpPackages` MUST handle a malformed (unparseable) `package.json` by returning an empty list and emitting a descriptive non-fatal warning to the calling context.
- **FR-005**: `discoverWpPackages` MUST handle a `package.json` that has no `dependencies` or `devDependencies` keys by returning an empty list.
- **FR-006**: The `no-incompatible-version` rule MUST invoke `discoverWpPackages` once per lint run (not once per file) and cache the result for the duration of that run to avoid repeated filesystem reads.
- **FR-007**: The `no-incompatible-version` rule MUST use the discovered package list to proactively flag any installed `@wordpress/*` package whose minimum WordPress version requirement exceeds the project's declared minimum, regardless of whether that package has been encountered as an import in the current file.
- **FR-008**: The rule MUST continue to evaluate individual import statements as before, ensuring that packages not present in `package.json` discovery (e.g., indirect imports) are still checked.
- **FR-009**: All existing `no-incompatible-version` rule behavior and configuration options MUST remain unchanged and backwards-compatible.

### Key Entities

- **Package Discovery Result**: The deduplicated, ordered list of `@wordpress/*` package name strings returned by `discoverWpPackages`. Derived entirely from `package.json`; contains no version range information — only package names.
- **Project Root**: The filesystem path passed to `discoverWpPackages` that anchors the search for `package.json`. Determined once per lint run by the rule, typically from ESLint's `cwd` or the location of the ESLint configuration file.
- **Discovered Package Cache**: An in-memory store keyed by project root, holding the Package Discovery Result for the duration of a single lint run. Prevents repeated `package.json` reads across files in the same project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `@wordpress/*` packages listed in a project's `package.json` (`dependencies` + `devDependencies`) that have a known incompatibility are flagged when any file in that project is linted — even if that file is the first to import the package.
- **SC-002**: `package.json` is read from disk at most once per ESLint lint run, regardless of how many files are linted in that run.
- **SC-003**: The rule produces zero duplicate warnings for a package that appears in both `dependencies` and `devDependencies`.
- **SC-004**: Linting a single file in a project with 50+ `@wordpress/*` packages in `package.json` completes within the existing performance budget (no perceptible added latency compared to pre-feature behavior after the first file).
- **SC-005**: All existing `no-incompatible-version` rule tests continue to pass without modification after the feature is implemented.
- **SC-006**: When `package.json` is absent or unparseable, the lint run completes successfully and import-based warnings are still produced normally.

## Assumptions

- The project root is resolvable from the ESLint execution context (e.g., `context.getCwd()` in ESLint 8/9) without requiring additional plugin configuration.
- The initial implementation targets a single `package.json` per project root; multi-workspace monorepo scenarios (scanning multiple `package.json` files) are explicitly out of scope for this feature.
- `devDependencies` are included in the discovery scan because WordPress plugin developers frequently import `@wordpress/*` packages that are declared as dev-only (e.g., block scripts, build tools).
- The utility is an internal module; it is not part of the plugin's public API and may change between minor versions without a major semver bump.
- Compatibility data for a discovered package that is not yet in the version map is treated identically to today: no warning is produced (no false positive), consistent with the Accuracy-First constitution principle.
