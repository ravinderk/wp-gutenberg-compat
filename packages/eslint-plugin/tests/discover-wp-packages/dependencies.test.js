import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverWpPackages, clearDiscoverCache } from '../../src/utils/discover-wp-packages.js';
import { writePkg } from '../helpers/fixture-utils.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-disc-deps-'));
  clearDiscoverCache();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  clearDiscoverCache();
});

describe('discoverWpPackages — dependencies', () => {
  it('returns @wordpress/* packages from dependencies only', () => {
    writePkg(tmpDir, { dependencies: { '@wordpress/components': '^28.0.0', react: '^18.0.0' } });
    expect(discoverWpPackages(tmpDir)).toEqual(['@wordpress/components']);
  });

  it('filters out non-@wordpress packages', () => {
    writePkg(tmpDir, { dependencies: { '@wordpress/components': '^28.0.0', react: '^18.0.0' } });
    const result = discoverWpPackages(tmpDir);
    expect(result).not.toContain('react');
  });

  it('returns empty array when no @wordpress/* entries in dependencies', () => {
    writePkg(tmpDir, { dependencies: { react: '^18.0.0', lodash: '^4.0.0' } });
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });

  it('returns empty array when dependencies is empty', () => {
    writePkg(tmpDir, { dependencies: {} });
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });

  it('returns empty array when neither dependencies nor devDependencies key exists', () => {
    writePkg(tmpDir, { name: 'my-plugin', version: '1.0.0' });
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });

  it('returns empty array for completely empty package.json object', () => {
    writePkg(tmpDir, {});
    expect(discoverWpPackages(tmpDir)).toEqual([]);
  });
});
