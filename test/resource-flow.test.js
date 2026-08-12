import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBuildingDailyOutput,
  calculateDailyResourceFlow,
  getCurrentBuildingDailyOutput,
  formatDailyRate,
} from '../src/core/ResourceFlowSystem.js';

test('采矿站按天持续产出基准金属', () => {
  const output = calculateBuildingDailyOutput(
    { id: 'mine', effect: { metal: 4 } },
    { buildingId: 'mine', built: true, level: 1 },
    { operational: true, engineeringSkill: 1 },
  );
  assert.equal(output.metal, 0.6);
});

test('停运建筑不产出', () => {
  const output = calculateBuildingDailyOutput(
    { id: 'mine', effect: { metal: 4 } },
    { buildingId: 'mine', built: true, level: 1 },
    { operational: false },
  );
  assert.deepEqual(output, {});
});

test('资源流显示人口口粮消耗与净变化', () => {
  const flow = calculateDailyResourceFlow({ population: 3, buildings: [] });
  assert.equal(flow.production.food, 0);
  assert.equal(flow.consumption.food, 0.9);
  assert.equal(flow.net.food, -0.9);
});

test('一次性加工原料不计入每日消耗', () => {
  const flow = calculateDailyResourceFlow({
    population: 0,
    buildings: [],
    production: { queue: [{ recipeId: 'alloy' }] },
  });
  assert.equal(flow.consumption.metal, 0);
  assert.equal(flow.consumption.energy, 0);
});

test('贸易建筑收入映射为每日星币产出', () => {
  const output = calculateBuildingDailyOutput(
    { id: 'trade_hub', effect: { income: 10, trade: true } },
    { buildingId: 'trade_hub', built: true, level: 1 },
    { operational: true },
  );
  assert.equal(output.credits, 1.8);
});

test('当前建筑产出可按实例ID从总流量上下文读取', () => {
  const state = { population: 0, season: 0, residents: [], buildings: [{ id: 'mine-1', buildingId: 'mine', built: true, level: 1 }] };
  const output = getCurrentBuildingDailyOutput(state.buildings[0], state, {
    getBuilding: () => ({ id: 'mine', effect: { metal: 4 } }),
    getOperational: () => ({ operational: true }),
    getEfficiency: () => 1,
    getCombo: () => 1,
  });
  assert.equal(output.metal, 0.6);
});

test('日产量格式不保留无意义尾零', () => {
  assert.equal(formatDailyRate(0.6), '0.6');
  assert.equal(formatDailyRate(1), '1');
  assert.equal(formatDailyRate(0.125), '0.13');
});
