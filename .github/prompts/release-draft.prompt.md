---
name: release-draft
description: 'Create a GitHub draft release for a given version. Generates a tag from the latest master, builds release notes from CHANGELOG.md, and publishes a draft release via the GitHub CLI.'
mode: agent
---

Create a GitHub draft release for this project.

## Inputs

The release version is: **${input:version:Release version number (e.g. 0.4.0)}**

> **IMPORTANT:** If the version above is empty or was not provided, stop immediately and ask the user:
> "What version should this draft release be? (e.g. 0.4.0)"
> Do not proceed with any steps until a valid semver version is confirmed.

## Steps to perform

1. **Verify the version exists in `CHANGELOG.md`**:
    - Check that a `## [${input:version}]` section exists.
    - If it does not exist, stop and inform the user:
      "No CHANGELOG entry found for v${input:version}. Please update CHANGELOG.md before creating a draft release."

2. **Extract the release notes** for `${input:version}` from `CHANGELOG.md`:
    - Copy everything between `## [${input:version}]` and the next `## [` heading.
    - This will be used as the release body.

3. **Ensure the git tag exists** on `master`:
    - Check if tag `${input:version}` already exists:
        ```
        git tag --list "${input:version}"
        ```
    - If the tag does not exist, create and push it:
        ```
        git tag ${input:version} master
        git push origin ${input:version}
        ```
    - If the tag already exists, skip creation.

4. **Create the GitHub draft release** using the GitHub CLI:

    ```
    gh release create ${input:version} \
      --title "v${input:version}" \
      --notes "<release notes extracted from CHANGELOG.md>" \
      --draft \
      --target master
    ```

5. **Confirm success** by printing the URL of the newly created draft release.

## Rules

- Always create the release as a **draft** (`--draft` flag). Never publish it directly.
- Use the exact CHANGELOG section content as release notes — do not rewrite or summarise it.
- The tag must point to `master`.
- Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — the version must be in `MAJOR.MINOR.PATCH` format.
- Do not modify any source files as part of this workflow.
- **The user must be on the `master` branch.** Before proceeding, run `git branch --show-current` and verify the output is `master`. If it is not, stop and inform the user: "You must switch to the `master` branch before creating a draft release. Run `git checkout master` and try again."
