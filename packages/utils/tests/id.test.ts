import { describe, it, expect } from 'vitest';
import { uid, seqId, resetSeqCounter } from '../src/id';

describe('uid', () => {
  it('returns a non-empty string with the prefix', () => {
    const id = uid();
    expect(id).toMatch(/^lce_[0-9a-f-]+$/);
  });
  it('uses custom prefix when provided', () => {
    expect(uid('x')).toMatch(/^x_/);
  });
  it('produces unique ids across calls', () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
  });
});

describe('seqId', () => {
  it('is sortable and unique within a session', () => {
    resetSeqCounter();
    const a = seqId();
    const b = seqId();
    const c = seqId();
    expect([a, b, c].sort()).toEqual([a, b, c]);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
