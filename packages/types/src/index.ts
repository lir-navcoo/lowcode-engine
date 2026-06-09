/**
 * @monbolc/lowcode-types
 *
 * Core type definitions for SapuLowcodeEngine.
 * This package is a pure-types layer (L0) — no runtime side effects, no React imports.
 *
 * Versioning follows semver. Bumping a major version means breaking
 * type signatures; minor means additive types.
 */

export * from './simulator-renderer';
export * from './drag';
export * from './location';
export * from './setting';
export * from './presentational';
export * from './workspace';
export * from './js-block';
export * from './enum';
export * from './field-config';
export * from './transducer';
export * from './schema';
export * from './component-meta';
export * from './plugin';
export * from './action';
export * from './editor';
// Note: sapu still does not re-export ali's full `shell/api/*` and
// `shell/model/*` proxy zoo. These files are slim `IPublicType*`
// ports for plugin/component authoring only.

// ---------- 1. Identifier & primitive helpers ----------

/** Globally unique identifier (uuid v4 in practice). */
export type ID = string;

/** Human-readable label, never used as identity. */
export type Label = string;

/** JSON-compatible value (used in `props` and `data`). */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [k: string]: JSONValue };

/** Anything serializable; opaque to the engine. */
export type Unknown = unknown;

// ---------- 2. Node Schema (a single element in the page tree) ----------

/** Schema for a single node in the page tree. */
export interface IPublicTypeNodeSchema {
  /** Component name (e.g. "Button", "Page", "Div"). */
  componentName: string;
  /** Props passed to the component. */
  props?: Record<string, JSONValue>;
  /** Child nodes (declarative; engine resolves them at render time). */
  children?: IPublicTypeNodeSchema[];
  /** Optional condition: if expression is falsy, node is hidden. */
  condition?: IPublicTypeNodeData;
  /** Loop source: bind `item` and `index` to render a list. */
  loop?: IPublicTypeNodeData;
  /** Loop iteration variable name. Default: "item". */
  loopItemName?: string;
  /** Loop index variable name. Default: "index". */
  loopIndexName?: string;
  /** Stable key for diffing. If absent, the engine generates one. */
  key?: string;
  /** Free-form metadata; engine preserves it but does not interpret it. */
  meta?: Record<string, Unknown>;
  /** Conditional rendering scope. */
  conditionGroup?: string;
  /** Loop context. */
  loopArgs?: [string, string];
}

/** Inline data: either a literal value, an expression, or a binding. */
export type IPublicTypeNodeData =
  | { type: 'literal'; value: JSONValue; /** compile-time mock value */ mock?: JSONValue }
  | { type: 'expression'; value: string; /** compile-time mock */ mock?: JSONValue }
  | { type: 'binding'; value: string; mock?: JSONValue }
  | { type: 'variable'; value: string; mock?: JSONValue };

/** Root schema for an entire page. */
export interface IPublicTypeRootSchema extends IPublicTypeNodeSchema {
  /** File name (e.g. "page.json"). */
  fileName: string;
  /** Optional i18n bundle attached to this page. */
  i18n?: Record<string, IPublicTypeI18nMessage>;
  /** Optional data-source entries scoped to this page. */
  dataSources?: Record<string, IPublicTypeDataSource>;
  /** Optional meta (e.g. route, layout, version). */
  meta?: Record<string, Unknown>;
}

// ---------- 3. Component Metadata (what a registered component can do) ----------

/** Description of a single component registered in the engine. */
export interface IPublicTypeComponentSchema {
  /** Component name. Must match `IPublicTypeNodeSchema.componentName`. */
  componentName: string;
  /** Display title in the components panel. */
  title: string;
  /** Icon URL or inline SVG string. */
  icon?: string;
  /** Tag for grouping (e.g. "Layout", "Form"). */
  category?: string;
  /** Search keywords for the components panel. */
  keywords?: string[];
  /** Where this component may be placed. */
  nestingRule?: IPublicTypeNestingRule;
  /** Default props applied at insertion time. */
  initialProps?: Record<string, JSONValue>;
  /** Property descriptors (rendered in the settings panel). */
  configure?: IPublicTypeComponentConfigure;
  /** Whether this component can be used as a Page root. */
  isPage?: boolean;
  /** Whether this component is a "block" (draggable into the page). */
  isBlock?: boolean;
  /** Whether this component is a layout container. */
  isContainer?: boolean;
  /** Whether this component is a low-code primitive (vs raw JSX). */
  isLowCode?: boolean;
  /** Doc URL shown in the settings panel header. */
  docUrl?: string;
  /** Snapshot URL for visual previews. */
  screenshot?: string;
  /** Tags for filtering. */
  tags?: string[];
  /** Behaviors this component supports (e.g. 'loop', 'condition'). */
  behaviors?: string[];
}

