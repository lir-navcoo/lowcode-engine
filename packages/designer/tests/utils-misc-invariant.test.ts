/**
 * @monbolc/lowcode-designer — utils/misc + utils/invariant tests (Phase B)
 */
import { describe, it, expect } from 'vitest';
import { invariant } from '../src/utils/invariant';
import { isElementNode, isDOMNodeVisible, normalizeTriggers } from '../src/utils/misc';
import { Viewport } from '../src/viewport';

describe('invariant (Phase B ali-mirror)', () => {
  it('does nothing when check is truthy', () => {
    expect(() => invariant(true, 'should not throw')).not.toThrow();
    expect(() => invariant(1, 'truthy')).not.toThrow();
    expect(() => invariant('x', 'truthy')).not.toThrow();
  });

  it('throws [designer] Invariant failed: <message>', () => {
    expect(() => invariant(false, 'bad state')).toThrow(
      '[designer] Invariant failed: bad state',
    );
  });

  it('appends the optional thing name to the message', () => {
    expect(() => invariant(0, 'value must be >', 'foo')).toThrow(
      "[designer] Invariant failed: value must be > in 'foo'",
    );
  });
});

describe('utils/misc (Phase B ali-mirror)', () => {
  describe('isElementNode', () => {
    it('returns true for an Element', () => {
      const el = document.createElement('div');
      expect(isElementNode(el)).toBe(true);
    });

    it('returns false for a text node', () => {
      const text = document.createTextNode('hi');
      expect(isElementNode(text as unknown as Element)).toBe(false);
    });
  });

  describe('isDOMNodeVisible', () => {
    it('returns true when the node is fully inside the viewport', () => {
      const canvas = document.createElement('div');
      // Stub getBoundingClientRect to a known 100x100 rect.
      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
      const vp = new Viewport({ canvas });
      const node = document.createElement('span');
      node.getBoundingClientRect = () =>
        ({ left: 10, top: 10, right: 50, bottom: 50, width: 40, height: 40, x: 10, y: 10, toJSON: () => ({}) } as DOMRect);
      expect(isDOMNodeVisible(node, vp)).toBe(true);
    });

    it('returns true when the node is partially outside (any part overlaps)', () => {
      const canvas = document.createElement('div');
      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
      const vp = new Viewport({ canvas });
      const node = document.createElement('span');
      // Partially outside: left < 0 but right > 0 → still visible.
      node.getBoundingClientRect = () =>
        ({ left: -20, top: 50, right: 20, bottom: 60, width: 40, height: 10, x: -20, y: 50, toJSON: () => ({}) } as DOMRect);
      expect(isDOMNodeVisible(node, vp)).toBe(true);
    });

    it('returns false when the node is fully outside the viewport', () => {
      const canvas = document.createElement('div');
      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
      const vp = new Viewport({ canvas });
      const node = document.createElement('span');
      // Fully below + right of the viewport.
      node.getBoundingClientRect = () =>
        ({ left: 200, top: 200, right: 250, bottom: 250, width: 50, height: 50, x: 200, y: 200, toJSON: () => ({}) } as DOMRect);
      expect(isDOMNodeVisible(node, vp)).toBe(false);
    });
  });

  describe('normalizeTriggers', () => {
    it('uppercases an array of trigger names', () => {
      expect(normalizeTriggers(['click', 'hover', 'focus']))
        .toEqual(['CLICK', 'HOVER', 'FOCUS']);
    });

    it('passes through empty strings without crashing', () => {
      expect(normalizeTriggers(['', 'click'])).toEqual(['', 'CLICK']);
    });
  });
});
