#!/usr/bin/env node
'use strict';

/**
 * Copies the src/data directory into dist/data after a tsc build,
 * so the compiled CLI can resolve compat-data.json at runtime.
 */

const { cpSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
cpSync(join(root, 'src', 'data'), join(root, 'dist', 'data'), { recursive: true });
