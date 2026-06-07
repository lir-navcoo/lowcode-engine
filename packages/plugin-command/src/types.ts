/**
 * @monbolc/lowcode-plugin-command — public types
 *
 * The command pattern lets plugins expose "actions" that the user can invoke
 * by name (from the menu, a button, or a keyboard shortcut). Each command
 * knows how to do its work, and — if reversible — how to undo it.
 */

import type { Emitter } from '@monbolc/lowcode-utils';

/** Anything a command can receive when invoked. */
export type CommandArgs = unknown;

/** What a command returns after a successful execute. */
export type CommandResult = void | CommandArgs | Promise<void | CommandArgs>;

/** A single command. Stateless; all per-instance state lives in the manager. */
export interface ICommand<TArgs = CommandArgs, TReturn = CommandResult> {
  /** Globally unique name within a CommandManager (e.g. `"designer.duplicate"`). */
  readonly name: string;

  /** Human-readable label, for menus / tooltips. */
  readonly label?: string;

  /** Optional grouping key (e.g. `"file"`, `"edit"`). */
  readonly group?: string;

  /** Optional keyboard binding (e.g. `"Mod+Z"`, `"Ctrl+Shift+P"`). */
  readonly shortcut?: string | string[];

  /** Run the command. If it throws, the manager will not push to history. */
  execute(args?: TArgs): TReturn;

  /** Undo a previous execute. If absent, the command is not reversible. */
  undo?(args?: TArgs, returnValue?: TReturn): TReturn | Promise<TReturn>;

  /**
   * Merge with the previous command of the same name if both
   * `mergeable` and the time delta is below `mergeWindowMs`.
   * Useful for drag-resize, text typing, etc.
   */
  readonly mergeable?: boolean;
  readonly mergeWindowMs?: number;
}

/** Events emitted by CommandManager. */
export interface CommandManagerEvents extends Record<string, unknown> {
  /** A command was registered. Payload: the command's name. */
  registered: { name: string };
  /** A command was unregistered. */
  unregistered: { name: string };
  /** A command finished executing. */
  executed: { name: string; args: unknown; result: unknown };
  /** The manager undid the most recent command. */
  undone: { name: string };
  /** The manager redid a previously undone command. */
  redone: { name: string };
  /** History stack was cleared (e.g. on document reset). */
  cleared: Record<string, never>;
}

export interface ICommandManager {
  /** Underlying event bus. Subscribe to `CommandManagerEvents`. */
  readonly events: Emitter<CommandManagerEvents>;

  /** Register a command. Throws if `name` is already taken. */
  register<TArgs = CommandArgs, TReturn = CommandResult>(
    command: ICommand<TArgs, TReturn>,
  ): void;

  /** Unregister a command by name. */
  unregister(name: string): boolean;

  /** True if a command with this name is registered. */
  has(name: string): boolean;

  /** Get a registered command by name, or undefined. */
  get(name: string): ICommand | undefined;

  /** All registered commands (snapshot). */
  list(): ICommand[];

  /** Execute a command by name. */
  execute<TArgs = CommandArgs, TReturn = CommandResult>(
    name: string,
    args?: TArgs,
  ): Promise<TReturn | undefined>;

  /** Undo the most recent reversible command. No-op if stack is empty. */
  undo(): Promise<void>;

  /** Redo the most recent undone command. No-op if redo stack is empty. */
  redo(): Promise<void>;

  canUndo(): boolean;
  canRedo(): boolean;

  /** Number of commands in the undo stack. */
  undoStackSize(): number;

  /** Number of commands in the redo stack. */
  redoStackSize(): number;

  /** Clear both stacks (e.g. on document reset). */
  clearHistory(): void;
}
