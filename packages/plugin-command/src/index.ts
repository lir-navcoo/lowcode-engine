/**
 * @monbolc/lowcode-plugin-command — barrel export
 *
 * Command pattern + undo/redo history + keyboard shortcuts.
 * SapuLowcodeEngine L2.
 */

export type {
  CommandArgs,
  CommandResult,
  CommandManagerEvents,
  ICommand,
  ICommandManager,
} from './types';

export { CommandManager } from './manager';
export type { CommandManagerOptions } from './manager';

export {
  parseShortcut,
  bindShortcuts,
  isMacOS,
} from './shortcut';
export type {
  ParsedShortcut,
  ShortcutBinder,
  ShortcutBinderOptions,
  ShortcutToken,
} from './shortcut';
