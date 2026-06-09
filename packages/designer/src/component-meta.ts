/**
 * @monbolc/lowcode-designer — component-meta
 * Ali-mirror Phase E.3: the `ComponentMeta` class + registry.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/component-meta.ts`
 * (399 LoC ali → ~150 LoC slim). The slim port keeps the public
 * surface the slim engine actually reads (used by BorderDetecting,
 * BorderSelecting, BorderContainer, drag-ghost, live-editing, etc.):
 *   - title, rootSelector, npm, availableActions, liveTextEditing
 *   - advanced.hideSelectTools, advanced.isAbsoluteLayoutContainer
 *   - advanced.callbacks.onHoverHook, .onResize*, .onResizeStart, .onResizeEnd
 *   - onMetadataChange(fn) — subscribe to metadata changes
 *   - isComponentMeta: true — discriminator
 *
 * Slim deltas from ali:
 *   - Ali-faithful uses mobx decorators (`@computed`, `@obx.ref`,
 *     `makeObservable`); the slim port uses plain class fields (the
 *     metadata is a plain JS object — no observable reads needed in
 *     Phase E.3)
 *   - Ali-faithful uses `IEventBus` / `createModuleEventBus` →
 *     `Emitter` (D.I2)
 *   - Ali-faithful uses `IconContainer` / `IconPage` / `IconComponent`
 *     → slim: drops (the slim engine doesn't ship icons; the demo
 *     uses unicode characters)
 *   - Ali-faithful uses `deprecate` from `@alilc/lowcode-utils` →
 *     slim: drops (the slim engine has no deprecation layer)
 *   - Ali-faithful's `setMetadata` does a recursive compile of the
 *     metadata tree; the slim port is a plain setter (Phase D-2 widens)
 *   - Ali-faithful's `ComponentMetaRegistry` is ali-faithful-size; the
 *     slim port is a slim `Map<name, IComponentMetaLite>`
 */
import { Emitter } from '@monbolc/lowcode-utils';
import type { IDisposable } from './history';

/** Slim 1-line `IPublicTypeI18nData` (ali's full shape is richer). */
export interface IComponentMetaI18nData {
  type: string;
  [key: string]: string;
}

/** Slim 1-line `IPublicTypeNpmInfo` shape. */
export interface IComponentMetaNpmInfo {
  package?: string;
  componentName?: string;
  [key: string]: unknown;
}

/** Slim 1-line `IPublicTypeLiveTextEditingConfig` shape. */
export interface ILiveTextEditingConfig {
  propTarget?: string;
  selector?: string;
  mode?: 'plaintext' | string;
  onSaveContent?: (content: string, prop: { setValue(v: unknown): void }) => void;
  [key: string]: unknown;
}

/** Slim 1-line `IPublicTypeActionContent` shape. */
export interface IActionContent {
  important?: boolean;
  condition?: ((node: unknown) => boolean | undefined) | boolean | undefined;
  content: unknown;
  name: string;
}

/** Slim `IPublicTypeAdvanced` shape. */
export interface IComponentMetaAdvanced {
  hideSelectTools?: boolean;
  isAbsoluteLayoutContainer?: boolean;
  /** Resize callbacks (Phase E.3 widens the surface as needed). */
  callbacks?: {
    onHoverHook?: (shellNode: unknown) => boolean;
    onResizeStart?: (e: unknown) => void;
    onResize?: (e: unknown) => void;
    onResizeEnd?: (e: unknown) => void;
  };
  [key: string]: unknown;
}

/**
 * The slim `IComponentMetaLite` interface — the public surface the
 * slim engine reads. Mirrors ali's `IComponentMeta` but slimmed to
 * the fields the bem-tool files + drag-ghost + live-editing consume.
 */
export interface IComponentMetaLite {
  /** Ali-faithful discriminator. */
  readonly isComponentMeta: true;
  /** Human-readable title (string or i18n shape). */
  title?: string | IComponentMetaI18nData | unknown;
  /** CSS selector for the component's root element (used by BorderSelecting). */
  rootSelector?: string;
  /** NPM package info (used by BorderSelecting for the `selected` event payload). */
  npm?: IComponentMetaNpmInfo;
  /** Toolbar actions for the selection (used by BorderSelecting.Toolbar). */
  availableActions?: IActionContent[];
  /** Live text editing configs (used by live-editing). */
  liveTextEditing?: ILiveTextEditingConfig[];
  /** Ali-faithful `IPublicTypeAdvanced` (slim port: callbacks subset). */
  advanced?: IComponentMetaAdvanced;
  /** Ali-faithful `getMetadata()`. */
  getMetadata(): IComponentMetaLite;
  /** Ali-faithful `onMetadataChange(fn)`. */
  onMetadataChange(fn: () => void): IDisposable;
}

