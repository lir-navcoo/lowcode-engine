# SapuLowcodeEngine 交接文档

> 截至 2026-06-09(本会话收官时)的状态快照。接手人请先读这个文件 + [[ROADMAP.md]] 的 P0–P2 段 + `memory/sapu-lowcode-engine-status.md` 的最新 batch 历史，再看具体任务的 docs/packages/ 包级文档。**TL;DR 全部 Phase 已收官(designer 2.28.0, 957 unit tests, 源码无 TODO);v2.2.0 publish 仍阻塞于 user 的 token 轮换。**

## TL;DR

- **仓库**: https://github.com/lir-navcoo/lowcode-engine
- **当前分支**: `main` @ `f84ffa3` (干净，已推 origin)
- **下次发布**: **2.2.0**，代码 + 测试 + 构建全部就绪，**但 npm publish 阻塞**（见下）
- **测试**: 971 unit passed + 1 skipped (vitest 2.1, happy-dom) + 11 e2e (Playwright 1.60)
- **Demo polish** (commit `5b3f2b1`): StatusBar (live engine state via createPortal), theme toggle (`setTheme` / `onThemeChange`), locale toggle (`engine.i18n.setLocale` + 10 registered keys), 4-preset schema picker. `yarn demo:build` 522KB / 156KB gzipped, 899ms.
- **类型检查**: 0 errors (14 包 + demo)
- **包版本**: 14 个 `@monbolc/*` 包 — designer 2.29.0 (D + D.I7b.1-19), editor-skeleton 2.4.0 (D.I7b.4), plugin-setters 2.3.0 (D.I7b.16), engine 2.3.0 (D.I7b.17), shell 2.3.0 (D.I7b.18), types 2.3.0 (D.I2), others 2.2.0
- **Post-v2.4 features** (代码已就绪, 都在 main 上): Dragon P1–P10 重构(ali-faithful) + P11 outline delete + P12 engine.commands + P14 键盘快捷键 + P15 plugin-authoring docs。详情见 `memory/sapu-lowcode-engine-status.md` 的 "Dragon refactor + P11–P18 follow-ups" 段。
- **ali-mirror 计划**: Phase A + B + C.X + C.Y + C.Z + C.AA + C.AB + C.AC + C.AD + C.AE + D (10 commits, 5000+ LoC) + D.I7b.1-19 (designer, including onGot) + D.I7b.16 (plugin-setters unregisterSetter) + D.I7b.17 (engine init theme) + D.I7b.18 (shell setHost/getHost) 全部完成。**Phase D + D.I7b.1-19 收官(designer);plugin-setters 2.3.0;engine 2.3.0;shell 2.3.0**。Phase E (asset pipeline + icon font + iframe-mode simulator) 仍待办。详见 `~/.claude/plans/dynamic-marinating-rabbit.md` 和 `docs/ROADMAP.md`。

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

## 下一步规划 (接手人从这点接手)

**已完成** (cron 驱动, 2026-06-09):
- ✅ P2.5 demo Playwright 端到端测试 — 5 spec 文件 + 11 e2e test + CI workflow
- ✅ P2.6 plugin SDK 文档化 — `docs/plugin-authoring.md` (IPlugin + IPluginContext contract, 6 patterns, publishing checklist, anti-patterns)
- ✅ Phase A + B + C + D + D.I7b.1-15 ali-mirror plan 全部完成(designer 2.28.0, 957 unit tests)
- ✅ D.I7b.4 已用 `<BemTools host={host}/>` 替代 P6 时代 `overlays.tsx` 庞然大物
- ✅ D.I7b.6 用 BaseUI Tooltip 替代 native `title`
- ✅ D.I7b.8 实现右键 context menu(7 default actions)
- ✅ D.I7b.9 / .15 实现 SettingTopEntry `valuechange` 事件 + 全部 mutation 一致性

**仍待办** (按优先级):

| 候选 | 描述 | 估时 | 阻塞项 |
|---|---|---|---|
| Phase E Asset icon font pipeline | 替换 `<span data-icon>` 占位符为真实图标(ali 已有 icon font);bem-tool toolbar 的视觉反馈缺口 | 1–2 天 | 选定图标库 / 集成方式 |
| D.I7b.3 BorderContainer reactive 真实 e2e 验证 | D.I9 代码已完成(159 LoC),但 demo 没启用 `enableReactiveContainer` flag,需要 e2e 测一下 | 半天 | 无 |
| P2.7 公开 IPublicApi* facade | shell 包补 8–10 个 host-facing facade (engine/project/selection/event/setters/components/simulator/logger/hotkey/commonUI), 取代直接拿 SapuEngine | 2–3 天 | shell 重构 |
| P3.0 setupReactRenderer 移除 | 删 `react-renderer` 出口, L7 init() 内联 `installReactRuntime + setRenderers(createReactRenderers())`, 推 3.0.0 | 半天 | createReactRenderers 需公开 + subpath export |
| 阻塞 1: npm publish | v2.2.0 发布需要 user 轮换 npm + GitHub PAT token | 10 分钟 | user 操作 (见下) |

**接手人建议**:
- 如果要快速出可见成果 → **Phase E Asset** (出 icon font + 完成 user 视觉反馈闭环)
- 如果要服务外部用户 → **P2.7 IPublicApi\* facade** (让插件作者不必直接拿 SapuEngine)
- 如果准备 3.0.0 → **P3.0 setupReactRenderer 移除**
- 如果发布 2.2.0 → **阻塞 1**(找 user 轮换 token)

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

# 测试 (vitest, 971 unit; playwright, 11 e2e)
yarn test
yarn test:e2e

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

最后更新: 2026-06-09 by lir-navcoo via Claude Code session. Ali-mirror Phase A + B + C + D + D.I7b.1-15 全部完成(designer 2.28.0, 957 unit tests). 源码无未关闭 TODO。剩余 UX 缺口在 Phase E Asset 范围(icon font、iframe-mode simulator、plugin-extensible context menu registry)。v2.2.0 publish 仍阻塞于 user 的 npm + GitHub PAT 轮换。
