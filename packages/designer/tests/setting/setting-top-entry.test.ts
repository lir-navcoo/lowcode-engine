/**
 * @monbolc/lowcode-designer — setting/SettingTopEntry tests
 * Ali-mirror Phase D.S4.
 *
 * Validates the slim port of `SettingTopEntry`. The class is the
 * canonical entry point of the settings tree — one per selection, owns
 * the `items` array, the `_settingFieldMap` for O(1) lookup, and the
 * bulk prop operations (setProps / mergeProps).
 *
 * Test scope: 10 focused tests covering the S4-specific surface (not
 * re-asserting S2/S3 — those are covered in their own files).
 */
import { describe, it, expect, vi } from 'vitest';
import { SettingTopEntry } from '../../src/designer/setting/setting-top-entry';
import { SettingField } from '../../src/designer/setting/setting-field';
import { Node as SapuNode } from '../../src/node';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';
import type { IComponentMetaTopEntry, ITopEntryNode } from '../../src/designer/setting/setting-top-entry';
import type { IPublicTypeFieldConfig } from '../../src/designer/setting/setting-field';

function mkNode(opts: { id?: string; componentMeta?: IComponentMetaTopEntry | null; isLocked?: boolean; propsData?: unknown } = {}): SapuNode & ITopEntryNode {
  const id = opts.id ?? `n_${Math.random().toString(36).slice(2, 8)}`;
  const node = new SapuNode({ componentName: 'Test', key: id } as IPublicTypeNodeSchema, null) as SapuNode & ITopEntryNode;
  // `id` is a derived getter from schema.key. The slim Node exposes
  // `id` as readonly; the test structural-typing adds the S4-needed
  // `componentMeta` / `isLocked` / `setPropValue` etc. fields directly
  // on the merged type without re-assigning `id`.
  node.componentMeta = opts.componentMeta ?? null;
  (node as unknown as { isLocked: boolean }).isLocked = opts.isLocked ?? false;
  (node as unknown as { propsData: unknown }).propsData = opts.propsData;
  (node as unknown as { setPropValue: ReturnType<typeof vi.fn> }).setPropValue = vi.fn();
  (node as unknown as { clearPropValue: ReturnType<typeof vi.fn> }).clearPropValue = vi.fn();
  (node as unknown as { setProps: ReturnType<typeof vi.fn> }).setProps = vi.fn();
  (node as unknown as { mergeProps: ReturnType<typeof vi.fn> }).mergeProps = vi.fn();
  (node as unknown as { getProp: ReturnType<typeof vi.fn> }).getProp = vi.fn(() => undefined);
  (node as unknown as { getExtraProp: ReturnType<typeof vi.fn> }).getExtraProp = vi.fn(() => undefined);
  return node;
}

function mkMeta(configure: IPublicTypeFieldConfig[] = []): IComponentMetaTopEntry {
  return {
    configure,
    onMetadataChange: vi.fn(() => () => undefined),
  };
}

function mkEditor(): { setters: { getSetter: (n: string) => unknown }; eventBus: { emit: ReturnType<typeof vi.fn> } } {
  return {
    setters: { getSetter: () => undefined },
    eventBus: { emit: vi.fn() },
  };
}

