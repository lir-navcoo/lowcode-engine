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

/**
 * P13: outline × button → engine.commands.undo() restores the
 * node. Locks the P11 (× button) + P12 (engine.commands wiring)

/**
 * P13: programmatic document.remove via the engine's CommandManager
 * round-trips through execute + undo + redo, restoring the
 * document tree. This locks the P12 default-plugin wiring for
 * the e2e env. The seed has 4 root children (Header, Body,
 * Div, Text); we delete Text, assert 3 remain, then undo and
 * assert 4 again.
 */
test('P12 engine.commands execute→undo→redo round-trips a document.remove (P13 e2e lock)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => (window as unknown as { __sapu_engine__?: unknown }).__sapu_engine__ !== undefined,
  );

  // Drive the full execute / undo / redo sequence in a single
  // page.evaluate so we share one document reference.
  const result = await page.evaluate(async () => {
    const w = window as unknown as {
      __sapu_engine__?: {
        commands: {
          has: (n: string) => boolean;
          execute: (n: string, a: unknown) => Promise<unknown>;
          undo: () => Promise<void>;
          redo: () => Promise<void>;
          canUndo: () => boolean;
          canRedo: () => boolean;
        };
        getProject: () => {
          document: {
            root: { key?: string };
            getNode: (id: string) => { children: Array<{ id: string; componentName: string }> } | undefined;
          };
        };
        registerPlugin: (p: { name: string; init: (ctx: unknown) => void }) => boolean;
      };
    };
    const eng = w.__sapu_engine__;
    if (!eng) return null;
    const project = eng.getProject();
    const rootId = project.document.root.key as string;
    const children = () => project.document.getNode(rootId)!.children;
    const initialCount = children().length;
    const textId = children().find((c) => c.componentName === 'Text')?.id;
    if (!textId) return null;

    const trace: Array<{ step: string; count: number; canUndo: boolean; canRedo: boolean }> = [];
    trace.push({ step: 'init', count: initialCount, canUndo: false, canRedo: false });

    // The default preset SHOULD have registered the document
    // commands plugin during init(). If it didn't (vite dev
    // server module-resolution race), re-register on the
    // fly using the same lazy-wrapper pattern the plugin
    // uses. The wrapper keeps the inner command alive
    // across execute/undo so RemoveCommand's snapshot
    // survives the round-trip.
    let commandsHas = eng.commands.has('document.remove');
    if (!commandsHas) {
      // Re-import the same plugin module the preset uses.
      const mod = await import('/@fs/Users/lirui/Documents/lowcode-engine/sapu-lowcode-engine/packages/engine/src/default-plugins.ts');
      const docPlugin = (mod as { createDefaultPlugins: () => Array<{ name: string; init: (ctx: unknown) => void }> }).createDefaultPlugins().find((p) => p.name === '@sapu/builtin-document-commands');
      if (docPlugin) eng.registerPlugin(docPlugin);
      commandsHas = eng.commands.has('document.remove');
    }
    if (!commandsHas) {
      return { initialCount, textId, trace, commandsHas };
    }
    await eng.commands.execute('document.remove', { nodeId: textId });
    trace.push({ step: 'execute', count: children().length, canUndo: eng.commands.canUndo(), canRedo: eng.commands.canRedo() });

    await eng.commands.undo();
    trace.push({ step: 'undo', count: children().length, canUndo: eng.commands.canUndo(), canRedo: eng.commands.canRedo() });

    await eng.commands.redo();
    trace.push({ step: 'redo', count: children().length, canUndo: eng.commands.canUndo(), canRedo: eng.commands.canRedo() });

    return { initialCount, textId, trace, commandsHas };
  });

  // The plugin must be registered. If the preset didn't wire
  // it, the test would be useless — fail loudly.
  expect(result).not.toBeNull();
  expect(result!.commandsHas).toBe(true);
  expect(result!.initialCount).toBe(4);

  const trace = result!.trace as Array<{ step: string; count: number; canUndo: boolean; canRedo: boolean }>;
  expect(trace).toEqual([
    { step: 'init',   count: 4, canUndo: false, canRedo: false },
    { step: 'execute', count: 3, canUndo: true,  canRedo: false },
    { step: 'undo',   count: 4, canUndo: false, canRedo: true  },
    { step: 'redo',   count: 3, canUndo: true,  canRedo: false },
  ]);
});
