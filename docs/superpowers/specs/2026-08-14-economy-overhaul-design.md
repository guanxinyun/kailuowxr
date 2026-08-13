# 经济系统完整重做设计

## 概述

打通四个断裂的经济环节，形成完整循环：
- 星币有了消费出口（升级、贸易、宣传、地形解锁）
- 加工品有了多条消费路径（升级材料、贸易出售、地形建造、建筑销售）
- 地形解锁给了科技树和星币新的意义
- 组合系统扩展让布局策略更深

经济闭环：`基础资源 → 加工品 → 升级/地形/贸易 → 星币 → 购买资源/宣传/地形解锁 → 更多产出`

---

## 1. 星币消费体系

### 1.1 建筑升级加入星币

**改动文件**：`src/core/BuildingSystem.js`

现有 `getUpgradeCost()` 返回基础资源成本。改为同时返回星币成本：

```
升级到2级：基础资源成本不变 + 30 星币
升级到3级：基础资源成本不变 + 80 星币
```

实现方式：在 `getUpgradeCost()` 返回的对象中加入 `credits` 字段。`gameState.spend()` 已支持 credits，无需改动 GameState。

### 1.2 贸易站双向交易

**新建文件**：`src/core/TradeSystem.js`

贸易站（`trade_hub`）获得交易功能：

**挂载销售（统一模式）**：
- 贸易站和文化/旅游类建筑（plaza, museum, concert_hall, monument）都可挂载加工品
- 贸易站可挂载 **3 种**加工品（商业建筑，货架多），其他建筑挂载 **1 种**
- 游客访问该建筑时，有概率购买挂载的加工品，直接获得星币
- 购买概率 = 游客满意度 × 建筑吸引力匹配度 × 0.3
- 售价 = 基础价 × 品质乘数：`D=0.6, C=0.8, B=1.0, A=1.3, S=1.8`
- 基础价格表：`alloy: 15, crystal_circuit: 20, nutrient_pack: 8, thermal_kit: 35, cooling_kit: 40, star_souvenir: 25, energy_cell: 12, bio_sample: 18`
- 库存售完自动下架，需要补货（从 production.inventory 扣除）
- 挂载时设置上架数量，从库存转入建筑货架

**买入基础资源花星币**：
- 贸易站额外功能：玩家可花星币购买基础资源
- 可购买：metal, crystal, energy, food
- 基础价格：`metal: 3, crystal: 8, energy: 2, food: 2`（每单位星币）
- 每日购买量递增价格：前10单位原价，之后每10单位涨价20%
- 每日买入上限 = 贸易站等级 × 20 单位

**状态**：
```js
state.trade = { dailyBought: {}, lastTradeDay: 0, promotionLevel: 0, campaign: null }
// 每个建筑：building.shopShelf = [{ productId, qualityScore, stock }]  // 最多1或3个槽位
```

**UI**：在建筑管理面板中，有挂载能力的建筑显示"货架"区域，可选择上架加工品和数量。贸易站额外显示"采购"标签页。

### 1.3 宣传引流

**文件**：`src/core/TradeSystem.js`

**持续投入**（需要贸易站运营中）：
- 3档预算：关闭(0) / 低(3星币/天, 游客+15%) / 中(8星币/天, 游客+35%) / 高(15星币/天, 游客+60%)
- 每日自动扣除，余额不足自动降档
- 效果通过 `state.trade.promotionLevel` 传递给 TouristManager

**临时活动**：
- 花费一次性星币发起限时宣传
- 小型(50星币, 10天, 游客+30%) / 大型(120星币, 15天, 游客+60%)
- 同时只能有一个活动
- 状态：`state.trade.campaign = { type, startDay, duration, bonus }`

**TouristManager 对接**：在计算游客到访率时读取 `state.trade.promotionLevel` 和 `state.trade.campaign`，叠加到基础吸引力上。

---

## 2. 科技解锁地形建筑

### 2.1 新增科技

**改动文件**：`src/data/techs.js`

新增 2 个 Tier 2 科技：

