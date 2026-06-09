/**
 * @monbolc/lowcode-designer — DocumentModel auto-wire componentMeta tests
 * Ali-mirror Phase E.6.
 */
import { describe, it, expect } from 'vitest';
import { Project } from '../src/project';
import { ComponentMetaLite } from '../src/component-meta';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

function mkRoot(): IPublicTypeRootSchema {
  return {
    componentName: 'Page',
    children: [
      { componentName: 'Button', key: 'btn1' } as IPublicTypeNodeSchema,
      {
        componentName: 'Container',
        key: 'c1',
        children: [{ componentName: 'Button', key: 'btn2' } as IPublicTypeNodeSchema],
      } as IPublicTypeNodeSchema,
    ],
  } as IPublicTypeRootSchema;
}

describe('DocumentModel auto-wire componentMeta (Phase E.6)', () => {
  it('default: nodes have componentMeta = null when the Project has no matching meta', () => {
    const p = new Project(mkRoot());
    expect(p.document.getNode('btn1')?.getComponentMeta()).toBeNull();
  });

  it('after register, new nodes get the auto-wired meta (lookup by componentName)', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.title = 'Button';
    p.componentMetas.register('Button', m);
    // Re-build the doc to trigger indexSubtree (which now does the
    // auto-wire). The slim port: the constructor calls indexSubtree
    // BEFORE setProject. Re-indexing via setRoot triggers the
    // auto-wire path.
    p.document.setRoot(mkRoot());
    const btn1 = p.document.getNode('btn1');
    expect(btn1?.getComponentMeta()).toBe(m);
    expect(btn1?.getComponentMeta()?.title).toBe('Button');
  });

  it('nested nodes also get auto-wired (both btn1 and btn2)', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    p.componentMetas.register('Button', m);
    p.document.setRoot(mkRoot());
    expect(p.document.getNode('btn1')?.getComponentMeta()).toBe(m);
    expect(p.document.getNode('btn2')?.getComponentMeta()).toBe(m);
    // Container has no registered meta
    expect(p.document.getNode('c1')?.getComponentMeta()).toBeNull();
  });

  it('typed surface: title/rootSelector/npm are accessible after auto-wire', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.title = 'MyButton';
    m.rootSelector = '.btn';
    m.npm = { package: 'antd', componentName: 'Button' };
    p.componentMetas.register('Button', m);
    p.document.setRoot(mkRoot());
    const btn1 = p.document.getNode('btn1')!;
    expect(btn1.getComponentMeta()?.title).toBe('MyButton');
    expect(btn1.getComponentMeta()?.rootSelector).toBe('.btn');
    expect(btn1.getComponentMeta()?.npm?.package).toBe('antd');
  });

  it('typed surface: live-editing liveTextEditing is accessible after auto-wire', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.liveTextEditing = [{ propTarget: 'children' }];
    p.componentMetas.register('Button', m);
    p.document.setRoot(mkRoot());
    expect(p.document.getNode('btn1')?.getComponentMeta()?.liveTextEditing?.[0]?.propTarget).toBe('children');
  });

  it('typed surface: BorderDetecting onHoverHook is accessible after auto-wire', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.advanced = {
      hideSelectTools: false,
      isAbsoluteLayoutContainer: false,
      callbacks: { onHoverHook: () => true },
    };
    p.componentMetas.register('Button', m);
    p.document.setRoot(mkRoot());
    expect(p.document.getNode('btn1')?.getComponentMeta()?.advanced?.callbacks?.onHoverHook?.()).toBe(true);
  });

  it('setProject / getProject accessors', () => {
    const p = new Project(mkRoot());
    // Constructor already called setProject(this)
    expect(p.document.getProject()).toBe(p);
    p.document.setProject(null);
    expect(p.document.getProject()).toBeNull();
    p.document.setProject(p);
    expect(p.document.getProject()).toBe(p);
  });
});
