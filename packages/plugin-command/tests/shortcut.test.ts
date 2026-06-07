import { describe, it, expect } from 'vitest';
import { parseShortcut } from '../src/shortcut';

describe('parseShortcut', () => {
  it('parses simple shortcuts', () => {
    const s = parseShortcut('Mod+Z');
    expect(s.key).toBe('z');
    expect([...s.modifiers]).toEqual(['Mod']);
  });
  it('parses multi-modifier shortcuts', () => {
    const s = parseShortcut('Ctrl+Shift+P');
    expect(s.key).toBe('p');
    expect([...s.modifiers].sort()).toEqual(['Ctrl', 'Shift']);
  });
  it('lower-cases the key', () => {
    expect(parseShortcut('Mod+ENTER').key).toBe('enter');
  });
  it('throws on empty input', () => {
    expect(() => parseShortcut('')).toThrow();
  });
  it('throws on key-only (no modifier)', () => {
    expect(() => parseShortcut('Z')).toThrow();
  });
  it('throws on unknown modifier', () => {
    expect(() => parseShortcut('Hyper+A')).toThrow();
  });
});
