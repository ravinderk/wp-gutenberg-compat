import { describe, it, expect, beforeAll } from 'vitest';
import { analyze } from '../../src/analyze.js';
import { compatData } from '../helpers/compat-data.js';
import { writeThemeHeader, createFixtureSubdir } from '../helpers/fixture-utils.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let fixtureDir;
let dataPath;

beforeAll(() => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-compat-theme-'));

    dataPath = path.join(fixtureDir, 'compat-data.json');
    fs.writeFileSync(dataPath, JSON.stringify(compatData));

    // Shared node_modules
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

    // theme65: style.css with minWp 6.5
    const theme65 = createFixtureSubdir(fixtureDir, 'theme65');
    writeThemeHeader(theme65, '6.5');
    fs.writeFileSync(
        path.join(theme65, 'package.json'),
        JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } }),
    );

    // theme68: style.css with minWp 6.8 → all compatible
    const theme68 = createFixtureSubdir(fixtureDir, 'theme68');
    writeThemeHeader(theme68, '6.8');
    fs.writeFileSync(
        path.join(theme68, 'package.json'),
        JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } }),
    );
});

describe('analyze — theme support', () => {
    it('reads Requires at least from theme style.css and reports incompatible component (minWp 6.5)', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'theme65'), dataPath });
        const incompatible = issues.filter((i) => i.type === 'incompatible');
        // components 28.0.0 requires 6.8 → incompatible; block-editor 11.0.0 requires 6.5 → ok
        expect(incompatible).toHaveLength(1);
        expect(incompatible[0].pkgName).toBe('@wordpress/components');
        expect(incompatible[0].minWp).toBe('6.5');
        expect(incompatible[0].requiredWp).toBe('6.8');
    });

    it('returns no incompatible issues for theme with minWp 6.8', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'theme68'), dataPath });
        expect(issues.filter((i) => i.type === 'incompatible')).toHaveLength(0);
    });
});
