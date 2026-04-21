#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);
const CONSOLE_REGEX = /\bconsole\.(log|error|warn|info|debug|trace)\s*\(/g;

const results = [];

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const ext = path.extname(entry.name);
    if (!ALLOWED_EXT.has(ext)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      CONSOLE_REGEX.lastIndex = 0;
      if (CONSOLE_REGEX.test(lines[i])) {
        results.push({
          file: path.relative(ROOT, fullPath),
          line: i + 1,
          code: lines[i].trim(),
        });
      }
    }
  }
};

if (!fs.existsSync(SRC_DIR)) {
  process.exit(0);
}

walk(SRC_DIR);

if (results.length === 0) {
  process.exit(0);
}

console.error('\n[security] console.* is not allowed in src/ files:\n');
for (const item of results) {
  console.error(`- ${item.file}:${item.line}`);
  console.error(`  ${item.code}`);
}
console.error('\nRemove these logs before deploying.\n');
process.exit(1);
