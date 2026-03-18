import { describe, it, beforeEach, afterEach } from 'vitest';
import { RuleTester } from 'eslint';
import noIncompatibleVersion from '../../src/rules/no-incompatible-version.js';
import { clearDiscoverCache } from '../../src/utils/discover-wp-packages.js';
import { compatData } from '../helpers/compat-data.js';
import { writePluginHeader } from '../helpers/fixture-utils.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let discoveryDir;
let discoveryDataPath;

beforeEach(() => {
  discoveryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-disc-rule-test-'));
  clearDiscoverCache();

  // Write compat-data.json
  discoveryDataPath = path.join(discoveryDir, 'compat-data.json');
  fs.writeFileSync(discoveryDataPath, JSON.stringify(compatData));

  // Create node_modules for @wordpress/components (version 28.0.0, requires WP 6.8)
  const componentsDir = path.join(discoveryDir, 'node_modules', '@wordpress', 'components');
  fs.mkdirSync(componentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(componentsDir, 'package.json'),
    JSON.stringify({ name: '@wordpress/components', version: '28.0.0' }),
  );

  // Create node_modules for @wordpress/block-editor (version 11.0.0, requires WP 6.5)
  const beDir = path.join(discoveryDir, 'node_modules', '@wordpress', 'block-editor');
  fs.mkdirSync(beDir, { recursive: true });
  fs.writeFileSync(
    path.join(beDir, 'package.json'),
    JSON.stringify({ name: '@wordpress/block-editor', version: '11.0.0' }),
  );

  // Create the fake source file
  fs.writeFileSync(path.join(discoveryDir, 'test-file.js'), '');

  // Create plugin header with WP 6.5 by default (most tests use this)
  writePluginHeader(discoveryDir, '6.5');
});

afterEach(() => {
  fs.rmSync(discoveryDir, { recursive: true, force: true });
  clearDiscoverCache();
});

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('gutenberg-compat/no-incompatible-version — auto-discovery', () => {
  // US1: package in dependencies (not imported) → incompatibleInstalled on Program node
  it('US1: reports incompatibleInstalled for package in dependencies not imported in file', () => {
    fs.writeFileSync(
      path.join(discoveryDir, 'package.json'),
      JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0' } }),
    );

    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: 'const x = 1;',
          options: [{ dataPath: discoveryDataPath }],
          filename: path.join(discoveryDir, 'test-file.js'),
          errors: [{ messageId: 'incompatibleInstalled' }],
        },
      ],
    });
  });

  // US1: requirement met → no errors
  it('US1: no error when installed package meets requirement', () => {
    fs.writeFileSync(
      path.join(discoveryDir, 'package.json'),
      JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0' } }),
    );
    writePluginHeader(discoveryDir, '6.8');

    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [
        {
          code: 'const x = 1;',
          options: [{ dataPath: discoveryDataPath }],
          filename: path.join(discoveryDir, 'test-file.js'),
        },
      ],
      invalid: [],
    });
  });

  // US1: dedup — package both in package.json AND imported → only incompatible on ImportDeclaration
  it('US1: when package is also imported, reports incompatible on ImportDeclaration only (no duplicate)', () => {
    fs.writeFileSync(
      path.join(discoveryDir, 'package.json'),
      JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0' } }),
    );

    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath: discoveryDataPath }],
          filename: path.join(discoveryDir, 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
      ],
    });
  });

  // US2: package in devDependencies (not imported) → incompatibleInstalled
  it('US2: reports incompatibleInstalled for package in devDependencies not imported in file', () => {
    fs.writeFileSync(
      path.join(discoveryDir, 'package.json'),
      JSON.stringify({ devDependencies: { '@wordpress/components': '^28.0.0' } }),
    );

    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: 'const x = 1;',
          options: [{ dataPath: discoveryDataPath }],
          filename: path.join(discoveryDir, 'test-file.js'),
          errors: [{ messageId: 'incompatibleInstalled' }],
        },
      ],
    });
  });

  // US2: package in both deps and devDeps, also imported → exactly one incompatible error
  it('US2: package in both deps and devDeps and imported → single incompatible error, no incompatibleInstalled', () => {
    fs.writeFileSync(
      path.join(discoveryDir, 'package.json'),
      JSON.stringify({
        dependencies: { '@wordpress/components': '^28.0.0' },
        devDependencies: { '@wordpress/components': '^28.0.0' },
      }),
    );

    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: "import { Button } from '@wordpress/components';",
          options: [{ dataPath: discoveryDataPath }],
          filename: path.join(discoveryDir, 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
      ],
    });
  });

  // US3: no package.json → cannot determine project root → missingMinWp
  it('US3: no package.json in fixture dir — reports missingMinWp', () => {
    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: "import { BlockControls } from '@wordpress/block-editor';",
          options: [{ dataPath: discoveryDataPath }],
          filename: path.join(discoveryDir, 'test-file.js'),
          errors: [{ messageId: 'missingMinWp' }],
        },
      ],
    });
  });

  // US3: malformed package.json → project root found (file exists), plugin header provides version
  it('US3: malformed package.json — import-based detection still works with plugin header', () => {
    fs.writeFileSync(path.join(discoveryDir, 'package.json'), '{ invalid json');
    writePluginHeader(discoveryDir, '6.4');

    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: "import { BlockControls } from '@wordpress/block-editor';",
          options: [{ dataPath: discoveryDataPath }],
          filename: path.join(discoveryDir, 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
      ],
    });
  });

  // US3: empty package.json ({}) → plugin header provides version, import-based still works
  it('US3: empty package.json {} — import-based detection still works with plugin header', () => {
    fs.writeFileSync(path.join(discoveryDir, 'package.json'), '{}');
    writePluginHeader(discoveryDir, '6.4');

    tester.run('no-incompatible-version', noIncompatibleVersion, {
      valid: [],
      invalid: [
        {
          code: "import { BlockControls } from '@wordpress/block-editor';",
          options: [{ dataPath: discoveryDataPath }],
          filename: path.join(discoveryDir, 'test-file.js'),
          errors: [{ messageId: 'incompatible' }],
        },
      ],
    });
  });
});
