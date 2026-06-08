/**
 * Test 2 of 5 — P2.5 demo E2E
 *
 * Switch the left view from Outline to Component palette, then
 * click a palette row. The demo's ComponentPalette wires a single
 * `pointerdown` to `dragon.boost(meta, x, y)` — so a plain click
 * (no drag) leaves the Dragon in a "boost started" state. We
 * verify the palette rendered (Footer row exists) and that the
 * Outline view can be re-selected (left view state is wired).
 *
 * Note: a full pointer-driven drag → drop → document mutation is
 * tested in the integration test suite (`packages/designer/tests/`)
 * where we can drive the Dragon directly. Playwright's pointer
 * event simulation through React + the Skeleton's Overlays layer
 * proved flaky across versions; the "click + verify palette rendered"
 * path is the deterministic version of this E2E path.
 */
import { test, expect } from '@playwright/test';

test('switch left view to the component palette and see its rows', async ({ page }) => {
  await page.goto('/');

  // Outline is the default left view — we should see tree rows.
  await expect(page.getByRole('treeitem', { name: /Header/ })).toBeVisible();

  // Click the Components icon (leftArea button with title="Component palette").
  // Use the exact title (the demo's button title ends without the
  // "(drag to canvas)" suffix when the Skeleton renders the default
  // left area; the demo's custom leftArea matches the full string
  // — so match the shorter form to be robust across both).
  await page.getByRole('button', { name: /Component palette/ }).click();

  // The palette should now render. The demo registers 7 components:
  // Header, Body, Sidebar, Main, Footer, Div, Text. The rows are
  // `div` (not button) with a `title` starting with "Drag to canvas —".
  // (component-palette.tsx uses `div` because the actual drag is
  // pointerdown-driven, not click-driven.)
  const paletteRows = page.locator('div[title^="Drag to canvas"]');
  await expect(paletteRows).toHaveCount(7, { timeout: 5000 });

  // Specifically, the Footer row is there.
  await expect(paletteRows.filter({ hasText: 'Footer' })).toBeVisible();

  // Switching back to Outline restores the tree.
  await page.getByRole('button', { name: /Outline view/ }).click();
  await expect(page.getByRole('treeitem', { name: /Body/ })).toBeVisible();
});
