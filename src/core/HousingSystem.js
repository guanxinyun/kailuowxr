/**
 * 星尘殖民地 — 住房与招募系统
 * 每个住宅专属绑定一位居民；随居民等级提升，房屋自动就地升级翻修。
 * 新居民通过「特殊探索事件」招募加入。
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { createRandomResident } from '../data/residents.js';
import { assignWorkers } from './BuildingSystem.js';

/**
 * 自动为未分配住所的居民绑定空闲住宅
 */
export function assignResidentHouses() {
  const state = gameState.state;
  const residents = state.residents || [];
  const houses = (state.buildings || []).filter((b) => b.buildingId === 'habitat' && b.built);

  const occupiedHouseIds = new Set(residents.map((r) => r.houseId).filter(Boolean));

  for (const resident of residents) {
    if (!resident.houseId || !houses.some((h) => h.id === resident.houseId)) {
      const freeHouse = houses.find((h) => !occupiedHouseIds.has(h.id));
      if (freeHouse) {
        resident.houseId = freeHouse.id;
        freeHouse.residentId = resident.id;
        occupiedHouseIds.add(freeHouse.id);
      }
    } else {
      const house = houses.find((h) => h.id === resident.houseId);
      if (house) house.residentId = resident.id;
    }
  }
}

/**
 * 招募一名新居民（探索事件触发）。
 * 需要有空余住所（population < maxPopulation）。
 */
export function recruitResident() {
  const state = gameState.state;
  if (state.population >= state.maxPopulation) {
    return { ok: false, reason: '没有空余住所，请先建造居住舱' };
  }

  const resident = createRandomResident(state.day, state.residents.length + 1);
  state.residents.push(resident);
  state.population = state.residents.length;
  assignResidentHouses();
  assignWorkers();
  bus.emit('state:population', { value: state.population });

  gameState.addNotification({
    title: '新居民加入！',
    text: `${resident.name} 入住了专属居住舱。人口：${state.population}/${state.maxPopulation}`,
    type: 'success',
    icon: 'user-plus',
    duration: 4000,
  });
  return { ok: true, resident };
}
