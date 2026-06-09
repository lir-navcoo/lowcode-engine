/**
 * @monbolc/lowcode-designer — Project + ComponentMetaRegistry tests
 * Ali-mirror Phase E.4.
 */
import { describe, it, expect } from 'vitest';
import { Project } from '../src/project';
import { ComponentMetaLite } from '../src/component-meta';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

function mkRoot(): IPublicTypeRootSchema {
  return { componentName: 'Page' } as IPublicTypeRootSchema;
}

describe('Project + ComponentMetaRegistry (Phase E.4)', () => {
  it('Project constructs with an empty componentMetas registry', () => {
    const p = new Project(mkRoot());
    expect(p.componentMetas).toBeDefined();
    expect(p.getComponentMeta('NotRegistered')).toBeUndefined();
  });

  it('register + getComponentMeta via Project.getComponentMeta round-trips', () => {
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.title = 'Button';
    p.componentMetas.register('Button', m);
    expect(p.getComponentMeta('Button')).toBe(m);
    expect(p.getComponentMeta('Button')?.title).toBe('Button');
  });

  it('Project.getComponentMeta returns undefined for absent names', () => {
    const p = new Project(mkRoot());
    p.componentMetas.register('A', new ComponentMetaLite());
    expect(p.getComponentMeta('B')).toBeUndefined();
  });

  it('drag-ghost integration: designer.getComponentMeta(name).title lookup', () => {
    // Ali-faithful: drag-ghost's `getTitles` calls
    // `this.props.designer.getComponentMeta(item.componentName).title`.
    // The slim port now provides the real lookup via Project.
    const p = new Project(mkRoot());
    const m = new ComponentMetaLite();
    m.title = 'Card';
    p.componentMetas.register('Card', m);
    const titles = ['Card', 'Y'].map((name) => p.getComponentMeta(name)?.title);
    expect(titles).toEqual(['Card', undefined]);
  });

  it('unregister via the registry removes the meta from Project.getComponentMeta', () => {
    const p = new Project(mkRoot());
    p.componentMetas.register('A', new ComponentMetaLite());
    expect(p.getComponentMeta('A')).toBeDefined();
    p.componentMetas.unregister('A');
    expect(p.getComponentMeta('A')).toBeUndefined();
  });
});
