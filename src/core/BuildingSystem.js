import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { isConnectedToHQ } from './Pathfinding.js';

const MAX_LEVEL = 3;

export function getBuildingLevel(building) {
  return Math.max(1, building.level || 1);
}

export function getBuildingEfficiency(building) {
  return 1 + (getBuildingLevel(building) - 1) * 0.25;
}

export function requiresRoadConnection(building) {
  return building.buildingId !== 'landing_pad' && building.buildingId !== 'road';
}

export function getBuildingOperationalState(building) {
  if (!building.built) return { operational: false, reason: '建造中' };
  if (!requiresRoadConnection(building)) return { operational: true, reason: '' };
  const connected = isConnectedToHQ(gameState.state.map, gameState.state.buildings, building.x, building.y);
  return connected ? { operational: true, reason: '' } : { operational: false, reason: '未通过道路连接降落点' };
}

export function getUpgradeCost(building) {
  const data = getBuildingById(building.buildingId);
  const level = getBuildingLevel(building);
  if (!data || level >= MAX_LEVEL || building.buildingId === 'road' || building.buildingId === 'landing_pad') return null;
  const multiplier = 0.75 + level * 0.5;
  const sourceCost = Object.keys(data.cost).length ? data.cost : { metal: 20 };
  return Object.fromEntries(
    Object.entries(sourceCost).map(([resource, amount]) => [resource, Math.max(1, Math.ceil(amount * multiplier))]),
  );
}

export function upgradeBuilding(buildingId) {
  const building = gameState.state.buildings.find((entry) => entry.id === buildingId);
  if (!building) return { ok: false, reason: '找不到建筑' };
  const operation = getBuildingOperationalState(building);
  if (!operation.operational) return { ok: false, reason: operation.reason };
  const cost = getUpgradeCost(building);
  if (!cost) return { ok: false, reason: '该建筑无法继续升级' };
  if (!gameState.spend(cost)) return { ok: false, reason: '升级资源不足' };
  building.level = getBuildingLevel(building) + 1;
  bus.emit('building:upgraded', { building, cost });
  gameState.addNotification({
    title: '设施升级完成',
    text: `${getBuildingById(building.buildingId).name} 已升级到 ${building.level} 级`,
    type: 'success',
    icon: 'arrow-up-circle',
  });
  return { ok: true, building };
}

export function getManagedBuildings() {
  return gameState.state.buildings
    .filter((building) => building.buildingId !== 'road')
    .map((building) => ({
      building,
      data: getBuildingById(building.buildingId),
      level: getBuildingLevel(building),
      efficiency: getBuildingEfficiency(building),
      operation: getBuildingOperationalState(building),
      upgradeCost: getUpgradeCost(building),
    }));
}