describe('setting/SettingTopEntry (Phase D.S4)', () => {
  it('throws ReferenceError when nodes is empty', () => {
    expect(() => new SettingTopEntry(mkEditor() as never, [])).toThrow(ReferenceError);
  });

  it('id is the comma-joined sorted node ids', () => {
    const a = mkNode({ id: 'a' });
    const c = mkNode({ id: 'c' });
    const b = mkNode({ id: 'b' });
    const top = new SettingTopEntry(mkEditor() as never, [a, c, b]);
    expect(top.id).toBe('a,b,c');
  });

  it('isSingle/isMultiple reflect nodes.length', () => {
    const n = mkNode();
    expect(new SettingTopEntry(mkEditor() as never, [n]).isSingle).toBe(true);
    expect(new SettingTopEntry(mkEditor() as never, [n]).isMultiple).toBe(false);
    expect(new SettingTopEntry(mkEditor() as never, [n, mkNode()]).isSingle).toBe(false);
    expect(new SettingTopEntry(mkEditor() as never, [n, mkNode()]).isMultiple).toBe(true);
  });

  it('isSameComponent: true when all nodes share the same componentMeta', () => {
    const meta = mkMeta();
    const a = mkNode({ componentMeta: meta });
    const b = mkNode({ componentMeta: meta });
    const top = new SettingTopEntry(mkEditor() as never, [a, b]);
    expect(top.isSameComponent).toBe(true);
    expect(top.componentMeta).toBe(meta);
  });

  it('isSameComponent: false when nodes have different componentMeta', () => {
    const a = mkNode({ componentMeta: mkMeta() });
    const b = mkNode({ componentMeta: mkMeta() });
    const top = new SettingTopEntry(mkEditor() as never, [a, b]);
    expect(top.isSameComponent).toBe(false);
    expect(top.componentMeta).toBeNull();
  });

  it('items: built from componentMeta.configure (each non-CustomView → SettingField)', () => {
    const meta = mkMeta([
      { name: 'title' },
      { name: 'subtitle' },
    ]);
    const node = mkNode({ componentMeta: meta });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    expect(top.items.length).toBe(2);
    expect(top.items[0]).toBeInstanceOf(SettingField);
    expect((top.items[0] as SettingField).name).toBe('title');
  });

  it('items: CustomView entries pass through', () => {
    const customView = { componentName: 'CustomView' };
    const meta = mkMeta([customView as unknown as IPublicTypeFieldConfig]);
    const node = mkNode({ componentMeta: meta });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    expect(top.items.length).toBe(1);
    expect(top.items[0]).toBe(customView);
  });

  it('items: empty when componentMeta is null (multi-node heterogeneous)', () => {
    const a = mkNode({ componentMeta: mkMeta() });
    const b = mkNode({ componentMeta: mkMeta() });
    const top = new SettingTopEntry(mkEditor() as never, [a, b]);
    expect(top.items).toEqual([]);
  });

  it('get: returns the field from _settingFieldMap (O(1) hit)', () => {
    const meta = mkMeta([{ name: 'title' }, { name: 'subtitle' }]);
    const node = mkNode({ componentMeta: meta });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const f = top.get('title');
    expect(f).toBeInstanceOf(SettingField);
    expect(f?.name).toBe('title');
    // Second call returns the same instance (no re-creation)
    expect(top.get('title')).toBe(f);
  });

  it('get: on miss, creates a fresh ad-hoc SettingField', () => {
    const node = mkNode({ componentMeta: mkMeta() });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const f = top.get('adHoc');
    expect(f).toBeInstanceOf(SettingField);
    expect(f?.name).toBe('adHoc');
  });

  it('get: returns null when propName is empty/falsy', () => {
    const node = mkNode({ componentMeta: mkMeta([{ name: 'x' }]) });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    expect(top.get('')).toBeNull();
  });

  it('setPropValue / clearPropValue fan out to all nodes', () => {
    const a = mkNode();
    const b = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [a, b]);
    top.setPropValue('x', 'v');
    expect(a.setPropValue).toHaveBeenCalledWith('x', 'v');
    expect(b.setPropValue).toHaveBeenCalledWith('x', 'v');
    top.clearPropValue('y');
    expect(a.clearPropValue).toHaveBeenCalledWith('y');
    expect(b.clearPropValue).toHaveBeenCalledWith('y');
  });

  it('getPropValue reads from the first node via getProp(name, true)', () => {
    const sentinel = { getValue: () => 'from-getProp' };
    const node = mkNode();
    (node.getProp as ReturnType<typeof vi.fn>).mockReturnValue(sentinel);
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    expect(top.getPropValue('foo')).toBe('from-getProp');
    expect(node.getProp).toHaveBeenCalledWith('foo', true);
  });

  it('getExtraPropValue / setExtraPropValue use the first / all nodes', () => {
    const sentinel = { getValue: () => 'extra-value', setValue: vi.fn() };
    const a = mkNode();
    (a.getExtraProp as ReturnType<typeof vi.fn>).mockReturnValue(sentinel);
    const b = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [a, b]);
    expect(top.getExtraPropValue('x')).toBe('extra-value');
    expect(a.getExtraProp).toHaveBeenCalledWith('x', false);
    top.setExtraPropValue('y', 'new-val');
    expect(sentinel.setValue).toHaveBeenCalledWith('new-val');
    expect(b.getExtraProp).toHaveBeenCalledWith('y', true);
  });

  it('setProps / mergeProps: bulk operations on all nodes', () => {
    const a = mkNode();
    const b = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [a, b]);
    const data = { foo: 1, bar: 'x' };
    top.setProps(data);
    expect(a.setProps).toHaveBeenCalledWith(data);
    expect(b.setProps).toHaveBeenCalledWith(data);
    top.mergeProps(data);
    expect(a.mergeProps).toHaveBeenCalledWith(data);
    expect(b.mergeProps).toHaveBeenCalledWith(data);
  });

  it('getValue / setValue: round-trip through setProps on the first node', () => {
    const node = mkNode({ propsData: { hello: 'world' } });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    expect(top.getValue()).toEqual({ hello: 'world' });
    top.setValue({ hello: 'sapu' });
    expect(node.setProps).toHaveBeenCalledWith({ hello: 'sapu' });
  });

  // Phase D.I7b.9: SettingTopEntry.setValue emits a 'valuechange'
  // event with the new value. Ali-faithful: the valuechange event
  // is the canonical hook for "a setting was changed via the
  // settings panel" consumers (preview pane re-render, undo
  // stack entry, analytics, etc.). The slim port previously had
  // a TODO at this line; D.I7b.9 wires the emit.

  it('setValue: emits valuechange with the new value (D.I7b.9)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    top.onValueChange(onChange);
    top.setValue({ foo: 'bar' });
    expect(onChange).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('setValue: emits valuechange BEFORE the disposer is called (disposer is called once)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    const dispose = top.onValueChange(onChange);
    top.setValue(1);
    top.setValue(2);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 1);
    expect(onChange).toHaveBeenNthCalledWith(2, 2);
    dispose();
    top.setValue(3);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('onValueChange: supports multiple subscribers (all fire)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const sub1 = vi.fn();
    const sub2 = vi.fn();
    top.onValueChange(sub1);
    top.onValueChange(sub2);
    top.setValue('hello');
    expect(sub1).toHaveBeenCalledWith('hello');
    expect(sub2).toHaveBeenCalledWith('hello');
  });

  it('setValue: forwards the value as-is (no clone / no transform)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    top.onValueChange(onChange);
    const value = { nested: { a: 1, b: [2, 3] } };
    top.setValue(value);
    // The slim port: pass-through (ali-faithful). The document
    // mutation layer (SetPropCommand) handles the deep-clone.
    expect(onChange).toHaveBeenCalledWith(value);
  });

  it('setValue: also calls node.setProps (regression: no behavior change)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    top.setValue({ x: 1 });
    expect(node.setProps).toHaveBeenCalledWith({ x: 1 });
  });

  // Phase D.I7b.15: every value-mutating call should emit
  // valuechange (consistency with setValue). Slim port now wires
  // setProps / mergeProps / setPropValue / clearPropValue /
  // setExtraPropValue to emit.

  it('setProps: emits valuechange (D.I7b.15)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    top.onValueChange(onChange);
    top.setProps({ a: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('mergeProps: emits valuechange (D.I7b.15)', () => {
    const node = mkNode({ propsData: { existing: 'x' } });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    top.onValueChange(onChange);
    top.mergeProps({ added: 'y' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(node.mergeProps).toHaveBeenCalledWith({ added: 'y' });
  });

  it('setPropValue: emits valuechange (D.I7b.15)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    top.onValueChange(onChange);
    top.setPropValue('foo', 'bar');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(node.setPropValue).toHaveBeenCalledWith('foo', 'bar');
  });

  it('clearPropValue: emits valuechange (D.I7b.15)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    top.onValueChange(onChange);
    top.clearPropValue('foo');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(node.clearPropValue).toHaveBeenCalledWith('foo');
  });

  it('setExtraPropValue: emits valuechange (D.I7b.15)', () => {
    const node = mkNode();
    // mkNode's getExtraProp returns undefined by default — set up
    // a sentinel that has both getValue + setValue.
    const sentinel = { getValue: () => 'extra', setValue: vi.fn() };
    (node as unknown as { getExtraProp: ReturnType<typeof vi.fn> }).getExtraProp = vi.fn(() => sentinel);
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    top.onValueChange(onChange);
    top.setExtraPropValue('extra-key', 'extra-val');
    expect(sentinel.setValue).toHaveBeenCalledWith('extra-val');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('valuechange fires once per mutation (no double-emit) (D.I7b.15)', () => {
    const node = mkNode();
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    const onChange = vi.fn();
    top.onValueChange(onChange);
    // setValue calls the per-node setProps directly (D.I7b.15
    // refactor) to avoid double-emit. The bulk setProps emit
    // only fires when setProps is called directly.
    top.setValue({ a: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    top.setProps({ a: 2 });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('isLocked reads from the first node', () => {
    const n = mkNode({ isLocked: true });
    const top = new SettingTopEntry(mkEditor() as never, [n]);
    expect(top.isLocked).toBe(true);
  });

  it('getId / getNode / getPage convenience accessors', () => {
    const node = mkNode({ id: 'abc' });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    expect(top.getId()).toBe('abc');
    expect(top.getNode()).toBe(node);
    // getPage returns node.document (null in slim; structural fallback)
    expect(top.getPage()).toBeNull();
  });

  it('getProp is an alias of get', () => {
    const node = mkNode({ componentMeta: mkMeta([{ name: 'a' }]) });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    expect(top.getProp('a')).toBe(top.get('a'));
  });

  it('setupEvents: subscribes to componentMeta.onMetadataChange when present', () => {
    const onChange = vi.fn(() => () => undefined);
    const meta = mkMeta([{ name: 'a' }]);
    meta.onMetadataChange = onChange;
    const node = mkNode({ componentMeta: meta });
    new SettingTopEntry(mkEditor() as never, [node]);
    expect(onChange).toHaveBeenCalled();
  });

  it('purge: clears items + map + disposes metadata-change subscription', () => {
    const dispose = vi.fn();
    const meta = mkMeta([{ name: 'a' }]);
    meta.onMetadataChange = vi.fn(() => dispose);
    const node = mkNode({ componentMeta: meta });
    const top = new SettingTopEntry(mkEditor() as never, [node]);
    expect(top.items.length).toBe(1);
    top.purge();
    expect(top.items.length).toBe(0);
    expect(dispose).toHaveBeenCalled();
  });
});
