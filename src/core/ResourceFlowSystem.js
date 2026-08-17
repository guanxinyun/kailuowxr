import { BALANCE } from '../data/balance.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { SEASONS, TERRAIN_BONUSES } from '../data/gamedata.js';
import { getBuildingEfficiency, getBuildingOperationalState } from './BuildingSystem.js';
import { getComboMultiplier } from './ComboSystem.js';

export const FLOW_RESOURCE_KEYS = ['metal', 'crystal', 'energy', 'food', 'research', 'credits'];
const RESOURCE_KEYS = FLOW_RESOURCE_KEYS;

// 需要实体储存与搬运的资源（研究点/星币为抽象资源，直接入账不经过建筑储备）
export const HAULABLE_RESOURCES = ['metal', 'crystal', 'energy', 'food'];

function emptyRates() {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]));
}

export function calculateBuildingDailyOutput(data, building = {}, context = {}) {
  if (!data?.effect || context.operational === false || building.built === false) return {};
  const levelEfficiency = context.levelEfficiency ?? (1 + (Math.max(1, building.level || 1) - 1) * 0.25);
  const globalEfficiency = context.globalEfficiency ?? 1;
  const output = {};
  for (const resource of RESOURCE_KEYS) {
    const base = Number(data.effect[resource]);
    if (!Number.isFinite(base) || base === 0) continue;
    let multiplier = BALANCE.buildingOutputRate * levelEfficiency * globalEfficiency;
    if (resource === 'metal' || resource === 'crystal') multiplier *= context.engineeringSkill ?? 1;
    if (resource === 'food') multiplier *= (context.farmingSkill ?? 1) * (context.foodMultiplier ?? 1);
    if (resource === 'energy') multiplier *= context.energyMultiplier ?? 1;
    if (resource === 'research') multiplier *= (context.researchSkill ?? 1) * (context.researchMultiplier ?? 1);
    multiplier *= context.terrainMultiplier ?? 1;
    multiplier *= typeof context.comboMultiplier === 'function' ? context.comboMultiplier(resource) : 1;
    output[resource] = base * multiplier;
  }
  if (data.effect.oxygen) output.energy = (output.energy || 0) + data.effect.oxygen * 0.08;
  if (data.effect.income) output.credits = (output.credits || 0) + data.effect.income * BALANCE.buildingOutputRate * levelEfficiency * globalEfficiency;
  if (data.effect.trade) output.credits = (output.credits || 0) + 2 * BALANCE.buildingOutputRate * levelEfficiency * globalEfficiency;
  return output;
}

export function calculateDailyResourceFlow(state, context = {}) {
  const production = emptyRates();
  const consumption = emptyRates();
  for (const building of state.buildings || []) {
    const data = context.getBuilding?.(building.buildingId);
    if (!data) continue;
    const buildingContext = context.getBuildingContext?.(building, data) || {};
    const output = calculateBuildingDailyOutput(data, building, buildingContext);
    for (const [resource, amount] of Object.entries(output)) production[resource] += amount;
  }
  consumption.food = Math.round(Math.max(0, Number(state.population) || 0) * BALANCE.foodPerResidentPerDay * 1000) / 1000;
  for (const [resource, amount] of Object.entries(context.continuousConsumption || {})) {
    if (resource in consumption && Number.isFinite(amount) && amount > 0) consumption[resource] += amount;
  }
  const net = emptyRates();
  for (const resource of RESOURCE_KEYS) net[resource] = production[resource] - consumption[resource];
  return { production, consumption, net };
}

function currentContext(building, state, dependencies = {}) {
  const residents = state.residents || [];
  const average = (skill) => residents.length
    ? residents.reduce((sum, resident) => sum + (resident.skills?.[skill] || 1), 0) / residents.length
    : 1;
  const season = SEASONS[state.season || 0] || SEASONS[0];
  const getOperational = dependencies.getOperational || getBuildingOperationalState;
  const getEfficiency = dependencies.getEfficiency || getBuildingEfficiency;
  const getCombo = dependencies.getCombo || ((type, context) => getComboMultiplier(type, context));

  // 地形加成：查找建筑所在格子的地形类型
  let terrainMult = 1;
  const map = state.map;
  if (map && map[building.y]?.[building.x]) {
    const tileType = map[building.y][building.x].type;
    const bonuses = TERRAIN_BONUSES[tileType];
    if (bonuses && bonuses[building.buildingId]) {
      terrainMult = bonuses[building.buildingId];
    }
  }

  return {
    operational: getOperational(building).operational,
    levelEfficiency: getEfficiency(building),
    globalEfficiency: 1 + (state.globalEfficiency || 0),
    engineeringSkill: 1 + (average('engineering') - 1) * 0.05,
    farmingSkill: 1 + (average('farming') - 1) * 0.05,
    researchSkill: 1 + (average('research') - 1) * 0.05,
    foodMultiplier: (season.effect?.food || 1) * (state.farmBonus || 1),
    energyMultiplier: season.effect?.energy || 1,
    researchMultiplier: (season.effect?.research || 1) * (state.researchBonus || 1),
    terrainMultiplier: terrainMult,
    comboMultiplier: (resource) => getCombo('building_output', { buildingId: building.buildingId, resource }),
  };
}

export function getCurrentBuildingDailyOutput(building, state = gameState.state, dependencies = {}) {
  const getBuilding = dependencies.getBuilding || getBuildingById;
  return calculateBuildingDailyOutput(getBuilding(building.buildingId), building, currentContext(building, state, dependencies));
}

export function getCurrentDailyResourceFlow(state = gameState.state) {
  return calculateDailyResourceFlow(state, {
    getBuilding: getBuildingById,
    getBuildingContext: (building) => currentContext(building, state),
  });
}

export function formatDailyRate(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
