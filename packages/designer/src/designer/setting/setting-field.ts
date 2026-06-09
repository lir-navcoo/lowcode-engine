/**
 * @monbolc/lowcode-designer — setting/setting-field
 * Ali-mirror Phase D.S3: the `SettingField` class (extends `SettingPropEntry`).
 *
 * Slim port of `alibaba/lowcode-engine/packages/designer/src/designer/setting/setting-field.ts`.
 * The 323-LoC class adds the field-specific surface on top of the S2 base:
 *   - `title` getter (auto-generated `Item ${name}` for numeric names)
 *   - `setter` getter (static or dynamic — invokes dynamic setters with the
 *     shell-field handle)
 *   - `expanded` Observable + `setExpanded`
 *   - `items` array (child SettingFields or passthrough IPublicTypeCustomView)
 *   - `setValue` / `setHotValue` / `setMiniAppDataSourceValue` / `getHotValue`
 *   - `purge` / `createField` / `onEffect`
 *   - `getConfig` / `getItems` / `config` (compat helpers)
 *
 * Slim translations applied:
 *   - `@obx.ref _expanded`        → `Observable<boolean>`
 *   - `@computed get setter()`    → plain getter (untracked wrapper is a
 *                                   no-op in sapu; just invoke directly)
 *   - `@action setValue`          → plain method (no transaction concept)
 *   - `@action setHotValue`       → plain method
 *   - `@action setMiniAppDataSourceValue` → plain method
 *   - `makeObservable(this)`      → drop
 *   - `intl('Item')`             → hard-coded `'Item'` fallback (audit R-B;
 *                                   the slim port doesn't have engine i18n
 *                                   wired at this layer; Phase E can wire
 *                                   `engine.i18n.get('Item')`)
 *   - `untracked(...)`            → drop (sapu has no tracking-by-default;
 *                                   just call the setter function)
 *   - `cloneDeep` (from @alilc/lowcode-utils) → local 10-LoC impl
 *   - `isCustomView`              → local 1-line duck-type
 *   - `@alilc/lowcode-types.IPublicTypeTitleContent / IPublicTypeSetterType /
 *     IPublicTypeDynamicSetter / IPublicTypeFieldConfig / IPublicTypeCustomView /
 *     IPublicTypeDisposable / IPublicModelSettingField / IBaseModelSettingField`
 *                                   → local slim interfaces
 *
 * The `ISettingField` interface declared in this file MERGES with the slim
 * seed in `setting-entry-type.ts` (TypeScript interface merging). The merged
 * interface is the canonical public contract.
 */
import type { ReactNode } from 'react';
import type { JSONValue } from '@monbolc/lowcode-types';
import { Observable } from '@monbolc/lowcode-utils';
import { Transducer } from './utils';
import {
  SettingPropEntry,
  type ISettingPropEntry,
  type IPublicTypeFieldExtraProps,
  type IPublicTypeSetValueOptions,
} from './setting-prop-entry';
import { isJSExpression } from './is-js-expression';
import { isCustomView, isDynamicSetter, cloneDeep } from './setting-helpers';
import type { ISettingTopEntry } from './setting-top-entry';

/**
 * Slim extension of `IPublicTypeFieldConfig`. The ali-faithful surface
 * has more fields (the slim @monbolc version only ships `name` + `setter`
 * + `defaultSchema`); the slim port widens locally so the setting tree
 * has a stable in-package type. Phase E can lift the wider surface to
 * `@monbolc/lowcode-types` and drop this local interface.
 */
export interface IPublicTypeFieldConfig {
  name: string | number;
  type?: 'field' | 'group';
  title?: IPublicTypeTitleContent;
  description?: string;
  setter?: unknown;
  isRequired?: boolean;
  items?: Array<IPublicTypeFieldConfig | IPublicTypeCustomView>;
  extraProps?: IPublicTypeFieldExtraProps & { defaultCollapsed?: boolean };
  defaultValue?: unknown;
  condition?: unknown;
  readOnly?: boolean;
  group?: string;
  order?: number;
  [key: string]: unknown;
}

