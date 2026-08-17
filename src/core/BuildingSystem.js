import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { BALANCE } from '../data/balance.js';
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
  let eff = 1 + (getBuildingLevel(building) - 1) * 0.25;

  // 景观建筑光环计算（生态观景塔加速农场，音乐喷泉加速工坊/工业）
  if (gameState.state?.buildings) {
    const data = getBuildingById(building.buildingId);
    const category = data?.category;

    for (const other of gameState.state.buildings) {
      if (!other.built) continue;
      const otherData = getBuildingById(other.buildingId);
      if (!otherData) continue;

      const dist = Math.max(Math.abs(other.x - building.x), Math.abs(other.y - building.y));

      // 生态观景塔：周围4格内农场/食物类生产速度+30%
      if (otherData.effect?.farmAuraRadius && dist <= otherData.effect.farmAuraRadius) {
        if (category === 'food' || building.buildingId === 'hydro_farm' || building.buildingId === 'greenhouse') {
          eff *= (1 + (otherData.effect.farmAuraSpeed || 0.30));
        }
      }

      // 引力漂浮音乐喷泉：周围4格内工坊与加工生产速度+25%
      if (otherData.effect?.workshopAuraRadius && dist <= otherData.effect.workshopAuraRadius) {
        if (building.buildingId === 'workshop' || category === 'basic' || category === 'science') {
          eff *= (1 + (otherData.effect.workshopAuraSpeed || 0.25));
        }
      }
    }
  }

  return eff;
}

export function requiresRoadConnection(building) {
  if (building.buildingId === 'landing_pad' || building.buildingId === 'road') return false;
  const data = getBuildingById(building.buildingId);
  if (data?.noRoadRequired || data?.category === 'scenery') return false;
  return true;
}

/** 今日是否为工作日在岗日（每周 workDays 天工作、其余休息） */
export function isWorkDay(day = gameState.state.day) {
  const schedule = BALANCE.workSchedule || { weekDays: 7, workDays: 5 };
  const weekDays = schedule.weekDays || 7;
  const workDays = schedule.workDays ?? 5;
  return ((day % weekDays) + weekDays) % weekDays < workDays;
}

export function getBuildingOperationalState(building) {
  if (!building.built) return { operational: false, reason: '建造中' };
  if (!requiresRoadConnection(building)) return { operational: true, reason: '' };
  const connected = isConnectedToHQ(gameState.state.map, gameState.state.buildings, building.x, building.y);
  if (!connected) return { operational: false, reason: '未通过道路连接降落点' };
  if (requiresWorker(building)) {
    if (!isWorkDay()) return { operational: false, reason: '居民休息日' };
    if (!building.workerId) return { operational: false, reason: '需要居民进入工作' };
  }
  return { operational: true, reason: '' };
}

/** 升级到2级 +30星币，升级到3级 +80星币 */
const UPGRADE_CREDITS = { 2: 30, 3: 80 };

