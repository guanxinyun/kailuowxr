import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../src/core/GameState.js';
import { triggerComboWonderEvent, findNearbyBuildingClusters } from '../src/core/WonderEventSystem.js';
import { PRESET_COMBO_EVENTS } from '../src/data/comboEvents.js';

test('组合奇遇系统：邻近建筑群落识别与奇遇触发', () => {
  gameState.reset();

  const b1 = { id: 'b_1', buildingId: 'holo_wheel', x: 2, y: 2, built: true };
  const b2 = { id: 'b_2', buildingId: 'float_fountain', x: 3, y: 2, built: true };
  gameState.state.buildings = [b1, b2];

  const clusters = findNearbyBuildingClusters();
  assert.equal(clusters.length, 1, '应识别出1个邻近建筑群落');

  gameState.state.resources.credits = 100;
  gameState.state.resources.research = 10;
  gameState.state.resources.crystal = 5;

  const visitor = { id: 'v_1', name: '探索家墨墨', speciesId: 'squid', speciesName: '软体族' };
  const event = triggerComboWonderEvent([b1, b2], visitor);

  assert.ok(event, '应成功触发奇遇');
  assert.ok(event.title, '奇遇应包含标题');
  assert.ok(event.story, '奇遇应包含故事正文');

  // 验证资源或属性获得提升
  const totalGains = (gameState.state.resources.credits - 100) +
                     (gameState.state.resources.research - 10) +
                     (gameState.state.resources.crystal - 5);

  assert.ok(totalGains > 0 || gameState.state.residents[0].happiness > 80, '奇遇应结算有效收益');
  assert.ok(gameState.state.eventLog.some(e => e.category === 'wonder'), '奇遇应被记录到大事记日志中');
});

test('组合奇遇系统：预存奇遇池完整性与保底降级', () => {
  assert.ok(PRESET_COMBO_EVENTS.length >= 5, '预存池应至少有5条经典开罗风奇遇');
  for (const ev of PRESET_COMBO_EVENTS) {
    assert.ok(ev.id);
    assert.ok(ev.title);
    assert.ok(ev.story);
  }
});
