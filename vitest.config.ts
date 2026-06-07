// Root vitest config — runs each package's tests in its own context.
// Per-package `vitest.config.ts` overrides as needed.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['packages/*/tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/lib/**', '**/es/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/types.ts'],
    },
  },
  resolve: {
    alias: {
      // Monorepo cross-package imports resolve to the source (not the
      // built lib/es), so the source under test sees the latest code.
      '@monbolc/lowcode-types': new URL('./packages/types/src/index.ts', import.meta.url).pathname,
      '@monbolc/lowcode-utils': new URL('./packages/utils/src/index.ts', import.meta.url).pathname,
      '@monbolc/lowcode-plugin-command': new URL('./packages/plugin-command/src/index.ts', import.meta.url).pathname,
      '@monbolc/lowcode-editor-core': new URL('./packages/editor-core/src/index.ts', import.meta.url).pathname,
      '@monbolc/lowcode-renderer-core': new URL('./packages/renderer-core/src/index.ts', import.meta.url).pathname,
      '@monbolc/lowcode-plugin-outline-pane': new URL('./packages/plugin-outline-pane/src/index.ts', import.meta.url).pathname,
    },
  },
});
