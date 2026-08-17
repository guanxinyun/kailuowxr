/**
 * 星尘殖民地 - 外星游客系统
 * 外星种族会派遣游客访问殖民地，游客消费产生星币收入
 * 灵感来自开罗《宇宙探险物语》的游客机制
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { SPECIES, getSpeciesById } from '../data/species.js';
import { getBuildingById } from '../data/buildings.js';
import { getTechById } from '../data/techs.js';
import { addInventory, getInventoryEntry } from './ProductionSystem.js';
import { getQuality } from '../data/production.js';
import { getBuildingEfficiency, getBuildingOperationalState } from './BuildingSystem.js';
import { getComboMultiplier } from './ComboSystem.js';
import { aiClient } from '../ai/AIClient.js';
import { buildTouristFacts, buildSceneryVisitFacts, getNarrationFallback } from './AIContentFacts.js';
import { touristBuyFromShelf, getPromotionBonus } from './TradeSystem.js';
import { triggerComboWonderEvent } from './WonderEventSystem.js';
import { sound } from './SoundSystem.js';

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
  const buildings = gameState.state.buildings.filter(b => getBuildingOperationalState(b).operational);

  // 每个游戏日自主访问一个偏好景点；离开时按实际访问经历结算
  updateAutonomousVisits(day);

  // 检查已到期的游客，若刚到期则标记为离境并触发寻路回降落点
  for (const t of activeTourists) {
    if (day - t.visitDay >= (t.stayDuration || 5)) {
      t.isDeparting = true;
    }
  }

  // 停留到期且完成离境流程（或宽限1天）离开
  const leaving = activeTourists.filter(t => day - t.visitDay >= (t.stayDuration || 5));
  processTouristDeparture(leaving);

  // 必须拥有已建成并正常运营的【星际港口 (starport)】，外星穿梭机才能降落
  const starportBuilding = buildings.find(b => b.buildingId === 'starport');
  if (!starportBuilding) return;

  // 1. 首航迎客机制：若从未迎客过（首次建成），立即触发首航降落
  const isFirstArrival = !gameState.state.stats?.firstStarportArrival;
  if (isFirstArrival) {
    if (!gameState.state.stats) gameState.state.stats = {};
    gameState.state.stats.firstStarportArrival = true;
    lastTouristDay = day;
    spawnTouristGroup(day, buildings, starportBuilding, true);
    return;
  }

  // 计算旅游吸引力（基于文化类与景点建筑）
  let tourismAttraction = 0;
  for (const b of buildings) {
    const efficiency = getBuildingEfficiency(b) * getComboMultiplier('tourism_attraction', { buildingId: b.buildingId });
    if (b.buildingId === 'starport') tourismAttraction += 8 * efficiency;
    if (b.buildingId === 'museum') tourismAttraction += 5 * efficiency;
    if (b.buildingId === 'concert_hall') tourismAttraction += 8 * efficiency;
    if (b.buildingId === 'monument') tourismAttraction += 10 * efficiency;
    if (b.buildingId === 'trade_hub') tourismAttraction += 3 * efficiency;
    if (b.buildingId === 'plaza') tourismAttraction += 2 * efficiency;
    if (b.buildingId === 'restaurant') tourismAttraction += 6 * efficiency;
    if (b.buildingId === 'amusement_park') tourismAttraction += 12 * efficiency;
    if (b.buildingId === 'leisure_park') tourismAttraction += 4 * efficiency;
    if (b.buildingId === 'holo_wheel') tourismAttraction += 12 * efficiency;
    if (b.buildingId === 'bio_tower') tourismAttraction += 9 * efficiency;
    if (b.buildingId === 'float_fountain') tourismAttraction += 8 * efficiency;
  }

  // 没有吸引力建筑，不会有游客
  if (tourismAttraction === 0) return;

  // 宣传引流加成
  const promotionBonus = getPromotionBonus();
  tourismAttraction *= (1 + promotionBonus);

  // 到访间隔平滑化（3~10天）
  const interval = Math.max(3, Math.round(12 - tourismAttraction * 0.5));
  if (day - lastTouristDay < interval) return;

  lastTouristDay = day;
  spawnTouristGroup(day, buildings, starportBuilding, false);
}

/** 生成外星游客批次 */
function spawnTouristGroup(day, buildings, starportBuilding, isFirst = false) {
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
  const count = isFirst ? 2 : (1 + Math.floor(Math.random() * 3));
  const newTourists = [];

  for (let i = 0; i < count; i++) {
    const names = TOURIST_NAMES[speciesId] || ['访客'];
    const name = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 99);

    // 根据种族基础偏好生成个体偏好（±15%~25%高斯波动）
    const individualPref = {};
    const basePrefs = species.gravityPreference || {};
    for (const [dim, baseVal] of Object.entries(basePrefs)) {
      const variance = baseVal * 0.18;
      const offset = gaussianRandom() * variance;
      individualPref[dim] = Math.max(0, Math.min(10, Math.round((baseVal + offset) * 10) / 10));
    }

    // 游客随机旅行预算 (20~90 星币)
    const budget = 20 + Math.floor(Math.random() * 71);

    // 计算性格标签 (Traits)
    const traits = generateTouristTraits(speciesId, basePrefs, individualPref, budget);

    const tourist = {
      id: `tourist_${++touristIdCounter}`,
      name,
      speciesId,
      speciesName: species.name,
      preference: individualPref,
      traits,
      budget,
      spent: 0,
      visitDay: day,
      stayDuration: 3 + Math.floor(Math.random() * 6), // 停留3-8天
      mood: 70 + Math.random() * 20,
      itinerary: buildAutonomousItinerary(individualPref, buildings),
      visitedStops: [],
      satisfaction: 50,
    };
    tourist.personality = getNarrationFallback('tourist_personality', buildTouristFacts(tourist));
    aiClient.generate('tourist_personality', buildTouristFacts(tourist), () => tourist.personality)
      .then(text => { tourist.personality = typeof text === 'string' ? text : tourist.personality; bus.emit('tourist:narration', { tourist }); });
    newTourists.push(tourist);
  }

  activeTourists.push(...newTourists);

  // 发出游客到达事件
  bus.emit('tourist:arrived', { species: speciesId, count, tourists: newTourists });

  // 仅在星港上方生成一个轻量飘字动效，不使用全局 Notification 弹窗刷屏打扰玩家
  if (starportBuilding) {
    bus.emit('fx:float-text', {
      x: starportBuilding.x,
      y: starportBuilding.y,
      text: isFirst ? `🚀 首航客抵：${species.name} ×${count}` : `🛸 游客抵达：${species.name} ×${count}`,
      color: '#A8D8B9',
    });
  }

  // 游客到达后不再即时结算；满意度在离开时按路线结算
}

