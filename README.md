# wp-gutenberg-compat

Monorepo for the **wp-gutenberg-compat** project — a tool that detects mismatches between your declared minimum WordPress version and the `@wordpress/*` npm packages you're actually coding against.

## Projects

| Project                               | Path                    | Description             |
| ------------------------------------- | ----------------------- | ----------------------- |
| [NPM Package](projects/npm-packages/) | `projects/npm-packages` | CLI tool & npm package  |
| [Website](projects/website/)          | `projects/website`      | Project website (Astro) |

## Getting Started

```sh
npm install
```

## Scripts

| Command                | Description                    |
| ---------------------- | ------------------------------ |
| `npm run pkg:test`     | Run package tests (Vitest)     |
| `npm run pkg:lint`     | Lint the npm package           |
| `npm run pkg:generate` | Generate compatibility data    |
| `npm run web:dev`      | Start the website dev server   |
| `npm run web:build`    | Build the website              |
| `npm run lint`         | Lint the entire monorepo       |
| `npm run format`       | Format all files with Prettier |
| `npm run format:check` | Check formatting               |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/ravinderk/wp-gutenberg-compat).

## License

MIT
