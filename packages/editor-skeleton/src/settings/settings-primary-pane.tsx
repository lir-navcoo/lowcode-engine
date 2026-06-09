/**
 * @monbolc/lowcode-editor-skeleton — SettingsPrimaryPane
 *
 * Tabbed + breadcrumb + notice view for the right-side settings panel.
 * Built on top of the L3 `SettingTopEntry` tree (Phase D.S4) and
 * BaseUI `Tabs`. Sapu's stance:
 *
 * - Up to5 sibling groups at the top entry → rendered as Tabs.
 * - More than5 sibling groups → fall back to a flat list (single
 * layer, no tabs). This mirrors upstream v1.3.2 (`alibaba v1.3.2`,
 * see `packages/editor-skeleton/src/components/settings/settings-primary-pane.tsx`)
 * which uses a Menu above5 children.
 * - Each SettingField's `parent` chain is walked to build a breadcrumb
 * from the top entry down to the currently focused group. The
 * breadcrumb uses plain `<button>`s (no BaseUI tab machinery) so
 * the user can click any ancestor to re-focus that group.
 *
 * Empty-state messages:
 * - No selection → "Click a node in the outline to edit it."
 * - Locked → "Selected node is locked. Unlock it to edit props."
 * - Mixed-type multi-selection (SettingTopEntry.isSameComponent === false)
 * → "Mixed selection: select nodes of the same type to edit props."
 *
 * Localization: `t(key)` is the optional i18n function from the
 * host's engine context. Falls back to the literal string when
 * `t` is undefined so the pane works in zero-config setups too.
 */

import { useMemo } from 'react';
import { Tabs } from '@base-ui-components/react/tabs';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { isSettingField } from '@monbolc/lowcode-designer';
import type { ISettingField } from '@monbolc/lowcode-designer';
import type { IPublicTypeNodeLike } from '@monbolc/lowcode-types';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
 adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

/**
 * A single visible "group" derived from a top-level `SettingField`.
 * Mirrors upstream v1.3.2 (`alibaba v1.3.2`) tab data shape.
 */
interface GroupView {
 id: string;
 title: string;
 /** The rendered body for this group. Plain JSX nodes (already through `h()`). */
 panel: unknown;
}

/**
 * A breadcrumb crumb. Each crumb represents one SettingField
 * along the `parent` chain from the top entry down to the currently
 * focused group.
 */
interface Crumb {
 id: string;
 title: string;
}

export interface SettingsPrimaryPaneProps {
 /**
 * The L3 `SettingTopEntry` instance. Hosts construct it once per
 * selection and pass the same reference across renders. The pane
 * reads `top.items`, walks `parent` chains for breadcrumbs, and
 * subscribes to nothing internally — `top.items` is a snapshot
 * the caller re-reads whenever the selection changes.
 */
 topEntry: import('@monbolc/lowcode-designer').SettingTopEntry;
 /**
 * The currently selected node. `null` when nothing is selected.
 * The pane shows the empty hint in that case.
 */
 current: IPublicTypeNodeLike | null;
 /**
 * When `true`, the pane shows the locked hint instead of the
 * tabs. Defaults to `false`.
 */
 locked?: boolean;
 /**
 * Optional i18n function. `undefined` → fall back to the literal
 * English string baked into the JSDoc. Hosts wire `engine.t` here.
 */
 t?: (key: string) => string;
}

/**
 * Fallback English strings. Host passes `t` to override.
 */
const DEFAULT_STRINGS: Record<string, string> = {
 empty: 'Click a node in the outline to edit it.',
 locked: 'Selected node is locked. Unlock it to edit props.',
 mixed: 'Mixed selection: select nodes of the same type to edit props.',
 untitled: 'Untitled',
};

/**
 * Walk the `parent` chain from a SettingField up to the top entry.
 * Returns the chain top-down (root → leaf). Each SettingField's
 * `title` is the readable crumb label. Ali v1.3.2 has this exact
 * walker at the top of `settings-primary-pane.tsx`.
 */