const TOURIST_ATTRACTIONS = ['museum', 'concert_hall', 'monument', 'trade_hub', 'plaza', 'restaurant', 'amusement_park', 'leisure_park', 'holo_wheel', 'bio_tower', 'float_fountain', 'zen_garden'];

/** 景观打卡随机事件本地掷骰与结算（支持AI与本地降级叙事） */
export function triggerSceneryEvent(target, visitor, isTourist = true) {
  const data = getBuildingById(target.buildingId);
  const buildingName = data?.name || '景观设施';
  const visitorName = visitor.name || (isTourist ? '外星游客' : '殖民地居民');

  // 事件类型：打赏、灵感、好感、晶体拾取
  const eventTypes = ['tip', 'inspiration', 'diplomacy', 'crystal'];
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  let effectDesc = '';

  if (eventType === 'tip') {
    const tip = 20 + Math.floor(Math.random() * 31); // 20~50 星币
    gameState.addResource('credits', tip);
    effectDesc = `在${buildingName}心潮澎湃，慷慨赞助了 ${tip} 星币！`;
    bus.emit('fx:float-text', { x: target.x, y: target.y, text: `赞助 +${tip}🪙`, color: '#F1C40F' });
  } else if (eventType === 'inspiration') {
    const research = 10 + Math.floor(Math.random() * 11); // 10~20 科研
    gameState.addResource('research', research);
    effectDesc = `在${buildingName}流连忘返，顿悟灵感产出 ${research} 点科研点！`;
    bus.emit('fx:float-text', { x: target.x, y: target.y, text: `灵感 +${research}💡`, color: '#3498DB' });
  } else if (eventType === 'diplomacy' && isTourist && visitor.speciesId) {
    if (!gameState.state.diplomacy) gameState.state.diplomacy = {};
    if (!gameState.state.diplomacy[visitor.speciesId]) {
      gameState.state.diplomacy[visitor.speciesId] = { reputation: 0 };
    }
    gameState.state.diplomacy[visitor.speciesId].reputation += 3;
    effectDesc = `对${buildingName}赞不绝口，提升了与${visitor.speciesName || '外星文明'}的好感度 (+3)！`;
    bus.emit('fx:float-text', { x: target.x, y: target.y, text: `好感度 +3❤️`, color: '#E74C3C' });
  } else {
    const crystal = 2 + Math.floor(Math.random() * 3); // 2~4 晶体
    gameState.addResource('crystal', crystal);
    effectDesc = `在${buildingName}旁偶然拾得散落的微光晶体 (+${crystal})！`;
    bus.emit('fx:float-text', { x: target.x, y: target.y, text: `晶体 +${crystal}💎`, color: '#9B59B6' });
  }

  const facts = buildSceneryVisitFacts(visitorName, buildingName, eventType, effectDesc, isTourist);
  const fallback = getNarrationFallback('scenery_event', facts);

  // 景观打卡由建筑上方飘字直观展示，不再用 Notification 频繁弹窗刷屏
  bus.emit('scenery:event', { target, visitor, eventType, effectDesc, isTourist });
  aiClient.generate('scenery_event', facts, () => fallback).then(narration => {
    bus.emit('scenery:narration', { target, visitor, narration });
  });
}

