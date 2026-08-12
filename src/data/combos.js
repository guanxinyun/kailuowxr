export const BUILDING_COMBOS = [
  {
    id: 'green_cycle',
    name: '绿意循环',
    icon: 'sprout',
    buildingIds: ['hydro_farm', 'greenhouse'],
    maxDistance: 2,
    description: '水培农场与生态温室交换营养液和育种成果。',
    effects: [
      { type: 'building_output', buildingIds: ['hydro_farm', 'greenhouse'], resource: 'food', multiplier: 1.2 },
    ],
    effectText: '参与设施食物产量 +20%',
  },
  {
    id: 'industrial_symbiosis',
    name: '工业共生',
    icon: 'factory',
    buildingIds: ['mine', 'workshop'],
    maxDistance: 2,
    description: '采出的矿料直接送进工坊，减少搬运和重复筛选。',
    effects: [
      { type: 'production_speed', multiplier: 1.2 },
      { type: 'production_quality', bonus: 8 },
    ],
    effectText: '加工速度 +20%，品质分 +8',
  },
  {
    id: 'skyward_thought',
    name: '仰望者联盟',
    icon: 'telescope',
    buildingIds: ['lab', 'observatory'],
    maxDistance: 2,
    description: '实验室将天文观测数据快速转化为可验证的研究课题。',
    effects: [
      { type: 'building_output', buildingIds: ['lab', 'observatory'], resource: 'research', multiplier: 1.2 },
    ],
    effectText: '参与设施研究产量 +20%',
  },
  {
    id: 'culture_walk',
    name: '星尘文化步道',
    icon: 'landmark',
    buildingIds: ['plaza', 'museum'],
    maxDistance: 2,
    description: '游客从广场自然步入博物馆，形成轻松完整的参观路线。',
    effects: [
      { type: 'tourism_attraction', buildingIds: ['plaza', 'museum'], multiplier: 1.25 },
    ],
    effectText: '参与设施旅游吸引力 +25%',
  },
];

export function getBuildingCombo(id) {
  return BUILDING_COMBOS.find((combo) => combo.id === id) || null;
}
