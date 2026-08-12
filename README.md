# 星尘殖民地

轻松、无永久失败的等距殖民经营游戏。建筑、居民、游客、产品和区域通过六维引力产生联系；核心数值始终在本地确定运行，AI 只增强文案与建议。

## 启动与验证

```bash
npm install
npm run dev
npm test
npm run verify
npm run build
```

`npm run verify` 会依次运行 Node 逻辑测试、架构索引校验和生产构建。

## 玩法入口

- `B` 建造，`M` 设施管理，`P` 加工，`V` 游客，`A` AI 内容工坊。
- 统计面板显示各资源的每日产出、持续消耗和净变化。
- 设置中提供三个本地存档槽、JSON 导入导出和自定义 PNG 纹理。

## 玩家自己的 AI

AI 工坊支持玩家填写 OpenAI 兼容的 `/chat/completions` 地址和模型。配置只保存在当前标签页的 `sessionStorage`；Key 不进入存档、localStorage 或构建产物。没有模型、网络失败或响应无效时，游戏立即使用本地文案，所有玩法仍可继续。

AI 只生成名称、描述、评价和建议；成本、产出、路线、品质、奖励与解锁均由本地规则决定。

## 部署

- GitHub Pages：`.github/workflows/deploy.yml`
- Vercel：`vercel.json`
- 构建产物：`dist/index.html`（单文件）

平衡参数说明见 [`docs/BALANCING.md`](docs/BALANCING.md)。架构入口见 [`CLAUDE.md`](CLAUDE.md) 和 [`docs/architecture/SYSTEMS.md`](docs/architecture/SYSTEMS.md)。
