/**
 * @monbolc/lowcode-designer — setting/setting-top-entry
 * Ali-mirror Phase D.S4: the `SettingTopEntry` class — the canonical entry
 * point for the settings panel.
 *
 * Slim port of `alibaba/lowcode-engine/packages/designer/src/designer/setting/setting-top-entry.ts`
 * (297 LoC ali → ~370 LoC slim including the ISettingTopEntry interface that
 * was forward-declared in S2). One per selection: when the user selects
 * one node, there's one `SettingTopEntry`; when they select N, there's
 * still one (with `nodes.length === N`). Owns the `items` tree.
 *
 * Slim translations applied:
 *   - `@computed getValue()` (L163, a no-op typo in ali — decorator on a
 *     method) → plain method
 *   - `IEventBus` / `createModuleEventBus` → `Emitter` from @monbolc
 *   - `node.setPropValue` / `node.clearPropValue` / `node.setProps` /
 *     `node.mergeProps` / `node.getProp` / `node.getExtraProp` → not in
 *     slim `Node` (Phase D-2 adds them); S4 uses structural casts so the
 *     file compiles; tests provide mocks with the right shape
 *   - `node.componentMeta` → not in slim `Node`; S4 uses structural cast
 *   - `editor.get('setters')` → ali-faithful DI lookup; slim `IPublicModelEditor`
 *     is a slim facade (no `get`); S4 reads `editor.setters` instead
 *   - `IPublicModelSettingTopEntry<INode, ISettingField>` from
 *     `@alilc/lowcode-types` (a 13-type-param union) → slim: the
 *     ISettingTopEntry interface declares the slim surface directly
 *
 * The ISettingTopEntry interface replaces the S2 forward-decl (which
 * lives in the OLD setting-top-entry.ts — this file now exports BOTH
 * the interface AND the class; the S2 forward-decl is OBSOLETE and is
 * kept as a re-export of the interface here for back-compat).
 */
import { Emitter } from '@monbolc/lowcode-utils';
import type { Node } from '../../node';
import type {
  ISettingField as ISettingFieldFull,
  IPublicTypeFieldConfig,
  IPublicTypeCustomView,
} from './setting-field';
import { SettingField } from './setting-field';
import { isCustomView } from './setting-helpers';
import type {
  IPublicApiSetters,
  IPublicModelEditor,
} from './setting-entry-type';
import type { IPropEntryParent } from './setting-prop-entry';

/**
 * The slim `IComponentMeta` shape that S4 actually reads (audit R-D:
 * structural typing to avoid a types-package bump). Ali-faithful surface
 * is richer; the slim port keeps just the methods SettingTopEntry calls.
 */
export interface IComponentMetaTopEntry {
  configure: IPublicTypeFieldConfig[];
  onMetadataChange(cb: () => void): () => void;
  [key: string]: unknown;
}

/** Slim node-shape that the S4 implementation reads (structural). */
export interface ITopEntryNode {
  readonly id: string;
  readonly componentMeta: IComponentMetaTopEntry | null;
  readonly document?: { designer?: unknown; [key: string]: unknown } | null;
  readonly isLocked?: boolean;
  readonly propsData?: unknown;
  setPropValue(name: string, value: unknown): void;
  clearPropValue(name: string): void;
  setProps(data: Record<string, unknown>): void;
  mergeProps(data: Record<string, unknown>): void;
  getProp(name: string, create?: boolean): { getValue: () => unknown } | undefined;
  getExtraProp(name: string, create?: boolean): { getValue: () => unknown; setValue: (v: unknown) => void } | undefined;
}

/** Slim editor-shape that S4 reads (structural; replaces `editor.get('setters')`). */
export interface ITopEntryEditor {
  setters: IPublicApiSetters;
  eventBus?: { emit: (e: string, p: unknown) => void };
  [key: string]: unknown;
}

/**
 * The `ISettingTopEntry` interface (S2 forward-decl was here; S4 now
 * owns the full contract). The slim port doesn't extend the big ali
 * `IPublicModelSettingTopEntry<INode, ISettingField>` — slim adds the
 * public surface directly.
 */
