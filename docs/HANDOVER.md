# SapuLowcodeEngine 交接文档

> 截至 2026-06-08 的状态快照。接手人请先读这个文件 + [[ROADMAP.md]] 的 P0–P2 段，再看具体任务的 docs/packages/ 包级文档。

## TL;DR

- **仓库**: https://github.com/lir-navcoo/lowcode-engine
- **当前分支**: `main` @ `1f6972b` (干净，已推 origin)
- **下次发布**: **2.2.0**，代码 + 测试 + 构建全部就绪，**但 npm publish 阻塞**（见下）
- **测试**: 400 passed + 1 skipped (vitest 2.1, happy-dom)
- **类型检查**: 0 errors (14 包 + demo)
- **包版本**: 14 个 `@monbolc/*` 包全部 `2.2.0`，workspace 依赖 `^2.2.0`

## 仓库结构

```
sapu-lowcode-engine/
├── packages/                   # 14 个 L0–L7 包
│   ├── types/                  # L0 — 类型系统
│   ├── ignitor/                # L0 — DEPRECATED, 不要用
│   ├── utils/                  # L1 — 纯函数
│   ├── editor-core/            # L2 — DI + i18n + plugin manager
│   ├── plugin-command/         # L2 — 命令模式 + undo/redo
│   ├── renderer-core/          # L2 — 框架无关渲染抽象
│   ├── plugin-outline-pane/    # L2 — 大纲树
│   ├── plugin-setters/         # L2.5 — BaseUI setters
│   ├── react-renderer/         # L3 — 唯一直接 import React 的包
│   ├── designer/               # L3 — DocumentModel / Project / Dragon
│   ├── editor-skeleton/        # L4 — 3-pane 编辑器 UI
│   ├── workspace/              # L5 — Resource / EditorWindow / Workspace
│   ├── shell/                  # L6 — SapuEngine / ErrorBoundary / i18n
│   └── engine/                 # L7 — init() composition root
├── examples/demo/              # Vite demo, 入口 main.ts 演示完整用法
├── docs/                       # 所有设计 + 包级文档
│   ├── README.md               # 文档索引
│   ├── ARCHITECTURE.md         # L0–L7 分层 + 依赖图
│   ├── ROADMAP.md              # P0–P2 任务历史
│   ├── COMPARISON-WITH-ALI.md  # 与 alibaba/lowcode-engine 逐包对照
│   ├── packages/               # 一包一文档
│   └── HANDOVER.md             # 本文件
├── scripts/
│   ├── typecheck.mjs           # 跨平台 typecheck (yarn typecheck 走它)
│   └── add-js-extensions.mjs   # ESM .js 后缀修复
├── package.json                # yarn workspaces + lerna 8
└── lerna.json                  # Lerna 8 + Nx
```

## 文档查找顺序（接手人推荐路径）

1. `docs/HANDOVER.md` ← 本文件
2. `docs/ROADMAP.md` — P0–P2 任务状态，**P0 全部 DONE**，P1 大部分 DONE，P2 部分 DONE
3. `docs/ARCHITECTURE.md` — L0–L7 设计与依赖图
4. `docs/packages/<package>.md` — 你要改的那个包的具体文档
5. `docs/COMPARISON-WITH-ALI.md` — "上游是怎么做的 vs sapu 怎么做的" — 看删了啥 / 留了啥时查这个

## 当前 P 任务状态

| ID | 任务 | 状态 | Commit |
|---|---|---|---|
| P0.1 | plugin-setters h() vs SetterComponent mismatch | DONE 2026-06-07 | (历史) |
| P0.2 | designer SetPropCommand.undo type mismatch | DONE 2026-06-07 | (历史) |
| P0.3 | 提交 v2.0.2 types 包 | DONE 2026-06-07 | (历史) |
| P0.4 | editor-skeleton CSS → Tailwind v4 | DONE 2026-06-08 | (历史) |
| P1.1 | editor-skeleton React 19 warnings | DONE 2026-06-07 | (历史) |
| P1.2 | react-renderer key + simulator unmount | DONE 2026-06-07 | (历史) |
| P1.3 | plugin-outline-pane defaultRenderRow keys | DONE 2026-06-07 | (历史) |
| P1.6 | OutlineView inline rename | DONE 2026-06-08 (✎-only) | `77affbc` |
| P2.1 | setupReactRenderer deprecate (2.2.0) | DONE 2026-06-08 | `808bdb4` |
| P2.2 | L3 designer more commands | OPEN (Detecting/Scroller/Clipboard/...) | — |
| P2.3 | L4 editor-skeleton more widgets | DONE 2026-06-08 (4 widgets + 11 tests) | (P2.3) |
| **P2.4** | **L4 画布可替换 widget (designerView prop)** | **DONE 2026-06-08** | **`1f6972b`** |
| P2.5+ | (接手人规划) | — | — |

## 2.2.0 发布 (P0 — 阻塞中)

**状态**: 代码 + 文档 + 测试全就绪。**npm publish 阻塞**。

**根因**: 旧 `.npmrc` 的 npm token 已在历史 chat 中泄漏，**任何在 chat 出现过的 secret 一律视为已泄漏**。本地 `yarn pub:minor` 不可用。

**解锁步骤** (接手人或管理员按顺序操作):

1. **旋转 npm token**:
   - 打开 https://www.npmjs.com/settings/lir-navcoo/tokens
   - 撤销 (revoke) 当前所有 token
   - 创建一个新 token: **Automation** 类型（给 CI 用） + **Publish** 权限
   - 限制 IP / 不限都行（sapu-lowcode-engine 是公共包）
