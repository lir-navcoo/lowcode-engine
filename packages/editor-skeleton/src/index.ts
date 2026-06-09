/**
 * @monbolc/lowcode-editor-skeleton — barrel export
 *
 * SapuLowcodeEngine L4 — 3-pane editor layout (outline + canvas + settings).
 */

export { Skeleton } from './skeleton';
export type { SkeletonProps } from './skeleton';

export { SettingsPanel } from './settings-panel';
export type { SettingsPanelProps } from './settings-panel';

export { Overlays } from './overlays';
export type { OverlaysProps } from './overlays';

export { DefaultDesignerView } from './designer-view';
export type { DesignerViewHelpers, DesignerViewProps } from './designer-view';

export { ComponentPalette } from './component-palette';
export type { ComponentPaletteProps } from './component-palette';

// ---- Phase D.I9: re-export the new ali-faithful bem-tool tree ----
// Consumers can import the slim `BuiltinSimulatorHostView` + `BemTools`
// from designer and mount them inside the editor skeleton. The slim
// `overlays.tsx` is the legacy hand-rolled DOM-tree; a follow-up
// commit will replace it with `<BemTools host={host}/>`.
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
