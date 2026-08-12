/**
 * 星尘殖民地 — 地图拓展系统
 * 购买后从已探索边缘向外均匀扩散 stripDepth 层
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { MAP_EXPANSION } from '../data/gamedata.js';
import { BALANCE } from '../data/balance.js';

/**
 * 计算当前拓展费用
 */
export function getExpansionCost() {
  const count = gameState.state.mapExpansion.count || 0;
  const multiplier = 1 + count * BALANCE.mapExpansion.costMultiplier;
  const cost = {};
  for (const [res, base] of Object.entries(MAP_EXPANSION.baseCost)) {
    cost[res] = Math.ceil(base * multiplier);
  }
  return cost;
}

/**
 * 检查地图是否还有未探索地块
 */
function hasUnexplored() {
  const map = gameState.state.map;
  if (!map) return false;
  for (const row of map) {
    for (const tile of row) {
      if (!tile.explored) return true;
    }
  }
  return false;
}

/**
 * 检查是否可以购买拓展
 */
export function canExpand() {
  if (!hasUnexplored()) return { ok: false, reason: '地图已完全探索' };
  const cost = getExpansionCost();
  if (!gameState.canAfford(cost)) return { ok: false, reason: '资源不足' };
  return { ok: true, cost };
}

/**
 * 从已探索边缘向外均匀扩散 stripDepth 层
 */
function revealLayers() {
  const map = gameState.state.map;
  if (!map) return 0;
  const size = map.length;
  const depth = BALANCE.mapExpansion.stripDepth;
  let revealed = 0;

  for (let layer = 0; layer < depth; layer++) {
    const toReveal = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (map[y][x].explored) continue;
        const hasExploredNeighbor =
          (y > 0 && map[y - 1][x].explored) ||
          (y < size - 1 && map[y + 1][x].explored) ||
          (x > 0 && map[y][x - 1].explored) ||
          (x < size - 1 && map[y][x + 1].explored);
        if (hasExploredNeighbor) toReveal.push({ y, x });
      }
    }
    if (toReveal.length === 0) break;
    for (const { y, x } of toReveal) {
      map[y][x].explored = true;
      revealed++;
    }
  }
  return revealed;
}

/**
 * 购买地图拓展
 */
export function purchaseExpansion() {
  const check = canExpand();
  if (!check.ok) return check;
  gameState.spend(check.cost);
  const revealed = revealLayers();
  gameState.state.mapExpansion.count = (gameState.state.mapExpansion.count || 0) + 1;
  bus.emit('map:expanded', { revealed });
  gameState.addNotification({ title: '地图拓展', text: `向外探明了 ${revealed} 个地块。`, type: 'success', icon: 'map' });
  return { ok: true, revealed };
}
