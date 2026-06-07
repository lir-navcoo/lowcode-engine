#!/usr/bin/env node
/**
 * Dev server entry — placeholder for L0.
 *
 * L0 has nothing to serve yet (no engine core, no bundler config).
 * This script exists so `yarn workspace @monbolc/lowcode-ignitor start` works.
 *
 * When L7 (engine) lands, this will be replaced by a Vite/dev-server boot.
 */
console.log('[ignitor] L0 dev server: not yet implemented.');
console.log('[ignitor] In the meantime, the package can be consumed via:');
console.log('  import { bootstrap } from "@monbolc/lowcode-ignitor";');
console.log('[ignitor] (See src/index.ts for the bootstrap signature.)');
process.exit(0);
