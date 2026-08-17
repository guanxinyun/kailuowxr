/**
 * 星尘殖民地 — 事件 + 物品 + 组合 + 地图瓦片
 */

// ===== 随机与教程剧情事件 =====
export const EVENTS = [
  // --- 初始教程剧情事件链（开罗风：引导探索、基建、生活与打工人心声） ---
  {
    id: 'tutorial_event_1_landing',
    name: '【快讯】殖民飞船安稳着陆',
    type: 'discovery',
    icon: 'rocket',
    narrative: '弊誌星际特派员报道：殖民飞船已成功迫降！工程组长擦了擦汗表示：“虽然底盘摩擦声有点刺耳，但降落伞好歹打开了！”居民们一边清点行李一边询问何时开饭。',
    choices: [
      { text: '发放应急口粮包', effect: { food: 10, happiness: 5 }, result: '居民们嚼着草莓味合成口粮，纷纷表示“只要管饭一切都好说”。' },
      { text: '立即展开基础采矿勘探', effect: { metal: 15, research: 5 }, result: '大家抄起铁镐热火朝天地敲起了碎石，虽然有人抱怨手腕酸痛。' },
    ],
    weight: 100,
    minDay: 1,
    tutorial: true,
  },
  {
    id: 'tutorial_event_2_housing',
    name: '【民生】关于买房与摸鱼的调查',
    type: 'science',
    icon: 'home',
    narrative: '弊誌记者走访发现，居民们对生活品质提出了明确诉求：“每天在帐篷里数外星流星固然浪漫，但如果能有一栋自带恒温浴缸的居住舱就更妙了！”若不及时满足，恐有消极怠工倾向。',
    choices: [
      { text: '许诺优先扩建优质居所', effect: { happiness: 6 }, result: '居民们干劲大增，甚至主动把工具箱擦拭得锃亮。' },
      { text: '分发自热提神热饮', effect: { energy: 10, food: -2 }, result: '热饮效果拔群，大家红着眼睛连夜画出了三张温室设计图。' },
    ],
    weight: 90,
    minDay: 3,
    tutorial: true,
  },
  {
    id: 'tutorial_event_3_alien_flora',
    name: '【特产】会掰手腕的异星杏鲍菇',
    type: 'exploration',
    icon: 'sprout',
    narrative: '开拓小队在附近灌木丛中发现了一株突然变异后擅自越狱的野生杏鲍菇，据说它刚刚在生态区腕力大赛中荣获了亚军。队员们正围着它啧啧称奇。',
    choices: [
      { text: '带回水培实验室培育', effect: { research: 8, food: 6 }, result: '实验室成功提取了高能营养因子，杏鲍菇表示在培养槽里过得很惬意。' },
      { text: '与它握手并拍照留念', effect: { culture: 4, happiness: 5 }, result: '合影被裱起来挂在降落点外墙，成为了殖民地的首个特色景点。' },
    ],
    weight: 80,
    minDay: 5,
    tutorial: true,
  },

  // --- 原生开罗风随机事件 ---
  {
    id: 'meteor_shower',
    name: '【快讯】流星雨突袭与捡漏现场',
    type: 'disaster',
    icon: 'flame',
    narrative: '深空雷达通报：一场高密度流星雨正朝殖民地袭来！不过居民们看起来并不慌张，甚至有人已经提着自制铁桶准备去捡坠落的高能矿石。',
    choices: [
      { text: '启动护盾全力防御', effect: { energy: -20 }, result: '护盾成功弹开了大部分流星碎块，虽然电表走得令人心惊肉跳。' },
      { text: '疏散居民进安全区', effect: { happiness: -3 }, result: '所有人安全撤离，大家聚在一起吃了顿简易火锅。' },
      { text: '组织小队去捡发光碎块', effect: { crystal: 15, happiness: -2 }, result: '满载而归！虽然有位队员被飞溅的烫土烧破了裤脚。' },
    ],
    weight: 10,
    minDay: 10,
  },
  {
    id: 'alien_signal',
    name: '【奇闻】外星邻居的质数电报',
    type: 'discovery',
    icon: 'radio',
    narrative: '通讯阵列截获了一段极有规律的脉冲信号。科研所长戴上老花镜严肃分析：“对方似乎是在用质数打拍子，或者是在用摩斯电码点外卖。”',
    choices: [
      { text: '尝试用数学公式回复', effect: { research: 10 }, result: '回复发送后，对方发来了一串欢快的波形，似乎达成了学术默契！' },
      { text: '回复友好的星际问候', effect: { diplomacy: 5 }, result: '对方送来了一串由微波绘制的笑脸符号。' },
      { text: '保持警惕，加固天线', effect: { defense: 3 }, result: '你把天线底座多拧了三颗螺丝，感觉踏实多了。' },
    ],
    weight: 8,
    minDay: 15,
  },
  {
    id: 'crop_mutation',
    name: '【农情】荧光发光作物的奇迹',
    type: 'science',
    icon: 'sprout',
    narrative: '水培农场里的一批番茄突然通体发出荧光，生长速度飙升三倍！农场主管兴奋地表示：“以后夜班连路灯电费都省了！”',
    choices: [
      { text: '隔离切片深入分析', effect: { research: 8, food: -2 }, result: '研究证实这是一种无害的良性共生，科研成果喜人。' },
      { text: '作为特产端上餐桌', effect: { food: 12 }, result: '居民们纷纷表示吃完后心情格外明亮，甚至能在黑夜里看书。' },
      { text: '稳妥处理，制成观赏盆栽', effect: { culture: 4, food: 2 }, result: '发光盆栽大受欢迎，摆满了生活区的各个角落。' },
    ],
    weight: 12,
    minDay: 8,
  },
  {
    id: 'dust_storm',
    name: '【气象】星尘微粒大扫除',
    type: 'disaster',
    icon: 'wind',
    narrative: '一场富含稀有金属微粒的星尘风暴掠过地表。空气过滤网被糊得严严实实，维修工提着自来水管叹气道：“这下有的刷了。”',
    choices: [
      { text: '停机闭门等待风暴停歇', effect: { energy: -12, food: -3 }, result: '风暴过后一切如常，大家拿出扫帚清扫门前沙尘。' },
      { text: '组织戴防尘面罩抢收粉末', effect: { research: 5, crystal: 6 }, result: '从滤网里刮出了不少值钱的高能微粒，大家都夸维修工立了大功！' },
    ],
    weight: 8,
    minDay: 20,
  },
  {
    id: 'trader_visit',
    name: '【商情】星际游商与神秘推销',
    type: 'trade',
    icon: 'package',
    narrative: '一艘涂满花哨广告的飞船停泊在近地轨道。船长热情地推销：“来自仙女座最高级的棉花与老奶奶智慧结晶，走过路过不要错过！”',
    choices: [
      { text: '用富余金属换取晶体', effect: { metal: -30, crystal: 20 }, result: '交易达成！商人还额外赠送了一把号称拧不坏的螺丝刀。' },
      { text: '用农场鲜果换取技术手册', effect: { food: -20, research: 15 }, result: '换到了一本《三分钟掌握星际微操作技巧》，科研人员如获至宝。' },
      { text: '礼貌摆手并说“下次一定”', effect: { defense: 2 }, result: '商人耸了耸肩，播放着洗脑的促销音乐飞走了。' },
    ],
    weight: 6,
    minDay: 25,
  },
  {
    id: 'aurora',
    name: '【盛景】极光野餐与大合唱',
    type: 'wonder',
    icon: 'rainbow',
    narrative: '天空中拉开了绚丽的极光帷幕。居民们自发搬出折叠椅，有人甚至开始弹起土制尤克里里，唱起了荒腔走板的思乡曲。',
    choices: [
      { text: '举办全员露天茶话会', effect: { happiness: 10, culture: 4 }, result: '虽然有人唱歌跑调跑到邻座星系，但大家的笑声响彻了夜空。' },
      { text: '架设光谱仪趁机采集数据', effect: { research: 8 }, result: '记录到了罕见的高空带电粒子流，科研笔记又厚了三页。' },
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
    name: '休眠救生舱',
    type: 'exploration',
    icon: 'users',
    narrative: '探索队在殖民地边缘发现了一艘受损的深空救生舱，生命维持系统已处于警戒线，舱内是一名陷入休眠的开拓者。',
    choices: [
      { text: '支付 60 星币救治并接纳', effect: { credits: -60, recruit: 1 }, result: '经过悉心医疗唤醒，新开拓者脱离危险并感激地加入了殖民地！' },
      { text: '提供基础应急能源后送往太空站', effect: { energy: -10, happiness: 2 }, result: '你补充了救生舱能量。虽然未能吸纳人口，但人道关怀让殖民地居民感到踏实。' },
    ],
    weight: 6,
    minDay: 5,
  },
];

// ===== 地图瓦片类型 =====
export const TILE_TYPES = {
  plains:    { name: '平原',   color: '#1a2a1a', buildable: true,  icon: null },
  mountain:  { name: '山脉',   color: '#2a2a3a', buildable: false, icon: 'mountain', techUnlock: 'mountain_engineering' },
  water:     { name: '液态湖', color: '#0a1a3a', buildable: false, icon: 'droplets', techUnlock: 'water_engineering' },
  river:     { name: '流光河', color: '#00d2d3', buildable: false, icon: 'waves', techUnlock: 'water_engineering', attraction: 8 },
  crystal:   { name: '晶矿',   color: '#2a1a3a', buildable: true,  icon: 'gem', resource: 'crystal' },
  metal:     { name: '矿脉',   color: '#2a2a2a', buildable: true,  icon: 'pickaxe', resource: 'metal' },
  ruins:     { name: '遗迹',   color: '#1a1a2a', buildable: false, icon: 'landmark', explorable: true },
  crater:    { name: '陨石坑', color: '#1a1a1a', buildable: false, icon: 'circle-dot' },
  forest:    { name: '异星林', color: '#0a2a1a', buildable: true,  icon: 'trees', resource: 'nature' },
  snow:      { name: '寒霜原', color: '#b8d8e8', buildable: true,  icon: 'snowflake', resource: 'ice_core' },
  desert:    { name: '赤沙地', color: '#b87a38', buildable: true,  icon: 'sun', resource: 'sun_crystal' },
  // ===== 天然奇观/景点地块 =====
  hotspring: { name: '星光温泉', color: '#48dbfb', buildable: false, icon: 'waves', explorable: true, attraction: 15, scenic: true },
  monolith:  { name: '异星巨石阵', color: '#a55eea', buildable: false, icon: 'shield-alert', explorable: true, attraction: 18, scenic: true },
  aurora_canyon: { name: '极光大峡谷', color: '#10ac84', buildable: false, icon: 'mountain-snow', explorable: true, attraction: 20, scenic: true },
};

/** 地形产出加成：特定建筑在特定地形上的产出乘数 */
export const TERRAIN_BONUSES = {
  mountain: { mine: 1.5, observatory: 1.4, radar: 1.3 },
  water:    { hydro_farm: 1.4, algae_reactor: 1.5, solar_panel: 1.2, float_fountain: 1.5 },
  crystal:  { crystal_extractor: 1.4, holo_wheel: 1.3 },
  metal:    { mine: 1.3 },
  forest:   { greenhouse: 1.3, hydro_farm: 1.2, bio_tower: 1.4 },
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
