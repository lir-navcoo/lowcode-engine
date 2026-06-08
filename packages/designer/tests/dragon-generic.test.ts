/**
 * @monbolc/lowcode-designer — Dragon generic binding
 *
 * The Dragon is generic over `<TNode, TLocateEvent>`. Sapu ships
 * two concrete bindings: the default `<IPublicTypeNodeLike,
 * IPublicTypeLocateEvent<IPublicTypeNodeLike>>` for hosts, and
 * the internal `Node` type for the engine core. This test
 * verifies both work + the legacy string-id usage keeps working.
 */
import { describe, it, expect } from 'vitest';
import { Dragon } from '../src/dragon';
import type { IPublicTypeNodeLike, IPublicTypeLocateEvent, IPublicTypeDragObject } from '@monbolc/lowcode-types';

describe('Dragon is generic over TNode + TLocateEvent', () => {
  it('default Dragon uses IPublicTypeNodeLike (back-compat: no generic args)', () => {
    // This is the form the existing Project uses. No compile error means
    // the defaults work.
    const d = new Dragon();
    expect(d.isDragging).toBe(false);

    // Event subscription typed against the default
    d.events.on('start', () => undefined);
    d.events.on('dropBoost', () => undefined);
    d.events.on('dragstart', (e) => {
      // e.dragObject is the default's IPublicTypeDragObject<IPublicTypeNodeLike>
      const obj: IPublicTypeDragObject = e.dragObject;
      expect(['Node', 'NodeData', 'Any']).toContain(obj.type);
    });
  });

  it('custom TNode binding works (host-defined node shape)', () => {
    interface MyNode {
      id: string;
      componentName: string;
      customField: number;
    }
    type MyLocate = IPublicTypeLocateEvent<MyNode>;

    const d = new Dragon<MyNode, MyLocate>();
    expect(d.isDragging).toBe(false);
    expect(d.sensors).toHaveLength(0);

    // addSensor with the custom TNode type works.
    const sensor = makeFakeSensor<MyNode>('my-sensor');
    d.addSensor(sensor);
    expect(d.sensors).toHaveLength(1);

    // removeSensor cleans up.
    d.removeSensor('my-sensor');
    expect(d.sensors).toHaveLength(0);
  });

  it('legacy string-id usage (Project.dragon) still works after the rewrite', () => {
    // The back-compat state accessor must keep returning the v2.2 shape.
    const d = new Dragon();
    d.start('node-1', 10, 20);
    const state = d.state;
    expect(state.draggingNodeId).toBe('node-1');
    expect(state.boost).toBeNull();
    expect(state.x).toBe(10);
    expect(state.y).toBe(20);

    d.move(50, 60, { parentId: 'parent-1', index: 2, placement: 'inside' });
    expect(d.state.dropTarget).toEqual({ parentId: 'parent-1', index: 2, placement: 'inside' });

    d.cancel();
    expect(d.isDragging).toBe(false);
  });
});

/** Helper: build a minimal IPublicTypeSensor<TNode> stub. */
function makeFakeSensor<TNode extends IPublicTypeNodeLike>(name: string) {
  return {
    name,
    isEnter: () => false,
    fixEvent: (e: MouseEvent | DragEvent): IPublicTypeLocateEvent<TNode> => ({
      globalX: 0,
      globalY: 0,
      canvasX: 0,
      canvasY: 0,
      clientX: 0,
      clientY: 0,
      target: null,
      dragObject: { type: 'Any', extra: null },
      originalEvent: e,
    }),
    locate: () => null,
  };
}
