---
name: update-website-changelog
description: 'Rebuild the website changelog page after npm-packages CHANGELOG.md has been updated. Verifies the changelog has new entries, rebuilds the site, and optionally commits the result.'
mode: agent
---

Update the website changelog page to reflect the latest npm-packages release.

## Context

The website changelog page (`projects/website/src/pages/changelog.astro`) reads and parses `projects/npm-packages/CHANGELOG.md` at build time. After the npm package changelog is updated with a new release, the website must be rebuilt so the changelog page includes the latest entries.

## Steps to perform

1. **Verify the npm-packages CHANGELOG has content**:
    - Read `projects/npm-packages/CHANGELOG.md`.
    - Confirm it contains at least one `## [x.y.z]` version section.
    - If empty or malformed, stop and inform the user.

2. **Rebuild the website**:
    - Run from the repository root:
        ```
        npm run web:build
        ```
    - Verify the build completes without errors.

3. **Confirm the changelog page was generated**:
    - Check that `projects/website/dist/changelog/index.html` exists.

4. **Report the result**:
    - List the versions now included in the changelog page.
    - Confirm the build succeeded.

## Rules

- Do not modify `projects/npm-packages/CHANGELOG.md` — it should already be up to date before running this prompt.
- Do not modify `projects/website/src/pages/changelog.astro` unless the page has a bug that prevents rendering.
- Always run the build from the repository root using `npm run web:build`.
