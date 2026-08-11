/**
 * 星尘殖民地 - 外星游客系统
 * 外星种族会派遣游客访问殖民地，游客消费产生星币收入
 * 灵感来自开罗《宇宙探险物语》的游客机制
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { SPECIES, getSpeciesById } from '../data/species.js';

// 游客名字池（按种族）
const TOURIST_NAMES = {
  squid: ['墨墨', '闪闪', '波波', '莹莹', '柔柔', '晶晶', '涟漪', '深海'],
  crystal: ['共振', '谐音', '晶辉', '振动', '棱光', '永恒', '静思', '折射'],
  mecha: ['齿轮', '钢铁', '协议', '引擎', '螺丝', '电路', '焊点', '型号'],
  flora: ['新芽', '根系', '花蕾', '叶脉', '孢子', '年轮', '光合', '菌丝'],
};

// 全局游客管理器状态
let activeTourists = [];
let lastTouristDay = 0;
let touristIdCounter = 0;

/**
 * 每日更新游客系统
 */
export function updateTouristSystem() {
  const day = gameState.state.day;
  const buildings = gameState.state.buildings.filter(b => b.built);

  // 计算旅游吸引力（基于文化类建筑）
  let tourismAttraction = 0;
  for (const b of buildings) {
    if (b.buildingId === 'museum') tourismAttraction += 5;
    if (b.buildingId === 'concert_hall') tourismAttraction += 8;
    if (b.buildingId === 'monument') tourismAttraction += 10;
    if (b.buildingId === 'trade_hub') tourismAttraction += 3;
    if (b.buildingId === 'plaza') tourismAttraction += 2;
  }

  // 没有吸引力建筑，不会有游客
  if (tourismAttraction === 0) return;

  // 每5-15天来一批游客，取决于吸引力
  const interval = Math.max(5, 20 - tourismAttraction);
  if (day - lastTouristDay < interval) return;

  lastTouristDay = day;

  // 随机选择一个种族（好感度越高越可能来）
  const weightedSpecies = [];
  for (const sp of SPECIES) {
    const rep = gameState.state.diplomacy[sp.id]?.reputation || 0;
    const weight = Math.max(1, rep);
    for (let i = 0; i < weight; i++) weightedSpecies.push(sp.id);
  }
  const speciesId = weightedSpecies[Math.floor(Math.random() * weightedSpecies.length)];
  const species = getSpeciesById(speciesId);

  // 生成1-3个游客
  const count = 1 + Math.floor(Math.random() * 3);
  const newTourists = [];

  for (let i = 0; i < count; i++) {
    const names = TOURIST_NAMES[speciesId] || ['访客'];
    const name = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 99);

    // 根据种族基础偏好生成个体偏好（±15%波动）
    const individualPref = {};
    for (const [dim, baseVal] of Object.entries(species.gravityPreference)) {
      const variance = baseVal * 0.15;
      const offset = gaussianRandom() * variance;
      individualPref[dim] = Math.max(0, Math.min(10, Math.round((baseVal + offset) * 10) / 10));
    }

    // 预算基于好感度
    const rep = gameState.state.diplomacy[speciesId]?.reputation || 10;
    const budget = Math.floor((20 + rep * 2 + Math.random() * 30));

    const tourist = {
      id: `tourist_${++touristIdCounter}`,
      name,
      speciesId,
      speciesName: species.name,
      preference: individualPref,
      budget,
      spent: 0,
      visitDay: day,
      mood: 70 + Math.random() * 20,
    };
    newTourists.push(tourist);
  }

  activeTourists.push(...newTourists);

  // 发出游客到达事件
  bus.emit('tourist:arrived', { species: speciesId, count, tourists: newTourists });

  gameState.addNotification({
    title: '外星游客到访！',
    text: `${count}名${species.name}游客抵达殖民地。`,
    type: 'tourist',
    icon: species.icon || 'sparkles',
    duration: 5000,
  });

  // 游客消费逻辑（立即结算简化版）
  processTouristSpending(newTourists, buildings);
}

/**
 * 处理游客消费
 */
