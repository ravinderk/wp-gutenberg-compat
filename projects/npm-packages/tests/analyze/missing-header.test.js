import { describe, it, expect, beforeAll } from 'vitest';
import { analyze } from '../../src/analyze.js';
import { compatData } from '../helpers/compat-data.js';
import { createFixtureSubdir } from '../helpers/fixture-utils.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let fixtureDir;
let dataPath;

beforeAll(() => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-compat-missing-'));

    dataPath = path.join(fixtureDir, 'compat-data.json');
    fs.writeFileSync(dataPath, JSON.stringify(compatData));

    const componentsDir = path.join(fixtureDir, 'node_modules', '@wordpress', 'components');
    fs.mkdirSync(componentsDir, { recursive: true });
    fs.writeFileSync(
        path.join(componentsDir, 'package.json'),
        JSON.stringify({ name: '@wordpress/components', version: '28.0.0' }),
    );

    // no-header: no plugin file, no style.css
    createFixtureSubdir(fixtureDir, 'no-header');

    // plugin-no-version: plugin PHP file exists but has no "Requires at least"
    const pnv = createFixtureSubdir(fixtureDir, 'plugin-no-version');
    const pnvName = path.basename(pnv);
    fs.writeFileSync(path.join(pnv, `${pnvName}.php`), '<?php\n/**\n * Plugin Name: Test Plugin\n */\n');

    // theme-no-version: style.css exists but has no "Requires at least"
    const tnv = createFixtureSubdir(fixtureDir, 'theme-no-version');
    fs.writeFileSync(path.join(tnv, 'style.css'), '/*\nTheme Name: Test Theme\n*/\n');
});

describe('analyze — missing header', () => {
    it('reports missing-min-wp (no projectType) when no plugin file or style.css exists', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'no-header'), dataPath });
        expect(issues).toHaveLength(1);
        expect(issues[0].type).toBe('missing-min-wp');
        expect(issues[0].projectType).toBeNull();
    });

    it('reports missing-min-wp with projectType plugin when PHP file has no Requires at least', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'plugin-no-version'), dataPath });
        expect(issues).toHaveLength(1);
        expect(issues[0].type).toBe('missing-min-wp');
        expect(issues[0].projectType).toBe('plugin');
        expect(issues[0].pluginFile).toMatch(/\.php$/);
    });

    it('reports missing-min-wp with projectType theme when style.css has no Requires at least', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'theme-no-version'), dataPath });
        expect(issues).toHaveLength(1);
        expect(issues[0].type).toBe('missing-min-wp');
        expect(issues[0].projectType).toBe('theme');
    });
});
