import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, '../../packages');

// Vite config for the Sapu demo.
// - Resolves @monbolc/* to the workspace packages' source (so the demo
//   always uses the latest local code without a `yarn build` step).
// - Opens the dev server on :5173.
// - Tailwind v4 (`@tailwindcss/vite`) and the editor-skeleton CSS
//   migration are added in P0.4b; for now this is a plain CSS demo.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@monbolc/lowcode-types':              path.join(packagesDir, 'types/src/index.ts'),
      '@monbolc/lowcode-utils':              path.join(packagesDir, 'utils/src/index.ts'),
      '@monbolc/lowcode-ignitor':            path.join(packagesDir, 'ignitor/src/index.ts'),
      '@monbolc/lowcode-plugin-command':     path.join(packagesDir, 'plugin-command/src/index.ts'),
      '@monbolc/lowcode-editor-core':        path.join(packagesDir, 'editor-core/src/index.ts'),
      '@monbolc/lowcode-renderer-core':      path.join(packagesDir, 'renderer-core/src/index.ts'),
      '@monbolc/lowcode-plugin-outline-pane':path.join(packagesDir, 'plugin-outline-pane/src/index.ts'),
      '@monbolc/lowcode-plugin-setters':     path.join(packagesDir, 'plugin-setters/src/index.ts'),
      '@monbolc/lowcode-react-renderer':     path.join(packagesDir, 'react-renderer/src/index.ts'),
      '@monbolc/lowcode-designer':           path.join(packagesDir, 'designer/src/index.ts'),
      '@monbolc/lowcode-editor-skeleton':    path.join(packagesDir, 'editor-skeleton/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
