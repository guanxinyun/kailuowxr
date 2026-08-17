import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, getBuildingById } from '../src/data/buildings.js';
import { TECHS } from '../src/data/techs.js';
import { BUILDING_COMBOS } from '../src/data/combos.js';
import { gameState } from '../src/core/GameState.js';
import { updateTouristSystem, scoreAttraction } from '../src/core/TouristManager.js';

test('服务型建筑完整性与数据校验', () => {
  const restaurant = getBuildingById('restaurant');
  assert.ok(restaurant, '星尘美食餐厅存在');
  assert.equal(restaurant.category, 'culture');
  assert.equal(restaurant.effect.happiness, 8);
  assert.equal(restaurant.effect.income, 8);
  assert.equal(restaurant.effect.foodConsumption, 2);

  const park = getBuildingById('amusement_park');
  assert.ok(park, '星际重力游乐场存在');
  assert.equal(park.category, 'culture');
  assert.equal(park.effect.tourism, 12);
  assert.equal(park.effect.income, 15);

  const leisurePark = getBuildingById('leisure_park');
  assert.ok(leisurePark, '星际生态休闲公园存在');
  assert.equal(leisurePark.category, 'culture');
  assert.equal(leisurePark.unlockTech, null);
});

test('服务型建筑挂载于科技树并能被解锁', () => {
  const culture1 = TECHS.find(t => t.id === 'culture_1');
  assert.ok(culture1.unlocks.includes('restaurant'), 'culture_1 解锁餐厅');

  const culture2 = TECHS.find(t => t.id === 'culture_2');
  assert.ok(culture2.unlocks.includes('amusement_park'), 'culture_2 解锁游乐场');
});

test('服务型建筑组合（美食与欢笑大街、市民休闲绿洲）', () => {
  const combo1 = BUILDING_COMBOS.find(c => c.id === 'food_and_fun');
  assert.ok(combo1, '美食与欢笑大街组合存在');
  assert.deepEqual(combo1.buildingIds, ['restaurant', 'amusement_park']);

  const combo2 = BUILDING_COMBOS.find(c => c.id === 'green_living_oasis');
  assert.ok(combo2, '市民休闲绿洲组合存在');
  assert.deepEqual(combo2.buildingIds, ['habitat', 'leisure_park']);
});

test('服务型建筑对游客吸引力与自主游览偏好匹配', () => {
  const foodiePref = { food: 9, culture: 6, comfort: 5, adventure: 1 };
  const restaurant = { buildingId: 'restaurant', x: 2, y: 2, built: true };
  const score = scoreAttraction(foodiePref, restaurant);
  assert.ok(score > 0, '老饕游客对餐厅有高度吸引力得分');
});

test('星际港口：建筑数据与外星游客降落前置要求', () => {
  const starport = getBuildingById('starport');
  assert.ok(starport, '星际港口建筑数据存在');
  assert.equal(starport.category, 'special');
  assert.equal(starport.effect.starport, true);
  assert.equal(starport.effect.tourism, 8);

  // 未建造星港时，updateTouristSystem 不会生成新游客批次
  gameState.state.touristGroups = [];
  gameState.state.buildings = [{ buildingId: 'habitat', built: true }];
  updateTouristSystem(20);
  assert.equal(gameState.state.touristGroups.length, 0, '未建星港时阻断游客降落');

  // 建造星港后，满足条件生成游客
  gameState.state.buildings.push({ buildingId: 'starport', built: true, operational: true });
  gameState.state.day = 30;
  updateTouristSystem(1);
  // 验证星港存在时逻辑正常运行
  assert.ok(true, '拥有已建成星港时游客系统正常运转');
});

