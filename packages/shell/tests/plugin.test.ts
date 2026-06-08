/**
 * @monbolc/lowcode-shell — plugin contract tests
 *
 * Covers the L6.4 acceptance tests from
 * /Users/lirui/.claude/plans/radiant-wiggling-pizza.md:
 *   1. definePlugin(p) is a pure identity (p === definePlugin(p))
 *   2. The IPluginContext type passes a typecheck smoke test
 *      (verified at compile time — the assertions below use
 *      type-narrowing checks to prove the shape matches the
 *      documented contract).
 *
 * Also covers three additional behaviors that are cheap to assert
 * and protect the contract from future regressions:
 *   - registerPlugin() with a duplicate name throws
 *   - registerPlugin() with an invalid name (whitespace) throws
 *   - registerPlugin() with a destroy() method invokes it on
 *     unregisterPlugin / destroy
 */
import { describe, it, expect, vi } from 'vitest';

import { SapuEngine } from '../src/sapu-engine';
import { definePlugin } from '../src/plugin';
import type { IPluginContext } from '../src/plugin';

describe('Plugin contract (L6.4)', () => {
  it('definePlugin is a pure identity helper', () => {
    const p = { name: 'identity', init: () => {} };
    expect(definePlugin(p)).toBe(p);
  });

  it('IPluginContext shape matches the documented contract', () => {
    const engine = new SapuEngine();
    engine.mount({ schema: { componentName: 'Page' }, components: {} });
    let captured: IPluginContext | null = null;

    engine.registerPlugin({
      name: 'shape-check',
      init: (ctx) => { captured = ctx; },
    });

    expect(captured).not.toBeNull();
    const ctx = captured as unknown as IPluginContext;
    // Every documented IPluginContext field is present and the
    // types match (the TypeScript compiler already verified
    // assignability; here we assert the runtime shape).
    expect(ctx.project).toBe(engine.getProject());
    expect(ctx.events).toBe(engine.events);
    expect(ctx.i18n).toBe(engine.i18n);
    expect(typeof ctx.registerPlugin).toBe('function');
    expect(typeof ctx.unregisterPlugin).toBe('function');
    expect(typeof ctx.t).toBe('function');
  });

  it('registerPlugin with a duplicate name throws', () => {
    const engine = new SapuEngine();
    engine.mount({ schema: { componentName: 'Page' }, components: {} });
    engine.registerPlugin({ name: 'dupe', init: () => {} });
    expect(() => engine.registerPlugin({ name: 'dupe', init: () => {} }))
      .toThrowError(/already registered/);
  });

  it('registerPlugin with an invalid name (whitespace) throws', () => {
    const engine = new SapuEngine();
    engine.mount({ schema: { componentName: 'Page' }, components: {} });
    expect(() => engine.registerPlugin({ name: 'has space', init: () => {} }))
      .toThrowError(/invalid characters/);
  });

  it('destroy() invokes plugin.destroy() and fires engineDestroyed', () => {
    const engine = new SapuEngine();
    engine.mount({ schema: { componentName: 'Page' }, components: {} });
    const destroy = vi.fn();
    engine.registerPlugin({ name: 'tidy', init: () => {}, destroy });

    const destroyed = vi.fn();
    engine.events.on('engineDestroyed', destroyed);
    engine.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroyed).toHaveBeenCalledTimes(1);
    // After destroy, further registerPlugin calls throw.
    expect(() => engine.registerPlugin({ name: 'late', init: () => {} }))
      .toThrowError(/destroy/);
  });

  it('unregisterPlugin() invokes plugin.destroy() and returns true', () => {
    const engine = new SapuEngine();
    engine.mount({ schema: { componentName: 'Page' }, components: {} });
    const destroy = vi.fn();
    engine.registerPlugin({ name: 'removable', init: () => {}, destroy });

    const unregistered = vi.fn();
    engine.events.on('pluginUnregistered', unregistered);

    expect(engine.unregisterPlugin('removable')).toBe(true);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(unregistered).toHaveBeenCalledWith({ name: 'removable' });
    // Second call returns false (no-op).
    expect(engine.unregisterPlugin('removable')).toBe(false);
  });
});
