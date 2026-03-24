import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as cli from '../../src/cli.js';
import { runOpen, getLatestCompatVersion } from '../../src/cli/commands/open.js';
import { compatData } from '../helpers/compat-data.js';

describe('runOpen', () => {
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
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-open-'));
        const dataPath = path.join(tempDir, 'compat-data.json');
        fs.writeFileSync(dataPath, JSON.stringify(compatData));
        return { tempDir, dataPath };
    }

    it('opens the npm page for the --wp compatible version', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const openedUrls = [];
            const urlOpener = (url) => openedUrls.push(url);

            const { exitCode, stdout } = captureOutput(() =>
                runOpen({ openPackage: '@wordpress/block-editor', wp: '6.5', dataPath }, urlOpener),
            );

            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            expect(output).toContain('@wordpress/block-editor@11.0.0');
            expect(output).toContain('npmjs.com');
            expect(openedUrls).toHaveLength(1);
            expect(openedUrls[0]).toBe('https://www.npmjs.com/package/@wordpress/block-editor/v/11.0.0');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('falls back to the latest compat-data version when package is not installed and --wp is not given', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const openedUrls = [];
            const urlOpener = (url) => openedUrls.push(url);

            const { exitCode, stdout } = captureOutput(() =>
                runOpen({ openPackage: '@wordpress/block-editor', wp: null, dir: tempDir, dataPath }, urlOpener),
            );

            expect(exitCode).toBe(0);
            const output = stdout.join('\n');
            // Latest version of @wordpress/block-editor in compat-data fixture is 15.0.0
            expect(output).toContain('@wordpress/block-editor@15.0.0');
            expect(openedUrls).toHaveLength(1);
            expect(openedUrls[0]).toContain('/v/15.0.0');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('returns exit code 1 when package is not in compat-data', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stderr } = captureOutput(() =>
                runOpen({ openPackage: '@wordpress/nonexistent', wp: null, dir: tempDir, dataPath }),
            );
            expect(exitCode).toBe(1);
            expect(stderr.join('\n')).toContain("'@wordpress/nonexistent' is not tracked in compat data.");
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('returns exit code 1 when package does not start with @wordpress/', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stderr } = captureOutput(() =>
                runOpen({ openPackage: 'block-editor', wp: null, dir: tempDir, dataPath }),
            );
            expect(exitCode).toBe(1);
            expect(stderr.join('\n')).toContain("'block-editor' is not a @wordpress/* package.");
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('returns exit code 1 when no package name is provided', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stderr } = captureOutput(() =>
                runOpen({ openPackage: null, wp: null, dir: tempDir, dataPath }),
            );
            expect(exitCode).toBe(1);
            expect(stderr.join('\n')).toContain('Usage:');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('returns exit code 1 when no version matches the given --wp', () => {
        const { tempDir, dataPath } = setupDataFile();
        try {
            const { exitCode, stderr } = captureOutput(() =>
                runOpen({ openPackage: '@wordpress/block-editor', wp: '5.0', dataPath }),
            );
            expect(exitCode).toBe(1);
            expect(stderr.join('\n')).toContain('No compatible version');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

describe('getLatestCompatVersion', () => {
    it('returns the highest version from a pkg entry', () => {
        const pkgEntry = {
            '10.0.0': {},
            '15.0.0': {},
            '11.0.0': {},
        };
        expect(getLatestCompatVersion(pkgEntry)).toBe('15.0.0');
    });

    it('returns null for an empty pkg entry', () => {
        expect(getLatestCompatVersion({})).toBeNull();
    });
});

describe('parseArgs for open command', () => {
    it('collects the package name for the open command', () => {
        const parsed = cli.parseArgs(['node', 'src/cli.js', 'open', '@wordpress/block-editor']);
        expect(parsed.openPackage).toBe('@wordpress/block-editor');
        expect(parsed.wp).toBeNull();
    });

    it('collects the package name and --wp flag for the open command', () => {
        const parsed = cli.parseArgs(['node', 'src/cli.js', 'open', '@wordpress/block-editor', '--wp', '6.5']);
        expect(parsed.openPackage).toBe('@wordpress/block-editor');
        expect(parsed.wp).toBe('6.5');
    });

    it('returns null openPackage when no package is provided', () => {
        const parsed = cli.parseArgs(['node', 'src/cli.js', 'open']);
        expect(parsed.openPackage).toBeNull();
    });
});
