/**
 * Compare two WP version strings. Returns > 0 if a > b.
 */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Strip pre-release suffix: "28.0.0-rc.1" → "28.0.0"
 */
export function stripPreRelease(version: string): string {
    return version.replace(/-.*$/, '');
}
