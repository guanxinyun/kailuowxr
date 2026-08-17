import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../src/core/GameState.js';
import { requiresRoadConnection, getBuildingOperationalState, getBuildingEfficiency } from '../src/core/BuildingSystem.js';
import { getGlobalPriceBonus, touristBuyFromShelf } from '../src/core/TradeSystem.js';
import { triggerSceneryEvent } from '../src/core/TouristManager.js';

test('景观建筑：无需道路连接即可正常生效运转', () => {
  gameState.reset();

  const sceneryBuilding = {
    id: 'scenery_1',
    buildingId: 'holo_wheel',
    x: 10,
    y: 10,
    built: true,
  };

  const normalBuilding = {
    id: 'mine_1',
    buildingId: 'mine',
    x: 10,
    y: 10,
    built: true,
    workerId: gameState.state.residents[0].id,
  };

  assert.equal(requiresRoadConnection(sceneryBuilding), false, '景观摩天轮不应需要道路');
  assert.equal(requiresRoadConnection(normalBuilding), true, '采矿站需要道路连接');

  // 未铺设道路连接至 (0,0) HQ 时
  const sceneryOp = getBuildingOperationalState(sceneryBuilding);
  assert.equal(sceneryOp.operational, true, '景观建筑在无道路时依然正常生效');

  const normalOp = getBuildingOperationalState(normalBuilding);
  assert.equal(normalOp.operational, false, '普通建筑无道路连接时无法运转');
});

test('景观建筑：光环加成（生态塔农场加速、音乐喷泉工坊加速、摩天轮货架售价+25%）', () => {
  gameState.reset();

  const bioTower = {
    id: 'bio_1',
    buildingId: 'bio_tower',
    x: 5,
    y: 5,
    built: true,
  };

  const farm = {
    id: 'farm_1',
    buildingId: 'hydro_farm',
    x: 6,
    y: 5, // 距离 1，在 4 格范围内
    built: true,
    level: 1,
  };

  const holoWheel = {
    id: 'holo_1',
    buildingId: 'holo_wheel',
    x: 2,
    y: 2,
    built: true,
  };

  gameState.state.buildings = [bioTower, farm, holoWheel];

  const farmEff = getBuildingEfficiency(farm);
  assert.ok(farmEff > 1.2, `生态塔应使邻近农场效率获得30%加成 (当前: ${farmEff})`);

  const globalPriceBonus = getGlobalPriceBonus();
  assert.equal(globalPriceBonus, 0.25, '全息星空摩天轮应提供全局 25% 售价加成');
});

test('景观建筑：拜访打卡事件触发并获得资源或好感度', () => {
  gameState.reset();
  gameState.state.resources.credits = 100;
  gameState.state.resources.research = 10;
  gameState.state.resources.crystal = 5;

  const target = {
    id: 'zen_1',
    buildingId: 'zen_garden',
    x: 4,
    y: 4,
  };

  const tourist = {
    id: 't_1',
    name: '星际漫步者',
    speciesId: 'crystal',
    speciesName: '晶体族',
  };

  // 触发拜访打卡事件
  triggerSceneryEvent(target, tourist, true);

  // 验证资源有增加
  const totalGains = (gameState.state.resources.credits - 100) +
                     (gameState.state.resources.research - 10) +
                     (gameState.state.resources.crystal - 5) +
                     (gameState.state.diplomacy?.crystal?.reputation || 0);

  assert.ok(totalGains > 0, '打卡事件应至少增加星币、科研、晶体或外交好感度之一');
});
