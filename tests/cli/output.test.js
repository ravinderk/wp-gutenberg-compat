import { describe, it, expect } from 'vitest';

import { buildAsciiTable } from '../../src/cli/table.js';
import {
    Reporter,
    formatIssuesReport,
    formatNoAutomaticDowngradeMessage,
    buildSuggestedInstallCommands,
} from '../../src/cli/output.js';

describe('cli output formatting', () => {
    it('buildAsciiTable renders a dashed ASCII table', () => {
        const table = buildAsciiTable(
            ['Package', 'Installed', 'Needs WP', 'Plugin Min', 'Suggested'],
            [['@wordpress/views', '1.9.0', '6.9', '6.6', 'none']],
        );

        expect(table).toBe(
            [
                'Package           Installed  Needs WP  Plugin Min  Suggested',
                '----------------  ---------  --------  ----------  ---------',
                '@wordpress/views  1.9.0      6.9       6.6         none     ',
            ].join('\n'),
        );
    });

    it('formatIssuesReport renders incompatible issues as a table', () => {
        const report = formatIssuesReport([
            {
                type: 'incompatible',
                pkgName: '@wordpress/views',
                installedVersion: '1.9.0',
                requiredWp: '6.9',
                minWp: '6.6',
                recommendedVersion: null,
            },
            {
                type: 'incompatible',
                pkgName: '@wordpress/data',
                installedVersion: '10.12.0',
                requiredWp: '6.8',
                minWp: '6.6',
                recommendedVersion: '10.4.0',
            },
        ]);

        expect(report).toContain('Compatibility issues (2)');
        expect(report).toContain('Package');
        expect(report).toContain('@wordpress/views');
        expect(report).toContain('@wordpress/data');
        expect(report).toContain('none');
        expect(report).toContain('~10.4.0');
    });

    it('formatNoAutomaticDowngradeMessage names a single incompatible package', () => {
        const message = formatNoAutomaticDowngradeMessage([
            {
                type: 'incompatible',
                pkgName: '@wordpress/views',
            },
        ]);

        expect(message).toBe('No automatic downgrade is available for @wordpress/views.');
    });

    it('buildSuggestedInstallCommands shows only the detected package manager command', () => {
        const reporter = new Reporter();
        buildSuggestedInstallCommands(reporter, ['@wordpress/components@11.0.0'], 'pnpm');

        const output = [];
        const originalError = console.error;
        console.error = (line) => output.push(line);

        try {
            reporter.print();
        } finally {
            console.error = originalError;
        }

        const text = output.join('\n');
        expect(text).toContain('wp-gutenberg-compat install');
        expect(text).toContain('Equivalent direct package-manager commands:');
        expect(text).toContain('pnpm add @wordpress/components@11.0.0');
        expect(text).not.toContain('npm install @wordpress/components@11.0.0');
        expect(text).not.toContain('yarn add @wordpress/components@11.0.0');
        expect(text).not.toContain('bun add @wordpress/components@11.0.0');
    });

    it('buildSuggestedInstallCommands falls back to all supported package-manager commands', () => {
        const reporter = new Reporter();
        buildSuggestedInstallCommands(reporter, ['@wordpress/components@11.0.0']);

        const output = [];
        const originalError = console.error;
        console.error = (line) => output.push(line);

        try {
            reporter.print();
        } finally {
            console.error = originalError;
        }

        const text = output.join('\n');
        expect(text).toContain('npm install @wordpress/components@11.0.0');
        expect(text).toContain('yarn add @wordpress/components@11.0.0');
        expect(text).toContain('pnpm add @wordpress/components@11.0.0');
        expect(text).toContain('bun add @wordpress/components@11.0.0');
    });

    it('Reporter buffers entries and flushes them via print()', () => {
        const reporter = new Reporter();
        reporter.error('something went wrong');
        reporter.success('all good');
        reporter.block('some details');

        const errOutput = [];
        const logOutput = [];
        const originalError = console.error;
        const originalLog = console.log;
        console.error = (line) => errOutput.push(line);
        console.log = (line) => logOutput.push(line);

        try {
            reporter.print();
        } finally {
            console.error = originalError;
            console.log = originalLog;
        }

        expect(errOutput.join('\n')).toContain('✘ something went wrong');
        expect(logOutput.join('\n')).toContain('✔ all good');
        expect(errOutput.join('\n')).toContain('some details');
    });

    it('Reporter.print() is chainable and returns the reporter', () => {
        const reporter = new Reporter();
        reporter.info('hello');
        const result = reporter.print();
        expect(result).toBe(reporter);
    });
});
