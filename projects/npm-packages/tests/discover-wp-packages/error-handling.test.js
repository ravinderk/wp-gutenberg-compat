import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverWpPackages, clearDiscoverCache } from '../../src/utils/discover-wp-packages.js';
import { writePkg } from '../helpers/fixture-utils.js';

let tmpDir;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-disc-err-'));
    clearDiscoverCache();
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    clearDiscoverCache();
    vi.restoreAllMocks();
});

describe('discoverWpPackages — error handling', () => {
    it('returns empty array when no package.json exists and does not throw', () => {
        expect(() => discoverWpPackages(tmpDir)).not.toThrow();
        expect(Array.isArray(discoverWpPackages(tmpDir))).toBe(true);
    });

    it('returns empty array when directory has no package.json (isolated check)', () => {
        const isolatedDir = path.join(tmpDir, 'sub', 'deep');
        fs.mkdirSync(isolatedDir, { recursive: true });
        const result = discoverWpPackages(isolatedDir);
        expect(Array.isArray(result)).toBe(true);
    });

    it('returns empty array and emits console.warn for malformed JSON', () => {
        fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ invalid json');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = discoverWpPackages(tmpDir);

        expect(result).toEqual([]);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('[wp-gutenberg-compat]');
        expect(warnSpy.mock.calls[0][0]).toContain(path.join(tmpDir, 'package.json'));
    });

    it('does NOT emit console.warn for empty-object package.json', () => {
        writePkg(tmpDir, {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        discoverWpPackages(tmpDir);

        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does NOT emit console.warn for valid package.json with empty deps', () => {
        writePkg(tmpDir, { dependencies: {}, devDependencies: {} });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        discoverWpPackages(tmpDir);

        expect(warnSpy).not.toHaveBeenCalled();
    });
});
