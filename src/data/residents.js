/**
 * 星尘殖民地 — 居民数据
 * 3 initial residents + generation helpers
 */

export const GRAVITY_DIMS = ['food', 'knowledge', 'comfort', 'adventure', 'culture', 'nature'];

export const GRAVITY_LABELS = {
  food:      '食物',
  knowledge: '知识',
  comfort:   '舒适',
  adventure: '冒险',
  culture:   '文化',
  nature:    '自然',
};

export const INITIAL_RESIDENTS = [
  {
    id: 'res_001',
    name: '陈星河',
    title: '首席工程师',
    icon: 'wrench',
    level: 3,
    traits: ['勤劳', '理性', '夜猫子'],
    gravityPreference: { food: 3, knowledge: 7, comfort: 4, adventure: 5, culture: 2, nature: 3 },
    skills: { engineering: 8, research: 5, farming: 2, combat: 3, social: 4, survival: 6 },
    mood: 72,
    diary: [
      '第1天：着陆成功。这颗星球的日落是紫色的，比模拟器里美多了。',
      '第3天：开始搭建第一个居住舱。金属框架在低重力下很好焊接。',
      '第7天：夜里听到了奇怪的共振声。可能是地质活动，也可能是……别的什么。',
    ],
  },
  {
    id: 'res_002',
    name: '林月华',
    title: '生物学家',
    icon: 'leaf',
    level: 2,
    traits: ['好奇', '温柔', '素食主义'],
    gravityPreference: { food: 5, knowledge: 6, comfort: 3, adventure: 4, culture: 4, nature: 8 },
    skills: { engineering: 2, research: 7, farming: 8, combat: 1, social: 6, survival: 4 },
    mood: 68,
    diary: [
      '第1天：土壤样本分析完成。矿物质含量出乎意料地丰富。',
      '第4天：在岩缝中发现了类似苔藓的生物！这里有生命！',
      '第8天：给"苔藓"取名叫小绿。它似乎会朝着光源移动。',
    ],
  },
  {
    id: 'res_003',
    name: '赵铁柱',
    title: '安保队长',
    icon: 'shield',
    level: 4,
    traits: ['勇敢', '忠诚', '怀旧'],
    gravityPreference: { food: 6, knowledge: 2, comfort: 5, adventure: 8, culture: 3, nature: 2 },
    skills: { engineering: 4, research: 1, farming: 3, combat: 9, social: 5, survival: 8 },
    mood: 65,
    diary: [
      '第1天：周边安全检查完毕。没有发现直接威胁，但保持警惕。',
      '第5天：设置了三个观察哨。这片区域的地形比预想的复杂。',
      '第9天：今晚看到了三个月亮同时升起。想起了地球的月亮。',
    ],
  },
];

export const RESIDENT_NAME_POOL = [
  '王星辰', '李云帆', '张晓宇', '刘天行', '杨雨桐',
  '黄思远', '周明月', '吴海风', '郑子墨', '孙若水',
  '何晨曦', '马飞扬', '朱清河', '胡星野', '高远山',
];

export const TRAIT_POOL = [
  '乐观', '悲观', '勤劳', '懒散', '好奇', '谨慎',
  '勇敢', '胆小', '社交达人', '独行侠', '夜猫子', '早起鸟',
  '素食主义', '美食家', '工作狂', '享乐主义', '理性', '感性',
  '怀旧', '未来主义', '完美主义', '随遇而安', '忠诚', '自由散漫',
];

export function getResidentById(id, residents) {
  return residents.find(r => r.id === id);
}

export function getMoodLabel(mood) {
  if (mood >= 80) return '愉悦';
  if (mood >= 60) return '平静';
  if (mood >= 40) return '焦虑';
  if (mood >= 20) return '低落';
  return '崩溃';
}

export function getMoodColor(mood) {
  if (mood >= 80) return '#2ECC71';
  if (mood >= 60) return '#A8D8B9';
  if (mood >= 40) return '#F39C12';
  if (mood >= 20) return '#E67E22';
  return '#E74C3C';
}

/**
 * 生成一名随机新居民（手动招募用）。
 * @param {number} day 当前游戏天数
 * @param {number} index 用于生成稳定 id 的序号
 */
export function createRandomResident(day, index) {
  const name = RESIDENT_NAME_POOL[Math.floor(Math.random() * RESIDENT_NAME_POOL.length)];
  const traits = [];
  const traitCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < traitCount; i++) {
    const t = TRAIT_POOL[Math.floor(Math.random() * TRAIT_POOL.length)];
    if (!traits.includes(t)) traits.push(t);
  }

  return {
    id: `res_${String(index).padStart(3, '0')}`,
    name,
    title: '殖民者',
    icon: 'user',
    level: 1,
    traits,
    gravityPreference: {
      food: 3 + Math.floor(Math.random() * 5),
      knowledge: 2 + Math.floor(Math.random() * 5),
      comfort: 3 + Math.floor(Math.random() * 4),
      adventure: 2 + Math.floor(Math.random() * 5),
      culture: 2 + Math.floor(Math.random() * 4),
      nature: 2 + Math.floor(Math.random() * 5),
    },
    skills: {
      engineering: 1 + Math.floor(Math.random() * 4),
      research: 1 + Math.floor(Math.random() * 4),
      farming: 1 + Math.floor(Math.random() * 4),
      combat: 1 + Math.floor(Math.random() * 4),
      social: 1 + Math.floor(Math.random() * 4),
      survival: 1 + Math.floor(Math.random() * 4),
    },
    xp: 0,
    stamina: 10,
    labor: 10,
    exploration: 10,
    proficiency: { engineering: 0, research: 0, farming: 0, social: 0, survival: 0 },
    housingStage: 1,
    growthLog: [],
    mood: 70,
    diary: [`第${day}天：我来到了星尘殖民地，这里将是我的新家。`],
  };
}
