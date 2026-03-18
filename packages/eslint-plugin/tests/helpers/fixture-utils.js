import fs from 'node:fs';
import path from 'node:path';

export function writePluginHeader(dir, wpVersion) {
  const dirName = path.basename(dir);
  fs.writeFileSync(
    path.join(dir, `${dirName}.php`),
    `<?php\n/**\n * Plugin Name: Test Plugin\n * Requires at least: ${wpVersion}\n */\n`,
  );
}

export function writeThemeHeader(dir, wpVersion) {
  fs.writeFileSync(
    path.join(dir, 'style.css'),
    `/*\nTheme Name: Test Theme\nRequires at least: ${wpVersion}\n*/\n`,
  );
}

export function createFixtureSubdir(parentDir, name) {
  const dir = path.join(parentDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  fs.writeFileSync(path.join(dir, 'test-file.js'), '');
  return dir;
}

export function writePkg(dir, content) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(content));
}
