/**
 * 星尘殖民地 — 事件 + 物品 + 组合 + 地图瓦片
 */

// ===== 随机事件 =====
export const EVENTS = [
  {
    id: 'meteor_shower',
    name: '流星雨',
    type: 'disaster',
    icon: 'flame',
    narrative: '深空雷达捕捉到异常信号——一场密集的流星雨正朝殖民地袭来。碎片将在数小时内抵达，你必须做出决定。',
    choices: [
      { text: '启动护盾全力防御', effect: { energy: -20 }, result: '护盾成功拦截了大部分碎片，但能量储备大幅下降。' },
      { text: '疏散居民进入避难所', effect: { happiness: -5 }, result: '所有人安全撤离，但一些地表设施受到了损伤。' },
      { text: '派遣小队收集陨石样本', effect: { crystal: 15, happiness: -3 }, result: '冒险收集到了珍贵的晶体矿物，但有人受了轻伤。' },
    ],
    weight: 10,
    minDay: 10,
  },
  {
    id: 'alien_signal',
    name: '神秘信号',
    type: 'discovery',
    icon: 'radio',
    narrative: '通讯阵列接收到一段重复的电磁信号。信号来自一个未知方向，模式高度规律，不像是自然现象。',
    choices: [
      { text: '尝试解码信号', effect: { research: 10 }, result: '经过分析，信号中包含了一组数学常数——这是智慧生命的标志！' },
      { text: '回复友好信息', effect: { diplomacy: 5 }, result: '你发送了包含质数序列的回复。几天后，信号的模式发生了变化。' },
      { text: '保持沉默，加强监控', effect: { defense: 3 }, result: '谨慎是明智的。你加强了防御部署，同时继续监听。' },
    ],
    weight: 8,
    minDay: 15,
  },
  {
    id: 'crop_mutation',
    name: '作物变异',
    type: 'science',
    icon: 'sprout',
    narrative: '水培农场中的一批作物出现了意外变异。叶片呈现出奇异的荧光色，生长速度是正常的三倍。',
    choices: [
      { text: '隔离研究变异样本', effect: { research: 8, food: -2 }, result: '研究发现变异是由本地微生物引起的，这可能是重大突破。' },
      { text: '大规模培育变异作物', effect: { food: 10 }, result: '产量大幅提升！但林月华警告说长期安全性还未验证。' },
      { text: '销毁变异样本，确保安全', effect: { food: -3 }, result: '安全第一。虽然损失了一些产出，但避免了潜在风险。' },
    ],
    weight: 12,
    minDay: 8,
  },
  {
    id: 'dust_storm',
    name: '星尘风暴',
    type: 'disaster',
    icon: 'wind',
    narrative: '一场罕见的星尘风暴正在逼近。细微的星际尘埃可能会损坏太阳能板和精密设备。',
    choices: [
      { text: '关闭所有外部设备等待风暴过去', effect: { energy: -15, food: -5 }, result: '风暴持续了两天。设备安全，但生产停滞造成了损失。' },
      { text: '收集星尘用于研究', effect: { research: 5, crystal: 5 }, result: '冒着风险收集的星尘中含有稀有元素，价值不菲。' },
    ],
    weight: 8,
    minDay: 20,
  },
  {
    id: 'trader_visit',
    name: '星际商人',
    type: 'trade',
    icon: 'package',
    narrative: '一艘不明商船出现在轨道上，自称是"星际自由贸易联盟"的成员。他们提出了交易请求。',
    choices: [
      { text: '用金属换取稀有晶体', effect: { metal: -30, crystal: 20 }, result: '交易顺利完成。商人留下了一张星图作为赠礼。' },
      { text: '用食物换取科技数据', effect: { food: -20, research: 15 }, result: '数据包中包含了一些有趣的外星工程方案。' },
      { text: '婉拒交易，保持警惕', effect: { defense: 2 }, result: '商人平静地离开了。也许下次再来。' },
    ],
    weight: 6,
    minDay: 25,
  },
  {
    id: 'aurora',
    name: '极光现象',
    type: 'wonder',
    icon: 'rainbow',
    narrative: '天空中出现了壮丽的极光——这颗星球的磁场与恒星风相互作用，创造出令人窒息的美景。殖民者们纷纷走出居住舱，仰望这片绚烂的光幕。',
    choices: [
      { text: '组织全体观赏活动', effect: { happiness: 10, culture: 3 }, result: '这是殖民地建立以来最美好的夜晚。每个人都会记住这一刻。' },
      { text: '利用极光进行科学观测', effect: { research: 8 }, result: '收集到了宝贵的磁场数据，对理解这颗星球大有帮助。' },
    ],
    weight: 5,
    minDay: 5,
  },
  // 探索发现事件 — 解锁特殊区域
  {
    id: 'discover_ruins', name: '卫星异常信号', type: 'exploration', icon: 'satellite',
    unlockRegion: 'ancient_ruins',
    narrative: '轨道卫星扫描到地表以下存在规则几何结构，初步分析表明这可能是某种古老文明的建筑遗迹。',
    choices: [
      { text: '标记坐标，准备考察', effect: { research: 3 }, result: '坐标已录入导航系统。远古遗迹区域现已开放考察！' },
      { text: '先进行远程扫描', effect: { research: 5 }, result: '扫描获取了初步数据。远古遗迹区域现已开放考察！' },
    ],
    weight: 8, minDay: 10,
  },
  {
    id: 'discover_crystal', name: '异常光谱', type: 'exploration', icon: 'sparkles',
    unlockRegion: 'crystal_valley',
    narrative: '夜间巡逻队报告在西南方向观测到异常的光谱反射，分析显示可能是大规模晶体矿脉。',
    choices: [
      { text: '派遣勘探队确认', effect: { crystal: 3 }, result: '勘探队确认了晶体峡谷的位置。该区域现已开放考察！' },
      { text: '采集光谱样本分析', effect: { research: 4 }, result: '光谱数据揭示了晶体峡谷的方位。该区域现已开放考察！' },
    ],
    weight: 8, minDay: 15,
  },
  {
    id: 'discover_forest', name: '孢子飘落', type: 'exploration', icon: 'trees',
    unlockRegion: 'deep_forest',
    narrative: '空气过滤系统捕获了大量未知植物孢子，追踪风向发现它们来自一片茂密的异星森林。',
    choices: [
      { text: '追踪孢子来源', effect: { food: 4 }, result: '成功定位了异星密林。该区域现已开放考察！' },
      { text: '培养孢子样本', effect: { research: 3, food: 2 }, result: '样本分析指向了密林方位。该区域现已开放考察！' },
    ],
    weight: 7, minDay: 20,
  },
  {
    id: 'discover_volcano', name: '地震波异常', type: 'exploration', icon: 'flame',
    unlockRegion: 'volcano_rim',
    narrative: '地震监测站记录到有规律的低频震动，震源指向一座活跃火山的边缘地带。',
    choices: [
      { text: '部署远程探测器', effect: { metal: 5 }, result: '探测器传回了火山边缘的详细地形。该区域现已开放考察！' },
      { text: '分析地震数据', effect: { research: 5 }, result: '数据分析揭示了火山边缘的资源潜力。该区域现已开放考察！' },
    ],
    weight: 6, minDay: 30,
  },
  {
    id: 'discover_signal', name: '深空回响', type: 'exploration', icon: 'radio',
    unlockRegion: 'signal_source',
    narrative: '通讯阵列接收到一段来自星球深处的加密信号，信号强度远超自然现象。',
    choices: [
      { text: '三角定位信号源', effect: { research: 8 }, result: '信号源已精确定位。该区域现已开放考察！' },
      { text: '尝试解密信号内容', effect: { research: 10 }, result: '部分解密成功，获得了信号源坐标。该区域现已开放考察！' },
    ],
    weight: 5, minDay: 40,
  },
  {
    id: 'discover_snow', name: '极地气流', type: 'exploration', icon: 'snowflake',
    unlockRegion: 'snow_frontier',
    narrative: '气象站检测到来自北方的异常冷气流，卫星图像显示那里存在一片广袤的冰雪荒原。',
    choices: [
      { text: '发射气象探测气球', effect: { research: 4 }, result: '气球传回了寒霜边界的地形数据。该区域现已开放考察！' },
      { text: '分析冰晶成分', effect: { crystal: 4 }, result: '冰晶分析揭示了寒霜边界的位置。该区域现已开放考察！' },
    ],
    weight: 5, minDay: 50,
  },
  {
    id: 'discover_desert', name: '热浪信号', type: 'exploration', icon: 'sun',
    unlockRegion: 'desert_frontier',
    narrative: '热成像卫星在南方发现了异常的热辐射模式，地表温度远超周围区域，可能蕴含特殊矿物。',
    choices: [
      { text: '派遣无人机侦察', effect: { metal: 5 }, result: '无人机传回了赤沙边界的详细影像。该区域现已开放考察！' },
      { text: '分析热辐射数据', effect: { research: 5 }, result: '数据分析确认了赤沙边界的位置。该区域现已开放考察！' },
    ],
    weight: 5, minDay: 60,
  },
  {
    id: 'recruit_wanderer',
    name: '迷途殖民者',
    type: 'exploration',
    icon: 'users',
    narrative: '探索队在殖民地边缘发现了一艘坠毁的救生舱，舱内是一名陷入休眠的迷途殖民者。他苏醒后表示愿意加入你的殖民地。',
    choices: [
      { text: '欢迎加入殖民地', effect: { recruit: 1 }, result: '新居民正式加入！殖民地又多了一位成员。' },
      { text: '提供补给，送他离开', effect: { food: -3, happiness: 2 }, result: '你赠予了补给。他道谢后独自踏上旅程，居民们为这份善意感到欣慰。' },
    ],
    weight: 7,
    minDay: 5,
  },
];

