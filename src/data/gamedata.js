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
];

// ===== 地图瓦片类型 =====
export const TILE_TYPES = {
  plains:    { name: '平原',   color: '#1a2a1a', buildable: true,  icon: null },
  mountain:  { name: '山脉',   color: '#2a2a3a', buildable: false, icon: 'mountain' },
  water:     { name: '液态湖', color: '#0a1a3a', buildable: false, icon: 'droplets' },
  crystal:   { name: '晶矿',   color: '#2a1a3a', buildable: true,  icon: 'gem', resource: 'crystal' },
  metal:     { name: '矿脉',   color: '#2a2a2a', buildable: true,  icon: 'pickaxe', resource: 'metal' },
  ruins:     { name: '遗迹',   color: '#1a1a2a', buildable: false, icon: 'landmark', explorable: true },
  crater:    { name: '陨石坑', color: '#1a1a1a', buildable: false, icon: 'circle-dot' },
  forest:    { name: '异星林', color: '#0a2a1a', buildable: true,  icon: 'trees', resource: 'nature' },
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

// ===== 探索区域 =====
export const EXPLORE_REGIONS = [
  { id: 'nearby_caves',   name: '近地洞穴群',   danger: 1, distance: 1, rewards: ['metal', 'crystal'], desc: '殖民地附近的天然洞穴系统，可能蕴含矿物资源。' },
  { id: 'ancient_ruins',  name: '远古遗迹',     danger: 2, distance: 2, rewards: ['research', 'artifact'], desc: '卫星扫描发现的异常结构，似乎是某个古老文明的遗迹。' },
  { id: 'crystal_valley', name: '晶体峡谷',     danger: 2, distance: 2, rewards: ['crystal'], desc: '一条布满发光晶体的深谷，美丽而危险。' },
  { id: 'deep_forest',    name: '异星密林',     danger: 3, distance: 3, rewards: ['nature', 'food'], desc: '茂密的外星植被区域，生态系统复杂且未知。' },
  { id: 'volcano_rim',    name: '火山边缘',     danger: 4, distance: 3, rewards: ['metal', 'energy'], desc: '活跃火山的边缘地带，高温高压但资源丰富。' },
  { id: 'signal_source',  name: '信号源',       danger: 5, distance: 4, rewards: ['research', 'contact'], desc: '神秘信号的发射源头，可能是外星文明的前哨站。' },
];

// ===== 季节配置 =====
export const SEASONS = [
  { id: 'spring', name: '星芽季', color: '#A8D8B9', effect: { food: 1.2 } },
  { id: 'summer', name: '烈阳季', color: '#FF8C42', effect: { energy: 1.3 } },
  { id: 'autumn', name: '收获季', color: '#F0C040', effect: { food: 1.1, research: 1.1 } },
  { id: 'winter', name: '寒霜季', color: '#4A90D9', effect: { energy: 0.8, comfort: -2 } },
];
