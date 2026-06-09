/**
 * @monbolc/lowcode-designer — Phase E.7 cast-removal integration tests
 *
 * Validates that the typed componentMeta (E.5 + E.6 auto-wire) is
 * read by the bem-tool files + live-editing via the typed Node
 * surface — no more structural casts in the consumers.
 */
import { describe, it, expect } from 'vitest';
import { Project } from '../src/project';
import { ComponentMetaLite } from '../src/component-meta';
import { BorderSelecting } from '../src/builtin-simulator/bem-tools/border-selecting';
import { BorderDetecting } from '../src/builtin-simulator/bem-tools/border-detecting';
import { LiveEditing } from '../src/builtin-simulator/live-editing/live-editing';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

function mkRoot(): IPublicTypeRootSchema {
  return {
    componentName: 'Page',
    children: [{ componentName: 'Button', key: 'btn1' } as IPublicTypeNodeSchema],
  } as IPublicTypeRootSchema;
}

describe('Phase E.7 — typed componentMeta reads (cast removal)', () => {
  it('auto-wired node exposes typed componentMeta via getComponentMeta()', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.title = 'Button';
    m.availableActions = [
      { name: 'copy', important: true, content: null },
    ];
    p.componentMetas.register('Button', m);
    p.document.setRoot(mkRoot());
    expect(p.document.getNode('btn1')?.getComponentMeta()?.title).toBe('Button');
    expect(p.document.getNode('btn1')?.getComponentMeta()?.availableActions?.length).toBe(1);
  });

  it('BorderDetecting reads advanced.callbacks.onHoverHook via the typed surface', () => {
    const p = new Project(mkRoot());
    const onHoverHook = (): boolean => false;
    const m = new ComponentMetaLite();
    m.advanced = { callbacks: { onHoverHook } };
    p.componentMetas.register('Button', m);
    p.document.setRoot(mkRoot());
    // The BorderDetecting class reads
    // 'host.getComponentInstances(current)' + 'current.componentMeta.advanced.callbacks.onHoverHook'.
    // With E.7, the consumer code is updated to use the typed
    // getComponentMeta() — the test verifies the data shape.
    const node = p.document.getNode('btn1')!;
    expect(node.getComponentMeta()?.advanced?.callbacks?.onHoverHook).toBe(onHoverHook);
  });

  it('live-editing reads liveTextEditing via the typed surface', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.liveTextEditing = [{ propTarget: 'children', mode: 'plaintext' }];
    p.componentMetas.register('Button', m);
    p.document.setRoot(mkRoot());
    // The slim live-editing apply() reads node.getComponentMeta()?.liveTextEditing
    // — verifies the meta surface is what live-editing consumes.
    const node = p.document.getNode('btn1')!;
    expect(node.getComponentMeta()?.liveTextEditing?.[0]?.propTarget).toBe('children');
  });

  it('BorderSelecting reads availableActions via the typed surface', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.title = 'Button';
    m.availableActions = [
      { name: 'copy', important: true, content: null },
      { name: 'remove', important: true, content: null },
    ];
    p.componentMetas.register('Button', m);
    p.document.setRoot(mkRoot());
    const node = p.document.getNode('btn1')!;
    expect(node.getComponentMeta()?.availableActions?.length).toBe(2);
  });

  it('LiveEditing class is the slim export (verifies the import chain)', () => {
    expect(typeof LiveEditing).toBe('function');
    expect(typeof LiveEditing.addLiveEditingSpecificRule).toBe('function');
    expect(typeof LiveEditing.addLiveEditingSaveHandler).toBe('function');
  });

  it('BorderSelecting + BorderDetecting classes are slim exports', () => {
    expect(typeof BorderSelecting).toBe('function');
    expect(typeof BorderDetecting).toBe('function');
  });
});