function processTouristSpending(tourists, buildings) {
  let totalIncome = 0;
  let totalHappinessGain = 0;

  // 文化类建筑用于消费
  const shops = buildings.filter(b =>
    b.buildingId === 'museum' || b.buildingId === 'concert_hall' ||
    b.buildingId === 'monument' || b.buildingId === 'trade_hub' ||
    b.buildingId === 'plaza'
  );

  if (shops.length === 0) return;

  for (const tourist of tourists) {
    // 每个游客选择1-2个消费点
    const visitCount = Math.min(shops.length, 1 + Math.floor(Math.random() * 2));
    let remainingBudget = tourist.budget;

    for (let v = 0; v < visitCount && remainingBudget > 0; v++) {
      const shop = shops[Math.floor(Math.random() * shops.length)];
      const spend = Math.min(remainingBudget, Math.floor(5 + Math.random() * 15));
      remainingBudget -= spend;
      tourist.spent += spend;
      totalIncome += spend;
    }

    // 游客心情受引力匹配影响（简化）
    totalHappinessGain += 1;
  }

  // 增加星币收入
  if (totalIncome > 0) {
    gameState.addResource('credits', totalIncome);
    gameState.addNotification({
      title: '游客消费',
      text: `外星游客在殖民地消费了 ${totalIncome} 星币。`,
      type: 'success',
      icon: 'coins',
      duration: 3000,
    });
  }

  // 增加该种族好感度
  if (tourists.length > 0) {
    const speciesId = tourists[0].speciesId;
    const repGain = Math.ceil(tourists.length * 1.5);
    const dip = gameState.state.diplomacy[speciesId];
    if (dip) {
      const oldRep = dip.reputation;
      dip.reputation = Math.min(100, oldRep + repGain);
      dip.contacted = true;

      // 检查好感度阈值奖励
      checkTierRewards(speciesId, oldRep, dip.reputation);

      bus.emit('diplomacy:reputation', { species: speciesId, old: oldRep, new: dip.reputation });
    }
  }

  // 居民幸福度小幅提升（看到外星人很开心）
  if (totalHappinessGain > 0) {
    gameState.set('happiness', Math.min(100, gameState.state.happiness + totalHappinessGain));
  }

  // 游客离开（简化：消费完即离开，但精灵会在地图上停留一段时间）
  setTimeout(() => {
    activeTourists = activeTourists.filter(t => !tourists.includes(t));
  }, 10000);
}

/**
 * 检查好感度阈值奖励
 */
function checkTierRewards(speciesId, oldRep, newRep) {
  const species = getSpeciesById(speciesId);
  if (!species) return;

  for (const tier of species.tiers) {
    if (oldRep < tier.level && newRep >= tier.level) {
      gameState.addNotification({
        title: `外交里程碑：${tier.name}`,
        text: `${species.name} 好感度达到 ${tier.level}！奖励：${tier.reward}`,
        type: 'success',
        icon: 'award',
        duration: 6000,
      });

      // 应用具体奖励效果
      applyTierReward(speciesId, tier);
      bus.emit('diplomacy:tier', { species: speciesId, tier });
    }
  }
}

/**
 * 应用好感度阈值奖励
 */
function applyTierReward(speciesId, tier) {
  switch (speciesId) {
    case 'flora':
      if (tier.level === 45) {
        // 农场产出+25% - 通过修改全局效率实现
        gameState.set('farmBonus', (gameState.state.farmBonus || 1) * 1.25);
      }
      break;
    case 'crystal':
      if (tier.level === 55) {
        // 研究速度+20%
        gameState.set('researchBonus', (gameState.state.researchBonus || 1) * 1.2);
      }
      break;
    case 'mecha':
      if (tier.level === 50) {
        // 建造速度+15%
        gameState.set('buildBonus', (gameState.state.buildBonus || 1) * 1.15);
      }
      break;
  }
}

/**
 * 高斯随机（Box-Muller变换）
 */
function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * 获取当前活跃游客列表
 */
export function getActiveTourists() {
  return activeTourists;
}
