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

  // ===== 群落组合（3-5栋） =====
  {
    id: 'research_campus',
    name: '星际学术园区',
    icon: 'graduation-cap',
    buildingIds: ['lab', 'observatory', 'radar'],
    maxDistance: 3,
    description: '实验室、天文台和雷达站组成完整的科研集群，数据共享加速突破。',
    effects: [
      { type: 'building_output', buildingIds: ['lab', 'observatory', 'radar'], resource: 'research', multiplier: 1.35 },
    ],
    effectText: '参与设施研究产量 +35%',
  },
  {
    id: 'food_district',
    name: '丰收谷',
    icon: 'wheat',
    buildingIds: ['hydro_farm', 'greenhouse', 'algae_reactor'],
    maxDistance: 3,
    description: '三种农业设施互补，形成高效的食物生产生态圈。',
    effects: [
      { type: 'building_output', buildingIds: ['hydro_farm', 'greenhouse', 'algae_reactor'], resource: 'food', multiplier: 1.35 },
    ],
    effectText: '参与设施食物产量 +35%',
  },
  {
    id: 'industrial_complex',
    name: '重工业联合体',
    icon: 'anvil',
    buildingIds: ['mine', 'workshop', 'solar_panel'],
    maxDistance: 3,
    description: '矿站供料、太阳能供电、工坊加工，一条龙产业链。',
    effects: [
      { type: 'production_speed', multiplier: 1.35 },
      { type: 'production_quality', bonus: 12 },
      { type: 'building_output', buildingIds: ['mine'], resource: 'metal', multiplier: 1.15 },
    ],
    effectText: '加工速度 +35%，品质分 +12，矿站金属 +15%',
  },
  {
    id: 'tourism_boulevard',
    name: '星尘大道',
    icon: 'map-pin',
    buildingIds: ['plaza', 'museum', 'concert_hall', 'monument'],
    maxDistance: 4,
    description: '广场、博物馆、音乐厅和纪念碑串联成壮观的旅游景观带。',
    effects: [
      { type: 'tourism_attraction', buildingIds: ['plaza', 'museum', 'concert_hall', 'monument'], multiplier: 1.5 },
    ],
    effectText: '参与设施旅游吸引力 +50%',
  },
  {
    id: 'self_sustaining_colony',
    name: '自给自足殖民地',
    icon: 'globe',
    buildingIds: ['hydro_farm', 'mine', 'solar_panel', 'workshop', 'trade_hub'],
    maxDistance: 5,
    description: '农业、采矿、能源、加工和贸易齐备，殖民地迈向独立运营。',
    effects: [
      { type: 'building_output', resource: 'food', multiplier: 1.15 },
      { type: 'building_output', resource: 'metal', multiplier: 1.15 },
      { type: 'building_output', resource: 'energy', multiplier: 1.15 },
      { type: 'production_speed', multiplier: 1.2 },
    ],
    effectText: '全局食物/金属/能量 +15%，加工速度 +20%',
  },
];

export function getBuildingCombo(id) {
  return BUILDING_COMBOS.find((combo) => combo.id === id) || null;
}