/**
 * The slim `ComponentMetaLite` class. Ali-faithful 220-LoC port reduced
 * to a plain class with a constructor that takes a config object.
 */
export class ComponentMetaLite implements IComponentMetaLite {
  readonly isComponentMeta = true;
  private readonly _emitter = new Emitter<{ metadatachange: IComponentMetaLite }>();
  /**
   * The metadata is a SEPARATE object (not `this`) to avoid recursive
   * setters: `m.title = 'X'` would otherwise call
   * `this._metadata.title = v` → `this.title = v` → setter → infinite
   * recursion. The slim port keeps the metadata in a plain object;
   * `getMetadata()` returns it.
   */
  private _metadata: IComponentMetaLite;

  constructor(initial: Partial<IComponentMetaLite> = {}) {
    this._metadata = { ...initial, isComponentMeta: true } as IComponentMetaLite;
  }

  /** Ali-faithful `getMetadata()`: returns the slim metadata object. */
  getMetadata(): IComponentMetaLite { return this._metadata; }
  /** Ali-faithful `setMetadata(metadata)`: replaces the current meta. */
  setMetadata(metadata: IComponentMetaLite): void {
    this._metadata = metadata;
    this._emitter.emit('metadatachange', metadata);
  }
  /** Ali-faithful `onMetadataChange(fn)`: subscribe to metadata changes. */
  onMetadataChange(fn: () => void): IDisposable {
    const wrapped = (): void => fn();
    this._emitter.on('metadatachange', wrapped);
    return () => this._emitter.off('metadatachange', wrapped);
  }

  get title(): string | IComponentMetaI18nData | unknown { return this._metadata.title; }
  set title(v: string | IComponentMetaI18nData | unknown) { this._metadata.title = v; this._notify(); }

  get rootSelector(): string | undefined { return this._metadata.rootSelector; }
  set rootSelector(v: string | undefined) { this._metadata.rootSelector = v; this._notify(); }

  get npm(): IComponentMetaNpmInfo | undefined { return this._metadata.npm; }
  set npm(v: IComponentMetaNpmInfo | undefined) { this._metadata.npm = v; this._notify(); }

  get availableActions(): IActionContent[] | undefined { return this._metadata.availableActions; }
  set availableActions(v: IActionContent[] | undefined) { this._metadata.availableActions = v; this._notify(); }

  get liveTextEditing(): ILiveTextEditingConfig[] | undefined { return this._metadata.liveTextEditing; }
  set liveTextEditing(v: ILiveTextEditingConfig[] | undefined) { this._metadata.liveTextEditing = v; this._notify(); }

  get advanced(): IComponentMetaAdvanced | undefined { return this._metadata.advanced; }
  set advanced(v: IComponentMetaAdvanced | undefined) { this._metadata.advanced = v; this._notify(); }

  private _notify(): void { this._emitter.emit('metadatachange', this._metadata); }
}

/**
 * Slim `ComponentMetaRegistry`: a per-Project map of `name → IComponentMetaLite`.
 * Ali-faithful equivalent is the larger `designer.componentMetasMap`.
 * Consumers (e.g. drag-ghost) call `designer.getComponentMeta(name)`.
 */
export class ComponentMetaRegistry {
  private readonly _byName = new Map<string, IComponentMetaLite>();
  private readonly _emitter = new Emitter<{ registered: string }>();

  /** Register a component meta by component name. */
  register(name: string, meta: IComponentMetaLite): void {
    this._byName.set(name, meta);
    this._emitter.emit('registered', name);
  }

  /** Look up a component meta by name; returns `undefined` if absent. */
  getComponentMeta(name: string): IComponentMetaLite | undefined {
    return this._byName.get(name);
  }

  /** Ali-faithful: `getComponentMeta` synchronously builds a default
   * meta if the name is absent. The slim port returns `undefined` and
   * lets the caller (e.g. drag-ghost) handle the missing case. */
  has(name: string): boolean {
    return this._byName.has(name);
  }

  /** Remove a registered meta. No-op if absent. */
  unregister(name: string): void {
    this._byName.delete(name);
  }

  /** Iterate all registered metas (ali-faithful: for the configure-panel). */
  values(): IterableIterator<IComponentMetaLite> {
    return this._byName.values();
  }

  /** Subscribe to registration events (for plugins that need to react). */
  onRegister(fn: (name: string) => void): IDisposable {
    this._emitter.on('registered', fn);
    return () => this._emitter.off('registered', () => undefined);
  }

  /**
   * Ali-faithful `componentMetasMap` access (read-only view). L6 shell
   * uses this to wrap the registry in `IMaterialFacade`.
   */
  getMap(): ReadonlyMap<string, IComponentMetaLite> {
    return this._byName;
  }
}
