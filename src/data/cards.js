/**
 * 星尘殖民地 — 收集卡牌与环境牌数据
 * 不绑定具体居民，通过科技研究、探索掉落或 AI 动态生成解锁。
 * 支持多维属性、环境牌被动效果、费用、伤害与防御。
 */

// 通用卡牌（多维属性：主属性大幅提升，伴随副属性或负面代价权衡）
export const GENERAL_CARDS = [
  // 科技解锁类
  {
    id: 'card_tech_biotech',
    name: '基因催化',
    type: 'farming',
    cost: 1,
    damage: 6,
    block: 6,
    heal: 3,
    value: 6,
    stats: { farming: 6, survival: 2, engineering: -1 },
    icon: 'dna',
    desc: '造成 6 点伤害，获得 6 护盾，并恢复队伍 3 点生命值。',
    flavor: '生命总能在意料之外的角落发芽。',
    sourceTech: 'biotech_1',
  },
  {
    id: 'card_tech_shields',
    name: '应急力场',
    type: 'survival',
    cost: 1,
    damage: 0,
    block: 12,
    value: 6,
    stats: { survival: 6, engineering: 2, social: -1 },
    icon: 'shield',
    desc: '调动护盾发生器的残余电荷，生成 12 点强力护盾。',
    flavor: '最好的防护往往只需一瞬间的屏障。',
    sourceTech: 'shields',
  },
  {
    id: 'card_tech_sensors',
    name: '全景扫描',
    type: 'research',
    cost: 1,
    damage: 6,
    block: 4,
    draw: 2,
    value: 7,
    stats: { research: 7, survival: 1, combat: -2 },
    icon: 'radar',
    desc: '造成 6 点解析伤害，获 4 护盾，并额外抽 2 张牌。',
    flavor: '在杂波中捕捉真实。',
    sourceTech: 'sensors',
  },
  {
    id: 'card_tech_mountain',
    name: '爆破开路',
    type: 'engineering',
    cost: 2,
    damage: 18,
    block: 0,
    value: 7,
    stats: { engineering: 7, combat: 2, survival: -2 },
    icon: 'mountain',
    desc: '定向高能爆破，造成 18 点巨额重击伤害。',
    flavor: '没有铲不平的山，只有不够大的当量。',
    sourceTech: 'mountain_engineering',
  },
  {
    id: 'card_tech_culture',
    name: '同理共鸣',
    type: 'social',
    cost: 1,
    damage: 0,
    block: 8,
    weaken: 3, // 削弱敌方下回合攻击 3 点
    value: 7,
    stats: { social: 7, research: 2, combat: -2 },
    icon: 'sparkles',
    desc: '获得 8 护盾，并让敌方下回合攻击削弱 3 点。',
    flavor: '微笑在任何星系都不需要翻译器。',
    sourceTech: 'culture_2',
  },
  {
    id: 'card_tech_weapons',
    name: '战术威慑',
    type: 'combat',
    cost: 2,
    damage: 16,
    block: 5,
    value: 8,
    stats: { combat: 8, survival: 1, social: -3 },
    icon: 'zap',
    desc: '展示高能定向光束，造成 16 点打击并获 5 护盾。',
    flavor: '挥舞道场素振一千次的成果——至少看起来很唬人。',
    sourceTech: 'weapons_1',
  },

  // 探索掉落类（稀有古代遗物 / 外星装置）
  {
    id: 'card_drop_omni_wrench',
    name: '先驱万用扳手',
    type: 'engineering',
    cost: 1,
    damage: 8,
    block: 8,
    value: 8,
    stats: { engineering: 8, research: 3, farming: -1 },
    icon: 'wrench',
    desc: '多功能工程核心，造成 8 点伤害并获得 8 点护盾。',
    flavor: '即使过了几万年，拧螺丝的道理还是没变。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_signal_flare',
    name: '星火信号弹',
    type: 'survival',
    cost: 0,
    damage: 5,
    block: 0,
    draw: 1,
    value: 8,
    stats: { survival: 8, combat: 2, research: -1 },
    icon: 'flame',
    desc: '【0费】造成 5 点火焰伤害并抽 1 张牌。',
    flavor: '一朵在异星夜空中绽放的人造小太阳。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_xeno_treat',
    name: '星际小零食',
    type: 'social',
    cost: 1,
    damage: 0,
    block: 6,
    heal: 6,
    value: 8,
    stats: { social: 8, farming: 2, combat: -2 },
    icon: 'cookie',
    desc: '美味的甜品，获得 6 护盾并恢复 6 点队伍生命。',
    flavor: '没有什么分歧是一包草莓味合成糖解不开的。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_pulse_baton',
    name: '防暴电棍',
    type: 'combat',
    cost: 1,
    damage: 10,
    block: 4,
    value: 8,
    stats: { combat: 8, survival: 2, social: -2 },
    icon: 'swords',
    desc: '造成 10 点雷电伤害，并附带 4 点反震护盾。',
    flavor: '主要功能是吓唬二足行走的史莱姆。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_ancient_specimen',
    name: '远古琥珀样本',
    type: 'research',
    cost: 1,
    damage: 7,
    block: 0,
    energyGain: 1, // 额外获得 1 能量
    value: 8,
    stats: { research: 8, farming: 3, engineering: -1 },
    icon: 'flask-conical',
    desc: '造成 7 点伤害，并立即恢复 1 点行动能量。',
    flavor: '时间被封在了这片微光里。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_hydro_seed',
    name: '深根水培种',
    type: 'farming',
    cost: 1,
    damage: 8,
    block: 8,
    value: 8,
    stats: { farming: 8, survival: 3, combat: -1 },
    icon: 'sprout',
    desc: '瞬间萌发根系，造成 8 点伤害并获得 8 点护盾。',
    flavor: '只要有一滴水，它就能把石头变成花园。',
    sourceDrop: true,
  },
];