/** Slim re-implementation of `@alilc/lowcode-types.IPublicTypeCustomView`. */
export interface IPublicTypeCustomView {
  componentName: 'CustomView';
  props?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Slim re-implementation of `@alilc/lowcode-types.IPublicTypeSetterType`. */
export interface IPublicTypeSetterType {
  componentName?: string;
  props?: Record<string, unknown>;
  isRequired?: boolean;
  [key: string]: unknown;
}

/** Slim re-implementation of `@alilc/lowcode-types.IPublicTypeDynamicSetter`. */
export type IPublicTypeDynamicSetter = (
  this: unknown,
  shellField: unknown,
) => IPublicTypeSetterType | null | undefined;

/** Slim re-implementation of `@alilc/lowcode-types.IPublicTypeTitleContent`. */
export type IPublicTypeTitleContent = string | { type: string; value?: unknown } | undefined;

/** Slim re-implementation of `@alilc/lowcode-types.IPublicTypeDisposable`. */
export type IPublicTypeDisposable = () => void;

/**
 * The full `ISettingField` contract. Extends `ISettingPropEntry` (S2)
 * with the field-specific surface. The slim seed in
 * `setting-entry-type.ts` (with `path` + `isSettingField?: boolean`)
 * is OBSOLETED by this declaration — consumers should import
 * `ISettingField` from this file.
 */
export interface ISettingField extends ISettingPropEntry {
  readonly isSettingField: true;
  readonly isRequired: boolean;
  extraProps: IPublicTypeFieldExtraProps;
  get items(): ReadonlyArray<ISettingField | IPublicTypeCustomView>;
  get title(): string | ReactNode | undefined;
  get setter(): IPublicTypeSetterType | null;
  get expanded(): boolean;
  setExpanded(value: boolean): void;
  purge(): void;
  setValue(
    val: unknown,
    isHotValue?: boolean,
    force?: boolean,
    extraOptions?: IPublicTypeSetValueOptions,
  ): void;
  clearValue(): void;
  valueChange(options?: IPublicTypeSetValueOptions): void;
  createField(config: IPublicTypeFieldConfig): ISettingField;
  onEffect(action: () => void): IPublicTypeDisposable;
}

/**
 * Private helper: compute the dotted key the parent (top entry) uses to
 * register this child field in its `_settingFieldMap`. Ali-faithful port
 * of `getSettingFieldCollectorKey` (L23-33). The walk uses
 * `cur.parent` for the recursive step (every SettingField has a
 * `parent`; SettingTopEntry is the root, walked via `parent.top`).
 */
function getSettingFieldCollectorKey(
  parent: ISettingTopEntry | ISettingField,
  config: IPublicTypeFieldConfig,
): string {
  let cur: ISettingTopEntry | ISettingField = parent;
  const path: Array<string | number> = [config.name as string | number];
  // Walk up: if `cur.parent` is the top (and `cur !== top`), this is a
  // nested field; if `cur` is the top, we're at the root.
  const top = (cur as { top?: ISettingTopEntry }).top;
  while (top && cur !== top) {
    if ((cur as ISettingField).isSettingField === true && (cur as ISettingField).type !== 'group') {
      path.unshift((cur as ISettingField).name as string);
    }
    cur = (cur as ISettingField).parent as ISettingTopEntry | ISettingField;
  }
  return path.join('.');
}


/**
 * The concrete `SettingField` class. Ali-faithful port of ali's 323-LoC class.
 * See the per-section JSDoc blocks below for slim-deltas from ali.
 */
export class SettingField extends SettingPropEntry implements ISettingField {
  readonly isSettingField = true;
  readonly isRequired: boolean;
  readonly transducer: Transducer;
  // `parent` is inherited from SettingPropEntry (readonly via the
  // constructor). Re-declaring it here conflicts with the interface's
  // `parent: unknown`; the inherited field has the concrete
  // `ISettingTopEntry | ISettingField` type and is what consumers read.

  private _config: IPublicTypeFieldConfig;
  private hotValue: unknown;
  private _title?: IPublicTypeTitleContent;
  private _setter?: IPublicTypeSetterType | IPublicTypeDynamicSetter;
  private _expanded = new Observable<boolean>(true);
  private _items: Array<ISettingField | IPublicTypeCustomView> = [];
  private _extraProps: IPublicTypeFieldExtraProps;

  /**
   * Override the seed `extraProps: IPublicTypeFieldExtraProps` declared on
   * `SettingPropEntry` (so the field's merged `config.extraProps` can shadow
   * it). Ali uses the same field name; the slim port keeps the same shape.
   */
  declare extraProps: IPublicTypeFieldExtraProps;

