/**
 * @monbolc/lowcode-designer — setting/setting-prop-entry
 * Ali-mirror Phase D.S2: the `SettingPropEntry` base class.
 *
 * Slim port of `alibaba/lowcode-engine/packages/designer/src/designer/setting/setting-prop-entry.ts`.
 * The 400-LoC base class is the parent of `SettingField` (S3) and the
 * `SettingPropEntry` instances that `SettingTopEntry` (S4) creates for each
 * component prop. It implements the `ISettingPropEntry` contract that adds
 * `setValue` / `getValue` / `setKey` / `remove` / `valueState` / `useVariable`
 * on top of `ISettingEntry`.
 *
 * Slim translations applied:
 *   - `@obx.ref _name`                        → `Observable<string | number | undefined>`
 *   - `@computed get path()`                  → plain getter (re-derives per call;
 *                                                Phase D.S4 can wrap with `computed()` if
 *                                                memoization matters)
 *   - `@computed get valueState()`            → plain getter (`runInAction` was a no-op in
 *                                                ali, so the slim port drops it)
 *   - `makeObservable(this)`                  → drop (decorators)
 *   - `IEventBus` / `createModuleEventBus`     → `Emitter` from `@monbolc/lowcode-utils`
 *   - `@alilc/lowcode-utils.uniqueId`         → local 5-LoC counter-based impl
 *   - `@alilc/lowcode-utils.isJSExpression`   → local 5-LoC duck-type check
 *   - `@alilc/lowcode-types.IPublicTypeFieldExtraProps` /
 *     `IPublicTypeSetValueOptions`            → local slim interfaces
 *   - `@alilc/lowcode-types.GlobalEvent.Node.Prop.Change`
 *                                             → local constant `SETTING_NODE_PROP_CHANGE`
 *   - `IComponentMeta` (not in @monbolc)      → local structural type (`{ configure: unknown }`)
 *   - `IComponentMeta.getMetadata().configure`→ local
 *   - `IDesigner`                             → `Project` (slim)
 *   - `IComponentMeta.configure.advanced.isAbsoluteLayoutContainer`
 *                                             → not used in S2; deferred to insertion.tsx
 *
 * `internalToShellField()` calls `designer.shellModelFactory.createSettingField(this)`
 * — per audit R-A, the slim `Project` does not yet have a `shellModelFactory`
 * slot. The S2 implementation reads it via a structural cast and returns
 * `null` when absent. Phase E can wire the real shell.
 */
import { Emitter, Observable } from '@monbolc/lowcode-utils';
import type { Project } from '../../project';
import type { Node } from '../../node';
import type { ISettingField, ISettingEntry, IPublicApiSetters, IPublicModelEditor } from './setting-entry-type';
import type { ISettingTopEntry } from './setting-top-entry';
import { isJSExpression } from './is-js-expression';

/** Slim event name for "a setting prop changed its value". */
export const SETTING_NODE_PROP_CHANGE = 'setting.node.prop.change';

/** Slim re-implementation of `@alilc/lowcode-types.IPublicTypeFieldExtraProps`. */
export interface IPublicTypeFieldExtraProps {
  defaultValue?: unknown;
  getValue?: (field: unknown, val: unknown) => unknown;
  setValue?: (field: unknown, val: unknown) => void;
  [key: string]: unknown;
}

/** Slim re-implementation of `@alilc/lowcode-types.IPublicTypeSetValueOptions`. */
export interface IPublicTypeSetValueOptions {
  disableMutator?: boolean;
  fromSetHotValue?: boolean;
  [key: string]: unknown;
}

let _uidCounter = 0;
/** Slim re-implementation of `@alilc/lowcode-utils.uniqueId`. */
function uniqueId(prefix: string): string {
  _uidCounter += 1;
  return `${prefix}-${_uidCounter}`;
}

/**
 * Slim structural `IComponentMeta` (audit R-D recommendation). The real
 * ali-faithful shape (with `transientProps`, `availableActions`, etc.)
 * ships when a real meta-registry module lands.
 */
export interface IComponentMetaLite {
  configure?: unknown;
  title?: string;
  rootSelector?: string;
  [key: string]: unknown;
}

/**
 * The methods `SettingPropEntry` reads off its parent. Ali's parent is
 * `ISettingTopEntry | ISettingField`; for the S2 standalone port we
 * capture the union as a flat structural interface that mocks can build
 * without dragging in the full S4 / S3 type machinery.
 */
