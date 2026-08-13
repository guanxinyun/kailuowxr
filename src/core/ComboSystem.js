import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { BUILDING_COMBOS, getBuildingCombo } from '../data/combos.js';
import { getBuildingOperationalState } from './BuildingSystem.js';

function getComboState() {
  if (!gameState.state.combos) gameState.state.combos = { active: [], discovered: [] };
  return gameState.state.combos;
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findActiveInstance(combo) {
  const candidates = combo.buildingIds.map((buildingId) =>
    gameState.state.buildings.filter((building) =>
      building.built && building.buildingId === buildingId && getBuildingOperationalState(building).operational
    )
  );
  if (candidates.some((group) => group.length === 0)) return null;

  // 贪心搜索：从第一组开始，逐步匹配后续组，确保不重复选择同一建筑
  for (const first of candidates[0]) {
    const selected = [first];
    const usedIds = new Set([first.id]);
    let valid = true;
    for (let index = 1; index < candidates.length; index++) {
      const match = candidates[index].find((building) =>
        !usedIds.has(building.id) &&
        selected.every((chosen) => distance(chosen, building) <= combo.maxDistance)
      );
      if (!match) {
        valid = false;
        break;
      }
      selected.push(match);
      usedIds.add(match.id);
    }
    if (valid) return selected.map((building) => building.id);
  }
  return null;
}

export function evaluateCombos({ notify = true } = {}) {
  const comboState = getComboState();
  const previous = new Set(comboState.active);
  const next = [];

  for (const combo of BUILDING_COMBOS) {
    const instance = findActiveInstance(combo);
    if (!instance) continue;
    next.push(combo.id);
    if (!comboState.discovered.includes(combo.id)) {
      comboState.discovered.push(combo.id);
      if (notify) {
        gameState.addNotification({
          title: `发现组合：${combo.name}`,
          text: `${combo.description} ${combo.effectText}`,
          type: 'success',
          icon: combo.icon,
          duration: 5000,
        });
      }
      bus.emit('combo:discovered', { combo, buildingIds: instance });
    } else if (!previous.has(combo.id)) {
      bus.emit('combo:activated', { combo, buildingIds: instance });
    }
  }

  for (const comboId of previous) {
    if (!next.includes(comboId)) bus.emit('combo:deactivated', { combo: getBuildingCombo(comboId) });
  }
  comboState.active = next;
  bus.emit('combos:changed', { active: [...next], discovered: [...comboState.discovered] });
  return getComboSummary();
}

export function isComboActive(comboId) {
  return getComboState().active.includes(comboId);
}

export function getComboMultiplier(type, context = {}) {
  let multiplier = 1;
  for (const comboId of getComboState().active) {
    const combo = getBuildingCombo(comboId);
    for (const effect of combo?.effects || []) {
      if (effect.type !== type) continue;
      if (effect.buildingIds && context.buildingId && !effect.buildingIds.includes(context.buildingId)) continue;
      if (effect.resource && context.resource && effect.resource !== context.resource) continue;
      multiplier *= effect.multiplier || 1;
    }
  }
  return multiplier;
}

export function getComboBonus(type) {
  let bonus = 0;
  for (const comboId of getComboState().active) {
    const combo = getBuildingCombo(comboId);
    for (const effect of combo?.effects || []) {
      if (effect.type === type) bonus += effect.bonus || 0;
    }
  }
  return bonus;
}

export function getComboSummary() {
  const state = getComboState();
  return {
    active: state.active.map(getBuildingCombo).filter(Boolean),
    discovered: state.discovered.map(getBuildingCombo).filter(Boolean),
  };
}
