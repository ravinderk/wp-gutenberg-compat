export function buildAsciiTable(headers: string[], rows: string[][]): string {
    if (rows.length === 0) return '';

    const widths = headers.map((header, index) => {
        const rowWidth = Math.max(...rows.map((row) => String(row[index]).length));
        return Math.max(header.length, rowWidth);
    });

    const headerLine = headers.map((header, index) => header.padEnd(widths[index], ' ')).join('  ');
    const separatorLine = widths.map((width) => '-'.repeat(width)).join('  ');
    const rowLines = rows.map((row) => row.map((cell, index) => cell.padEnd(widths[index], ' ')).join('  '));

    return [headerLine, separatorLine, ...rowLines].join('\n');
}
