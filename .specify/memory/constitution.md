<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0 (initial ratification)
  Modified principles: N/A (initial)
  Added sections:
    - Core Principles (5 principles)
    - Technology & Constraints
    - Development Workflow
    - Governance
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed
    - .specify/templates/spec-template.md ✅ no changes needed
    - .specify/templates/tasks-template.md ✅ no changes needed
  Follow-up TODOs: None
-->

# eslint-plugin-wp-gutenberg-compat Constitution

## Core Principles

### I. Accuracy-First (NON-NEGOTIABLE)

Compatibility data MUST be correct. Every mapping between a
`@wordpress/*` package API and the WordPress version that
introduced it MUST be verifiable against official sources
(WordPress changelogs, Gutenberg release notes, npm publish
metadata).

- False negatives (missing a version incompatibility) MUST be
  treated as high-severity bugs.
- False positives (warning on compatible usage) MUST be treated
  as medium-severity bugs.
- When version data is uncertain, the plugin MUST err on the
  side of warning (prefer false positive over false negative).
- Compatibility data MUST include a source citation or be
  derivable from an automated scraping/generation process.

### II. Zero-Config Defaults

The plugin MUST work out of the box with sensible defaults.
A developer adding the plugin to their ESLint config MUST get
useful warnings without additional configuration.

- A default minimum WordPress version MUST be defined (the
  current WordPress major minus one, or configurable).
- Rules MUST be auto-discoverable via ESLint's recommended
  config pattern (`plugin:wp-gutenberg-compat/recommended`).
- Configuration options (e.g., `minimumWPVersion`) MUST be
  optional overrides, never mandatory.
- Error messages MUST be actionable: state the API, the
  required WP version, and the user's configured minimum.

### III. Performance

ESLint rules execute on every file lint (save, CI, pre-commit).
The plugin MUST NOT degrade the developer experience.

- Rule execution MUST add no perceptible latency to a single
  file lint (target: <10ms per file on commodity hardware).
- Compatibility data MUST be loaded once and cached in memory
  for the duration of the lint run — no per-file I/O.
- Avoid synchronous network requests or filesystem scans
  during rule execution.
- Large data structures (version maps) MUST be lazy-loaded
  only when the relevant rule is active.

### IV. Test-Driven Development

Every rule and every compatibility mapping MUST have
corresponding tests.

- Each ESLint rule MUST have valid/invalid test cases using
  ESLint's `RuleTester`.
- Compatibility data additions MUST include at least one test
  case exercising the new mapping.
- Tests MUST run in CI on every pull request; merging with
  failing tests is prohibited.
- Edge cases (destructured imports, re-exports, aliased
  imports, dynamic usage) MUST be covered.

### V. Strict Semantic Versioning

This is a public npm package consumed by other developers'
build toolchains. Breaking changes MUST follow semver.

- MAJOR: Removing a rule, changing a rule's default severity,
  or altering behavior such that previously clean code now
  warns (when not due to new WP data).
- MINOR: Adding new rules, adding support for new
  `@wordpress/*` packages, expanding compatibility data for
  new WordPress releases.
- PATCH: Bug fixes, documentation updates, internal refactors
  with no behavioral change.
- Deprecation notices MUST precede removal by at least one
  minor release.

## Technology & Constraints

- **Runtime**: Node.js >= 18 (LTS track)
- **ESLint compatibility**: ESLint 8.x and 9.x (flat config)
- **Language**: JavaScript (ESM preferred); TypeScript allowed
  for internal tooling only
- **Package manager**: npm
- **Testing framework**: Vitest or Jest with ESLint `RuleTester`
- **Linting**: ESLint + Prettier for the plugin's own code
- **CI**: GitHub Actions
- **No runtime dependencies** beyond `eslint` peer dependency
  where possible; keep the dependency footprint minimal
- **Compatibility data format**: JSON files co-located in the
  package, version-controlled, machine-readable

## Development Workflow

- All changes MUST go through pull requests; direct pushes to
  `main` are prohibited.
- Every PR MUST pass: lint, tests, and (when applicable) a
  compatibility data validation script.
- Commit messages MUST follow Conventional Commits
  (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).
- Releases MUST be cut from `main` via a tagged release
  workflow (e.g., `npm version` + GitHub release).
- Compatibility data updates (new WP version support) SHOULD
  be isolated in dedicated PRs for easy review and rollback.

## Governance

This constitution supersedes all other project practices and
ad-hoc decisions. It defines the non-negotiable standards for
the eslint-plugin-wp-gutenberg-compat project.

- All PRs and code reviews MUST verify compliance with these
  principles.
- Amendments to this constitution require:
    1. A PR modifying `.specify/memory/constitution.md`.
    2. A version bump following semver (see versioning policy
       in Principle V, applied to this document).
    3. Updated `Last Amended` date.
- Complexity beyond what is described here MUST be justified
  in the relevant PR description.
- When in doubt, default to simplicity and correctness.

**Version**: 1.0.0 | **Ratified**: 2026-03-17 | **Last Amended**: 2026-03-17
