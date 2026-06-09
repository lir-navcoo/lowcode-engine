/**
 * @monbolc/lowcode-editor-skeleton — barrel export
 *
 * SapuLowcodeEngine L4 — 3-pane editor layout (outline + canvas + settings).
 */

export { Skeleton } from './skeleton';
export type { SkeletonProps } from './skeleton';

export { SettingsPanel } from './settings-panel';
export type { SettingsPanelProps } from './settings-panel';

export { DefaultDesignerView } from './designer-view';
export type { DesignerViewHelpers, DesignerViewProps } from './designer-view';

export { ComponentPalette } from './component-palette';
export type { ComponentPaletteProps } from './component-palette';

// ---- Phase D.I9 + D.I7b.4: re-export the new ali-faithful bem-tool tree ----
// Phase D.I7b.4: the legacy P6 `<Overlays>` (imperative DOM-tree)
// is replaced by the Phase D.I6 `<BemTools>` (React + observerHOC)
// in `DefaultDesignerView`. The `Overlays` export is removed from
// the barrel — consumers who need the new tree import from
// `@monbolc/lowcode-designer` directly (re-exported below).
export { BuiltinSimulatorHostView, BemTools } from '@monbolc/lowcode-designer';

export {
  SapuToaster,
  createToastManager,
  SapuModal,
  SapuFloatingPanel,
  OutlineIcon,
  ComponentsIcon,
  CloseIcon,
} from './widgets';
export type {
  SapuToastItem,
  SapuToastManagerApi,
  ToastTone,
  SapuModalProps,
  SapuFloatingPanelProps,
} from './widgets';
