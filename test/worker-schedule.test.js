import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkDay, requiresWorker } from '../src/core/BuildingSystem.js';

test('每周 5 工作 2 休息的节奏正确', () => {
  // day 0..6 代表一周：0-4 在岗，5-6 休息
  const week = [0, 1, 2, 3, 4, 5, 6];
  assert.deepEqual(week.map((d) => isWorkDay(d)), [true, true, true, true, true, false, false]);
});

test('休息日跨周保持 5 工作 2 休息', () => {
  assert.equal(isWorkDay(5), false);
  assert.equal(isWorkDay(6), false);
  assert.equal(isWorkDay(7), true);
  assert.equal(isWorkDay(12), false); // 第二周第 5 天
  assert.equal(isWorkDay(13), false);
  assert.equal(isWorkDay(14), true);
});

test('产出资源的建筑需要居民工作', () => {
  assert.equal(requiresWorker({ buildingId: 'mine' }), true);
  assert.equal(requiresWorker({ buildingId: 'hydro_farm' }), true);
  assert.equal(requiresWorker({ buildingId: 'lab' }), true);
});

test('无产出资源效果的建筑无需居民工作', () => {
  assert.equal(requiresWorker({ buildingId: 'plaza' }), false);
  assert.equal(requiresWorker({ buildingId: 'museum' }), false);
  assert.equal(requiresWorker({ buildingId: 'warehouse' }), false);
});