  constructor(
    parent: ISettingTopEntry | ISettingField,
    config: IPublicTypeFieldConfig,
    private settingFieldCollector?: (
      name: string | number,
      field: ISettingField,
    ) => void,
  ) {
    // Ali-faithful: super receives (parent, name, type). The slim port
    // casts through `any` because the local ISettingField (this file)
    // and the inherited parent's ISettingField (from setting-prop-entry's
    // import) are nominally different types despite being structurally
    // identical — TypeScript's nominal class-of-declaration check.
    super(parent as any, config.name, config.type);
    // `parent` is inherited from SettingPropEntry; no re-assignment needed.
    this._config = config;
    this._title = config.title;
    this._setter = config.setter as IPublicTypeSetterType | IPublicTypeDynamicSetter | undefined;
    this._extraProps = { ...stripReservedConfigKeys(config), ...(config.extraProps ?? {}) };
    this.extraProps = this._extraProps;
    this.isRequired = !!(config as { isRequired?: boolean }).isRequired ||
      (this._setter as { isRequired?: boolean } | undefined)?.isRequired === true;
    this._expanded.set(!config.extraProps?.defaultCollapsed);

    if (config.items && config.items.length > 0) {
      this.initItems(config.items, settingFieldCollector);
    }
    if (this.type !== 'group' && settingFieldCollector && config.name) {
      settingFieldCollector(
        getSettingFieldCollectorKey(parent as unknown as ISettingTopEntry | ISettingField, config),
        this as unknown as ISettingField,
      );
    }

    this.transducer = new Transducer(this as any, { setter: config.setter as string | { componentName: string } });
  }

  get title(): string | ReactNode | undefined {
    // Slim port: hard-coded 'Item' fallback (ali uses `intl('Item')` from
    // `@alilc/lowcode-editor-core`; the slim engine i18n is not wired at
    // this layer — Phase E can replace the literal with `engine.i18n.get('Item')`).
    const fallback: string | undefined =
      typeof this.name === 'number' ? `Item ${this.name}` : (this.name as string | undefined);
    if (!this._title) return fallback;
    return this._title as unknown as ReactNode;
  }

  /**
   * The setter: static `IPublicTypeSetterType` or dynamic (a function that
   * returns one when invoked with the shell-field handle). The slim port
   * drops ali's `untracked` wrapper — sapu has no tracking-by-default, so
   * calling the function is the right semantic.
   */
  get setter(): IPublicTypeSetterType | null {
    if (!this._setter) return null;
    if (isDynamicSetter(this._setter)) {
      const handle = this.internalToShellField();
      return (this._setter as IPublicTypeDynamicSetter).call(handle, handle) ?? null;
    }
    return this._setter;
  }

  get expanded(): boolean {
    return this._expanded.get();
  }

  setExpanded(value: boolean): void {
    this._expanded.set(value);
  }

  get items(): Array<ISettingField | IPublicTypeCustomView> {
    return this._items;
  }

  get config(): IPublicTypeFieldConfig {
    return this._config;
  }

  private initItems(
    items: Array<IPublicTypeFieldConfig | IPublicTypeCustomView>,
    collector?: (name: string | number, field: ISettingField) => void,
  ): void {
    const out: Array<ISettingField | IPublicTypeCustomView> = [];
    for (const item of items) {
      if (isCustomView(item)) {
        out.push(item);
      } else {
        // Ali-faithful: SettingField can wrap a CustomView's children
        // (each child becomes a SettingField). Cast through `unknown`
        // for the same nominal-type reason as in the constructor.
        out.push(
          new SettingField(
            this as unknown as ISettingTopEntry | ISettingField,
            item as unknown as IPublicTypeFieldConfig,
            collector as unknown as ((name: string | number, field: ISettingField) => void) | undefined,
          ),
        );
      }
    }
    this._items = out;
  }

  private disposeItems(): void {
    this._items.forEach((item) => isSettingField(item) && item.purge());
    this._items = [];
  }

  /**
   * Ali-faithful: create a new child `SettingField` from a config and
   * register it with the collector. The collector's job is to insert the
   * field into the top entry's `_settingFieldMap` for O(1) lookup.
   */
  createField(config: IPublicTypeFieldConfig): ISettingField {
    this.settingFieldCollector?.(
      getSettingFieldCollectorKey(this.parent as unknown as ISettingTopEntry | ISettingField, config),
      this as unknown as ISettingField,
    );
    return new SettingField(
      this as unknown as ISettingTopEntry | ISettingField,
      config,
      this.settingFieldCollector as unknown as ((name: string | number, field: ISettingField) => void) | undefined,
    );
  }

  purge(): void {
    this.disposeItems();
  }

  getConfig<K extends keyof IPublicTypeFieldConfig>(
    configName?: K,
  ): IPublicTypeFieldConfig[K] | IPublicTypeFieldConfig {
    if (configName) {
      return this._config[configName] as IPublicTypeFieldConfig[K];
    }
    return this._config;
  }