export interface IPropEntryParent {
  readonly editor: IPublicModelEditor;
  readonly nodes: Node[];
  readonly setters: IPublicApiSetters;
  readonly componentMeta: IComponentMetaLite | null;
  readonly isSameComponent: boolean;
  readonly isMultiple: boolean;
  readonly isSingle: boolean;
  readonly designer: Project | undefined;
  readonly top: ISettingTopEntry;
  readonly path: string[];
  getPropValue(name: string | number): unknown;
  setPropValue(name: string | number, val: unknown): void;
  clearPropValue(name: string | number): void;
  /** Overload for dotted paths. */
  getPropValue(path: string): unknown;
  getExtraPropValue(name: string): unknown;
  setExtraPropValue(name: string, value: unknown): void;
  get(path: string): ISettingField | null;
  valueChange?(options: IPublicTypeSetValueOptions): void;
}

/** Type guard for `parent is ISettingField`. Slim port of ali's `isSettingField`. */
function isSettingField(x: unknown): x is ISettingField & { valueChange?: (o: IPublicTypeSetValueOptions) => void } {
  return !!x && typeof x === 'object' && (x as { isSettingField?: unknown }).isSettingField === true;
}

/**
 * `ISettingPropEntry` interface — the public contract S3 / S4 implement against.
 * `parent` is typed as `unknown` to break the ISettingField ↔ ISettingPropEntry
 * circular type (the slim class uses the concrete `ISettingTopEntry | ISettingField`
 * internally; the interface stays minimal).
 */
export interface ISettingPropEntry extends ISettingEntry {
  readonly isGroup: boolean;
  readonly type: 'field' | 'group';
  readonly id: string;
  readonly top: ISettingTopEntry;
  readonly parent: unknown;
  // Slim structural emitter type — the class uses `Emitter<{ valuechange: ... }>`
  // (a richer typed Emitter) which is assignable to this.
  readonly emitter: { on: (...a: any[]) => any; off: (...a: any[]) => any; emit: (...a: any[]) => any };
  get props(): ISettingTopEntry;
  get name(): string | number | undefined;
  get path(): string[];
  valueChange(options?: IPublicTypeSetValueOptions): void;
  getKey(): string | number | undefined;
  setKey(key: string | number): void;
  getDefaultValue(): unknown;
  setUseVariable(flag: boolean): void;
  getProps(): ISettingTopEntry;
  isUseVariable(): boolean;
  getMockOrValue(): unknown;
  remove(): void;
  setValue(
    val: unknown,
    isHotValue?: boolean,
    force?: boolean,
    extraOptions?: IPublicTypeSetValueOptions,
  ): void;
  internalToShellField(): unknown;
}

/**
 * The base setting-prop entry class. Constructed by `SettingTopEntry.setupItems`
 * (S4) for each non-`CustomView` field; extended by `SettingField` (S3) for
 * the case where the field has nested `items` of its own.
 */
export class SettingPropEntry implements ISettingPropEntry {
  // === static properties (copied from parent in constructor) ===
  readonly editor: IPublicModelEditor;
  readonly isSameComponent: boolean;
  readonly isMultiple: boolean;
  readonly isSingle: boolean;
  readonly setters: IPublicApiSetters;
  readonly nodes: Node[];
  readonly componentMeta: IComponentMetaLite | null;
  readonly designer: Project | undefined;
  readonly top: ISettingTopEntry;
  readonly isGroup: boolean;
  readonly type: 'field' | 'group';
  readonly id: string;

  /**
   * Event emitter ali uses for `valuechange` (the slim port replaces the
   * `IEventBus` of `@alilc/lowcode-editor-core` with `Emitter` from
   * `@monbolc/lowcode-utils`). Listeners subscribe via `onValueChange(fn)`;
   * the entry fires via `this.valueChange(options)`.
   */
  readonly emitter = new Emitter<{ valuechange: IPublicTypeSetValueOptions }>();

  // === dynamic properties (Observable-backed) ===
  private readonly _name = new Observable<string | number | undefined>(undefined);

  get name(): string | number | undefined {
    return this._name.get();
  }

  /**
   * Ali-faithful `path` getter. Re-derives on every call (the slim port
   * does not memoize via `computed()` — the parent path is a plain array
   * in S2, and ali's `@computed` only re-runs on observable change which
   * is no different from a fresh derivation here).
   */
  get path(): string[] {
    const path = (this.parent as unknown as IPropEntryParent).path.slice();
    if (this.type === 'field' && this.name?.toString()) {
      path.push(this.name as string);
    }
    return path;
  }

