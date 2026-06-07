/**
 * @monbolc/lowcode-react-renderer — render entry
 *
 * Installs the React runtime, registers the 6 concrete renderers with
 * the adapter, and returns a `ReactRenderer` class for the host
 * application to instantiate and mount.
 */

import { adapter, type IRenderComponent, type IRendererProps } from '@monbolc/lowcode-renderer-core';
import { installReactRuntime } from './inject';
import { createReactRenderers } from './renderers';

/**
 * Bootstrap the renderer. Idempotent: calling it multiple times is a
 * safe no-op (installReactRuntime + setRenderers are guarded).
 */
export function setupReactRenderer(): void {
  installReactRuntime();
  adapter.setRenderers(createReactRenderers());
}

/**
 * Concrete renderer class. Extends the runtime's Component (i.e.
 * React.Component) so it gets the full lifecycle. The user (typically
 * the editor-skeleton in L6) constructs an instance, calls `mount()`,
 * and the schema is rendered into the DOM.
 *
 * For the L3 milestone we just expose the class — concrete mounting
 * happens in the demo / editor-skeleton.
 */
export class ReactRenderer {
  props: IRendererProps;
  state: Record<string, unknown> = {};
  setState: (s: unknown) => void = () => undefined;
  forceUpdate: () => void = () => undefined;
  private readonly rendererClass: IRenderComponent;
  private instance: unknown = null;

  constructor(props: IRendererProps) {
    this.props = props;
    this.rendererClass = adapter.pickRenderer(props.schema) ?? (class {
      // Fallback: render a div with the schema's componentName.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState() { /* */ }
      forceUpdate() { /* */ }
      render() {
        const h = adapter.getRuntime().createElement;
        return h('div', null, (props.schema as { componentName?: string })?.componentName ?? '');
      }
    } as unknown as IRenderComponent);
  }

  /** Build a renderable element from the schema. */
  render(): unknown {
    const h = adapter.getRuntime().createElement;
    const Comp = this.rendererClass as unknown as { new (p: IRendererProps): { render(): unknown } };
    const inst = new Comp(this.props);
    this.instance = inst;
    return inst.render();
  }

  /** Test helper: return the underlying renderer instance. */
  getInstance(): unknown {
    return this.instance;
  }
}
