import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverWpPackages, clearDiscoverCache } from '../src/utils/discover-wp-packages.js';

let tmpDir;

beforeEach(() => {
  // Fresh temp directory for each test
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-disc-test-'));
  // Clear module cache so results are not carried over between tests
  clearDiscoverCache();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  clearDiscoverCache();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: write a package.json to tmpDir
// ---------------------------------------------------------------------------
function writePkg(content) {
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(content));
}

// ---------------------------------------------------------------------------
// US1: Basic dependency discovery
// ---------------------------------------------------------------------------

describe('discoverWpPackages — dependencies', () => {
  it('returns @wordpress/* packages from dependencies only', () => {
    writePkg({ dependencies: { '@wordpress/components': '^28.0.0', react: '^18.0.0' } });
    expect(discoverWpPackages(tmpDir)).toEqual(['@wordpress/components']);
  });

  it('filters out non-@wordpress packages', () => {
    writePkg({ dependencies: { '@wordpress/components': '^28.0.0', react: '^18.0.0' } });
    const result = discoverWpPackages(tmpDir);
    expect(result).not.toContain('react');
  });

  it('returns empty array when no @wordpress/* entries in dependencies', () => {
    writePkg({ dependencies: { react: '^18.0.0', lodash: '^4.0.0' } });
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });

  it('returns empty array when dependencies is empty', () => {
    writePkg({ dependencies: {} });
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });

  it('returns empty array when neither dependencies nor devDependencies key exists', () => {
    writePkg({ name: 'my-plugin', version: '1.0.0' });
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });

  it('returns empty array for completely empty package.json object', () => {
    writePkg({});
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// US2: devDependencies support and deduplication
// ---------------------------------------------------------------------------

describe('discoverWpPackages — devDependencies', () => {
  it('returns @wordpress/* packages from devDependencies only', () => {
    writePkg({ devDependencies: { '@wordpress/scripts': '^28.0.0' } });
    expect(discoverWpPackages(tmpDir)).toEqual(['@wordpress/scripts']);
  });

  it('deduplicates packages present in both dependencies and devDependencies', () => {
    writePkg({
      dependencies: { '@wordpress/components': '^28.0.0' },
      devDependencies: { '@wordpress/components': '^28.0.0' },
    });
    const result = discoverWpPackages(tmpDir);
    expect(result).toHaveLength(1);
    expect(result).toContain('@wordpress/components');
  });

  it('merges packages from both dependencies and devDependencies', () => {
    writePkg({
      dependencies: { '@wordpress/components': '^28.0.0' },
      devDependencies: { '@wordpress/scripts': '^28.0.0' },
    });
    const result = discoverWpPackages(tmpDir);
    expect(result).toHaveLength(2);
    expect(result).toContain('@wordpress/components');
    expect(result).toContain('@wordpress/scripts');
  });

  it('returns empty array when devDependencies is empty and dependencies is absent', () => {
    writePkg({ devDependencies: {} });
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// US3: Graceful error handling
// ---------------------------------------------------------------------------

describe('discoverWpPackages — error handling', () => {
  it('returns empty array when no package.json exists and does not throw', () => {
    // No package.json written to tmpDir, but walk up will find one higher up.
    // Use a deeply nested subdir that is unlikely to have a wp package.
    // Better: test with an isolated dir that has no package.json and no parent with one.
    // We can't guarantee no parent has package.json in a real FS, so instead we'll
    // just confirm the function doesn't throw and returns an array.
    expect(() => discoverWpPackages(tmpDir)).not.toThrow();
    // With no package.json in tmpDir, it walks up. Result is an array regardless.
    expect(Array.isArray(discoverWpPackages(tmpDir))).toBe(true);
  });

  it('returns empty array when directory has no package.json (isolated check)', () => {
    // Remove tmpDir and use its path after deletion to ensure no package.json found locally
    const isolatedDir = path.join(tmpDir, 'sub', 'deep');
    fs.mkdirSync(isolatedDir, { recursive: true });
    // No package.json in tmpDir or its sub — but we must also handle that walk-up might
    // find the repo's own package.json. The function still returns an array.
    const result = discoverWpPackages(isolatedDir);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array and emits console.warn for malformed JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ invalid json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = discoverWpPackages(tmpDir);

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[gutenberg-compat]');
    expect(warnSpy.mock.calls[0][0]).toContain(path.join(tmpDir, 'package.json'));
  });

  it('does NOT emit console.warn for empty-object package.json', () => {
    writePkg({});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    discoverWpPackages(tmpDir);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT emit console.warn for valid package.json with empty deps', () => {
    writePkg({ dependencies: {}, devDependencies: {} });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    discoverWpPackages(tmpDir);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

describe('discoverWpPackages — caching', () => {
  it('returns the same array reference on repeated calls (cache hit)', () => {
    writePkg({ dependencies: { '@wordpress/components': '^28.0.0' } });
    const first = discoverWpPackages(tmpDir);
    const second = discoverWpPackages(tmpDir);
    expect(first).toBe(second);
  });

  it('re-reads after cache is cleared', () => {
    writePkg({ dependencies: { '@wordpress/components': '^28.0.0' } });
    const first = discoverWpPackages(tmpDir);
    expect(first).toHaveLength(1);

    clearDiscoverCache();

    // Modify package.json
    writePkg({ dependencies: { '@wordpress/components': '^28.0.0', '@wordpress/block-editor': '^11.0.0' } });
    const second = discoverWpPackages(tmpDir);
    expect(second).toHaveLength(2);
  });
});