// ===== 地图瓦片类型 =====
export const TILE_TYPES = {
  plains:    { name: '平原',   color: '#1a2a1a', buildable: true,  icon: null },
  mountain:  { name: '山脉',   color: '#2a2a3a', buildable: false, icon: 'mountain', techUnlock: 'mountain_engineering' },
  water:     { name: '液态湖', color: '#0a1a3a', buildable: false, icon: 'droplets', techUnlock: 'water_engineering' },
  crystal:   { name: '晶矿',   color: '#2a1a3a', buildable: true,  icon: 'gem', resource: 'crystal' },
  metal:     { name: '矿脉',   color: '#2a2a2a', buildable: true,  icon: 'pickaxe', resource: 'metal' },
  ruins:     { name: '遗迹',   color: '#1a1a2a', buildable: false, icon: 'landmark', explorable: true },
  crater:    { name: '陨石坑', color: '#1a1a1a', buildable: false, icon: 'circle-dot' },
  forest:    { name: '异星林', color: '#0a2a1a', buildable: true,  icon: 'trees', resource: 'nature' },
  snow:      { name: '寒霜原', color: '#b8d8e8', buildable: true,  icon: 'snowflake', resource: 'ice_core' },
  desert:    { name: '赤沙地', color: '#b87a38', buildable: true,  icon: 'sun', resource: 'sun_crystal' },
};

