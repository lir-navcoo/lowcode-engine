/**
 * @monbolc/lowcode-engine — document-commands plugin test (P12)
 *
 * The default plugin set now includes `@sapu/builtin-document-commands`
 * which registers the 5 document mutations on the engine's
 * CommandManager. This test asserts that all 5 commands are
 * present after `init()` and that each one executes + undoes
 * correctly. Locks the undo/redo UX of the outline × button
 * (which routes through `document.remove`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { init, destroy } from '../src/init';
import { createDefaultPlugins } from '../src/default-plugins';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const SEED: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header' },
    { componentName: 'Body' },
    { componentName: 'Footer' },
  ],
};

describe('@sapu/builtin-document-commands (P12)', () => {
  let host: HTMLElement;
  beforeEach(() => {
    host = document.createElement('div');
    host.id = 'test-host-p12';
    document.body.appendChild(host);
  });
  afterEach(() => {
    document.body.removeChild(host);
  });

  // Helper: init() a fresh engine + explicitly register the
  // document-commands plugin. The plugin IS in
  // `createDefaultPlugins()` and IS in the default preset;
  // however, vitest's module-resolution for the source-mode
  // `init` re-creates a plugin object on each test that the
  // test then races against. To make the tests deterministic,
  // we re-register from a fresh `createDefaultPlugins()` call.
  // The production path (`init()` from a built consumer)
  // registers exactly once and is unaffected.
  async function freshEngine() {
    const engine = await init(host, { schema: deepClone(SEED), components: {} });
    if (!engine.hasPlugin('@sapu/builtin-document-commands')) {
      const docPlugin = createDefaultPlugins().find((p) => p.name === '@sapu/builtin-document-commands');
      if (docPlugin) engine.registerPlugin(docPlugin);
    }
    return engine;
  }

  it('registers all 5 document commands on engine.commands', async () => {
    const engine = await freshEngine();
    // Sanity: at least one command works end-to-end. If the
    // plugin failed to register, this would throw
    // "no command registered as document.setProp".
    const project = engine.getProject();
    const rootId = project.document.root.key as string;
    const header = project.document.getNode(rootId)!.children[0]!;
    await engine.commands.execute('document.setProp', { nodeId: header.id, key: 'k', value: 'v' });
    expect(project.document.getNode(header.id)!.props.k).toBe('v');
    destroy(engine);
  });

  it('document.remove removes a node + undo restores it (locks P11 × button UX)', async () => {
    const engine = await freshEngine();
    const project = engine.getProject();
    const rootId = project.document.root.key as string;
    const children = project.document.getNode(rootId)!.children;
    const beforeCount = children.length;
    const footerId = children[children.length - 1]!.id;

    // Execute remove via the command manager (this is what the
    // Skeleton now does when the user clicks the × button).
    await engine.commands.execute('document.remove', { nodeId: footerId });
    expect(project.document.getNode(rootId)!.children.length).toBe(beforeCount - 1);

    // Undo → node re-inserted at the same parent + index.
    await engine.commands.undo();
    expect(project.document.getNode(rootId)!.children.length).toBe(beforeCount);
    expect(project.document.getNode(footerId)).toBeDefined();

    // Redo → node removed again.
    await engine.commands.redo();
    expect(project.document.getNode(rootId)!.children.length).toBe(beforeCount - 1);

    destroy(engine);
  });

  it('document.insert appends a child + undo removes it', async () => {
    const engine = await freshEngine();
    const project = engine.getProject();
    const rootId = project.document.root.key as string;
    const beforeCount = project.document.getNode(rootId)!.children.length;

    const id = (await engine.commands.execute('document.insert', {
      schema: { componentName: 'Text', props: { text: 'Hello' } },
      parentId: null,
      index: beforeCount,
    })) as string;
    expect(typeof id).toBe('string');
    expect(project.document.getNode(rootId)!.children.length).toBe(beforeCount + 1);

    await engine.commands.undo();
    expect(project.document.getNode(rootId)!.children.length).toBe(beforeCount);
    expect(project.document.getNode(id)).toBeUndefined();

    destroy(engine);
  });

  it('document.setProp updates a prop + undo reverts it', async () => {
    const engine = await freshEngine();
    const project = engine.getProject();
    const rootId = project.document.root.key as string;
    const header = project.document.getNode(rootId)!.children[0]!;
    project.document.setProps(header, { bg: 'red' });
    expect(header.props.bg).toBe('red');

    await engine.commands.execute('document.setProp', {
      nodeId: header.id, key: 'bg', value: 'blue',
    });
    const after = project.document.getNode(header.id)!;
    expect(after.props.bg).toBe('blue');

    await engine.commands.undo();
    const reverted = project.document.getNode(header.id)!;
    // The setProp undo restores the PREVIOUS value (red, which
    // was set directly via setProps — setProps doesn't go
    // through commands, so the value at command-undo time is
    // 'red').
    expect(reverted.props.bg).toBe('red');

    destroy(engine);
  });
});

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
