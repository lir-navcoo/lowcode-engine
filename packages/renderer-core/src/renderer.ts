/**
 * @monbolc/lowcode-renderer-core — renderer factory functions
 *
 * Each factory returns a class that, when instantiated, renders a
 * particular kind of node from the schema:
 *   - PageRenderer       — root schema
 *   - ComponentRenderer  — any non-special node
 *   - BlockRenderer      — block of components
 *   - AddonRenderer      — read-only "add-on" node (e.g. comments)
 *   - TempRenderer       — placeholder / loading
 *
 * For now the renderers are minimal stubs that return null. The
 * concrete React-based implementations live in
 * @monbolc/lowcode-react-renderer, which calls `adapter.setRenderers(...)`
 * at boot to install richer versions.
 */

import { BaseRenderer } from './base';
import type { IRenderComponent, IRendererProps } from './types';

/** Renderer for a Page node (root schema). */
export class PageRenderer extends BaseRenderer {
  override render() {
    // Real implementation is plugged in by @monbolc/lowcode-react-renderer.
    return null;
  }
}

/** Renderer for an arbitrary component. */
export class ComponentRenderer extends BaseRenderer {
  override render() {
    return null;
  }
}

/** Renderer for a Block (a static block of components, no per-component meta). */
export class BlockRenderer extends BaseRenderer {
  override render() {
    return null;
  }
}

/** Renderer for an Addon (a UI overlay, like a comment indicator). */
export class AddonRenderer extends BaseRenderer {
  override render() {
    return null;
  }
}

/** Renderer for a Temp placeholder (used while data is loading). */
export class TempRenderer extends BaseRenderer {
  override render() {
    return null;
  }
}

/** Renderer for an inert Div fallback. */
export class DivRenderer extends BaseRenderer {
  override render() {
    return null;
  }
}

/** Factory form: returns a class. Mostly here for API symmetry. */
export function pageRendererFactory(): IRenderComponent {
  return PageRenderer as unknown as IRenderComponent;
}
export function componentRendererFactory(): IRenderComponent {
  return ComponentRenderer as unknown as IRenderComponent;
}
export function blockRendererFactory(): IRenderComponent {
  return BlockRenderer as unknown as IRenderComponent;
}
export function addonRendererFactory(): IRenderComponent {
  return AddonRenderer as unknown as IRenderComponent;
}
export function tempRendererFactory(): IRenderComponent {
  return TempRenderer as unknown as IRenderComponent;
}
export function divRendererFactory(): IRenderComponent {
  return DivRenderer as unknown as IRenderComponent;
}