2. **注入 GitHub Secret**:
   - 仓库 → Settings → Secrets and variables → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Value: 上面新建的 token 字符串
3. **触发 release CI** (接手人在本地):
   ```bash
   cd sapu-lowcode-engine
   git tag v2.2.0
   git push origin v2.2.0
   ```
   - CI workflow (`.github/workflows/release.yml` 如果有，否则 `lerna publish from-package`) 会:
     - `actions/setup-node@v4` 设 `registry-url: https://registry.npmjs.org/`
     - 自动从 secret 拿 `NODE_AUTH_TOKEN` 注入 `.npmrc`
     - `npx lerna publish from-git` (或类似) 推 14 个包到 npm
4. **验证**:
   - 14 个 `@monbolc/*` 包在 https://www.npmjs.com/org/monbolc 出现，版本 2.2.0
   - `yarn add @monbolc/lowcode-engine@2.2.0` 在新项目能装

**已知陷阱** (从 [[project_release_npmrc_quirk]] 来的):
- `actions/setup-node` 必须显式设 `registry-url`，否则 `NODE_AUTH_TOKEN` 不到 `.npmrc`，lerna 报 misleading E404 "Not found"
- 本地 `yarn pub:minor` 走的是另一套本地 token，跟 GitHub Secret 无关

## 下一步规划 (P2.5+)

按 2026-06-08 的对话，候选任务（按优先级）：

| 候选 | 描述 | 估时 | 阻塞项 |
|---|---|---|---|
| P2.5 demo Playwright 端到端测试 | 拖拽 / 选中 / 改 prop / undo/redo / 多文档切换, 5 个交互路径 | 0.5–1 天 | Playwright 配置 + CI 集成 |
| P2.6 plugin SDK 文档化 | "如何写一个 plugin" 实操指南 + IPluginContext 类型导览 | 1 天 | 无 |
| P2.7 公开 IPublicApi* facade | shell 包补 8–10 个 host-facing facade (engine/project/selection/event/setters/components/simulator/logger/hotkey/commonUI), 取代直接拿 SapuEngine | 2–3 天 | shell 重构 |
| P3.0 setupReactRenderer 移除 | 删 `react-renderer` 出口, L7 init() 内联 `installReactRuntime + setRenderers(createReactRenderers())`, 推 3.0.0 | 半天 | createReactRenderers 需公开 + subpath export |

**接手人建议**:
- 如果要快速出可见成果 → **P2.5 Playwright**（出 e2e 截图 + CI 自动化）
- 如果要服务外部用户 → **P2.6 文档**（写 plugin 指南）
- 如果准备 3.0.0 → **P3.0 setupReactRenderer 移除**（小但需要协调 L3 + L7 边界）

## 关键开发约定

接手前必读的几条规则（每条都对应一个 memory 文件）:

| 规则 | 详情 |
|---|---|
| 注释/对话/CHANGELOG 中文 | 代码标识符和 public API 英文 |
| 严禁 git config | 每次 commit 用 `GIT_AUTHOR_NAME=lir-navcoo GIT_AUTHOR_EMAIL=li78080114@qq.com` 传 env vars |
| 严禁 token in chat | 任何 secret 一律走 web UI，不能贴在对话里 |
| 不用 emoji | 代码/UI/注释/commit 一律不用 |
| 改代码必改文档 | docs/ 跟代码同步更新 |
| 不写半成品代码 | 不要为了未来扩展加抽象 / 错误处理 / 配置开关 |

## 常用命令

```bash
# 安装
yarn install

# 构建 (14 个包)
yarn build

# 测试 (vitest, 400+ passed)
yarn test

# 类型检查 (0 errors)
yarn typecheck

# 跑 demo (Vite dev server @ :5173)
yarn demo

# 清理 (Windows 上 yarn clean 会 EINVAL, 用下面替代)
node -e "for (const p of require('fs').readdirSync('packages')) { try { require('fs').rmSync('packages/'+p+'/lib',{recursive:true,force:true}); require('fs').rmSync('packages/'+p+'/es',{recursive:true,force:true}); } catch {} }"

# 发布 (BLOCKED, 见上面"2.2.0 发布"节)
# yarn pub:patch
# yarn pub:minor
# yarn pub:major
```

## 测试约定

- 测试文件 `*.test.ts(x)` 与 `src/` 平级放 `tests/` 目录
- vitest 2.1 + happy-dom + @testing-library/react 16
- 涉及 React 的测试必须在 `beforeAll` 调 `setupReactRenderer()` 安装 runtime + 6 个 renderers
- schema 保留字 `Page` / `Block` / `Addon` / `Temp` / `Div` 走对应 PageRendererImpl 等路由，**不调 user 组件**——测试断言时用 `data-renderer="Page"` 而不是 user 组件的 testid
- 文档/CHANGELOG 不算"测试"，但算文档，必须更新

## 仓库相关链接

- 上游对照: `E:\project\lowcode-engine\ali-lowcode-engine` (本地克隆, 仅供参考)
- npm 公开账号: https://www.npmjs.com/org/monbolc
- GitHub: https://github.com/lir-navcoo/lowcode-engine

## 联系 / 已知未决

- **原作者**: lir-navcoo (li78080114@qq.com) — 历史 chat 中暴露的 npm token 来自此邮箱账号
- **未决 PR**: 无
- **未决 issue**: 无
- **未决 token 旋转**: 旧 token `npm_FyNT...` 仍生效（host 撤销它之前），新 publish 走 GitHub Secret

---

最后更新: 2026-06-08 by lir-navcoo via Claude Code session `eeb2c997...`
