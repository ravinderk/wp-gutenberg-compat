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
    // Each subdir gets a package.json listing the @wordpress deps
    const wp65 = createFixtureSubdir(fixtureDir, 'wp65');
    writePluginHeader(wp65, '6.5');
    fs.writeFileSync(
        path.join(wp65, 'package.json'),
        JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } }),
    );

    const wp67 = createFixtureSubdir(fixtureDir, 'wp67');
    writePluginHeader(wp67, '6.7');
    fs.writeFileSync(
        path.join(wp67, 'package.json'),
        JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } }),
    );

    const wp68 = createFixtureSubdir(fixtureDir, 'wp68');
    writePluginHeader(wp68, '6.8');
    fs.writeFileSync(
        path.join(wp68, 'package.json'),
        JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } }),
    );

    // Subdir with no @wordpress deps in package.json (for non-wp import test)
    const wp65NoDeps = createFixtureSubdir(fixtureDir, 'wp65-no-deps');
    writePluginHeader(wp65NoDeps, '6.5');
    fs.writeFileSync(path.join(wp65NoDeps, 'package.json'), JSON.stringify({}));
});

const tester = new RuleTester({
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('wp-gutenberg-compat/no-incompatible-version', () => {
    it('reports and passes expected cases', () => {
        tester.run('no-incompatible-version', noIncompatibleVersion, {
            valid: [
                // All deps compatible when minWp is 6.8
                {
                    code: 'const x = 1;',
                    options: [{ dataPath }],
                    filename: path.join(fixtureDir, 'wp68', 'test-file.js'),
                },
                // No @wordpress deps in package.json — nothing to check
                {
                    code: "import React from 'react';",
                    options: [{ dataPath }],
                    filename: path.join(fixtureDir, 'wp65-no-deps', 'test-file.js'),
                },
            ],

            invalid: [
                // @wordpress/components 28.0.0 requires WP 6.8, but minWp is 6.5
                // (block-editor 11.0.0 requires WP 6.5 — compatible, so only 1 error)
                {
                    code: 'const x = 1;',
                    options: [{ dataPath }],
                    filename: path.join(fixtureDir, 'wp65', 'test-file.js'),
                    errors: [{ messageId: 'incompatible' }],
                },
                // @wordpress/components 28.0.0 requires WP 6.8, but minWp is 6.7
                {
                    code: 'const x = 1;',
                    options: [{ dataPath }],
                    filename: path.join(fixtureDir, 'wp67', 'test-file.js'),
                    errors: [{ messageId: 'incompatible' }],
                },
            ],
        });
    });
});
