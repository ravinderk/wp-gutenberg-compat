import { describe, it, expect, beforeAll } from 'vitest';
import { analyze } from '../../src/analyze.js';
import { compatData } from '../helpers/compat-data.js';
import { writePluginHeader, createFixtureSubdir } from '../helpers/fixture-utils.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let fixtureDir;
let dataPath;

beforeAll(() => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-compat-basic-'));

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

    // wp65: minWp 6.5 → components 28.0.0 requires 6.8 → incompatible
    const wp65 = createFixtureSubdir(fixtureDir, 'wp65');
    writePluginHeader(wp65, '6.5');
    fs.writeFileSync(
        path.join(wp65, 'package.json'),
        JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } }),
    );

    // wp67: minWp 6.7 → components 28.0.0 requires 6.8 → incompatible
    const wp67 = createFixtureSubdir(fixtureDir, 'wp67');
    writePluginHeader(wp67, '6.7');
    fs.writeFileSync(
        path.join(wp67, 'package.json'),
        JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } }),
    );

    // wp68: minWp 6.8 → all compatible
    const wp68 = createFixtureSubdir(fixtureDir, 'wp68');
    writePluginHeader(wp68, '6.8');
    fs.writeFileSync(
        path.join(wp68, 'package.json'),
        JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } }),
    );

    // wp65-no-deps: no @wordpress packages listed
    const wp65NoDeps = createFixtureSubdir(fixtureDir, 'wp65-no-deps');
    writePluginHeader(wp65NoDeps, '6.5');
    fs.writeFileSync(path.join(wp65NoDeps, 'package.json'), JSON.stringify({}));
});

describe('analyze — basic', () => {
    it('returns no issues when all packages are compatible (minWp 6.8)', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'wp68'), dataPath });
        expect(issues).toEqual([]);
    });

    it('returns no issues when no @wordpress deps are listed', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'wp65-no-deps'), dataPath });
        expect(issues).toEqual([]);
    });

    it('reports one incompatible issue for components 28.0.0 with minWp 6.5 (block-editor 11.0.0 is compatible)', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'wp65'), dataPath });
        const incompatible = issues.filter((i) => i.type === 'incompatible');
        expect(incompatible).toHaveLength(1);
        expect(incompatible[0]).toMatchObject({
            pkgName: '@wordpress/components',
            installedVersion: '28.0.0',
            requiredWp: '6.8',
            minWp: '6.5',
            recommendedVersion: '25.0.0',
        });
    });

    it('reports one incompatible issue for components 28.0.0 with minWp 6.7', () => {
        const issues = analyze({ dir: path.join(fixtureDir, 'wp67'), dataPath });
        const incompatible = issues.filter((i) => i.type === 'incompatible');
        expect(incompatible).toHaveLength(1);
        expect(incompatible[0].pkgName).toBe('@wordpress/components');
        expect(incompatible[0].requiredWp).toBe('6.8');
        expect(incompatible[0].minWp).toBe('6.7');
    });
});
