# wp-gutenberg-compat

[![CI](https://github.com/ravinderk/wp-gutenberg-compat/actions/workflows/tests.yml/badge.svg)](https://github.com/ravinderk/wp-gutenberg-compat/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Verify that `@wordpress/*` packages in your project are compatible with your plugin's minimum supported WordPress version.

## What is this?

WordPress ships a bundled version of Gutenberg, and each Gutenberg release includes specific versions of `@wordpress/*` npm packages. A developer building a plugin that declares **"Requires at least: 6.5"** may unknowingly use an API that only ships with WordPress 6.8. Their plugin will silently break on older installations.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
