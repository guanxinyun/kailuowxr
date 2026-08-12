import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { EXPLORE_REGIONS } from '../data/gamedata.js';
import { addInventory, getInventoryQuantity } from './ProductionSystem.js';
import { addResidentExperience, normalizeResidentGrowth } from './ResidentGrowthSystem.js';
import { aiClient } from '../ai/AIClient.js';
import { buildExplorationFacts, getNarrationFallback } from './AIContentFacts.js';

export function getExploreRegion(regionId) {
  return EXPLORE_REGIONS.find(region => region.id === regionId) || null;
}

export function canStartExpedition(regionId, residentId) {
  const region = getExploreRegion(regionId);
  if (!region) return { ok: false, reason: '找不到考察区域' };
  if (gameState.state.activeExploration) return { ok: false, reason: '已有考察正在进行' };
  if (gameState.state.exploredRegions.includes(regionId)) return { ok: false, reason: '该区域已经完成考察' };
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
  };
  const facts = buildExplorationFacts(region, resident, 'started');
  const fallback = getNarrationFallback('exploration_log', facts);
  bus.emit('explore:started', { region, resident, exploration: gameState.state.activeExploration, narration: fallback });
  aiClient.generate('exploration_log', facts, () => fallback).then(narration => bus.emit('explore:narration', { region, resident, phase: 'started', narration }));
  return { ok: true, exploration: gameState.state.activeExploration };
}

export function updateExplorationSystem() {
  const active = gameState.state.activeExploration;
  if (!active) return;
  const region = getExploreRegion(active.regionId);
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
  if (!gameState.state.exploredRegions.includes(region.id)) gameState.state.exploredRegions.push(region.id);
  for (const [reward, amount] of Object.entries(region.rewards || {})) {
    if (reward in gameState.state.resources) gameState.addResource(reward, amount);
    else addInventory(reward, amount, 50);
  }
  if (region.biome) revealBiomeSector(region.biome);
  addResidentExperience(resident, 35 + (region.difficulty || region.danger || 1) * 8, 'survival', `完成${region.name}`);
  gameState.state.activeExploration = null;
  gameState.addNotification({ title: '考察完成', text: `${resident.name} 完成了${region.name}，地图与记录已更新。`, type: 'success', icon: 'map' });
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
  const active = gameState.state.activeExploration;
  if (!active) return;
  if (!getExploreRegion(active.regionId) || !gameState.state.residents.some(r => r.id === active.residentId)) {
    gameState.state.activeExploration = null;
  }
}
