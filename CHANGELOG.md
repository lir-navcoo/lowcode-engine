# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.2.0 (2026-06-08)

### Features

* **P2.3:** L4 widget 体系接入 — leftArea/topArea slots, registry, BaseUI `react-resizable-panels` 三栏布局 ([b4b9d27](https://github.com/lir-navcoo/lowcode-engine/commit/b4b9d27))
* **P1.3:** settings-panel 接入 plugin-setters (BaseUI controlled) ([8285c36](https://github.com/lir-navcoo/lowcode-engine/commit/8285c36))
* **L7.9:** 顶层 README 改写 + 14 包版本号统一到 2.2.0

### Code Health

* **P2.1:** `setupReactRenderer` 标记 `@internal` / deprecated (2.2.0), 计划 3.0.0 移除 — L7 `init()` 已隐式调用, 直接用户应改用 `installReactRuntime` + `setRenderers` 两步
* **cleanup:** 移除 `editor-skeleton` `overlays.tsx` 中的 `useRev` 死代码, 改为精确的 `useEffect` + `emitter.on/off` 订阅 (project + dragon events 全部列出, 避免无差别 repaint)
* **outline-pane:** rename 入口收敛到 title 后的 ✎ 按钮 — title span 改为只读, 移除 dblclick/click 触发 (`outline-pane` tests 同步更新)
* **deps:** 所有 workspace 依赖从 `^2.1.5` 升到 `^2.2.0`

## 2.1.6 (2026-06-08)


### Bug Fixes

* **release:** add `registry-url` to setup-node so NODE_AUTH_TOKEN reaches .npmrc — lerna publish was sending unauthenticated PUTs and getting E404 ([b23c688](https://github.com/lir-navcoo/lowcode-engine/commit/b23c688))


## 2.1.5 (2026-06-08)


### Bug Fixes

* **demo:** close-second-doc should let first doc reclaim full width ([b0d9946](https://github.com/lir-navcoo/lowcode-engine/commit/b0d994673b5930fe361aa437e6defba94d8c87bb)), closes [#skeleton-2](https://github.com/lir-navcoo/lowcode-engine/issues/skeleton-2) [#skeleton-2](https://github.com/lir-navcoo/lowcode-engine/issues/skeleton-2)
* **demo:** Sidebar bg color now reflects the HexColor setter value ([5ada7c2](https://github.com/lir-navcoo/lowcode-engine/commit/5ada7c2e1d77590f6e9cb8df16d90ec9f9cb4d09)), closes [#fef3c7](https://github.com/lir-navcoo/lowcode-engine/issues/fef3c7) [#fff3c7](https://github.com/lir-navcoo/lowcode-engine/issues/fff3c7)
* **editor-skeleton + plugin-setters:** topArea/leftArea slots, overlay scroll/repaint, BaseUI controlled setters ([1a67e08](https://github.com/lir-navcoo/lowcode-engine/commit/1a67e08d533b31ed716a8af86ed6da981dea864d))
* **outline-pane:** use schema.key as tree node id to match DocumentModel ([0ae2757](https://github.com/lir-navcoo/lowcode-engine/commit/0ae27578985e58f8117b79888c6a58698b330f49))
* typecheck pass + setByPath array type narrowing ([52cd57d](https://github.com/lir-navcoo/lowcode-engine/commit/52cd57dede06444c3bd363a811f7f7998fc6e7d9))


### Features

* **3:** Document undo/redo integration with CommandManager ([1068882](https://github.com/lir-navcoo/lowcode-engine/commit/10688827bf91353b2c44387b0d4c05498036684f))
* **A2+C+D+E:** overlays, settings, drop, resizable panels ([9647f05](https://github.com/lir-navcoo/lowcode-engine/commit/9647f054037c1ce008f8bd6da79ba3d15d6c44dc))
* **BCEFG:** canvas overlay, L6 shell skeleton, widgets, more commands + setters ([1f4ea37](https://github.com/lir-navcoo/lowcode-engine/commit/1f4ea37c7dc618332cb3802785dfa80d8fbbc677))
* **demo:** toggle 'Open/Close second doc' button ([a90bb8e](https://github.com/lir-navcoo/lowcode-engine/commit/a90bb8e4e7055bd6e5186b87daf3ec60e22228b6)), closes [#2](https://github.com/lir-navcoo/lowcode-engine/issues/2)
* **L0, L1:** add @monbolc/lowcode-ignitor and @monbolc/lowcode-utils ([f6a2fc0](https://github.com/lir-navcoo/lowcode-engine/commit/f6a2fc09232779959b0116094ec5893bfd738758))
* **L0:** initial monorepo with @monbolc/lowcode-types and @monbolc/lowcode-ignitor ([ccbb77d](https://github.com/lir-navcoo/lowcode-engine/commit/ccbb77d6e741429024815b68d033a714ed1f1699))
* **L2-A:** add @monbolc/lowcode-editor-core (no mobx) ([0385cfb](https://github.com/lir-navcoo/lowcode-engine/commit/0385cfb42cb1867c24ba6d9158798e16431c3b35))
* **L2-B:** add @monbolc/lowcode-plugin-command + ESM .js fix ([91ef86e](https://github.com/lir-navcoo/lowcode-engine/commit/91ef86e49f5b4df0f7d5e26b02b8b65bf0986475))
* **L2-C:** add @monbolc/lowcode-renderer-core (React 19.2.7 peerDep) ([2c6ec7b](https://github.com/lir-navcoo/lowcode-engine/commit/2c6ec7b6d4af77c6320559b5be636106348da2b6))
* **L2-D:** add @monbolc/lowcode-plugin-outline-pane (UI) ([180eae5](https://github.com/lir-navcoo/lowcode-engine/commit/180eae501a0450f1438f2c12064812800d074048))
* **L3-A:** add @monbolc/lowcode-react-renderer ([a84db59](https://github.com/lir-navcoo/lowcode-engine/commit/a84db59b36f932fb1637539c3cde33c155a0f884))
* **L3-B:** add @monbolc/lowcode-designer (foundation) ([bb9935d](https://github.com/lir-navcoo/lowcode-engine/commit/bb9935d42137a465c3358f1fe6db7ddbc44de58b))
* **L4:** add @monbolc/lowcode-editor-skeleton + bump designer/outline ([984cce9](https://github.com/lir-navcoo/lowcode-engine/commit/984cce912f0e4089c82e3264bab232f95dd857cc))
* **L6+L7:** shell facade + engine composition root + i18n + ErrorBoundary + ignitor deprecation ([72cb2e5](https://github.com/lir-navcoo/lowcode-engine/commit/72cb2e5467991ef456642398b1d969b6a4f3dca7))
* **skeleton:** setterConfig override + custom-setter demo (D) ([e773e75](https://github.com/lir-navcoo/lowcode-engine/commit/e773e75ba53b218258d7f491a0e1788f9ba15ee0))
* **skeleton:** wire setters into L4 settings panel (P1.3) ([8285c36](https://github.com/lir-navcoo/lowcode-engine/commit/8285c36e655353d456888859ef509c1fd74a9fa0))
* **styling:** migrate to Tailwind v4 — BaseUI setters + editor-skeleton ([67ecebc](https://github.com/lir-navcoo/lowcode-engine/commit/67ecebc386b0990fdcc2b9271f624730a73a8d47))
* **types:** v2.0.2 — add conditionGroup, loopArgs, variable variant, and component metadata fields ([63f4d09](https://github.com/lir-navcoo/lowcode-engine/commit/63f4d0966b79f00d8531e7bb8c1992bfe9859369))
* **workspace:** L5 — Resource / EditorWindow / Workspace + 24 tests + multi-mount demo ([e88cc01](https://github.com/lir-navcoo/lowcode-engine/commit/e88cc01ffc811022d5e6aa950181e79919e67857))






# 2.1.0 (2026-06-07)


### Bug Fixes

* typecheck pass + setByPath array type narrowing 52cd57d


### Features

* **3:** Document undo/redo integration with CommandManager 1068882
* **A2+C+D+E:** overlays, settings, drop, resizable panels 9647f05
* **L0, L1:** add @monbolc/lowcode-ignitor and @monbolc/lowcode-utils f6a2fc0
* **L0:** initial monorepo with @monbolc/lowcode-types and @monbolc/lowcode-ignitor ccbb77d
* **L2-A:** add @monbolc/lowcode-editor-core (no mobx) 0385cfb
* **L2-B:** add @monbolc/lowcode-plugin-command + ESM .js fix 91ef86e
* **L2-C:** add @monbolc/lowcode-renderer-core (React 19.2.7 peerDep) 2c6ec7b
* **L2-D:** add @monbolc/lowcode-plugin-outline-pane (UI) 180eae5
* **L3-A:** add @monbolc/lowcode-react-renderer a84db59
* **L3-B:** add @monbolc/lowcode-designer (foundation) bb9935d
* **L4:** add @monbolc/lowcode-editor-skeleton + bump designer/outline 984cce9
* **types:** v2.0.2 — add conditionGroup, loopArgs, variable variant, and component metadata fields 63f4d09
