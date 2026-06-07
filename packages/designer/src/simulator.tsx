/**
 * @monbolc/lowcode-designer — Simulator
 *
 * A "preview" view of the document. Wraps the schema in a
 * renderable element so it can be mounted side-by-side with the
 * design-mode tree.
 *
 * For now the Simulator is a thin wrapper around ReactRenderer with
 * a fixed component registry; future layers can add device
 * viewports, theming, design-mode highlights, etc.
 */

import { ReactRenderer } from '@monbolc/lowcode-react-renderer';
import { adapter } from '@monbolc/lowcode-renderer-core';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

export interface SimulatorOptions {
  /** Component implementations used to render the schema. */
  components?: Record<string, unknown>;
  /** Render mode: 'design' shows hover/border overlays, 'live' is the pure preview. */
  designMode?: 'design' | 'live' | 'preview';
}

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export class Simulator {
  /** Current root schema being simulated. */
  schema: IPublicTypeRootSchema;
  /** Component registry. */
  components: Record<string, unknown>;
  /** Design mode. */
  designMode: 'design' | 'live' | 'preview';

  constructor(schema: IPublicTypeRootSchema, options: SimulatorOptions = {}) {
    this.schema = schema;
    this.components = options.components ?? {};
    this.designMode = options.designMode ?? 'design';
  }

  /** Build a renderable element from the current schema. */
  render(): unknown {
    return new ReactRenderer({
      schema: this.schema,
      components: this.components,
      designMode: this.designMode,
    }).render();
  }

  /** Replace the schema being simulated. */
  setSchema(schema: IPublicTypeRootSchema): void {
    this.schema = schema;
  }
}
