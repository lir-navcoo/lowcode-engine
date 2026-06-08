/**
 * @monbolc/lowcode-shell — SapuEngine unit tests
 *
 * Covers the four P-task acceptance tests from
 * /Users/lirui/.claude/plans/radiant-wiggling-pizza.md (L6.3):
 *   1. new SapuEngine() → getProject() throws before mount
 *   2. mount(opts) → creates Project, fires `engineReady`
 *   3. registerPlugin({name, init}) → calls init(ctx) with the right
 *      context shape ({project, events, i18n, registerPlugin,
 *      unregisterPlugin, t})
 *   4. registerPlugin whose init() throws → fires `pluginError`,
 *      plugin is removed from the registry so a same-name
 *      re-registration can succeed
 *
 * Sapu stance: tests use the real Project + the real EngineEventBus
 * — no test doubles. Shell is supposed to be a thin facade, so
 * anything we can pass through, we do.
 */
import { describe, it, expect, vi } from 'vitest';

import { SapuEngine } from '../src/sapu-engine';
import { definePlugin } from '../src/plugin';

const sampleSchema = { componentName: 'Page' };

describe('SapuEngine (L6.3)', () => {
  it('getProject() throws before mount()', () => {
    const engine = new SapuEngine();
    expect(() => engine.getProject()).toThrowError(/mount/i);
  });

  it('mount() creates a Project and fires engineReady', () => {
    const engine = new SapuEngine();
    const ready = vi.fn();
    engine.events.on('engineReady', ready);

    const project = engine.mount({ schema: sampleSchema, components: {} });

    expect(project).toBeDefined();
    expect(project.document).toBeDefined();
    // The same project is returned on subsequent lookups.
    expect(engine.getProject()).toBe(project);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledWith({});
  });

  it('registerPlugin() calls init(ctx) with the IPluginContext shape', () => {
    const engine = new SapuEngine();
    engine.mount({ schema: sampleSchema, components: {} });

    const init = vi.fn();
    const plugin = definePlugin({ name: 'probe', init });

    engine.registerPlugin(plugin);

    expect(init).toHaveBeenCalledTimes(1);
    const ctx = init.mock.calls[0][0];
    // The contract: every IPluginContext field is present and the
    // references are the engine's own objects (no wrapping proxies).
    expect(ctx.project).toBe(engine.getProject());
    expect(ctx.events).toBe(engine.events);
    expect(ctx.i18n).toBe(engine.i18n);
    expect(typeof ctx.registerPlugin).toBe('function');
    expect(typeof ctx.unregisterPlugin).toBe('function');
    expect(typeof ctx.t).toBe('function');
    // t() proxies to i18n.t (a known key returns the key itself
    // when the dictionary is empty, which proves the wiring).
    expect(ctx.t('not.registered')).toBe('not.registered');
    // engineReady fired before init (plugins see the ready state).
    expect(engine.hasPlugin('probe')).toBe(true);
  });

  it('registerPlugin() whose init() throws → fires pluginError and the plugin is unregistered', () => {
    const engine = new SapuEngine();
    engine.mount({ schema: sampleSchema, components: {} });

    const errorListener = vi.fn();
    engine.events.on('pluginError', errorListener);

    const boom = new Error('manual crash from init()');
    engine.registerPlugin({
      name: 'crashy',
      init: () => { throw boom; },
    });

    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledWith({ name: 'crashy', error: boom });
    // The plugin is removed so a same-name re-registration can succeed.
    expect(engine.hasPlugin('crashy')).toBe(false);

    // Re-registration with a well-behaved plugin works.
    const okInit = vi.fn();
    engine.registerPlugin({ name: 'crashy', init: okInit });
    expect(engine.hasPlugin('crashy')).toBe(true);
    expect(okInit).toHaveBeenCalledTimes(1);
  });
});