/** 地形产出加成：特定建筑在特定地形上的产出乘数 */
export const TERRAIN_BONUSES = {
  mountain: { mine: 1.5, observatory: 1.4, radar: 1.3 },
  water:    { hydro_farm: 1.4, algae_reactor: 1.5, solar_panel: 1.2 },
  crystal:  { crystal_extractor: 1.4 },
  metal:    { mine: 1.3 },
  forest:   { greenhouse: 1.3, hydro_farm: 1.2 },
};

// ===== 引力维度配置 =====
export const GRAVITY_CONFIG = {
  food:      { name: '食物',   color: '#FF8C42', colorDim: 'rgba(255,140,66,0.15)',  icon: 'wheat' },
  knowledge: { name: '知识',   color: '#4A90D9', colorDim: 'rgba(74,144,217,0.15)',  icon: 'book-open' },
  comfort:   { name: '舒适',   color: '#A8D8B9', colorDim: 'rgba(168,216,185,0.15)', icon: 'sofa' },
  adventure: { name: '冒险',   color: '#E74C3C', colorDim: 'rgba(231,76,60,0.15)',   icon: 'compass' },
  culture:   { name: '文化',   color: '#9B59B6', colorDim: 'rgba(155,89,182,0.15)',  icon: 'palette' },
  nature:    { name: '自然',   color: '#2ECC71', colorDim: 'rgba(46,204,113,0.15)',   icon: 'leaf' },
};

// ===== 资源配置 =====
export const RESOURCES = {
  metal:    { name: '金属',     icon: 'pickaxe',        color: '#8B8AA0' },
  crystal:  { name: '晶体',     icon: 'gem',            color: '#C8BFE7' },
  energy:   { name: '能量',     icon: 'zap',            color: '#F0C040' },
  food:     { name: '食物',     icon: 'wheat',          color: '#FF8C42' },
  research: { name: '研究点',   icon: 'flask-conical',  color: '#4A90D9' },
  credits:  { name: '星币',     icon: 'coins',          color: '#F0C040' },
};

