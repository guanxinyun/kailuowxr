export const PRODUCT_QUALITY = [
  { min: 0, grade: 'D', label: '勉强可用', color: '#9aa0aa' },
  { min: 25, grade: 'C', label: '合格', color: '#76b7d8' },
  { min: 45, grade: 'B', label: '良好', color: '#7bd88f' },
  { min: 65, grade: 'A', label: '优秀', color: '#d8c46a' },
  { min: 85, grade: 'S', label: '星尘级', color: '#e49cff' },
];

export const PRODUCTION_RECIPES = [
  {
    id: 'alloy',
    name: '星尘合金',
    category: 'processed',
    icon: 'layers-3',
    desc: '将金属和能量压制成更耐用的建筑材料。',
    inputs: { metal: 12, energy: 4 },
    output: { id: 'alloy', name: '星尘合金', quantity: 1 },
    days: 2,
    requiredBuilding: 'workshop',
  },
  {
    id: 'crystal_circuit',
    name: '晶体电路',
    category: 'processed',
    icon: 'cpu',
    desc: '用晶体和能量制作精密控制组件。',
    inputs: { crystal: 3, energy: 8 },
    output: { id: 'crystal_circuit', name: '晶体电路', quantity: 1 },
    days: 3,
    requiredBuilding: 'workshop',
  },
  {
    id: 'nutrient_pack',
    name: '营养补给包',
    category: 'goods',
    icon: 'package',
    desc: '便于远行携带的标准化食物补给。',
    inputs: { food: 10, energy: 2 },
    output: { id: 'nutrient_pack', name: '营养补给包', quantity: 2 },
    days: 2,
    requiredBuilding: 'workshop',
  },
  {
    id: 'energy_cell',
    name: '能量电池',
    category: 'processed',
    icon: 'battery-charging',
    desc: '浓缩能量单元，可用于建造和交易。',
    inputs: { energy: 15, metal: 3 },
    output: { id: 'energy_cell', name: '能量电池', quantity: 2 },
    days: 2,
    requiredBuilding: 'workshop',
  },
  {
    id: 'bio_sample',
    name: '生态标本',
    category: 'goods',
    icon: 'leaf',
    desc: '珍贵的异星生态样本，科研和旅游价值兼具。',
    inputs: { food: 8, crystal: 2 },
    output: { id: 'bio_sample', name: '生态标本', quantity: 1 },
    days: 3,
    requiredBuilding: 'workshop',
  },
  {
    id: 'thermal_kit',
    name: '保温考察包',
    category: 'supplies',
    icon: 'snowflake',
    desc: '寒霜原和平考察所需的保温衣物、热源和记录工具。',
    inputs: { alloy: 1, nutrient_pack: 1, energy: 6 },
    output: { id: 'thermal_kit', name: '保温考察包', quantity: 1 },
    days: 3,
    requiredBuilding: 'workshop',
    requiresBlueprint: true,
  },
  {
    id: 'cooling_kit',
    name: '降温考察包',
    category: 'supplies',
    icon: 'sun',
    desc: '赤沙地和平考察所需的循环冷却服、遮光棚和记录工具。',
    inputs: { alloy: 1, crystal_circuit: 1, energy: 8 },
    output: { id: 'cooling_kit', name: '降温考察包', quantity: 1 },
    days: 4,
    requiredBuilding: 'workshop',
    requiresBlueprint: true,
  },
  {
    id: 'star_souvenir',
    name: '星尘纪念品',
    category: 'goods',
    icon: 'gift',
    desc: '游客喜欢带回母星的小礼物，可提升旅游消费。',
    inputs: { alloy: 1, crystal_circuit: 1 },
    output: { id: 'star_souvenir', name: '星尘纪念品', quantity: 1 },
    days: 3,
    requiredBuilding: 'workshop',
    requiresBlueprint: true,
  },

  // ===== 2级深度加工（由量子精密合成仪生产） =====
  {
    id: 'quantum_matrix',
    name: '量子运算矩阵',
    tier: 2,
    category: 'processed',
    icon: 'cpu',
    desc: '将晶体电路与星尘合金深度重构的微观运算核心，广泛用于尖端研发。',
    inputs: { crystal_circuit: 2, alloy: 1, energy: 10 },
    output: { id: 'quantum_matrix', name: '量子运算矩阵', quantity: 1 },
    days: 4,
    requiredBuilding: 'quantum_assembler',
  },
  {
    id: 'plasma_battery',
    name: '等离子压缩电池',
    tier: 2,
    category: 'processed',
    icon: 'battery-charging',
    desc: '通过微观约束场将普通能量电池加压封装，蓄能密度提升十倍。',
    inputs: { energy_cell: 2, alloy: 1, crystal: 5 },
    output: { id: 'plasma_battery', name: '等离子压缩电池', quantity: 1 },
    days: 4,
    requiredBuilding: 'quantum_assembler',
  },

  // ===== 3级终极深度加工（由奇迹铸造厂生产） =====
  {
    id: 'stellar_beacon_core',
    name: '恒星信标核心',
    tier: 3,
    category: 'goods',
    icon: 'sparkles',
    desc: '融合量子运算矩阵与等离子压缩电池的终极工艺奇迹，能向全银河广播文明回响。',
    inputs: { quantum_matrix: 1, plasma_battery: 1, energy: 20 },
    output: { id: 'stellar_beacon_core', name: '恒星信标核心', quantity: 1 },
    days: 6,
    requiredBuilding: 'miracle_foundry',
  },
];

export function getProductionRecipe(id) {
  // 先查预置配方，再查 AI 动态生成的挂载配方
  const preset = PRODUCTION_RECIPES.find((recipe) => recipe.id === id);
  if (preset) return preset;
  if (typeof window !== 'undefined' && window.__DYNAMIC_RECIPES__) {
    return window.__DYNAMIC_RECIPES__.find((recipe) => recipe.id === id) || null;
  }
  return null;
}

export function getQuality(score) {
  return [...PRODUCT_QUALITY].reverse().find((quality) => score >= quality.min) || PRODUCT_QUALITY[0];
}
