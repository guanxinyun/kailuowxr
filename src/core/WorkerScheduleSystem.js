/**
 * 星尘殖民地 — 居民工作节奏与建筑储备
 * 每周 5 工作 2 休息；建筑产出累计到各自独立储备（building.buffer），
 * 储备达到上限即「储备已满」，需仓储中心/搬运站的居民搬运入库，否则产出停滞。
 */
import { gameState } from './GameState.js';
import { BALANCE } from '../data/balance.js';
import { getBuildingById } from '../data/buildings.js';
import {
  requiresWorker,
  getBuildingOperationalState,
  isWorkDay,
  getDispatchedResidents,
} from './BuildingSystem.js';
import { getCurrentBuildingDailyOutput, HAULABLE_RESOURCES } from './ResourceFlowSystem.js';

/**
 * 把当日产出累加进建筑储备，受单建筑储备上限封顶（超出部分视为停滞损失）。
 * 纯函数，便于测试。
 * @param {object} buffer 当前储备（按资源键，仅搬运类资源）
 * @param {object} output 当日产出（键为资源，值为数量）
 * @param {number} capacity 单建筑储备总上限
 * @returns {{ buffer: object, added: number, total: number }}
 */
export function accumulateBuffer(buffer, output, capacity) {
  const next = {};
  let total = 0;
  for (const [res, value] of Object.entries(buffer || {})) {
    next[res] = Number(value) || 0;
    total += next[res];
  }
  let added = 0;
  for (const [res, amount] of Object.entries(output || {})) {
    if (!HAULABLE_RESOURCES.includes(res)) continue;
    const amt = Number(amount) || 0;
    if (amt <= 0) continue;
    const space = capacity - total;
    if (space <= 0) break;
    const add = Math.min(amt, space);
    next[res] = (next[res] || 0) + add;
    total += add;
    added += add;
  }
  return { buffer: next, added, total };
}

/**
 * 建筑储备状态（用于 UI 展示「储备 x/上限」与停滞提示）。
 * @param {object} building 建筑实例
 * @returns {{ total: number, capacity: number, full: boolean }}
 */
export function getBuildingBufferStatus(building) {
  const capacity = BALANCE.buildingBuffer?.capacity ?? 5;
  const buffer = building?.buffer;
  const total = typeof buffer === 'object' && buffer
    ? Object.values(buffer).reduce((sum, v) => sum + (Number(v) || 0), 0)
    : (Number(buffer) || 0);
  return { total, capacity, full: total >= capacity };
}

/**
 * 每日工作节奏结算：
 * - 在岗日把每个需要居民的产出建筑的产出累计进独立储备（building.buffer）。
 * - 储备达到上限即「储备已满」，产出停滞（不再换岗，改由搬运居民缓解）。
 * - 休息日不产出，不累计。
 * @returns {{ stalled: string[] }} 本日储备已满而停滞的建筑 id 列表
 */
export function updateBuildingWorkCycle(state = gameState.state) {
  if (!isWorkDay(state.day)) return { stalled: [] };

  const capacity = BALANCE.buildingBuffer?.capacity ?? 5;
  const dispatched = getDispatchedResidents(state);
  const residents = state.residents || [];
  const stalled = [];

  for (const building of state.buildings || []) {
    if (!building.built || !requiresWorker(building) || !building.workerId) continue;
    if (dispatched.has(building.workerId)) continue;
    if (!getBuildingOperationalState(building).operational) continue;

    // 旧存档兼容：储备曾是数字，统一转为按资源键的对象
    if (typeof building.buffer !== 'object' || building.buffer === null) {
      building.buffer = {};
    }

    const output = getCurrentBuildingDailyOutput(building, state);
    const result = accumulateBuffer(building.buffer, output, capacity);
    building.buffer = result.buffer;

    if (result.total >= capacity && result.added <= 0) {
      stalled.push(building.id);
      if (!building.bufferFullNotified) {
        building.bufferFullNotified = true;
        const data = getBuildingById(building.buildingId);
        const resident = residents.find((r) => r.id === building.workerId);
        gameState.addNotification({
          title: '储备已满',
          text: `${data?.name || '设施'}储备已满，${resident?.name || '居民'}需仓储中心搬运入库`,
          type: 'info',
          icon: 'warehouse',
        });
      }
    } else if (result.total < capacity) {
      building.bufferFullNotified = false;
    }
  }

  return { stalled };
}
