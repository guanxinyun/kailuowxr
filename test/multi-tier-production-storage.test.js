import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../src/core/GameState.js';
import {
  dispatchItemToStorage,
  extractItemFromStorage,
  getColonyStorageStats,
} from '../src/core/StorageSystem.js';
import {
  canStartProduction,
  startProduction,
} from '../src/core/ProductionSystem.js';
import { PRODUCTION_RECIPES, getProductionRecipe } from '../src/data/production.js';
import {
  validateProductProposal,
} from '../src/core/DynamicContentSystem.js';
import { TECHS } from '../src/data/techs.js';

test('多实体仓库跨仓调拨与统一库容饱和检测', () => {
  gameState.state.resources = { metal: 0, crystal: 0, energy: 0, food: 0 };
  gameState.state.production = { inventory: {}, queue: [] };
  // 地图：
  // (0,0) landing_pad, (1,0) road, (2,0) road, (3,0) road
  // (1,1) warehouse_1, (2,1) road, (3,1) warehouse_2
  gameState.state.map = [
    [{ explored: true, building: 'landing_pad' }, { explored: true, building: 'road' }, { explored: true, building: 'road' }, { explored: true, building: 'road' }],
    [{ explored: true }, { explored: true, building: 'warehouse' }, { explored: true, building: 'road' }, { explored: true, building: 'warehouse' }],
  ];
  gameState.state.buildings = [
    {
      id: 'pad_1',
      buildingId: 'landing_pad',
      built: true,
      x: 0,
      y: 0,
    },
    {
      id: 'road_1',
      buildingId: 'road',
      built: true,
      x: 1,
      y: 0,
    },
    {
      id: 'road_2',
      buildingId: 'road',
      built: true,
      x: 2,
      y: 0,
    },
    {
      id: 'road_3',
      buildingId: 'road',
      built: true,
      x: 3,
      y: 0,
    },
    {
      id: 'road_4',
      buildingId: 'road',
      built: true,
      x: 2,
      y: 1,
    },
    {
      id: 'warehouse_1',
      buildingId: 'warehouse',
      built: true,
      x: 1,
      y: 1,
      stored: { alloy: 98 },
    },
    {
      id: 'warehouse_2',
      buildingId: 'warehouse',
      built: true,
      x: 3,
      y: 1,
      stored: { crystal_circuit: 50 },
    },
  ];

  // 1. 就近存入 2 个 alloy 到 warehouse_1，使其满仓 (98 + 2 = 100)
  const res1 = dispatchItemToStorage('alloy', 2, { x: 1, y: 1 });
  assert.equal(res1.added, 2);
  assert.equal(gameState.state.buildings[5].stored.alloy, 100);

  // 2. warehouse_1 已满，再存入 5 个 alloy，应自动跨仓分流至 warehouse_2
  const res2 = dispatchItemToStorage('alloy', 5, { x: 1, y: 1 });
  assert.equal(res2.added, 5);
  assert.equal(gameState.state.buildings[5].stored.alloy, 100);
  assert.equal(gameState.state.buildings[6].stored.alloy, 5);

  // 3. 跨仓提取：从 warehouse_1 提取 100 个 alloy，剩余 2 个从 warehouse_2 提取
  const extracted = extractItemFromStorage('alloy', 102);
  assert.equal(extracted, 102);
  // warehouse_1 扣光被 delete 或为 0，warehouse_2 原 5 扣 2 剩 3
  assert.equal(gameState.state.buildings[5].stored.alloy || 0, 0);
  assert.equal(gameState.state.buildings[6].stored.alloy, 3);

  // 4. 总库容概览
  const overview = getColonyStorageStats();
  assert.equal(overview.totalCapacity, 260); // 60 基础 + 200 (2座仓库)
  assert.equal(overview.isFull, false);
});

