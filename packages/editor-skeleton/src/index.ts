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

export { ComponentPalette } from './component-palette';
export type { ComponentPaletteProps } from './component-palette';

export {
  SapuToaster,
  createToastManager,
  SapuModal,
  SapuFloatingPanel,
} from './widgets';
export type {
  SapuToastItem,
  SapuToastManagerApi,
  ToastTone,
  SapuModalProps,
  SapuFloatingPanelProps,
} from './widgets';
