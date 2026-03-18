# wp-gutenberg-compat

[![CI](https://github.com/ravinderk/eslint-plugin-wp-gutenberg-compat/actions/workflows/tests.yml/badge.svg)](https://github.com/ravinderk/eslint-plugin-wp-gutenberg-compat/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Verify that `@wordpress/*` packages in your code are compatible with your plugin's minimum supported WordPress version.

## What is this?

WordPress ships a bundled version of Gutenberg, and each Gutenberg release includes specific versions of `@wordpress/*` npm packages. A developer building a plugin that declares **"Requires at least: 6.5"** may unknowingly use an API that only ships with WordPress 6.8. Their plugin will silently break on older installations.

**wp-gutenberg-compat** catches this at lint time.

```
src/edit.js
  12:1  error  '@wordpress/components' version 28.0.0 requires WordPress 6.8,
               but your plugin declares a minimum of WordPress 6.5.
               Either upgrade your minimum WP version or downgrade the package.
               [wp-gutenberg-compat/no-incompatible-version]
```

## Packages

| Package                                                       | Description                                    |
| ------------------------------------------------------------- | ---------------------------------------------- |
| [`eslint-plugin-wp-gutenberg-compat`](packages/eslint-plugin) | ESLint rule that warns on incompatible imports |

## Requirements

- Node.js >= 18
- ESLint >= 8.0.0

## Quick Start

```bash
npm install --save-dev eslint-plugin-wp-gutenberg-compat
```

### ESLint Flat Config (ESLint 9+)

```js
// eslint.config.js
const wpGutenbergCompat = require('eslint-plugin-wp-gutenberg-compat');

module.exports = [wpGutenbergCompat.configs.recommended];
```

If your project uses ESM (`"type": "module"` in `package.json`):

```js
// eslint.config.js
import wpGutenbergCompat from 'eslint-plugin-wp-gutenberg-compat';

export default [wpGutenbergCompat.configs.recommended];
```

### Legacy Config (ESLint 8)

```json
{
    "plugins": ["wp-gutenberg-compat"],
    "rules": {
        "wp-gutenberg-compat/no-incompatible-version": "error"
    }
}
```

### Version Detection

The plugin reads your minimum WordPress version from the `Requires at least` header in:

1. **Plugin PHP header** — `Requires at least: 6.5` in your main plugin file (`{plugin-dir}/{plugin-dir}.php`)
2. **Theme `style.css` header** — `Requires at least: 6.5` in your theme's `style.css`

If neither is found, the rule reports an error asking you to add the header.

## Rule Options

### `dataPath`

Path to a custom `compat-data.json` file. By default the plugin uses its bundled data.

```js
// eslint.config.js
const wpGutenbergCompat = require('eslint-plugin-wp-gutenberg-compat');

module.exports = [
    {
        plugins: { 'wp-gutenberg-compat': wpGutenbergCompat },
        rules: {
            'wp-gutenberg-compat/no-incompatible-version': [
                'error',
                { dataPath: './my-compat-data.json' },
            ],
        },
    },
];
```

## How It Works

1. The plugin discovers `@wordpress/*` packages from the nearest `package.json` (both `dependencies` and `devDependencies`)
2. It checks the **installed version** of each package from your `node_modules`
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

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
