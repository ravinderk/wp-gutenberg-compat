# wp-gutenberg-compat

[![CI](https://github.com/ravinderk/wp-gutenberg-compat/actions/workflows/tests.yml/badge.svg)](https://github.com/ravinderk/wp-gutenberg-compat/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Verify that `@wordpress/*` (Gutenberg) packages in your project are compatible with your plugin's minimum supported WordPress version.

## What is this?

This tool checks whether the `@wordpress/*` APIs your project uses are available in the Gutenberg version bundled with your minimum supported WordPress release.

WordPress ships a bundled version of Gutenberg, and each Gutenberg release includes specific versions of `@wordpress/*` npm packages. A developer building a plugin that declares **"Requires at least: 6.5"** may unknowingly use an API that only ships with WordPress 6.8, which can break the plugin on older installations.

## How to use

1. Open a terminal in your WordPress plugin directory.
2. Run `npx wp-gutenberg-compat analyze` to see the compatibility report.
3. Review the recommendations.
4. Run `npx wp-gutenberg-compat install` to automatically apply the compatible versions.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