export interface ISettingTopEntry {
  readonly id: string;
  readonly nodes: Node[];
  readonly isSameComponent: boolean;
  readonly isSingle: boolean;
  readonly isMultiple: boolean;
  readonly isLocked: boolean;
  readonly first: Node;
  readonly designer: unknown;
  readonly setters: IPublicApiSetters;
  readonly editor: IPublicModelEditor;
  readonly top: ISettingTopEntry;
  readonly parent: ISettingTopEntry;
  readonly path: never[];
  readonly items: ReadonlyArray<ISettingFieldFull | IPublicTypeCustomView>;
  componentMeta: IComponentMetaTopEntry | null;
  purge(): void;
  get(propName: string | number): ISettingFieldFull | null;
  setPropValue(propName: string | number, value: unknown): void;
  clearPropValue(propName: string | number): void;
  getPropValue(propName: string | number): unknown;
  getExtraPropValue(propName: string): unknown;
  setExtraPropValue(propName: string, value: unknown): void;
  setProps(data: Record<string, unknown>): void;
  mergeProps(data: Record<string, unknown>): void;
  getValue(): unknown;
  setValue(val: unknown): void;
  getId(): string;
  getNode(): Node;
  getPage(): unknown;
  getProp(propName: string | number): ISettingFieldFull | null;
  getNode_aliDeprecated(): Node; // alias of getNode, for `get node()` getter
}

/**
 * Generate the session id for a multi-node selection: comma-joined sorted
 * node ids. Ali-faithful port.
 */
function generateSessionId(nodes: ReadonlyArray<{ id: string }>): string {
  return nodes.map((n) => n.id).sort().join(',');
}

/**
 * The `SettingTopEntry` class. Ali-faithful port (the 297-LoC ali class).
 */
export class SettingTopEntry implements ISettingTopEntry {
  private readonly _emitter = new Emitter<Record<string, unknown>>();
  private _items: Array<ISettingFieldFull | IPublicTypeCustomView> = [];
  private _componentMeta: IComponentMetaTopEntry | null = null;
  private _isSame = true;
  private _settingFieldMap: Record<string, ISettingFieldFull> = {};
  /** Lifecycle disposers. */
  private _disposeFunctions: Array<() => void> = [];

  readonly path: never[] = [];
  readonly top: ISettingTopEntry = this;
  readonly parent: ISettingTopEntry = this;
  readonly id: string;
  readonly first: Node;
  readonly designer: unknown;
  readonly setters: IPublicApiSetters;
  readonly editor: IPublicModelEditor;
  readonly nodes: Node[];

  constructor(editor: IPublicModelEditor, nodes: Node[]) {
    if (!Array.isArray(nodes) || nodes.length < 1) {
      throw new ReferenceError('SettingTopEntry: nodes should not be empty');
    }
    this.id = generateSessionId(nodes as unknown as ReadonlyArray<{ id: string }>);
    this.first = nodes[0];
    this.editor = editor;
    this.designer = (nodes[0] as unknown as ITopEntryNode).document?.designer;
    this.nodes = nodes;

    // The ali-faithful `editor.get('setters')` is a DI lookup; the slim
    // `IPublicModelEditor` doesn't have a DI container, so the slim port
    // reads `editor.setters` directly (set when the host wires the
    // setters into the editor facade). For tests, the mkEditor mock
    // provides a setters field.
    this.setters = (editor as unknown as ITopEntryEditor).setters;

    this.setupComponentMeta();
    this.setupItems();
    const dispose = this.setupEvents();
    if (dispose) this._disposeFunctions.push(dispose);
  }

  get componentMeta(): IComponentMetaTopEntry | null {
    return this._componentMeta;
  }

  get items(): ReadonlyArray<ISettingFieldFull | IPublicTypeCustomView> {
    return this._items;
  }

  get isSameComponent(): boolean {
    return this._isSame;
  }

  get isSingle(): boolean {
    return this.nodes.length === 1;
  }

  get isMultiple(): boolean {
    return this.nodes.length > 1;
  }

  get isLocked(): boolean {
    return !!(this.first as unknown as ITopEntryNode).isLocked;
  }

  private setupComponentMeta(): void {
    // Slim port: walk all nodes, check if they all share the same
    // componentMeta. If yes, _componentMeta is the first's; else null.
    const first = this.first as unknown as ITopEntryNode;
    const meta = first.componentMeta;
    let theSame = true;
    for (let i = 1; i < this.nodes.length; i++) {
      const other = this.nodes[i] as unknown as ITopEntryNode;
      if (other.componentMeta !== meta) {
        theSame = false;
        break;
      }
    }
    if (theSame) {
      this._isSame = true;
      this._componentMeta = meta;
    } else {
      this._isSame = false;
      this._componentMeta = null;
    }
  }

