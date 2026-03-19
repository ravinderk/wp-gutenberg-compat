import { describe, it, expect } from 'vitest';

import { buildAsciiTable } from '../../src/cli/table.js';
import {
    formatIssuesReport,
    formatNoAutomaticDowngradeMessage,
    printSuggestedInstallCommands,
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

    it('printSuggestedInstallCommands shows only the detected package manager command', () => {
        const output = [];
        const originalError = console.error;
        console.error = (line) => output.push(line);

        try {
            printSuggestedInstallCommands(['@wordpress/components@11.0.0'], 'pnpm');
        } finally {
            console.error = originalError;
        }

        expect(output).toContain('  wp-gutenberg-compat install');
        expect(output).not.toContain('  wp-gutenberg-compat install --all');
        expect(output).toContain('\nEquivalent direct package-manager commands:');
        expect(output).toContain('  pnpm add @wordpress/components@11.0.0');
        expect(output).not.toContain('  npm install @wordpress/components@11.0.0');
        expect(output).not.toContain('  yarn add @wordpress/components@11.0.0');
        expect(output).not.toContain('  bun add @wordpress/components@11.0.0');
    });

    it('printSuggestedInstallCommands falls back to all supported package-manager commands', () => {
        const output = [];
        const originalError = console.error;
        console.error = (line) => output.push(line);

        try {
            printSuggestedInstallCommands(['@wordpress/components@11.0.0']);
        } finally {
            console.error = originalError;
        }

        expect(output).toContain('  npm install @wordpress/components@11.0.0');
        expect(output).toContain('  yarn add @wordpress/components@11.0.0');
        expect(output).toContain('  pnpm add @wordpress/components@11.0.0');
        expect(output).toContain('  bun add @wordpress/components@11.0.0');
    });
});
