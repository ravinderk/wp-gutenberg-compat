import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as cli from '../../src/cli.js';
import { compatData } from '../helpers/compat-data.js';

describe('runInfo', () => {
    function captureOutput(fn) {
        const stdout = [];
        const stderr = [];
        const originalLog = console.log;
        const originalError = console.error;
        console.log = (line) => stdout.push(line ?? '');
        console.error = (line) => stderr.push(line ?? '');
        try {
            const exitCode = fn();
            return { exitCode, stdout, stderr };
        } finally {
            console.log = originalLog;
            console.error = originalError;
        }
    }

    function setupDataFile() {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-info-'));
        const dataPath = path.join(tempDir, 'compat-data.json');
        fs.writeFileSync(dataPath, JSON.stringify(compatData));
        return { tempDir, dataPath };
    }

    it('mode 1 (no packages): prints tool version', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stdout } = captureOutput(() => cli.runInfo({ infoPackages: [], dataPath }));
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toMatch(/wp-gutenberg-compat version:/);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 1 (no packages): prints supported package managers', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stdout } = captureOutput(() => cli.runInfo({ infoPackages: [], dataPath }));
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('npm');
            expect(output).toContain('yarn');
            expect(output).toContain('pnpm');
            expect(output).toContain('bun');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 1 (no packages): prints WordPress versions in the table', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stdout } = captureOutput(() => cli.runInfo({ infoPackages: [], dataPath }));
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('6.9');
            expect(output).toContain('6.4');
            expect(output).toContain('21.9');
            expect(output).toContain('16.7');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 1 (no packages): prints compat data last updated line', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stdout } = captureOutput(() => cli.runInfo({ infoPackages: [], dataPath }));
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('Compat data last updated:');
            expect(output).toContain('v21.9.0');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 2 (single package): prints compatibility matrix for a tracked package', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stdout } = captureOutput(() =>
                cli.runInfo({ infoPackages: ['@wordpress/components'], dataPath }),
            );
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('@wordpress/components');
            expect(output).toContain('29.0.0');
            expect(output).toContain('6.9');
            expect(output).toContain('21.9');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 2 (multiple packages): prints matrix for each package in sequence', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stdout } = captureOutput(() =>
                cli.runInfo({
                    infoPackages: ['@wordpress/components', '@wordpress/block-editor'],
                    dataPath,
                }),
            );
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('@wordpress/components');
            expect(output).toContain('@wordpress/block-editor');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 2 (untracked package): prints error and exits non-zero', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stderr } = captureOutput(() =>
                cli.runInfo({ infoPackages: ['@wordpress/foo'], dataPath }),
            );
            expect(exitCode).toBe(1);
            const errOutput = stderr.join('\n');
            expect(errOutput).toContain("'@wordpress/foo' is not tracked in compat data.");
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 2 (short name without @wordpress/ prefix): prints error and exits non-zero', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stderr } = captureOutput(() => cli.runInfo({ infoPackages: ['block-editor'], dataPath }));
            expect(exitCode).toBe(1);
            const errOutput = stderr.join('\n');
            expect(errOutput).toContain("'block-editor' is not tracked in compat data.");
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('parseArgs collects package names for the info command', () => {
        const parsed = cli.parseArgs([
            'node',
            'src/cli.js',
            'info',
            '@wordpress/block-editor',
            '@wordpress/components',
        ]);
        expect(parsed.infoPackages).toEqual(['@wordpress/block-editor', '@wordpress/components']);
    });

    it('parseArgs returns empty infoPackages for info command with no package args', () => {
        const parsed = cli.parseArgs(['node', 'src/cli.js', 'info']);
        expect(parsed.infoPackages).toEqual([]);
    });

    it('mode 1 (no packages): shows Project section for a plugin directory', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const pluginDir = path.join(tempDir, 'my-plugin');
            fs.mkdirSync(pluginDir);
            fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({ name: 'my-plugin' }));
            fs.writeFileSync(path.join(pluginDir, 'my-plugin.php'), '<?php\n/**\n * Plugin Name: My Plugin\n * Requires at least: 6.5\n */\n');
            const { exitCode, stdout } = captureOutput(() =>
                cli.runInfo({ infoPackages: [], dataPath, dir: pluginDir }),
            );
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('Project');
            expect(output).toContain('Type:');
            expect(output).toContain('plugin');
            expect(output).toContain('Name:');
            expect(output).toContain('my-plugin.php');
            expect(output).toContain('Requires at least:');
            expect(output).toContain('6.5');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 1 (no packages): shows Project section for a theme directory', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const themeDir = path.join(tempDir, 'my-theme');
            fs.mkdirSync(themeDir);
            fs.writeFileSync(path.join(themeDir, 'package.json'), JSON.stringify({ name: 'my-theme' }));
            fs.writeFileSync(path.join(themeDir, 'style.css'), '/*\nTheme Name: My Theme\nRequires at least: 6.4\n*/\n');
            const { exitCode, stdout } = captureOutput(() =>
                cli.runInfo({ infoPackages: [], dataPath, dir: themeDir }),
            );
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('Project');
            expect(output).toContain('Type:');
            expect(output).toContain('theme');
            expect(output).toContain('Name:');
            expect(output).toContain('style.css');
            expect(output).toContain('Requires at least:');
            expect(output).toContain('6.4');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 1 (no packages): shows Requires at least only when present in header', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const pluginDir = path.join(tempDir, 'bare-plugin');
            fs.mkdirSync(pluginDir);
            fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({ name: 'bare-plugin' }));
            fs.writeFileSync(path.join(pluginDir, 'bare-plugin.php'), '<?php\n/**\n * Plugin Name: Bare Plugin\n */\n');
            const { exitCode, stdout } = captureOutput(() =>
                cli.runInfo({ infoPackages: [], dataPath, dir: pluginDir }),
            );
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('plugin');
            expect(output).toContain('bare-plugin.php');
            expect(output).not.toContain('Requires at least:');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('mode 1 (no packages): omits Project section when not in a WP project', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const nonWpDir = path.join(tempDir, 'non-wp');
            fs.mkdirSync(nonWpDir);
            fs.writeFileSync(path.join(nonWpDir, 'package.json'), JSON.stringify({ name: 'non-wp' }));
            const { exitCode, stdout } = captureOutput(() =>
                cli.runInfo({ infoPackages: [], dataPath, dir: nonWpDir }),
            );
            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).not.toContain('Project');
            expect(output).not.toContain('Type:');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
