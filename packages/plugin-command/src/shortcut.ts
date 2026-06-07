/**
 * @monbolc/lowcode-plugin-command — keyboard shortcut binding
 *
 * Parses shortcut strings like `"Mod+Z"` / `"Ctrl+Shift+P"` and binds them
 * to a command manager so users can undo/redo with the keyboard.
 *
 * "Mod" maps to Cmd on macOS and Ctrl elsewhere — the conventional behavior
 * in editor apps (VSCode, Figma, etc.).
 */

import type { ICommand } from './types';
import type { ICommandManager } from './types';

export type ShortcutToken = 'Mod' | 'Ctrl' | 'Meta' | 'Shift' | 'Alt';

const MODIFIER_KEYS: ReadonlySet<ShortcutToken> = new Set([
  'Mod',
  'Ctrl',
  'Meta',
  'Shift',
  'Alt',
]);

export interface ParsedShortcut {
  /** Original input, normalized. */
  raw: string;
  /** Required modifier keys. */
  modifiers: ReadonlySet<ShortcutToken>;
  /** Lower-cased key code, e.g. "z", "p", "escape". */
  key: string;
}

export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * Parse a shortcut string. Examples:
 *   "Mod+Z"     -> { modifiers: {Mod}, key: "z" }
 *   "Ctrl+Shift+P" -> { modifiers: {Ctrl, Shift}, key: "p" }
 */
export function parseShortcut(input: string): ParsedShortcut {
  if (!input || typeof input !== 'string') {
    throw new Error(`[shortcut] invalid shortcut: ${String(input)}`);
  }
  const parts = input
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `[shortcut] shortcut must include at least one modifier + a key, got: "${input}"`,
    );
  }
  const key = parts[parts.length - 1].toLowerCase();
  const modifiers = new Set<ShortcutToken>();
  for (const p of parts.slice(0, -1)) {
    const token = p as ShortcutToken;
    if (!MODIFIER_KEYS.has(token)) {
      throw new Error(`[shortcut] unknown modifier "${p}" in "${input}"`);
    }
    modifiers.add(token);
  }
  return { raw: input, modifiers, key };
}

function eventModifiersPressed(e: KeyboardEvent): Set<ShortcutToken> {
  const set = new Set<ShortcutToken>();
  const mod = isMacOS() ? 'Meta' : 'Ctrl';
  if (e.getModifierState(mod)) set.add('Mod');
  if (e.shiftKey) set.add('Shift');
  if (e.altKey) set.add('Alt');
  // Direct Meta key on macOS is already counted as Mod; on non-mac the Meta key
  // (Windows key) is intentionally ignored.
  return set;
}

function sameModifiers(a: ReadonlySet<ShortcutToken>, b: ReadonlySet<ShortcutToken>): boolean {
  if (a.size !== b.size) return false;
  for (const m of a) if (!b.has(m)) return false;
  return true;
}

export interface ShortcutBinderOptions {
  /**
   * The keyboard event target. Defaults to `window` when running in a browser.
   * Pass a different HTMLElement for scoped bindings (e.g. inside a Shadow DOM).
   */
  target?: EventTarget;
  /** If true (default), `preventDefault()` is called on a matched shortcut. */
  preventDefault?: boolean;
}

export interface ShortcutBinder {
  /** Stop listening and release references. */
  dispose(): void;
  /** Currently bound commands (snapshot). */
  bindings(): ICommand[];
}

/**
 * Walk all registered commands, find any with a `shortcut` field, and wire them
 * up to a global keydown listener on the chosen target.
 */
export function bindShortcuts(
  manager: ICommandManager,
  options: ShortcutBinderOptions = {},
): ShortcutBinder {
  if (typeof window === 'undefined') {
    return { dispose: () => undefined, bindings: () => [] };
  }
  const target = options.target ?? window;
  const preventDefault = options.preventDefault ?? true;

  const parsed: Array<{ command: ICommand; shortcut: ParsedShortcut }> = [];
  for (const cmd of manager.list()) {
    const shortcuts = ([] as string[]).concat(cmd.shortcut ?? []);
    for (const s of shortcuts) {
      try {
        parsed.push({ command: cmd, shortcut: parseShortcut(s) });
      } catch {
        // Skip malformed shortcuts silently — they shouldn't break the binder.
      }
    }
  }

  const handler = (e: Event) => {
    const ke = e as KeyboardEvent;
    const pressed = eventModifiersPressed(ke);
    const key = ke.key.toLowerCase();
    for (const { command, shortcut } of parsed) {
      if (shortcut.key === key && sameModifiers(pressed, shortcut.modifiers)) {
        if (preventDefault) ke.preventDefault();
        // Fire-and-forget; errors land in console.
        void manager.execute(command.name).catch((err) => {
          if (typeof console !== 'undefined' && console.error) {
            console.error(`[shortcut] "${command.name}" failed:`, err);
          }
        });
        return;
      }
    }
  };

  target.addEventListener('keydown', handler as EventListener);
  return {
    dispose: () => target.removeEventListener('keydown', handler as EventListener),
    bindings: () => parsed.map((p) => p.command),
  };
}