```js
{
  id: 'mountain_engineering',
  name: '山地工程',
  tier: 2,
  icon: 'mountain',
  desc: '开发在山脉地形上建造设施的工程技术。',
  flavor: '征服高峰，不是为了俯瞰，而是为了扎根。',
  cost: { research: 45 },
  prereqs: ['shields'],
  unlocks: [],  // 不解锁特定建筑，而是解锁地形建造权
  gravity: { adventure: 3, knowledge: 2 },
  position: { x: 600, y: 240 },
}

{
  id: 'water_engineering',
  name: '水域工程',
  tier: 2,
  icon: 'droplets',
  desc: '开发在液态湖上建造浮动设施的工程技术。',
  flavor: '水面之上，是另一片大陆。',
  cost: { research: 45 },
  prereqs: ['biotech_1'],
  unlocks: [],
  gravity: { nature: 3, knowledge: 2 },
  position: { x: 0, y: 240 },
}
```

### 2.2 地形建造规则

**改动文件**：`src/data/gamedata.js`、`src/core/CanvasRenderer.js`、`src/core/Pathfinding.js`

TILE_TYPES 改动：
```js
mountain: { ..., buildable: false, techUnlock: 'mountain_engineering' },
water:    { ..., buildable: false, techUnlock: 'water_engineering' },
```

放置检查改为：
```js
const canBuild = tileInfo.buildable || 
  (tileInfo.techUnlock && state.researchedTechs.includes(tileInfo.techUnlock));
```

寻路改为：对有建筑的 mountain/water 格子允许通行（建筑本身提供通行基础设施）。

### 2.3 地形建造成本

**改动文件**：`src/core/BuildingSystem.js`（新增 `getTerrainBuildCost`）

在特殊地形上建造时，额外成本：
- **山脉**：基础建造成本 ×1.8 + 2 星尘合金 + 30 星币
- **水域**：基础建造成本 ×1.8 + 2 晶体电路 + 30 星币

加工品从 `state.production.inventory` 扣除。

### 2.4 地形产出加成

**改动文件**：`src/core/ResourceFlowSystem.js`

新增地形加成表（`src/data/gamedata.js`）：
```js
TERRAIN_BONUSES = {
  mountain: { mine: 1.5, observatory: 1.4, radar: 1.3 },
  water:    { hydro_farm: 1.4, algae_reactor: 1.5, solar_panel: 1.2 },
  crystal:  { crystal_extractor: 1.4 },
  metal:    { mine: 1.3 },
  forest:   { greenhouse: 1.3, hydro_farm: 1.2 },
}
```

在 `calculateBuildingDailyOutput` 的 context 中加入 `terrainMultiplier`，从建筑所在格子的地形类型查表。

---

## 3. 加工品经济扩展

### 3.1 两层分工

**改动文件**：`src/data/production.js`、`src/core/ProductionSystem.js`

给配方增加 `autoBuilding` 字段——标记哪些配方可由对应建筑自动完成：

```js
// 简单加工（建筑自动）
alloy:           { ..., autoBuilding: 'mine' },        // 矿站自动产合金
crystal_circuit: { ..., autoBuilding: 'crystal_extractor' }, // 晶体提取器自动产电路
nutrient_pack:   { ..., autoBuilding: 'hydro_farm' },  // 农场自动产补给包

// 复杂配方（仍需工坊）
thermal_kit:     { ..., autoBuilding: null },
cooling_kit:     { ..., autoBuilding: null },
star_souvenir:   { ..., autoBuilding: null },
```

建筑自动加工：
- 每个有 `autoBuilding` 匹配的运营中建筑，每天自动消耗输入资源、产出加工品
- 速度 = 工坊速度 × 0.6（比工坊慢，工坊仍有价值）
- 品质 = 基础品质（无工坊加成，无居民技能加成）

### 3.2 自动生产队列

**改动文件**：`src/core/ProductionSystem.js`、`src/panels/ProductionPanel.js`

现有队列是手动逐个添加。新增自动模式：

```js
state.production.autoQueue = [
  { recipeId: 'alloy', mode: 'count', target: 10 },      // 产出10个后停止
  { recipeId: 'star_souvenir', mode: 'continuous' },       // 持续产出
]
```

- 当队列为空且有自动任务时，自动添加下一个任务到队列
- `count` 模式：已产出数量达到 target 后移除
- `continuous` 模式：永远不停，除非手动关闭或资源不足
- 资源不足时暂停（不移除），下次有资源时自动恢复
- UI：在生产面板增加"自动生产"设置区域

