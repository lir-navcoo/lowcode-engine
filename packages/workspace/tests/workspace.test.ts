/**
 * @monbolc/lowcode-workspace — Workspace unit tests
 */
import { describe, it, expect } from 'vitest';

import { Project } from '@monbolc/lowcode-designer';

import { Resource } from '../src/resource';
import { EditorWindow } from '../src/window';
import { Workspace } from '../src/workspace';

const sampleRoot = { componentName: 'Page' };

function makeResource(id: string, title: string): Resource {
  return new Resource({ id, title, project: new Project(sampleRoot) });
}

describe('Workspace (L5.4)', () => {
  it('starts empty with no active window', () => {
    const ws = new Workspace();
    expect(ws.getResourceList()).toEqual([]);
    expect(ws.getActive()).toBeNull();
  });

  it('addResource() puts the resource in the list and fires resourceAdded', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    const seen: Array<{ id: string; title: string }> = [];
    ws.events.on('resourceAdded', (e) => seen.push(e));

    const r = makeResource('r1', 'Page 1');
    const win = ws.addResource(r);

    expect(win).toBeInstanceOf(EditorWindow);
    expect(ws.getResourceList()).toEqual([r]);
    expect(seen).toEqual([{ id: 'r1', title: 'Page 1' }]);
  });

  it('auto-opens the first resource when autoOpenFirstWindow=true (default)', () => {
    const ws = new Workspace();
    const r = makeResource('r1', 'Page 1');
    ws.addResource(r);

    const active = ws.getActive();
    expect(active).not.toBeNull();
    expect(active?.resource).toBe(r);
    expect(active?.active).toBe(true);
  });

  it('does NOT auto-open when autoOpenFirstWindow=false', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    ws.addResource(makeResource('r1', 'Page 1'));
    expect(ws.getActive()).toBeNull();
  });

  it('setActive() switches the active window and fires windowActivated', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    const r1 = makeResource('r1', 'P1');
    const r2 = makeResource('r2', 'P2');
    ws.addResource(r1);
    ws.addResource(r2);

    const seen: Array<{ id: string | null }> = [];
    ws.events.on('windowActivated', (e) => seen.push(e));

    ws.setActive('r2');
    expect(ws.getActive()?.resource).toBe(r2);
    expect(r1 && (ws.getResourceList()[0] as Resource).id).toBe('r1');
    expect(seen).toEqual([{ id: 'r2' }]);
  });

  it('setActive() with an unknown id is a no-op (no event, no throw)', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    ws.addResource(makeResource('r1', 'P1'));

    let fired = false;
    ws.events.on('windowActivated', () => (fired = true));
    ws.setActive('nope');

    expect(fired).toBe(false);
    expect(ws.getActive()).toBeNull();
  });

  it('removeResource() removes from the list and fires resourceRemoved', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    const r1 = makeResource('r1', 'P1');
    ws.addResource(r1);

    const seen: string[] = [];
    ws.events.on('resourceRemoved', (e) => seen.push(e.id));

    ws.removeResource('r1');

    expect(ws.getResourceList()).toEqual([]);
    expect(seen).toEqual(['r1']);
  });

  it('removing the active resource auto-promotes the next one', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    const r1 = makeResource('r1', 'P1');
    const r2 = makeResource('r2', 'P2');
    ws.addResource(r1);
    ws.addResource(r2);
    ws.setActive('r1');

    const seen: Array<{ id: string | null }> = [];
    ws.events.on('windowActivated', (e) => seen.push(e));

    ws.removeResource('r1');
    expect(ws.getActive()?.resource).toBe(r2);
    expect(seen).toEqual([{ id: 'r2' }]);
  });

  it('removing the only active resource fires windowActivated: { id: null }', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    ws.addResource(makeResource('r1', 'P1'));
    ws.setActive('r1');

    const seen: Array<{ id: string | null }> = [];
    ws.events.on('windowActivated', (e) => seen.push(e));

    ws.removeResource('r1');
    expect(ws.getActive()).toBeNull();
    expect(seen).toEqual([{ id: null }]);
  });

  it('duplicate id throws on addResource()', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    ws.addResource(makeResource('r1', 'P1'));
    expect(() => ws.addResource(makeResource('r1', 'Dup'))).toThrow(/already present/);
  });

  it('getResourceList() returns an immutable view', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    ws.addResource(makeResource('r1', 'P1'));
    const list = ws.getResourceList();
    expect(() => (list as Resource[]).push(makeResource('r2', 'P2'))).toThrow();
  });

  it('dispose() clears all windows, fires disposed, ignores further ops', () => {
    const ws = new Workspace({ autoOpenFirstWindow: false });
    ws.addResource(makeResource('r1', 'P1'));
    let fired = false;
    ws.events.on('disposed', () => (fired = true));

    ws.dispose();
    expect(fired).toBe(true);
    expect(ws.getResourceList()).toEqual([]);
    expect(ws.getActive()).toBeNull();
    expect(() => ws.addResource(makeResource('r2', 'P2'))).toThrow(/disposed/);
  });
});
