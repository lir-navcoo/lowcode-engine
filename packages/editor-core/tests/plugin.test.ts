import { describe, it, expect } from 'vitest';
import { Emitter } from '@monbolc/lowcode-utils';
import { PluginManager } from '../src/plugin';
import type { EditorEvents, IPlugin, IPluginContext } from '../src/types';

const mkCtx = (): IPluginContext => {
  const events = new Emitter<EditorEvents>();
  return {
    events,
    i18n: {} as never,
    di: {} as never,
    plugins: {} as never,
    editor: {} as never,
    commands: {} as never,
  };
};

describe('PluginManager', () => {
  it('register rejects duplicate name', () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    mgr.register({ name: 'a' });
    expect(() => mgr.register({ name: 'a' })).toThrow();
  });

  it('register rejects invalid characters in name', () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    expect(() => mgr.register({ name: 'has space' })).toThrow();
  });

  it('has / get / unregister', () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    mgr.register({ name: 'a' });
    expect(mgr.has('a')).toBe(true);
    expect(mgr.get('a')?.name).toBe('a');
    expect(mgr.unregister('a')).toBe(true);
    expect(mgr.has('a')).toBe(false);
  });

  it('sortedByDeps returns deps before dependents', () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    const a: IPlugin = { name: 'A' };
    const b: IPlugin = { name: 'B', dependencies: ['A'] };
    const c: IPlugin = { name: 'C', dependencies: ['B'] };
    mgr.register(c);
    mgr.register(a);
    mgr.register(b);
    const order = mgr.sortedByDeps().map((p) => p.name);
    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('sortedByDeps throws on missing dep', () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    mgr.register({ name: 'A', dependencies: ['Missing'] });
    expect(() => mgr.sortedByDeps()).toThrow(/Missing/);
  });

  it('sortedByDeps throws on circular deps', () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    mgr.register({ name: 'A', dependencies: ['B'] });
    mgr.register({ name: 'B', dependencies: ['A'] });
    expect(() => mgr.sortedByDeps()).toThrow(/circular/i);
  });

  it('initAll runs in dep order', async () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    const calls: string[] = [];
    mgr.register({ name: 'A', init: () => { calls.push('A'); } });
    mgr.register({ name: 'B', dependencies: ['A'], init: () => { calls.push('B'); } });
    mgr.register({ name: 'C', dependencies: ['B'], init: () => { calls.push('C'); } });
    await mgr.initAll(mkCtx());
    expect(calls).toEqual(['A', 'B', 'C']);
  });

  it('initAll throws if any plugin init throws', async () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    mgr.register({ name: 'A' });
    mgr.register({ name: 'B', init: () => { throw new Error('boom'); } });
    await expect(mgr.initAll(mkCtx())).rejects.toThrow('boom');
  });

  it('destroyAll runs in reverse order', async () => {
    const mgr = new PluginManager(new Emitter<EditorEvents>());
    const calls: string[] = [];
    mgr.register({ name: 'A', destroy: () => { calls.push('A'); } });
    mgr.register({ name: 'B', dependencies: ['A'], destroy: () => { calls.push('B'); } });
    mgr.register({ name: 'C', dependencies: ['B'], destroy: () => { calls.push('C'); } });
    await mgr.initAll(mkCtx());
    calls.length = 0;
    await mgr.destroyAll(mkCtx());
    expect(calls).toEqual(['C', 'B', 'A']);
  });

  it('destroyAll swallows errors and emits error event', async () => {
    const events = new Emitter<EditorEvents>();
    const errors: unknown[] = [];
    events.on('error', (e) => errors.push(e));
    const mgr = new PluginManager(events);
    mgr.register({ name: 'A', init: () => undefined, destroy: () => { throw new Error('cleanup failed'); } });
    mgr.register({ name: 'B', init: () => undefined });
    await mgr.initAll(mkCtx());
    await mgr.destroyAll(mkCtx());
    expect(errors).toHaveLength(1);
    expect((errors[0] as { error: Error }).error.message).toBe('cleanup failed');
  });
});
