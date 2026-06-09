/**
 * @monbolc/lowcode-designer — drop-location
 *
 * Phase D.I7b.1a: slim `IDropLocation` type. Ali-faithful in shape
 * (`target` + `detail` + `document`); slim in `detail` payload
 * (no `near.rect` / `near.align` — the slim port picks the line
 * direction from the resolved target rect, not from a precomputed
 * near-rect, so the consumer's math is simpler).
 *
 * The bem-tool `<InsertionView>` reads `host.currentDocument.dropLocation`
 * to render the drop line. The slim `BuiltinSimulatorHost` writes
 * this on every `handleMove` (Phase D.I7b.1b). `null` means "no
 * drop in progress" — the bem-tool returns `null` in that case.
 */
import type { Node } from './node';
import type { DocumentModel } from './document';

/**
 * The slim drop-location. Slim delta vs ali-faithful:
 * - `detail.near.pos` keeps ali's `'before' | 'after'` (used by
 *   the line position math), but drops `'replace'` — the slim
 *   port treats `pos: 'before'` + `valid: false` as "no valid
 *   drop here" (renders a red line).
 * - `detail.near.node` is a slim `Node`, not an `IPublicTypeNodeData`.
 * - `detail.valid` is optional (slim consumers default to `true`).
 */
export interface IDropLocation {
  /** The container we're dropping into or near. */
  readonly target: Node;
  /** The drop detail. Slim port: `{ index, near?, valid? }`. */
  readonly detail: {
    /** Insert index. `null` means "cover the target" (no specific index). */
    readonly index: number | null;
    /** The sibling we're inserting before/after. Omit for 'cover' / 'inside'. */
    readonly near?: {
      readonly node: Node;
      readonly pos: 'before' | 'after';
    };
    /** Whether the drop is valid. `false` renders the red line. Default `true`. */
    readonly valid?: boolean;
  };
  /** The owning document. Ali-faithful shape; slim port keeps it for symmetry. */
  readonly document: DocumentModel;
}
