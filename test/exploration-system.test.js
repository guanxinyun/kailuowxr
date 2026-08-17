import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../src/core/GameState.js';
import {
  startExpedition,
  updateExplorationSystem,
  generateRandomExpedition,
  getExpeditionInitialCost,
  getExpeditionMonthlyFee,
} from '../src/core/ExplorationSystem.js';
import {
  startBlockExploration,
  updateBlockExplorations,
  getBlockExplorationInitialCost,
  getBlockExplorationMonthlyFee,
} from '../src/core/BlockExplorationSystem.js';

test('长途考察与区块探索经费与人数挂钩', () => {
  assert.equal(getExpeditionInitialCost(), 30);
  assert.equal(getExpeditionMonthlyFee(), 25);

  assert.equal(getBlockExplorationInitialCost(1), 20);
  assert.equal(getBlockExplorationInitialCost(3), 60);

  assert.equal(getBlockExplorationMonthlyFee(1), 20);
  assert.equal(getBlockExplorationMonthlyFee(3), 60);
});

test('长途考察：缺费时队员自动撤退归队恢复工作，并保留断点进度供下次继续探索', () => {
  gameState.reset();
  gameState.state.resources.credits = 100;
  const residentId = gameState.state.residents[0].id;
  const exp = generateRandomExpedition();

  assert.ok(exp.days >= 30, `天数至少30天 (当前: ${exp.days})`);

  const startRes = startExpedition(exp.id, residentId);
  assert.ok(startRes.ok, startRes.reason);
  assert.equal(gameState.state.resources.credits, 70); // 100 - 30

  // 模拟经过 30 天，扣缴第二次月度经费
  const active = gameState.state.activeExploration;
  active.daysUntilNextFee = 1;
  updateExplorationSystem();
  assert.equal(gameState.state.resources.credits, 45); // 70 - 25
  assert.ok(gameState.state.activeExploration, '考察仍在进行');

  // 模拟将星币清空，测试缺费自动撤退
  gameState.state.resources.credits = 0;
  gameState.state.activeExploration.daysUntilNextFee = 1;
  const remainingBeforeRecall = gameState.state.activeExploration.remainingDays;

  updateExplorationSystem();

  // 验证队员已撤回归队，当前进行中考察被清空
  assert.equal(gameState.state.activeExploration, null, '队员应已撤回，activeExploration清空');
  assert.ok(gameState.state.pausedExplorationProgress[exp.id], '断点进度应被存入 pausedExplorationProgress');
  assert.equal(gameState.state.pausedExplorationProgress[exp.id].remainingDays, remainingBeforeRecall);

  // 下次资金充裕时重新派遣，验证无缝承接原进度
  gameState.state.resources.credits = 100;
  const restartRes = startExpedition(exp.id, residentId);
  assert.ok(restartRes.ok);
  assert.equal(gameState.state.resources.credits, 70);
  assert.equal(gameState.state.activeExploration.remainingDays, remainingBeforeRecall, '应继承此前剩余天数');
  assert.equal(gameState.state.pausedExplorationProgress[exp.id], undefined, '断点暂存已被消费');
});

test('区块探索：缺费时全员撤退归队恢复工作，并保留断点事件与天数进度', () => {
  gameState.reset();
  // 构造 8x8 地图：(0,0) 区块已探明，(1,0) 区块待探索
  const map = [];
  for (let y = 0; y < 8; y++) {
    const row = [];
    for (let x = 0; x < 8; x++) {
      row.push({ type: 'plains', explored: x < 4 && y < 4 });
    }
    map.push(row);
  }
  gameState.state.map = map;

  gameState.state.resources.credits = 200;
  const rids = [gameState.state.residents[0].id, gameState.state.residents[1].id]; // 2人

  const startRes = startBlockExploration(1, 0, rids);
  assert.ok(startRes.ok, startRes.reason);
  assert.equal(gameState.state.resources.credits, 160); // 200 - 20*2 = 160

  const exp = gameState.state.blockExplorations[0];
  assert.ok(exp.totalDays >= 30, `区块探索应至少 30 天 (当前: ${exp.totalDays})`);
  assert.equal(exp.monthlyFee, 40); // 2人 * 20 = 40

  // 缺费自动撤退测试
  gameState.state.resources.credits = 10; // 不足 40
  exp.daysUntilNextFee = 1;
  const prevRemaining = exp.remainingDays;

  updateBlockExplorations();

  // 验证队员撤回，blockExplorations 清空
  assert.equal(gameState.state.blockExplorations.length, 0, '队员应已撤退归队');
  assert.ok(gameState.state.pausedBlockProgress['1_0'], '断点应被存入 pausedBlockProgress');
  assert.equal(gameState.state.pausedBlockProgress['1_0'].remainingDays, prevRemaining);

  // 再次派遣，承接原进度
  gameState.state.resources.credits = 100;
  const restartRes = startBlockExploration(1, 0, rids);
  assert.ok(restartRes.ok);
  assert.equal(gameState.state.blockExplorations[0].remainingDays, prevRemaining, '应继承断点进度天数');
  assert.equal(gameState.state.pausedBlockProgress['1_0'], undefined, '断点暂存已被消费');
});
