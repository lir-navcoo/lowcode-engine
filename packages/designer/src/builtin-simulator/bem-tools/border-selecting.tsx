/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/border-selecting
 * Ali-mirror Phase D.I6 stub: the selection border + toolbar.
 *
 * Slim port: 30-LoC minimal stub. The full `<BorderSelecting>` (230 LoC
 * ali) is the largest single bem-tool file. Phase D.I7 ports it for
 * real. This stub is ali-faithful in shape (class + render + null
 * fallback) so D.I6 can wire it into the BemTools tree.
 */
import * as React from 'react';
import { observerHOC } from '../../observer-hoc';
import type { BuiltinSimulatorHost } from '../host';

export interface BorderSelectingProps {
  host: BuiltinSimulatorHost;
}

class BorderSelectingRaw extends React.Component<BorderSelectingProps> {
  override render(): React.ReactNode {
    // Slim port: D.I7 will wire the full 230-LoC port.
    return null;
  }
}

export const BorderSelecting = observerHOC(BorderSelectingRaw);
BorderSelecting.displayName = 'BorderSelecting';
