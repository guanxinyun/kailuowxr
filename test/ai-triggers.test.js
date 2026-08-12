import test from 'node:test';
import assert from 'node:assert/strict';
import { createAITriggerState, recordMilestone, updateShortages, canCreateProposal } from '../src/core/AITriggerSystem.js';

test('同一里程碑只记录一次', () => {
  const state = createAITriggerState();
  assert.equal(recordMilestone(state, 'biome:snow'), true);
  assert.equal(recordMilestone(state, 'biome:snow'), false);
});

test('资源需连续短缺达到阈值且恢复会清零', () => {
  const state = createAITriggerState();
  for (let day = 1; day < 5; day++) assert.deepEqual(updateShortages(state, { food: 10 }, day), []);
  assert.deepEqual(updateShortages(state, { food: 10 }, 5), ['food']);
  updateShortages(state, { food: 30 }, 6);
  assert.equal(state.shortages.food.days, 0);
});

test('提案遵守待确认上限和冷却', () => {
  const state = createAITriggerState();
  assert.equal(canCreateProposal(state, 'building_proposal', 10, 2), true);
  state.lastTriggered.building_proposal = 10;
  assert.equal(canCreateProposal(state, 'building_proposal', 20, 2), false);
  assert.equal(canCreateProposal(state, 'building_proposal', 200, 3), false);
});
