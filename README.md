# @ravi.nder/wp-gutenberg-compat

## What is this?

WordPress ships a bundled version of Gutenberg, and each Gutenberg release includes specific versions of `@wordpress/*` npm packages. A developer building a plugin that declares **"Requires at least: 6.5"** may unknowingly use an API that only ships with WordPress 6.8+, breaking the plugin on older installations.

This tool detects those mismatches by reading the minimum WordPress version from your plugin header or `style.css`, comparing your installed `@wordpress/*` package versions against the compatibility data, and recommending (or automatically installing) the correct downgraded versions.

## How to use

### Option 1 — One-off with `npx` (no install required)

Good for a quick, one-time check without adding a dependency to your project. Always pass `@latest` so `npx` doesn't use a stale cached version:

```sh
npx @ravi.nder/wp-gutenberg-compat@latest analyze
npx @ravi.nder/wp-gutenberg-compat@latest install
npx @ravi.nder/wp-gutenberg-compat@latest info
npx @ravi.nder/wp-gutenberg-compat@latest info @wordpress/block-editor @wordpress/data
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
            "compat:fix": "wp-gutenberg-compat install"
        }
    }
    ```

3. Run via npm:

    ```sh
    npm run info
    npm run info -- @wordpress/block-editor @wordpress/data
    npm run compat
    npm run compat:fix
    ```

### Option 3 — Remote analysis (no clone needed)

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
