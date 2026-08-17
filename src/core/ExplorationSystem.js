import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { EXPLORE_REGIONS, RANDOM_EXPEDITION_TEMPLATES, RESOURCES } from '../data/gamedata.js';
import { addInventory, getInventoryQuantity } from './ProductionSystem.js';
import { addResidentExperience, normalizeResidentGrowth } from './ResidentGrowthSystem.js';
import { assignWorkers } from './BuildingSystem.js';
import { aiClient } from '../ai/AIClient.js';
import { buildExplorationFacts, getNarrationFallback } from './AIContentFacts.js';

export function getExploreRegion(regionId) {
  return EXPLORE_REGIONS.find(region => region.id === regionId) || null;
}

// ===== 区域解锁 =====
export function unlockRegion(regionId) {
  const region = getExploreRegion(regionId);
  if (!region) return false;
  if (gameState.state.unlockedRegions.includes(regionId)) return false;
  gameState.state.unlockedRegions.push(regionId);
  bus.emit('explore:unlocked', { region });
  gameState.addNotification({ title: '发现新区域', text: `${region.name}已开放考察！`, type: 'success', icon: 'map-pin' });
  return true;
}

// ===== 随机考察任务生成 =====
export function generateRandomExpedition() {
  if (gameState.state.randomExpedition) return gameState.state.randomExpedition;
  const T = RANDOM_EXPEDITION_TEMPLATES;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const tierIdx = Math.min(Math.floor(gameState.state.day / 30), T.rewardTiers.length - 1);
  const tier = T.rewardTiers[tierIdx];
  const difficulty = tierIdx + 1;
  const distance = Math.max(1, difficulty);
  const days = Math.max(2, distance + Math.floor(Math.random() * 2));

  // 构建奖励池
  const mainRes = pick(tier.resources);
  const [lo, hi] = tier.amounts;
  const rewardPool = { [mainRes]: [lo, hi] };
  if (Math.random() < tier.bonusChance) {
    const bonusRes = pick(tier.bonus);
    rewardPool[bonusRes] = tier.bonusAmounts;
  }

  const biomes = ['plains', 'mountain', 'forest', 'metal', 'crystal', 'ruins', 'crater'];
  const expedition = {
    id: `random_${Date.now()}`,
    name: `${pick(T.prefixes)}${pick(T.suffixes)}`,
    desc: pick(T.descs),
    danger: difficulty,
    distance,
    days,
    biome: pick(biomes),
    rewardPool,
    isRandom: true,
  };
  gameState.state.randomExpedition = expedition;
  return expedition;
}

export function clearRandomExpedition() {
  gameState.state.randomExpedition = null;
}

// ===== 奖励掷骰 =====
function rollRewards(pool) {
  const result = {};
  for (const [resource, value] of Object.entries(pool)) {
    if (Array.isArray(value)) {
      const [min, max] = value;
      result[resource] = Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      result[resource] = value;
    }
  }
  return result;
}

// ===== 出发验证 =====
export function canStartExpedition(regionId, residentId) {
  // 随机任务
  const randomExp = gameState.state.randomExpedition;
  const region = (randomExp && randomExp.id === regionId) ? randomExp : getExploreRegion(regionId);
  if (!region) return { ok: false, reason: '找不到考察区域' };
  if (gameState.state.activeExploration) return { ok: false, reason: '已有考察正在进行' };
  // 特殊区域检查解锁和已完成
  if (!region.isRandom) {
    if (!gameState.state.unlockedRegions.includes(regionId)) return { ok: false, reason: '该区域尚未发现' };
    if (gameState.state.exploredRegions.includes(regionId)) return { ok: false, reason: '该区域已经完成考察' };
  }
  const resident = gameState.state.residents.find(entry => entry.id === residentId);
  if (!resident) return { ok: false, reason: '请选择考察居民' };
  normalizeResidentGrowth(resident);
  if ((resident.exploration || 0) < (region.requiredExploration || 0)) return { ok: false, reason: `探索力需要 ${region.requiredExploration}` };
  if ((resident.skills?.survival || 0) < (region.requiredSurvival || 0)) return { ok: false, reason: `生存技能需要 ${region.requiredSurvival}` };
  if (region.supply && getInventoryQuantity(region.supply) < 1) return { ok: false, reason: '缺少环境考察补给' };
  return { ok: true, region, resident };
}

