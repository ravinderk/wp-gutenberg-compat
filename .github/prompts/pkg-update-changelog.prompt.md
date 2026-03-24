---
name: pkg-update-changelog
description: 'Add a new entry to the npm-packages CHANGELOG.md and rebuild the website changelog page so both stay in sync.'
mode: agent
---

Add a new changelog entry to the npm-packages project and rebuild the website so the changelog page reflects the update.

## Inputs

- **Version:** ${input:version:Version for the new entry (e.g. 0.5.0)}
- **Changes:** ${input:changes:Describe the changes — prefix each line with Added, Changed, or Fixed}

> **IMPORTANT — validate inputs before proceeding:**
>
> 1. If **version** is empty or not valid semver (`MAJOR.MINOR.PATCH`), stop and ask:
>    _"What version should the changelog entry use? (e.g. 0.5.0)"_
> 2. If **changes** is empty, stop and ask:
>    _"Describe the changes to include in the changelog entry (prefix each with Added, Changed, or Fixed)."_

## Paths

| File                                         | Purpose                                    |
| -------------------------------------------- | ------------------------------------------ |
| `projects/npm-packages/CHANGELOG.md`         | Source changelog (Keep a Changelog)        |
| `projects/website/src/pages/changelog.astro` | Website page (reads CHANGELOG.md at build) |

## Steps to perform

### 1. Check for duplicate version

- Read `projects/npm-packages/CHANGELOG.md`.
- If a `## [${input:version}]` section already exists, stop and inform the user:
  _"Version ${input:version} already exists in the changelog. Please choose a different version or update the existing entry manually."_

### 2. Determine the previous version

- Find the first existing `## [x.y.z]` heading in `projects/npm-packages/CHANGELOG.md`.
- Store it as `<PREV_VERSION>` for the comparison link added later.

### 3. Add the new changelog section

- Insert a new section **after** the preamble and **before** the first existing version heading.
- Use today's date in `YYYY-MM-DD` format.
- Format:

    ```markdown
    ## [${input:version}] - YYYY-MM-DD

    ### Added

    - …

    ### Changed

    - …

    ### Fixed

    - …
    ```

    Only include the category sub-headings (`Added`, `Changed`, `Fixed`) that have entries based on the provided **changes** input.

- Append a tag comparison link at the bottom of the file following the existing pattern:

    ```markdown
    [${input:version}]: https://github.com/ravinderk/wp-gutenberg-compat/compare/npm-packages/v<PREV_VERSION>...npm-packages/v${input:version}
    ```

### 4. Rebuild the website

- Run from the repository root:

    ```bash
    npm run web:build
    ```

- Verify the build completes without errors.

### 5. Confirm the changelog page was generated

- Check that `projects/website/dist/changelog/index.html` exists.
- Verify the new version appears in the generated HTML.

### 6. Report the result

- Confirm the changelog entry was added.
- List the versions now included in the website changelog page.
- Confirm the website build succeeded.

## Rules

- Follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
- Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
- Do not modify `projects/website/src/pages/changelog.astro` unless the page has a bug that prevents rendering.
- Always run the website build from the repository root using `npm run web:build`.
- Always use project-scoped tags (`npm-packages/v<VERSION>`) in comparison links.
- Do not bump `projects/npm-packages/package.json` — version bumps happen in the release PR prompt.
