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
            "compat": "wp-gutenberg-compat analyze",
            "compat:fix": "wp-gutenberg-compat install"
        }
    }
    ```

3. Run via npm:

    ```sh
    npm run compat
    npm run compat:fix
    ```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/ravinderk/wp-gutenberg-compat).

## License

MIT
