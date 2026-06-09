/**
 * @monbolc/lowcode-designer — builtin-simulator/host-view
 * Ali-mirror Phase D.I6: the React wrapper around `BuiltinSimulatorHost`.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/host-view.tsx`
 * (123 LoC ali → ~90 LoC slim). The `<BuiltinSimulatorHostView>` is the
 * top-level React entry point that constructs a `BuiltinSimulatorHost`
 * from a `Project` and renders the canvas.
 *
 * Slim deltas:
 *   - The ali-faithful `Content` class renders an `<iframe>` for the
 *     simulator renderer. Sapu has no iframe simulator (per plan:
 *     "sapu has no iframe simulator"), so the slim port SKIPS the
 *     iframe entirely and renders the canvas div directly. The
 *     `mountContentFrame` is a no-op stub on the slim host.
 *   - `sim.deviceStyle` / `sim.deviceClassName` / `sim.device` →
 *     slim host defaults (per D.I6 slots: empty style, no class,
 *     no device). Future mobile/tablet previews can set these.
 *   - `designer.builtinSimulator.disabledEvents` event → slim port
 *     skips the listener (per plan out-of-scope #7).
 */
import * as React from 'react';
import { observerHOC } from '../observer-hoc';
import { BuiltinSimulatorHost } from './host';
import { BemTools } from './bem-tools';

export interface BuiltinSimulatorHostViewProps {
  project: { simulator?: BuiltinSimulatorHost; [key: string]: unknown };
  onMount?: (host: BuiltinSimulatorHost) => void;
  designer?: BuiltinSimulatorHost;
  [key: string]: unknown;
}

/**
 * The top-level React entry point. Ali-faithful class form (slim port
 * keeps `shouldComponentUpdate` returning `false` — the host is
 * constructed once and reused).
 */
class BuiltinSimulatorHostViewRaw extends React.Component<BuiltinSimulatorHostViewProps> {
  readonly host: BuiltinSimulatorHost;

  constructor(props: BuiltinSimulatorHostViewProps) {
    super(props);
    const { project, onMount, designer } = this.props;
    this.host =
      (project.simulator as BuiltinSimulatorHost | undefined) ??
      new BuiltinSimulatorHost(project as never, designer as never);
    this.host.setProps(props);
    onMount?.(this.host);
  }

  shouldComponentUpdate(nextProps: BuiltinSimulatorHostViewProps): boolean {
    this.host.setProps(nextProps);
    return false;
  }

  override render(): React.ReactNode {
    return (
      <div className="lc-simulator">
        <Canvas host={this.host} />
      </div>
    );
  }
}

/**
 * The Canvas div (no iframe in sapu; the slim port renders the canvas
 * directly). The `<BemTools>` overlay is mounted inside the viewport.
 */
class CanvasRaw extends React.Component<{ host: BuiltinSimulatorHost }> {
  override render(): React.ReactNode {
    const sim = this.props.host;
    let className = 'lc-simulator-canvas';
    if (sim.deviceClassName) {
      className += ` ${sim.deviceClassName}`;
    } else if (sim.device) {
      className += ` lc-simulator-device-${sim.device}`;
    }
    const { canvas = {}, viewport = {} } = sim.deviceStyle ?? {};
    return (
      <div className={className} style={canvas as React.CSSProperties}>
        <div
          ref={(elmt) => sim.mountViewport(elmt as HTMLElement | null)}
          className="lc-simulator-canvas-viewport"
          style={viewport as React.CSSProperties}
        >
          <BemTools host={sim} />
          <Content host={sim} />
        </div>
      </div>
    );
  }
}

const Canvas = observerHOC(CanvasRaw);

/**
 * Slim `Content` — the iframe is removed (per plan: sapu has no iframe
 * simulator). The slim port renders an empty div that future iframe-mode
 * phases can fill in.
 */
class Content extends React.Component<{ host: BuiltinSimulatorHost }> {
  override render(): React.ReactNode {
    const sim = this.props.host;
    return <div className="lc-simulator-content" ref={(frame) => sim.mountContentFrame(frame as HTMLIFrameElement | null)} />;
  }
}

export const BuiltinSimulatorHostView = observerHOC(BuiltinSimulatorHostViewRaw);
BuiltinSimulatorHostView.displayName = 'BuiltinSimulatorHostView';
