/**
 * 星尘殖民地 — 外星种族数据
 * 4 alien species with gravity preferences and diplomacy tiers
 */

export const SPECIES = [
  {
    id: 'squid',
    name: '虹吸水母族',
    homeworld: '液态甲烷海洋 · 天鹅座α-7',
    icon: 'waves',
    color: '#FF7B9C',
    lore: '一种生活在液态甲烷海洋中的群体智慧生物。它们通过生物发光进行交流，每个个体都是群体意识的一部分。虹吸水母族对艺术和音乐有着近乎痴迷的热爱，认为美是宇宙的终极真理。',
    trait: '群体意识 · 生物发光交流',
    personality: '友善但难以理解',
    gravityPreference: { culture: 8, nature: 6, comfort: 5, food: 3, knowledge: 4, adventure: 2 },
    tiers: [
      { level: 20, name: '初次接触', reward: '解锁生物发光染料贸易' },
      { level: 50, name: '文化交流', reward: '获得水母族音乐数据库' },
      { level: 80, name: '深层共鸣', reward: '共享群体意识网络片段' },
    ],
    funfact: '虹吸水母族没有"个人"的概念——它们的语言中甚至没有"我"这个词。',
    initialReputation: 15,
  },
  {
    id: 'crystal',
    name: '晶体共鸣者',
    homeworld: '硅基结晶行星 · 猎户座β-12',
    icon: 'gem',
    color: '#C8BFE7',
    lore: '由活性晶体构成的硅基生命体，通过振动频率进行思考和交流。它们的文明已存在数十亿年，积累了海量的知识和技术。晶体共鸣者对时间有着完全不同的感知——对它们来说，一千年不过是一次短暂的沉思。',
    trait: '硅基生命 · 振动频率交流',
    personality: '古老而睿智，极度耐心',
    gravityPreference: { knowledge: 9, nature: 5, comfort: 4, culture: 3, food: 1, adventure: 1 },
    tiers: [
      { level: 25, name: '频率校准', reward: '获得晶体谐振技术' },
      { level: 55, name: '知识共享', reward: '研究速度+20%' },
      { level: 85, name: '意识融合', reward: '解锁晶体计算矩阵' },
    ],
    funfact: '晶体共鸣者的"婴儿"需要一百万年才能完成第一次"思考"。',
    initialReputation: 10,
  },
  {
    id: 'mecha',
    name: '铁骑军团',
    homeworld: '工业废墟星 · 半人马座γ-3',
    icon: 'cog',
    color: '#7F8C8D',
    lore: '一个完全由机械生命体组成的文明。它们的创造者早已灭绝，但铁骑军团继续执行着最后的指令：生存和扩张。尽管外表冰冷，它们发展出了独特的"效率美学"，认为完美的功能就是最高形式的美。',
    trait: '机械生命 · 效率至上',
    personality: '逻辑严密，重视契约',
    gravityPreference: { adventure: 7, knowledge: 6, food: 1, comfort: 2, culture: 3, nature: 1 },
    tiers: [
      { level: 20, name: '协议建立', reward: '解锁机械零件贸易' },
      { level: 50, name: '技术互换', reward: '建造速度+15%' },
      { level: 80, name: '联盟协定', reward: '获得军团防御协议' },
    ],
    funfact: '铁骑军团至今仍在执行创造者留下的最后一条指令："不要忘记星星的样子。"',
    initialReputation: 5,
  },
  {
    id: 'flora',
    name: '星芽网络',
    homeworld: '巨型菌丝星球 · 织女座δ-9',
    icon: 'flower-2',
    color: '#A8D8B9',
    lore: '一个覆盖整颗星球的巨型菌丝网络，每一株植物都是这个超级有机体的一部分。星芽网络通过化学信号进行"思考"，速度极慢但深度惊人。它们对生态平衡有着近乎宗教般的执着。',
    trait: '菌丝网络 · 化学信号交流',
    personality: '温和缓慢，极度重视生态',
    gravityPreference: { nature: 9, food: 7, comfort: 4, knowledge: 3, culture: 2, adventure: 1 },
    tiers: [
      { level: 15, name: '根系触碰', reward: '获得星芽种子（装饰）' },
      { level: 45, name: '共生关系', reward: '农场产出+25%' },
      { level: 75, name: '网络融合', reward: '解锁生态修复技术' },
    ],
    funfact: '星芽网络做一个"决定"平均需要三个地球年——但它们从未做过错误的决定。',
    initialReputation: 20,
  },
];

export function getSpeciesById(id) {
  return SPECIES.find(s => s.id === id);
}
