/**
 * @monbolc/lowcode-utils — id generation
 *
 * Stable, collision-free identifiers for nodes, components, and resources.
 * The engine never uses Math.random() directly — always go through these helpers
 * so that the id strategy is swappable (e.g. for deterministic rendering in tests).
 */

import type { ID } from '@monbolc/lowcode-types';

/**
 * Cryptographically-strong random id (uuid v4-shaped).
 * Uses crypto.getRandomValues when available (browsers + Node 19+), falls back to Math.random.
 */
export function uid(prefix = 'lce'): ID {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // RFC 4122 v4 layout
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Sequential, sortable id (timestamp + counter).
 * Useful for in-memory debugging where lexicographic order matters.
 */
let _seqCounter = 0;
export function seqId(prefix = 'seq'): ID {
  _seqCounter = (_seqCounter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${_seqCounter.toString(36).padStart(4, '0')}`;
}

/**
 * Reset the sequence counter (for tests).
 */
export function resetSeqCounter(): void {
  _seqCounter = 0;
}
