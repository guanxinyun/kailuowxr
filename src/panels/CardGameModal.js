/**
 * 星尘殖民地 — 探索卡牌小游戏弹窗
 * 居民技能卡牌 vs 挑战轮次，玩家选卡应对。
 * 无永久失败，全胜有额外奖励。
 */
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { gameState } from '../core/GameState.js';
import {
  generateResidentCards,
  getUnlockedGeneralCards,
  generateChallenge,
  evaluateRound,
  rollExplorationDie,
  calculateRewards,
  getCardTypeIcon,
  getCardTypeLabel,
  generateChallengeNarrative,
} from '../core/CardGameSystem.js';
import { aiClient } from '../ai/AIClient.js';
import { BALANCE } from '../data/balance.js';
import { sound } from '../core/SoundSystem.js';

const CARD_COLORS = {
  combat:     { bg: 'rgba(231,76,60,0.12)',  border: 'rgba(231,76,60,0.4)',  text: '#E74C3C' },
  engineering: { bg: 'rgba(243,156,18,0.12)', border: 'rgba(243,156,18,0.4)', text: '#F39C12' },
  research:   { bg: 'rgba(74,144,217,0.12)',  border: 'rgba(74,144,217,0.4)',  text: '#4A90D9' },
  farming:    { bg: 'rgba(46,204,113,0.12)',  border: 'rgba(46,204,113,0.4)',  text: '#2ECC71' },
  survival:   { bg: 'rgba(155,89,182,0.12)',  border: 'rgba(155,89,182,0.4)',  text: '#9B59B6' },
  social:     { bg: 'rgba(52,152,219,0.12)',  border: 'rgba(52,152,219,0.4)',  text: '#3498DB' },
};

/**
 * 打开卡牌小游戏弹窗
 * @param {object} outcome 探索事件结果（含 isChallenge, residentNames, tileName 等）
 * @param {Function} onComplete 结算回调 ({ allWon, someWon, multiplier })
 */
