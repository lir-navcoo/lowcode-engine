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

// ---- Phase T3 (v2.3.0): L4 UI 基础设施 — settings / popup / field / material ----

// Settings pane: tabs + breadcrumb + empty-state notices on top of
// the L3 SettingTopEntry tree.
export { SettingsPrimaryPane } from './settings/settings-primary-pane';
export type { SettingsPrimaryPaneProps } from './settings/settings-primary-pane';

// Popup: imperative registry + BaseUI Popover renderer.
export { SapuPopupService, popupService } from './popup/service';
export type {
  PopupDescriptor,
  PopupPlacement,
  PopupOpenOptions,
} from './popup/service';
export { SapuPopup } from './popup/popup';

// Setter field wrappers (used when editing a component's `configure`
// meta — each wrapper is bound to one IPublicTypeFieldConfig).
export {
  ExtraPropsField,
  TitleField,
  DescriptionField,
  SetterTypeField,
  DefaultValueField,
} from './field/field-wrappers';

// Material pane: categorized + searchable components palette.
export { MaterialPane } from './material/material-pane';
export type { MaterialPaneProps } from './material/material-pane';
