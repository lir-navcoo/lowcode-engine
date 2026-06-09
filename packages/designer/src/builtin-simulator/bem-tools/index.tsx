/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools
 * Ali-mirror Phase D.I6: the `BemTools` root shell.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/bem-tools/index.tsx`
 * (36 LoC ali → ~50 LoC slim). The `<BemTools host={host} />` component
 * renders the 5 bem-tool overlays (BorderDetecting, BorderSelecting,
 * BorderContainer, InsertionView, BorderResizing) plus any
 * plugin-registered custom bem-tools (via `host.designer.bemToolsManager`).
 *
 * Slim translations applied:
 *   - `@observer` decorator → wrapped with `observerHOC` from D.I2
 *   - `engineConfig.get('disableDetecting')` → uses the Phase D.I6 shim
 *   - `engineConfig.get('enableReactiveContainer')` → uses the shim
 *   - `host.designer.bemToolsManager.getAllBemTools()` → slim host wires
 *     the manager (D.I2 export)
 *   - `host.viewport.scrollX/scrollY/scale` → slim Viewport already has
 *     Observables; observerHOC subscribes via `useSyncExternalStore`
 *   - The ali-faithful `class BemTools extends Component` is kept (the
 *     observerHOC wrap subscribes the JSX render to observable reads)
 */
import * as React from 'react';
import { observerHOC } from '../../observer-hoc';
import { engineConfig } from '../../utils/engine-config';
import type { BuiltinSimulatorHost } from '../host';
import { BorderDetecting } from './border-detecting';
import { BorderSelecting } from './border-selecting';
import { BorderContainer } from './border-container';
import { BorderResizing } from './border-resizing';
import { InsertionView } from './insertion';

export interface BemToolsProps {
  host: BuiltinSimulatorHost;
}

/**
 * The `<BemTools>` shell. Ali-faithful 36-LoC class; the slim port
 * keeps the class form (per audit recommendation) and wraps it with
 * the D.I2 `observerHOC` so the JSX render subscribes to
 * `host.viewport.{scale, scrollX, scrollY}` automatically.
 */
export class BemToolsRaw extends React.Component<BemToolsProps> {
  override render(): React.ReactNode {
    const { host } = this.props;
    const { designMode } = host;
    const { scrollX, scrollY, scale } = host.viewport;
    if (designMode === 'live') {
      return null;
    }
    const disableDetecting = engineConfig.get('disableDetecting') as boolean | undefined;
    const enableReactiveContainer = engineConfig.get('enableReactiveContainer') as boolean | undefined;
    return (
      <div
        className="lc-bem-tools"
        style={{ transform: `translate(${-scrollX * scale}px, ${-scrollY * scale}px)` }}
      >
        {!disableDetecting && <BorderDetecting key="hovering" host={host} />}
        <BorderSelecting key="selecting" host={host} />
        {enableReactiveContainer && (
          <BorderContainer key="reactive-container-border" host={host} />
        )}
        <InsertionView key="insertion" host={host} />
        <BorderResizing key="resizing" host={host} />
        {host.designer.bemToolsManager.getAllBemTools().map((tools) => {
          const ToolsCls = tools.item;
          return <ToolsCls key={tools.name} host={host} />;
        })}
      </div>
    );
  }
}

/**
 * The slim `BemTools` export: `BemToolsRaw` wrapped with `observerHOC`
 * so the wrapped component re-renders on observable changes
 * (`host.viewport.*`).
 */
export const BemTools = observerHOC(BemToolsRaw);
BemTools.displayName = 'BemTools';