export function showCardGameModal(outcome, onComplete) {
  const residentCards = generateResidentCards(outcome.residentIds || []);
  const generalCards = getUnlockedGeneralCards();
  const cards = [...residentCards, ...generalCards];
  const avgExploration = outcome.residentIds?.length
    ? (gameState.state.residents.filter((r) => outcome.residentIds.includes(r.id))
        .reduce((s, r) => s + (r.exploration || 10), 0) / outcome.residentIds.length)
    : 10;
  const challenge = generateChallenge(outcome.tileName || '未知区域', avgExploration);
  const totalRounds = challenge.rounds.length;
  let currentRound = 0;
  const roundResults = [];
  const selectedCards = new Set();
  const usedCards = new Set(); // 出过的牌被消耗，后续轮次不可再用
  const maxCards = BALANCE.cardGame?.maxCardsPerRound ?? 3;

  const container = createElement('div', { className: 'card-game-inner' });

  // === 头部：标题 + 叙事 ===
  const header = createElement('div', { className: 'card-game-header' });
  const titleEl = createElement('div', { className: 'card-game-title' }, [
    lucideIcon('swords', 16),
    document.createTextNode(` ${challenge.title}`),
  ]);
  const narrativeEl = createElement('div', { className: 'card-game-narrative' }, [challenge.narrative]);
  header.appendChild(titleEl);
  header.appendChild(narrativeEl);
  container.appendChild(header);

  // === 轮次进度 ===
  const progressEl = createElement('div', { className: 'card-game-progress' });
  function updateProgress() {
    progressEl.innerHTML = '';
    for (let i = 0; i < totalRounds; i++) {
      let cls = 'card-game-round-dot';
      if (i < currentRound) cls += ' done';
      else if (i === currentRound) cls += ' active';
      else cls += ' pending';
      const dot = createElement('span', { className: cls });
      if (i < currentRound) {
        dot.appendChild(lucideIcon(roundResults[i] ? 'check' : 'x', 10));
      } else {
        dot.textContent = String(i + 1);
      }
      progressEl.appendChild(dot);
      if (i < totalRounds - 1) {
        progressEl.appendChild(createElement('span', { className: 'card-game-round-line' }));
      }
    }
  }
  updateProgress();
  container.appendChild(progressEl);

  // === 需求区 ===
  const reqEl = createElement('div', { className: 'card-game-requirement' });
  function updateRequirement() {
    const round = challenge.rounds[currentRound];
    reqEl.innerHTML = '';
    reqEl.appendChild(createElement('span', { className: 'card-game-req-label' }, [
      `第${currentRound + 1}轮：需要`,
    ]));
    const reqIcon = createElement('span', { className: 'card-game-req-icon' });
    reqIcon.appendChild(lucideIcon(getCardTypeIcon(round.type), 14));
    reqEl.appendChild(reqIcon);
    reqEl.appendChild(createElement('span', { className: 'card-game-req-value' }, [
      `${round.aiLabel || round.label} ≥ ${round.required}`,
    ]));
  }
  updateRequirement();
  container.appendChild(reqEl);

  // === 手牌区 ===
  const handEl = createElement('div', { className: 'card-game-hand' });
  const cardEls = new Map();

  function renderHand() {
    handEl.innerHTML = '';
    cardEls.clear();
    const available = cards.filter((c) => !usedCards.has(c.id));
    if (available.length === 0) {
      handEl.appendChild(createElement('div', {
        style: { fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '20px' },
      }, ['没有可用的技能卡牌。']));
      return;
    }
    for (const card of available) {
      const colors = CARD_COLORS[card.type] || CARD_COLORS.combat;
      const isRelic = Boolean(card.generated || card.isGeneral);
      const el = createElement('div', {
        className: `card-game-card ${selectedCards.has(card.id) ? 'selected' : ''} ${card.special ? 'special' : ''} ${isRelic ? 'relic' : ''}`,
        style: {
          '--card-bg': colors.bg,
          '--card-border': colors.border,
          '--card-text': colors.text,
        },
      });
      // 卡牌图标
      el.appendChild(createElement('div', { className: 'card-game-card-icon' }, [
        lucideIcon(card.icon, 18),
      ]));
      // 卡牌数值
      const valueEl = createElement('div', { className: 'card-game-card-value' });
      valueEl.textContent = String(card.value);
      if (card.special) valueEl.classList.add('special');
      el.appendChild(valueEl);
      // 卡牌标签
      el.appendChild(createElement('div', { className: 'card-game-card-label' }, [card.label]));
      // 居民名
      el.appendChild(createElement('div', { className: 'card-game-card-resident' }, [card.residentName]));

      el.addEventListener('click', () => {
        sound.play('click');
        if (selectedCards.has(card.id)) {
          selectedCards.delete(card.id);
        } else {
          selectedCards.add(card.id);
        }
        renderHand();
      });
      el.style.cursor = 'pointer';
      cardEls.set(card.id, el);
      handEl.appendChild(el);
    }
  }
  renderHand();
  container.appendChild(handEl);

  // === 操作区 ===
  const actionsEl = createElement('div', { className: 'card-game-actions' });
  const submitBtn = createElement('button', { className: 'btn btn-primary' }, [
    lucideIcon('play', 14),
    document.createTextNode(' 出牌'),
  ]);
  const hintEl = createElement('span', { className: 'card-game-hint' }, [`选择卡牌后点击出牌（最多 ${maxCards} 张）`]);

  submitBtn.addEventListener('click', () => {
    const available = cards.filter((c) => !usedCards.has(c.id));
    const selectedArr = available.filter((c) => selectedCards.has(c.id));
    if (selectedArr.length === 0) {
      hintEl.textContent = '至少选择一张卡牌';
      return;
    }
    if (selectedArr.length > maxCards) {
      hintEl.textContent = `每轮最多出 ${maxCards} 张`;
      return;
    }

    // 掷探索骰，加入运气成分
    const die = rollExplorationDie();
    const result = evaluateRound(selectedArr, challenge.rounds[currentRound], die.luck);
    roundResults.push(result.passed);

    // 播放音效
    sound.play('card_play');
    setTimeout(() => {
      sound.play(result.passed ? 'card_win' : 'card_fail');
    }, 200);

    // 出过的牌被消耗
    for (const c of selectedArr) usedCards.add(c.id);

    // 显示判定结果（含骰子与专精加成）
    const dieSign = die.luck > 0 ? `+${die.luck}` : String(die.luck);
    const specText = result.specialBonus > 0 ? ` + 专精+${result.specialBonus}` : '';
    const resultEl = createElement('div', {
      className: `card-game-round-result ${result.passed ? 'win' : 'lose'}`,
    }, [
      lucideIcon(result.passed ? 'check-circle' : 'x-circle', 16),
      document.createTextNode(
        result.passed
          ? ` 过关！卡牌 ${result.sum}${specText} + 骰子 ${dieSign} = ${result.total} ≥ ${result.required}`
          : ` 未通过 —— 卡牌 ${result.sum}${specText} + 骰子 ${dieSign} = ${result.total}，需要 ${result.required}`,
      ),
    ]);
    // 替换需求区为结果
    reqEl.innerHTML = '';
    reqEl.appendChild(resultEl);

    selectedCards.clear();
    currentRound++;

    if (currentRound >= totalRounds) {
      // 全部轮次完成 → 结算
      finishGame();
    } else {
      // 进入下一轮
      submitBtn.disabled = true;
      hintEl.textContent = '准备下一轮...';
      setTimeout(() => {
        updateProgress();
        updateRequirement();
        renderHand();
        submitBtn.disabled = false;
        hintEl.textContent = `选择卡牌后点击出牌（最多 ${maxCards} 张）`;
      }, 1000);
    }
  });

  actionsEl.appendChild(hintEl);
  actionsEl.appendChild(submitBtn);
  container.appendChild(actionsEl);

  // === 结算 ===
  function finishGame() {
    const won = roundResults.filter(Boolean).length;
    const rewards = calculateRewards(won, totalRounds, challenge.tileType);

    // 隐藏手牌和操作区
    handEl.style.display = 'none';
    actionsEl.style.display = 'none';
    updateProgress();

    const summaryEl = createElement('div', { className: 'card-game-summary' });
    const allWon = won === totalRounds;
    const icon = allWon ? 'trophy' : won > 0 ? 'star' : 'frown';
    const title = allWon ? '大获全胜！' : won > 0 ? `${won}/${totalRounds} 轮过关` : '全军覆没……';
    const desc = allWon
      ? `所有轮次通关，奖励倍率 ×${rewards.bonusMultiplier}！`
      : won > 0
        ? `${won}/${totalRounds} 轮成功，获得基础奖励。`
        : '没有通过任何轮次，只能获得基础物资。';

    summaryEl.appendChild(createElement('div', { className: 'card-game-summary-icon' }, [
      lucideIcon(icon, 32),
    ]));
    summaryEl.appendChild(createElement('div', { className: 'card-game-summary-title' }, [title]));
    summaryEl.appendChild(createElement('div', { className: 'card-game-summary-desc' }, [desc]));

    // 结算（幂等）：确认按钮与自动关闭只触发一次
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      ui.closeModal();
      if (onComplete) onComplete(rewards);
    };

    const closeBtn = createElement('button', { className: 'btn btn-primary', style: { marginTop: '12px' } }, ['确认']);
    closeBtn.addEventListener('click', settle);
    summaryEl.appendChild(closeBtn);

    container.appendChild(summaryEl);

    // 自动关闭
    setTimeout(settle, 5000);
  }

  const content = ui.createModalContent('探索挑战', 'swords', container);
  ui.openModal(content, 'modal-md');

  // AI 异步替换叙事（不阻塞游戏）
  generateChallengeNarrative(challenge).then((updated) => {
    titleEl.innerHTML = '';
    titleEl.appendChild(lucideIcon('swords', 16));
    titleEl.appendChild(document.createTextNode(` ${updated.title}`));
    narrativeEl.textContent = updated.narrative;
    updateRequirement();
  });
}