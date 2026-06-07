import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../src/project';
import { Dragon } from '../src/dragon';
import { DocumentModel } from '../src/document';
import { deepClone } from '@monbolc/lowcode-utils';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const SEED: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header' },
    { componentName: 'Body' },
  ],
};

describe('Dragon + DocumentModel drop', () => {
  let project: Project;
  let root: IPublicTypeRootSchema;
  beforeEach(() => { root = deepClone(SEED); project = new Project(root); });

  it('start sets state and emits event', () => {
    let captured: unknown;
    project.dragon.events.on('start', (e) => { captured = e; });
    project.dragon.start('node-1', 10, 20);
    expect(project.dragon.isDragging).toBe(true);
    expect((captured as { nodeId: string }).nodeId).toBe('node-1');
  });

  it('move with drop target computes parent + index', () => {
    const moves: unknown[] = [];
    project.dragon.events.on('move', (e) => moves.push(e));
    project.dragon.start('header', 0, 0);
    project.dragon.move(100, 100, { parentId: 'body', index: 0, placement: 'inside' });
    expect(project.dragon.state.dropTarget).toEqual({ parentId: 'body', index: 0, placement: 'inside' });
    expect((moves[0] as { dropTarget: { parentId: string } }).dropTarget.parentId).toBe('body');
  });

  it('commit on a valid dropTarget fires drop event', () => {
    let captured: unknown;
    project.dragon.events.on('drop', (e) => { captured = e; });
    project.dragon.start('header', 0, 0);
    project.dragon.move(0, 0, { parentId: 'body', index: 0, placement: 'inside' });
    const result = project.dragon.commit();
    expect(result).not.toBeNull();
    expect((captured as { nodeId: string }).nodeId).toBe('header');
    expect(project.dragon.isDragging).toBe(false);
  });

  it('commit without a dropTarget fires cancel event', () => {
    let captured: unknown;
    project.dragon.events.on('cancel', (e) => { captured = e; });
    project.dragon.start('header', 0, 0);
    // No move() so no dropTarget
    project.dragon.commit();
    expect((captured as { nodeId: string }).nodeId).toBe('header');
  });

  it('end-to-end drop moves the schema node', () => {
    const headerId = project.document.getNode(project.document.root.key as string)!.children[0].id;
    const bodyId = project.document.getNode(project.document.root.key as string)!.children[1].id;
    project.dragon.events.on('drop', (e) => {
      const target = e.target;
      const headerNode = project.document.getNode(headerId);
      const bodyNode = project.document.getNode(bodyId);
      if (headerNode && bodyNode) {
        project.document.move(headerNode, bodyNode, target.index);
      }
    });
    project.dragon.start(headerId, 0, 0);
    project.dragon.move(0, 0, { parentId: bodyId, index: 0, placement: 'inside' });
    project.dragon.commit();
    const body = project.document.getNode(bodyId)!;
    expect(body.children[0].id).toBe(headerId);
  });
});
