/**
 * 星尘殖民地 — 住房与招募系统
 * 每个住所住一个人；新居民通过「特殊探索事件」招募加入（不再自动增长）。
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { createRandomResident } from '../data/residents.js';
import { assignWorkers } from './BuildingSystem.js';

/**
 * 招募一名新居民（探索事件触发）。
 * 需要有空余住所（population < maxPopulation）。
 */
export function recruitResident() {
  const state = gameState.state;
  if (state.population >= state.maxPopulation) {
    return { ok: false, reason: '没有空余住所，请先建造住宅' };
  }

  const resident = createRandomResident(state.day, state.residents.length + 1);
  state.residents.push(resident);
  state.population = state.residents.length;
  assignWorkers();
  bus.emit('state:population', { value: state.population });

  gameState.addNotification({
    title: '新居民加入！',
    text: `${resident.name} 加入了殖民地。人口：${state.population}/${state.maxPopulation}`,
    type: 'success',
    icon: 'user-plus',
    duration: 4000,
  });
  return { ok: true, resident };
}
