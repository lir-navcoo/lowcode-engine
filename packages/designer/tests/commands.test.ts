import { describe, it, expect, beforeEach } from 'vitest';
import { CommandManager } from '@monbolc/lowcode-plugin-command';
import { DocumentModel } from '../src/document';
import { Project } from '../src/project';
import { InsertCommand, RemoveCommand, MoveCommand, SetPropCommand, RenameCommand, DetectingCommand, ScrollerCommand, ClipboardCommand } from '../src/commands';
import { deepClone } from '@monbolc/lowcode-utils';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const SEED: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'A' },
    { componentName: 'B' },
  ],
};

describe('Document commands (undo/redo)', () => {
  let project: Project;
  let mgr: CommandManager;
  let root: IPublicTypeRootSchema;
  beforeEach(() => {
    root = deepClone(SEED);
    project = new Project(root);
    mgr = new CommandManager();
  });

  it('InsertCommand: execute adds, undo removes', async () => {
    mgr.register(new InsertCommand(project.document));
    const page = project.document.getNode(project.document.root.key as string)!;
    const result = await mgr.execute('document.insert', { schema: { componentName: 'C' }, parentId: page.id, index: 0 });
    expect(project.document.root.children!.length).toBe(3);
    expect(project.document.root.children![0].componentName).toBe('C');
    await mgr.undo();
    expect(project.document.root.children!.length).toBe(2);
    expect(project.document.root.children!.map((c) => c.componentName)).toEqual(['A', 'B']);
  });

  it('RemoveCommand: execute removes, undo re-inserts at same position', async () => {
    mgr.register(new RemoveCommand(project.document));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    await mgr.execute('document.remove', { nodeId: a.id });
    expect(project.document.root.children!.length).toBe(1);
    expect(project.document.root.children![0].componentName).toBe('B');
    await mgr.undo();
    expect(project.document.root.children!.length).toBe(2);
    expect(project.document.root.children![0].componentName).toBe('A');
  });

  it('MoveCommand: execute moves, undo restores original position', async () => {
    mgr.register(new MoveCommand(project.document));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    const b = project.document.getNode(project.document.root.key as string)!.children[1];
    await mgr.execute('document.move', { nodeId: a.id, newParentId: b.id, newIndex: 0 });
    expect(project.document.root.children!.map((c) => c.componentName)).toEqual(['B']);
    const bNode = project.document.getNode(b.id)!;
    expect(bNode.children[0].componentName).toBe('A');
    await mgr.undo();
    expect(project.document.root.children!.map((c) => c.componentName)).toEqual(['A', 'B']);
  });

  it('SetPropCommand: execute changes, undo restores', async () => {
    mgr.register(new SetPropCommand(project.document));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    await mgr.execute('document.setProp', { nodeId: a.id, key: 'foo', value: 'bar' });
    expect((a.schema.props as Record<string, unknown>).foo).toBe('bar');
    await mgr.undo();
    expect((a.schema.props as Record<string, unknown>).foo).toBeUndefined();
  });

  it('SetPropCommand: multiple consecutive edits merge into one history entry', async () => {
    mgr.register(new SetPropCommand(project.document));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    await mgr.execute('document.setProp', { nodeId: a.id, key: 'x', value: 1 });
    await mgr.execute('document.setProp', { nodeId: a.id, key: 'x', value: 2 });
    await mgr.execute('document.setProp', { nodeId: a.id, key: 'x', value: 3 });
    expect(mgr.undoStackSize()).toBe(1);
    await mgr.undo();
    expect((a.schema.props as Record<string, unknown>).x).toBeUndefined();
  });

  it('RenameCommand: execute renames, undo restores', async () => {
    mgr.register(new RenameCommand(project.document));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    await mgr.execute('document.rename', { nodeId: a.id, newName: 'Z' });
    expect(a.componentName).toBe('Z');
    await mgr.undo();
    expect(a.componentName).toBe('A');
  });

  it('typical editor flow: insert + edit + rename, then 3x undo', async () => {
    mgr.register(new InsertCommand(project.document));
    mgr.register(new SetPropCommand(project.document));
    mgr.register(new RenameCommand(project.document));
    const page = project.document.getNode(project.document.root.key as string)!;
    const a = project.document.getNode(project.document.root.key as string)!.children[0];

    await mgr.execute('document.insert', { schema: { componentName: 'C' }, parentId: page.id, index: 0 });
    const newId = project.document.root.children![0].key as string;
    await mgr.execute('document.setProp', { nodeId: newId, key: 'k', value: 'v' });
    await mgr.execute('document.rename', { nodeId: a.id, newName: 'AA' });

    await mgr.undo();
    expect(a.componentName).toBe('A');
    await mgr.undo();
    expect((project.document.getNode(newId)!.schema.props as Record<string, unknown>).k).toBeUndefined();
    await mgr.undo();
    expect(project.document.root.children!.map((c) => c.componentName)).toEqual(['A', 'B']);
  });
});