export function scoreAttraction(preference, building, origin = null) {
  const data = getBuildingById(building.buildingId);
  if (!data) return 0;
  let affinity = 0;
  for (const [dim, gravity] of Object.entries(data.gravity || {})) {
    affinity += gravity * (preference[dim] || 0);
  }
  const distance = origin ? Math.abs(building.x - origin.x) + Math.abs(building.y - origin.y) : 0;
  return affinity * getBuildingEfficiency(building) / (1 + distance * 0.12);
}

export function buildAutonomousItinerary(preference, buildings) {
  const landing = buildings.find(b => b.buildingId === 'landing_pad');
  return buildings
    .filter(b => TOURIST_ATTRACTIONS.includes(b.buildingId) && getBuildingOperationalState(b).operational)
    .map(b => ({ building: b, score: scoreAttraction(preference, b, landing) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(entry => entry.building.id);
}

function updateAutonomousVisits(day) {
  const buildings = gameState.state.buildings;
  for (const tourist of activeTourists) {
    if (tourist.lastVisitDay === day || !tourist.itinerary?.length) continue;

    // 游客不一定会按部就班拜访全部景点，也可能自主漫游或随机挑选
    const unvisited = tourist.itinerary.filter(id => !tourist.visitedStops.includes(id));
    if (!unvisited.length) {
      // 若原计划已游览完，仍有 20% 概率二刷或漫步至其他景观
      if (Math.random() > 0.2) continue;
    }

    const nextId = unvisited.length
      ? (Math.random() < 0.75 ? unvisited[0] : unvisited[Math.floor(Math.random() * unvisited.length)])
      : tourist.itinerary[Math.floor(Math.random() * tourist.itinerary.length)];

    if (!nextId) continue;
    const target = buildings.find(b => b.id === nextId && getBuildingOperationalState(b).operational);
    if (!target) continue;
    if (!tourist.visitedStops.includes(nextId)) {
      tourist.visitedStops.push(nextId);
    }
    tourist.currentDestination = nextId;
    tourist.lastVisitDay = day;
    bus.emit('tourist:destination', { tourist, building: target });

    const targetData = getBuildingById(target.buildingId);

    // 若拜访的是景观建筑，30% 概率触发景观事件（打赏、灵感、好感度、物资拾取）
    if (targetData?.category === 'scenery' && Math.random() < 0.35) {
      triggerSceneryEvent(target, tourist, true);
    }

    // 随机事件：游客路过时冲动购买建筑货架上的加工品
    if (Math.random() < 0.4) {
      impulsePurchase(target, tourist);
    }
  }

  // 居民日常漫步拜访景观建筑也有概率触发事件
  if (Math.random() < 0.15 && gameState.state.residents?.length) {
    const sceneries = buildings.filter(b => {
      const d = getBuildingById(b.buildingId);
      return d?.category === 'scenery' && getBuildingOperationalState(b).operational;
    });
    if (sceneries.length > 0) {
      const targetScenery = sceneries[Math.floor(Math.random() * sceneries.length)];
      const resident = gameState.state.residents[Math.floor(Math.random() * gameState.state.residents.length)];
      triggerSceneryEvent(targetScenery, resident, false);
    }
  }

  // 周期性（每隔约 25~30 天有概率）在群落或特殊组合处触发双轨奇遇事件（内部受冷却与去重保护）
  if (Math.random() < 0.04 && buildings.length >= 2) {
    const visitor = activeTourists.length > 0
      ? activeTourists[Math.floor(Math.random() * activeTourists.length)]
      : gameState.state.residents?.[0];
    triggerComboWonderEvent(null, visitor);
  }
}

/**
 * 游客路过建筑时的随机冲动购买（加工品）。
 * 购买建筑货架上的加工品；物资购买待物品入建筑后（物流）再接入。
 */
function impulsePurchase(target, tourist) {
  if (!target.shopShelf?.length) return 0;
  const income = touristBuyFromShelf(target, tourist);
  if (income > 0) {
    gameState.addResource('credits', income);
    bus.emit('tourist:impulse-purchase', { tourist, building: target, income });
    bus.emit('fx:float-text', { x: target.x, y: target.y, text: `+${income}🪙`, color: '#F1C40F' });
  }
  return income;
}

export function calculateVisitSatisfaction(tourist, buildings) {
  const visited = (tourist.visitedStops || []).map(id => buildings.find(b => b.id === id)).filter(Boolean);
  if (!visited.length) return { score: 25, diversity: 0, preferenceMatch: 0 };
  const diversity = Math.min(100, new Set(visited.map(b => b.buildingId)).size * 25);
  const scores = visited.map(b => scoreAttraction(tourist.preference, b));
  const theoretical = Math.max(1, ...buildings.filter(b => TOURIST_ATTRACTIONS.includes(b.buildingId)).map(b => scoreAttraction(tourist.preference, b)));
  const preferenceMatch = Math.min(100, Math.round((scores.reduce((a, b) => a + b, 0) / scores.length / theoretical) * 100));
  const souvenirBonus = getInventoryEntry('star_souvenir').quantity > 0 ? 10 : 0;
  return { score: Math.min(100, Math.round(diversity * 0.35 + preferenceMatch * 0.55 + souvenirBonus)), diversity, preferenceMatch };
}

function processTouristDeparture(leaving) {
  if (!leaving.length) return;
  const buildings = gameState.state.buildings.filter(b => getBuildingOperationalState(b).operational);
  for (const tourist of leaving) {
    activeTourists = activeTourists.filter(at => at !== tourist);
    const satisfaction = calculateVisitSatisfaction(tourist, buildings);
    tourist.satisfaction = satisfaction.score;
    processTouristSpending([tourist], buildings, satisfaction);
    const facts = buildTouristFacts(tourist);
    tourist.review = getNarrationFallback('tourist_review', facts);
    aiClient.generate('tourist_review', facts, () => tourist.review)
      .then(text => bus.emit('tourist:review', { tourist, text: typeof text === 'string' ? text : tourist.review }));
  }
  bus.emit('tourist:leaving', { tourists: leaving });
  const average = Math.round(leaving.reduce((sum, t) => sum + t.satisfaction, 0) / leaving.length);
  gameState.addNotification({
    title: '游客离开',
    text: `${leaving.length}名外星游客结束自主游览，平均满意度 ${average}%。`,
    type: 'event', icon: 'plane-takeoff', duration: 4000,
  });
}

/**
 * 处理游客消费
 */
export function processTouristSpending(tourists, buildings, routeSatisfaction = { score: 50 }) {
  let totalIncome = 0;
  let totalHappinessGain = 0;
  let souvenirsSold = 0;
  let souvenirQuality = null;

  // 文化与商业服务类建筑用于消费
  const shops = buildings.filter(b =>
    b.buildingId === 'museum' || b.buildingId === 'concert_hall' ||
    b.buildingId === 'monument' || b.buildingId === 'trade_hub' ||
    b.buildingId === 'plaza' || b.buildingId === 'restaurant' ||
    b.buildingId === 'amusement_park'
  );

  if (shops.length === 0) return;

  for (const tourist of tourists) {
    // 每个游客选择1-2个消费点
    const visitCount = Math.min(shops.length, 1 + Math.floor(Math.random() * 2));
    let remainingBudget = tourist.budget;

    for (let v = 0; v < visitCount && remainingBudget > 0; v++) {
      const shop = shops[Math.floor(Math.random() * shops.length)];
      const satisfactionMultiplier = 0.6 + routeSatisfaction.score / 100;
      const spend = Math.min(remainingBudget, Math.floor((5 + Math.random() * 15) * satisfactionMultiplier));
      remainingBudget -= spend;
      tourist.spent += spend;
      totalIncome += spend;

      // 货架购买：游客尝试购买该建筑货架上的加工品
      const shelfIncome = touristBuyFromShelf(shop, tourist);
      totalIncome += shelfIncome;
      remainingBudget = tourist.budget - tourist.spent;
    }

    const souvenir = getInventoryEntry('star_souvenir');
    if (souvenir.quantity > 0 && remainingBudget > 0) {
      souvenirQuality = getQuality(souvenir.qualityScore);
      const souvenirPrice = Math.min(remainingBudget, 8 + Math.floor(souvenir.qualityScore * 0.22));
      if (souvenirPrice > 0) {
        addInventory('star_souvenir', -1);
        remainingBudget -= souvenirPrice;
        tourist.spent += souvenirPrice;
        tourist.mood = Math.min(100, tourist.mood + 3 + Math.floor(souvenir.qualityScore / 25));
        totalIncome += souvenirPrice;
        souvenirsSold++;
      }
    }

    // 游客心情受引力匹配影响（简化）
    totalHappinessGain += 1;
  }

  // 增加星币收入
  if (totalIncome > 0) {
    sound.play('cash');
    gameState.addResource('credits', totalIncome);
    gameState.addNotification({
      title: '游客消费',
      text: souvenirsSold > 0
        ? `外星游客消费了 ${totalIncome} 星币，其中购买了 ${souvenirsSold} 件${souvenirQuality.grade}级星尘纪念品。`
        : `外星游客在殖民地消费了 ${totalIncome} 星币。`,
      type: 'success',
      icon: 'coins',
      duration: 3000,
    });
  }

  // 增加该种族好感度
  if (tourists.length > 0) {
    const speciesId = tourists[0].speciesId;
    const qualityRepBonus = souvenirQuality ? Math.floor(souvenirQuality.min / 30) : 0;
    const satisfactionRep = Math.floor(routeSatisfaction.score / 25);
    const repGain = Math.ceil(tourists.length * 1.5) + satisfactionRep + Math.min(3, souvenirsSold + qualityRepBonus);
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
}

/**
 * 检查好感度阈值奖励
 */
export function checkTierRewards(speciesId, oldRep, newRep) {
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
      gameState.recordEvent({
        category: 'diplomacy',
        title: `外交里程碑：${tier.name}`,
        text: `${species.name} 好感度达到 ${tier.level}，奖励：${tier.reward}`,
        good: true,
        meta: { speciesId, tierLevel: tier.level },
      });
      bus.emit('diplomacy:tier', { species: speciesId, tier });
    }
  }
}

/**
 * 应用好感度阈值奖励
 */
function applyTierReward(speciesId, tier) {
  // 建筑图纸奖励：直接加入图纸列表（绕过科技门槛）
  if (tier.rewardBlueprint && getBuildingById(tier.rewardBlueprint)) {
    const blueprints = gameState.state.blueprints.buildings;
    if (!blueprints.includes(tier.rewardBlueprint)) blueprints.push(tier.rewardBlueprint);
  }

  // 科技奖励：连同缺失的前置一起完成，保持科技树连贯
  if (tier.rewardTech) grantTech(tier.rewardTech);

  // 既有数值加成
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

/** 赠送科技：连同缺失的前置一并完成，保证科技树连贯 */
function grantTech(techId) {
  const tech = getTechById(techId);
  if (!tech) return;
  const researched = gameState.state.researchedTechs;
  if (researched.includes(techId)) return;
  for (const prereq of tech.prereqs || []) grantTech(prereq);
  if (!researched.includes(techId)) {
    researched.push(techId);
    bus.emit('tech:completed', { techId });
  }
}

/**
 * 根据种族基础与个体偏好计算性格标签 (Traits)
 */
export function generateTouristTraits(speciesId, basePrefs, individualPref, budget) {
  const traits = [];

  // 1. 预算极端属性
  if (budget >= 70) {
    traits.push({ id: 'wealthy', label: '星际土豪', desc: '预算充裕，消费毫不手软', icon: 'coins', color: '#F1C40F' });
  } else if (budget <= 25) {
    traits.push({ id: 'budget', label: '穷游特种兵', desc: '精打细算，注重性价比', icon: 'backpack', color: '#95A5A6' });
  }

  // 2. 引力反差与极端偏好
  const sortedDims = Object.entries(individualPref).sort((a, b) => b[1] - a[1]);
  const [topDim, topVal] = sortedDims[0] || ['culture', 5];
  const baseTop = basePrefs[topDim] || 5;
  const diff = topVal - baseTop;

  // 美食标签
  if (individualPref.food >= 8.5 || (topDim === 'food' && diff >= 1.5)) {
    traits.push({ id: 'foodie', label: '宇宙老饕', desc: '对殖民地美食与零食充满执念', icon: 'cookie', color: '#E67E22' });
  }

  // 文化/艺术标签
  if (individualPref.culture >= 8.5 || (topDim === 'culture' && diff >= 1.5)) {
    traits.push({ id: 'art_lover', label: '古典艺术狂热', desc: '必访博物馆与音乐厅', icon: 'sparkles', color: '#9B59B6' });
  }

  // 知识/科技标签
  if (individualPref.knowledge >= 8.5 || (topDim === 'knowledge' && diff >= 1.5)) {
    traits.push({ id: 'tech_geek', label: '参数考据怪', desc: '热衷考察尖端科研设施与装置', icon: 'bot', color: '#3498DB' });
  }

  // 冒险/探索标签
  if (individualPref.adventure >= 8.5 || (topDim === 'adventure' && diff >= 1.5)) {
    traits.push({ id: 'thrill_seeker', label: '极速游侠', desc: '喜欢探索与新奇未知的刺激地标', icon: 'compass', color: '#E74C3C' });
  }

  // 3. 种族反差萌标签（如研究型的章鱼、贪吃的机甲、爱冒险的花灵）
  if (speciesId === 'squid' && topDim === 'knowledge' && individualPref.knowledge > 6.5) {
    traits.push({ id: 'scholar_squid', label: '跨界学者', desc: '触手翻书比吃零食还快的异类章鱼', icon: 'book', color: '#1ABC9C' });
  } else if (speciesId === 'mecha' && topDim === 'food' && individualPref.food > 6.0) {
    traits.push({ id: 'gourmet_bot', label: '机油美食家', desc: '试图用传感器品鉴人类食物的机器人', icon: 'cookie', color: '#F39C12' });
  } else if (speciesId === 'flora' && topDim === 'adventure' && individualPref.adventure > 6.0) {
    traits.push({ id: 'roaming_spore', label: '流浪孢子', desc: '渴望随风漂洋过海去远方的植物', icon: 'wind', color: '#2ECC71' });
  } else if (speciesId === 'crystal' && topDim === 'social' && (individualPref.social || 0) > 6.0) {
    traits.push({ id: 'party_crystal', label: '共鸣舞者', desc: '热衷与大家一起折射欢声笑语', icon: 'music', color: '#E91E63' });
  }

  // 若无特殊标签，赋予一个可爱的常态标签
  if (traits.length === 0) {
    traits.push({ id: 'curious', label: '观光散步家', desc: '随遇而安，享受殖民地宁静时光', icon: 'smile', color: '#3498DB' });
  }

  return traits.slice(0, 2); // 最多 2 个标签
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
