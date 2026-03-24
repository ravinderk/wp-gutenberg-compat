import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverWpPackages, clearDiscoverCache } from '../../src/utils/discover-wp-packages.js';
import { writePkg } from '../helpers/fixture-utils.js';

let tmpDir;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-disc-cache-'));
    clearDiscoverCache();
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    clearDiscoverCache();
});

describe('discoverWpPackages — caching', () => {
    it('returns the same array reference on repeated calls (cache hit)', () => {
        writePkg(tmpDir, { dependencies: { '@wordpress/components': '^28.0.0' } });
        const first = discoverWpPackages(tmpDir);
        const second = discoverWpPackages(tmpDir);
        expect(first).toBe(second);
    });

    it('re-reads after cache is cleared', () => {
        writePkg(tmpDir, { dependencies: { '@wordpress/components': '^28.0.0' } });
        const first = discoverWpPackages(tmpDir);
        expect(first).toHaveLength(1);

        clearDiscoverCache();

        writePkg(tmpDir, {
            dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' },
        });
        const second = discoverWpPackages(tmpDir);
        expect(second).toHaveLength(2);
    });
});
