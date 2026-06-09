/**
 * @monbolc/lowcode-designer — setting/SettingPropEntry tests
 * Ali-mirror Phase D.S2.
 *
 * Validates the slim port of the `SettingPropEntry` base class. The
 * parent is mocked as an `IPropEntryParent` (the structural type the
 * implementation reads off). The slim port drops ali's `runInAction` /
 * `makeObservable` and uses the Phase A `Observable` for `_name`; the
 * tests assert both shape and behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { SettingPropEntry, SETTING_NODE_PROP_CHANGE } from '../../src/designer/setting/setting-prop-entry';
import type { IPropEntryParent } from '../../src/designer/setting/setting-prop-entry';
import type { ISettingField } from '../../src/designer/setting/setting-entry-type';
import type { ISettingTopEntry } from '../../src/designer/setting/setting-top-entry';
import { Node as SapuNode } from '../../src/node';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

function mkNode(props: Record<string, unknown> = {}): SapuNode {
  return new SapuNode({ componentName: 'Test', props } as IPublicTypeNodeSchema, null);
}

function mkParent(opts: {
  nodes?: SapuNode[];
  isSingle?: boolean;
  isMultiple?: boolean;
  isSameComponent?: boolean;
  componentMeta?: { configure?: unknown } | null;
  path?: string[];
  top?: ISettingTopEntry;
  editor?: { eventBus?: { emit: (e: string, p: unknown) => void } };
} = {}): IPropEntryParent & { valueChange: ReturnType<typeof vi.fn> } {
  const nodes = opts.nodes ?? [mkNode()];
  // The implementation reads methods off `this.top` (not `this.parent`)
  // for child-level setPropValue/clearPropValue/getPropValue/get — so the
  // mock must put the spies on `top`. The constructor copies several
  // parent-readonly fields directly, so we still populate them on `parent`.
  const topWithMocks = (opts.top ?? {}) as ISettingTopEntry & {
    setPropValue: ReturnType<typeof vi.fn>;
    clearPropValue: ReturnType<typeof vi.fn>;
    getPropValue: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    getExtraPropValue: ReturnType<typeof vi.fn>;
    setExtraPropValue: ReturnType<typeof vi.fn>;
  };
  topWithMocks.setPropValue = topWithMocks.setPropValue ?? vi.fn();
  topWithMocks.clearPropValue = topWithMocks.clearPropValue ?? vi.fn();
  topWithMocks.getPropValue = topWithMocks.getPropValue ?? vi.fn(() => undefined);
  topWithMocks.get = topWithMocks.get ?? vi.fn(() => null);
  topWithMocks.getExtraPropValue = topWithMocks.getExtraPropValue ?? vi.fn(() => undefined);
  topWithMocks.setExtraPropValue = topWithMocks.setExtraPropValue ?? vi.fn();
  const parent: IPropEntryParent & { valueChange: ReturnType<typeof vi.fn> } = {
    editor: (opts.editor as { eventBus?: { emit: (e: string, p: unknown) => void } }) ?? {},
    nodes,
    setters: { getSetter: () => undefined } as never,
    componentMeta: opts.componentMeta ?? null,
    isSameComponent: opts.isSameComponent ?? true,
    isMultiple: opts.isMultiple ?? false,
    isSingle: opts.isSingle ?? true,
    designer: undefined,
    top: topWithMocks as ISettingTopEntry,
    path: opts.path ?? [],
    getPropValue: vi.fn(() => undefined),
    setPropValue: vi.fn(),
    clearPropValue: vi.fn(),
    getExtraPropValue: vi.fn(() => undefined),
    setExtraPropValue: vi.fn(),
    get: vi.fn(() => null),
    valueChange: vi.fn(),
  };
  return parent;
}

describe('setting/SettingPropEntry (Phase D.S2)', () => {
  it('constructor sets type=group when name starts with "#"', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, '#group', undefined);
    expect(e.type).toBe('group');
    expect(e.isGroup).toBe(true);
  });

  it('constructor sets type=field when name is plain', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'title', undefined);
    expect(e.type).toBe('field');
    expect(e.isGroup).toBe(false);
  });

  it('constructor honors an explicit type argument', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'title', 'group');
    expect(e.type).toBe('group');
  });

  it('constructor copies parent static properties (nodes, editor, setters, etc.)', () => {
    const nodes = [mkNode(), mkNode()];
    const p = mkParent({ nodes, isSingle: false, isMultiple: true });
    const e = new SettingPropEntry(p as never, 'x', 'field');
    expect(e.nodes).toBe(nodes);
    expect(e.isSingle).toBe(false);
    expect(e.isMultiple).toBe(true);
  });

  it('name is observable: getter returns the constructed name', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.name).toBe('foo');
    expect(e.getKey()).toBe('foo');
  });

  it('setKey updates the name + writes key into the underlying schema props', () => {
    const node = mkNode({});
    const p = mkParent({ nodes: [node] });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.setKey('renamed');
    expect(e.name).toBe('renamed');
    // The slim port writes to schema.props[propName] (a single dotted key
    // since this entry is at the top level — path = parent.path + 'foo' = ['foo']).
    const props = (node.schema as { props?: Record<string, unknown> }).props;
    expect((props as Record<string, { key?: unknown }>)['foo'].key).toBe('renamed');
  });

  it('setKey is a no-op for type=group', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, '#group', undefined);
    e.setKey('rename-ignored');
    expect(e.name).toBe('#group');
  });

  it('remove deletes the prop from the underlying schema props', () => {
    const node = mkNode({ foo: { x: 1 }, bar: { y: 2 } });
    const p = mkParent({ nodes: [node] });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.remove();
    const props = (node.schema as { props?: Record<string, unknown> }).props as Record<string, unknown>;
    expect(props['foo']).toBeUndefined();
    expect(props['bar']).toBeDefined();
  });

  it('path: top-level field path is [name]', () => {
    const p = mkParent({ path: [] });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.path).toEqual(['foo']);
  });

  it('path: nested field path is parent.path + [name]', () => {
    const p = mkParent({ path: ['a', 'b'] });
    const e = new SettingPropEntry(p as never, 'c', 'field');
    expect(e.path).toEqual(['a', 'b', 'c']);
  });

  it('path: group type does NOT append the name', () => {
    const p = mkParent({ path: ['a'] });
    const e = new SettingPropEntry(p as never, '#group', undefined);
    expect(e.path).toEqual(['a']);
  });

  it('valueState: type=group with no extraProps.getValue returns 0', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, '#group', undefined);
    expect(e.valueState).toBe(0);
  });

  it('valueState: type=group with extraProps.getValue returning undefined returns 0', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, '#group', undefined);
    e.extraProps.getValue = () => undefined;
    expect(e.valueState).toBe(0);
  });

  it('valueState: type=group with extraProps.getValue returning a value returns 1', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, '#group', undefined);
    e.extraProps.getValue = () => 'something';
    expect(e.valueState).toBe(1);
  });

  it('valueState: single field node returns 2', () => {
    const p = mkParent({ nodes: [mkNode()], isSingle: true });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.valueState).toBe(2);
  });

  it('valueState: multi-node slim fallback returns 1 (similar)', () => {
    const p = mkParent({ nodes: [mkNode(), mkNode()], isSingle: false, isMultiple: true });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.valueState).toBe(1);
  });

  it('getValue: type=field with name calls parent.getPropValue(name)', () => {
    const p = mkParent();
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValue('from-parent');
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.getValue()).toBe('from-parent');
  });

  it('getValue: extraProps.getValue wraps the parent value', () => {
    const p = mkParent();
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValue('parent');
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.extraProps.getValue = (_f, v) => `wrapped:${v}`;
    expect(e.getValue()).toBe('wrapped:parent');
  });

  it('setValue: type=field calls parent.setPropValue + emits on the editor event bus', () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const p = mkParent({ editor: { eventBus: { emit: (e, pl) => emitted.push({ event: e, payload: pl }) } } });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.setValue('new');
    expect(p.setPropValue).toHaveBeenCalledWith('foo', 'new');
    expect(emitted.length).toBe(1);
    expect(emitted[0].event).toBe(SETTING_NODE_PROP_CHANGE);
  });

  it('setValue: extraProps.setValue is called when not disabled', () => {
    const p = mkParent();
    const setValueSpy = vi.fn();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.extraProps.setValue = setValueSpy;
    e.setValue('new');
    expect(setValueSpy).toHaveBeenCalled();
  });

  it('setValue: extraProps.setValue is skipped when disableMutator=true', () => {
    const p = mkParent();
    const setValueSpy = vi.fn();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.extraProps.setValue = setValueSpy;
    e.setValue('new', undefined, undefined, { disableMutator: true });
    expect(setValueSpy).not.toHaveBeenCalled();
  });

  it('setValue: fromSetHotValue suppresses the valueChange cascade', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    const fn = vi.fn();
    e.onValueChange(fn);
    e.setValue('x', undefined, undefined, { fromSetHotValue: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it('setValue: NOT fromSetHotValue fires the cascade', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    const fn = vi.fn();
    e.onValueChange(fn);
    e.setValue('x');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clearValue: type=field calls parent.clearPropValue', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.clearValue();
    expect(p.clearPropValue).toHaveBeenCalledWith('foo');
  });

  it('get/set/clearPropValue at child level route through top with full dotted path', () => {
    const p = mkParent({ path: ['a', 'b'] });
    const e = new SettingPropEntry(p as never, 'c', 'field');
    const top = p.top as unknown as { setPropValue: ReturnType<typeof vi.fn>; clearPropValue: ReturnType<typeof vi.fn>; getPropValue: ReturnType<typeof vi.fn> };
    e.setPropValue('d', 'v');
    expect(top.setPropValue).toHaveBeenCalledWith('a.b.c.d', 'v');
    e.clearPropValue('e');
    expect(top.clearPropValue).toHaveBeenCalledWith('a.b.c.e');
    e.getPropValue('f');
    expect(top.getPropValue).toHaveBeenCalledWith('a.b.c.f');
  });

  it('get(propName) routes to top.get with the full dotted path', () => {
    const p = mkParent({ path: ['a'] });
    const e = new SettingPropEntry(p as never, 'b', 'field');
    const top = p.top as unknown as { get: ReturnType<typeof vi.fn> };
    e.get('c');
    expect(top.get).toHaveBeenCalledWith('a.b.c');
  });

  it('getNode returns the first underlying node', () => {
    const n = mkNode();
    const p = mkParent({ nodes: [n] });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.getNode()).toBe(n);
  });

  it('getName returns the dotted path', () => {
    const p = mkParent({ path: ['a', 'b'] });
    const e = new SettingPropEntry(p as never, 'c', 'field');
    expect(e.getName()).toBe('a.b.c');
  });

  it('props getter returns the top entry', () => {
    const top = { tag: 'top' } as ISettingTopEntry;
    const p = mkParent({ top });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.props).toBe(top);
    expect(e.getProps()).toBe(top);
  });

  it('onValueChange: disposer stops further events from firing', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    const fn = vi.fn();
    const off = e.onValueChange(fn);
    e.setValue('x');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    e.setValue('y');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('valueChange cascades to parent.valueChange when parent is an ISettingField', () => {
    const settingField: ISettingField & { valueChange: ReturnType<typeof vi.fn> } = {
      id: 'sf',
      name: 'parent',
      path: [],
      isSettingField: true,
      valueChange: vi.fn(),
    };
    const p = mkParent();
    p.top = settingField as unknown as ISettingTopEntry;
    // Replace parent with a union cast that includes the settingField
    const e = new SettingPropEntry(settingField, 'foo', 'field');
    e.valueChange();
    expect(settingField.valueChange).toHaveBeenCalled();
  });

  it('notifyValueChange emits on editor.eventBus with the slim event name', () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const p = mkParent({ editor: { eventBus: { emit: (e, pl) => emitted.push({ event: e, payload: pl }) } } });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.notifyValueChange('old', 'new');
    expect(emitted[0].event).toBe(SETTING_NODE_PROP_CHANGE);
    const payload = emitted[0].payload as { node: unknown; prop: unknown; oldValue: unknown; newValue: unknown };
    expect(payload.oldValue).toBe('old');
    expect(payload.newValue).toBe('new');
  });

  it('getDefaultValue returns extraProps.defaultValue', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    e.extraProps.defaultValue = 'dflt';
    expect(e.getDefaultValue()).toBe('dflt');
  });

  it('isUseVariable + setUseVariable flip between a raw value and a JSExpression shape', () => {
    const p = mkParent();
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValue('plain');
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.isUseVariable()).toBe(false);
    e.setUseVariable(true);
    // After flip, getPropValue is called with a JSExpression shape.
    expect(p.setPropValue).toHaveBeenCalled();
    const call = (p.setPropValue as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toEqual({ type: 'JSExpression', value: '', mock: 'plain' });
  });

  it('setUseVariable: same-flag flip is a no-op (does not call setPropValue)', () => {
    const p = mkParent();
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValue('plain');
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    const before = (p.setPropValue as ReturnType<typeof vi.fn>).mock.calls.length;
    e.setUseVariable(false);
    expect((p.setPropValue as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });

  it('getVariableValue returns the value of a JSExpression; empty string for raw', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValueOnce('plain');
    expect(e.getVariableValue()).toBe('');
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValueOnce({ type: 'JSExpression', value: 'this.state.x', mock: 'plain' });
    expect(e.getVariableValue()).toBe('this.state.x');
  });

  it('getMockOrValue returns the raw value for plain, the mock for JSExpression', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValueOnce('plain');
    expect(e.getMockOrValue()).toBe('plain');
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValueOnce({ type: 'JSExpression', value: 'x', mock: 'mock' });
    expect(e.getMockOrValue()).toBe('mock');
  });

  it('useVariable getter mirrors isUseVariable', () => {
    const p = mkParent();
    (p.getPropValue as ReturnType<typeof vi.fn>).mockReturnValue({ type: 'JSExpression', value: 'x', mock: 'm' });
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.useVariable).toBe(true);
  });

  it('isIgnore returns false', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.isIgnore()).toBe(false);
  });

  it('id is unique across instances', () => {
    const p = mkParent();
    const a = new SettingPropEntry(p as never, 'a', 'field');
    const b = new SettingPropEntry(p as never, 'b', 'field');
    expect(a.id).not.toBe(b.id);
  });

  it('internalToShellField returns null when designer.shellModelFactory is absent', () => {
    const p = mkParent();
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.internalToShellField()).toBeNull();
  });

  it('internalToShellField returns the factory result when shellModelFactory is set', () => {
    const sentinel = { tag: 'shell-field' };
    const p = mkParent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p.designer as any) = { shellModelFactory: { createSettingField: () => sentinel } };
    const e = new SettingPropEntry(p as never, 'foo', 'field');
    expect(e.internalToShellField()).toBe(sentinel);
  });
});
