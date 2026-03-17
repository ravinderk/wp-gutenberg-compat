import { describe, it, expect, beforeAll } from 'vitest';
import { RuleTester } from 'eslint';
import noIncompatibleVersion from '../src/rules/no-incompatible-version.js';

// ---------------------------------------------------------------------------
// We supply a minimal inline compat-data.json via the `dataPath` option,
// and mock the installed package version by pointing require resolution
// at a temp fixture. Instead, we override the rule internals by writing
// a small fixture set and using `dataPath`.
//
// For unit tests we bypass node_modules resolution by creating a tiny
// fixture directory structure.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let fixtureDir;
let dataPath;

beforeAll(() => {
  // Create a temp fixture directory that mimics node_modules
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-compat-test-'));

  // Write a fake compat-data.json
  const compatData = {
    generated: '2026-03-17T00:00:00Z',
    lastGutenbergTag: 'v21.9.0',
    wpGutenbergMap: {
      '6.9': '21.9',
      '6.8': '20.4',
      '6.7': '19.3',
      '6.6': '18.5',
      '6.5': '17.7',
      '6.4': '16.7',
    },
    packages: {
      '@wordpress/components': {
        '29.0.0': { gutenberg: '21.9', wordpress: '6.9' },
        '28.0.0': { gutenberg: '20.4', wordpress: '6.8' },
        '27.0.0': { gutenberg: '19.3', wordpress: '6.7' },
        '26.0.0': { gutenberg: '18.5', wordpress: '6.6' },
        '25.0.0': { gutenberg: '17.7', wordpress: '6.5' },
        '24.0.0': { gutenberg: '16.7', wordpress: '6.4' },
      },
      '@wordpress/block-editor': {
        '15.0.0': { gutenberg: '21.9', wordpress: '6.9' },
        '14.0.0': { gutenberg: '20.4', wordpress: '6.8' },
        '13.0.0': { gutenberg: '19.3', wordpress: '6.7' },
        '12.0.0': { gutenberg: '18.5', wordpress: '6.6' },
        '11.0.0': { gutenberg: '17.7', wordpress: '6.5' },
        '10.0.0': { gutenberg: '16.7', wordpress: '6.4' },
      },
    },
  };

  dataPath = path.join(fixtureDir, 'compat-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(compatData));

  // Create fake node_modules/@wordpress/components/package.json
  // with version 28.0.0 (requires WP 6.8)
  const componentsDir = path.join(fixtureDir, 'node_modules', '@wordpress', 'components');
  fs.mkdirSync(componentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(componentsDir, 'package.json'),
    JSON.stringify({ name: '@wordpress/components', version: '28.0.0' }),
  );

  // Create fake node_modules/@wordpress/block-editor/package.json
  // with version 11.0.0 (requires WP 6.5)
  const beDir = path.join(fixtureDir, 'node_modules', '@wordpress', 'block-editor');
  fs.mkdirSync(beDir, { recursive: true });
  fs.writeFileSync(
    path.join(beDir, 'package.json'),
    JSON.stringify({ name: '@wordpress/block-editor', version: '11.0.0' }),
  );

  // Create a fake source file path that the RuleTester will "lint"
  // We need this to be inside fixtureDir so require.resolve finds node_modules
  fs.writeFileSync(path.join(fixtureDir, 'test-file.js'), '');
});

// ---------------------------------------------------------------------------
// RuleTester setup
// ---------------------------------------------------------------------------

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('gutenberg-compat/no-incompatible-version', () => {
  it('reports and passes expected cases', () => {
    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [
        // @wordpress/block-editor 11.0.0 requires WP 6.5 — matches minWp
        {
          code: "import { BlockControls } from '@wordpress/block-editor';",
          options: [{ requiresAtLeast: '6.5', dataPath }],
          filename: path.join(fixtureDir, 'test-file.js'),
        },
        // @wordpress/components 28.0.0 requires WP 6.8 — minWp is 6.8 → OK
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ requiresAtLeast: '6.8', dataPath }],
          filename: path.join(fixtureDir, 'test-file.js'),
        },
        // Non-@wordpress import — ignored
        {
          code: "import React from 'react';",
          options: [{ requiresAtLeast: '6.5', dataPath }],
          filename: path.join(fixtureDir, 'test-file.js'),
        },
        // No requiresAtLeast configured at all — rule is silent
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath }],
          filename: path.join(fixtureDir, 'test-file.js'),
        },
      ],

      invalid: [
        // @wordpress/components 28.0.0 requires WP 6.8, but minWp is 6.5
        {
          code: "import { ProgressBar } from '@wordpress/components';",
          options: [{ requiresAtLeast: '6.5', dataPath }],
          filename: path.join(fixtureDir, 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
        // @wordpress/components 28.0.0 requires WP 6.8, but minWp is 6.7
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ requiresAtLeast: '6.7', dataPath }],
          filename: path.join(fixtureDir, 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
      ],
    });
  });
});
