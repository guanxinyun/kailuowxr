/**
 * 星尘殖民地 — 区块探索系统
 * 地图按 4×4 分块，紧邻已探明区域的区块可派遣居民探索（需花费星币）。
 * 探索有进度条，进度条随机位置会触发随机事件；事件结果本地掷骰（好事/坏事），
 * 叙事交由 AI 生成。被派遣的居民期间无法工作。
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { assignWorkers } from './BuildingSystem.js';
import { addInventory } from './ProductionSystem.js';
import { BALANCE } from '../data/balance.js';
import { TILE_TYPES, RESOURCES } from '../data/gamedata.js';
import { BUILDINGS } from '../data/buildings.js';
import { PRODUCTION_RECIPES } from '../data/production.js';
import { getDroppableCards } from '../data/cards.js';
import { unlockGeneralCard } from './CardGameSystem.js';
import { clamp } from './utils.js';

const BLOCK_SIZE = BALANCE.blockExploration.blockSize;

/** 好事奖励池（按地块种类） */
const TILE_REWARDS = {
  plains: ['food', 'credits', 'research'],
  mountain: ['metal', 'research'],
  water: ['energy', 'food'],
  crystal: ['crystal', 'research'],
  metal: ['metal', 'credits'],
  ruins: ['research', 'credits'],
  crater: ['metal', 'research'],
  forest: ['food', 'research'],
  snow: ['crystal', 'research'],
  desert: ['credits', 'metal'],
};

/** 特殊地形可拾取的特殊道具 */
const SPECIAL_ITEMS = {
  snow: { id: 'ice_core', name: '冰核' },
  desert: { id: 'sun_crystal', name: '太阳晶体' },
};

/** 格子坐标 → 区块坐标 */
export function getBlockOf(x, y) {
  return { bx: Math.floor(x / BLOCK_SIZE), by: Math.floor(y / BLOCK_SIZE) };
}

/** 区块内所有格子 */
export function getBlockTiles(bx, by) {
  const map = gameState.state.map;
  if (!map) return [];
  const tiles = [];
  for (let y = by * BLOCK_SIZE; y < (by + 1) * BLOCK_SIZE && y < map.length; y++) {
    for (let x = bx * BLOCK_SIZE; x < (bx + 1) * BLOCK_SIZE && x < map[0].length; x++) {
      tiles.push(map[y][x]);
    }
  }
  return tiles;
}

function blockHasUnexplored(bx, by) {
  return getBlockTiles(bx, by).some((t) => !t.explored);
}

function blockHasExplored(bx, by) {
  return getBlockTiles(bx, by).some((t) => t.explored);
}

/** 区块的主导地块种类 */
function dominantTileType(bx, by) {
  const counts = {};
  for (const t of getBlockTiles(bx, by)) counts[t.type] = (counts[t.type] || 0) + 1;
  let best = 'plains';
  let bestCount = -1;
  for (const [type, count] of Object.entries(counts)) {
    if (count > bestCount) { bestCount = count; best = type; }
  }
  return best;
}

/** 所有被派遣（不可工作）的居民 id */
export function getDispatchedResidentIds() {
  const set = new Set();
  if (gameState.state.activeExploration?.residentId) {
    set.add(gameState.state.activeExploration.residentId);
  }
  for (const be of gameState.state.blockExplorations || []) {
    for (const rid of be.residentIds || []) set.add(rid);
  }
  return set;
}

/** 当前可派遣的居民（未被任何探索占用） */
export function getAvailableResidents() {
  const dispatched = getDispatchedResidentIds();
  return gameState.state.residents.filter((r) => !dispatched.has(r.id));
}

/** 计算所有可探索区块（紧邻已探明区域、且自身还有未探明地块） */
export function getExplorableBlocks() {
  const map = gameState.state.map;
  if (!map) return [];
  const size = map.length;
  const blocksX = Math.ceil(size / BLOCK_SIZE);
  const blocksY = Math.ceil(size / BLOCK_SIZE);
  const result = [];
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      if (!blockHasUnexplored(bx, by)) continue;
      const neighborExplored =
        (by > 0 && blockHasExplored(bx, by - 1)) ||
        (by < blocksY - 1 && blockHasExplored(bx, by + 1)) ||
        (bx > 0 && blockHasExplored(bx - 1, by)) ||
        (bx < blocksX - 1 && blockHasExplored(bx + 1, by));
      if (!neighborExplored) continue;
      const tiles = getBlockTiles(bx, by);
      result.push({
        bx,
        by,
        exploredCount: tiles.filter((t) => t.explored).length,
        totalCount: tiles.length,
        tileType: dominantTileType(bx, by),
      });
    }
  }
  return result;
}

