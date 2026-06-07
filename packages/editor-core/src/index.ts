/**
 * @monbolc/lowcode-editor-core — barrel export
 *
 * SapuLowcodeEngine core API surface (L2). DI + i18n + plugin registry +
 * command manager + event bus. No React, no mobx — that's L3+.
 */

// --- public types ---
export type {
  EditorEvents,
  EditorPhase,
  IEditor,
  I18n,
  I18nMessage,
  IPlugin,
  IPluginContext,
  IPluginManager,
  ServiceFactory,
} from './types';

// --- DI ---
export { DIContainer } from './di';
export type { Factory } from './di';

// --- i18n ---
export { I18nImpl } from './i18n';

// --- plugin manager ---
export { PluginManager } from './plugin';

// --- editor (composition root) ---
export { Editor } from './editor';
export type { EditorOptions } from './editor';
