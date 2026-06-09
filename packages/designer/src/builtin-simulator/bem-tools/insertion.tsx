/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/insertion
 * Ali-mirror Phase D.I6 stub: the insertion line.
 *
 * Slim port: 30-LoC minimal stub. The full `<InsertionView>` (171 LoC
 * ali) reads `host.currentDocument.dropLocation` and renders a vertical
 * or horizontal line. Sapu's `DocumentModel` doesn't yet have
 * `dropLocation` (Phase D.I7 adds it), so the slim port returns
 * `null` for now.
 *
 * Per audit R3: `DocumentModel.dropLocation` is a Phase D.I7 addition.
 * This stub is ali-faithful in shape (class + render) but always
 * returns null until D.I7 lands.
 */
import * as React from 'react';
import { observerHOC } from '../../observer-hoc';
import type { BuiltinSimulatorHost } from '../host';

export interface InsertionViewProps {
  host: BuiltinSimulatorHost;
}

class InsertionViewRaw extends React.Component<InsertionViewProps> {
  override render(): React.ReactNode {
    // Slim port: no `dropLocation` on slim DocumentModel yet (Phase D.I7).
    return null;
  }
}

export const InsertionView = observerHOC(InsertionViewRaw);
InsertionView.displayName = 'InsertionView';
