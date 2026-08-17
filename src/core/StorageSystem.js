/**
 * 星尘殖民地 — 多实体仓库系统 (Multi-Warehouse Storage System)
 * 每座仓储中心(warehouse)独立拥有容量上限（如 100/座，升级更高）。
 * 支持无视距离的跨仓调拨与统一调度：
 * 1. 产出入库时优先填满最近仓库，满了自动路由分流至其他有空位的仓库；
 * 2. 消耗/加工/上架时从任一有存货的仓库调拨；
 * 3. 全局所有实体仓库均满时，全殖民地仓储饱和，产出停滞并告警。
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { getBuildingLevel, getBuildingOperationalState } from './BuildingSystem.js';

const DEFAULT_BASE_CAPACITY = 60; // 降落点默认自带的基础应急小容量
const CAPACITY_PER_WAREHOUSE_LEVEL = 100; // 每级仓库增加 100 独立容量

/** 获取全殖民地所有已建成的运营中仓库实例 */
export function getOperationalWarehouses(state = gameState.state) {
  return (state.buildings || []).filter(
    (b) => b.built && b.buildingId === 'warehouse' && getBuildingOperationalState(b).operational
  );
}

/** 计算单座仓库的最大容量 */
export function getSingleWarehouseCapacity(warehouse) {
  const level = getBuildingLevel(warehouse);
  return level * CAPACITY_PER_WAREHOUSE_LEVEL;
}

/** 确保单座仓库的实体 storage 数据结构初始化 */
export function ensureWarehouseStorage(warehouse) {
  if (!warehouse.stored) {
    warehouse.stored = {};
  }
  return warehouse.stored;
}

/** 获取单座仓库当前已占用的总库容量 */
export function getWarehouseOccupied(warehouse) {
  const stored = ensureWarehouseStorage(warehouse);
  return Object.values(stored).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

/** 获取单座仓库剩余可用空位 */
export function getWarehouseFreeSpace(warehouse) {
  const cap = getSingleWarehouseCapacity(warehouse);
  const occ = getWarehouseOccupied(warehouse);
  return Math.max(0, cap - occ);
}

/**
 * 获取全殖民地仓储总览统计
 * @returns {{totalCapacity: number, totalUsed: number, freeSpace: number, warehousesCount: number, isFull: boolean}}
 */
export function getColonyStorageStats(state = gameState.state) {
  const warehouses = getOperationalWarehouses(state);
  const warehouseCap = warehouses.reduce((sum, w) => sum + getSingleWarehouseCapacity(w), 0);
  const totalCapacity = DEFAULT_BASE_CAPACITY + warehouseCap;

  // 统计所有初级实体物资以及加工品总占用
  let totalUsed = 0;
  for (const res of ['metal', 'crystal', 'energy', 'food']) {
    totalUsed += Math.floor(state.resources?.[res] || 0);
  }
  for (const entry of Object.values(state.production?.inventory || {})) {
    totalUsed += entry?.quantity || 0;
  }

  const freeSpace = Math.max(0, totalCapacity - totalUsed);
  return {
    totalCapacity,
    totalUsed,
    freeSpace,
    warehousesCount: warehouses.length,
    isFull: freeSpace <= 0,
  };
}

/**
 * 跨仓调拨存入物资/加工品
 * 无视物理距离自动分流：优先就近，满了自动路由存入任一有空位的仓库
 * @param {string} itemId 资源或加工品 ID
 * @param {number} amount 存入数量
 * @param {Object} preferredOrigin 优先考虑的起始/就近建筑位置
 * @returns {{added: number, overflow: number}}
 */
export function dispatchItemToStorage(itemId, amount, preferredOrigin = null, state = gameState.state) {
  if (amount <= 0) return { added: 0, overflow: 0 };
  const stats = getColonyStorageStats(state);
  const actualAdd = Math.min(amount, stats.freeSpace);
  const overflow = amount - actualAdd;

  if (actualAdd > 0) {
    const warehouses = getOperationalWarehouses(state);
    let remainingToStore = actualAdd;

    // 按与 preferredOrigin 的距离排序（若有）
    if (preferredOrigin) {
      warehouses.sort((a, b) => {
        const distA = Math.abs(a.x - preferredOrigin.x) + Math.abs(a.y - preferredOrigin.y);
        const distB = Math.abs(b.x - preferredOrigin.x) + Math.abs(b.y - preferredOrigin.y);
        return distA - distB;
      });
    }

    for (const w of warehouses) {
      if (remainingToStore <= 0) break;
      const space = getWarehouseFreeSpace(w);
      if (space <= 0) continue;
      const move = Math.min(remainingToStore, space);
      const stored = ensureWarehouseStorage(w);
      stored[itemId] = (stored[itemId] || 0) + move;
      remainingToStore -= move;
    }
  }

  return { added: actualAdd, overflow };
}

/**
 * 跨仓调拨提取物资/加工品
 * @param {string} itemId 资源或加工品 ID
 * @param {number} amount 提取数量
 * @returns {number} 实际成功提取的数量
 */
export function extractItemFromStorage(itemId, amount, state = gameState.state) {
  if (amount <= 0) return 0;
  const warehouses = getOperationalWarehouses(state);
  let remainingToTake = amount;

  for (const w of warehouses) {
    if (remainingToTake <= 0) break;
    const stored = ensureWarehouseStorage(w);
    const available = stored[itemId] || 0;
    if (available <= 0) continue;
    const take = Math.min(remainingToTake, available);
    stored[itemId] -= take;
    if (stored[itemId] <= 0) delete stored[itemId];
    remainingToTake -= take;
  }

  return amount - remainingToTake;
}
