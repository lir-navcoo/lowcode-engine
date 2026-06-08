/**
 * Test 1 of 5 — P2.5 demo E2E
 *
 * Sanity check: the demo mounts, the toolbar is present, and the
 * initial schema's root nodes (Header, Body, Sidebar, Main, Div,
 * Text) all appear on the canvas. If this fails, the rest of the
 * suite is meaningless — every subsequent test assumes a loaded
 * project.
 */
import { test, expect } from '@playwright/test';

test('demo mounts and renders the initial schema on the canvas', async ({ page }) => {
  await page.goto('/');

  // Toolbar buttons (vanilla DOM in index.html) should be present.
  await expect(page.locator('#add-footer')).toBeVisible();
  await expect(page.locator('#reset')).toBeVisible();
  await expect(page.locator('#undo')).toBeVisible();
  await expect(page.locator('#redo')).toBeVisible();
  await expect(page.locator('#open-second')).toBeVisible();

  // The skeleton mounts into #skeleton; the initial schema has a
  // Header, Body, Sidebar, Main, Div, and Text node. The user
  // components render plain text in <header>/<section>/<aside>/etc.
  // Use the semantic role of each tag to disambiguate from the
  // outline tree (which also has the same titles as text nodes).
  const canvas = page.locator('#skeleton');
  // <header> → role=banner
  await expect(canvas.getByRole('banner')).toBeVisible();
  // <aside> → role=complementary
  await expect(canvas.getByRole('complementary')).toBeVisible();
  // <main> → role=main
  await expect(canvas.getByRole('main')).toBeVisible();
  // The "Hello from Text" string only appears on the canvas (the
  // outline shows the title "Text" + ✎ + <Text>).
  await expect(canvas.getByText('Hello from Text', { exact: true })).toBeVisible();
});
