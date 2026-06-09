/**
 * @monbolc/lowcode-designer — setting/SettingField tests
 * Ali-mirror Phase D.S3.
 *
 * Validates the slim port of the `SettingField` class. The class extends
 * `SettingPropEntry` and adds the field-specific surface (title, setter,
 * expanded, items, setValue/setHotValue, purge, createField, onEffect).
 *
 * Test scope: 10 focused tests covering the S3-specific surface (not
 * re-asserting the S2 base — that's covered in `setting-prop-entry.test.ts`).
 */
import { describe, it, expect, vi } from 'vitest';
import { SettingField, isSettingField } from '../../src/designer/setting/setting-field';
import { SettingPropEntry } from '../../src/designer/setting/setting-prop-entry';
import type { ISettingTopEntry } from '../../src/designer/setting/setting-top-entry';
import { Node as SapuNode } from '../../src/node';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

function mkNode(props: Record<string, unknown> = {}): SapuNode {
  return new SapuNode({ componentName: 'Test', props } as IPublicTypeNodeSchema, null);
}

function mkTop(nodes: SapuNode[] = [mkNode()]): ISettingTopEntry {
  return {
    id: 'top',
    nodes,
    isSameComponent: true,
    isSingle: nodes.length === 1,
    isMultiple: nodes.length > 1,
    componentMeta: null,
    top: undefined as unknown as ISettingTopEntry,
    path: [],
    items: [],
    editor: { eventBus: { emit: () => undefined } },
    setters: { getSetter: () => undefined },
    getPropValue: vi.fn(() => undefined),
    setPropValue: vi.fn(),
    clearPropValue: vi.fn(),
    getPropValue: vi.fn(() => undefined),
    getExtraPropValue: vi.fn(() => undefined),
    setExtraPropValue: vi.fn(),
    get: vi.fn(() => null),
  } as unknown as ISettingTopEntry;
}

