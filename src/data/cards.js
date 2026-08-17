/**
 * 星尘殖民地 — 收集卡牌数据（通用技能卡牌）
 * 不绑定具体居民，通过科技研究或探索掉落解锁，加入玩家的公共手牌池。
 */

export const GENERAL_CARDS = [
  // 科技解锁类
  {
    id: 'card_tech_biotech',
    name: '基因催化',
    type: 'farming',
    value: 6,
    icon: 'dna',
    desc: '借助基础生物工程的催化技术，快速应对生态与农耕需求。',
    flavor: '生命总能在意料之外的角落发芽。',
    sourceTech: 'biotech_1',
  },
  {
    id: 'card_tech_shields',
    name: '应急力场',
    type: 'survival',
    value: 6,
    icon: 'shield',
    desc: '调动护盾发生器的残余电荷，抵御恶劣环境冲击。',
    flavor: '最好的防护往往只需一瞬间的屏障。',
    sourceTech: 'shields',
  },
  {
    id: 'card_tech_sensors',
    name: '全景扫描',
    type: 'research',
    value: 7,
    icon: 'radar',
    desc: '利用高级传感器透视地层构造，解析未知环境数据。',
    flavor: '在杂波中捕捉真实。',
    sourceTech: 'sensors',
  },
  {
    id: 'card_tech_mountain',
    name: '爆破开路',
    type: 'engineering',
    value: 7,
    icon: 'mountain',
    desc: '运用山地工程的定向爆破方案化解地形阻碍。',
    flavor: '没有铲不平的山，只有不够大的当量。',
    sourceTech: 'mountain_engineering',
  },
  {
    id: 'card_tech_culture',
    name: '同理共鸣',
    type: 'social',
    value: 7,
    icon: 'sparkles',
    desc: '融合星际美学与心理学，与遭遇的生命体达成心智交流。',
    flavor: '微笑在任何星系都不需要翻译器。',
    sourceTech: 'culture_2',
  },
  {
    id: 'card_tech_weapons',
    name: '战术威慑',
    type: 'combat',
    value: 8,
    icon: 'zap',
    desc: '展示定向能光束进行非致命威慑，驱散潜伏的不明生物。',
    flavor: '挥舞道场素振一千次的成果——至少看起来很唬人。',
    sourceTech: 'weapons_1',
  },

  // 探索掉落类（稀有古遗物/开拓装备）
  {
    id: 'card_drop_omni_wrench',
    name: '先驱万用扳手',
    type: 'engineering',
    value: 8,
    icon: 'wrench',
    desc: '从古代遗迹中挖掘出的多功能工程核心，能自适应各种机械规格。',
    flavor: '即使过了几万年，拧螺丝的道理还是没变。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_signal_flare',
    name: '星火信号弹',
    type: 'survival',
    value: 8,
    icon: 'flame',
    desc: '高亮度广谱信号弹，照亮昏暗地穴并指引返回路线。',
    flavor: '一朵在异星夜空中绽放的人造小太阳。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_xeno_treat',
    name: '星际小零食',
    type: 'social',
    value: 8,
    icon: 'cookie',
    desc: '据说对银河系90%的智慧生命都具备无法抗拒的吸引力。',
    flavor: '没有什么分歧是一包草莓味合成糖解不开的。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_pulse_baton',
    name: '防暴电棍',
    type: 'combat',
    value: 8,
    icon: 'swords',
    desc: '标准殖民安保配备，挥舞时伴随噼啪声，气势十足。',
    flavor: '主要功能是吓唬二足行走的史莱姆。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_ancient_specimen',
    name: '远古琥珀样本',
    type: 'research',
    value: 8,
    icon: 'flask-conical',
    desc: '凝固了异星史前生态的结晶体，具备极高的科学分析价值。',
    flavor: '时间被封在了这片微光里。',
    sourceDrop: true,
  },
  {
    id: 'card_drop_hydro_seed',
    name: '深根水培种',
    type: 'farming',
    value: 8,
    icon: 'sprout',
    desc: '能在极端贫瘠土壤中瞬间萌发并固化地面的转基因种子。',
    flavor: '只要有一滴水，它就能把石头变成花园。',
    sourceDrop: true,
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

export function getCardsUnlockedByTech(techId) {
  return GENERAL_CARDS.filter((c) => c.sourceTech === techId);
}

export function getDroppableCards(unlockedCardIds = [], dynamicCards = []) {
  const owned = new Set(unlockedCardIds);
  const basePool = GENERAL_CARDS.filter((c) => c.sourceDrop && !owned.has(c.id));
  const dynamicPool = (dynamicCards || []).filter((c) => !owned.has(c.id));
  return [...basePool, ...dynamicPool];
}
