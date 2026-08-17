/**
 * 星尘殖民地 — 月度维护费
 * 每月结算：每栋运营中建筑按类别扣星币，science/military/special 额外扣资源。
 * 数值本地确定（BALANCE.maintenance），AI 不参与；addResource 钳制，不产生负债。
 */
import { BALANCE } from '../data/balance.js';
import { getBuildingById } from '../data/buildings.js';
import { gameState } from './GameState.js';

// 不参与维护费的特殊建筑
const MAINTENANCE_EXEMPT = new Set(['road', 'landing_pad']);

/**
 * 执行月度维护费扣除。
 * @returns {{ credits: number, resources: object, breakdown: Array }}
 *   breakdown 便于简报/通知展示；resources 为 { energy, crystal, ... } 汇总扣除。
 */
export function runMonthlyMaintenance(state = gameState.state) {
  const config = BALANCE.maintenance;
  const summary = { credits: 0, resources: {}, buildings: 0 };
  const breakdown = [];

  for (const building of state.buildings || []) {
    if (!building.built || MAINTENANCE_EXEMPT.has(building.buildingId)) continue;
    const data = getBuildingById(building.buildingId);
    if (!data) continue;

    const category = data.category || 'basic';
    const credits = config.creditsByCategory[category] || 0;
    const resourceCost = config.resourceByCategory[category] || {};

    // 扣除星币（钳制在 0，避免负债）
    if (credits > 0) {
      gameState.addResource('credits', -credits);
      summary.credits += credits;
    }
    // 扣除额外资源
    for (const [resource, amount] of Object.entries(resourceCost)) {
      if (amount <= 0) continue;
      gameState.addResource(resource, -amount);
      summary.resources[resource] = (summary.resources[resource] || 0) + amount;
    }
    summary.buildings++;
    breakdown.push({ buildingId: building.buildingId, name: data.name, credits, resourceCost });
  }

  return { summary, breakdown };
}
