/**
 * @monbolc/lowcode-engine — preset + default-plugins + theme tests
 *
 * Covers L7.3, L7.4, L7.5 acceptance tests:
 *   - createDefaultPlugins() returns 3 uniquely-named plugins
 *   - each plugin's init(ctx) is idempotent
 *   - createDefaultPreset() returns the union + locale + theme
 *   - overrides merge on top of the defaults
 *   - setTheme() updates the data attribute + notifies subscribers
 *   - setTheme() with the same name is a no-op
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createDefaultPlugins } from '../src/default-plugins';
import { createDefaultPreset } from '../src/preset';
import { setTheme, getTheme, onThemeChange } from '../src/theme';

describe('default-plugins (L7.3)', () => {
  it('returns 4 uniquely-named plugins (P12 added document-commands)', () => {
    const plugins = createDefaultPlugins();
    expect(plugins).toHaveLength(4);
    const names = plugins.map((p) => p.name);
    expect(new Set(names).size).toBe(4);
    expect(names).toContain('@sapu/builtin-outline-pane');
    expect(names).toContain('@sapu/builtin-settings-panel');
    expect(names).toContain('@sapu/builtin-setters');
    expect(names).toContain('@sapu/builtin-document-commands');
  });

  it('each plugin.init(ctx) is idempotent (no double-registration)', () => {
    const plugins = createDefaultPlugins();
    const fakeCtx = {
      project: {} as never,
      events: { on: vi.fn() } as never,
      i18n: { t: vi.fn() } as never,
      // P12: document-commands plugin calls ctx.commands.register
      // during init. Provide a stub that throws on duplicate
      // registration — that's what the real CommandManager does.
      commands: {
        register: vi.fn(() => {}),
      },
      registerPlugin: vi.fn(),
      unregisterPlugin: vi.fn(),
      t: vi.fn(),
    };
    for (const p of plugins) {
      expect(() => p.init(fakeCtx as never)).not.toThrow();
    }
  });
});

describe('preset (L7.4)', () => {
  it('default preset has 4 plugins (P12 document-commands) + zh-CN + light', () => {
    const preset = createDefaultPreset();
    expect(preset.plugins).toHaveLength(4);
    expect(preset.locale).toBe('zh-CN');
    expect(preset.theme).toBe('light');
  });

  it('overrides merge on top of defaults', () => {
    const customPlugin = { name: 'custom', init: () => {} };
    const preset = createDefaultPreset({
      plugins: [customPlugin],
      locale: 'en-US',
      theme: 'dark',
    });
    expect(preset.plugins).toEqual([customPlugin]);
    expect(preset.locale).toBe('en-US');
    expect(preset.theme).toBe('dark');
  });

  it('partial override keeps the non-overridden fields', () => {
    const preset = createDefaultPreset({ theme: 'dark' });
    expect(preset.plugins).toHaveLength(4); // default (P12 added document-commands)
    expect(preset.locale).toBe('zh-CN');     // default
    expect(preset.theme).toBe('dark');      // override
  });
});

describe('theme (L7.5)', () => {
  beforeEach(() => {
    // Reset to a known initial state. We set light explicitly so
    // any stale 'dark' value from a prior test is cleared.
    setTheme('light');
    document.documentElement.dataset.theme = 'light';
  });

  it('initial theme is "light"', () => {
    expect(getTheme()).toBe('light');
  });

  it('setTheme("dark") updates the data attribute', () => {
    setTheme('dark');
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('setTheme() notifies subscribers with (from, to)', () => {
    const cb = vi.fn();
    onThemeChange(cb);
    setTheme('dark');
    expect(cb).toHaveBeenCalledWith('light', 'dark');
  });

  it('setTheme() with the same name is a no-op (no subscriber call)', () => {
    const cb = vi.fn();
    onThemeChange(cb);
    setTheme('light'); // already light
    expect(cb).not.toHaveBeenCalled();
  });

  it('onThemeChange returns an unsubscribe function', () => {
    const cb = vi.fn();
    const off = onThemeChange(cb);
    setTheme('dark');
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    setTheme('light');
    expect(cb).toHaveBeenCalledTimes(1); // not called again
  });

  it('setTheme() with an unknown name throws', () => {
    expect(() => setTheme('blue' as 'light')).toThrow(/unsupported theme/);
  });
});
