import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentBalance,
  DEFAULT_BALANCE,
  BALANCE_PRESETS,
  setBalanceValue,
  applyPreset,
  exportBalanceMod,
  importBalanceMod,
  resetBalanceToDefault,
} from '../src/core/DynamicBalanceManager.js';
import { BALANCE } from '../src/data/balance.js';

test('动态平衡管理器：默认值与 Proxy 代理透明映射', () => {
  resetBalanceToDefault();
  assert.equal(BALANCE.foodPerResidentPerDay, 0.3);
  assert.equal(BALANCE.inventory.maxPerItem, 50);
});

test('动态平衡管理器：实时更新指定路径数值并热生效', () => {
  resetBalanceToDefault();
  setBalanceValue('foodPerResidentPerDay', 0.1);
  assert.equal(currentBalance.foodPerResidentPerDay, 0.1);
  assert.equal(BALANCE.foodPerResidentPerDay, 0.1);

  setBalanceValue('production.durationMultiplier', 0.25);
  assert.equal(BALANCE.production.durationMultiplier, 0.25);
});

test('动态平衡管理器：官方预设一键套用', () => {
  resetBalanceToDefault();
  // 1. 套用轻松休闲
  const ok1 = applyPreset('relaxed');
  assert.equal(ok1, true);
  assert.equal(BALANCE.foodPerResidentPerDay, 0.15);
  assert.equal(BALANCE.tourism.incomeMultiplier, 2);

  // 2. 套用工业帝国
  const ok2 = applyPreset('industrial');
  assert.equal(ok2, true);
  assert.equal(BALANCE.inventory.maxPerItem, 200);
  assert.equal(BALANCE.logistics.haulPerDay, 30);
});

test('动态平衡管理器：导出为 MOD JSON 与导入校验', () => {
  resetBalanceToDefault();
  setBalanceValue('foodPerResidentPerDay', 0.05);

  const exportedJson = exportBalanceMod({ name: '测试超爽MOD', author: '专家' });
  assert.ok(exportedJson.includes('测试超爽MOD'));
  assert.ok(exportedJson.includes('"foodPerResidentPerDay": 0.05'));

  // 重置后重新导入
  resetBalanceToDefault();
  assert.equal(BALANCE.foodPerResidentPerDay, 0.3);

  const importRes = importBalanceMod(exportedJson);
  assert.equal(importRes.ok, true);
  assert.equal(importRes.meta.modName, '测试超爽MOD');
  assert.equal(BALANCE.foodPerResidentPerDay, 0.05);
});

test('动态平衡管理器：支持单个建筑独立产出基础数值调制', () => {
  resetBalanceToDefault();
  setBalanceValue('buildingBaseOutputs.mine.metal', 10);
  assert.equal(BALANCE.buildingBaseOutputs.mine.metal, 10);

  // 验证对资源流结算生效
  import('../src/core/ResourceFlowSystem.js').then(({ calculateBuildingDailyOutput }) => {
    const mineData = { id: 'mine', effect: { metal: 4 } };
    const building = { buildingId: 'mine', built: true, level: 1 };
    const out = calculateBuildingDailyOutput(mineData, building, { operational: true });
    // 基础值为 10，乘以 0.15 默认倍率 = 1.5
    assert.equal(out.metal, 1.5);
  });
});