export function getUpgradeCost(building) {
  const data = getBuildingById(building.buildingId);
  const level = getBuildingLevel(building);
  if (!data || level >= MAX_LEVEL || building.buildingId === 'road' || building.buildingId === 'landing_pad') return null;
  const multiplier = 0.75 + level * 0.5;
  const baseCredits = (data.cost && data.cost.credits) || 60;
  const nextLevel = level + 1;
  const cost = { credits: Math.ceil(baseCredits * multiplier) + (UPGRADE_CREDITS[nextLevel] || 0) };
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

  recalculatePopulationCapacity();
  assignWorkers();
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

/**
 * 重新计算人口上限：每个已建成的住所（effect.population）贡献对应容量。
 * 取代旧的「建造完成时固定累加」逻辑，保证与拆除/重建保持一致。
 */
export function recalculatePopulationCapacity() {
  const capacity = (gameState.state.buildings || []).reduce((sum, building) => {
    if (!building.built) return sum;
    const data = getBuildingById(building.buildingId);
    return sum + (data?.effect?.population || 0);
  }, 0);
  gameState.set('maxPopulation', capacity);
  return capacity;
}

// 无需居民工作的自动建筑（AI核心等）
const AUTONOMOUS_BUILDINGS = new Set(['ai_core']);
const WORKER_RESOURCE_KEYS = ['metal', 'crystal', 'energy', 'food', 'research', 'oxygen', 'income'];

/**
 * 判断建筑是否需要居民进入工作才会产出。
 * 产出资源（或综合工坊）的建筑需要一名居民；住所、道路、防御等自动运行。
 */
export function requiresWorker(building) {
  if (AUTONOMOUS_BUILDINGS.has(building.buildingId)) return false;
  const data = getBuildingById(building.buildingId);
  const effect = data?.effect || {};
  if (effect.production) return true; // 综合工坊需要居民操作
  return WORKER_RESOURCE_KEYS.some((key) => (effect[key] || 0) > 0);
}

/**
 * 判断建筑是否需要一名搬运居民（仓储中心/搬运站）。
 * 搬运建筑不产出资源，但需要有居民把周边建筑的储备搬进全局库存。
 */
export function requiresHauler(building) {
  const data = getBuildingById(building.buildingId);
  return Boolean(data?.effect?.haulRadius);
}

/** 被派遣探索的居民不可工作（区域考察 + 区块探索） */
export function getDispatchedResidents(state = gameState.state) {
  const dispatched = new Set();
  const active = state.activeExploration;
  if (active?.residentId) dispatched.add(active.residentId);
  for (const be of state.blockExplorations || []) {
    for (const rid of be.residentIds || []) dispatched.add(rid);
  }
  return dispatched;
}

/**
 * 自动为需要工人的建筑分配居民（每个建筑一名，被派遣探索的居民不可工作）。
 * 优化调度防饥饿机制：
 * 1. 工坊（有正在加工任务队列）拥有最高工人优先级，防止工坊断工。
 * 2. 玩家手动标记 `priority: true` 的设施优先分配。
 * 3. 产出设施若储备已满，优先级降低，让位给有生产空间的设施与搬运工。
 * 4. 搬运建筑在有已满/待搬运设施时提高优先级。
 */
export function assignWorkers() {
  const state = gameState.state;
  const buildings = state.buildings || [];
  const residents = state.residents || [];
  const dispatched = getDispatchedResidents(state);

  for (const building of buildings) delete building.workerId;

  // 可用居民池
  const pool = residents.filter((r) => !dispatched.has(r.id));
  if (!pool.length) return buildings.filter((b) => b.built && (requiresWorker(b) || requiresHauler(b))).length;

  // 洗牌居民
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 评估每个建筑的劳动力紧迫度权重
  const candidates = [];
  const hasQueue = (state.production?.queue?.length || 0) > 0;

  for (const b of buildings) {
    if (!b.built) continue;
    const isWorker = requiresWorker(b);
    const isHauler = requiresHauler(b);
    if (!isWorker && !isHauler) continue;

    let priorityScore = 10;
    if (b.priority) priorityScore += 50;

    // 工坊且有加工任务
    if (b.buildingId === 'workshop' && hasQueue) {
      priorityScore += 100;
    }
    // 高级工坊（量子精密合成仪、奇迹铸造厂等）
    if ((b.buildingId === 'quantum_assembler' || b.buildingId === 'miracle_foundry' || b.buildingId?.startsWith('workshop_')) && hasQueue) {
      priorityScore += 120;
    }

    // 检查储备状态
    const buffer = b.buffer || {};
    const totalBuffer = typeof buffer === 'object' ? Object.values(buffer).reduce((sum, v) => sum + (Number(v) || 0), 0) : Number(buffer) || 0;
    const capacity = BALANCE.buildingBuffer?.capacity ?? 5;

    if (isWorker) {
      if (totalBuffer >= capacity) {
        // 储备满了，没搬走前产出停滞，降低工人紧迫度
        priorityScore -= 8;
      } else {
        priorityScore += (capacity - totalBuffer) * 2;
      }
    } else if (isHauler) {
      // 搬运站：若周围有设施储备较多，搬运需求大增
      priorityScore += 15;
    }

    candidates.push({ building: b, score: priorityScore });
  }

  // 按权重降序排序分配
  candidates.sort((a, b) => b.score - a.score);

  const used = new Set();
  for (const item of candidates) {
    const resident = pool.find((r) => !used.has(r.id));
    if (resident) {
      item.building.workerId = resident.id;
      used.add(resident.id);
    }
  }

  return buildings.filter((building) => building.built && (requiresWorker(building) || requiresHauler(building))).length;
}
