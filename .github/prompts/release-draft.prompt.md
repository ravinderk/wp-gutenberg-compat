---
name: release-draft
description: 'Create a GitHub draft release for a given project and version. Generates a project-scoped tag from the latest master, builds release notes from CHANGELOG.md, and publishes a draft release via the GitHub CLI.'
mode: agent
---

Create a GitHub draft release for the selected project.

## Inputs

- **Project:** ${input:project:Which project to release? (npm-packages | website)}
- **Version:** ${input:version:Release version number (e.g. 0.4.0)}

> **IMPORTANT — validate both inputs before proceeding:**
>
> 1. If **project** is empty or not one of `npm-packages` / `website`, stop and ask:
>    _"Which project should be released? (`npm-packages` or `website`)"_
> 2. If **version** is empty or not valid semver, stop and ask:
>    _"What version should this draft release be? (e.g. 0.4.0)"_

## Project reference

| Key               | `npm-packages`                   | `website`                                |
| ----------------- | -------------------------------- | ---------------------------------------- |
| **Path**          | `projects/npm-packages`          | `projects/website`                       |
| **Package name**  | `@ravi.nder/wp-gutenberg-compat` | `@ravi.nder/wp-gutenberg-compat-website` |
| **Has CHANGELOG** | Yes                              | Yes                                      |

Use the row matching the selected project for every path and name reference below. Substitute `<PROJECT_PATH>` and `<PACKAGE_NAME>` accordingly.

## Tag naming

Every release tag is project-scoped so it is clear which project the release belongs to:

```
<PROJECT>/v<VERSION>
```

Examples: `npm-packages/v0.5.0`, `website/v1.2.0`.

## Steps to perform

1. **Verify the version exists in `<PROJECT_PATH>/CHANGELOG.md`**:
    - Check that a `## [${input:version}]` section exists.
    - If it does not exist, stop and inform the user:
      "No CHANGELOG entry found for v${input:version}. Please update CHANGELOG.md before creating a draft release."

2. **Extract the release notes** for `${input:version}` from `<PROJECT_PATH>/CHANGELOG.md`:
    - Copy everything between `## [${input:version}]` and the next `## [` heading.
    - This will be used as the release body.

3. **Ensure the git tag exists** on `master`:
    - Check if tag `${input:project}/v${input:version}` already exists:
        ```
        git tag --list "${input:project}/v${input:version}"
        ```
    - If the tag does not exist, create and push it:
        ```
        git tag ${input:project}/v${input:version} master
        git push origin ${input:project}/v${input:version}
        ```
    - If the tag already exists, skip creation.

4. **Create the GitHub draft release** using the GitHub CLI:

    ```
    gh release create ${input:project}/v${input:version} \
      --title "v${input:version} — <PACKAGE_NAME>" \
      --notes "<release notes extracted from CHANGELOG.md>" \
      --draft \
      --target master
    ```

5. **Confirm success** by printing the URL of the newly created draft release.

## Rules

- Always create the release as a **draft** (`--draft` flag). Never publish it directly.
- Use the exact CHANGELOG section content as release notes — do not rewrite or summarise it.
- The tag must point to `master`.
- Always use the `<project>/v<version>` tag naming pattern (e.g. `npm-packages/v0.4.0`).
- Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — the version must be in `MAJOR.MINOR.PATCH` format.
- Do not modify any source files as part of this workflow.
- **The user must be on the `master` branch.** Before proceeding, run `git branch --show-current` and verify the output is `master`. If it is not, stop and inform the user: "You must switch to the `master` branch before creating a draft release. Run `git checkout master` and try again."
