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

describe('wp-gutenberg-compat/no-incompatible-version — auto-discovery', () => {
    // US1: package in dependencies → incompatible on Program node
    it('US1: reports incompatible for package in dependencies', () => {
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
                    errors: [{ messageId: 'incompatible' }],
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

    // US2: package in devDependencies → incompatible
    it('US2: reports incompatible for package in devDependencies', () => {
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
                    errors: [{ messageId: 'incompatible' }],
                },
            ],
        });
    });

    // US2: package in both deps and devDeps → single incompatible error (deduplicated)
    it('US2: package in both deps and devDeps → single incompatible error', () => {
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
                    code: 'const x = 1;',
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
                    code: 'const x = 1;',
                    options: [{ dataPath: discoveryDataPath }],
                    filename: path.join(discoveryDir, 'test-file.js'),
                    errors: [{ messageId: 'missingMinWp' }],
                },
            ],
        });
    });

    // US3: malformed package.json → project root found (file exists), plugin header provides version,
    // but no packages discovered from malformed JSON
    it('US3: malformed package.json — no packages discovered, no errors beyond missingMinWp if header absent', () => {
        fs.writeFileSync(path.join(discoveryDir, 'package.json'), '{ invalid json');
        writePluginHeader(discoveryDir, '6.4');

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

    // US3: empty package.json ({}) → no @wordpress packages → no errors
    it('US3: empty package.json {} — no packages discovered, no errors', () => {
        fs.writeFileSync(path.join(discoveryDir, 'package.json'), '{}');
        writePluginHeader(discoveryDir, '6.4');

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
});
