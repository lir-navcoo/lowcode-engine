/**
 * @monbolc/lowcode-types — IPublicTypeSimulatorRenderer
 * Ali-mirror Phase D.I2: the simulator-renderer interface contract.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/types/src/shell/type/simulator-renderer.ts`.
 * The ali-faithful 32-LoC interface declares 18 methods on a renderer
 * that wraps a React component tree inside an iframe. Sapu's slim port
 * keeps only the surface the bem-tool files (D.I6-D.I9) + the
 * `isSimulatorRenderer` type guard actually consume:
 *   - `isSimulatorRenderer: true` discriminator
 *   - `findDOMNodes(instance)` → slim's existing `findDOMNodes` on the
 *     BuiltinSimulatorHost (kept here as a structural member)
 *   - `getClientRects(element)` → slim: 3-line helper that calls
 *     `Element.getClientRects()` (sapu's happy-dom has it)
 *
 * The full surface (autoRepaintNode / setNativeSelection / setDraggingState
 * / setCopyState / createComponent / getComponent / load / loadAsyncLibrary
 * / rerender / run / clearState / stopAutoRepaintNode / enableAutoRepaintNode)
 * is deferred — Phase E (asset management + iframe-mode simulator) will
 * widen this surface when those features land. The slim port keeps the
 * shape narrow to avoid painting into APIs the bem-tool files don't read.
 */

// `import type` only — TypeScript erases this at runtime, so the
// `index.ts` → `simulator-renderer.ts` re-export loop doesn't cause a
// runtime circular dependency.
import type { IPublicTypeNodeSchema } from './index';

export interface IPublicTypeSimulatorRenderer<Component = unknown, ComponentInstance = unknown> {
  /** Discriminator flag — `isSimulatorRenderer(obj)` checks this. */
  readonly isSimulatorRenderer: true;
  /**
   * Ali-faithful slim port: the renderer holds a map of component
   * constructor refs by `componentName`. The slim default is `{}`
   * (the slim `BuiltinSimulatorHost` resolves components on demand).
   */
  components?: Record<string, Component>;
  /** Re-render the canvas. Slim: calls into the host's `setProps` / `events.emit('rerender')`. */
  rerender?: () => void;
  /** Map a component instance to the DOM nodes it renders. Slim: delegates to `host.findDOMNodes`. */
  findDOMNodes(instance: ComponentInstance): Array<Element | Text> | null;
  /** Read all client rects for a DOM node. Slim: calls `Element.getClientRects()`. */
  getClientRects(element: Element | Text): DOMRect[];
  /**
   * Ali-faithful: `createComponent(schema)` constructs a component
   * instance from a project schema. Slim: deferred (Phase E widens
   * with the real asset + React component construction).
   */
  createComponent?(schema: IPublicTypeNodeSchema): Component | null;
  /**
   * Ali-faithful: `getComponent(name)` resolves a component constructor
   * by name. Slim: deferred.
   */
  getComponent?(componentName: string): Component;
}
