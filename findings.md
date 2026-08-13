# 研究发现

## 当前经济系统现状

### 星币（credits）
- 状态字段：`GameState._state.resources.credits`，初始 50，上限 Infinity
- **收入来源**：游客消费（5-15/次）、贸易站被动收入、纪念品销售
- **支出途径**：**零**——完全没有消费机制
- 结论：星币只进不出，积累无意义

### 建筑升级
- `BuildingSystem.js` `getUpgradeCost()`：基于建造成本 × (0.75 + level × 0.5)
- 只消耗基础资源（metal/energy/crystal），不消耗星币或加工品
- 最高 3 级，每级效率 +25%

### 地形系统
- `TILE_TYPES`：mountain/water/ruins/crater 为 `buildable: false`，硬编码
- 放置检查：`CanvasRenderer.js:280` 只检查 `tileInfo.buildable && !tile.building`
- 寻路：`Pathfinding.js:13` 阻挡 water/mountain
- **无任何地形加成机制**——矿站放在矿脉上和放在平原上产出完全相同

### 组合系统
- 4 个硬编码组合（2栋配对，曼哈顿距离 ≤2）
- AI 可生成新组合（2栋配对，效果弱于硬编码）
- 效果类型：building_output / production_speed / production_quality / tourism_attraction
- **不支持 3+ 栋群落组合**

### 加工系统
- 6 个配方，全部需要综合工坊（`requiredBuilding: 'workshop'`）
- 手动添加到队列，按游戏日推进
- 产品出路：高级配方原料、探索消耗包、卖纪念品给游客
- **无自动生产、无建筑副产、无贸易出售**

### 科技树
- 13 个科技，4 层，只做"解锁建筑"
- 研究花费是装饰性的——进度条基于时间，不扣除 research 资源
- **无地形解锁类科技**

### 关键代码接口
- `gameState.spend(costObj)` — 扣除资源，返回 boolean
- `gameState.canAfford(costObj)` — 检查是否够
- `gameState.addResource(key, amount)` — 增加资源
- `bus.emit(event, payload)` — 事件通知
- `getComboMultiplier(type, context)` — 组合乘数查询
- `getComboBonus(type)` — 组合加成查询
- `calculateBuildingDailyOutput()` — 建筑日产出计算，已支持 comboMultiplier 回调

## 设计决策记录
1. 建造不花星币，升级花星币——保护开局体验
2. 科技研究花研究点不花星币
3. 地形解锁：科技解锁后直接可建，成本 ×1.8，特定建筑有加成
4. 地形建造额外消耗加工品（山=合金，水=电路）
5. 组合系统扩展为支持 2-5 栋，增加效果类型
6. 加工品两层分工：简单加工由建筑自动完成，复杂配方留在工坊
7. 自动生产：支持"产出N个"或"持续产出"
8. 宣传引流：持续投入 + 临时活动两种模式
9. 加工品可在贸易站出售换星币，品质影响价格
10. 建筑可挂载加工品进行销售
