/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/border-resizing
 * Ali-mirror Phase D.I6 stub: the 8-anchor resize handles.
 *
 * Slim port: 30-LoC minimal stub. The full `<BorderResizing>` (358 LoC
 * ali) is the LARGEST single bem-tool file. Phase D.I7 ports it for
 * real. This stub is ali-faithful in shape (class + render + null
 * fallback).
 */
import * as React from 'react';
import { observerHOC } from '../../observer-hoc';
import type { BuiltinSimulatorHost } from '../host';

export interface BorderResizingProps {
  host: BuiltinSimulatorHost;
}

class BorderResizingRaw extends React.Component<BorderResizingProps> {
  override render(): React.ReactNode {
    // Slim port: D.I7 will wire the full 358-LoC port.
    return null;
  }
}

export const BorderResizing = observerHOC(BorderResizingRaw);
BorderResizing.displayName = 'BorderResizing';