/** Restrictions on where a component may live. */
export interface IPublicTypeNestingRule {
  /** Whitelist of parent component names. Empty = universal. */
  parentWhitelist?: string[];
  /** Blacklist of parent component names (overrides whitelist). */
  parentBlacklist?: string[];
  /** Whitelist of child component names. Empty = all. */
  childWhitelist?: string[];
  /** Blacklist of child component names. */
  childBlacklist?: string[];
  /** Whether this component can be a direct child of a Page. */
  canBePageChild?: boolean;
}

/** Field configurations for the settings panel. */
export interface IPublicTypeComponentConfigure {
  /** Component-level props. */
  props?: IPublicTypeFieldConfig[];
  /** Style override panel. */
  style?: IPublicTypeFieldConfig[];
  /** Lifecycle events. */
  events?: IPublicTypeEventConfig[];
  /** Conditional rendering / looping. */
  advanced?: IPublicTypeAdvancedConfig;
  /** Custom slots (e.g. "title", "footer"). */
  slots?: IPublicTypeSlotConfig[];
}

export interface IPublicTypeFieldConfig {
  /** Prop name in `IPublicTypeNodeSchema.props`. */
  name: string;
  /** Display title in the panel. */
  title: string;
  /** Description / tooltip. */
  description?: string;
  /** Editor kind. */
  setter: string | IPublicTypeSetterConfig;
  /** Whether the prop is required. */
  required?: boolean;
  /** Default value if user does not provide one. */
  defaultValue?: JSONValue;
  /** Free-form extra config (e.g. min/max, options, regex). */
  extraProps?: Record<string, Unknown>;
  /** Conditional visibility: show this field only when condition is met. */
  condition?: IPublicTypeNodeData;
  /** Whether this field is read-only. */
  readOnly?: boolean;
  /** Group label for layout. */
  group?: string;
  /** Display order. Lower = higher. */
  order?: number;
}

export interface IPublicTypeSetterConfig {
  /** Settler component name. */
  componentName: string;
  /** Props forwarded to the setter. */
  props?: Record<string, Unknown>;
}

export interface IPublicTypeEventConfig {
  /** Event name (e.g. "onClick"). */
  name: string;
  /** Display title. */
  title: string;
  /** Description. */
  description?: string;
  /** Default action payload. */
  defaultAction?: IPublicTypeActionContent;
  /** Whether the event is parameterized. */
  paramTypes?: string[];
}

export interface IPublicTypeAdvancedConfig {
  /** Show "v-if"-style condition editor. */
  condition?: boolean;
  /** Show loop editor. */
  loop?: boolean;
  /** Show "static" toggle. */
  staticEnabled?: boolean;
}

export interface IPublicTypeSlotConfig {
  /** Slot name. */
  name: string;
  /** Display title. */
  title?: string;
  /** Default schema to insert into empty slot. */
  defaultSchema?: IPublicTypeNodeSchema;
  /** Whether the slot accepts a single node or a list. */
  isContainer?: boolean;
  /** Allowed component names for the slot. */
  componentWhitelist?: string[];
}

// ---------- 4. Actions (what a setter/event can produce) ----------

export type IPublicTypeActionContent =
  | { type: 'method'; value: string; /** mock */ mock?: JSONValue }
  | { type: 'link'; value: string }
  | { type: 'script'; value: string; mock?: JSONValue }
  | { type: 'reload' }
  | { type: 'dialog'; value: { title: string; body: string } }
  | { type: 'custom'; value: string; mock?: JSONValue };

// ---------- 5. Data Source ----------

export interface IPublicTypeDataSource {
  /** Unique id within the schema. */
  id: ID;
  /** Display label. */
  title?: string;
  /** Request handler id registered in the engine. */
  handler: string;
  /** Initial request options. */
  options?: Record<string, JSONValue>;
  /** Path into the response to extract the data array. */
  dataHandler?: string;
  /** Whether the request is automatically fired on page load. */
  isInit?: boolean;
  /** Request lifecycle. */
  requestLifecycle?: 'onload' | 'onmount' | 'manual';
}

// ---------- 6. Internationalization ----------

/** A single i18n message. */
export interface IPublicTypeI18nMessage {
  /** Default locale string. */
  default: string;
  /** Optional per-locale overrides. Locale code → string. */
  byLocale?: Record<string, string>;
}

// ---------- 7. Engine Options (passed at init time) ----------

export interface IPublicEngineOptions {
  /** Root DOM container. */
  container: HTMLElement | string;
  /** Initial root schema. */
  schema?: IPublicTypeRootSchema;
  /** Registered component schemas (key = componentName). */
  components?: Record<string, IPublicTypeComponentSchema>;
  /** Theme: "light" | "dark" | custom CSS object. */
  theme?: 'light' | 'dark' | Record<string, string>;
  /** Locale for i18n. */
  locale?: string;
  /** Whether to run in design mode (with hover/border overlays). */
  designMode?: 'design' | 'live' | 'preview';
}

