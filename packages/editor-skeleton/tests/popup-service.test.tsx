/**
 * @monbolc/lowcode-editor-skeleton — popup service tests
 *
 * Verifies the SapuPopupService public surface (the singleton
 * `popupService` is a fresh instance per test process — we use
 * `closeAll()` in `beforeEach` so the tests don't leak between
 * each other).
 *
 * Coverage:
 * - `open(anchor, content)` returns a string id and `list()`
 * contains the descriptor.
 * - `close(id)` removes a single descriptor.
 * - `closeAll()` removes every descriptor.
 * - Subscribers are notified on add / remove.
 * - Re-opening with the same explicit id replaces the previous
 * descriptor (the singleton's id namespace is caller-controlled).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';

import { SapuPopupService } from '../src/popup/service';

function makeEl(): HTMLElement {
 return document.createElement('button');
}

/** Build a small React node the popup service can store. */
function el(text: string): React.ReactNode {
 return React.createElement('span', null, text);
}

describe('SapuPopupService', () => {
 let service: SapuPopupService;
 beforeEach(() => {
 service = new SapuPopupService();
 service.closeAll();
 });

 it('open(anchor, content) returns an id and list() shows the descriptor', () => {
 const a = makeEl();
 const id = service.open(a, el('hello'));
 expect(typeof id).toBe('string');
 expect(service.size).toBe(1);
 expect(service.list()).toHaveLength(1);
 expect(service.list()[0].id).toBe(id);
 expect(service.list()[0].anchor).toBe(a);
 expect(service.list()[0].placement).toBe('bottom'); // default
 });

 it('open accepts a placement override', () => {
 const id = service.open(makeEl(), el('x'), { placement: 'right' });
 expect(service.list()[0].placement).toBe('right');
 expect(service.list()[0].id).toBe(id);
 });

 it('close(id) removes a single descriptor', () => {
 const a = service.open(makeEl(), el('a'));
 const b = service.open(makeEl(), el('b'));
 expect(service.size).toBe(2);
 service.close(a);
 expect(service.size).toBe(1);
 expect(service.list()[0].id).toBe(b);
 });

 it('close on an unknown id is a no-op', () => {
 service.open(makeEl(), el('a'));
 expect(() => service.close('does-not-exist')).not.toThrow();
 expect(service.size).toBe(1);
 });

 it('closeAll() removes every descriptor', () => {
 service.open(makeEl(), el('a'));
 service.open(makeEl(), el('b'));
 service.closeAll();
 expect(service.size).toBe(0);
 expect(service.list()).toEqual([]);
 });

 it('subscribers are notified on add and remove', () => {
 const cb = vi.fn();
 const dispose = service.subscribe(cb);
 service.open(makeEl(), el('a'));
 expect(cb).toHaveBeenCalledTimes(1);
 service.closeAll();
 expect(cb).toHaveBeenCalledTimes(2);
 dispose();
 service.open(makeEl(), el('b'));
 expect(cb).toHaveBeenCalledTimes(2); // no further calls after dispose
 });

 it('re-opening with the same explicit id replaces the descriptor', () => {
 const a = makeEl();
 service.open(a, el('first'), { id: 'fixed' });
 service.open(a, el('second'), { id: 'fixed' });
 expect(service.size).toBe(1);
 // The second `open` replaced the first; list() returns a new
 // snapshot, so the order of the descriptors is still [second].
 const snap = service.list();
 expect(snap).toHaveLength(1);
 expect(React.isValidElement(snap[0].content)).toBe(true);
 });

 it('list() returns a snapshot — mutating it does not affect the service', () => {
 service.open(makeEl(), el('a'));
 const snap = service.list();
 snap.length =0;
 expect(service.size).toBe(1);
 });
});
