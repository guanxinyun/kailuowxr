/**
 * 星尘殖民地 — 事件弹窗
 */
import { bus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { aiAdvisor } from '../core/AIAdvisor.js';
import { AI_REQUEST_TYPES } from '../ai/AIPrompts.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { EVENTS } from '../data/gamedata.js';

export function triggerRandomEvent() {
  const eligible = EVENTS.filter(e => gameState.state.day >= e.minDay);
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

export function showEventModal(event) {
  const container = createElement('div', { className: 'event-modal-inner' });

  // Type badge
  const typeColors = {
    disaster: 'var(--color-adventure)', discovery: 'var(--color-knowledge)',
    science: 'var(--color-knowledge)', trade: 'var(--color-food)',
    wonder: 'var(--color-culture)',
  };
  const typeNames = {
    disaster: '灾难', discovery: '发现', science: '科学',
    trade: '贸易', wonder: '奇观',
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
      for (const [key, val] of Object.entries(choice.effect)) {
        if (key in gameState.state.resources) {
          gameState.addResource(key, val);
        } else if (key === 'happiness') {
          gameState.set('happiness', Math.max(0, Math.min(100, gameState.state.happiness + val)));
        } else if (key === 'diplomacy') {
          // 外交好感度：均匀分配给所有种族
          for (const sp of Object.keys(gameState.state.diplomacy)) {
            const dip = gameState.state.diplomacy[sp];
            dip.reputation = Math.min(100, dip.reputation + val);
            dip.contacted = true;
          }
          bus.emit('diplomacy:reputation', { delta: val });
        } else if (key === 'defense') {
          // 防御暂时影响幸福度
          gameState.set('happiness', Math.max(0, Math.min(100, gameState.state.happiness + val)));
        } else if (key === 'culture') {
          // 文化影响幸福度
          gameState.set('happiness', Math.max(0, Math.min(100, gameState.state.happiness + val)));
        }
      }

      // Show result
      choices.style.display = 'none';
      const isPositive = Object.values(choice.effect).reduce((s, v) => s + v, 0) >= 0;
      container.appendChild(createElement('div', {
        className: `event-result ${isPositive ? 'success' : 'failure'}`,
      }, [
        createElement('p', { style: { marginBottom: '8px' } }, [choice.result]),
        createElement('div', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, [
          Object.entries(choice.effect).map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join('  '),
        ]),
      ]));

      gameState.state.stats.eventsTriggered++;
      bus.emit('event:resolved', { event, choice });

      // Auto close after delay
      setTimeout(() => ui.closeModal(), 3000);
    });
    choices.appendChild(btn);
  }
  container.appendChild(choices);

  const content = ui.createModalContent(event.name, event.icon, container);
  ui.openModal(content, 'modal-md');
}
