/**
 * @monbolc/lowcode-renderer-core — BaseRenderer
 *
 * A thin wrapper around the runtime's `Component` class that handles
 * common renderer concerns: ref capture, error boundary, child
 * dispatch. Renderers built on top of this class remain framework-
 * agnostic because they call `createElement(...)` from the runtime.
 */

import { adapter } from './adapter';

import type {
  IRendererProps,
  IRendererState,
} from './types';

/**
 * Base class for all renderers. Holds the runtime-provided Component
 * and provides a `render()` that subclasses override.
 *
 * Concrete renderers (Page, Component, Block, ...) extend this class
 * and use the `createElement` from the runtime — they never import
 * React directly.
 */
export class BaseRenderer {
  props: IRendererProps;
  state: IRendererState = {};
  __ref: unknown;

  // Lifecycle methods below are typed as plain functions; the runtime
  // wrapper (React 19, etc.) is responsible for invoking them. This
  // keeps the base class framework-agnostic.
  setState: (state: Partial<IRendererState>, callback?: () => void) => void = () => undefined;
  forceUpdate: (callback?: () => void) => void = () => undefined;

  constructor(props: IRendererProps) {
    this.props = props;
  }

  /** Subclass-overridable render method. */
  render(): unknown {
    return null;
  }

  /** Called when the renderer is about to mount. */
  componentDidMount?(): void | Promise<void>;
  /** Called after every re-render. */
  componentDidUpdate?(prevProps: IRendererProps): void | Promise<void>;
  /** Called before unmount. */
  componentWillUnmount?(): void | Promise<void>;
  /** Error boundary hook. */
  componentDidCatch?(error: unknown): void;

  /** Capture a ref to this renderer instance, e.g. for editor selection. */
  __getRef = (ref: unknown) => {
    this.__ref = ref;
    if (ref && this.props.onCompGetRef) {
      this.props.onCompGetRef(this.props.schema, ref);
    }
  };
}

/**
 * Factory helper: ensure the adapter's runtime is loaded before any
 * renderer factory is called. Concrete renderers are responsible for
 * using `createElement` to wrap their render output — they should
 * NOT subclass the runtime's Component.
 */
export function ensureRuntimeLoaded(): void {
  const runtime = adapter.getRuntime();
  if (!runtime.Component) {
    throw new Error(
      '[renderer-core] no Component in adapter runtime. ' +
        'Did you forget to call adapter.setRuntime({...})?',
    );
  }
}
