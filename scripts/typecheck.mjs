#!/usr/bin/env node
// Run `tsc --noEmit` against every packages/*/tsconfig.json.
// Cross-platform replacement for the `for p in ...; do ...; done`
// bash idiom (which doesn't work when yarn invokes scripts via
// cmd.exe on Windows).
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const packagesDir = join(root, 'packages');
const entries = readdirSync(packagesDir).sort();

// Resolve the tsc binary in the repo's local node_modules so we
// don't rely on npx / global PATH lookups (those are unreliable
// when yarn invokes us via cmd.exe on Windows).
const tscBin = process.platform === 'win32'
  ? pathResolve(root, 'node_modules', '.bin', 'tsc.cmd')
  : pathResolve(root, 'node_modules', '.bin', 'tsc');
if (!existsSync(tscBin)) {
  console.error(`tsc binary not found at ${tscBin}. Run \`yarn install\` first.`);
  process.exit(2);
}

let failed = 0;
for (const name of entries) {
  const tsconfig = join(packagesDir, name, 'tsconfig.json');
  let exists = false;
  try { statSync(tsconfig); exists = true; } catch {}
  if (!exists) continue;
  console.log(`--- ${name}/tsconfig.json ---`);
  try {
    execFileSync(
      tscBin,
      ['-p', tsconfig, '--noEmit'],
      { stdio: 'inherit', shell: process.platform === 'win32' },
    );
  } catch (err) {
    console.error(`(tsc exit code = ${err.status})`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} package(s) failed typecheck.`);
  process.exit(1);
}
console.log('\nAll packages: 0 errors.');

