/**
 * @monbolc/lowcode-renderer-core — public types
 *
 * Framework-agnostic renderer surface. The actual React (or other
 * framework) primitives are injected at runtime via `adapter.setRuntime()`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The slice of React (or any compatible framework) that the renderer
 * needs. The adapter is initialized with this at app boot.
 *
 * The fields are typed as `any` to keep the renderer-core source
 * framework-agnostic. Concrete type narrowing happens in
 * @monbolc/lowcode-react-renderer.
 */
export interface IRuntime {
  /** Base class component. Must support `setState`, `forceUpdate`, lifecycle. */
  Component: any;
  /** Like Component but does shallow-prop / shallow-state equality. */
  PureComponent: any;
  /** Function form: `createElement(type, props, ...children)`. */
  createElement: any;
  /** Creates a Context object with Provider / Consumer. */
  createContext: any;
  /** Forwards refs to inner components. */
  forwardRef: any;
  /**
   * Optional — React 19 has removed `findDOMNode`. Provided as a stub
   * by the React adapter for back-compat; returns `null` always.
   */
  findDOMNode?: (instance: any) => any;
}

/** A renderer constructor. Returned by the factory functions. */
export type IRenderComponent = new (props: IRendererProps) => any;

/** What gets passed to every renderer component as props. */
export interface IRendererProps {
  /** Per-render helper object (logger, i18n, etc). Optional. */
  appHelper?: unknown;
  /** Component implementations, keyed by `IPublicTypeNodeSchema.componentName`. */
  components?: Record<string, unknown>;
  /** Design mode: 'design' | 'live' | 'preview' — drives error boundaries etc. */
  designMode?: 'design' | 'live' | 'preview' | string;
  /** If true, the renderer skips rendering children. */
  suspended?: boolean;
  /** The schema to render. */
  schema: any;
  /** Called when a child renderer grabs a ref to its instance. */
  onCompGetRef?: (schema: any, ref: unknown) => void;
  /** Called when a child renderer provides a context value. */
  onCompGetCtx?: (schema: any, ctx: unknown) => void;
  /** Force the renderer to render even if props suggest otherwise. */
  thisRequiredInJSE?: boolean;
}

/** A bag of named renderer factories. Set via `adapter.setRenderers(...)`. */
export interface IRendererModules {
  PageRenderer: IRenderComponent;
  ComponentRenderer: IRenderComponent;
  BlockRenderer: IRenderComponent;
  AddonRenderer: IRenderComponent;
  TempRenderer: IRenderComponent;
  DivRenderer?: IRenderComponent;
}

/**
 * Optional theme / locale / i18n provider component. The runtime may
 * pass a React component (or any framework's component) that wraps the
 * renderer tree.
 */
export type IConfigProvider = unknown;

/** Internal state shape. Kept loose on purpose — renderers are free
 * to extend it. */
export interface IRendererState {
  /** Last error caught by the renderer's error boundary, if any. */
  engineRenderError?: boolean;
  error?: unknown;
}
