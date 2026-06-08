/**
 * Test 3 of 5 — P2.5 demo E2E
 *
 * Click a node in the outline tree to select it (asserts the
 * settings panel re-renders with that node's props), then change
 * a string prop and verify the change reflects on the canvas.
 *
 * Mechanism:
 *   - The outline is a react-arborist Tree; rows are `role="treeitem"`.
 *     The Text row's accessible name is "Text ✎ <Text>".
 *   - The settings panel renders each (key, value) prop as a row
 *     with a label div + a setter control (BaseUI Input for strings).
 *   - The Text demo component has a `text` prop; changing it via
 *     the Input setter should update `node.props.text` and the
 *     canvas should re-render with the new text.
 */
import { test, expect } from '@playwright/test';

test('select a node in the outline, edit a prop, see it on canvas', async ({ page }) => {
  await page.goto('/');

  // The Text row in the outline (the only Text node in the schema).
  // Accessible name pattern: "Text ✎ <Text>".
  const textRow = page.getByRole('treeitem', { name: /Text/ });
  await expect(textRow).toBeVisible();

  await textRow.click();

  // The settings panel should now show the Text component header
  // (rendered as a <code> with the componentName).
  await expect(page.locator('code', { hasText: 'Text' })).toBeVisible({ timeout: 3000 });

  // The Text prop is rendered as an <input type="text">. There's
  // exactly one such input for the selected Text node. (If the
  // `text` prop were missing, the panel would still show an Input
  // fallback for any string prop.)
  const textInput = page.locator('input[type="text"]').filter({ hasValue: 'Hello from Text' }).first();
  await expect(textInput).toBeVisible({ timeout: 3000 });

  // Replace the value. Select-all + type is more reliable across
  // input types than fill() in some BaseUI versions.
  await textInput.click();
  await textInput.press('ControlOrMeta+a');
  await textInput.fill('Edited via E2E');
  await textInput.blur();

  // The canvas should now show the new text and not the old one.
  const canvas = page.locator('#skeleton');
  await expect(canvas.getByText('Edited via E2E')).toBeVisible();
  await expect(canvas.getByText('Hello from Text')).toHaveCount(0);
});
