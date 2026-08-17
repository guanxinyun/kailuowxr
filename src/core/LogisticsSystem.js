/**
 * 星尘殖民地 — 仓储搬运系统
 * 仓储中心/搬运站（effect.haulRadius）需要一名搬运居民（workerId），
 * 每个在岗日把搬运范围内生产建筑的储备（building.buffer）搬进全局库存。
 * 没有搬运居民或仓储中心时，产出会堆积在各建筑储备里，满则停滞。
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { getBuildingOperationalState, isWorkDay } from './BuildingSystem.js';
import { HAULABLE_RESOURCES } from './ResourceFlowSystem.js';
import { BALANCE } from '../data/balance.js';

function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * 每日结算仓储搬运：把搬运范围内生产建筑的储备搬进全局库存。
 * 在每日资源流结算之后调用（产出已累计进各建筑储备）。
 * @returns {{hauled: number}}
 */
export function updateWarehouseHauling(state = gameState.state) {
  if (!isWorkDay(state.day)) return { hauled: 0 };

  const cfg = BALANCE.logistics || { haulPerDay: 12 };
  const buildings = state.buildings || [];
  const haulers = buildings.filter((b) => {
    if (!b.built || !b.workerId) return false;
    if (!getBuildingById(b.buildingId)?.effect?.haulRadius) return false;
    return getBuildingOperationalState(b).operational;
  });
  if (!haulers.length) return { hauled: 0 };

  let hauled = 0;
  for (const hauler of haulers) {
    const data = getBuildingById(hauler.buildingId);
    const radius = data?.effect?.haulRadius ?? 3;
    let budget = cfg.haulPerDay;

    const sources = buildings.filter((b) =>
      b !== hauler && b.built && typeof b.buffer === 'object' && b.buffer
        && chebyshev(hauler, b) <= radius,
    );

    for (const src of sources) {
      if (budget <= 0) break;
      for (const res of HAULABLE_RESOURCES) {
        const amount = Number(src.buffer?.[res]) || 0;
        if (amount <= 0 || budget <= 0) continue;
        const max = state.storage?.[res];
        const space = Number.isFinite(max) ? Math.max(0, max - (state.resources?.[res] || 0)) : Infinity;
        if (space <= 0) continue;
        const move = Math.min(amount, budget, space);
        if (move <= 0) continue;
        src.buffer[res] = amount - move;
        gameState.addResource(res, move);
        budget -= move;
        hauled += move;
      }
    }
  }

  if (hauled > 0) {
    bus.emit('logistics:hauled', { hauled });
  }
  return { hauled };
}
