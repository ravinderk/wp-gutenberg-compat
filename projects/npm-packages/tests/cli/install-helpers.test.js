import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as cli from '../../src/cli.js';
import { compatData } from '../helpers/compat-data.js';
import { writePluginHeader } from '../helpers/fixture-utils.js';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('cli install helpers', () => {
    it('buildInstallCommand creates command strings for supported package managers', () => {
        expect(cli.buildInstallCommand('npm', ['@wordpress/components@11.0.0'])).toBe(
            'npm install @wordpress/components@11.0.0',
        );
        expect(cli.buildInstallCommand('yarn', ['@wordpress/components@11.0.0'])).toBe(
            'yarn add @wordpress/components@11.0.0',
        );
        expect(cli.buildInstallCommand('pnpm', ['@wordpress/components@11.0.0'])).toBe(
            'pnpm add @wordpress/components@11.0.0',
        );
        expect(cli.buildInstallCommand('bun', ['@wordpress/components@11.0.0'])).toBe(
            'bun add @wordpress/components@11.0.0',
        );
    });

    it('parseArgs keeps dir and does not require package manager flag', () => {
        const parsed = cli.parseArgs(['node', 'src/cli.js', 'install', '--dir', '/tmp/demo']);

        expect(parsed.dir).toBe(path.resolve('/tmp/demo'));
        expect(parsed.unexpectedArgs).toEqual([]);
    });

    it('parseArgs collects unsupported install arguments for validation', () => {
        const parsed = cli.parseArgs([
            'node',
            'src/cli.js',
            'install',
            '--all',
            '@wordpress/components',
            '@wordpress/block-editor',
        ]);

        expect(parsed.unexpectedArgs).toEqual(['--all', '@wordpress/components', '@wordpress/block-editor']);
    });

    it('collectRecommendedInstallSpecs de-duplicates suggested package specs', () => {
        const specs = cli.collectRecommendedInstallSpecs([
            {
                type: 'incompatible',
                pkgName: '@wordpress/components',
                recommendedVersion: '11.0.0',
            },
            {
                type: 'incompatible',
                pkgName: '@wordpress/components',
                recommendedVersion: '11.0.0',
            },
        ]);

        expect(specs).toEqual(['@wordpress/components@~11.0.0']);
    });

    it('detectPackageManager returns a manager only when exactly one is detected', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-cli-pm-'));

        try {
            fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
            expect(cli.detectPackageManager(tempDir)).toBe('npm');

            fs.rmSync(path.join(tempDir, 'package-lock.json'));
            fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');
            expect(cli.detectPackageManager(tempDir)).toBe('yarn');

            fs.rmSync(path.join(tempDir, 'yarn.lock'));
            fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
            expect(cli.detectPackageManager(tempDir)).toBe('pnpm');

            fs.rmSync(path.join(tempDir, 'pnpm-lock.yaml'));
            fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');
            expect(cli.detectPackageManager(tempDir)).toBe('bun');

            fs.rmSync(path.join(tempDir, 'bun.lockb'));
            expect(cli.detectPackageManager(tempDir)).toBeNull();

            fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
            fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');
            expect(cli.detectPackageManager(tempDir)).toBeNull();
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('runInstallCommand does not print analyze-only suggested next step output', async () => {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-cli-install-'));
        const dataPath = path.join(fixtureDir, 'compat-data.json');
        const pluginDir = path.join(fixtureDir, 'plugin');
        const output = [];
        const originalError = console.error;

        try {
            fs.writeFileSync(dataPath, JSON.stringify(compatData));
            fs.mkdirSync(pluginDir, { recursive: true });

            writePluginHeader(pluginDir, '6.5');
            fs.writeFileSync(
                path.join(pluginDir, 'package.json'),
                JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0' } }),
            );

            const componentsDir = path.join(pluginDir, 'node_modules', '@wordpress', 'components');
            fs.mkdirSync(componentsDir, { recursive: true });
            fs.writeFileSync(
                path.join(componentsDir, 'package.json'),
                JSON.stringify({ name: '@wordpress/components', version: '28.0.0' }),
            );

            console.error = (line) => output.push(line);

            const exitCode = await cli.runInstallCommand({
                dir: pluginDir,
                dataPath,
                unexpectedArgs: [],
            });

            expect(exitCode).toBe(1);
            expect(output.join('\n')).not.toContain('Suggested next step:');
            expect(output.join('\n')).not.toContain('Equivalent direct package-manager commands:');
        } finally {
            console.error = originalError;
            fs.rmSync(fixtureDir, { recursive: true, force: true });
        }
    });

    it('runAnalyze does not print suggested install commands in --remote mode', async () => {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-cli-remote-'));
        const dataPath = path.join(fixtureDir, 'compat-data.json');
        const output = [];
        const originalError = console.error;

        try {
            fs.writeFileSync(dataPath, JSON.stringify(compatData));

            // components ^28.0.0 requires WP 6.8 — incompatible with minWp 6.5
            vi.stubGlobal('fetch', async () => ({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ dependencies: { '@wordpress/components': '^28.0.0' } }),
            }));

            console.error = (line) => output.push(line);

            const { exitCode } = await cli.runAnalyze({
                remote: 'https://example.com/package.json',
                wp: '6.5',
                dataPath,
            });

            expect(exitCode).toBe(1);
            expect(output.join('\n')).not.toContain('Suggested next step:');
            expect(output.join('\n')).not.toContain('Equivalent direct package-manager commands:');
            expect(output.join('\n')).toContain('Suggested action (remote project):');
            expect(output.join('\n')).toContain('should be installed at a compatible version in that project');
            expect(output.join('\n')).toContain('@wordpress/components@~');
        } finally {
            console.error = originalError;
            fs.rmSync(fixtureDir, { recursive: true, force: true });
        }
    });
});