/** 某个区块是否正在探索 */
export function getActiveBlockExploration(bx, by) {
  return (gameState.state.blockExplorations || []).find((e) => e.bx === bx && e.by === by) || null;
}

export function getBlockExplorationInitialCost(residentCount = 1) {
  const perResident = BALANCE.blockExploration.costPerResident || 20;
  return residentCount * perResident;
}

export function getBlockExplorationMonthlyFee(residentCount = 1) {
  const perResident = BALANCE.blockExploration.monthlyFeePerResident || 20;
  return residentCount * perResident;
}

export function canStartBlockExploration(bx, by, residentIds) {
  const block = getExplorableBlocks().find((b) => b.bx === bx && b.by === by);
  if (!block) return { ok: false, reason: '该区块不可探索（需紧邻已探明区域）' };
  if (getActiveBlockExploration(bx, by)) return { ok: false, reason: '该区块已在探索中' };
  if (!Array.isArray(residentIds) || residentIds.length === 0) return { ok: false, reason: '请选择派遣的居民' };
  const unique = [...new Set(residentIds)];
  const available = getAvailableResidents();
  for (const id of unique) {
    if (!available.some((r) => r.id === id)) return { ok: false, reason: '有居民已被占用或不存在' };
  }
  const cost = getBlockExplorationInitialCost(unique.length);
  if ((gameState.state.resources.credits || 0) < cost) {
    return { ok: false, reason: `星币不足（${unique.length}人需要 ${cost} 星币）` };
  }
  return { ok: true, block, residentIds: unique, cost };
}

export function startBlockExploration(bx, by, residentIds) {
  const validation = canStartBlockExploration(bx, by, residentIds);
  if (!validation.ok) return validation;
  const ids = validation.residentIds;
  const cost = validation.cost;

  gameState.addResource('credits', -cost);

  // 检查是否有此前欠费撤退保存的断点进度
  const blockKey = `${bx}_${by}`;
  const savedProgress = gameState.state.pausedBlockProgress?.[blockKey];

  let duration = savedProgress?.remainingDays;
  let totalDays = savedProgress?.totalDays;
  let events = savedProgress?.events;

  if (!duration) {
    // 随机设定进行进度：1~3个月（30~90天）
    const minDays = BALANCE.blockExploration.minDays || 30;
    const maxDays = BALANCE.blockExploration.maxDays || 90;
    const monthStep = 30;
    const months = Math.floor(Math.random() * Math.floor((maxDays - minDays) / monthStep + 1)) + Math.floor(minDays / monthStep);
    // 人数加成：每多 1 人微调减少少许勘探摩擦（最低保底 30 天）
    const speedBonus = Math.max(0, (ids.length - 1) * 3);
    totalDays = Math.max(30, months * monthStep - speedBonus);
    duration = totalDays;

    // 进度条上的随机事件位置（0~1 之间的进度比例，触发后置 fired）
    events = [];
    for (let i = 0; i < (BALANCE.blockExploration.eventCount || 2); i++) {
      events.push({ position: 0.15 + Math.random() * 0.65, fired: false });
    }
    events.sort((a, b) => a.position - b.position);
  }

  // 恢复后清除断点暂存
  if (gameState.state.pausedBlockProgress?.[blockKey]) {
    delete gameState.state.pausedBlockProgress[blockKey];
  }

  const exploration = {
    id: `be_${bx}_${by}_${gameState.state.day}`,
    bx,
    by,
    residentIds: ids,
    totalDays,
    remainingDays: duration,
    startedDay: gameState.state.day,
    events,
    daysUntilNextFee: 30,         // 距离下次收取月度经费天数
    monthlyFee: getBlockExplorationMonthlyFee(ids.length), // 每月经费（与人数挂钩）
  };
  gameState.state.blockExplorations.push(exploration);
  assignWorkers();
  bus.emit('explore:block-started', { exploration });

  const isResuming = Boolean(savedProgress);
  gameState.addNotification({
    title: isResuming ? '区块探索重整出发（承接原进度）' : '区块探索开始',
    text: `${ids.length} 名居民前往区块 (${bx},${by})，${isResuming ? `承接此前进度，还剩 ${duration} 天` : `预计需 ${totalDays} 天`}（首期经费 ${cost} 星币，每月需维持费 ${exploration.monthlyFee} 星币）。`,
    type: 'info',
    icon: 'compass',
  });
  return { ok: true, exploration };
}

