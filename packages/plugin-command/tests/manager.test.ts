import { describe, it, expect, vi } from 'vitest';
import { CommandManager } from '../src/manager';
import type { ICommand } from '../src/types';

const makeCmd = (overrides: Partial<ICommand> & { name: string }): ICommand => ({
  execute: () => undefined,
  ...overrides,
});

describe('CommandManager', () => {
  it('rejects duplicate registration', () => {
    const mgr = new CommandManager();
    mgr.register(makeCmd({ name: 'foo' }));
    expect(() => mgr.register(makeCmd({ name: 'foo' }))).toThrow();
  });

  it('unregister returns true / false correctly', () => {
    const mgr = new CommandManager();
    mgr.register(makeCmd({ name: 'foo' }));
    expect(mgr.unregister('foo')).toBe(true);
    expect(mgr.has('foo')).toBe(false);
    expect(mgr.unregister('foo')).toBe(false);
  });

  it('execute throws for unknown command', async () => {
    const mgr = new CommandManager();
    await expect(mgr.execute('nope')).rejects.toThrow();
  });

  it('execute does NOT push to history on throw', async () => {
    const mgr = new CommandManager();
    mgr.register(makeCmd({
      name: 'bad',
      execute: () => { throw new Error('boom'); },
      undo: () => undefined,
    }));
    await expect(mgr.execute('bad')).rejects.toThrow('boom');
    expect(mgr.canUndo()).toBe(false);
  });

  it('basic undo reverses the last reversible execute', async () => {
    const mgr = new CommandManager();
    const counter = { v: 0 };
    mgr.register(makeCmd({
      name: 'inc',
      execute: () => { counter.v += 1; },
      undo: () => { counter.v -= 1; },
    }));
    await mgr.execute('inc');
    await mgr.execute('inc');
    expect(counter.v).toBe(2);
    await mgr.undo();
    expect(counter.v).toBe(1);
    await mgr.undo();
    expect(counter.v).toBe(0);
    expect(mgr.canUndo()).toBe(false);
  });

  it('undo is a no-op when stack is empty', async () => {
    const mgr = new CommandManager();
    await mgr.undo(); // no throw
    expect(mgr.canUndo()).toBe(false);
  });

  it('redo re-applies a previously undone command', async () => {
    const mgr = new CommandManager();
    const counter = { v: 0 };
    mgr.register(makeCmd({
      name: 'inc',
      execute: () => { counter.v += 1; },
      undo: () => { counter.v -= 1; },
    }));
    await mgr.execute('inc');
    await mgr.undo();
    expect(counter.v).toBe(0);
    await mgr.redo();
    expect(counter.v).toBe(1);
  });

  it('any new execute clears the redo stack', async () => {
    const mgr = new CommandManager();
    mgr.register(makeCmd({ name: 'noop', execute: () => undefined, undo: () => undefined }));
    await mgr.execute('noop');
    await mgr.undo();
    expect(mgr.canRedo()).toBe(true);
    await mgr.execute('noop');
    expect(mgr.canRedo()).toBe(false);
  });

  it('merges consecutive mergeable commands within window', async () => {
    const mgr = new CommandManager({ autoMerge: true });
    mgr.register(makeCmd({
      name: 'type',
      mergeable: true,
      mergeWindowMs: 60_000,
      execute: () => undefined,
      undo: () => undefined,
    }));
    await mgr.execute('type');
    await mgr.execute('type');
    await mgr.execute('type');
    expect(mgr.undoStackSize()).toBe(1); // all merged
  });

  it('does NOT merge when mergeWindowMs elapsed', async () => {
    const mgr = new CommandManager({ autoMerge: true });
    mgr.register(makeCmd({
      name: 'type',
      mergeable: true,
      mergeWindowMs: 5,
      execute: () => undefined,
      undo: () => undefined,
    }));
    await mgr.execute('type');
    await new Promise((r) => setTimeout(r, 20));
    await mgr.execute('type');
    expect(mgr.undoStackSize()).toBe(2);
  });

  it('does NOT merge different command names', async () => {
    const mgr = new CommandManager({ autoMerge: true });
    mgr.register(makeCmd({ name: 'a', mergeable: true, execute: () => undefined, undo: () => undefined }));
    mgr.register(makeCmd({ name: 'b', mergeable: true, execute: () => undefined, undo: () => undefined }));
    await mgr.execute('a');
    await mgr.execute('b');
    expect(mgr.undoStackSize()).toBe(2);
  });

  it('respects historyLimit (FIFO drop)', async () => {
    const mgr = new CommandManager({ historyLimit: 3 });
    mgr.register(makeCmd({ name: 'noop', execute: () => undefined, undo: () => undefined }));
    for (let i = 0; i < 10; i++) {
      await mgr.execute('noop');
    }
    expect(mgr.undoStackSize()).toBe(3);
  });

  it('emits events on register / unregister / execute / undo / redo / clear', async () => {
    const mgr = new CommandManager();
    const registered = vi.fn();
    const unregistered = vi.fn();
    const executed = vi.fn();
    const undone = vi.fn();
    const redone = vi.fn();
    const cleared = vi.fn();
    mgr.events.on('registered', registered);
    mgr.events.on('unregistered', unregistered);
    mgr.events.on('executed', executed);
    mgr.events.on('undone', undone);
    mgr.events.on('redone', redone);
    mgr.events.on('cleared', cleared);

    mgr.register(makeCmd({ name: 'foo', execute: () => undefined, undo: () => undefined }));
    await mgr.execute('foo');
    await mgr.undo();
    await mgr.redo();
    mgr.unregister('foo');
    mgr.clearHistory();

    expect(registered).toHaveBeenCalledTimes(1);
    expect(unregistered).toHaveBeenCalledTimes(1);
    expect(executed).toHaveBeenCalledTimes(1);
    expect(undone).toHaveBeenCalledTimes(1);
    expect(redone).toHaveBeenCalledTimes(1);
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('unregister also drops in-flight history entries', async () => {
    const mgr = new CommandManager();
    mgr.register(makeCmd({ name: 'foo', execute: () => undefined, undo: () => undefined }));
    await mgr.execute('foo');
    expect(mgr.undoStackSize()).toBe(1);
    mgr.unregister('foo');
    expect(mgr.undoStackSize()).toBe(0);
    expect(mgr.redoStackSize()).toBe(0);
  });
});
