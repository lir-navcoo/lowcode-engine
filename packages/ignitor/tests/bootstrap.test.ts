/**
 * @monbolc/lowcode-ignitor — smoke test for `bootstrap()`
 *
 * L0 of SapuLowcodeEngine: the ignitor currently only injects a
 * "ready, engine not yet implemented" banner. These tests pin that
 * behavior so a future L7 implementation doesn't accidentally break
 * the L0 contract.
 *
 * What we verify:
 *   1. `bootstrap({ container: HTMLElement })` resolves and writes a
 *      banner into the host element.
 *   2. `bootstrap({ container: '#selector' })` uses querySelector and
 *      writes the banner to the matching element.
 *   3. `bootstrap({ container: '#missing' })` throws a clear error.
 *   4. The returned `IIgnitorContext.container` is the same element.
 *   5. The default export exposes `bootstrap` for the
 *      `import sapu from '@monbolc/lowcode-ignitor'` users.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bootstrap, default as sapuDefault } from '../src/index';

describe('ignitor.bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves with an HTMLElement container and injects a banner', async () => {
    const host = document.createElement('div');
    host.id = 'host-direct';
    document.body.appendChild(host);

    const ctx = await bootstrap({ container: host });

    expect(ctx.container).toBe(host);
    // The L0 banner has a recognizable "SapuLowcodeEngine" heading.
    expect(host.innerHTML).toContain('SapuLowcodeEngine');
  });

  it('resolves a string container via document.querySelector', async () => {
    const host = document.createElement('div');
    host.id = 'host-by-selector';
    document.body.appendChild(host);

    const ctx = await bootstrap({ container: '#host-by-selector' });

    expect(ctx.container).toBe(host);
    expect(host.innerHTML).toContain('SapuLowcodeEngine');
  });

  it('throws when the string selector does not match any element', async () => {
    await expect(
      bootstrap({ container: '#does-not-exist' }),
    ).rejects.toThrow(/Container not found: #does-not-exist/);
  });

  it('accepts a theme option and echoes it in the banner', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    await bootstrap({ container: host, theme: 'dark' });

    // The banner mentions the active theme inside a <code> element.
    expect(host.innerHTML).toContain('<code>dark</code>');
  });

  it('defaults the theme label to "light" when no theme is provided', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    await bootstrap({ container: host });

    expect(host.innerHTML).toContain('<code>light</code>');
  });

  it('the default export exposes bootstrap', () => {
    expect(typeof sapuDefault.bootstrap).toBe('function');
    expect(sapuDefault.bootstrap).toBe(bootstrap);
  });
});