/** 每日推进：检查经费、进度 -1，越过事件位置时触发，完成后探明地块 */
export function updateBlockExplorations() {
  const state = gameState.state;
  if (!Array.isArray(state.blockExplorations) || state.blockExplorations.length === 0) return;
  for (const exp of [...state.blockExplorations]) {
    // 检查月度经费周期（每30天）
    if (exp.daysUntilNextFee == null) exp.daysUntilNextFee = 30;
    exp.daysUntilNextFee -= 1;

    if (exp.daysUntilNextFee <= 0 && exp.remainingDays > 1) {
      const monthlyFee = exp.monthlyFee || getBlockExplorationMonthlyFee(exp.residentIds.length);
      if ((state.resources.credits || 0) >= monthlyFee) {
        gameState.addResource('credits', -monthlyFee);
        exp.daysUntilNextFee = 30;
        gameState.addNotification({
          title: '区块探索经费扣缴',
          text: `扣除区块 (${exp.bx},${exp.by}) 探索队月度维持经费 ${monthlyFee} 星币（${exp.residentIds.length}人）。`,
          type: 'info',
          icon: 'coins',
        });
      } else {
        // 经费不足：队员全员撤退回殖民地恢复工作，保留当前探索断点与事件进度
        const blockKey = `${exp.bx}_${exp.by}`;
        if (!state.pausedBlockProgress) {
          state.pausedBlockProgress = {};
        }
        state.pausedBlockProgress[blockKey] = {
          bx: exp.bx,
          by: exp.by,
          totalDays: exp.totalDays,
          remainingDays: exp.remainingDays,
          events: exp.events,
        };

        // 从正在进行的列表中移除，队员归队
        state.blockExplorations = state.blockExplorations.filter((e) => e !== exp);
        assignWorkers();

        bus.emit('explore:block-recalled', { exploration: exp, blockKey });
        gameState.addNotification({
          title: '⚠️ 区块探索队断炊撤回',
          text: `由于未能按期拨付月度经费（需 ${monthlyFee} 星币），区块 (${exp.bx},${exp.by}) 勘探队员已全员安全撤回并恢复日常工作！已完成进度已妥善记录（剩余 ${exp.remainingDays} 天），下次可随时重新派遣并按原进度继续探索。`,
          type: 'warning',
          icon: 'alert-triangle',
          duration: 9000,
        });
        continue;
      }
    }

    exp.remainingDays -= 1;
    const progress = exp.totalDays > 0 ? 1 - exp.remainingDays / exp.totalDays : 1;
    for (const ev of exp.events) {
      if (!ev.fired && progress >= ev.position) {
        ev.fired = true;
        const outcome = rollBlockEventOutcome(exp);
        bus.emit('explore:block-event', { exploration: exp, outcome });
      }
    }
    if (exp.remainingDays <= 0) {
      completeBlockExploration(exp);
    }
  }
}

export function completeBlockExploration(exp) {
  const state = gameState.state;
  const tiles = getBlockTiles(exp.bx, exp.by);
  let revealed = 0;
  for (const tile of tiles) {
    if (!tile.explored) {
      tile.explored = true;
      revealed++;
    }
  }
  state.blockExplorations = state.blockExplorations.filter((e) => e !== exp);
  assignWorkers();
  bus.emit('explore:block-completed', { exploration: exp, revealed });
  gameState.addNotification({
    title: '区块探索完成',
    text: `探明了区块 (${exp.bx},${exp.by}) 的 ${revealed} 个地块。`,
    type: 'success',
    icon: 'map',
  });
}

// ===== 事件结果本地掷骰（核心规则不由 AI 决定，AI 只写叙事） =====

/** 掷骰并结算一次区块探索事件，返回结果对象供叙事使用 */
export function rollBlockEventOutcome(exp) {
  const residents = exp.residentIds
    .map((id) => gameState.state.residents.find((r) => r.id === id))
    .filter(Boolean);
  const names = residents.map((r) => r.name);
  const avgExploration = residents.length
    ? residents.reduce((sum, r) => sum + (r.exploration || 10), 0) / residents.length
    : 10;

  const tileType = dominantTileType(exp.bx, exp.by);
  const tileName = TILE_TYPES[tileType]?.name || '未知区域';

  // 约 30% 概率转为卡牌挑战：奖励由小游戏结果决定，延迟到结算时发放
  if (Math.random() < (BALANCE.cardGame?.challengeChance ?? 0.3)) {
    return {
      good: true,
      isChallenge: true,
      tileName,
      tileType,
      residentNames: names,
      residentIds: exp.residentIds,
      avgExploration,
      effectText: '',
      bonusText: '',
    };
  }

  const goodChance = clamp(
    BALANCE.blockExploration.goodChanceBase + (avgExploration - 10) * 0.02,
    0.35,
    0.85,
  );
  const good = Math.random() < goodChance;

  const outcome = { good, tileName, tileType, residentNames: names, residentIds: exp.residentIds, effectText: '', bonusText: '' };
  if (good) {
    outcome.effectText = applyGoodReward(tileType);
    outcome.bonusText = rollBonus(tileType);
  } else {
    outcome.effectText = applyBadEffect();
  }
  return outcome;
}