  getItems(
    filter?: (item: ISettingField | IPublicTypeCustomView) => boolean,
  ): Array<ISettingField | IPublicTypeCustomView> {
    return this._items.filter((item) => (filter ? filter(item) : true));
  }

  /**
   * Ali-faithful `setValue` (the slim port drops the `@action` decorator —
   * no transaction concept in sapu). Routes to `setHotValue` when the
   * caller indicates a hot value (live editor); otherwise delegates to
   * the S2 base.
   */
  setValue(
    val: unknown,
    isHotValue?: boolean,
    _force?: boolean,
    extraOptions?: IPublicTypeSetValueOptions,
  ): void {
    if (isHotValue) {
      this.setHotValue(val, extraOptions);
      return;
    }
    super.setValue(val, false, false, extraOptions);
  }

  /**
   * Read the current "hot" value: cached `hotValue` if set, otherwise the
   * `getMockOrValue()` deep-cloned + pushed through `transducer.toHot`.
   * The deep clone is ali-faithful ("avoid View modify" — the setter's
   * on-screen value is independent of the schema's underlying value).
   */
  getHotValue(): unknown {
    if (this.hotValue) return this.hotValue;
    let v = cloneDeep(this.getMockOrValue() as JSONValue | undefined);
    if (v == null) v = this.extraProps.defaultValue as JSONValue | undefined;
    return this.transducer.toHot(v);
  }

  /**
   * Special hook ali uses for the list-setter (miniprogram) workflow.
   * The slim port keeps the same surface; the `__sid__` array check is
   * ali-faithful and is a no-op for normal setters.
   */
  setMiniAppDataSourceValue(data: unknown, options?: IPublicTypeSetValueOptions): void {
    this.hotValue = data;
    const v = this.transducer.toNative(data);
    this.setValue(v, false, false, options);
    if (Array.isArray(data) && data[0] && (data[0] as { __sid__?: unknown }).__sid__) return;
    this.valueChange();
  }

  /**
   * Ali-faithful `setHotValue` (the slim port drops the `@action`
   * decorator). Pushed the data through `transducer.toNative`, then
   * routes to `setValue` with `fromSetHotValue: true` so the base's
   * `valueChange` cascade is suppressed (the comment on the base
   * explains: "如果 fromSetHotValue，那么在 setHotValue 中已经调用过
   * valueChange 了").
   */
  setHotValue(data: unknown, options?: IPublicTypeSetValueOptions): void {
    this.hotValue = data;
    const value = this.transducer.toNative(data);
    const opts: IPublicTypeSetValueOptions = options ? { ...options, fromSetHotValue: true } : { fromSetHotValue: true };
    if (this.isUseVariable()) {
      const oldValue = this.getValue() as { value?: unknown; mock?: unknown } | undefined;
      if (isJSExpression(value)) {
        this.setValue(
          { type: 'JSExpression', value: (value as { value?: unknown }).value, mock: oldValue?.mock },
          false,
          false,
          opts,
        );
      } else {
        this.setValue(
          { type: 'JSExpression', value: oldValue?.value, mock: value },
          false,
          false,
          opts,
        );
      }
    } else {
      this.setValue(value, false, false, opts);
    }
    if (Array.isArray(data) && data[0] && (data[0] as { __sid__?: unknown }).__sid__) return;
    this.valueChange(opts);
  }

  /**
   * Ali-faithful `onEffect`: subscribe to the project autorun so the
   * action re-runs when any tracked observable changes. Returns the
   * disposer.
   */
  onEffect(action: () => void): IPublicTypeDisposable {
    return (this.designer as unknown as { autorun: (fn: () => void) => () => void }).autorun(action);
  }

  /**
   * Ali-faithful bridge to the shell model. Same no-op fallback as the
   * S2 base when `designer.shellModelFactory` is absent.
   */
  internalToShellField(): unknown {
    return super.internalToShellField();
  }
}

/**
 * Ali-faithful `isSettingField` type guard. The slim port exposes this
 * (previously it was a private function inside `setting-prop-entry.ts`).
 */
export function isSettingField(obj: unknown): obj is ISettingField {
  return !!obj && typeof obj === 'object' && (obj as { isSettingField?: unknown }).isSettingField === true;
}

// ---- Local slim helpers ----

/** Strip the reserved config keys before spreading into `extraProps`. */
function stripReservedConfigKeys(config: IPublicTypeFieldConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (k !== 'title' && k !== 'items' && k !== 'setter' && k !== 'extraProps' && k !== 'name' && k !== 'type' && k !== 'isRequired') {
      out[k] = v;
    }
  }
  return out;
}
