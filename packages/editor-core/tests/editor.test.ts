import { describe, it, expect } from 'vitest';
import { Editor } from '../src/editor';
import type { IPlugin } from '../src/types';

describe('Editor', () => {
  it('init fires phase events in order', async () => {
    const editor = new Editor();
    const phases: string[] = [];
    editor.events.on('phase', ({ name }) => phases.push(name));
    await editor.init();
    expect(phases).toEqual(['init', 'register', 'ready']);
    expect(editor.ready).toBe(true);
  });

  it('init runs plugins in dep order', async () => {
    const calls: string[] = [];
    const a: IPlugin = { name: 'A', init: () => { calls.push('A'); } };
    const b: IPlugin = { name: 'B', dependencies: ['A'], init: () => { calls.push('B'); } };
    const editor = new Editor({ plugins: [b, a] });
    await editor.init([{ name: 'C', dependencies: ['B'], init: () => { calls.push('C'); } }]);
    expect(calls).toEqual(['A', 'B', 'C']);
  });

  it('init called twice throws', async () => {
    const editor = new Editor();
    await editor.init();
    await expect(editor.init()).rejects.toThrow(/twice/);
  });

  it('destroy fires destroy phase and clears state', async () => {
    const editor = new Editor();
    const destroyed: string[] = [];
    editor.events.on('phase', ({ name }) => { if (name === 'destroy') destroyed.push('fired'); });
    editor.commands.register({
      name: 'noop',
      execute: () => undefined,
      undo: () => undefined,
    });
    await editor.commands.execute('noop');
    expect(editor.commands.canUndo()).toBe(true);

    await editor.init();
    await editor.destroy();

    expect(destroyed).toEqual(['fired']);
    expect(editor.ready).toBe(false);
    expect(editor.commands.canUndo()).toBe(false);
  });

  it('destroy on a never-initialized editor is a no-op', async () => {
    const editor = new Editor();
    await editor.destroy();
    expect(editor.ready).toBe(false);
  });
});