// ===== 探索区域（特殊，事件解锁，一次性） =====
export const EXPLORE_REGIONS = [
  { id: 'nearby_caves',   name: '近地洞穴群',   danger: 1, distance: 1, biome: 'metal',    rewardPool: { metal: [3, 8], crystal: [1, 5] }, desc: '殖民地附近的天然洞穴系统，可能蕴含矿物资源。' },
  { id: 'ancient_ruins',  name: '远古遗迹',     danger: 2, distance: 2, biome: 'ruins',    rewardPool: { research: [5, 12] }, desc: '卫星扫描发现的异常结构，似乎是某个古老文明的遗迹。' },
  { id: 'crystal_valley', name: '晶体峡谷',     danger: 2, distance: 2, biome: 'crystal',  rewardPool: { crystal: [4, 9] }, desc: '一条布满发光晶体的深谷，美丽而危险。' },
  { id: 'deep_forest',    name: '异星密林',     danger: 3, distance: 3, biome: 'forest',   rewardPool: { food: [6, 14] }, desc: '茂密的外星植被区域，生态系统复杂且未知。' },
  { id: 'volcano_rim',    name: '火山边缘',     danger: 4, distance: 3, biome: 'crater',   rewardPool: { metal: [8, 16], energy: [4, 12] }, desc: '活跃火山的边缘地带，高温高压但资源丰富。' },
  { id: 'signal_source',  name: '信号源',       danger: 5, distance: 4, biome: 'mountain', rewardPool: { research: [10, 20] }, desc: '神秘信号的发射源头，可能是外星文明的前哨站。' },
  { id: 'snow_frontier', name: '寒霜边界考察', difficulty: 3, distance: 3, biome: 'snow', days: 5, requiredExploration: 12, requiredSurvival: 3, supply: 'thermal_kit', rewardPool: { crystal: [8, 16], research: [5, 12], ice_core: [1, 3] }, desc: '记录寒霜原的生态循环与地下冰核。' },
  { id: 'desert_frontier', name: '赤沙边界考察', difficulty: 4, distance: 4, biome: 'desert', days: 6, requiredExploration: 14, requiredSurvival: 4, supply: 'cooling_kit', rewardPool: { metal: [12, 24], research: [6, 14], sun_crystal: [1, 3] }, desc: '调查赤沙地的昼夜温差与太阳晶体。' },
];

// ===== 随机考察任务模板 =====
export const RANDOM_EXPEDITION_TEMPLATES = {
  prefixes: ['废弃', '隐蔽', '荒芜', '神秘', '古老', '偏远', '幽暗', '崎岖', '风蚀', '冰封'],
  suffixes: ['矿洞', '营地', '峡谷', '丘陵', '盆地', '台地', '裂谷', '石林', '冰原', '沙丘'],
  descs: [
    '卫星扫描发现的异常区域，值得实地考察。',
    '一处未被记录的地形，可能蕴含资源。',
    '探测器回传了模糊的信号，需要派人确认。',
    '地质活动留下的痕迹，或许能找到有价值的矿物。',
    '一片从未涉足的区域，充满未知与可能。',
  ],
  // 按难度等级的奖励池配置
  rewardTiers: [
    { resources: ['metal', 'food'],              amounts: [3, 8],  bonus: ['crystal'],       bonusAmounts: [1, 3], bonusChance: 0.3 },
    { resources: ['metal', 'crystal', 'food'],    amounts: [5, 12], bonus: ['research'],      bonusAmounts: [2, 5], bonusChance: 0.4 },
    { resources: ['metal', 'crystal', 'energy'],  amounts: [8, 18], bonus: ['research'],      bonusAmounts: [4, 8], bonusChance: 0.5 },
    { resources: ['crystal', 'energy', 'research'], amounts: [10, 22], bonus: ['metal'],      bonusAmounts: [5, 10], bonusChance: 0.5 },
  ],
};

// ===== 地图拓展配置 =====
export const MAP_EXPANSION = {
  label: '地图拓展', icon: 'maximize', baseCost: { metal: 30, energy: 20 },
};

// ===== 季节配置 =====
export const SEASONS = [
  { id: 'spring', name: '星芽季', color: '#A8D8B9', effect: { food: 1.2 } },
  { id: 'summer', name: '烈阳季', color: '#FF8C42', effect: { energy: 1.3 } },
  { id: 'autumn', name: '收获季', color: '#F0C040', effect: { food: 1.1, research: 1.1 } },
  { id: 'winter', name: '寒霜季', color: '#4A90D9', effect: { energy: 0.8, comfort: -2 } },
];
