/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/border-container
 * Ali-mirror Phase D.I6 stub: the reactive drop-target border.
 *
 * Slim port: 30-LoC minimal stub. The full `<BorderContainer>` (119 LoC
 * ali) is gated behind `engineConfig.get('enableReactiveContainer')`
 * (off by default) and reads `editor.eventBus.on('designer.dropLocation.change')`.
 * Phase D.I9 ports it for real. This stub is ali-faithful in shape.
 */
import * as React from 'react';
import { observerHOC } from '../../observer-hoc';
import type { BuiltinSimulatorHost } from '../host';

export interface BorderContainerProps {
  host: BuiltinSimulatorHost;
}

class BorderContainerRaw extends React.Component<BorderContainerProps> {
  override render(): React.ReactNode {
    // Slim port: D.I9 will wire the full 119-LoC port.
    return null;
  }
}

export const BorderContainer = observerHOC(BorderContainerRaw);
BorderContainer.displayName = 'BorderContainer';
