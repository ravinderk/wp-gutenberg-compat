# @ravi.nder/wp-gutenberg-compat

## What is this?

WordPress ships a bundled version of Gutenberg, and each Gutenberg release includes specific versions of `@wordpress/*` npm packages. Most developers test their blocks and plugins against the latest WordPress install — and `npm install` pulls in the **latest** `@wordpress/*` packages to match. Everything looks fine locally, but if you declare **"Requires at least: 6.5"** in your plugin header while coding against packages from WordPress 6.8, your plugin silently breaks on any site still running an older version.

A concrete example: you declare `Requires at least: 6.5`, but you're coding against `@wordpress/block-editor@14.x` (which ships with WordPress 6.8). Your editor happily autocompletes APIs that simply don't exist on 6.5 sites — and you won't find out until a real user reports a white screen.

This tool detects those mismatches by reading the minimum WordPress version from your plugin header or `style.css`, comparing your installed `@wordpress/*` package versions against the compatibility data, and recommending (or automatically installing) the correct downgraded versions. Once you install the suggested versions, your editor's IntelliSense will only surface APIs that actually exist in those versions — so the accidental bug never gets written in the first place. Think of it as a compile-time guardrail that enforces your minimum WP requirement right inside your IDE.

## How to use

### Option 1 — One-off with `npx` (no install required)

Good for a quick, one-time check without adding a dependency to your project. Always pass `@latest` so `npx` doesn't use a stale cached version:

```sh
npx @ravi.nder/wp-gutenberg-compat@latest analyze
npx @ravi.nder/wp-gutenberg-compat@latest install
npx @ravi.nder/wp-gutenberg-compat@latest info
npx @ravi.nder/wp-gutenberg-compat@latest info @wordpress/block-editor @wordpress/data
npx @ravi.nder/wp-gutenberg-compat@latest open @wordpress/block-editor
npx @ravi.nder/wp-gutenberg-compat@latest open @wordpress/block-editor --wp 6.5
```

### Option 2 — Install locally in your project (recommended for repeated use)

Better for CI pipelines and teams, since the version is pinned and there's no network fetch on every run.

1. Install as a dev dependency:

    ```sh
    npm install --save-dev @ravi.nder/wp-gutenberg-compat
    ```

2. Add scripts to your `package.json`:

    ```json
    {
        "scripts": {
            "info": "wp-gutenberg-compat info",
            "compat": "wp-gutenberg-compat analyze",
            "compat:fix": "wp-gutenberg-compat install",
            "open": "wp-gutenberg-compat open"
        }
    }
    ```

3. Run via npm:

    ```sh
    npm run info
    npm run info -- @wordpress/block-editor @wordpress/data
    npm run compat
    npm run compat:fix
    npm run open -- @wordpress/block-editor
    npm run open -- @wordpress/block-editor --wp 6.5
    ```

### Option 3 — Open an npm package page

Quickly open the npmjs.com page for any `@wordpress/*` package at the resolved version — either the locally installed version, or the version compatible with a specific WordPress release:

```sh
# Open the page for the locally installed version of @wordpress/block-editor
npx @ravi.nder/wp-gutenberg-compat@latest open @wordpress/block-editor

# Open the page for the version compatible with WordPress 6.5
npx @ravi.nder/wp-gutenberg-compat@latest open @wordpress/block-editor --wp 6.5
```

- If `--wp` is provided, the tool opens the version recommended for that WordPress release.
- Without `--wp`, it opens the locally installed version (falling back to the latest tracked version if not installed).

### Option 4 — Remote analysis (no clone needed)

Good for auditing a third-party plugin or any project you don't have checked out locally. Pass the raw URL of the target `package.json` together with the minimum WordPress version you want to check against:

```sh
npx @ravi.nder/wp-gutenberg-compat@latest analyze \
  --remote https://raw.githubusercontent.com/user/my-plugin/main/package.json \
  --wp 6.5
```

- No local clone, no `node_modules`, no lock file required.
- `--wp` is mandatory in remote mode (the tool cannot auto-detect the WordPress version from a remote source).
- The output lists any incompatible `@wordpress/*` packages and suggests the downgraded versions you should install in your own copy of the project.
- **The URL must be publicly accessible.** URLs behind authentication, private repositories, or VPNs will not work.
- **The URL must serve the raw file content (plain text/JSON), not an HTML page.** GitHub repository browser URLs (`github.com/.../blob/...`) return HTML and will not work — use the raw URL instead (`raw.githubusercontent.com/...`).

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/ravinderk/wp-gutenberg-compat).

## License

MIT
