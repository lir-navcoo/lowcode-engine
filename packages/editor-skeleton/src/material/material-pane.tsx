/**
 * @monbolc/lowcode-editor-skeleton — MaterialPane
 *
 * The "components palette" view in the left pane when the host
 * switches to "components" mode (see `Skeleton.leftView`). Built
 * on top of BaseUI `Input` (search) and `Collapsible` (category
 * folding). Sapu's stance:
 *
 * - Search matches against `componentName`, `title`, OR `keywords`
 * (any one hit is enough). The match is case-insensitive substring.
 * - Categories are flattened into a single accordion-style list;
 * each category's components render as plain rows.
 *
 * v2.5: drag-source implementation is intentionally **not** in
 * scope here — the upstream material-pane uses `dragon.from(...)`
 * which is a P2.5+ follow-up. The pane instead renders static,
 * clickable rows that the host can wire to `dragon.from(...)` from
 * the outside (the existing `<ComponentPalette>` already does
 * this; MaterialPane is the "categorized + searchable" variant).
 *
 * Empty state: no categories → "No components registered. Call
 * `engine.registerComponent()` to add components." The empty hint
 * is the documented escape hatch for hosts that pass an empty
 * registry.
 */

import { useMemo, useState } from 'react';
import { Input } from '@base-ui-components/react/input';
import { Collapsible } from '@base-ui-components/react/collapsible';
import { adapter } from '@monbolc/lowcode-renderer-core';
import type { IPublicTypeComponentCategory, IPublicTypeComponentSchema } from '@monbolc/lowcode-types';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
 adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

/**
 * One visible row inside a category. Plain div + monogram + label;
 * the host wires the drag source via `onPick` from the outside.
 *
 * TODO (P2.5+): wire the row as a `dragon.from(rowEl, ...)` drag
 * source via the host-supplied `dragon` facade. For now this is a
 * static, clickable row. Picking fires `onPick(meta)`; the host
 * owns the side effect.
 */
interface MaterialRowProps {
 meta: IPublicTypeComponentSchema;
 onPick?: (meta: IPublicTypeComponentSchema) => void;
}

function MaterialRow({ meta, onPick }: MaterialRowProps) {
 const initials = meta.componentName.slice(0,2).toUpperCase();
 return h()(
 'div',
 {
 key: meta.componentName,
 role: 'button',
 tabIndex:0,
 onClick: () => onPick?.(meta),
 onKeyDown: (e: { key: string }) => {
 if (e.key === 'Enter' || e.key === ' ') onPick?.(meta);
 },
 className:
 'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer select-none ' +
 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none',
 title: meta.title || meta.componentName,
 },
 h()(
 'span',
 {
 className:
 'inline-flex items-center justify-center w-5 h-5 rounded bg-slate-200 ' +
 'text-slate-600 text-[10px] font-mono',
 },
 initials,
 ),
 h()(
 'span',
 { className: 'flex-1 min-w-0 truncate text-xs font-medium' },
 meta.title || meta.componentName,
 ),
 );
}

/**
 * Filter a single component against the search query. Matches
 * case-insensitive substring against `componentName`, `title`,
 * or any of `keywords`.
 */
function matchQuery(meta: IPublicTypeComponentSchema, query: string): boolean {
 if (query === '') return true;
 const q = query.toLowerCase();
 if (meta.componentName.toLowerCase().includes(q)) return true;
 if (meta.title && meta.title.toLowerCase().includes(q)) return true;
 if (meta.keywords && meta.keywords.some((k) => k.toLowerCase().includes(q))) return true;
 return false;
}

export interface MaterialPaneProps {
 /**
 * Categorized components, grouped by `IPublicTypeComponentCategory.id`.
 * Hosts construct this list at startup from the engine registry
 * (e.g. via `engine.getComponentCategories()`) and pass it here.
 */
 categories: IPublicTypeComponentCategory[];
 /**
 * Optional click handler. Fired when the user picks a row. Hosts
 * that want a different interaction (e.g. drag-only) can omit
 * this and the row's click is a no-op.
 */
 onPick?: (meta: IPublicTypeComponentSchema) => void;
}

/**
 * The visible material pane. Self-contained: owns the search
 * query state. No external subscriptions needed.
 */
export function MaterialPane(props: MaterialPaneProps) {
 const [query, setQuery] = useState('');

 // Pre-compute the filtered category list. Memoized so typing
 // in the search box doesn't recompute the layout until the
 // query actually changes.
 const filtered = useMemo(() => {
 if (query === '') return props.categories;
 return props.categories
 .map((cat) => ({
 ...cat,
 components: cat.components.filter((c) => matchQuery(c, query)),
 }))
 .filter((cat) => cat.components.length >0);
 }, [props.categories, query]);

 const totalCount = useMemo(
 () => filtered.reduce((sum, c) => sum + c.components.length,0),
 [filtered],
 );

 // Empty case: distinguish "no categories at all" from "no matches".
 if (props.categories.length ===0) {
 return h()(
 'div',
 { className: 'p-3 text-[12px] text-slate-500 italic' },
 'No components registered. Call engine.registerComponent() to add components.',
 );
 }

 if (totalCount ===0) {
 return h()(
 'div',
 { className: 'flex flex-col gap-2 p-2' },
 searchBox(query, setQuery),
 h()(
 'div',
 { className: 'p-3 text-[12px] text-slate-500 italic' },
 `No components match "${query}".`,
 ),
 );
 }

 return h()(
 'div',
 { className: 'flex flex-col gap-1 p-2' },
 searchBox(query, setQuery),
 h()(
 'div',
 { className: 'text-[10px] text-slate-500 px-1 pb-1' },
 `${totalCount} component${totalCount ===1 ? '' : 's'}`,
 ),
 h()(
 'div',
 { className: 'flex flex-col gap-1' },
 ...filtered.map((cat) =>
 h()(
 Collapsible.Root,
 {
 key: cat.id,
 defaultOpen: true,
 className: 'border border-slate-200 rounded bg-white',
 },
 h()(
 Collapsible.Trigger,
 {
 className:
 'w-full flex items-center justify-between px-2 py-1 text-[11px] ' +
 'font-semibold bg-slate-50 hover:bg-slate-100 border-b border-slate-200 ' +
 'data-[panel-open]:border-b data-[panel-open]:border-slate-200',
 },
 h()('span', null, cat.title),
 h()(
 'span',
 { className: 'text-slate-400 text-[10px]' },
 `${cat.components.length}`,
 ),
 ),
 h()(
 Collapsible.Panel,
 { className: 'p-1 flex flex-col gap-0.5' },
 ...cat.components.map((c) =>
 h()(MaterialRow, { key: c.componentName, meta: c, onPick: props.onPick }),
 ),
 ),
 ),
 ),
 ),
 );
}

/**
 * The shared search input. Lives outside the empty check so both
 * the "no categories" hint and the "no matches" hint share the
 * same input look.
 */
function searchBox(query: string, setQuery: (q: string) => void) {
 return h()(
 'div',
 { className: 'flex items-center gap-1' },
 h()(Input, {
 className:
 'flex-1 px-2 py-1 text-xs text-slate-900 border border-slate-300 rounded ' +
 'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
 placeholder: 'Search components',
 value: query,
 onChange: (e: { target: { value: string } }) => setQuery(e.target.value),
 }),
 );
}