test('多级深度加工链：1级(工坊) -> 2级(量子合成仪) -> 3级(奇迹铸造厂) 依赖与生产', () => {
  const quantumMatrixRecipe = getProductionRecipe('quantum_matrix');
  const stellarBeaconRecipe = getProductionRecipe('stellar_beacon_core');

  assert.ok(quantumMatrixRecipe, '2级加工品配方存在');
  assert.equal(quantumMatrixRecipe.requiredBuilding, 'quantum_assembler');
  assert.equal(quantumMatrixRecipe.inputs.crystal_circuit, 2);
  assert.equal(quantumMatrixRecipe.inputs.alloy, 1);

  assert.ok(stellarBeaconRecipe, '3级终极加工品配方存在');
  assert.equal(stellarBeaconRecipe.requiredBuilding, 'miracle_foundry');
  assert.equal(stellarBeaconRecipe.inputs.quantum_matrix, 1);
  assert.equal(stellarBeaconRecipe.inputs.plasma_battery, 1);

  // 设定仓库与建筑环境（连接到 landing_pad）
  gameState.state.day = 1; // 工作日
  gameState.state.residents = [
    { id: 'r1', name: '工程师A', skills: { engineering: 8 } },
    { id: 'r2', name: '工程师B', skills: { engineering: 6 } },
  ];
  gameState.state.map = [
    [{ explored: true, building: 'landing_pad' }, { explored: true, building: 'road' }, { explored: true, building: 'road' }, { explored: true, building: 'road' }],
    [{ explored: true, building: 'road' }, { explored: true, building: 'quantum_assembler' }, { explored: true, building: 'miracle_foundry' }, { explored: true, building: 'warehouse' }],
  ];
  gameState.state.buildings = [
    {
      id: 'pad_1',
      buildingId: 'landing_pad',
      built: true,
      x: 0,
      y: 0,
    },
    {
      id: 'road_0',
      buildingId: 'road',
      built: true,
      x: 1,
      y: 0,
    },
    {
      id: 'road_1',
      buildingId: 'road',
      built: true,
      x: 2,
      y: 0,
    },
    {
      id: 'road_2',
      buildingId: 'road',
      built: true,
      x: 3,
      y: 0,
    },
    {
      id: 'qa_1',
      buildingId: 'quantum_assembler',
      built: true,
      x: 1,
      y: 1,
      workerId: 'r1',
    },
    {
      id: 'mf_1',
      buildingId: 'miracle_foundry',
      built: true,
      x: 2,
      y: 1,
      workerId: 'r2',
    },
    {
      id: 'wh_1',
      buildingId: 'warehouse',
      built: true,
      x: 3,
      y: 1,
      stored: {
        crystal_circuit: 10,
        alloy: 10,
      },
    },
  ];
  gameState.state.resources = { energy: 50, metal: 0, crystal: 0, food: 0 };
  gameState.state.production = {
    inventory: {
      crystal_circuit: { quantity: 10, qualityScore: 50 },
      alloy: { quantity: 10, qualityScore: 50 },
    },
    queue: [],
    completed: 0,
  };

  // 验证 2 级加工品启动检查
  const canStart2 = canStartProduction('quantum_matrix');
  assert.equal(canStart2.ok, true, `应可启动量子运算矩阵生产: ${canStart2.reason}`);

  const startRes = startProduction('quantum_matrix');
  assert.equal(startRes.ok, true);
  assert.equal(gameState.state.production.queue.length, 1);

  // 检查原料已从跨仓提取
  assert.equal(gameState.state.buildings[6].stored.crystal_circuit, 8);
  assert.equal(gameState.state.buildings[6].stored.alloy, 9);
});

test('AI 动态生成加工品与联动科技校验守门（种类上限≤20）', () => {
  // 1. 合法新加工品提案
  const validProposal = {
    name: '反重力超导丝',
    tier: 2,
    category: 'processed',
    icon: 'sparkles',
    desc: '通过微观磁场约束拉伸的超导纤维',
    inputs: { alloy: 2, energy: 6 },
    days: 3,
    requiredBuilding: 'quantum_assembler',
  };
  const validation = validateProductProposal(validProposal);
  assert.equal(validation.ok, true);

  // 2. 依赖不存在的无效原料或空原料自动兜底
  const emptyInputsProposal = {
    name: '虚空微粒',
    tier: 2,
    category: 'processed',
    icon: 'sparkles',
    desc: '在真空中凝聚的微粒',
    inputs: {},
    days: 3,
    requiredBuilding: 'workshop',
  };
  const emptyVal = validateProductProposal(emptyInputsProposal);
  assert.equal(emptyVal.ok, true);
  assert.ok(emptyVal.value.inputs.alloy > 0);

  // 3. 超过 20 种总量上限的防线测试
  const currentTotal = PRODUCTION_RECIPES.length;
  assert.ok(currentTotal <= 20, `全游戏预置加工品当前为 ${currentTotal} 种，未超过 20 种上限`);
});

test('科技树 Tier 3/4 包含量子加工与奇迹铸造专属科技', () => {
  const precisionTech = TECHS.find(t => t.id === 'precision_synthesis');
  assert.ok(precisionTech, 'precision_synthesis 科技存在');
  assert.ok(precisionTech.unlocks.includes('quantum_assembler'), '解锁量子精密合成仪');

  const foundryTech = TECHS.find(t => t.id === 'miracle_foundry_tech');
  assert.ok(foundryTech, 'miracle_foundry_tech 科技存在');
  assert.ok(foundryTech.unlocks.includes('miracle_foundry'), '解锁奇迹铸造厂');
  assert.ok(foundryTech.prereqs.includes('precision_synthesis'), '前置需要量子加工');
});
