# SapuLowcodeEngine

[![Tests](https://img.shields.io/badge/tests-481%20passed-brightgreen)](https://github.com/lir-navcoo/lowcode-engine/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-149eca)](https://react.dev/)
[![BaseUI](https://img.shields.io/badge/BaseUI-1.0-7c3aed)](https://base-ui.com/)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-4.0-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![NPM scope](https://img.shields.io/badge/npm-@monbolc-orange)](https://www.npmjs.com/search?q=%40monbolc)

> **从零重写** 的企业级低代码引擎。基于 **React 19.2.7** + **BaseUI 1.0** + **Tailwind CSS v4**。NPM scope `@monbolc`。比 `alibaba/lowcode-engine` v1.3.2 小约 **85%**，0 第三方新增依赖，0 `@alilc`/`@alifd` 残留。
>
> **SapuLowcodeEngine** is a from-scratch rewrite of `alibaba/lowcode-engine` v1.3.2, modernized for React 19, BaseUI, and Tailwind v4. 14 packages, 685 unit tests + 11 e2e, 0 third-party deps added.

## 快速开始 / Quick start

```bash
yarn add @monbolc/lowcode-engine
```

```tsx
import { init, createDefaultPreset } from '@monbolc/lowcode-engine';
import { Page, Header, Footer } from './my-components';

const engine = await init('#app', {
  schema: { componentName: 'Page', children: [
    { componentName: 'Header' },
    { componentName: 'Footer' },
  ] },
  components: { Page, Header, Footer },
  preset: createDefaultPreset({ locale: 'en-US' }),
});

// `engine.getProject()` is the live document.
// `engine.events.on('pluginError', ...)` catches plugin crashes.
// `destroy(engine)` tears it all down.
```

That's the whole API surface for a basic integration. Everything else (custom setters, custom plugins, multi-document) is a one-line import away.

## Packages (L0–L7)

| Layer | Package | Version | Description |
|---|---|---|---|
| L0 | `@monbolc/lowcode-types` | 2.2.0 | 核心类型 / Core type system |
| L0 | `@monbolc/lowcode-ignitor` | 2.2.0 | ⚠️ **DEPRECATED** — use `@monbolc/lowcode-engine` instead |
| L1 | `@monbolc/lowcode-utils` | 2.2.0 | 纯函数工具 / Pure utility functions |
| L2 | `@monbolc/lowcode-editor-core` | 2.2.0 | DI 容器 + i18n + plugin manager |
| L2 | `@monbolc/lowcode-plugin-command` | 2.2.0 | 命令模式 + undo/redo |
| L2 | `@monbolc/lowcode-renderer-core` | 2.2.0 | 框架无关渲染抽象 |
| L2 | `@monbolc/lowcode-plugin-outline-pane` | 2.2.0 | 大纲树（react-arborist） |
| L2.5 | `@monbolc/lowcode-plugin-setters` | 2.2.0 | BaseUI setters 仓库 |
| L3 | `@monbolc/lowcode-react-renderer` | 2.2.0 | React 19.2.7 运行时注入 |
| L3 | `@monbolc/lowcode-designer` | 2.2.0 | DocumentModel + Project + Dragon |
| L4 | `@monbolc/lowcode-editor-skeleton` | 2.2.0 | 3-pane 编辑器 UI |
| L5 | `@monbolc/lowcode-workspace` | 2.2.0 | Resource / EditorWindow / Workspace |
| L6 | `@monbolc/lowcode-shell` | 2.2.0 | SapuEngine + ErrorBoundary + i18n + bus |
| **L7** | **`@monbolc/lowcode-engine`** | **2.2.0** | **组合根 / Composition root** — `init()` lives here |

## Development

```bash
yarn install
yarn build         # 构建所有包
yarn test          # 481 tests / 45 files, ~2.7s
yarn test:e2e      # 11 e2e tests / 1 chromium project
yarn typecheck     # 0 errors across all 14 packages + demo
yarn demo          # Vite dev server at http://localhost:5173
```

## 5 行起步 / 5-line starter

```tsx
import { init, createDefaultPreset } from '@monbolc/lowcode-engine';
import { Page, Header, Footer } from './my-components';

const engine = await init('#app', {
  schema: { componentName: 'Page', children: [{ componentName: 'Header' }, { componentName: 'Footer' }] },
  components: { Page, Header, Footer },
  preset: createDefaultPreset(),
});
```

## 与 alibaba/lowcode-engine 的区别 / Differences from upstream

| Metric | alibaba v1.3.2 | sapu (this repo) | Ratio |
|---|---:|---:|---:|
| Packages | 15 | 14 | 0.93× |
| Source files (`packages/*/src`) | 551 | ~75 | 0.14× |
| Lines of code | ~49,800 | ~7,000 | 0.14× |
| Class components | 104 | **0** | 0× |
| MobX usage | 150 sites | **0** (custom `Emitter` + `useSyncExternalStore`) | 0× |
| `@alifd/next` import sites | 14 (across 7 packages) | **0** (replaced by BaseUI) | 0× |
| React version | 16.x | 19.2.7 | +3 majors |
| Build system | `@alib/build-scripts` (webpack 4) | `tsc` per-package dual CJS+ESM | — |
| Test framework | Jest 26 + enzyme 3 | Vitest 2.1 + @testing-library/react 16 | — |
| UI library | `@alifd/next` 1.x (Fusion) | BaseUI 1.0 + Tailwind v4 | — |

See [`docs/COMPARISON-WITH-ALI.md`](docs/COMPARISON-WITH-ALI.md) for the full package-by-package mapping.

## Documentation

All design + per-package docs live in [`docs/`](docs/):

- [`docs/README.md`](docs/README.md) — doc index
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — L0–L7 layering + design principles
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — current state + per-layer status
- [`docs/COMPARISON-WITH-ALI.md`](docs/COMPARISON-WITH-ALI.md) — sapu vs alibaba, line-by-line
- [`docs/packages/`](docs/packages/) — one doc per package (12 files)

## Publish

```bash
yarn pub:patch     # 修复版本 (2.2.0 → 2.2.1)
yarn pub:minor     # 次版本 (2.2.0 → 2.3.0)
yarn pub:major     # 主版本 (2.2.0 → 3.0.0)
```

> ⚠️ The npm publish token in `.npmrc` is **COMPROMISED**. The user must rotate it before any publish. See memory note for details.

## License

MIT
