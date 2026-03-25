/**
 * Compare two semver-style version strings (e.g. "21.9" > "20.4").
 * Returns positive if a > b, negative if a < b, 0 if equal.
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

/** Extract base version (e.g. "21.9") from a tag name like "v21.9.0". */
export function tagBaseVersion(tagName: string): string {
    return tagName.slice(1).split('.').slice(0, 2).join('.');
}

/** Invert a map, e.g. { "6.8": "20.4" } → { "20.4": "6.8" }. */
export function invertMap(map: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
