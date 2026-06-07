/**
 * @monbolc/lowcode-types
 *
 * Core type definitions for SapuLowcodeEngine.
 * This package is a pure-types layer (L0) — no runtime side effects, no React imports.
 *
 * Versioning follows semver. Bumping a major version means breaking
 * type signatures; minor means additive types.
 */

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

  /** Unique key for diffing. If absent, the engine generates one. */
  key?: string;

  /** Free-form metadata; engine preserves it but does not interpret it. */
  meta?: Record<string, Unknown>;
}

/** Inline data: either a literal value or a JS expression. */
export type IPublicTypeNodeData =
  | { type: 'literal'; value: JSONValue; /** compile-time mock value */ mock?: JSONValue }
  | { type: 'expression'; value: string; /** compile-time mock */ mock?: JSONValue }
  | { type: 'binding'; value: string; mock?: JSONValue };

/** Root schema for an entire page. */
export interface IPublicTypeRootSchema extends IPublicTypeNodeSchema {
  /** File name (e.g. "page.json"). */
  fileName: string;

  /** Optional data-source entries scoped to this page. */
  dataSources?: Record<string, IPublicTypeDataSource>;
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

  /** Where this component may be placed. */
  nestingRule?: IPublicTypeNestingRule;

  /** Default props applied at insertion time. */
  initialProps?: Record<string, JSONValue>;

  /** Property descriptors (rendered in the settings panel). */
  configure?: IPublicTypeComponentConfigure;
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
}

export interface IPublicTypeFieldConfig {
  /** Prop name in `IPublicTypeNodeSchema.props`. */
  name: string;

  /** Display title in the panel. */
  title: string;

  /** Editor kind. */
  setter: string | IPublicTypeSetterConfig;

  /** Whether the prop is required. */
  required?: boolean;

  /** Default value if user does not provide one. */
  defaultValue?: JSONValue;

  /** Free-form extra config (e.g. min/max, options, regex). */
  extraProps?: Record<string, Unknown>;
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

  /** Default action payload. */
  defaultAction?: IPublicTypeActionContent;
}

export interface IPublicTypeAdvancedConfig {
  /** Show "v-if"-style condition editor. */
  condition?: boolean;

  /** Show loop editor. */
  loop?: boolean;
}

// ---------- 4. Actions (what a setter/event can produce) ----------

export type IPublicTypeActionContent =
  | { type: 'method'; value: string; /** mock */ mock?: JSONValue }
  | { type: 'link'; value: string }
  | { type: 'script'; value: string; mock?: JSONValue };

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
}

// ---------- 6. Engine Options (passed at init time) ----------

export interface IPublicEngineOptions {
  /** Root DOM container. */
  container: HTMLElement | string;

  /** Initial root schema. */
  schema?: IPublicTypeRootSchema;

  /** Registered component schemas (key = componentName). */
  components?: Record<string, IPublicTypeComponentSchema>;

  /** Theme: "light" | "dark" | custom CSS object. */
  theme?: 'light' | 'dark' | Record<string, string>;
}

// ---------- 7. Engine Public API (used by setters / plugins) ----------

export interface IPublicApiEngine {
  /** Mount the engine into the container. */
  init(options: IPublicEngineOptions): Promise<void>;

  /** Tear down and unmount. */
  destroy(): Promise<void>;

  /** Save current page schema. */
  saveSchema(): IPublicTypeRootSchema;

  /** Hot-swap the schema (used for live preview). */
  loadSchema(schema: IPublicTypeRootSchema): void;
}