// ============================================================================
// F: P2.2 — Detecting / Scroller / Clipboard commands
// ============================================================================

describe('DetectingCommand (F: hover)', () => {
  it('sets the detecting id and emits detectingChanged', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new DetectingCommand(project);
    const seen: Array<{ id: string | null }> = [];
    project.events.on('detectingChanged', (e) => seen.push(e));

    cmd.execute({ nodeId: 'n_1' });
    expect(project.getDetecting()).toBe('n_1');
    expect(seen).toEqual([{ id: 'n_1' }]);
  });

  it('undo restores the previous detecting id', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new DetectingCommand(project);
    cmd.execute({ nodeId: 'n_1' });
    cmd.undo({ nodeId: 'n_1' }, null);
    expect(project.getDetecting()).toBeNull();
  });

  it('clears to null when set to null', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new DetectingCommand(project);
    cmd.execute({ nodeId: 'n_1' });
    cmd.execute({ nodeId: null });
    expect(project.getDetecting()).toBeNull();
  });
});

describe('ScrollerCommand (F: scroll into view)', () => {
  it('invokes the onScroll callback with the node id and block', () => {
    const project = new Project(deepClone(SEED));
    const seen: Array<{ id: string; block: string }> = [];
    const cmd = new ScrollerCommand(project, (id, block) => {
      seen.push({ id, block });
      return true;
    });

    const result = cmd.execute({ nodeId: 'n_42', block: 'center' });
    expect(result).toBe(true);
    expect(seen).toEqual([{ id: 'n_42', block: 'center' }]);
  });

  it('defaults block to "nearest"', () => {
    const project = new Project(deepClone(SEED));
    const seen: Array<{ block: string }> = [];
    new ScrollerCommand(project, (_id, block) => {
      seen.push({ block });
      return true;
    }).execute({ nodeId: 'n_x' });
    expect(seen[0].block).toBe('nearest');
  });

  it('undo is a no-op (returns false)', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new ScrollerCommand(project, () => true);
    expect(cmd.undo()).toBe(false);
  });
});

describe('ClipboardCommand (F: cut / copy / paste)', () => {
  it('copy stores the schema on the project clipboard', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new ClipboardCommand(project);
    const a = project.document.root.children![0];
    const aId = a.key as string;

    cmd.execute({ op: 'copy', nodeId: aId });

    const cb = project.getClipboard();
    expect(cb).not.toBeNull();
    expect((cb!.schema as { componentName: string }).componentName).toBe('A');
    expect(cb!.sourceId).toBe(aId);
  });

  it('cut also stores the schema (does not remove the node)', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new ClipboardCommand(project);
    const a = project.document.root.children![0];
    const aId = a.key as string;

    cmd.execute({ op: 'cut', nodeId: aId });

    // cut is a no-op-on-document: it sets the clipboard, leaves the
    // node in place. The host can call RemoveCommand separately if
    // it wants a single undo entry.
    expect(project.getClipboard()?.sourceId).toBe(aId);
    expect(project.document.root.children!.length).toBe(2);
  });

  it('paste inserts the schema at the given index', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new ClipboardCommand(project);
    const a = project.document.root.children![0];
    cmd.execute({ op: 'copy', nodeId: a.key as string });
    const beforeCount = project.document.root.children!.length;

    cmd.execute({ op: 'paste', parentId: project.document.root.key as string, index: 0 });

    expect(project.document.root.children!.length).toBe(beforeCount + 1);
    expect(project.document.root.children![0].componentName).toBe('A');
  });

  it('paste without a prior clipboard is a no-op', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new ClipboardCommand(project);
    const before = project.document.root.children!.length;
    cmd.execute({ op: 'paste', parentId: project.document.root.key as string, index: 0 });
    expect(project.document.root.children!.length).toBe(before);
  });

  it('undo restores the previous clipboard state', () => {
    const project = new Project(deepClone(SEED));
    const cmd = new ClipboardCommand(project);
    const a = project.document.root.children![0];
    cmd.execute({ op: 'copy', nodeId: a.key as string });
    const after = project.getClipboard();

    cmd.undo({ op: 'paste' }, null);
    expect(project.getClipboard()).toBeNull();

    // restore
    project.setClipboard(after);
    expect(project.getClipboard()?.sourceId).toBe(a.key as string);
  });
});
