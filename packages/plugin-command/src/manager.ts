/**
 * @monbolc/lowcode-plugin-command — CommandManager
 *
 * Stores registered commands in a Map, runs them on demand, and maintains
 * an undo/redo history. Each history entry is `{ name, args, returnValue, command }`
 * so we can replay or undo without re-fetching the command.
 *
 * The manager is the only stateful piece; commands themselves are stateless.
 */

import { Emitter } from '@monbolc/lowcode-utils';

import type {
  CommandManagerEvents,
  CommandArgs,
  CommandResult,
  ICommand,
  ICommandManager,
} from './types';

interface HistoryEntry {
  name: string;
  args: CommandArgs;
  returnValue: unknown;
  command: ICommand;
  /** Timestamp of the most recent execute that landed in this entry. */
  lastTouchedAt: number;
}

/** Maximum size of the undo stack. Older entries are dropped. */
const DEFAULT_HISTORY_LIMIT = 200;

export interface CommandManagerOptions {
  /** Max undo-stack depth. Defaults to 200. */
  historyLimit?: number;
  /**
   * If true, two consecutive execute() calls of the same `mergeable` command
   * within `mergeWindowMs` are collapsed into one history entry. Defaults to true.
   */
  autoMerge?: boolean;
}

export class CommandManager implements ICommandManager {
  readonly events = new Emitter<CommandManagerEvents>();

  private readonly commands = new Map<string, ICommand>();
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private readonly historyLimit: number;
  private readonly autoMerge: boolean;

  constructor(options: CommandManagerOptions = {}) {
    this.historyLimit = Math.max(0, options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
    this.autoMerge = options.autoMerge ?? true;
  }

  register<TArgs = CommandArgs, TReturn = CommandResult>(
    command: ICommand<TArgs, TReturn>,
  ): void {
    if (this.commands.has(command.name)) {
      throw new Error(
        `[CommandManager] command "${command.name}" is already registered`,
      );
    }
    this.commands.set(command.name, command as unknown as ICommand);
    this.events.emit('registered', { name: command.name });
  }

  unregister(name: string): boolean {
    const existed = this.commands.delete(name);
    if (existed) {
      this.events.emit('unregistered', { name });
      // Also drop any in-flight history entries for that command.
      this.pruneHistoryFor(name);
    }
    return existed;
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  get(name: string): ICommand | undefined {
    return this.commands.get(name);
  }

  list(): ICommand[] {
    return Array.from(this.commands.values());
  }

  async execute<TArgs = CommandArgs, TReturn = CommandResult>(
    name: string,
    args?: TArgs,
  ): Promise<TReturn | undefined> {
    const command = this.commands.get(name) as
      | ICommand<TArgs, TReturn>
      | undefined;
    if (!command) {
      throw new Error(`[CommandManager] no command registered as "${name}"`);
    }

    let returnValue: TReturn | undefined;
    try {
      returnValue = await command.execute(args);
    } catch (err) {
      // Do NOT push to history on failure. Re-throw so caller can react.
      throw err;
    }

    this.recordHistory(name, args, returnValue, command as unknown as ICommand);
    this.events.emit('executed', { name, args, result: returnValue });
    return returnValue;
  }

  async undo(): Promise<void> {
    const entry = this.undoStack.pop();
    if (!entry) return;
    try {
      if (entry.command.undo) {
        await entry.command.undo(entry.args, entry.returnValue);
      }
      this.redoStack.push(entry);
      this.events.emit('undone', { name: entry.name });
    } catch (err) {
      // Restore the entry on failure so the user doesn't lose the chance to retry.
      this.undoStack.push(entry);
      throw err;
    }
  }

  async redo(): Promise<void> {
    const entry = this.redoStack.pop();
    if (!entry) return;
    try {
      const returnValue = await entry.command.execute(entry.args);
      // Replace the entry with a fresh one (new timestamp + return value).
      this.undoStack.push({ ...entry, returnValue, lastTouchedAt: Date.now() });
      this.events.emit('redone', { name: entry.name });
    } catch (err) {
      this.redoStack.push(entry);
      throw err;
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undoStackSize(): number {
    return this.undoStack.length;
  }

  redoStackSize(): number {
    return this.redoStack.length;
  }

  clearHistory(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.events.emit('cleared', {});
  }

  // --- internals ---

  private recordHistory(
    name: string,
    args: CommandArgs,
    returnValue: unknown,
    command: ICommand,
  ): void {
    // Reset redo stack on any new execute (standard undo/redo semantics).
    if (this.redoStack.length > 0) this.redoStack.length = 0;

    if (this.autoMerge && command.mergeable) {
      const top = this.undoStack[this.undoStack.length - 1];
      const mergeWindow = command.mergeWindowMs ?? 500;
      const now = Date.now();
      if (
        top &&
        top.name === name &&
        now - top.lastTouchedAt <= mergeWindow
      ) {
        // Update the latest args (the most recent user input) BUT
        // keep the original returnValue. For commands like SetProp
        // that store the previous state in returnValue, this ensures
        // undo restores the value that existed BEFORE the first edit
        // in the merge window — not the value that existed before
        // the last edit.
        top.args = args;
        top.lastTouchedAt = now;
        return;
      }
    }

    this.undoStack.push({
      name,
      args,
      returnValue,
      command,
      lastTouchedAt: Date.now(),
    });

    // Trim oldest if over the limit.
    while (this.undoStack.length > this.historyLimit) {
      this.undoStack.shift();
    }
  }

  private pruneHistoryFor(name: string): void {
    const filter = (entry: HistoryEntry) => entry.name !== name;
    this.undoStack.splice(0, this.undoStack.length, ...this.undoStack.filter(filter));
    this.redoStack.splice(0, this.redoStack.length, ...this.redoStack.filter(filter));
  }
}
