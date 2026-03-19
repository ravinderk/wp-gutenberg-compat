import { describe, it, expect } from 'vitest';

import { buildAsciiTable } from '../../src/cli/table.js';
import { formatIssuesReport, formatNoAutomaticDowngradeMessage } from '../../src/cli/output.js';

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

        expect(report).toContain('Compatibility issues:');
        expect(report).toContain('Package');
        expect(report).toContain('@wordpress/views');
        expect(report).toContain('@wordpress/data');
        expect(report).toContain('none');
        expect(report).toContain('10.4.0');
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
});