  private setupItems(): void {
    if (this._componentMeta) {
      const settingFieldMap: Record<string, ISettingFieldFull> = {};
      const settingFieldCollector = (name: string | number, field: ISettingFieldFull): void => {
        settingFieldMap[String(name)] = field;
      };
      this._items = this._componentMeta.configure.map((item) => {
        if (isCustomView(item)) return item as unknown as IPublicTypeCustomView;
        return new SettingField(
          this as unknown as ISettingTopEntry & ISettingFieldFull,
          item,
          settingFieldCollector,
        );
      });
      this._settingFieldMap = settingFieldMap;
    }
  }

  private setupEvents(): (() => void) | null {
    if (!this._componentMeta || typeof this._componentMeta.onMetadataChange !== 'function') {
      return null;
    }
    return this._componentMeta.onMetadataChange(() => {
      this.setupItems();
    });
  }

  /**
   * Ali-faithful `getValue` — the slim port drops the `@computed`
   * decorator (it was on a method, a no-op typo in ali). Returns the
   * first node's `propsData` (the live prop values bundle).
   */
  getValue(): unknown {
    return (this.first as unknown as ITopEntryNode).propsData;
  }

  /**
   * Ali-faithful `setValue` — bulk-set the prop values. Delegates to
   * `setProps(val)` and would emit a valuechange event (TODO, not in
   * the slim port's first cut).
   */
  setValue(val: unknown): void {
    this.setProps(val as Record<string, unknown>);
    // TODO: emit value change
  }

  /**
   * O(1) lookup of a child `SettingField` by name. On miss, creates a
   * fresh ad-hoc `SettingField` (ali-faithful — the auto-vivification
   * is intentional: the caller can read+write without the field being
   * in the static configure).
   */
  get(propName: string | number): ISettingFieldFull | null {
    if (!propName) return null;
    const key = String(propName);
    const existing = this._settingFieldMap[key];
    if (existing) return existing;
    return new SettingField(
      this as unknown as ISettingTopEntry & ISettingFieldFull,
      { name: propName },
    );
  }

  getProp(propName: string | number): ISettingFieldFull | null {
    return this.get(propName);
  }

  setPropValue(propName: string | number, value: unknown): void {
    const key = String(propName);
    for (const node of this.nodes) {
      (node as unknown as ITopEntryNode).setPropValue(key, value);
    }
  }

  clearPropValue(propName: string | number): void {
    const key = String(propName);
    for (const node of this.nodes) {
      (node as unknown as ITopEntryNode).clearPropValue(key);
    }
  }

  getPropValue(propName: string | number): unknown {
    return (this.first as unknown as ITopEntryNode).getProp(String(propName), true)?.getValue();
  }

  getExtraPropValue(propName: string): unknown {
    return (this.first as unknown as ITopEntryNode).getExtraProp(propName, false)?.getValue();
  }

  setExtraPropValue(propName: string, value: unknown): void {
    for (const node of this.nodes) {
      (node as unknown as ITopEntryNode).getExtraProp(propName, true)?.setValue(value);
    }
  }

  /** Bulk replace the prop values. */
  setProps(data: Record<string, unknown>): void {
    for (const node of this.nodes) {
      (node as unknown as ITopEntryNode).setProps(data);
    }
  }

  /** Bulk merge into the prop values (existing keys are kept unless overridden). */
  mergeProps(data: Record<string, unknown>): void {
    for (const node of this.nodes) {
      (node as unknown as ITopEntryNode).mergeProps(data);
    }
  }

  private disposeItems(): void {
    for (const item of this._items) {
      // Slim: a child is purgeable if it has a `purge` method (SettingField
      // does; CustomView doesn't).
      const maybePurgeable = item as { purge?: () => void };
      if (typeof maybePurgeable.purge === 'function') {
        maybePurgeable.purge();
      }
    }
    this._items = [];
  }

  /**
   * Lifecycle: drop all child fields, clear the field map, remove all
   * emitter listeners, dispose metadata-change subscriptions.
   */
  purge(): void {
    this.disposeItems();
    this._settingFieldMap = {};
    this._emitter.removeAllListeners();
    for (const f of this._disposeFunctions) f();
    this._disposeFunctions = [];
  }

  getId(): string {
    return this.id;
  }

  getNode(): Node {
    return this.nodes[0];
  }

  getPage(): unknown {
    return (this.first as unknown as ITopEntryNode).document ?? null;
  }

  /**
   * @deprecated Ali-faithful: `get node()` returns the first underlying
   * node, the same as `getNode()`. The slim port exposes this only via
   * the function (no getter to keep the public surface minimal).
   */
  getNode_aliDeprecated(): Node {
    return this.getNode();
  }
}

// Re-export the structural IPropEntryParent so S2 + S4 can share types.
export type { IPropEntryParent };