/** 卡牌挑战结算：按过关轮次发放奖励（全胜=好奖励+额外，部分=好奖励，全败=坏效果） */
export function applyChallengeRewards(tileType, rewards) {
  if (rewards?.allWon) {
    const effect = applyGoodReward(tileType);
    const bonus = rollBonus(tileType);
    return bonus ? `${effect}，${bonus}` : effect;
  }
  if (rewards?.someWon) return applyGoodReward(tileType);
  return applyBadEffect();
}

function applyGoodReward(tileType) {
  const pool = TILE_REWARDS[tileType] || TILE_REWARDS.plains;
  const key = pool[Math.floor(Math.random() * pool.length)];
  let amount;
  if (key === 'credits') amount = 30 + Math.floor(Math.random() * 31);
  else if (key === 'research') amount = 8 + Math.floor(Math.random() * 9);
  else amount = 6 + Math.floor(Math.random() * 9);
  gameState.addResource(key, amount);
  return `${RESOURCES[key]?.name || key} +${amount}`;
}

function rollBonus(tileType) {
  // 特殊道具：雪原/赤沙有概率拾得
  const special = SPECIAL_ITEMS[tileType];
  if (special && Math.random() < 0.5) {
    addInventory(special.id, 1, 50);
    return `拾得${special.name} ×1`;
  }
  // 通用技能卡牌掉落（稀有遗物）
  if (Math.random() < 0.2) {
    const cardText = rollCardDrop();
    if (cardText) return cardText;
  }
  // 图纸：建筑图纸或加工品图纸
  if (Math.random() < 0.25) {
    return rollBlueprint();
  }
  return '';
}

export function rollCardDrop(state = gameState.state) {
  const droppable = getDroppableCards(state.cards?.unlocked || [], state.cards?.dynamicCards || []);
  if (droppable.length > 0) {
    const picked = droppable[Math.floor(Math.random() * droppable.length)];
    unlockGeneralCard(picked.id, state, picked.generated ? picked : null);
    return `获得技能卡牌【${picked.name}】`;
  }
  // 预置牌已拿完或随机生成：动态无限生成新古代遗物卡牌
  const types = ['combat', 'engineering', 'research', 'farming', 'survival', 'social'];
  const pType = types[Math.floor(Math.random() * types.length)];
  const cardIndex = (state.cards?.dynamicCards?.length || 0) + 1;
  const newCard = {
    id: `ai_card_drop_${Date.now()}_${cardIndex}`,
    name: `远古秘传卡 #${cardIndex}`,
    type: pType,
    value: 8 + Math.floor(Math.random() * 3), // 8~10
    icon: 'sparkles',
    desc: '从失落遗迹的加密数据链中逆向提取的未知技能模块。',
    flavor: '先驱者留下的无尽知识之一。',
    generated: true,
    sourceDrop: true,
  };
  unlockGeneralCard(newCard.id, state, newCard);
  return `发现全新未知遗物卡牌【${newCard.name}】`;
}

export function rollBlueprint() {
  const blueprints = gameState.state.blueprints;
  if (Math.random() < 0.5) {
    const building = pickBuildingBlueprint();
    if (building) {
      blueprints.buildings.push(building.id);
      return `获得建筑图纸：${building.name}`;
    }
  } else {
    const recipe = pickProductBlueprint();
    if (recipe) {
      blueprints.products.push(recipe.id);
      return `获得加工品图纸：${recipe.output.name}`;
    }
  }
  // 已无图纸可发时回退为研究点
  gameState.addResource('research', 12);
  return '研究点 +12';
}

function pickBuildingBlueprint() {
  const candidates = BUILDINGS.filter(
    (b) => b.unlockTech
      && !gameState.state.researchedTechs.includes(b.unlockTech)
      && !gameState.state.blueprints.buildings.includes(b.id),
  );
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickProductBlueprint() {
  const candidates = PRODUCTION_RECIPES.filter(
    (r) => r.requiresBlueprint && !gameState.state.blueprints.products.includes(r.id),
  );
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function applyBadEffect() {
  const key = Math.random() < 0.5 ? 'energy' : 'food';
  const amount = 4 + Math.floor(Math.random() * 5); // 4~8，小幅延缓，不会永久失败
  gameState.addResource(key, -amount);
  return `${RESOURCES[key]?.name || key} -${amount}`;
}
