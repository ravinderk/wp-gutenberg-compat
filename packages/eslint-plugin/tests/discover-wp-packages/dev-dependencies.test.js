import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverWpPackages, clearDiscoverCache } from '../../src/utils/discover-wp-packages.js';
import { writePkg } from '../helpers/fixture-utils.js';

let tmpDir;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-disc-devdeps-'));
    clearDiscoverCache();
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    clearDiscoverCache();
});

describe('discoverWpPackages — devDependencies', () => {
    it('returns @wordpress/* packages from devDependencies only', () => {
        writePkg(tmpDir, { devDependencies: { '@wordpress/scripts': '^28.0.0' } });
        expect(discoverWpPackages(tmpDir)).toEqual(['@wordpress/scripts']);
    });

    it('deduplicates packages present in both dependencies and devDependencies', () => {
        writePkg(tmpDir, {
            dependencies: { '@wordpress/components': '^28.0.0' },
            devDependencies: { '@wordpress/components': '^28.0.0' },
        });
        const result = discoverWpPackages(tmpDir);
        expect(result).toHaveLength(1);
        expect(result).toContain('@wordpress/components');
    });

    it('merges packages from both dependencies and devDependencies', () => {
        writePkg(tmpDir, {
            dependencies: { '@wordpress/components': '^28.0.0' },
            devDependencies: { '@wordpress/scripts': '^28.0.0' },
        });
        const result = discoverWpPackages(tmpDir);
        expect(result).toHaveLength(2);
        expect(result).toContain('@wordpress/components');
        expect(result).toContain('@wordpress/scripts');
    });

    it('returns empty array when devDependencies is empty and dependencies is absent', () => {
        writePkg(tmpDir, { devDependencies: {} });
        expect(discoverWpPackages(tmpDir)).toEqual([]);
    });
});
