import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateResidentCards,
  generateChallenge,
  evaluateRound,
  rollExplorationDie,
  calculateRewards,
  getAllSkillTypes,
} from '../src/core/CardGameSystem.js';
import { applyChallengeRewards } from '../src/core/BlockExplorationSystem.js';
import { gameState } from '../src/core/GameState.js';

test('技能≥3 才生成卡牌，且每人最多 4 张、按数值降序', () => {
  gameState.state.residents = [
    {
      id: 'r1', name: '阿星',
      skills: { combat: 5, engineering: 3, research: 2, farming: 4, social: 6, survival: 1 },
      proficiency: { social: 3 },
    },
  ];
  const cards = generateResidentCards(['r1']);
  assert.equal(cards.length, 4); // research(2)、survival(1) 被过滤
  assert.deepEqual(cards.map((c) => c.type), ['social', 'combat', 'farming', 'engineering']);
  assert.equal(cards[0].value, 6);
  assert.equal(cards[0].special, true); // 对应 proficiency ≥ 3
  assert.equal(cards[1].special, false);
});

test('挑战轮次 2-3 轮，需求数值在配置范围内', () => {
  const types = new Set(getAllSkillTypes());
  for (let i = 0; i < 20; i++) {
    const challenge = generateChallenge('plains', 10);
    assert.ok(challenge.rounds.length >= 2 && challenge.rounds.length <= 3);
    for (const round of challenge.rounds) {
      // 任意类型门槛高于具体类型（可出任意牌）
      if (round.type === 'any') {
        assert.ok(round.required >= 12 && round.required <= 16);
      } else {
        assert.ok(round.required >= 8 && round.required <= 12);
      }
      assert.ok(round.type === 'any' || types.has(round.type));
    }
  }
});

test('同类型卡牌求和判定过关', () => {
  const requirement = { type: 'combat', required: 10 };
  // 4 + 6 = 10 ≥ 10 → 过关
  assert.equal(evaluateRound([{ type: 'combat', value: 4 }, { type: 'combat', value: 6 }], requirement).passed, true);
  // 只累加同类型：combat 4（engineering 9 被忽略）→ 4 < 10 → 失败
  assert.equal(evaluateRound([{ type: 'combat', value: 4 }, { type: 'engineering', value: 9 }], requirement).passed, false);
  // 2 + 3 = 5 < 10 → 失败
  assert.equal(evaluateRound([{ type: 'combat', value: 2 }, { type: 'combat', value: 3 }], requirement).passed, false);
});

test('「任意」类型对所有选中卡求和', () => {
  const requirement = { type: 'any', required: 10 };
  // 6 + 5 = 11 ≥ 10 → 过关
  assert.equal(evaluateRound([{ type: 'farming', value: 6 }, { type: 'social', value: 5 }], requirement).passed, true);
  // 3 + 2 = 5 < 10 → 失败
  assert.equal(evaluateRound([{ type: 'farming', value: 3 }, { type: 'social', value: 2 }], requirement).passed, false);
  assert.equal(evaluateRound([], requirement).passed, false);
});

test('探索骰运气计入总分', () => {
  const requirement = { type: 'combat', required: 10 };
  // 卡牌和 9：骰子 +1 → 10 过关；骰子 -2 → 7 失败
  assert.equal(evaluateRound([{ type: 'combat', value: 9 }], requirement, 1).passed, true);
  assert.equal(evaluateRound([{ type: 'combat', value: 9 }], requirement, -2).passed, false);
});

test('探索骰在 d6 与运气范围内波动', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const die = rollExplorationDie();
    assert.ok(die.roll >= 1 && die.roll <= 6);
    assert.ok(die.luck >= -2 && die.luck <= 2);
    seen.add(die.luck);
  }
  // 长跑应覆盖零、正、负，运气成分真实存在
  assert.ok(seen.has(0));
  assert.ok([...seen].some((v) => v > 0));
  assert.ok([...seen].some((v) => v < 0));
});

test('全胜奖励倍率 >1，其余为 1', () => {
  const all = calculateRewards(3, 3, 'plains');
  assert.equal(all.allWon, true);
  assert.ok(all.bonusMultiplier > 1);
  assert.equal(calculateRewards(2, 3, 'plains').someWon, true);
  assert.equal(calculateRewards(2, 3, 'plains').bonusMultiplier, 1);
  assert.equal(calculateRewards(0, 3, 'plains').allWon, false);
  assert.equal(calculateRewards(0, 3, 'plains').someWon, false);
});

test('挑战结算按过关轮次发放好/坏奖励', () => {
  gameState.state.resources = { metal: 0, crystal: 0, energy: 50, food: 50, research: 0, credits: 0 };
  gameState.state.blueprints = { buildings: [], products: [] };
  gameState.state.researchedTechs = [];

  // 全胜 / 部分胜 → 好奖励（结果串含「+」）
  assert.match(applyChallengeRewards('plains', { allWon: true, someWon: true }), /\+/);
  assert.match(applyChallengeRewards('plains', { allWon: false, someWon: true }), /\+/);
  // 全败 → 坏效果（结果串含「-」），且食物或能源被扣除
  const before = { food: gameState.state.resources.food, energy: gameState.state.resources.energy };
  assert.match(applyChallengeRewards('plains', { allWon: false, someWon: false }), /-/);
  assert.ok(
    gameState.state.resources.food < before.food || gameState.state.resources.energy < before.energy,
  );
});
