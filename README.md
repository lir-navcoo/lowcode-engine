# SapuLowcodeEngine

企业级低代码引擎（Sapu 是 Monbolc 旗下开源品牌）。

> SapuLowcodeEngine is an enterprise-class low-code engine monorepo, published under the `@monbolc` npm scope.

## Packages (L0)

| Package | Layer | Status | Description |
|---|---|---|---|
| `@monbolc/lowcode-types` | L0 | ✅ published | 核心类型定义 |
| `@monbolc/lowcode-ignitor` | L0 | ✅ private | 启动器（dev server） |

> 后续 L1+ 层级（utils、editor-core、designer、shell、engine 等）按拓扑顺序逐步添加。

## Development

```bash
yarn install
yarn build           # 构建所有包
yarn workspace @monbolc/lowcode-types test
yarn workspace @monbolc/lowcode-ignitor start
```

## Publish

```bash
yarn pub:patch       # 修复版本
yarn pub:minor       # 次版本
yarn pub:major       # 主版本
```

## License

MIT
