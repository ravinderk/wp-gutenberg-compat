# gutenberg-compat

> Verify that `@wordpress/*` packages in your code are compatible with your plugin's minimum supported WordPress version.

## What is this?

WordPress ships a bundled version of Gutenberg, and each Gutenberg release includes specific versions of `@wordpress/*` npm packages. A developer building a plugin that declares **"Requires at least: 6.5"** may unknowingly use an API that only ships with WordPress 6.8. Their plugin will silently break on older installations.

**gutenberg-compat** catches this at lint time.

```
src/edit.js
  12:1  error  '@wordpress/components' version 28.0.0 requires WordPress 6.8,
               but your plugin declares a minimum of WordPress 6.5.
               Either upgrade your minimum WP version or downgrade the package.
               [gutenberg-compat/no-incompatible-version]
```

## Packages

| Package | Description |
| --- | --- |
| [`eslint-plugin-gutenberg-compat`](packages/eslint-plugin) | ESLint rule that warns on incompatible imports |

## Quick Start

```bash
npm install --save-dev eslint-plugin-gutenberg-compat
```

### ESLint Flat Config (ESLint 9+)

```js
// eslint.config.js
import gutenbergCompat from 'eslint-plugin-gutenberg-compat';

export default [
  gutenbergCompat.configs.recommended,
];
```

### Version Detection

The plugin reads your minimum WordPress version from the `Requires at least` header in:

1. **Plugin PHP header** — `Requires at least: 6.5` in your main plugin file (`{plugin-dir}/{plugin-dir}.php`)
2. **Theme `style.css` header** — `Requires at least: 6.5` in your theme's `style.css`

If neither is found, the rule reports an error asking you to add the header.

## How It Works

1. The plugin intercepts `import` statements for `@wordpress/*` packages
2. It reads the **installed version** of that package from your `node_modules`
3. It looks up which **WordPress version** is required for that package version using the compatibility data
4. If the required WP version is **higher** than your declared minimum → reports an error

## Data Generation

The compatibility data (`compat-data.json`) maps:

```
WordPress version → Gutenberg version → @wordpress/* package versions
```

A [GitHub Action](.github/workflows/generate-compat-data.yml) runs daily to check for new Gutenberg releases and automatically updates the data.

To run the scraper manually:

```bash
GITHUB_TOKEN=ghp_... node scripts/generate.js
```

## Tracked Packages

Every `@wordpress/*` package published in Gutenberg is tracked automatically — no configuration needed. The compatibility data is regenerated daily from the latest Gutenberg release, so new packages are picked up as soon as they ship.

## License

MIT
