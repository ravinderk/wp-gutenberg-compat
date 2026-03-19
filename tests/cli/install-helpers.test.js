import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as cli from '../../src/cli.js';

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
        expect(parsed.installAll).toBe(false);
        expect(parsed.packageNames).toEqual([]);
    });

    it('parseArgs captures install target flags and package names', () => {
        const allParsed = cli.parseArgs(['node', 'src/cli.js', 'install', '--all']);
        expect(allParsed.installAll).toBe(true);
        expect(allParsed.packageNames).toEqual([]);

        const selectiveParsed = cli.parseArgs([
            'node',
            'src/cli.js',
            'install',
            '@wordpress/components',
            '@wordpress/block-editor',
        ]);
        expect(selectiveParsed.installAll).toBe(false);
        expect(selectiveParsed.packageNames).toEqual(['@wordpress/components', '@wordpress/block-editor']);
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

        expect(specs).toEqual(['@wordpress/components@11.0.0']);
    });

    it('resolveInstallSpecs validates install target mode and selects requested package specs', () => {
        const packageSpecs = ['@wordpress/components@11.0.0', '@wordpress/block-editor@12.0.0'];

        const missingTarget = cli.resolveInstallSpecs(packageSpecs, {
            installAll: false,
            packageNames: [],
        });
        expect(missingTarget.ok).toBe(false);

        const conflictingTarget = cli.resolveInstallSpecs(packageSpecs, {
            installAll: true,
            packageNames: ['@wordpress/components'],
        });
        expect(conflictingTarget.ok).toBe(false);

        const allTarget = cli.resolveInstallSpecs(packageSpecs, {
            installAll: true,
            packageNames: [],
        });
        expect(allTarget.ok).toBe(true);
        expect(allTarget.selectedSpecs).toEqual(packageSpecs);

        const selectiveTarget = cli.resolveInstallSpecs(packageSpecs, {
            installAll: false,
            packageNames: ['@wordpress/components', '@wordpress/unused'],
        });
        expect(selectiveTarget.ok).toBe(true);
        expect(selectiveTarget.selectedSpecs).toEqual(['@wordpress/components@11.0.0']);
        expect(selectiveTarget.missingPackages).toEqual(['@wordpress/unused']);
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
});
