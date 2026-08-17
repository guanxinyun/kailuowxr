/**
 * 星尘殖民地 — AI 事件调试面板（调制模式）
 * 隐藏入口：Ctrl+Shift+D。
 * 仅用于开发调试：一键触发 AI 事件生成的各条路径，查看效果。
 * 核心规则不变：AI 只写文案，数值效果由本地模板决定。
 */
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { generateAIEvent, validateEventProposal, fallbackEvent } from '../core/AIEventSystem.js';
import { showEventModal, triggerHardcodedEvent } from './EventModal.js';
import { showBlockEventModal } from './BlockExplorationPanel.js';

const TYPE_META = {
  discovery: { label: '发现', icon: 'radio' },
  science: { label: '科学', icon: 'flask-conical' },
  trade: { label: '贸易', icon: 'package' },
  wonder: { label: '奇观', icon: 'rainbow' },
  exploration: { label: '探索', icon: 'compass' },
};

function fullContext() {
  return {
    day: gameState.state.day,
    year: gameState.state.year,
    population: gameState.state.population,
    resources: { ...gameState.state.resources },
  };
}

function section(title, icon) {
  return createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      marginTop: '14px', marginBottom: '6px',
    },
  }, [lucideIcon(icon, 13), document.createTextNode(title)]);
}

function actionBtn(label, icon, onClick) {
  const btn = createElement('button', {
    className: 'btn',
    style: { width: '100%', justifyContent: 'flex-start' },
  }, [
    lucideIcon(icon, 14),
    document.createTextNode(` ${label}`),
  ]);
  btn.addEventListener('click', onClick);
  return btn;
}

export function openDebugPanel() {
  const status = createElement('div', {
    style: { fontSize: '12px', color: 'var(--text-dim)', minHeight: '18px', marginTop: '10px' },
  }, ['就绪']);
  const setStatus = (text, color = 'var(--text-dim)') => {
    status.textContent = text;
    status.style.color = color;
  };

  const container = createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });

  container.appendChild(createElement('div', {
    style: { fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '2px' },
  }, ['调试专用：强制走 AI 事件生成的各条路径。AI 未配置或返回无效时自动回退本地。每次触发后事件弹窗会覆盖本面板，再按 Ctrl+Shift+D 可重新打开。']));

  container.appendChild(section('AI 事件生成', 'sparkles'));

  const runAI = async (forceType) => {
    const label = forceType ? TYPE_META[forceType]?.label : '随机';
    setStatus(`AI 生成中（${label}）…`, 'var(--text-accent)');
    try {
      const event = await generateAIEvent(fullContext(), { forceType });
      if (event) {
        setStatus(`✅ 生成成功（实际类型：${TYPE_META[event.type]?.label || event.type}）`, 'var(--color-success)');
        showEventModal(event);
      } else {
        setStatus('⚠️ AI 返回无效/离线，已回退内置事件', 'var(--color-warning)');
        triggerHardcodedEvent();
      }
    } catch (err) {
      setStatus(`❌ 出错：${err?.message || err}`, 'var(--color-adventure)');
      triggerHardcodedEvent();
    }
  };

  container.appendChild(actionBtn('强制 AI 生成（随机类型）', 'sparkles', () => runAI()));
  for (const [type, meta] of Object.entries(TYPE_META)) {
    container.appendChild(actionBtn(`AI 事件 · ${meta.label}`, meta.icon, () => runAI(type)));
  }

  container.appendChild(section('回退路径', 'cloud-off'));
  container.appendChild(actionBtn('本地降级事件（离线回退）', 'cloud-off', () => {
    const event = validateEventProposal(fallbackEvent()).value;
    if (event) {
      setStatus('✅ 已展示本地降级事件', 'var(--color-success)');
      showEventModal(event);
    } else {
      setStatus('❌ 降级事件校验失败', 'var(--color-adventure)');
    }
  }));
  container.appendChild(actionBtn('内置事件池（硬编码随机）', 'dice', () => {
    triggerHardcodedEvent();
    setStatus('已触发内置事件池', 'var(--color-success)');
  }));

  container.appendChild(section('探索事件', 'compass'));
  container.appendChild(actionBtn('卡牌挑战（探索小游戏）', 'swords', () => {
    const residents = gameState.state.residents.slice(0, 2);
    showBlockEventModal({
      isChallenge: true,
      good: true,
      residentIds: residents.map((r) => r.id),
      residentNames: residents.map((r) => r.name),
      tileName: '调试荒原',
      tileType: 'plains',
    });
    setStatus('已触发卡牌挑战', 'var(--color-success)');
  }));

  container.appendChild(status);

  const content = ui.createModalContent('AI 事件调制', 'flask-conical', container);
  ui.openModal(content, 'modal-md');
}
