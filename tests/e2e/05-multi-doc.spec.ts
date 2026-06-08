/**
 * Test 5 of 5 — P2.5 demo E2E
 *
 * Open a second editing session via the toolbar, verify both
 * sessions render in the row container, then close the second
 * session and verify only the first remains. Exercises the L5
 * Workspace / Resource / EditorWindow layer mounted side-by-side
 * with a shared `components` registry but independent Project +
 * selection state.
 */
import { test, expect } from '@playwright/test';

test('open and close a second editing session', async ({ page }) => {
  await page.goto('/');

  // Before: only #skeleton (the first Skeleton) is mounted.
  await expect(page.locator('#skeleton')).toBeVisible();
  await expect(page.locator('#skeleton-2')).toHaveCount(0);

  // Click the "Open second doc" button (vanilla DOM, index.html).
  await page.locator('#open-second').click();

  // The second Skeleton mounts into #skeleton-2 (a sibling div
  // appended to #skeleton-row). Its initial schema has a
  // Header (className: "header-2") and a Main (className: "main-2"),
  // so we can assert on those — they're the unique signal that
  // the second doc rendered with its own data, not the first doc's.
  await expect(page.locator('#skeleton-2')).toBeVisible({ timeout: 3000 });
  const second = page.locator('#skeleton-2');
  await expect(second.locator('header.header-2')).toHaveCount(1);
  await expect(second.locator('main.main-2')).toHaveCount(1);

  // The first doc is unchanged.
  const first = page.locator('#skeleton');
  await expect(first.locator('header.header')).toHaveCount(1);

  // Button label flips to "Close second doc" (set by the demo's
  // useEffect that watches `secondActive`).
  await expect(page.locator('#open-second')).toHaveText('Close second doc');

  // Close.
  await page.locator('#open-second').click();
  await expect(page.locator('#skeleton-2')).toHaveCount(0);
  await expect(page.locator('#skeleton')).toBeVisible();
  await expect(page.locator('#open-second')).toHaveText('Open second doc');
});
