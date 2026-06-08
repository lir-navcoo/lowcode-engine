/**
 * @monbolc/lowcode-editor-skeleton — ComponentPalette
 *
 * A vertical list of the components a host has registered, displayed
 * in the left pane. Each row is a drag-source for the L3 `Dragon`:
 * on `pointerdown`, the row calls `dragon.boost({ componentName,
 * initialProps })`. The actual drop target / insertion is handled
 * by BuiltinSimulatorHost (which is mounted by the parent Skeleton).
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

import { useEffect, useState } from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { Dragon, type BoostMeta, type Project } from '@monbolc/lowcode-designer';

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
}

interface PaletteItemProps {
  name: string;
  meta: BoostMeta;
  dragon: Dragon;
}

/** One draggable row. On `pointerdown` → `dragon.boost`. */
function PaletteItem({ name, meta, dragon }: PaletteItemProps) {
  const [pressing, setPressing] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    // Don't preventDefault — let built-in pointer events flow to the
    // BuiltinSimulatorHost's pointermove/pointerup listeners.
    setPressing(true);
    dragon.boost(meta, e.clientX, e.clientY);
  };
  return h()(
    'div',
    {
      key: name,
      onPointerDown,
      onPointerUp: () => setPressing(false),
      onPointerLeave: () => setPressing(false),
      className:
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing select-none ' +
        'text-slate-700 hover:bg-slate-100 ' +
        (pressing ? 'bg-blue-100 ring-1 ring-blue-400' : ''),
      title: `Drag to canvas — or click then click a sibling in the outline`,
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

export function ComponentPalette({ project, components, componentMeta }: ComponentPaletteProps) {
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
      return h()(PaletteItem, { key: name, name, meta, dragon: project.dragon });
    }),
  );
}
