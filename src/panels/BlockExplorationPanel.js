/**
 * 星尘殖民地 — 区块探索派遣弹窗 + 探索事件结果弹窗
 */
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { TILE_TYPES } from '../data/gamedata.js';
import { BALANCE } from '../data/balance.js';
import { getExplorableBlocks, getAvailableResidents, startBlockExploration, applyChallengeRewards, getBlockExplorationInitialCost, getBlockExplorationMonthlyFee } from '../core/BlockExplorationSystem.js';
import { aiClient } from '../ai/AIClient.js';
import { buildBlockEventFacts, getNarrationFallback } from '../core/AIContentFacts.js';
import { showCardGameModal } from './CardGameModal.js';

/** 点击待探索区块 → 派遣弹窗：玩家自选具体居民（多选）并确认花费星币 */
export function openBlockDispatchModal(bx, by) {
  const block = getExplorableBlocks().find((b) => b.bx === bx && b.by === by);
  if (!block) {
    gameState.addNotification({ title: '无法探索', text: '该区块不可探索（需紧邻已探明区域）', type: 'warning', icon: 'alert-triangle' });
    return;
  }
  const available = getAvailableResidents();
  const selected = new Set();

  const container = createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });

  const savedProgress = gameState.state.pausedBlockProgress?.[`${bx}_${by}`];

  container.appendChild(createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' },
  }, [
    lucideIcon('map', 16),
    document.createTextNode(` 区块 (${bx},${by}) · ${TILE_TYPES[block.tileType]?.name || '未知'} · 已探明 ${block.exploredCount}/${block.totalCount} 地块`),
  ]));

  if (savedProgress) {
    container.appendChild(createElement('div', {
      style: { fontSize: '12px', color: 'var(--color-knowledge)', padding: '6px 8px', borderRadius: '6px', background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.3)' }
    }, [`📌 已保留此前勘探断点：还剩 ${savedProgress.remainingDays} / ${savedProgress.totalDays} 天，重新派遣后将无缝承接原进度！`]));
  } else {
    container.appendChild(createElement('div', {
      style: { fontSize: '12px', color: 'var(--text-dim)', padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }
    }, ['⏳ 深度勘探：探索周期约 1~3 个月，每月将按人数扣缴一次维持经费。若经费不足队员将全员安全撤回并保留断点进度，下次可继续探索。']));
  }

  const list = createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
  if (available.length === 0) {
    list.appendChild(createElement('div', { style: { fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic' } }, ['没有可派遣的居民（均已被探索或工作占用）。']));
  }
  for (const r of available) {
    const label = createElement('label', {
      style: {
        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
        borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', cursor: 'pointer',
      },
    });
    const cb = createElement('input', { type: 'checkbox' });
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(r.id); else selected.delete(r.id);
      updateFooter();
    });
    label.appendChild(cb);
    label.appendChild(createElement('span', { style: { fontSize: '13px' } }, [`${r.name} · ${r.title || '殖民者'} · 探索力${r.exploration || 10}`]));
    list.appendChild(label);
  }
  container.appendChild(list);

  const footer = createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' } });
  const costEl = createElement('div', { style: { fontSize: '12px', color: 'var(--text-accent)' } });
  const confirmBtn = createElement('button', { className: 'btn btn-primary' }, [lucideIcon('send', 14), document.createTextNode(' 派遣')]);
  function updateFooter() {
    const count = selected.size;
    const initialCost = getBlockExplorationInitialCost(count || 1);
    const monthlyFee = getBlockExplorationMonthlyFee(count || 1);
    costEl.innerHTML = count > 0
      ? `初始经费: <strong>${initialCost}</strong> 🪙<br><span style="color:var(--text-dim)">月度维持: ${monthlyFee} 🪙/月 (${count}人)</span>`
      : '请选择队员';
    confirmBtn.disabled = count === 0;
  }
  confirmBtn.addEventListener('click', () => {
    const result = startBlockExploration(bx, by, [...selected]);
    if (!result.ok) {
      gameState.addNotification({ title: '无法派遣', text: result.reason, type: 'warning', icon: 'alert-triangle' });
      return;
    }
    ui.closeModal();
  });
  updateFooter();
  footer.appendChild(costEl);
  footer.appendChild(confirmBtn);
  container.appendChild(footer);

  const content = ui.createModalContent('派遣探索', 'compass', container);
  ui.openModal(content, 'modal-md');
}

/** 探索事件结果：本地掷骰的效果 + AI 叙事（卡牌挑战走小游戏分支） */
export function showBlockEventModal(outcome) {
  if (outcome.isChallenge) {
    showCardGameModal(outcome, (rewards) => {
      const effectText = applyChallengeRewards(outcome.tileType, rewards);
      gameState.addNotification({
        title: '探索挑战结算',
        text: effectText,
        type: rewards.allWon || rewards.someWon ? 'success' : 'warning',
        icon: rewards.allWon ? 'trophy' : rewards.someWon ? 'star' : 'wind',
      });
      gameState.recordEvent({
        category: 'challenge',
        title: '探索挑战',
        text: effectText,
        good: !!(rewards.allWon || rewards.someWon),
        meta: { tileName: outcome.tileName, residentNames: outcome.residentNames || [], wonRounds: rewards.wonRounds, totalRounds: rewards.totalRounds },
      });
    });
    return;
  }

  const container = createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });

  const badgeColor = outcome.good ? 'var(--color-knowledge)' : 'var(--color-adventure)';
  container.appendChild(createElement('div', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
      padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
      color: badgeColor, background: `${badgeColor}20`, border: `1px solid ${badgeColor}40`,
    },
  }, [
    lucideIcon(outcome.good ? 'sparkles' : 'wind', 12),
    document.createTextNode(outcome.good ? '探索发现' : '探索遭遇'),
  ]));

  container.appendChild(createElement('div', { style: { fontSize: '15px', fontWeight: '700' } }, [outcome.effectText]));
  if (outcome.bonusText) {
    container.appendChild(createElement('div', {
      style: { fontSize: '13px', color: 'var(--color-food)', fontWeight: '600' },
    }, [outcome.bonusText]));
  }

  const narrationEl = createElement('div', {
    style: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', minHeight: '40px' },
  });
  container.appendChild(narrationEl);

  const facts = buildBlockEventFacts(outcome);
  const fallback = getNarrationFallback('exploration_event', facts);
  narrationEl.textContent = fallback;
  aiClient.generate('exploration_event', facts, () => fallback, { cache: false }).then((text) => {
    narrationEl.textContent = text;
  });

  const confirmBtn = createElement('button', {
    className: 'btn btn-primary',
    style: { alignSelf: 'flex-end', marginTop: '6px', minWidth: '88px', touchAction: 'manipulation' },
  }, ['知道了']);
  confirmBtn.addEventListener('click', () => ui.closeModal());
  container.appendChild(confirmBtn);

  const content = ui.createModalContent('探索事件', outcome.good ? 'sparkles' : 'wind', container);
  ui.openModal(content, 'modal-sm', { priority: 10 });

  gameState.recordEvent({
    category: 'exploration',
    title: outcome.good ? '探索发现' : '探索遭遇',
    text: `${outcome.effectText || ''}${outcome.bonusText ? `，${outcome.bonusText}` : ''}`,
    good: !!outcome.good,
    meta: { tileName: outcome.tileName, residentNames: outcome.residentNames || [] },
  });
}
