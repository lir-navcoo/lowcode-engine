import { describe, it, expect, beforeEach } from 'vitest';
import { CommandManager } from '@monbolc/lowcode-plugin-command';
import { DocumentModel } from '../src/document';
import { Project } from '../src/project';
import { InsertCommand, RemoveCommand, MoveCommand, SetPropCommand, RenameCommand } from '../src/commands';
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
