/**
 * Post-build helper: rewrite extensionless relative imports in ESM output
 * to include `.js` so raw Node ESM resolution works.
 *
 * Usage: node ../../scripts/add-js-extensions.mjs <dir>
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { argv, exit } from 'node:process';

const dir = argv[2];
if (!dir) {
  console.error('Usage: node add-js-extensions.mjs <es-output-dir>');
  exit(1);
}

const re = /from\s+(['"])(\.\.?\/[^'"]+)\1/g;

async function walk(d) {
  for (const name of await readdir(d, { withFileTypes: true })) {
    const p = join(d, name.name);
    if (name.isDirectory()) await walk(p);
    else if (extname(p) === '.js') {
      const src = await readFile(p, 'utf8');
      const out = src.replace(re, (_m, q, p2) => {
        // Skip if already has .js / .json / .cjs / .mjs
        if (/\.[a-z]+$/i.test(p2)) return _m;
        return `from ${q}${p2}.js${q}`;
      });
      if (out !== src) {
        await writeFile(p, out);
        console.log(`  rewrote: ${p}`);
      }
    }
  }
}

await walk(dir);
console.log('done.');
