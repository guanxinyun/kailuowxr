# 系统接口与实现状态

本页让有限上下文的 AI 快速定位。机器可读契约见 `systems.json`；运行 `npm run context -- <系统ID>` 获取源码包。**修复前仍要读取真实实现、直接调用方和测试。**

| ID | 状态 | 状态所有者 | 职责与边界 |
|---|---|---|---|
| `runtime` | 已实现 | `GameState` | 启动、每日 tick、系统编排和建筑放置；`main.js` 仍较集中。 |
| `state` | 部分实现 | `GameState._state` | 资源、时间、建筑、居民、存档；旧存档迁移和结构校验尚缺。 |
| `rendering` | 已实现 | Renderer 实例 | 等距 Canvas、程序地形/建筑、居民和游客精灵；未连接降落点的建筑显示红色警告三角；画布点击/拖拽仅响应左键，右键专用于退出放置模式；支持触屏双指缩放（pinch-to-zoom）；自定义纹理：地形和道路通过等距投影（正方形→菱形）+菱形clip平铺渲染；建筑支持分面拼合等距图和完整图保持比例缩放，完整图按底边中心锚定；居民/游客支持按方向分片拼合的 3×4 精灵表，并按 32×32 单帧脚底中心绘制。 |
| `map-navigation` | 部分实现 | `state.map` | 地图生成、坐标转换、A*、道路/HQ 连通判断；山地/水域可通过科技解锁建筑（mountain_engineering/water_engineering），地形产出加成由 TERRAIN_BONUSES 查表。 |
| `building-economy` | 部分实现 | `state.buildings/resources` | 建造、道路运营、升级（2级+30/3级+80星币+加工品）、拆除（退还50%资源）、组合、加工和按天资源流已实现；建筑可连续铺设（资源耗尽或按ESC/右键退出）。贸易站支持货架挂售、采购资源和宣传引流。生产建筑产出先进入本建筑储备（`building.buffer`，上限5），由仓储中心/搬运站派员工在搬运半径内搬入全局库存，无搬运则满仓停滞。 |
| `residents` | 部分实现 | `state.residents` | 六项技能、心情、日记与地图移动；经验、熟练度、体力、劳动力、探索力及住宅阶段由 ResidentGrowthSystem 管理。战斗不在项目范围内。 |
| `tourism-diplomacy` | 部分实现 | TouristManager 内存 + `state.diplomacy` | 游客按个体六维偏好自主选择景点并逐日访问，离开时按实际满意度结算消费和声望；游客购买货架商品消费星币；宣传加成到访率；路线/满意度和游客持久化尚未实现。 |
| `exploration` | 已实现 | `state.unlockedRegions/activeExploration/blockExplorations/mapExpansion` | 初始探索区为 4×8 矩形；地图上待探索区块发暗并标注「待探索」，点击派遣（玩家自选具体居民、需花星币）；探索进度条上随机位置触发随机事件（本地掷骰决定好/坏结果，奖励含资源、研究点、特殊道具、建筑/加工品图纸），AI 仅按角色属性与地块种类生成叙事；区块为 4×4（16格），完成后地块转为已探索。8个特殊区域经事件解锁、无限随机考察任务、地图拓展仍保留。 |
| `production` | 部分实现 | `state.production` | 综合工坊是唯一加工场所，将基础资源加工为合金、电路、补给和纪念品；队列按游戏日推进并保存品质；基础生产设施只产基础资源、不加工；autoQueue 支持产N个/持续模式；加工配置在工坊建筑子页而非左侧工具栏。 |
| `ai-narrative` | 已实现+降级 | `AIRequestQueue/AIClient` | 产品、游客、考察、事实日记和年度评语支持玩家模型与本地模板；AI 不控制数值。AI 工坊提供连接测试、自动拉取 OpenAI 兼容模型列表（含分页）和失败后本地降级。 |
| `dynamic-ai-content` | 已实现 | `state.aiContent` | 通过玩家自己的 OpenAI 兼容接口或本地降级，在游玩中生成建筑、组合评价、外星种族和新科技；AI 生成的建筑可通过 `unlockTech` 引用 AI 科技作为前置；规则经本地校验并由玩家确认。接口配置支持模型列表拉取与连接测试，Key 只存当前标签页。 |
| `saves` | 已实现 | `localStorage` 存档槽位 | 三个本地存档槽位，支持命名、保存、读取、删除及当前格式 JSON 导入导出。 |
| `annual-review` | 已实现 | `state.annualReview` | 根据设施运营、居民成长、生产加工、组合、资源、探索和外交生成确定性分数；AI 只写评语。 |
| `ui-panels` | 已实现 | `UIManager` + DOM | 模态框（flexbox 布局，body 不硬编码 max-height）、顶栏、通知及各功能面板；所有 UI 文本为中文（级、阶、经验等）；建筑/科技面板的互相引用显示中文名而非原始 ID；点击地图建筑打开右侧信息面板（含升级/拆除/工坊加工配置与储备显示）；设施管理面板显示生产、储备与搬运状态。教程包含游客引导和建筑信息提示。手机端三档响应式适配（768px/480px/横屏），工具栏移至底部横排，模态框全屏；topbar/toolbar flex 子项已修复 min-width 溢出，引力切换横排布局；使用 `100dvh` 防止移动端浏览器 UI 遮挡底部工具栏。 |
| `content-data` | 已实现 | `src/data` 常量 | 建筑、科技、居民、种族、区域和事件定义；科技树支持动态高度以容纳 AI 生成节点，正在研究的节点有琥珀色脉冲标记；新增 mountain_engineering/water_engineering 科技（Tier 2）；5个群落组合（3-5栋）；纹理槽位含 targetWidth/targetHeight。部分定义效果尚无运行逻辑。 |

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
- 动态内容路径：`AITriggerSystem` 检测里程碑 → `DynamicContentSystem.generateProposal` → `AIClient` → 本地校验 → 玩家确认。支持 `building_proposal`、`combo_proposal`、`species_proposal`、`tech_proposal` 四种类型。
- `AIClient` 支持玩家自填 OpenAI 兼容端点（`sessionStorage`），密钥不进存档或 `localStorage`。
- 正确边界：本地系统先生成不可变事实与结果，AI 只能改写文本；失败立即使用本地模板。

## 修改检查表
1. 确认系统状态所有者，不在 UI 或 AI 响应中复制权威状态。
2. 检查所有直接调用方和事件监听者。
3. 新状态补默认值、迁移和序列化测试。
4. 新公共导出/文件同步更新 `systems.json`，运行 `npm run architecture:check`。
5. UI 改动启动开发服务器并在浏览器走完整流程。
