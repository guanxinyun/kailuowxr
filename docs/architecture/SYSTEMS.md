# 系统接口与实现状态

本页让有限上下文的 AI 快速定位。机器可读契约见 `systems.json`；运行 `npm run context -- <系统ID>` 获取源码包。**修复前仍要读取真实实现、直接调用方和测试。**

| ID | 状态 | 状态所有者 | 职责与边界 |
|---|---|---|---|
| `runtime` | 已实现 | `GameState` | 启动、每日 tick、系统编排和建筑放置；`main.js` 仍较集中。 |
| `state` | 部分实现 | `GameState._state` | 资源、时间、建筑、居民、存档；旧存档迁移和结构校验尚缺。 |
| `rendering` | 已实现 | Renderer 实例 | 等距 Canvas、程序地形/建筑、居民和游客精灵；未连接降落点的建筑显示红色警告三角；自定义纹理尚未实现。 |
| `map-navigation` | 部分实现 | `state.map` | 地图生成、坐标转换、A*、道路/HQ 连通判断；生产尚未使用连通结果。 |
| `building-economy` | 部分实现 | `state.buildings/resources` | 建造、道路运营、升级、拆除（退还50%资源）、组合、加工和按天资源流已实现；统计面板显示持续产出、消耗与净变化。 |
| `residents` | 部分实现 | `state.residents` | 六项技能、心情、日记与地图移动；经验、熟练度、体力、劳动力、探索力及住宅阶段由 ResidentGrowthSystem 管理。战斗不在项目范围内。 |
| `tourism-diplomacy` | 部分实现 | TouristManager 内存 + `state.diplomacy` | 游客按个体六维偏好自主选择景点并逐日访问，离开时按实际满意度结算消费和声望；路线/满意度和游客持久化尚未实现。 |
| `exploration` | 已实现 | `state.unlockedRegions/activeExploration/mapExpansion` | 8个特殊区域通过事件解锁，奖励随机掷骰，每区域一次；无限随机考察任务；购买地图拓展从已探索边缘向四周均匀扩散3层。 |
| `production` | 部分实现 | `state.production` | 综合工坊将基础资源加工为合金、电路、补给和纪念品；队列按游戏日推进并保存品质。 |
| `ai-narrative` | 已实现+降级 | `AIRequestQueue/AIClient` | 产品、游客、考察、事实日记和年度评语支持玩家模型与本地模板；AI 不控制数值。 |
| `dynamic-ai-content` | 已实现 | `state.aiContent` | 通过玩家自己的 OpenAI 兼容接口或本地降级，在游玩中生成建筑、组合评价和外星种族；规则经本地校验并由玩家确认。 |
| `saves` | 已实现 | `localStorage` 存档槽位 | 三个本地存档槽位，支持命名、保存、读取、删除及当前格式 JSON 导入导出。 |
| `annual-review` | 已实现 | `state.annualReview` | 根据设施运营、居民成长、生产加工、组合、资源、探索和外交生成确定性分数；AI 只写评语。 |
| `ui-panels` | 已实现 | `UIManager` + DOM | 模态框（flexbox 布局，body 不硬编码 max-height）、顶栏、通知及各功能面板；点击地图建筑打开右侧信息面板（含升级/拆除）。 |
| `content-data` | 已实现 | `src/data` 常量 | 建筑、科技、居民、种族、区域和事件定义。部分定义效果尚无运行逻辑。 |

## 主要契约

### State 与事件
- `gameState.get/set/update` 读写路径；`addResource/spend/addBuilding/removeBuilding` 是常用变更入口。
- `serialize/deserialize` 负责存档，但当前 `deserialize` 直接替换状态。
- `bus.on/off/once/emit` 是模块间通知；事件不是权威状态，重载后应从 `GameState` 重建 UI/渲染。

### 渲染
- `CanvasRenderer` 读取 `gameState.state.map/buildings`，只负责显示和输入命中。
- `ResidentSpriteManager` 管理显示对象；居民权威数据仍在 `GameState`。
- `MapGenerator.gridToIso/isoToGrid` 是坐标边界；不要在面板中复制换算公式。

### AI
- 叙事路径：面板/事件 → `AIAdvisor` → `AIRequestQueue` → 校验 → 本地 fallback。
- 动态内容路径：`AITriggerSystem` 检测里程碑 → `DynamicContentSystem.generateProposal` → `AIClient` → 本地校验 → 玩家确认。
- `AIClient` 支持玩家自填 OpenAI 兼容端点（`sessionStorage`），密钥不进存档或 `localStorage`。
- 正确边界：本地系统先生成不可变事实与结果，AI 只能改写文本；失败立即使用本地模板。

## 修改检查表
1. 确认系统状态所有者，不在 UI 或 AI 响应中复制权威状态。
2. 检查所有直接调用方和事件监听者。
3. 新状态补默认值、迁移和序列化测试。
4. 新公共导出/文件同步更新 `systems.json`，运行 `npm run architecture:check`。
5. UI 改动启动开发服务器并在浏览器走完整流程。
