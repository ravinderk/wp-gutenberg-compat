# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-19

### Added

- `info` subcommand to display project metadata (name, version, WordPress minimum version, and tracked `@wordpress/*` packages).

### Changed

- Rewrote README usage section with `npx` and local install options.

---

## [0.1.1] - 2026-03-19

### Added

- Published package to npm as `@ravi.nder/wp-gutenberg-compat` with public access.
- GitHub Actions workflow for automated npm publishing via OIDC Trusted Publishing.
- ASCII table rendering for incompatible package issues in CLI output.
- `install` command with patch-range downgrade hints and limited output.

### Changed

- Renamed package to scoped name `@ravi.nder/wp-gutenberg-compat`.
- Replaced ESLint plugin architecture with a standalone CLI tool.
- Split CLI source into focused modules (`args`, `commands`, `output`, `table`, `usage`).
- Extracted shared `findProjectRoot` utility to eliminate duplication.
- Improved terminal output spacing and standardised line breaks around error messages.
- CI workflow now opens a PR instead of committing data updates directly.
- CI workflow always runs the force-refresh compat data step.
- Updated `ecmaVersion` to `latest` in ESLint config.
- Added Husky and lint-staged for pre-commit auto-formatting.
- Added Prettier and `.editorconfig` for consistent code style.

### Fixed

- Corrected `compat-data.json` path in CI workflow and generate script.
- Fixed CLI to limit `install` suggestions to the `analyze` command only.
- Fixed CLI to use patch ranges correctly for downgrade suggestions.
- Read plugin meta version dynamically from `package.json` instead of using a hardcoded value.
- Corrected repository URL in `package.json`.
- Deduplicated incompatible version errors per project in rule output.

---

## [0.1.0] - 2026-03-19

### Added

- Initial project setup as a CLI tool (`wp-gutenberg-compat`).
- `analyze` command to check `@wordpress/*` package compatibility against a plugin's minimum supported WordPress version.
- Auto-discovery of all `@wordpress/*` packages from the Gutenberg repository.
- Compatibility data generation script (`scripts/generate.js`) pulling from Gutenberg release data.
- Compat data auto-update CI workflow with `force_refresh` input option.
- GitHub Actions workflow to run the test suite on pull requests.
- Vitest test suite covering analysis, CLI output, and package discovery.
- ESLint flat config for code linting.
- npm keywords added to `package.json` for discoverability.

[0.2.0]: https://github.com/ravinderk/wp-gutenberg-compat/compare/0.1.1...0.2.0
