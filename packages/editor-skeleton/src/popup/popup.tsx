/**
 * @monbolc/lowcode-editor-skeleton — SapuPopup (renderer)
 *
 * Materializes the `popupService` descriptors as BaseUI `Popover`
 * widgets. Mount this once near the root of the editor; it
 * subscribes to the service and re-renders when descriptors are
 * added or removed.
 *
 * The component itself does not own any state. It reads from
 * `popupService.list()` on each render. Each descriptor becomes
 * one BaseUI `Popover.Root` → `Popover.Trigger` (anchored to the
 * descriptor's `anchor`) → `Popover.Positioner` → `Popover.Popup`.
 *
 * Edge cases:
 * - The `anchor` may be a RefObject whose `.current` is null
 * (the target unmounted between `open()` and render). In that
 * case we render `null` for that descriptor — the descriptor
 * stays in the service so `close(id)` is a no-op and the user
 * can re-anchor it.
 */

import { useEffect, useState } from 'react';
import { Popover } from '@base-ui-components/react/popover';
import { adapter } from '@monbolc/lowcode-renderer-core';

import type { PopupDescriptor } from './service';
import { popupService } from './service';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
 adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

/**
 * Resolve an anchor field to the live HTMLElement. Supports both
 * raw HTMLElement and `RefObject<HTMLElement>` (returns `.current`).
 */
function resolveAnchor(anchor: PopupDescriptor['anchor']): HTMLElement | null {
 if (anchor && typeof anchor === 'object' && 'current' in anchor) {
 const refObj = anchor as { current: HTMLElement | null };
 return refObj.current ?? null;
 }
 return anchor as HTMLElement | null;
}

/**
 * The visible popup renderer. Hosts mount this once near the root
 * of the editor (typically as a sibling of the3-pane layout).
 */
export function SapuPopup() {
 // Snapshot the descriptors. Re-reads on every `change` from the
 // service. We use a useState + force-bump pattern (same as
 // SapuToaster) so the subscription stays minimal.
 const [, force] = useState(0);
 useEffect(() => popupService.subscribe(() => force((n) => n +1)), []);

 const descriptors = popupService.list();

 // Empty case → render nothing. The element is intentionally
 // `display: contents` (no DOM cost) so it can be dropped into
 // any container without affecting layout.
 if (descriptors.length ===0) {
 return h()('div', { 'data-sapu-popups': '', style: { display: 'contents' } });
 }

 return h()(
 'div',
 { 'data-sapu-popups': '', style: { display: 'contents' } },
 ...descriptors.map((desc) => {
 const anchorEl = resolveAnchor(desc.anchor);
 if (!anchorEl) return null;
 return h()(
 Popover.Root,
 {
 key: desc.id,
 // We open by default; the service is the source of truth for
 // visibility (a closed descriptor has already been removed from
 // the list).
 open: true,
 modal: false,
 },
 // Trigger is the resolved anchor element. BaseUI's `Popover.Trigger`
 // accepts a virtual element via `render`. Since the anchor is a
 // real HTMLElement, we attach an `aria-hidden` so it isn't double-
 // announced as a button (the user's existing element keeps its
 // own semantics).
 h()(
 Popover.Trigger,
 {
 // `render` keeps BaseUI from adding its own button around the
 // anchor — we want the existing element to keep its identity.
 render: () => {
 anchorEl.setAttribute('data-sapu-popup-anchor', desc.id);
 return anchorEl;
 },
 // BaseUI expects a click on the trigger; for an external anchor
 // we open it programmatically via the Root's `open` prop above.
 'aria-hidden': 'true',
 tabIndex: -1,
 style: { display: 'none' },
 },
 ),
 h()(
 Popover.Portal,
 null,
 h()(
 Popover.Positioner,
 {
 side: desc.placement,
 sideOffset:6,
 className: 'z-[10002] outline-none',
 },
 h()(
 Popover.Popup,
 {
 className:
 'bg-white text-slate-900 text-xs rounded-md border border-slate-200 ' +
 'shadow-lg p-2 min-w-[160px]',
 },
 desc.content,
 ),
 ),
 ),
 );
 }),
 );
}
