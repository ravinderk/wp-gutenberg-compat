import { describe, it, beforeAll } from 'vitest';
import { RuleTester } from 'eslint';
import noIncompatibleVersion from '../../src/rules/no-incompatible-version.js';
import { compatData } from '../helpers/compat-data.js';
import { writePluginHeader, createFixtureSubdir } from '../helpers/fixture-utils.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let fixtureDir;
let dataPath;

beforeAll(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-compat-basic-'));

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

  // Plugin subdirs with different "Requires at least" versions
  writePluginHeader(createFixtureSubdir(fixtureDir, 'wp65'), '6.5');
  writePluginHeader(createFixtureSubdir(fixtureDir, 'wp67'), '6.7');
  writePluginHeader(createFixtureSubdir(fixtureDir, 'wp68'), '6.8');
});

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('wp-gutenberg-compat/no-incompatible-version', () => {
  it('reports and passes expected cases', () => {
    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [
        // @wordpress/block-editor 11.0.0 requires WP 6.5 — matches minWp
        {
          code: "import { BlockControls } from '@wordpress/block-editor';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'wp65', 'test-file.js'),
        },
        // @wordpress/components 28.0.0 requires WP 6.8 — minWp is 6.8 → OK
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'wp68', 'test-file.js'),
        },
        // Non-@wordpress import — ignored
        {
          code: "import React from 'react';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'wp65', 'test-file.js'),
        },
      ],

      invalid: [
        // @wordpress/components 28.0.0 requires WP 6.8, but minWp is 6.5
        {
          code: "import { ProgressBar } from '@wordpress/components';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'wp65', 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
        // @wordpress/components 28.0.0 requires WP 6.8, but minWp is 6.7
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'wp67', 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
      ],
    });
  });
});
