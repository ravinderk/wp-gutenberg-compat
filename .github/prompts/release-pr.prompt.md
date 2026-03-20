---
name: release-pr
description: 'Create a release PR from develop to master. Bumps version, updates CHANGELOG.md with a new entry and tag link, commits, pushes, and opens the PR on GitHub.'
mode: agent
---

Create a release pull request for this project from `develop` to `master`.

## Inputs

The target version is: **${input:version:New version number (e.g. 0.4.0)}**

> **IMPORTANT:** If the version above is empty or was not provided, stop immediately and ask the user:
> "What version should this release be? (e.g. 0.4.0)"
> Do not proceed with any steps until a valid semver version is confirmed.

## Steps to perform

1. **Bump the version** in `package.json` to `${input:version}`.

2. **Update `CHANGELOG.md`**:
    - Add a new `## [${input:version}] - YYYY-MM-DD` section at the top (use today's date).
    - Populate it by summarising the commits in `develop` that are not yet in `master`. Run:
        ```
        git log master..develop --oneline
        ```
    - Group entries under `### Added`, `### Changed`, and/or `### Fixed` as appropriate.
    - Add a tag comparison link at the bottom of the file following the existing pattern:
        ```
        [${input:version}]: https://github.com/ravinderk/wp-gutenberg-compat/compare/<prev-version>...${input:version}
        ```

3. **Commit and push** both files to `develop`:

    ```
    git add package.json CHANGELOG.md
    git commit -m "chore(release): bump version to ${input:version}"
    git push origin develop
    ```

4. **Create the GitHub PR** from `develop` → `master`:
    - Title: `Release v${input:version}`
    - Body: mirror the new CHANGELOG section (Added / Changed / Fixed lists)
    - Assignee: `ravinderk`
    - Use `--head develop --base master` flags
    - After creation, attempt to add the `code review` label separately (ignore failure if label doesn't exist)

## Rules

- Follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
- Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
- Never commit directly to `master`.
- Use the git skill PR creation pattern: `gh pr create --head develop --base master ...`