### 3.3 建筑升级消耗加工品

**改动文件**：`src/core/BuildingSystem.js`

升级到3级时额外需要加工品：
```
通用：1 星尘合金
科研类建筑（lab/observatory/quantum_lab/xeno_lab）：额外 1 晶体电路
文化类建筑（plaza/museum/concert_hall/holodeck）：额外 1 星尘纪念品
```

在 `getUpgradeCost()` 返回值中加入 `products: { alloy: 1 }` 等字段。
`upgradeBuilding()` 中同时扣除 `state.production.inventory`。

### 3.4 建筑挂载销售

已在 1.2 贸易站中统一设计。所有挂载销售共用同一套机制：
- 贸易站：3 个货架槽位（商业建筑）
- 文化/旅游建筑（plaza, museum, concert_hall, monument）：1 个货架槽位
- 游客访问时按概率购买，售价 = 基础价 × 品质乘数
- 库存售完需补货
- 状态统一为 `building.shopShelf`

### 3.5 新增配方

**改动文件**：`src/data/production.js`

扩展产品线，让更多建筑有副产品可卖：

```js
// 能量电池——太阳能板副产
{
  id: 'energy_cell',
  name: '能量电池',
  category: 'processed',
  icon: 'battery-charging',
  desc: '浓缩能量单元，可用于建造和交易。',
  inputs: { energy: 15, metal: 3 },
  output: { id: 'energy_cell', name: '能量电池', quantity: 2 },
  days: 2,
  requiredBuilding: 'workshop',
  autoBuilding: 'solar_panel',
}

// 生态标本——温室副产
{
  id: 'bio_sample',
  name: '生态标本',
  category: 'goods',
  icon: 'leaf',
  desc: '珍贵的异星生态样本，科研和旅游价值兼具。',
  inputs: { food: 8, crystal: 2 },
  output: { id: 'bio_sample', name: '生态标本', quantity: 1 },
  days: 3,
  requiredBuilding: 'workshop',
  autoBuilding: 'greenhouse',
}
```

贸易价格表更新：`energy_cell: 12, bio_sample: 18`

---

## 4. 扩展组合系统

### 4.1 支持多建筑群落组合

**改动文件**：`src/data/combos.js`、`src/core/ComboSystem.js`

数据结构扩展——`buildingIds` 从固定2个改为2-5个：
```js
{
  id: 'food_chain',
  name: '生态食物链',
  icon: 'link',
  buildingIds: ['hydro_farm', 'greenhouse', 'protein_vat'],
  maxDistance: 3,  // 群落允许更大范围
  description: '完整的食物生产链形成了自给自足的生态循环。',
  effects: [
    { type: 'building_output', resource: 'food', multiplier: 1.3, buildingIds: ['hydro_farm', 'greenhouse', 'protein_vat'] },
    { type: 'maintenance_reduction', multiplier: 0.85 },
  ],
  effectText: '食物产出+30%，维护消耗-15%',
}
```

检测逻辑改动：
- 现有 `findActiveInstance()` 已支持 N 栋建筑的贪心搜索
- 只需放宽 `maxDistance` 对群落组合的限制（群落用 3-4，配对保持 2）
- 性能：每日一次评估，建筑总数 <100，N≤5 的组合搜索可接受

### 4.2 新增效果类型

**改动文件**：`src/core/ComboSystem.js`、消费方

新增 3 种效果类型：

| 效果类型 | 说明 | 消费方 |
|---------|------|--------|
| `maintenance_reduction` | 降低区域内建筑的资源消耗 | ResourceFlowSystem |
| `happiness_bonus` | 增加居民幸福感 | main.js 幸福度计算 |
| `product_quality` | 提升加工品质（比现有 production_quality 更通用） | ProductionSystem |

`getComboMultiplier` 和 `getComboBonus` 已是通用查询接口，新效果类型只需在消费方调用即可。

### 4.3 AI 群落组合生成

**改动文件**：`src/core/DynamicContentSystem.js`、`src/ai/AIClient.js`

