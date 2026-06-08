/**
 * @monbolc/lowcode-engine — theme management
 *
 * A tiny theme switcher backed by a single `data-theme` attribute
 * on `<html>`. The Skeleton's CSS targets `[data-theme="dark"]` /
 * `[data-theme="light"]` to flip the palette.
 *
 * Sapu stance: no CSS-in-JS, no Tailwind dark-mode plugin (those
 * are bigger than the surface area they cover). A `data-theme`
 * attribute is the simplest way to switch palettes without
 * shipping a stylesheet per theme.
 *
 * The current theme is tracked in a module-level variable; the
 * `setTheme` function fires `themeChanged` on every registered
 * subscriber. There's no `EngineEventBus` here — `setTheme` is a
 * static singleton helper that fires via the `onThemeChange`
 * listener API, not the engine bus. (The engine bus's
 * `themeChanged` event fires when the host calls
 * `engine.events.emit('themeChanged', ...)` themselves.)
 */

import type { SupportedTheme } from './preset';

let currentTheme: SupportedTheme = 'light';
const subscribers = new Set<(from: SupportedTheme, to: SupportedTheme) => void>();

/** Return the current theme name. */
export function getTheme(): SupportedTheme {
  return currentTheme;
}

/**
 * Switch the active theme. Writes the new name to
 * `document.documentElement.dataset.theme` and notifies every
 * subscriber. If the name is unchanged, this is a no-op.
 */
export function setTheme(name: SupportedTheme): void {
  if (name !== 'light' && name !== 'dark') {
    throw new Error(`[engine.setTheme] unsupported theme "${name}". Expected 'light' or 'dark'.`);
  }
  if (name === currentTheme) return;
  const from = currentTheme;
  currentTheme = name;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = name;
  }
  for (const fn of subscribers) {
    try {
      fn(from, name);
    } catch {
      // Swallow subscriber errors so one bad listener doesn't
      // block the rest. The error surfaces in the console via
      // the React error path if the subscriber is inside React.
    }
  }
}

/**
 * Subscribe to theme changes. Returns an unsubscribe function.
 *
 *   const off = onThemeChange((from, to) => console.log(to));
 *   setTheme('dark'); // logs 'dark'
 *   off();
 */
export function onThemeChange(
  fn: (from: SupportedTheme, to: SupportedTheme) => void,
): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
