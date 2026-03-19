'use strict';

function padRight(value, width) {
    return String(value).padEnd(width, ' ');
}

function buildAsciiTable(headers, rows) {
    if (rows.length === 0) return '';

    const widths = headers.map((header, index) => {
        const rowWidth = Math.max(...rows.map((row) => String(row[index]).length));
        return Math.max(header.length, rowWidth);
    });

    const headerLine = headers.map((header, index) => padRight(header, widths[index])).join('  ');
    const separatorLine = widths.map((width) => '-'.repeat(width)).join('  ');
    const rowLines = rows.map((row) => row.map((cell, index) => padRight(cell, widths[index])).join('  '));

    return [headerLine, separatorLine, ...rowLines].join('\n');
}

module.exports = {
    buildAsciiTable,
};
