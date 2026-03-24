import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeRemote } from '../../src/analyze.js';
import { compatData } from '../helpers/compat-data.js';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let dataPath;

beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-remote-'));
    dataPath = path.join(tmpDir, 'compat-data.json');
    fs.writeFileSync(dataPath, JSON.stringify(compatData));
});

afterEach(() => {
    vi.restoreAllMocks();
});

/**
 * Helper: mock global fetch to return a given package.json object (as JSON).
 */
function mockFetchSuccess(pkgJsonObject) {
    const body = JSON.stringify(pkgJsonObject);
    vi.stubGlobal('fetch', async () => ({
        ok: true,
        status: 200,
        text: async () => body,
    }));
}

function mockFetchHttpError(status) {
    vi.stubGlobal('fetch', async () => ({
        ok: false,
        status,
        text: async () => '',
    }));
}

function mockFetchNetworkError(message) {
    vi.stubGlobal('fetch', async () => {
        throw new Error(message);
    });
}

function mockFetchInvalidJson() {
    vi.stubGlobal('fetch', async () => ({
        ok: true,
        status: 200,
        text: async () => 'NOT VALID JSON {{{',
    }));
}

describe('analyzeRemote — happy path', () => {
    it('returns no issues when all @wordpress/* packages are compatible', async () => {
        // block-editor ^11.0.0 resolves to 11.0.0 which requires WP 6.5 — compatible with minWp 6.5
        mockFetchSuccess({
            dependencies: { '@wordpress/block-editor': '^11.0.0' },
        });

        const issues = await analyzeRemote({
            remote: 'https://example.com/package.json',
            wp: '6.5',
            dataPath,
        });

        expect(issues).toEqual([]);
    });

    it('reports incompatible issue when resolved version requires higher WP than minWp', async () => {
        // components ^28.0.0 resolves to 28.0.0 which requires WP 6.8 — incompatible with minWp 6.5
        mockFetchSuccess({
            dependencies: { '@wordpress/components': '^28.0.0' },
        });

        const issues = await analyzeRemote({
            remote: 'https://example.com/package.json',
            wp: '6.5',
            dataPath,
        });

        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            type: 'incompatible',
            pkgName: '@wordpress/components',
            installedVersion: '28.0.0',
            requiredWp: '6.8',
            minWp: '6.5',
            recommendedVersion: '25.0.0',
        });
    });

    it('picks up packages from devDependencies as well', async () => {
        mockFetchSuccess({
            devDependencies: { '@wordpress/components': '^28.0.0' },
        });

        const issues = await analyzeRemote({
            remote: 'https://example.com/package.json',
            wp: '6.5',
            dataPath,
        });

        expect(issues).toHaveLength(1);
        expect(issues[0].pkgName).toBe('@wordpress/components');
    });

    it('returns no issues when the remote package.json has no @wordpress/* packages', async () => {
        mockFetchSuccess({
            dependencies: { react: '^18.0.0', lodash: '^4.17.21' },
        });

        const issues = await analyzeRemote({
            remote: 'https://example.com/package.json',
            wp: '6.5',
            dataPath,
        });

        expect(issues).toEqual([]);
    });

    it('returns no issues when the remote package.json has no dependencies at all', async () => {
        mockFetchSuccess({});

        const issues = await analyzeRemote({
            remote: 'https://example.com/package.json',
            wp: '6.5',
            dataPath,
        });

        expect(issues).toEqual([]);
    });

    it('resolves semver range to highest matching version (^27.0.0 → 27.0.0)', async () => {
        // components ^27.0.0 resolves to 27.0.0 which requires WP 6.7 — compatible with minWp 6.7
        mockFetchSuccess({
            dependencies: { '@wordpress/components': '^27.0.0' },
        });

        const issues = await analyzeRemote({
            remote: 'https://example.com/package.json',
            wp: '6.7',
            dataPath,
        });

        expect(issues).toEqual([]);
    });
});

describe('analyzeRemote — error cases', () => {
    it('throws when the URL returns a non-200 HTTP status', async () => {
        mockFetchHttpError(404);

        await expect(
            analyzeRemote({
                remote: 'https://example.com/package.json',
                wp: '6.5',
                dataPath,
            }),
        ).rejects.toThrow('HTTP 404');
    });

    it('throws when the network request fails', async () => {
        mockFetchNetworkError('ECONNREFUSED');

        await expect(
            analyzeRemote({
                remote: 'https://example.com/package.json',
                wp: '6.5',
                dataPath,
            }),
        ).rejects.toThrow('ECONNREFUSED');
    });

    it('throws when the response body is not valid JSON', async () => {
        mockFetchInvalidJson();

        await expect(
            analyzeRemote({
                remote: 'https://example.com/package.json',
                wp: '6.5',
                dataPath,
            }),
        ).rejects.toThrow('Invalid JSON');
    });
});

describe('runAnalyze — --remote requires --wp validation', () => {
    it('returns exit code 1 and error message when --remote is used without --wp', async () => {
        const { runAnalyze } = await import('../../src/cli/commands.js');
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await runAnalyze({ remote: 'https://example.com/package.json', wp: null });

        expect(result.exitCode).toBe(1);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--remote requires --wp'));
    });
});
