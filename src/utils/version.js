/**
 * Compare two WP version strings. Returns > 0 if a > b.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Strip pre-release suffix: "28.0.0-rc.1" → "28.0.0"
 *
 * @param {string} version
 * @returns {string}
 */
function stripPreRelease(version) {
    return version.replace(/-.*$/, '');
}

module.exports = { compareVersions, stripPreRelease };