// ---------- 8. Engine Public API (used by setters / plugins) ----------

export interface IPublicApiEngine {
  /** Mount the engine into the container. */
  init(options: IPublicEngineOptions): Promise<void>;
  /** Tear down and unmount. */
  destroy(): Promise<void>;
  /** Whether init has finished successfully. */
  readonly ready: boolean;
  /** Get a service from the DI container. */
  get<T>(ctor: { new (...args: any[]): T }): Promise<T>;
  /** Try to get a service synchronously. Returns undefined if not yet registered. */
  peek<T>(ctor: { new (...args: any[]): T }): T | undefined;
}

export interface IPublicApiDesigner {
  /** Current selection (set of node ids). */
  readonly selection: string[];
  /** Current drag state. */
  readonly isDragging: boolean;
  /** Pick a node by id. */
  getNode(id: string): IPublicTypeNodeSchema | undefined;
  /** Select one or more nodes. */
  select(ids: string[]): void;
  /** Insert a new node. */
  insert(schema: IPublicTypeNodeSchema, parentId: string | null, index: number): void;
  /** Remove a node. */
  remove(nodeId: string): void;
  /** Move a node. */
  move(nodeId: string, newParentId: string | null, newIndex: number): void;
  /** Set a prop. */
  setProp(nodeId: string, key: string, value: JSONValue): void;
  /** Undo the last change. */
  undo(): void;
  /** Redo the last undone change. */
  redo(): void;
}

// ---------- 9. Layout / Style helpers ----------

/** A simple CSS-like style object. */
export interface IPublicTypeStyle {
  [key: string]: string | number | undefined;
}

/** Responsive breakpoints. */
export interface IPublicTypeBreakpoint {
  /** Match query, e.g. "max-width: 768px". */
  query: string;
  /** Override style applied at this breakpoint. */
  style: IPublicTypeStyle;
}

/** A list of responsive overrides. */
export type IPublicTypeResponsiveStyle = IPublicTypeBreakpoint[];

// ---------- 10. Asset / Resource references ----------

/** Reference to a project asset (image, font, etc.). */
export interface IPublicTypeAsset {
  /** Unique id within the project. */
  id: ID;
  /** Display label. */
  title?: string;
  /** Asset type. */
  type: 'image' | 'font' | 'video' | 'audio' | 'icon' | 'file';
  /** Asset URL. */
  url: string;
  /** Intrinsic size, when applicable. */
  width?: number;
  height?: number;
  /** Mime type. */
  mimeType?: string;
  /** SHA for cache-busting. */
  hash?: string;
}

// ---------- 11. Project / Workspace state (read-only views) ----------

export interface IPublicTypeLegacyProjectDocument {
  /** Unique id. */
  id: ID;
  /** Project name. */
  name: string;
  /** Slug. */
  slug: string;
  /** Cover image. */
  cover?: string;
  /** All pages, keyed by fileName. */
  pages: Record<string, IPublicTypeRootSchema>;
  /** All components registered in this project. */
  components: Record<string, IPublicTypeComponentSchema>;
  /** All assets. */
  assets?: Record<string, IPublicTypeAsset>;
  /** i18n bundles, keyed by bundle name. */
  i18n?: Record<string, Record<string, IPublicTypeI18nMessage>>;
  /** Data sources. */
  dataSources?: Record<string, IPublicTypeDataSource>;
  /** Project-level config. */
  config?: IPublicTypeProjectConfig;
  /** Schema version. */
  version: string;
}

export interface IPublicTypeProjectConfig {
  /** Default theme. */
  theme?: 'light' | 'dark';
  /** Default locale. */
  locale?: string;
  /** Whether to enable lowcode features. */
  lowcode?: boolean;
}

// ---------- 12. Material Library (components panel) ----------

/** Group of components. */
export interface IPublicTypeComponentCategory {
  /** Category id. */
  id: ID;
  /** Display title. */
  title: string;
  /** Icon. */
  icon?: string;
  /** Components in this category. */
  components: IPublicTypeComponentSchema[];
}

// ---------- 13. Misc helpers ----------

/** Generic callback signature for hook-style events. */
export type IPublicTypeCallback<T = void> = (payload: T) => void;

/** Disposable cleanup. Returned by `useEffect`-style helpers. */
export interface IPublicTypeDisposable {
  (): void;
}

/** Generic Result type. */
export type IPublicTypeResult<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Opaque class reference (used in DI keys). */
export interface IPublicTypeClass<T> {
  new (...args: any[]): T;
}

// ---------- 14. Drag-and-drop public surface (see ./drag.ts) ----------

export type {
  IPublicTypeNodeLike,
  IPublicTypeBoostMeta,
  IPublicTypeDragObject,
  IPublicTypeLocateEvent,
  IPublicTypeLocation,
  IPublicTypeSensor,
  IPublicModelDragon,
} from './drag';
