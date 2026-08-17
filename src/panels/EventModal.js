/**
 * 星尘殖民地 — 事件弹窗
 */
import { bus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { aiAdvisor } from '../core/AIAdvisor.js';
import { AI_REQUEST_TYPES } from '../ai/AIPrompts.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { EVENTS, RESOURCES } from '../data/gamedata.js';
import { recruitResident } from '../core/HousingSystem.js';
import { checkTierRewards } from '../core/TouristManager.js';
import { generateAIEvent, shouldGenerateAIEvent } from '../core/AIEventSystem.js';
import { rollBlueprint } from '../core/BlockExplorationSystem.js';

// 效果key的中文映射
const EFFECT_NAMES = {
  metal: '金属', crystal: '晶体', energy: '能量', food: '食物',
  research: '研究点', credits: '星币', happiness: '幸福度',
  diplomacy: '外交', defense: '防御', culture: '文化', recruit: '新居民',
};

export function triggerHardcodedEvent() {
  const triggeredIds = new Set((gameState.state.eventLog || []).map((e) => e.eventId).filter(Boolean));

  // 1. 优先检查是否有未触发的初始教程剧情事件（按天数顺序推进）
  const pendingTutorial = EVENTS.find(
    (e) => e.tutorial && gameState.state.day >= e.minDay && !triggeredIds.has(e.id)
  );
  if (pendingTutorial) {
    showEventModal(pendingTutorial);
    return;
  }

  // 2. 否则按权重抽取常规事件
  const eligible = EVENTS.filter(e =>
    !e.tutorial &&
    gameState.state.day >= e.minDay &&
    (!e.unlockRegion || !gameState.state.unlockedRegions.includes(e.unlockRegion))
  );
  if (eligible.length === 0) return;

  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let event = eligible[0];
  for (const e of eligible) {
    roll -= e.weight;
    if (roll <= 0) { event = e; break; }
  }

  showEventModal(event);
}

export function triggerRandomEvent() {
  // 偶尔由 AI 生成全新事件（本地校验 + 本地效果模板），离线/失败回退到内置事件
  if (shouldGenerateAIEvent()) {
    generateAIEvent({
      day: gameState.state.day,
      year: gameState.state.year,
      population: gameState.state.population,
      resources: { ...gameState.state.resources },
    }).then((event) => {
      if (event) showEventModal(event);
      else triggerHardcodedEvent();
    });
    return;
  }
  triggerHardcodedEvent();
}

export function showEventModal(event) {
  const container = createElement('div', { className: 'event-modal-inner' });

  // Type badge
  const typeColors = {
    disaster: 'var(--color-adventure)', discovery: 'var(--color-knowledge)',
    science: 'var(--color-knowledge)', trade: 'var(--color-food)',
    wonder: 'var(--color-culture)', exploration: 'var(--color-adventure)',
    diplomacy: 'var(--color-culture)', alien: 'var(--color-knowledge)',
  };
  const typeNames = {
    disaster: '灾难', discovery: '发现', science: '科学',
    trade: '贸易', wonder: '奇观', exploration: '探索',
    diplomacy: '外交', alien: '外星',
  };

  container.appendChild(createElement('div', {
    className: 'event-type-badge',
    style: { background: `${typeColors[event.type]}20`, color: typeColors[event.type], border: `1px solid ${typeColors[event.type]}40` },
  }, [
    lucideIcon(event.icon, 12),
    document.createTextNode(typeNames[event.type] || event.type),
  ]));

  // Narrative
  container.appendChild(createElement('div', { className: 'event-narrative' }, [event.narrative]));

  // AI 事件分析（信号接收 → 打字机效果）
  const aiContainer = createElement('div', { style: { marginTop: '8px', marginBottom: '8px' } });
  container.appendChild(aiContainer);

  aiAdvisor.showWithPlaceholder(
    AI_REQUEST_TYPES.EVENT_NARRATION,
    { phase: 'beforeChoice' },
    aiContainer,
    { label: 'AI 分析', typeSpeed: 20 }
  );

  // Choices
  const choices = createElement('div', { className: 'event-choices' });
  for (const choice of event.choices) {
    const btn = createElement('button', { className: 'event-choice-btn' }, [choice.text]);
    btn.addEventListener('click', () => {
      // Apply effects
      let recruitOutcome = null;
      const applied = []; // 实际发放效果描述（图纸会展开为具体名称）
      for (const [key, val] of Object.entries(choice.effect)) {
        if (key === 'recruit') {
          recruitOutcome = recruitResident();
          if (recruitOutcome && recruitOutcome.ok) applied.push('新居民 +1');
        } else if (key === 'blueprint') {
          // 图纸由本地掷骰决定，AI 只写叙事，不决定具体图纸
          for (let i = 0; i < val; i++) {
            const desc = rollBlueprint();
            if (desc) applied.push(desc);
          }
        } else if (key in gameState.state.resources) {
          gameState.addResource(key, val);
          applied.push(`${EFFECT_NAMES[key] || key} ${val > 0 ? '+' : ''}${val}`);
        } else if (key === 'happiness') {
          gameState.set('happiness', Math.max(0, Math.min(100, gameState.state.happiness + val)));
          applied.push(`${EFFECT_NAMES[key]} ${val > 0 ? '+' : ''}${val}`);
        } else if (key === 'diplomacy') {
          // 外交好感度：均匀分配给所有种族
          for (const sp of Object.keys(gameState.state.diplomacy)) {
            const dip = gameState.state.diplomacy[sp];
            const oldRep = dip.reputation;
            dip.reputation = Math.min(100, dip.reputation + val);
            dip.contacted = true;
            checkTierRewards(sp, oldRep, dip.reputation);
          }
          bus.emit('diplomacy:reputation', { delta: val });
          applied.push(`${EFFECT_NAMES[key]} ${val > 0 ? '+' : ''}${val}`);
        } else if (key === 'defense') {
          // 防御暂时影响幸福度
          gameState.set('happiness', Math.max(0, Math.min(100, gameState.state.happiness + val)));
          applied.push(`${EFFECT_NAMES[key]} ${val > 0 ? '+' : ''}${val}`);
        } else if (key === 'culture') {
          // 文化影响幸福度
          gameState.set('happiness', Math.max(0, Math.min(100, gameState.state.happiness + val)));
          applied.push(`${EFFECT_NAMES[key]} ${val > 0 ? '+' : ''}${val}`);
        }
      }

      // Show result
      choices.style.display = 'none';
      const recruitFailed = recruitOutcome && !recruitOutcome.ok;
      const resultText = recruitFailed ? recruitOutcome.reason : choice.result;
      const isPositive = !recruitFailed && Object.values(choice.effect).reduce((s, v) => s + v, 0) >= 0;
      container.appendChild(createElement('div', {
        className: `event-result ${isPositive ? 'success' : 'failure'}`,
      }, [
        createElement('p', { style: { marginBottom: '8px' } }, [resultText]),
        createElement('div', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, [applied.join('  ')]),
      ]));

      gameState.state.stats.eventsTriggered++;
      bus.emit('event:resolved', { event, choice });
      gameState.recordEvent({
        category: 'random',
        title: event.name,
        text: resultText,
        good: isPositive,
        meta: { eventId: event.id, choiceText: choice.text },
      });

      // Auto close after delay
      setTimeout(() => ui.closeModal(), 3000);
    });
    choices.appendChild(btn);
  }
  container.appendChild(choices);

  const content = ui.createModalContent(event.name, event.icon, container);
  ui.openModal(content, 'modal-md', { priority: 10 });
}