扩展 AI combo prompt：
- 允许 AI 提议 2-5 栋建筑的组合
- 校验：所有 buildingId 必须存在、不与现有组合重复
- 群落组合效果模板：
  - `output`(3栋) → multiplier 1.15
  - `output`(4-5栋) → multiplier 1.20
  - `production`(3栋) → multiplier 1.15
  - `happiness`(3+栋) → bonus 3-5

### 4.4 新增硬编码群落组合

**改动文件**：`src/data/combos.js`

```js
// 3栋群落
{ id: 'food_chain', name: '生态食物链',
  buildingIds: ['hydro_farm', 'greenhouse', 'protein_vat'], maxDistance: 3,
  effects: [{ type: 'building_output', resource: 'food', multiplier: 1.3 }] }

{ id: 'research_campus', name: '科研园区',
  buildingIds: ['lab', 'observatory', 'quantum_lab'], maxDistance: 3,
  effects: [{ type: 'building_output', resource: 'research', multiplier: 1.3 }] }

{ id: 'culture_district', name: '文化街区',
  buildingIds: ['plaza', 'museum', 'concert_hall'], maxDistance: 3,
  effects: [{ type: 'tourism_attraction', multiplier: 1.35 }, { type: 'happiness_bonus', bonus: 5 }] }

// 4栋群落
{ id: 'industrial_complex', name: '工业综合体',
  buildingIds: ['mine', 'crystal_extractor', 'workshop', 'warehouse'], maxDistance: 4,
  effects: [{ type: 'building_output', resource: 'metal', multiplier: 1.25 },
            { type: 'building_output', resource: 'crystal', multiplier: 1.25 },
            { type: 'production_speed', multiplier: 1.25 }] }

// 5栋群落
{ id: 'self_sustaining', name: '自给自足社区',
  buildingIds: ['habitat', 'hydro_farm', 'solar_panel', 'workshop', 'plaza'], maxDistance: 4,
  effects: [{ type: 'maintenance_reduction', multiplier: 0.8 }, { type: 'happiness_bonus', bonus: 8 }] }
```

---

## 5. 状态与存档兼容

所有新状态字段在 GameState 初始化时提供默认值：

```js
// 贸易
state.trade = state.trade || { 
  dailyBought: {}, lastTradeDay: 0,
  promotionLevel: 0, campaign: null 
};

// 自动生产
state.production.autoQueue = state.production.autoQueue || [];

// 建筑货架（挂载销售）
// 每个 building 对象：building.shopShelf = building.shopShelf || [];
```

旧存档加载时自动补全，无需迁移链。

---

## 6. 文件改动清单

| 文件 | 改动类型 | 内容 |
|------|---------|------|
| `src/data/techs.js` | 修改 | +2 科技 |
| `src/data/gamedata.js` | 修改 | TILE_TYPES 加 techUnlock + TERRAIN_BONUSES |
| `src/data/buildings.js` | 不改 | 建筑定义不变 |
| `src/data/production.js` | 修改 | +autoBuilding 字段 + 2 新配方 |
| `src/data/combos.js` | 修改 | +5 群落组合 |
| `src/data/balance.js` | 修改 | +贸易/宣传/地形成本参数 |
| `src/core/BuildingSystem.js` | 修改 | 升级成本加星币+加工品 |
| `src/core/ResourceFlowSystem.js` | 修改 | 地形加成 + 维护减免 |
| `src/core/ComboSystem.js` | 修改 | 支持 3-5 栋 + 新效果类型 |
| `src/core/ProductionSystem.js` | 修改 | 自动队列 + 建筑自动加工 |
| `src/core/TouristManager.js` | 修改 | 宣传引流 + 建筑挂载销售 |
| `src/core/GameState.js` | 修改 | 新状态字段默认值 |
| `src/core/TradeSystem.js` | **新建** | 贸易站交易 + 宣传引流 |
| `src/core/DynamicContentSystem.js` | 修改 | AI 群落组合生成 |
| `src/core/CanvasRenderer.js` | 修改 | 地形建造检查 |
| `src/core/Pathfinding.js` | 修改 | 有建筑的山/水允许通行 |
| `src/main.js` | 修改 | 每日循环接入贸易/自动加工/宣传 |
| `src/panels/ProductionPanel.js` | 修改 | 自动生产 UI |
| `src/panels/BuildingManagementPanel.js` | 修改 | 贸易界面 + 挂载产品 |
