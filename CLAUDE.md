# 星尘殖民地：AI 协作入口

## 项目目标
单机、轻松、无永久失败的等距殖民经营游戏。六维引力连接建筑、居民、游客、产品和区域；核心数值在本地确定运行，AI 只生成叙事与建议。

## 常用命令
```bash
npm run dev
npm run build
npm run architecture:check
npm run context -- --list
npm run context -- <system-id>
```

## 开始任务前
1. 在 `docs/architecture/SYSTEMS.md` 找到系统和实现状态。
2. 运行 `npm run context -- <system-id>` 获取小型上下文包。
3. 修改前仍须精读目标源码、直接调用方和相关测试；契约是导航，不是源码替代品。
4. 跨系统修改时分别读取两边契约，确认状态所有权与事件边界。

## 硬约束
- 无 Game Over、负债、永久死亡或不可逆建筑摧毁；失败只延缓进度。
- 不要求手动控制战斗，不加入强制期限和惩罚性年终排名。
- 核心规则、价格、伤害、掉落、路线、品质、解锁不能由生成式 AI 决定。
- AI、网络或额度不可用时，完整玩法必须通过本地 fallback 正常运行。
- API 密钥不得进入浏览器代码、`VITE_*` 变量、localStorage、存档或单文件构建产物。
- 新状态必须可 JSON 序列化，并为旧存档提供迁移/默认值。
- Canvas 自定义素材缺失或损坏时必须回退到程序绘图。
- 只实现任务要求；避免与当前任务无关的重构和抽象。

## 当前架构
- 启动与每日循环：`src/main.js`
- 权威状态：`src/core/GameState.js`
- 跨模块通知：`src/core/EventBus.js`
- 地图/渲染/寻路：`src/core/MapGenerator.js`、`CanvasRenderer.js`、`ResidentSprites.js`、`Pathfinding.js`
- 内容数据：`src/data/*.js`
- DOM 面板：`src/panels/*.js`
- AI 叙事：`src/core/AIAdvisor.js` → `src/ai/AIRequestQueue.js` → 本地 fallback（当前没有真实模型调用）

## 事实来源优先级
1. 当前源码与测试
2. `docs/architecture/systems.json`（可校验索引）
3. `docs/architecture/SYSTEMS.md`（人类导航）
4. `设计总纲.txt`（产品原则）
5. `设计文档.txt`（详细目标，部分尚未实现）

设计文档描述的是目标，不代表功能已经存在。任何修复结论都必须以当前源码复核。
