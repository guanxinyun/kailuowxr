import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresHauler } from '../src/core/BuildingSystem.js';
import { accumulateBuffer, getBuildingBufferStatus } from '../src/core/WorkerScheduleSystem.js';

test('搬运建筑需要搬运居民，生产建筑不需要', () => {
  assert.equal(requiresHauler({ buildingId: 'warehouse' }), true);
  assert.equal(requiresHauler({ buildingId: 'logistics_station' }), true);
  assert.equal(requiresHauler({ buildingId: 'mine' }), false);
});

test('建筑储备只累加搬运类资源且受上限封顶', () => {
  const output = { metal: 3, food: 2, research: 10, credits: 5 };
  const result = accumulateBuffer({ metal: 0, food: 0 }, output, 4);
  assert.equal(result.total, 4);
  assert.equal(result.buffer.metal, 3);
  assert.equal(result.buffer.food, 1); // 空间只剩 1，食物 2 只入 1
  assert.equal(result.buffer.research, undefined); // 研究点不入储备
  assert.equal(result.buffer.credits, undefined);
});

test('储备已满时不再累加（产出停滞）', () => {
  const result = accumulateBuffer({ metal: 4 }, { metal: 2 }, 4);
  assert.equal(result.total, 4);
  assert.equal(result.buffer.metal, 4);
  assert.equal(result.added, 0);
});

test('储备状态报告总量与是否已满', () => {
  assert.deepEqual(getBuildingBufferStatus({ buffer: { metal: 2, food: 1 } }), {
    total: 3, capacity: 5, full: false,
  });
  assert.equal(getBuildingBufferStatus({ buffer: { metal: 5 } }).full, true);
  // 旧存档兼容：buffer 为数字时按数字读取
  assert.deepEqual(getBuildingBufferStatus({ buffer: 3 }), { total: 3, capacity: 5, full: false });
});
