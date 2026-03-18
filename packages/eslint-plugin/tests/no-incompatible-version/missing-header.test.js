import { describe, it, beforeAll } from 'vitest';
import { RuleTester } from 'eslint';
import noIncompatibleVersion from '../../src/rules/no-incompatible-version.js';
import { compatData } from '../helpers/compat-data.js';
import { createFixtureSubdir } from '../helpers/fixture-utils.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let fixtureDir;
let dataPath;

beforeAll(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-compat-missing-'));

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

  // no-header: no plugin file, no style.css
  createFixtureSubdir(fixtureDir, 'no-header');

  // plugin-no-version: plugin file without "Requires at least"
  const pnv = createFixtureSubdir(fixtureDir, 'plugin-no-version');
  const pnvName = path.basename(pnv);
  fs.writeFileSync(
    path.join(pnv, `${pnvName}.php`),
    '<?php\n/**\n * Plugin Name: Test Plugin\n */\n',
  );

  // theme-no-version: style.css without "Requires at least"
  const tnv = createFixtureSubdir(fixtureDir, 'theme-no-version');
  fs.writeFileSync(path.join(tnv, 'style.css'), '/*\nTheme Name: Test Theme\n*/\n');
});

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('wp-gutenberg-compat/no-incompatible-version — missing header', () => {
  it('reports missingMinWp when no plugin file or style.css exists', () => {
    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'no-header', 'test-file.js'),
          errors: [{ messageId: 'missingMinWp' }],
        },
      ],
    });
  });

  it('reports missingMinWpPlugin when plugin file has no Requires at least header', () => {
    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'plugin-no-version', 'test-file.js'),
          errors: [{ messageId: 'missingMinWpPlugin' }],
        },
      ],
    });
  });

  it('reports missingMinWpTheme when theme style.css has no Requires at least header', () => {
    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'theme-no-version', 'test-file.js'),
          errors: [{ messageId: 'missingMinWpTheme' }],
        },
      ],
    });
  });
});