export function startExpedition(regionId, residentId) {
  const validation = canStartExpedition(regionId, residentId);
  if (!validation.ok) return validation;
  const { region, resident } = validation;
  if (region.supply) addInventory(region.supply, -1);
  const duration = region.days || Math.max(2, region.distance || 2);
  gameState.state.activeExploration = {
    version: 1,
    regionId,
    residentId,
    startedDay: gameState.state.day,
    remainingDays: duration,
    totalDays: duration,
    isRandom: !!region.isRandom,
  };
  // 被派遣的居民暂时无法工作
  assignWorkers();
  const facts = buildExplorationFacts(region, resident, 'started');
  const fallback = getNarrationFallback('exploration_log', facts);
  bus.emit('explore:started', { region, resident, exploration: gameState.state.activeExploration, narration: fallback });
  aiClient.generate('exploration_log', facts, () => fallback).then(narration => bus.emit('explore:narration', { region, resident, phase: 'started', narration }));
  return { ok: true, exploration: gameState.state.activeExploration };
}

export function updateExplorationSystem() {
  const active = gameState.state.activeExploration;
  if (!active) return;
  const randomExp = gameState.state.randomExpedition;
  const region = active.isRandom ? randomExp : getExploreRegion(active.regionId);
  const resident = gameState.state.residents.find(entry => entry.id === active.residentId);
  if (!region || !resident) {
    gameState.state.activeExploration = null;
    return;
  }
  active.remainingDays -= 1;
  if (active.remainingDays > 0) return;
  completeExpedition(region, resident);
}

function completeExpedition(region, resident) {
  if (!region.isRandom) {
    if (!gameState.state.exploredRegions.includes(region.id)) gameState.state.exploredRegions.push(region.id);
  }
  const rolledRewards = rollRewards(region.rewardPool || region.rewards || {});
  const rewardTexts = [];
  for (const [reward, amount] of Object.entries(rolledRewards)) {
    if (amount <= 0) continue;
    if (reward in gameState.state.resources) {
      gameState.addResource(reward, amount);
    } else {
      addInventory(reward, amount, 50);
    }
    const name = RESOURCES[reward]?.name || reward;
    rewardTexts.push(`${name}+${amount}`);
  }
  addResidentExperience(resident, 35 + (region.difficulty || region.danger || 1) * 8, 'survival', `完成${region.name}`);
  gameState.state.activeExploration = null;
  // 居民考察归来，恢复工作分配
  assignWorkers();
  // 随机任务完成后清除，下次自动生成新的
  if (region.isRandom) clearRandomExpedition();
  const rewardSummary = rewardTexts.length ? `获得：${rewardTexts.join('、')}` : '';
  gameState.addNotification({ title: '考察完成', text: `${resident.name} 完成了${region.name}。${rewardSummary}`, type: 'success', icon: 'map' });
  const facts = buildExplorationFacts(region, resident, 'completed');
  const fallback = getNarrationFallback('exploration_log', facts);
  bus.emit('explore:completed', { region, resident, narration: fallback });
  aiClient.generate('exploration_log', facts, () => fallback).then(narration => bus.emit('explore:narration', { region, resident, phase: 'completed', narration }));
}

export function revealBiomeSector(biome) {
  const map = gameState.state.map;
  if (!map) return 0;
  let revealed = 0;
  for (const row of map) {
    for (const tile of row) {
      if (tile.type === biome && !tile.explored) {
        tile.explored = true;
        revealed++;
      }
    }
  }
  bus.emit('map:revealed', { biome, count: revealed });
  return revealed;
}

export function normalizeExplorationState() {
  if (!Array.isArray(gameState.state.exploredRegions)) gameState.state.exploredRegions = [];
  if (!Array.isArray(gameState.state.unlockedRegions)) gameState.state.unlockedRegions = ['nearby_caves'];
  const active = gameState.state.activeExploration;
  if (!active) return;
  if (active.isRandom) {
    if (!gameState.state.randomExpedition) { gameState.state.activeExploration = null; }
  } else if (!getExploreRegion(active.regionId) || !gameState.state.residents.some(r => r.id === active.residentId)) {
    gameState.state.activeExploration = null;
  }
}
