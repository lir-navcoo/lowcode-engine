/**
 * Test 4 of 5 — P2.5 demo E2E
 *
 * Drives the L2 CommandManager (exposed on `engine.commands` by
 * this PR) through the engine's API directly: register a command,
 * execute it, undo, redo, and assert the state on a captured
 * variable. Then click the toolbar Undo/Redo buttons to verify
 * the click path doesn't throw.
 *
 * Note: state across the test is captured inside ONE page.evaluate
 * to avoid the "global wiped between calls" race that hits Playwright
 * runs against a hot-reloading Vite dev server.
 */
import { test, expect } from '@playwright/test';

test('L2 CommandManager undo/redo on a real document mutation', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#skeleton')).toBeVisible();
  await page.waitForFunction(
    () => (window as unknown as { __sapu_engine__?: unknown }).__sapu_engine__ !== undefined,
  );

  // Toolbar buttons exist (the public path the user actually uses).
  await expect(page.locator('#undo')).toBeVisible();
  await expect(page.locator('#redo')).toBeVisible();

  // Run the full execute/undo/redo sequence inside a single
  // page.evaluate so the captured `value` lives in one closure.
  const trace = await page.evaluate(async () => {
    const w = window as unknown as {
      __sapu_engine__: {
        commands: {
          register(cmd: {
            name: string;
            execute(): { prev: string; current: string };
            undo(args: undefined, returnValue: { prev: string; current: string }): string;
          }): void;
          execute(name: string): Promise<unknown>;
          undo(): Promise<void>;
          redo(): Promise<void>;
          canUndo(): boolean;
          canRedo(): boolean;
        };
      };
    };
    let value = 'A';
    w.__sapu_engine__.commands.register({
      name: 'sapu.e2e.bump',
      execute() {
        const prev = value;
        value = prev === 'A' ? 'B' : 'A';
        return { prev, current: value };
      },
      undo(_args, returnValue) {
        // returnValue.prev = the value BEFORE the matching execute().
        value = returnValue.prev;
        return value;
      },
    });

    const result: { step: string; value: string; canUndo: boolean; canRedo: boolean }[] = [];
    result.push({ step: 'init', value, canUndo: w.__sapu_engine__.commands.canUndo(), canRedo: w.__sapu_engine__.commands.canRedo() });

    await w.__sapu_engine__.commands.execute('sapu.e2e.bump');
    result.push({ step: 'execute', value, canUndo: w.__sapu_engine__.commands.canUndo(), canRedo: w.__sapu_engine__.commands.canRedo() });

    await w.__sapu_engine__.commands.undo();
    result.push({ step: 'undo', value, canUndo: w.__sapu_engine__.commands.canUndo(), canRedo: w.__sapu_engine__.commands.canRedo() });

    await w.__sapu_engine__.commands.redo();
    result.push({ step: 'redo', value, canUndo: w.__sapu_engine__.commands.canUndo(), canRedo: w.__sapu_engine__.commands.canRedo() });

    return result;
  });

  expect(trace).toEqual([
    { step: 'init',   value: 'A', canUndo: false, canRedo: false },
    { step: 'execute', value: 'B', canUndo: true,  canRedo: false },
    { step: 'undo',   value: 'A', canUndo: false, canRedo: true  },
    { step: 'redo',   value: 'B', canUndo: true,  canRedo: false },
  ]);

  // The toolbar Undo button calls engine.commands.undo() — clicking
  // it now should pop the redo entry's inverse and revert the
  // (just-redone) state back to 'A'. (Then we redo via the toolbar
  // to put it back, so subsequent tests see a clean state.)
  await page.locator('#undo').click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __sapu_engine__?: { commands: { canRedo(): boolean } } }).__sapu_engine__!.commands.canRedo()))
    .toBe(true);

  await page.locator('#redo').click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __sapu_engine__?: { commands: { canUndo(): boolean } } }).__sapu_engine__!.commands.canUndo()))
    .toBe(true);
});
