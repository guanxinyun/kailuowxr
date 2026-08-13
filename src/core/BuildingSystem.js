import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { isConnectedToHQ } from './Pathfinding.js';
import { getInventoryQuantity, addInventory } from './ProductionSystem.js';

const MAX_LEVEL = 3;

/** 3级升级所需加工品（按建筑类别） */
const UPGRADE_PRODUCTS = {
  science: { crystal_circuit: 1 },
  culture: { star_souvenir: 1 },
  _default: { alloy: 1 },
};

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

/** 升级到2级 +30星币，升级到3级 +80星币 */
const UPGRADE_CREDITS = { 2: 30, 3: 80 };

export function getUpgradeCost(building) {
  const data = getBuildingById(building.buildingId);
  const level = getBuildingLevel(building);
  if (!data || level >= MAX_LEVEL || building.buildingId === 'road' || building.buildingId === 'landing_pad') return null;
  const multiplier = 0.75 + level * 0.5;
  const sourceCost = Object.keys(data.cost).length ? data.cost : { metal: 20 };
  const cost = Object.fromEntries(
    Object.entries(sourceCost).map(([resource, amount]) => [resource, Math.max(1, Math.ceil(amount * multiplier))]),
  );
  const nextLevel = level + 1;
  if (UPGRADE_CREDITS[nextLevel]) cost.credits = UPGRADE_CREDITS[nextLevel];
  // 3级升级需要加工品
  const products = {};
  if (nextLevel === 3) {
    const category = data.category || 'basic';
    const required = UPGRADE_PRODUCTS[category] || UPGRADE_PRODUCTS._default;
    Object.assign(products, required);
  }
  return { ...cost, _products: Object.keys(products).length ? products : undefined };
}

export function upgradeBuilding(buildingId) {
  const building = gameState.state.buildings.find((entry) => entry.id === buildingId);
  if (!building) return { ok: false, reason: '找不到建筑' };
  const operation = getBuildingOperationalState(building);
  if (!operation.operational) return { ok: false, reason: operation.reason };
  const cost = getUpgradeCost(building);
  if (!cost) return { ok: false, reason: '该建筑无法继续升级' };

  // 检查加工品库存
  const products = cost._products;
  if (products) {
    for (const [productId, amount] of Object.entries(products)) {
      if (getInventoryQuantity(productId) < amount) {
        return { ok: false, reason: `加工品不足：需要 ${productId} ×${amount}` };
      }
    }
  }

  // 扣除基础资源和星币（排除 _products 字段）
  const resourceCost = Object.fromEntries(
    Object.entries(cost).filter(([k]) => k !== '_products'),
  );
  if (!gameState.spend(resourceCost)) return { ok: false, reason: '升级资源不足' };

  // 扣除加工品
  if (products) {
    for (const [productId, amount] of Object.entries(products)) {
      addInventory(productId, -amount);
    }
  }

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

export function demolishBuilding(buildingId) {
  const building = gameState.state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, reason: '找不到建筑' };
  if (building.buildingId === 'landing_pad') return { ok: false, reason: '降落点无法拆除' };

  const data = getBuildingById(building.buildingId);

  // 退还 50% 建造资源
  if (data?.cost) {
    for (const [resource, amount] of Object.entries(data.cost)) {
      gameState.addResource(resource, Math.floor(amount * 0.5));
    }
  }

  const removed = gameState.removeBuilding(buildingId);
  if (!removed) return { ok: false, reason: '移除失败' };

  bus.emit('building:demolished', { building: removed, data });
  gameState.addNotification({
    title: '设施已拆除',
    text: `${data?.name || '建筑'} 已拆除，回收了部分资源`,
    type: 'info',
    icon: 'hammer',
  });
  return { ok: true, building: removed };
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
