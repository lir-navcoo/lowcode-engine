/**
 * Post-build helper: rewrite extensionless relative imports in ESM output
 * to include `.js` (or `./foo/index.js` for directory imports) so raw
 * Node ESM resolution works.
 *
 * Usage: node ../../scripts/add-js-extensions.mjs <dir>
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { argv, exit } from 'node:process';

const root = argv[2];
if (!root) {
  console.error('Usage: node add-js-extensions.mjs <es-output-dir>');
  exit(1);
}

const re = /from\s+(['"])(\.\.?\/[^'"]+)\1/g;

async function resolveImport(fromFile, spec) {
  // spec is "./foo" or "../foo" — extensionless, relative
  const importerDir = dirname(fromFile);
  const abs = resolve(importerDir, spec);
  // Try as file
  if (await pathExists(abs + '.js')) return spec + '.js';
  if (await pathExists(abs + '.mjs')) return spec + '.mjs';
  // Try as directory with index.js
  if (await pathExists(join(abs, 'index.js'))) return spec + '/index.js';
  if (await pathExists(join(abs, 'index.mjs'))) return spec + '/index.mjs';
  // Fallback: append .js (will likely fail at runtime, but at least it's syntactically valid)
  return spec + '.js';
}

async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function walk(d) {
  for (const name of await readdir(d, { withFileTypes: true })) {
    const p = join(d, name.name);
    if (name.isDirectory()) await walk(p);
    else if (extname(p) === '.js') {
      const src = await readFile(p, 'utf8');
      const out = await rewrite(p, src);
      if (out !== src) {
        await writeFile(p, out);
        console.log(`  rewrote: ${p}`);
      }
    }
  }
}

const jsonRe = /from\s+(['"])(\.\.?\/[^'"]+\.json)\1(?!\s+with)/g;

async function rewrite(file, src) {
  // Collect replacements first (need to await stat per import), then apply
  const replacements = [];
  for (const m of src.matchAll(re)) {
    const [whole, q, spec] = m;
    if (/\.[a-z]+$/i.test(spec)) continue; // already has extension
    const resolved = await resolveImport(file, spec);
    if (resolved !== spec) {
      replacements.push({ whole, replacement: `from ${q}${resolved}${q}` });
    }
  }
  // JSON imports need import attributes for raw Node ESM (Node 22+)
  // Bundlers (Vite, esbuild, webpack) accept both forms.
  for (const m of src.matchAll(jsonRe)) {
    const [whole, q, spec] = m;
    replacements.push({ whole, replacement: `from ${q}${spec}${q} with { type: 'json' }` });
  }
  let out = src;
  for (const r of replacements) out = out.replace(r.whole, r.replacement);
  return out;
}

await walk(root);
console.log('done.');