  extraProps: IPublicTypeFieldExtraProps = {};

  constructor(
    readonly parent: ISettingTopEntry | ISettingField,
    name: string | number | undefined,
    type?: 'field' | 'group',
  ) {
    if (type == null) {
      const c = typeof name === 'string' ? name.slice(0, 1) : '';
      this.type = c === '#' ? 'group' : 'field';
    } else {
      this.type = type;
    }
    this._name.set(name);
    this.isGroup = this.type === 'group';
    this.id = uniqueId('entry');

    // copy parent static properties
    const p = parent as unknown as IPropEntryParent;
    this.editor = p.editor;
    this.nodes = p.nodes;
    this.setters = p.setters;
    this.componentMeta = p.componentMeta;
    this.isSameComponent = p.isSameComponent;
    this.isMultiple = p.isMultiple;
    this.isSingle = p.isSingle;
    this.designer = p.designer;
    this.top = p.top;
  }

  getId(): string {
    return this.id;
  }

  setKey(key: string | number): void {
    if (this.type !== 'field') return;
    const propName = this.path.join('.');
    let l = this.nodes.length;
    while (l-- > 0) {
      // Slim port: write directly into the underlying schema's props map.
      // The slim `Node` does not yet have a `getProp(name, create?)` method
      // (it's a Phase D-2 addition); the schema mutation below is the
      // S2-equivalent for the common case.
      const schema = (this.nodes[l] as unknown as { schema: { props?: Record<string, unknown> } }).schema;
      if (!schema.props) (schema as { props?: Record<string, unknown> }).props = {};
      const propsMap = schema.props as Record<string, { key?: unknown }>;
      propsMap[propName] = {
        ...(propsMap[propName] as object | undefined),
        key,
      };
    }
    this._name.set(key);
  }

  getKey(): string | number | undefined {
    return this._name.get();
  }

  remove(): void {
    if (this.type !== 'field') return;
    const propName = this.path.join('.');
    let l = this.nodes.length;
    while (l-- > 0) {
      const schema = (this.nodes[l] as unknown as { schema: { props?: Record<string, unknown> } }).schema;
      if (schema.props) {
        delete (schema.props as Record<string, unknown>)[propName];
      }
    }
  }

  /**
   * `valueState` returns:
   *   -1 多值不同
   *    0 无值
   *    1 类似值
   *    2 单一值
   *
   * Slim port: the `runInAction` wrapper ali uses is a no-op (the body
   * does not mutate observables) — the slim port drops it. Without a
   * `compare` / `isUnset` on slim `Node`, multi-node `valueState`
   * computation defaults to 1 (similar) and single-node always returns 2.
   * This is a documented slim delta; Phase D-2 (component-meta) can add
   * `compare` to the slim prop model.
   */
  get valueState(): number {
    if (this.type !== 'field') {
      const { getValue } = this.extraProps;
      return getValue
        ? getValue(this.internalToShellField(), undefined) === undefined
          ? 0
          : 1
        : 0;
    }
    if (this.nodes.length === 1) return 2;
    // Slim fallback: see JSDoc above.
    return 1;
  }

