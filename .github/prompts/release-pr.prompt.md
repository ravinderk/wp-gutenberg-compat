---
name: release-pr
description: 'Create a release PR from develop to master for a chosen project (npm-packages or website). Bumps version, updates CHANGELOG.md, commits, pushes, and opens the PR on GitHub.'
mode: agent
---

Create a release pull request from `develop` to `master` for the selected project.

> This is a monorepo with multiple releasable projects under `projects/`. Each release targets exactly one project.

## Inputs

- **Project:** ${input:project:Which project to release? (npm-packages | website)}
- **Version:** ${input:version:New version number (e.g. 0.5.0)}

> **IMPORTANT — validate both inputs before proceeding:**
>
> 1. If **project** is empty or not one of `npm-packages` / `website`, stop and ask:
>    _"Which project should be released? (`npm-packages` or `website`)"_
> 2. If **version** is empty or not valid semver, stop and ask:
>    _"What version should this release be? (e.g. 0.5.0)"_

## Project reference

| Key               | `npm-packages`                   | `website`                                |
| ----------------- | -------------------------------- | ---------------------------------------- |
| **Path**          | `projects/npm-packages`          | `projects/website`                       |
| **Package name**  | `@ravi.nder/wp-gutenberg-compat` | `@ravi.nder/wp-gutenberg-compat-website` |
| **Has CHANGELOG** | Yes                              | Yes                                      |

Use the row matching the selected project for every path and name reference below. Substitute `<PROJECT_PATH>` and `<PACKAGE_NAME>` accordingly.

## Steps to perform

1. **Bump the version** in `<PROJECT_PATH>/package.json` to `${input:version}`.

2. **Update `<PROJECT_PATH>/CHANGELOG.md`**:
    - Add a new `## [${input:version}] - YYYY-MM-DD` section at the top (use today's date).
    - Populate it by summarising the commits in `develop` that are not yet in `master`. Run:
        ```
        git log master..develop --oneline -- <PROJECT_PATH>
        ```
        This scopes the log to only commits that touched the selected project.
    - Group entries under `### Added`, `### Changed`, and/or `### Fixed` as appropriate.
    - Add a tag comparison link at the bottom of the file following the existing pattern:
        ```
        [${input:version}]: https://github.com/ravinderk/wp-gutenberg-compat/compare/<prev-version>...${input:version}
        ```

3. **Commit and push** the changes to `develop`:

    ```
    git add <PROJECT_PATH>/package.json <PROJECT_PATH>/CHANGELOG.md
    git commit -m "chore(release): bump <PACKAGE_NAME> to ${input:version}"
    git push origin develop
    ```

4. **Create the GitHub PR** from `develop` → `master`:
    - Title: `Release v${input:version} — <PACKAGE_NAME>`
    - Body: mirror the new CHANGELOG section (Added / Changed / Fixed lists)
    - Assignee: `ravinderk`
    - Use `--head develop --base master` flags
    - After creation, attempt to add the `code review` label separately (ignore failure if label doesn't exist)

## Rules

- Follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
- Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
- Never commit directly to `master`.
- Only modify files under the selected `<PROJECT_PATH>/` — do not touch the root `package.json` or other projects.
- Use the git skill PR creation pattern: `gh pr create --head develop --base master ...`
