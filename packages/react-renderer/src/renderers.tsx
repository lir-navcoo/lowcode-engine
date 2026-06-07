/**
 * @monbolc/lowcode-react-renderer — concrete renderers
 *
 * Each function here returns a React class component built on the
 * runtime's `Component` (which resolves to React.Component after
 * `installReactRuntime` runs). They implement the real render logic
 * for Page / Component / Block / Addon / Temp nodes.
 */

import { adapter } from '@monbolc/lowcode-renderer-core';
import { isNodeSchema, isPlainObject } from '@monbolc/lowcode-utils';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

import type { IRendererProps } from '@monbolc/lowcode-renderer-core';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

/**
 * Look up the user-provided component implementation by name. The
 * renderer walks the registered `components` map (passed via props)
 * and returns the implementation, or undefined if the name is unknown.
 */
function resolveComponent(
  schema: IPublicTypeNodeSchema,
  components: Record<string, unknown> | undefined,
): unknown {
  if (!components) return undefined;
  return components[schema.componentName];
}

/**
 * Recursively render a node's children. Returns an array of React
 * elements (or a single element if there's only one child). Falsy
 * children are filtered out. Each element is given a stable `key`
 * prop to satisfy React's reconciliation requirements.
 */
function renderChildren(
  schema: IPublicTypeNodeSchema,
  props: IRendererProps,
): unknown[] {
  if (props.suspended) return [];
  const children = schema.children ?? [];
  const out: unknown[] = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    // Pass `__idx_${i}` as a fallback key. renderNode prefers
    // `schema.key` if present.
    const rendered = renderNode(child, props, `__idx_${i}`);
    if (rendered !== null && rendered !== undefined && rendered !== false) {
      out.push(rendered);
    }
  }
  return out;
}

/**
 * Render a single node by delegating to the user-provided component,
 * falling back to a generic placeholder if not found. The result is
 * a React element, or null if the node can't be rendered.
 *
 * `fallbackKey` is used when `schema.key` is absent (e.g. for
 * programmatically built schemas that didn't assign one). It must
 * be stable across renders for the same node index.
 *
 * Note: even for unknown components, we still recurse into children
 * so that the page is still navigable in the editor.
 */
function renderNode(
  schema: IPublicTypeNodeSchema,
  props: IRendererProps,
  fallbackKey?: string,
): unknown {
  if (!isNodeSchema(schema)) return null;
  const Comp = resolveComponent(schema, props.components);
  const children = renderChildren(schema, props);
  const key = schema.key ?? fallbackKey;
  if (typeof Comp === 'function') {
    // Tag every rendered node with its id so the L4 Overlays
    // component (selection border, hover tint, drag ghost) can
    // locate the corresponding DOM element. The `data-lce-id`
    // attribute is HTML-safe and passes through any well-behaved
    // user component that spreads its props to its root element
    // (which is the standard lowcode component contract).
    return h()(Comp, { ...(schema.props ?? {}), key, 'data-lce-id': key }, ...children);
  }
  // Unknown component — render a placeholder, but keep rendering
  // children below it so the page layout still works.
  return h()(
    'div',
    {
      'data-unknown-component': schema.componentName,
      'data-lce-id': key,
      key,
      style: {
        padding: '4px 8px',
        border: '1px dashed #f59e0b',
        color: '#92400e',
        fontSize: 12,
        fontFamily: 'monospace',
        display: 'inline-block',
      },
    },
    [`<${schema.componentName}>`, ...children],
  );
}

/* ------------------------------------------------------------------ *
 *  Concrete renderer classes (extending runtime.Component)              *
 * ------------------------------------------------------------------ */

class PageRendererImpl {
  props: IRendererProps;
  setState: () => void = () => undefined;
  forceUpdate: () => void = () => undefined;
  state: Record<string, unknown> = {};

  constructor(props: IRendererProps) {
    this.props = props;
  }

  render(): unknown {
    const schema = this.props.schema;
    if (!isNodeSchema(schema)) return null;
    const body = renderChildren(schema, this.props);
    return h()('div', { 'data-renderer': 'Page' }, ...body);
  }
}

class ComponentRendererImpl {
  props: IRendererProps;
  setState: () => void = () => undefined;
  forceUpdate: () => void = () => undefined;
  state: Record<string, unknown> = {};

  constructor(props: IRendererProps) {
    this.props = props;
  }

  render(): unknown {
    const schema = this.props.schema;
    if (!isNodeSchema(schema)) return null;
    return renderNode(schema, this.props);
  }
}

class BlockRendererImpl {
  props: IRendererProps;
  setState: () => void = () => undefined;
  forceUpdate: () => void = () => undefined;
  state: Record<string, unknown> = {};

  constructor(props: IRendererProps) {
    this.props = props;
  }

  render(): unknown {
    const body = renderChildren(this.props.schema as IPublicTypeNodeSchema, this.props);
    return h()('div', { 'data-renderer': 'Block' }, ...body);
  }
}

class AddonRendererImpl {
  props: IRendererProps;
  setState: () => void = () => undefined;
  forceUpdate: () => void = () => undefined;
  state: Record<string, unknown> = {};

  constructor(props: IRendererProps) {
    this.props = props;
  }

  render(): unknown {
    return h()('div', { 'data-renderer': 'Addon' }, `<${this.props.schema.componentName}>`);
  }
}

class TempRendererImpl {
  props: IRendererProps;
  setState: () => void = () => undefined;
  forceUpdate: () => void = () => undefined;
  state: Record<string, unknown> = {};

  constructor(props: IRendererProps) {
    this.props = props;
  }

  render(): unknown {
    return h()(
      'div',
      {
        'data-renderer': 'Temp',
        style: { padding: 12, color: '#94a3b8', fontStyle: 'italic' },
      },
      'Loading...',
    );
  }
}

class DivRendererImpl {
  props: IRendererProps;
  setState: () => void = () => undefined;
  forceUpdate: () => void = () => undefined;
  state: Record<string, unknown> = {};

  constructor(props: IRendererProps) {
    this.props = props;
  }

  render(): unknown {
    const body = renderChildren(this.props.schema as IPublicTypeNodeSchema, this.props);
    return h()('div', null, ...body);
  }
}

/** Returns the 6 concrete renderer classes, ready to be passed to
 * `adapter.setRenderers(...)`. */
export function createReactRenderers() {
  return {
    PageRenderer: PageRendererImpl as unknown as new (p: IRendererProps) => unknown,
    ComponentRenderer: ComponentRendererImpl as unknown as new (p: IRendererProps) => unknown,
    BlockRenderer: BlockRendererImpl as unknown as new (p: IRendererProps) => unknown,
    AddonRenderer: AddonRendererImpl as unknown as new (p: IRendererProps) => unknown,
    TempRenderer: TempRendererImpl as unknown as new (p: IRendererProps) => unknown,
    DivRenderer: DivRendererImpl as unknown as new (p: IRendererProps) => unknown,
  };
}

// Exposed for tests
export { isPlainObject };
