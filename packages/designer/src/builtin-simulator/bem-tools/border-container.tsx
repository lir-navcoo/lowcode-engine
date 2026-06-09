/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/border-container
 * Ali-mirror Phase D.I9: the reactive drop-target border.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/bem-tools/border-container.tsx`
 * (119 LoC ali → ~110 LoC slim). The `<BorderContainer>` class
 * subscribes to `designer.dropLocation.change` events and renders a
 * blue border around the drop target. Gated behind
 * `engineConfig.get('enableReactiveContainer')` (off by default).
 *
 * Slim translations applied:
 *   - `@observer` + `@computed get scale/scrollX/scrollY` → wrapped with
 *     `observerHOC` (D.I2) + plain getters
 *   - `classNames` from `classnames` → string template (slim port doesn't
 *     use classnames; the bem-tool class is a single static string)
 *   - `globalLocale.getLocale()` → slim `globalLocale.getLocale()` (D.I6
 *     shim, returns 'zh-CN' fallback)
 *   - `<Title>` → slim `<Title>` (D.I6)
 *   - `isI18nData` from `@alilc/lowcode-utils` → 1-line duck-type
 *     check inline
 *   - `host.designer.editor.eventBus.on('designer.dropLocation.change', ...)`
 *     → slim `host.designer.editor.eventBus.on(...)` (the slim host's
 *     designer.eventBus is the project.events Emitter; ali's named
 *     event is the slim equivalent via 'designer.dropLocation.change'
 *     ali-faithful)
 *   - The ali-faithful "enableReactiveContainer" gating is preserved
 *     in the BemTools root shell (D.I6) — the slim port of BorderContainer
 *     always renders, but the BemTools root only mounts it when the
 *     config flag is set.
 */
import * as React from 'react';
import { Fragment, PureComponent } from 'react';
import { observerHOC } from '../../observer-hoc';
import { globalLocale } from '../../utils/locale';
import { Title } from '../../components/title';
import type { BuiltinSimulatorHost } from '../host';

export interface BorderContainerInstanceProps {
  title: unknown;
  rect: DOMRect | null;
  scale: number;
  scrollX: number;
  scrollY: number;
}

/**
 * Slim port of ali's `BorderContainerInstance` (PureComponent). Renders
 * a 1-rect line around the drop target. The slim port uses a single
 * static className (no classnames import) — Tailwind utilities land
 * when P0.4 widens the design tokens.
 */
export class BorderContainerInstance extends PureComponent<BorderContainerInstanceProps> {
  override render(): React.ReactNode {
    const { title, rect, scale, scrollX, scrollY } = this.props;
    if (!rect) return null;
    const style: React.CSSProperties = {
      width: rect.width * scale,
      height: rect.height * scale,
      transform: `translate(${(scrollX + rect.left) * scale}px, ${(scrollY + rect.top) * scale}px)`,
    };
    return (
      <div className="lc-borders lc-borders-detecting" style={style}>
        <Title title={title as never} className="lc-borders-title" />
      </div>
    );
  }
}

/**
 * Slim 1-line `getTitle` (ali-faithful): if the title is a string,
 * return it; if it's an i18n data shape, return the localized version;
 * otherwise return empty string.
 */
function getTitle(title: unknown): string {
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object' && 'type' in (title as Record<string, unknown>)) {
    const locale = globalLocale.getLocale() || 'zh-CN';
    const dict = (title as { [key: string]: string })[locale];
    return dict ?? '';
  }
  return '';
}

export interface BorderContainerProps {
  host: BuiltinSimulatorHost;
}

interface BorderContainerState {
  target: { id: string; componentMeta?: { title?: unknown; rootSelector?: string } } | null | undefined;
}

/**
 * The slim `<BorderContainer>` class. Subscribes to
 * `designer.dropLocation.change` (ali-faithful event name) and renders
 * a `<BorderContainerInstance>` for the drop target.
 */
class BorderContainerRaw extends React.Component<BorderContainerProps, BorderContainerState> {
  override state: BorderContainerState = { target: null };

  get scale(): number { return this.props.host.viewport.scale; }
  get scrollX(): number { return this.props.host.viewport.scrollX; }
  get scrollY(): number { return this.props.host.viewport.scrollY; }

  override componentDidMount(): void {
    const { host } = this.props;
    (host.designer as unknown as {
      editor: { eventBus: { on: (e: string, fn: (loc: unknown) => void) => () => void } };
    }).editor.eventBus.on('designer.dropLocation.change', (loc) => {
      const l = loc as { target?: { id: string; componentMeta?: { title?: unknown; rootSelector?: string } } } | null | undefined;
      const next = l?.target ?? null;
      if (this.state.target && l && l.target && this.state.target.id === l.target.id) return;
      this.setState({ target: next });
    });
  }

  override render(): React.ReactNode {
    const { host } = this.props;
    const { target } = this.state;
    if (!target) return null;
    const instances = host.getComponentInstances(target as never);
    if (!instances || instances.length < 1) return null;
    if (instances.length === 1) {
      const rect = host.computeComponentInstanceRect(instances[0], target.componentMeta?.rootSelector);
      if (!rect) return null;
      return (
        <BorderContainerInstance
          key="line-h"
          title={getTitle(target.componentMeta?.title)}
          scale={this.scale}
          scrollX={this.scrollX}
          scrollY={this.scrollY}
          rect={rect}
        />
      );
    }
    return (
      <Fragment>
        {instances.map((inst, i) => {
          const rect = host.computeComponentInstanceRect(inst, target.componentMeta?.rootSelector);
          if (!rect) return null;
          return (
            <BorderContainerInstance
              key={`line-h-${i}`}
              title={getTitle(target.componentMeta?.title)}
              scale={this.scale}
              scrollX={this.scrollX}
              scrollY={this.scrollY}
              rect={rect}
            />
          );
        })}
      </Fragment>
    );
  }
}

export const BorderContainer = observerHOC(BorderContainerRaw);
BorderContainer.displayName = 'BorderContainer';