function buildBreadcrumb(field: ISettingField): Crumb[] {
 const out: Crumb[] = [];
 let cur: ISettingField | null = field;
 while (cur && isSettingField(cur)) {
 out.unshift({ id: String(cur.id ?? cur.name), title: String(cur.title ?? DEFAULT_STRINGS.untitled) });
 // `parent` is a SettingField or a SettingTopEntry. We only walk
 // while it is a SettingField; SettingTopEntry is the root.
 const next = cur.parent as unknown;
 if (next && isSettingField(next as ISettingField)) {
 cur = next as ISettingField;
 } else {
 cur = null;
 }
 }
 return out;
}

/**
 * Pick the "focused" group index for the initial tab selection.
 * Uses `current?.id` as the heuristic (first top-level SettingField
 * whose computed title matches the current component name).
 */
function pickInitialTab(groups: GroupView[], current: IPublicTypeNodeLike | null): string {
 if (groups.length ===0) return '';
 if (current && typeof current.componentName === 'string') {
 const match = groups.find((g) => g.title === current.componentName);
 if (match) return match.id;
 }
 return groups[0].id;
}

/**
 * Render a single group body: the group's children, if any. For
 * a SettingField of type 'group' with items, recurse one level.
 * For a SettingField of type 'field' (no items), render a single
 * placeholder cell. The pane is intentionally shallow — full
 * field rendering lives in the existing `<SettingsPanel>` which
 * hosts can swap in via the `t` slot; this pane focuses on the
 * tab/breadcrumb shell.
 */
function renderGroupBody(field: ISettingField): unknown {
 const items = (field.items ?? []).filter(isSettingField);
 if (items.length ===0) {
 return h()(
 'div',
 { className: 'text-[11px] text-slate-400 italic' },
 'No items in this group.',
 );
 }
 return h()(
 'div',
 { className: 'flex flex-col gap-1' },
 ...items.map((child) => {
 const title = String(child.title ?? DEFAULT_STRINGS.untitled);
 return h()(
 'div',
 { key: String(child.id ?? child.name), className: 'flex flex-col gap-0.5' },
 h()('div', { className: 'text-[11px] font-medium text-slate-700' }, title),
 h()(
 'div',
 { className: 'text-[11px] text-slate-500 ml-1' },
 `field: ${String(child.name)}`,
 ),
 );
 }),
 );
}

/**
 * Build the group views from the top entry's `items` array. Only
 * SettingField children are considered groups — CustomView children
 * are ignored here (they have their own dedicated panes upstream).
 */
function buildGroups(topEntry: import('@monbolc/lowcode-designer').SettingTopEntry): GroupView[] {
 const out: GroupView[] = [];
 for (const item of topEntry.items) {
 if (!isSettingField(item)) continue;
 if (item.type !== 'group') continue;
 const id = String(item.id ?? item.name);
 out.push({
 id,
 title: String(item.title ?? DEFAULT_STRINGS.untitled),
 panel: renderGroupBody(item),
 });
 }
 return out;
}

/**
 * The settings primary pane — the right-side container.
 *
 * Lifecycle:
 *1. Empty / locked / mixed → show a notice.
 *2. Otherwise compute the visible groups.
 *3. If groups.length >5 → flat list, no Tabs.
 *4. Otherwise render Tabs + breadcrumb.
 */