// 环境牌（探索遭遇时触发的全局环境状态，为对战双方带来场效应）
export const ENVIRONMENT_CARDS = [
  {
    id: 'env_ion_storm',
    name: '离子风暴',
    icon: 'zap',
    tileType: 'mountain',
    modifiers: { combat: 3, engineering: 2, survival: -2 },
    desc: '高能电离子充斥空间：所有攻击伤害 +3，但护盾效果 -2。',
    flavor: '空气中充斥着静电炸裂的焦糊味。',
  },
  {
    id: 'env_aurora_mist',
    name: '极光迷雾',
    icon: 'sparkles',
    tileType: 'aurora_canyon',
    modifiers: { social: 3, research: 2, energyMax: 1 },
    desc: '绚烂的极光磁场滋养神经：玩家初始能量 +1（4点能量），科研与社交卡牌效能提升。',
    flavor: '仿佛置身于整座星云的怀抱之中。',
  },
  {
    id: 'env_dense_fog',
    name: '湿地浓雾',
    icon: 'waves',
    tileType: 'river',
    modifiers: { farming: 3, healBonus: 2, combat: -1 },
    desc: '充沛的水汽与生机：每回合微量滋养，农耕与恢复卡效果 +2。',
    flavor: '连呼吸都带着甘甜的水草气息。',
  },
  {
    id: 'env_extreme_cold',
    name: '绝对零度严寒',
    icon: 'snowflake',
    tileType: 'snow',
    modifiers: { drawCount: 1, survival: -1 },
    desc: '极寒激发求生本能：每回合抽牌数 +1（抽 6 张），但护盾获取 -1。',
    flavor: '呼出的每一口气瞬间化为冰晶跌落。',
  },
  {
    id: 'env_magnetic_flux',
    name: '地磁紊乱',
    icon: 'radio',
    tileType: null,
    modifiers: { research: 3, engineering: -1, combat: 1 },
    desc: '奇异地磁场激发灵感：研究卡伤害 +3，攻击卡附带额外波动。',
    flavor: '所有罗盘都在疯狂地做圆周运动。',
  },
  {
    id: 'env_ancient_sanctuary',
    name: '先驱遗迹共鸣',
    icon: 'landmark',
    tileType: 'ruins',
    modifiers: { engineering: 3, research: 2, combat: 2 },
    desc: '古代遗迹能量发生器共振：队伍所有卡牌伤害与护盾全面 +2！',
    flavor: '那些斑驳的石柱仿佛还在脉动。',
  },
];

export function getGeneralCardById(id, state = null) {
  const predefined = GENERAL_CARDS.find((c) => c.id === id);
  if (predefined) return predefined;
  if (state?.cards?.dynamicCards) {
    const dynamic = state.cards.dynamicCards.find((c) => c.id === id);
    if (dynamic) return dynamic;
  }
  return null;
}

export function getEnvironmentCardById(id, state = null) {
  const predefined = ENVIRONMENT_CARDS.find((c) => c.id === id);
  if (predefined) return predefined;
  if (state?.cards?.dynamicEnvCards) {
    const dynamic = state.cards.dynamicEnvCards.find((c) => c.id === id);
    if (dynamic) return dynamic;
  }
  return null;
}

export function getCardsUnlockedByTech(techId) {
  return GENERAL_CARDS.filter((c) => c.sourceTech === techId);
}

export function getDroppableCards(unlockedCardIds = [], dynamicCards = []) {
  const owned = new Set(unlockedCardIds);
  const basePool = GENERAL_CARDS.filter((c) => c.sourceDrop && !owned.has(c.id));
  const dynamicPool = (dynamicCards || []).filter((c) => !owned.has(c.id));
  return [...basePool, ...dynamicPool];
}
