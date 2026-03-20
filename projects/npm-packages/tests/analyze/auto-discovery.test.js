import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyze } from '../../src/analyze.js';
import { clearDiscoverCache } from '../../src/utils/discover-wp-packages.js';
import { compatData } from '../helpers/compat-data.js';
import { writePluginHeader } from '../helpers/fixture-utils.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let dir;
let dataPath;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-disc-analyze-'));
    clearDiscoverCache();

    dataPath = path.join(dir, 'compat-data.json');
    fs.writeFileSync(dataPath, JSON.stringify(compatData));

    // components 28.0.0 requires WP 6.8
    const componentsDir = path.join(dir, 'node_modules', '@wordpress', 'components');
    fs.mkdirSync(componentsDir, { recursive: true });
    fs.writeFileSync(
        path.join(componentsDir, 'package.json'),
        JSON.stringify({ name: '@wordpress/components', version: '28.0.0' }),
    );

    // block-editor 11.0.0 requires WP 6.5
    const beDir = path.join(dir, 'node_modules', '@wordpress', 'block-editor');
    fs.mkdirSync(beDir, { recursive: true });
    fs.writeFileSync(
        path.join(beDir, 'package.json'),
        JSON.stringify({ name: '@wordpress/block-editor', version: '11.0.0' }),
    );

    writePluginHeader(dir, '6.5');
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    clearDiscoverCache();
});

describe('analyze — auto-discovery', () => {
    it('US1: reports incompatible for package in dependencies', () => {
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0' } }),
        );
        const issues = analyze({ dir, dataPath });
        expect(issues.some((i) => i.type === 'incompatible' && i.pkgName === '@wordpress/components')).toBe(true);
    });

    it('US1: no error when installed package meets requirement', () => {
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0' } }),
        );
        writePluginHeader(dir, '6.8');
        clearDiscoverCache();

        const issues = analyze({ dir, dataPath });
        expect(issues.filter((i) => i.type === 'incompatible')).toHaveLength(0);
    });

    it('US2: reports incompatible for package in devDependencies', () => {
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify({ devDependencies: { '@wordpress/components': '^28.0.0' } }),
        );
        const issues = analyze({ dir, dataPath });
        expect(issues.some((i) => i.type === 'incompatible' && i.pkgName === '@wordpress/components')).toBe(true);
    });

    it('US2: does not report compatible package in devDependencies', () => {
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify({ devDependencies: { '@wordpress/block-editor': '^11.0.0' } }),
        );
        const issues = analyze({ dir, dataPath });
        expect(issues.filter((i) => i.type === 'incompatible')).toHaveLength(0);
    });

    it('US3: malformed package.json — no packages discovered, no incompatible errors', () => {
        fs.writeFileSync(path.join(dir, 'package.json'), '{ invalid json');
        writePluginHeader(dir, '6.4');
        clearDiscoverCache();

        const issues = analyze({ dir, dataPath });
        expect(issues.filter((i) => i.type === 'incompatible')).toHaveLength(0);
    });

    it('US3: empty package.json — no packages discovered, no incompatible errors', () => {
        fs.writeFileSync(path.join(dir, 'package.json'), '{}');
        writePluginHeader(dir, '6.4');
        clearDiscoverCache();

        const issues = analyze({ dir, dataPath });
        expect(issues.filter((i) => i.type === 'incompatible')).toHaveLength(0);
    });
});
