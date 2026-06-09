/**
 * @monbolc/lowcode-designer — BemToolsManager tests
 * Ali-mirror Phase D.I2.
 *
 * Validates the slim port of the `BemToolsManager` extension registry.
 * The class holds an array of `{ name, item }` entries; plugins call
 * `addBemTools` to register a custom bem-tool overlay; `<BemTools>` reads
 * via `getAllBemTools()`.
 */
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { BemToolsManager } from '../../src/builtin-simulator/bem-tools/manager';

function mkItem(name: string): React.ComponentType<{ host: unknown }> {
  const Comp: React.FC<{ host: unknown }> = () => React.createElement('div', { 'data-testid': name });
  Comp.displayName = name;
  return Comp;
}

describe('BemToolsManager (Phase D.I2)', () => {
  it('addBemTools appends; getAllBemTools returns in registration order', () => {
    const m = new BemToolsManager();
    m.addBemTools({ name: 'a', item: mkItem('a') });
    m.addBemTools({ name: 'b', item: mkItem('b') });
    m.addBemTools({ name: 'c', item: mkItem('c') });
    const all = m.getAllBemTools();
    expect(all.length).toBe(3);
    expect(all[0].name).toBe('a');
    expect(all[1].name).toBe('b');
    expect(all[2].name).toBe('c');
  });

  it('addBemTools with a duplicate name throws via invariant', () => {
    const m = new BemToolsManager();
    m.addBemTools({ name: 'dup', item: mkItem('dup') });
    expect(() => m.addBemTools({ name: 'dup', item: mkItem('dup2') })).toThrow(/already exists/);
  });

  it('removeBemTools: removes by name; order preserved for the rest', () => {
    const m = new BemToolsManager();
    m.addBemTools({ name: 'a', item: mkItem('a') });
    m.addBemTools({ name: 'b', item: mkItem('b') });
    m.addBemTools({ name: 'c', item: mkItem('c') });
    m.removeBemTools('b');
    const all = m.getAllBemTools();
    expect(all.length).toBe(2);
    expect(all[0].name).toBe('a');
    expect(all[1].name).toBe('c');
  });

  it('removeBemTools: unknown name is a no-op (ali-faithful)', () => {
    const m = new BemToolsManager();
    m.addBemTools({ name: 'a', item: mkItem('a') });
    m.removeBemTools('nonexistent');
    expect(m.getAllBemTools().length).toBe(1);
  });

  it('add + remove + add: same name can be re-added after remove', () => {
    const m = new BemToolsManager();
    m.addBemTools({ name: 'a', item: mkItem('a') });
    m.removeBemTools('a');
    m.addBemTools({ name: 'a', item: mkItem('a2') });
    expect(m.getAllBemTools().length).toBe(1);
  });
});