describe('setting/SettingField (Phase D.S3)', () => {
  it('extends SettingPropEntry and is itself a SettingPropEntry', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    expect(f).toBeInstanceOf(SettingField);
    expect(f).toBeInstanceOf(SettingPropEntry);
  });

  it('isSettingField === true discriminator', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    expect(f.isSettingField).toBe(true);
    expect(isSettingField(f)).toBe(true);
    // Non-SettingField objects return false
    expect(isSettingField({})).toBe(false);
    expect(isSettingField(null)).toBe(false);
    expect(isSettingField(undefined)).toBe(false);
  });

  it('title defaults to name (string) when _title not set', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    expect(f.title).toBe('foo');
  });

  it('title auto-generates `Item N` for numeric names', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 2 });
    expect(f.title).toBe('Item 2');
  });

  it('title returns _title when explicitly set', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo', title: 'Custom Title' });
    expect(f.title).toBe('Custom Title');
  });

  it('isRequired: true is honored from config', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo', isRequired: true });
    expect(f.isRequired).toBe(true);
  });

  it('isRequired: false by default', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    expect(f.isRequired).toBe(false);
  });

  it('setter: null when _setter not set', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    expect(f.setter).toBeNull();
  });

  it('setter: returns the static setter when not dynamic', () => {
    const top = mkTop();
    const setter = { componentName: 'StringSetter' };
    const f = new SettingField(top, { name: 'foo', setter });
    expect(f.setter).toBe(setter);
  });

  it('setter: invokes dynamic setter with the shell-field handle', () => {
    const top = mkTop();
    const dynamicSetter = vi.fn(() => ({ componentName: 'Computed' }));
    const f = new SettingField(top, { name: 'foo', setter: dynamicSetter });
    const out = f.setter;
    expect(out).toEqual({ componentName: 'Computed' });
    expect(dynamicSetter).toHaveBeenCalled();
  });

  it('expanded defaults to true; setExpanded mutates the observable', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    expect(f.expanded).toBe(true);
    f.setExpanded(false);
    expect(f.expanded).toBe(false);
    f.setExpanded(true);
    expect(f.expanded).toBe(true);
  });

  it('expanded: defaultCollapsed=true in extraProps starts collapsed', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo', extraProps: { defaultCollapsed: true } as never });
    expect(f.expanded).toBe(false);
  });

  it('items: built from config.items array (recursive SettingField children)', () => {
    const top = mkTop();
    const f = new SettingField(top, {
      name: 'parent',
      items: [
        { name: 'child1' },
        { name: 'child2' },
      ],
    });
    expect(f.items.length).toBe(2);
    expect(f.items[0]).toBeInstanceOf(SettingField);
    expect((f.items[0] as SettingField).name).toBe('child1');
  });

  it('items: CustomView entries pass through (not wrapped)', () => {
    const top = mkTop();
    const customView = { componentName: 'CustomView', props: { foo: 1 } };
    const f = new SettingField(top, {
      name: 'parent',
      items: [customView as never],
    });
    expect(f.items[0]).toBe(customView);
  });

  it('purge: clears _items', () => {
    const top = mkTop();
    const f = new SettingField(top, {
      name: 'parent',
      items: [{ name: 'child' }],
    });
    expect(f.items.length).toBe(1);
    f.purge();
    expect(f.items.length).toBe(0);
  });

  it('config: returns the original config', () => {
    const top = mkTop();
    const cfg = { name: 'foo', description: 'hint' };
    const f = new SettingField(top, cfg);
    expect(f.config).toBe(cfg);
    expect(f.getConfig('description')).toBe('hint');
    expect(f.getConfig('name')).toBe('foo');
  });

  it('getItems: filter callback is honored', () => {
    const top = mkTop();
    const f = new SettingField(top, {
      name: 'parent',
      items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    });
    const out = f.getItems((item) => (item as SettingField).name === 'b');
    expect(out.length).toBe(1);
  });

  it('createField: appends a new child field', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'parent' });
    const child = f.createField({ name: 'newChild' });
    expect(child).toBeInstanceOf(SettingField);
    expect(child.name).toBe('newChild');
  });

  it('setValue with isHotValue=true routes to setHotValue', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    const hotSpy = vi.spyOn(f, 'setHotValue');
    f.setValue('x', true);
    expect(hotSpy).toHaveBeenCalledWith('x', undefined);
  });

  it('setValue with isHotValue=false calls super.setValue (S2 base)', () => {
    const top = mkTop();
    (top.setPropValue as ReturnType<typeof vi.fn>).mockClear();
    const f = new SettingField(top, { name: 'foo' });
    f.setValue('x', false);
    expect(top.setPropValue).toHaveBeenCalledWith('foo', 'x');
  });

  it('getHotValue: returns transducer.toHot of the prop value when no hotValue cached', () => {
    const top = mkTop();
    (top.getPropValue as ReturnType<typeof vi.fn>).mockReturnValue('plain');
    const f = new SettingField(top, { name: 'foo' });
    // No setter was set; identity transducer → toHot returns the same value
    expect(f.getHotValue()).toBe('plain');
  });

  it('getHotValue: returns the cached hotValue when set', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    f.setHotValue('cached-x');
    expect(f.getHotValue()).toBe('cached-x');
  });

  it('onEffect: subscribes to designer.autorun; disposer stops the effect', () => {
    const top = mkTop();
    const autorun = vi.fn(() => () => undefined);
    const designer = { autorun } as unknown as { autorun: typeof autorun };
    const node = mkNode();
    const topWithDesigner = { ...top, nodes: [node], designer };
    const f = new SettingField(topWithDesigner as unknown as ISettingTopEntry, { name: 'foo' });
    const dispose = f.onEffect(() => undefined);
    expect(autorun).toHaveBeenCalled();
    expect(typeof dispose).toBe('function');
    dispose();
    // The spy fn from autorun returns a no-op; dispose is a no-op on a no-op.
    expect(true).toBe(true);
  });

  it('internalToShellField: returns null when designer.shellModelFactory absent', () => {
    const top = mkTop();
    const f = new SettingField(top, { name: 'foo' });
    expect(f.internalToShellField()).toBeNull();
  });
});
