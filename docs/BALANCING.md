# 数值平衡手动调整

集中配置位于 `src/data/balance.js`。修改后运行：

```bash
npm test
npm run build
```

## 常用字段

| 字段 | 单位 | 当前值 | 建议范围 | 说明 |
|---|---:|---:|---:|---|
| `buildingOutputRate` | 倍率/天 | 0.15 | 0.08–0.3 | 所有建筑资源基准值换算为日产量 |
| `foodPerResidentPerDay` | 食物/人/天 | 0.3 | 0.15–0.5 | 人口持续口粮消耗 |
| `construction.buildTimeDays` | 天 | 10 | 5–15 | 建筑定义中的 `buildTime` 乘以此值 |
| `production.durationMultiplier` | 倍率 | 1 | 0.5–2 | 加工时长总倍率 |
| `growth.experienceMultiplier` | 倍率 | 1 | 0.5–2 | 居民经验速度 |
| `tourism.incomeMultiplier` | 倍率 | 1 | 0.5–2 | 游客消费收入 |
| `events.dailyChance` | 概率/天 | 0.015 | 0.005–0.04 | 随机事件触发概率 |
| `aiTriggers.shortageDays` | 天 | 5 | 3–15 | 连续短缺多久才提醒 |
| `aiTriggers.shortageThresholds` | 资源量 | 各资源不同 | 5–50 | 低于此值累计短缺天数 |

## 读懂资源流

统计面板使用同一套每日计算展示：

- **产出**：运营建筑每天提供的总量；
- **消耗**：人口口粮等持续扣除；
- **净变化**：产出减消耗。

加工订单开始时扣除的材料属于一次性消耗，不计入 `/天`。仓库已满或资源见底时，实际存量变化会被截断，但面板仍显示当前生产能力，方便判断布局与人口是否平衡。

## 原则

AI 不得修改本文件，也不得决定成本、产出、品质、奖励或解锁。调数值前建议先导出存档；本项目仍处于未发布阶段，不维护历史平衡迁移链。
