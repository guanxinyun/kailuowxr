/**
 * 星尘殖民地 — 奇遇系统 (Wonder & Combo Event System)
 * 当游客/居民漫步至特殊建筑组合或景观群落时，触发奇遇。
 * 双轨驱动：本地预存池 + 现场实时 AI 生成（开罗风冷面幽默叙事）。
 * 数值与奖励规则全部由本地确定，AI 仅生成故事与标题。
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { PRESET_COMBO_EVENTS } from '../data/comboEvents.js';
import { aiClient } from '../ai/AIClient.js';
import { buildComboWonderFacts, getNarrationFallback } from './AIContentFacts.js';
import { openWonderEventModal } from '../panels/WonderEventModal.js';

function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** 查找当前地图上邻近的一组建筑（距离≤3格） */
export function findNearbyBuildingClusters() {
  const buildings = gameState.state?.buildings?.filter(b => b.built) || [];
  const clusters = [];

  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const b1 = buildings[i];
      const b2 = buildings[j];
      if (distance(b1, b2) <= 3) {
        clusters.push([b1, b2]);
      }
    }
  }
  return clusters;
}

/**
 * 触发一次特殊组合奇遇事件
 * @param {Array} buildingGroup 参与的建筑实例列表
 * @param {Object} visitor 触发者（游客或居民）
 */
export function triggerComboWonderEvent(buildingGroup = null, visitor = null) {
  const state = gameState.state;
  if (!buildingGroup || buildingGroup.length < 1) {
    const clusters = findNearbyBuildingClusters();
    if (clusters.length > 0) {
      buildingGroup = clusters[Math.floor(Math.random() * clusters.length)];
    } else if (state.buildings?.length > 0) {
      buildingGroup = [state.buildings[Math.floor(Math.random() * state.buildings.length)]];
    } else {
      return null;
    }
  }

  const buildingIds = buildingGroup.map(b => b.buildingId);
  const buildingNames = buildingGroup.map(b => getBuildingById(b.buildingId)?.name || '未知设施');

  // 1. 尝试匹配预存池 (PRESET_COMBO_EVENTS + state.aiContent.generatedComboEvents)
  const allEvents = [...PRESET_COMBO_EVENTS, ...(state.aiContent?.generatedComboEvents || [])];

  const matched = allEvents.filter(ev => {
    if (ev.speciesId && visitor?.speciesId !== ev.speciesId) return false;
    if (ev.requiredBuildings?.length) {
      return ev.requiredBuildings.every(req => buildingIds.includes(req));
    }
    return true;
  });

  // 2. 本地决定奖励类型与数值（核心规则由本地决定）
  const rewardTypes = ['credits', 'research', 'crystal', 'food', 'happiness'];
  const rewardType = matched.length > 0 && matched[0].rewardType
    ? matched[0].rewardType
    : rewardTypes[Math.floor(Math.random() * rewardTypes.length)];

  let amount = 0;
  let rewardDesc = '';

  if (rewardType === 'credits') {
    amount = 60 + Math.floor(Math.random() * 61); // 60~120 星币
    gameState.addResource('credits', amount);
    rewardDesc = `星币 +${amount} 🪙`;
  } else if (rewardType === 'research') {
    amount = 20 + Math.floor(Math.random() * 21); // 20~40 科研点
    gameState.addResource('research', amount);
    rewardDesc = `科研点 +${amount} 🔬`;
  } else if (rewardType === 'crystal') {
    amount = 4 + Math.floor(Math.random() * 5); // 4~8 晶体
    gameState.addResource('crystal', amount);
    rewardDesc = `晶体 +${amount} 💎`;
  } else if (rewardType === 'food') {
    amount = 30 + Math.floor(Math.random() * 21); // 30~50 食物
    gameState.addResource('food', amount);
    rewardDesc = `食物 +${amount} 🍞`;
  } else {
    amount = 15;
    for (const r of state.residents || []) {
      r.happiness = Math.min(100, (r.happiness || 80) + amount);
    }
    rewardDesc = `全员幸福感 +${amount} 😊`;
  }

  // 3. 构建奇遇基础结构与降级文案
  let eventData = null;
  if (matched.length > 0) {
    const picked = matched[Math.floor(Math.random() * matched.length)];
    eventData = {
      title: picked.title || picked.name,
      story: picked.story,
      flavor: picked.flavor,
      icon: picked.icon || 'sparkles',
      rewardDesc,
      buildingNames,
      visitorName: visitor?.name || '开拓者',
    };
  } else {
    eventData = {
      title: `【奇遇】${buildingNames.join('与')}的超频日常`,
      story: `${visitor?.name || '殖民地开拓者'}在漫步路过${buildingNames.join('与')}时，目击了反差极大的奇趣现象。现场居民纷纷驻足围观并展开了极其热烈的讨论。`,
      flavor: '“虽然不知道发生了什么，但我猜这肯定能写进月报。” ——某位路过的高级技工',
      icon: 'sparkles',
      rewardDesc,
      buildingNames,
      visitorName: visitor?.name || '开拓者',
    };
  }

  // 4. 弹出奇遇弹窗
  openWonderEventModal(eventData);

  // 5. 触发浮字动效与大事记记录
  const anchorBuilding = buildingGroup[0];
  bus.emit('fx:float-text', {
    x: anchorBuilding.x,
    y: anchorBuilding.y,
    text: `✨ 奇遇：${rewardDesc}`,
    color: '#F39C12',
  });

  gameState.recordEvent({
    category: 'wonder',
    title: eventData.title,
    text: `${eventData.story}（${rewardDesc}）`,
    good: true,
    meta: { buildingNames, visitorName: visitor?.name },
  });

  // 6. 现场实时 AI 生成（若在线）：生成更高契合度的开罗风故事并沉淀至存档
  const facts = buildComboWonderFacts(buildingNames, visitor);
  const fallback = getNarrationFallback('combo_wonder_event', facts);

  aiClient.generate('combo_wonder_event', facts, () => fallback, { cache: false })
    .then(aiResult => {
      if (typeof aiResult === 'object' && aiResult?.title && aiResult?.story) {
        // 沉淀至存档动态池
        if (!state.aiContent.generatedComboEvents) {
          state.aiContent.generatedComboEvents = [];
        }
        state.aiContent.generatedComboEvents.push({
          id: `ai_wonder_${Date.now()}`,
          name: aiResult.title,
          title: aiResult.title,
          story: aiResult.story,
          flavor: aiResult.flavor || '',
          requiredBuildings: buildingIds,
          rewardType,
          baseAmount: amount,
          generated: true,
        });
      }
    })
    .catch(() => {});

  return eventData;
}