  getValue(): unknown {
    let val: unknown;
    if (this.type === 'field' && this.name?.toString()) {
      val = (this.parent as unknown as IPropEntryParent).getPropValue(this.name as string | number);
    }
    const { getValue } = this.extraProps;
    try {
      return getValue ? getValue(this.internalToShellField(), val) : val;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e);
      return val;
    }
  }

  setValue(
    val: unknown,
    _isHotValue?: boolean,
    _force?: boolean,
    extraOptions?: IPublicTypeSetValueOptions,
  ): void {
    const oldValue = this.getValue();
    const p = this.parent as unknown as IPropEntryParent;
    if (this.type === 'field') {
      this.name?.toString() && p.setPropValue(this.name as string | number, val);
    }
    const { setValue } = this.extraProps;
    if (setValue && !extraOptions?.disableMutator) {
      try {
        setValue(this.internalToShellField(), val);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(e);
      }
    }
    this.notifyValueChange(oldValue, val);
    // 如果 fromSetHotValue，那么在 setHotValue 中已经调用过 valueChange 了
    if (!extraOptions?.fromSetHotValue) {
      this.valueChange(extraOptions);
    }
  }

  clearValue(): void {
    const p = this.parent as unknown as IPropEntryParent;
    if (this.type === 'field') {
      this.name?.toString() && p.clearPropValue(this.name as string | number);
    }
    const { setValue } = this.extraProps;
    if (setValue) {
      try {
        setValue(this.internalToShellField(), undefined);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(e);
      }
    }
  }

  get(propName: string | number): ISettingField | null {
    const path = this.path.concat(propName as string).join('.');
    return (this.top as unknown as IPropEntryParent).get(path);
  }

  setPropValue(propName: string | number, value: unknown): void {
    const path = this.path.concat(propName as string).join('.');
    (this.top as unknown as IPropEntryParent).setPropValue(path, value);
  }

  clearPropValue(propName: string | number): void {
    const path = this.path.concat(propName as string).join('.');
    (this.top as unknown as IPropEntryParent).clearPropValue(path);
  }

  getPropValue(propName: string | number): unknown {
    return (this.top as unknown as IPropEntryParent).getPropValue(this.path.concat(propName as string).join('.'));
  }

  getExtraPropValue(propName: string): unknown {
    return (this.top as unknown as IPropEntryParent).getExtraPropValue(propName);
  }

  setExtraPropValue(propName: string, value: unknown): void {
    (this.top as unknown as IPropEntryParent).setExtraPropValue(propName, value);
  }

  getNode(): Node {
    return this.nodes[0];
  }

  getName(): string {
    return this.path.join('.');
  }

  getProps(): ISettingTopEntry {
    return this.top;
  }

  get props(): ISettingTopEntry {
    return this.top;
  }

  /**
   * Subscribe to `valuechange` events. Returns a disposer that, when called,
   * unsubscribes the handler.
   */
  onValueChange(func: () => void): () => void {
    this.emitter.on('valuechange', func);
    return () => {
      this.emitter.off('valuechange', func);
    };
  }

  /**
   * @deprecated Use `onValueChange(fn)` for subscribe + the new
   * `emitter.emit('valuechange', ...)` for fire. This method is preserved
   * for back-compat with ali-faithful consumers.
   */
  valueChange(options: IPublicTypeSetValueOptions = {}): void {
    this.emitter.emit('valuechange', options);
    if (this.parent && isSettingField(this.parent)) {
      this.parent.valueChange?.(options);
    }
  }

  notifyValueChange(oldValue: unknown, newValue: unknown): void {
    (this.editor as unknown as { eventBus?: { emit: (e: string, p: unknown) => void } })
      .eventBus?.emit(SETTING_NODE_PROP_CHANGE, {
        node: this.getNode(),
        prop: this,
        oldValue,
        newValue,
      });
  }

  getDefaultValue(): unknown {
    return this.extraProps.defaultValue;
  }

  isIgnore(): boolean {
    return false;
  }

  getVariableValue(): string {
    const v = this.getValue();
    return isJSExpression(v) ? String((v as { value?: unknown }).value ?? '') : '';
  }

  setVariableValue(value: string): void {
    const v = this.getValue();
    this.setValue({
      type: 'JSExpression',
      value,
      mock: isJSExpression(v) ? v.mock : v,
    });
  }

  setUseVariable(flag: boolean): void {
    if (this.isUseVariable() === flag) return;
    const v = this.getValue();
    if (this.isUseVariable()) {
      this.setValue(isJSExpression(v) ? v.mock : v);
    } else {
      this.setValue({ type: 'JSExpression', value: '', mock: v });
    }
  }

  isUseVariable(): boolean {
    return isJSExpression(this.getValue());
  }

  get useVariable(): boolean {
    return this.isUseVariable();
  }

  getMockOrValue(): unknown {
    const v = this.getValue();
    return isJSExpression(v) ? v.mock : v;
  }

  /**
   * Ali-faithful bridge to the shell model. Per audit R-A, the slim
   * `Project` does not yet have a `shellModelFactory` slot; this method
   * returns `null` when the slot is absent. Phase E can wire a real
   * factory that produces a `IPublicModelSettingField` shell.
   */
  internalToShellField(): unknown {
    const smf = (this.designer as unknown as { shellModelFactory?: { createSettingField: (e: unknown) => unknown } } | undefined)
      ?.shellModelFactory;
    return smf ? smf.createSettingField(this) : null;
  }
}