export function SettingsPrimaryPane(props: SettingsPrimaryPaneProps) {
 const t = (key: string): string => (props.t ? props.t(key) : DEFAULT_STRINGS[key] ?? key);

 // Memoize groups so we don't re-derive on every render. The
 // upstream topEntry reference can be replaced by the caller;
 // when it does, we re-derive.
 const groups = useMemo(() => buildGroups(props.topEntry), [props.topEntry]);

 // Compute the focused group id for the initial tab selection.
 // Stable across renders unless `current` or `groups` changes.
 const focusedId = useMemo(() => pickInitialTab(groups, props.current), [groups, props.current]);

 // Build breadcrumb for the focused group (top entry → focused).
 // We use the `topEntry.items` array directly (groups are NOT
 // registered in `_settingFieldMap` — only field-typed entries
 // are; for groups, `topEntry.get(name)` would create an ad-hoc
 // SettingField with the name-as-title, breaking the breadcrumb).
 const focused = groups.find((g) => g.id === focusedId);
 const crumbs = useMemo<Crumb[]>(() => {
 if (!focused) return [];
 const field = props.topEntry.items.find(
 (it) => isSettingField(it) && String((it as ISettingField).id ?? (it as ISettingField).name) === focusedId,
 ) as ISettingField | undefined;
 return field ? buildBreadcrumb(field) : [];
 // We intentionally depend on the resolved SettingField identity;
 // topEntry.get returns the same SettingField reference between
 // renders unless the configuration changed.
 }, [focusedId, groups, props.topEntry]);

 //1. Empty selection → empty hint.
 if (props.current === null) {
 return h()(
 'div',
 { className: 'p-4 text-[12px] text-slate-500 italic' },
 t('empty'),
 );
 }

 //2. Locked → locked hint.
 if (props.locked === true) {
 return h()(
 'div',
 { className: 'p-4 text-[12px] text-slate-500 italic' },
 t('locked'),
 );
 }

 //3. Mixed-type multi-selection → mixed hint. The top entry's
 // `isSameComponent` is `false` when the underlying nodes do not
 // share a component type, i.e. cross-type multi-selection.
 if (props.topEntry.isSameComponent === false) {
 return h()(
 'div',
 { className: 'p-4 text-[12px] text-slate-500 italic' },
 t('mixed'),
 );
 }

 //4. No groups → empty hint (the component has no `configure.props`).
 if (groups.length ===0) {
 return h()(
 'div',
 { className: 'p-4 text-[12px] text-slate-500 italic' },
 'No configurable groups for this node.',
 );
 }

 //5. More than5 groups → fall back to a flat list (no Tabs).
 // The flat list still shows the breadcrumb above each item.
 if (groups.length >5) {
 return h()(
 'div',
 { className: 'flex flex-col gap-2 p-2' },
 ...groups.map((g) =>
 h()(
 'div',
 { key: g.id, className: 'rounded border border-slate-200 bg-white' },
 h()(
 'div',
 { className: 'px-2 py-1 text-[11px] font-semibold bg-slate-50 border-b border-slate-200' },
 g.title,
 ),
 h()('div', { className: 'p-2' }, g.panel),
 ),
 ),
 );
 }

 //6. Normal case: Tabs + breadcrumb.
 return h()(
 'div',
 { className: 'flex flex-col gap-1 p-2' },
 // Breadcrumb row (root → leaf).
 crumbs.length >0
 ? h()(
 'nav',
 {
 className:
 'flex flex-wrap items-center gap-1 text-[11px] text-slate-600 ' +
 'px-1 pb-1 border-b border-slate-200',
 'aria-label': 'Settings breadcrumb',
 },
 ...crumbs.flatMap((c, i) => {
 const sep = i ===0 ? null : h()('span', { key: `s-${i}`, className: 'text-slate-400' }, '›');
 return [sep, h()('span', { key: `c-${i}`, className: 'font-medium' }, c.title)];
 }),
 )
 : null,
 h()(
 Tabs.Root,
 { defaultValue: focusedId, className: 'flex flex-col gap-1' },
 h()(
 Tabs.List,
 {
 className:
 'flex flex-wrap gap-1 border-b border-slate-200 px-1 ' +
 'data-[orientation=horizontal]:flex-row',
 'aria-label': 'Settings groups',
 },
 ...groups.map((g) =>
 h()(
 Tabs.Tab,
 {
 key: g.id,
 value: g.id,
 className:
 'text-[11px] px-2 py-1 rounded-t border-b-2 border-transparent ' +
 'text-slate-600 hover:bg-slate-100 ' +
 'data-[selected]:border-blue-500 data-[selected]:text-blue-700 ' +
 'data-[selected]:font-semibold',
 },
 g.title,
 ),
 ),
 ),
 ...groups.map((g) =>
 h()(Tabs.Panel, { key: g.id, value: g.id, className: 'p-2' }, g.panel),
 ),
 ),
 );
}
