# wp-gutenberg-compat — Copilot Instructions

## Project Overview

A monorepo that detects and resolves version mismatches between `@wordpress/*` npm packages and the minimum WordPress version declared in plugin/theme headers. Provides four CLI commands: `analyze`, `install`, `info`, and `open`.

## Monorepo Layout

| Project      | Path                    | Package Name                             | Description              |
| ------------ | ----------------------- | ---------------------------------------- | ------------------------ |
| npm-packages | `projects/npm-packages` | `@ravi.nder/wp-gutenberg-compat`         | CLI tool & npm library   |
| website      | `projects/website`      | `@ravi.nder/wp-gutenberg-compat-website` | Astro documentation site |

Root `package.json` uses npm workspaces (`projects/*`). Never modify the root `package.json` version — each project has its own.

## Tech Stack

- **Runtime:** Node.js ≥ 18 (LTS)
- **npm-packages:** Pure JavaScript (CommonJS — `require`/`module.exports`)
- **website:** Astro 5 + Tailwind CSS 4 (ESM)
- **Testing:** Vitest 3
- **Linting:** ESLint 9 (flat config) + Prettier
- **Git hooks:** Husky + lint-staged
- **Dependencies:** semver for version comparison

## Commands

```bash
# Testing
npm run pkg:test          # Run Vitest for npm-packages
npm test                  # Same (from root)

# Linting & formatting
npm run lint              # ESLint across all projects
npm run format            # Prettier write
npm run format:check      # Prettier check only

# Website
npm run web:dev           # Astro dev server
npm run web:build         # Astro production build

# Data generation
npm run pkg:generate      # Regenerate compat-data.json
```

## Code Style

### Formatting (Prettier)

- 120 character line width
- 4 spaces indentation (no tabs)
- Single quotes
- Trailing commas (all)
- Semicolons required
- LF line endings

### JavaScript Conventions

- **npm-packages uses CommonJS** — always use `require()` and `module.exports`
- **website uses ESM** — use `import`/`export`
- camelCase for variables and functions
- PascalCase for classes and Astro components
- Descriptive function prefixes: `get*`, `build*`, `collect*`, `find*`
- Underscore prefix for private/internal properties: `_entries`, `_registry`
- No TypeScript in npm-packages — use JSDoc annotations for type hints
- `no-console` is off (CLI tool logs to stdout)
- `no-unused-vars` is a warning, not an error

### Architecture Patterns

- **Service container (DI):** `app.js` provides `createApp()` with `bind()`, `singleton()`, and `make()` methods
- **Factory functions:** Return plain objects rather than using classes
- **Graceful error handling:** Return empty arrays/null on file I/O failures; don't throw unless critical
- **Error prefixing:** Use `[wp-gutenberg-compat]` context prefix in error messages

## Testing

### Framework & Patterns

- Vitest with `describe`, `it`, `expect`, `beforeAll`, `beforeEach`
- Tests in `projects/npm-packages/tests/` mirroring `src/` structure
- Shared helpers in `tests/helpers/` — `fixture-utils.js` and `compat-data.js`

### Fixture Utilities

- `writePluginHeader()` — creates mock PHP plugin files
- `writeThemeHeader()` — creates mock `style.css` theme files
- `createFixtureSubdir()` — sets up temporary test directories
- `writePkg()` — writes mock `package.json` files
- Temp directories use `fs.mkdtempSync()`, cleaned with `fs.rmSync()`

### Writing Tests

- Place new tests in the folder matching the source file location
- Use the existing fixture utilities rather than creating ad-hoc test helpers
- Mock `console.log`/`console.error` when testing CLI output
- Always clean up temporary files in `afterAll` or `afterEach`

## Git Conventions

### Branches

- `master` — production-ready releases
- `develop` — active development (default branch)
- `release/<project>/v<version>` — release branches (e.g., `release/npm-packages/v0.4.0`)

### Rules

- Never commit directly to `master`
- All work happens on `develop` or feature branches
- PRs go from `develop` → `master` for releases
- Follow [Semantic Versioning](https://semver.org/)
- Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format

## Key Source Files

| File                        | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `src/cli.js`                | CLI entry point (`#!/usr/bin/env node`)        |
| `src/app.js`                | DI container (service registry)                |
| `src/analyze.js`            | Core analysis logic                            |
| `src/cli/commands/`         | Individual CLI command implementations         |
| `src/utils/`                | Pure utility functions                         |
| `src/services/reporter.js`  | Reporting service                              |
| `src/data/compat-data.json` | WordPress ↔ Gutenberg package version mappings |
| `scripts/generate.js`       | Script to regenerate compat-data.json          |

## Important Notes

- `compat-data.json` is auto-generated — do not edit manually; use `npm run pkg:generate`
- The website changelog page reads `projects/npm-packages/CHANGELOG.md` at build time
- Each project has its own `CHANGELOG.md` — update only the relevant one during releases
- When modifying CLI output, verify corresponding tests capture the expected format
