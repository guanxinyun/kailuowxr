import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductFacts,
  buildTouristFacts,
  buildExplorationFacts,
  buildDiaryFacts,
  buildAnnualFacts,
  getNarrationFallback,
} from '../src/core/AIContentFacts.js';

test('产品事实保留固定ID和确定性配方', () => {
  const facts = buildProductFacts({ id: 'alloy', name: '星尘合金', inputs: { metal: 12 }, output: { id: 'alloy', quantity: 1 }, days: 2 }, { grade: 'A' });
  assert.deepEqual(facts, { id: 'alloy', baseName: '星尘合金', inputs: { metal: 12 }, outputQuantity: 1, days: 2, quality: 'A' });
});

test('游客评价事实只包含既定游览结果', () => {
  const facts = buildTouristFacts({ id: 't1', speciesName: '晶歌族', preference: { culture: 7 }, visitedStops: ['b1'], satisfaction: 83, spent: 20 });
  assert.equal(facts.satisfaction, 83);
  assert.deepEqual(facts.visitedStops, ['b1']);
  assert.equal(facts.spent, 20);
});

test('考察、日记和年度事实不暴露可修改状态', () => {
  assert.deepEqual(buildExplorationFacts({ id: 'snow', name: '寒霜边界', days: 5, rewards: { research: 8 } }, { name: '林月' }, 'completed'), { phase: 'completed', regionId: 'snow', regionName: '寒霜边界', days: 5, rewards: { research: 8 }, residentName: '林月' });
  assert.deepEqual(buildDiaryFacts({ name: '林月', mood: 70 }, [{ type: 'building', text: '农场完工' }]), { residentName: '林月', mood: 70, facts: [{ type: 'building', text: '农场完工' }] });
  assert.equal(buildAnnualFacts({ year: 2, grade: 'A', scores: { food: 8 }, awards: ['加工新星'] }).grade, 'A');
});

test('五类文案始终有本地回退', () => {
  for (const type of ['product_copy', 'tourist_personality', 'tourist_review', 'exploration_log', 'factual_diary', 'annual_summary']) {
    assert.ok(getNarrationFallback(type, {}).length > 0);
  }
});
