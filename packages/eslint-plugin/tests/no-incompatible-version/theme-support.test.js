import { describe, it, beforeAll } from 'vitest';
import { RuleTester } from 'eslint';
import noIncompatibleVersion from '../../src/rules/no-incompatible-version.js';
import { compatData } from '../helpers/compat-data.js';
import { writeThemeHeader, createFixtureSubdir } from '../helpers/fixture-utils.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let fixtureDir;
let dataPath;

beforeAll(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-compat-theme-'));

  // Write compat-data.json
  dataPath = path.join(fixtureDir, 'compat-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(compatData));

  // Create shared node_modules
  const componentsDir = path.join(fixtureDir, 'node_modules', '@wordpress', 'components');
  fs.mkdirSync(componentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(componentsDir, 'package.json'),
    JSON.stringify({ name: '@wordpress/components', version: '28.0.0' }),
  );

  const beDir = path.join(fixtureDir, 'node_modules', '@wordpress', 'block-editor');
  fs.mkdirSync(beDir, { recursive: true });
  fs.writeFileSync(
    path.join(beDir, 'package.json'),
    JSON.stringify({ name: '@wordpress/block-editor', version: '11.0.0' }),
  );

  // theme65: min WP 6.5 (theme style.css)
  writeThemeHeader(createFixtureSubdir(fixtureDir, 'theme65'), '6.5');
});

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('gutenberg-compat/no-incompatible-version — theme support', () => {
  it('reads Requires at least from theme style.css', () => {
    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [
        // @wordpress/block-editor 11.0.0 requires WP 6.5 — matches theme minWp 6.5
        {
          code: "import { BlockControls } from '@wordpress/block-editor';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'theme65', 'test-file.js'),
        },
      ],
      invalid: [
        // @wordpress/components 28.0.0 requires WP 6.8, but theme minWp is 6.5
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'theme65', 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
      ],
    });
  });
});
