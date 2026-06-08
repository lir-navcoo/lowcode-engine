/**
 * @monbolc/lowcode-editor-skeleton — ComponentPalette
 *
 * A vertical list of the components a host has registered, displayed
 * in the left pane. Each row is a drag-source for the L3 `Dragon`:
 * on `pointerdown`, the row calls `dragon.boost({ componentName,
 * initialProps })`. The actual drop target / insertion is handled
 * by BuiltinSimulatorHost (which is mounted by the parent Skeleton).
 *
 * v2.3: when the host passes the public `dragon: PublicDragon`
 * facade (via the new optional `dragon` prop), each row instead
 * calls `dragon.from(rowEl, e => ({ type: 'NodeData', data: meta }))`
 * — the facade installs its OWN `mousedown` listener and takes
 * over. This is the ali-faithful path (P7 migration) and means
 * the palette no longer has to wire `pointerdown` / `pointerup`
 * / `pointerleave` itself.
 *
 * Hosts that DON'T pass `dragon` (older Skeleton callsites) fall
 * back to the v2.2 manual `dragon.boost(meta, x, y)` path —
 * back-compat.
 *
 * Hosts can pass a `componentMeta` map to seed the freshly-dropped
 * node with default props (e.g. `Text → { text: 'Text' }`,
 * `Div → { className: '' }`). Without those defaults, a boost
 * creates a node with `props: {}` and the settings panel shows
 * "Props (0)" — there's nothing for the user to edit until they
 * manually add a key. The meta map is the documented escape hatch.
 *
 * For the L4 milestone the palette is purely visual — no drag
 * preview, no inline search. Just a list of tappable + draggable
 * rows. (Search / categories can land later as a P1 polish item.)
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { Dragon, type BoostMeta, type Project } from '@monbolc/lowcode-designer';
import type { IPublicModelDragon, IPublicTypeNodeLike } from '@monbolc/lowcode-types';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface ComponentPaletteProps {
  project: Project;
  /** The component registry, keyed by componentName. */
  components: Record<string, unknown>;
  /**
   * Per-component default props seeded when a palette row is
   * dropped on the canvas. Looked up by `componentName`. Undefined
   * → empty `props: {}` (and the settings panel shows
   * "Props (0)").
   *
   * Example: `{ Text: { text: 'Text' }, Div: { className: '' } }`.
   */
  componentMeta?: Record<string, Record<string, unknown>>;
  /**
   * v2.3: when provided, each row uses `dragon.from(rowEl, ...)`
   * (the new P5 PublicDragon facade) instead of the manual
   * `onPointerDown` → `dragon.boost(...)` path. The default
   * (`undefined`) keeps the v2.2 manual path for back-compat.
   */
  dragon?: IPublicModelDragon<IPublicTypeNodeLike>;
}

interface PaletteItemProps {
  name: string;
  meta: BoostMeta;
  /** v2.3 public Dragon facade. `undefined` → use the inner Dragon. */
  facade?: IPublicModelDragon<IPublicTypeNodeLike>;
  /** Inner Dragon, used when `facade` is `undefined`. */
  inner: Dragon;
}

/**
 * One draggable row.
 *
 * v2.3 (`facade` provided): the row is a `ref` target. The
 * `useLayoutEffect` calls `facade.from(rowEl, e => ({ type:
 * 'NodeData', data: meta }))` once, returns the disposer, and
 * the facade's internal `mousedown` handler takes over from
 * there. No `onPointerDown` on the row.
 *
 * v2.2 (no `facade`): the row keeps the original
 * `onPointerDown` → `inner.boost(meta, x, y)` path.
 */
function PaletteItem({ name, meta, facade, inner }: PaletteItemProps) {
  const [pressing, setPressing] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  // Wire the facade's `mousedown` once per row mount. The disposer
  // returned by `dragon.from` removes the listener; the cleanup
  // path runs on unmount.
  useLayoutEffect(() => {
    if (!facade || !rowRef.current) return undefined;
    return facade.from(rowRef.current, () => ({
      type: 'NodeData',
      data: meta,
    }));
  }, [facade, meta]);
  // v2.2 fallback: manual pointerdown handler.
  const onPointerDown = (e: React.PointerEvent) => {
    if (facade) return; // facade path already wired above
    // Don't preventDefault — let built-in pointer events flow to the
    // BuiltinSimulatorHost's pointermove/pointerup listeners.
    setPressing(true);
    inner.boost(meta, e.clientX, e.clientY);
  };
  return h()(
    'div',
    {
      key: name,
      ref: rowRef,
      onPointerDown,
      onPointerUp: () => setPressing(false),
      onPointerLeave: () => setPressing(false),
      className:
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing select-none ' +
        'text-slate-700 hover:bg-slate-100 ' +
        (pressing ? 'bg-blue-100 ring-1 ring-blue-400' : ''),
      title: facade
        ? `Drag to canvas — wired via engine.dragon.from()` // v2.3 proof
        : `Drag to canvas — or click then click a sibling in the outline`,
    },
    h()(
      'span',
      {
        className:
          'inline-flex items-center justify-center w-5 h-5 rounded bg-slate-200 text-slate-600 text-[10px] font-mono',
      },
      name.slice(0, 2).toUpperCase(),
    ),
    h()('span', { className: 'text-xs font-medium' }, name),
  );
}

// Tiny re-export of React's useLayoutEffect so the v2.3 path
// is a true layout-effect (the row MUST be in the DOM before
// the facade's `mousedown` listener is attached). useLayoutEffect
// is the right hook for "attach a DOM listener after mount" —
// using useEffect would race the first mousedown.
const usePaletteLayoutEffect: typeof useLayoutEffect = useLayoutEffect;

export function ComponentPalette({ project, components, componentMeta, dragon }: ComponentPaletteProps) {
  // Force a re-render while a boost drag is in progress so the
  // pressed-row visual state stays in sync.
  const [, force] = useState(0);
  useEffect(() => {
    const bump = () => force((n) => n + 1);
    project.dragon.events.on('startBoost', bump);
    project.dragon.events.on('dropBoost', bump);
    project.dragon.events.on('cancelBoost', bump);
    return () => {
      project.dragon.events.off('startBoost', bump);
      project.dragon.events.off('dropBoost', bump);
      project.dragon.events.off('cancelBoost', bump);
    };
  }, [project]);

  const names = Object.keys(components).sort();

  if (names.length === 0) {
    return h()(
      'div',
      { className: 'text-slate-400 italic p-4 text-xs' },
      'No components registered. Pass `components` to init() to populate the palette.',
    );
  }

  return h()(
    'div',
    { className: 'flex flex-col gap-0.5 p-1' },
    ...names.map((name) => {
      // Build the BoostMeta with default props (if any) so the
      // settings panel has stable keys to render setters for
      // immediately after drop.
      const defaults = componentMeta?.[name];
      const meta: BoostMeta = defaults && Object.keys(defaults).length > 0
        ? { componentName: name, initialProps: defaults as BoostMeta['initialProps'] }
        : { componentName: name };
      return h()(PaletteItem, {
        key: name,
        name,
        meta,
        facade: dragon,
        inner: project.dragon,
      });
    }),
  );
}
