import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { gameState } from '../core/GameState.js';
import {
  initBattle,
  playCardInBattle,
  triggerOvercharge,
  endTurnInBattle,
  getBattleCardPool,
  getCardTypeIcon,
  getCardTypeLabel,
  calculateRewards,
} from '../core/CardGameSystem.js';
import { sound } from '../core/SoundSystem.js';

const CARD_COLORS = {
  combat:      { bg: 'rgba(231,76,60,0.15)',  border: 'rgba(231,76,60,0.5)',  text: '#E74C3C' },
  engineering: { bg: 'rgba(243,156,18,0.15)', border: 'rgba(243,156,18,0.5)', text: '#F39C12' },
  research:    { bg: 'rgba(74,144,217,0.15)',  border: 'rgba(74,144,217,0.5)',  text: '#4A90D9' },
  farming:     { bg: 'rgba(46,204,113,0.15)',  border: 'rgba(46,204,113,0.5)',  text: '#2ECC71' },
  survival:    { bg: 'rgba(155,89,182,0.15)',  border: 'rgba(155,89,182,0.5)',  text: '#9B59B6' },
  social:      { bg: 'rgba(52,152,219,0.15)',  border: 'rgba(52,152,219,0.5)',  text: '#3498DB' },
};

/**
 * 尖塔式卡牌战斗与遭遇交互界面
 * 包含两个阶段：
 * 阶段一：战前情报与卡组构筑（自选勾选 8~15 张出战卡牌）
 * 阶段二：尖塔式多回合战斗（HP/护盾/3点能量/意图预告/抽弃循环/超频共鸣技）
 */
export function showCardGameModal(outcome, onComplete) {
  const container = createElement('div', { className: 'spire-battle-container' });

  // 获取战前全部可用卡牌
  const fullCardPool = getBattleCardPool(outcome);
  // 默认勾选前 10 张
  const selectedDeckIds = new Set(fullCardPool.slice(0, Math.min(10, fullCardPool.length)).map((c) => c.id));

  let battleState = null;

  // ==========================================
  // 阶段一：战前构筑界面 (Deckbuilding Stage)
  // ==========================================
  function renderPreBattleStage() {
    container.replaceChildren();

    // 头部：环境情报与战术简报
    const header = createElement('div', { className: 'spire-prebattle-header' });
    header.appendChild(createElement('div', { className: 'card-game-title' }, [
      lucideIcon('shield-alert', 18),
      document.createTextNode(` 战前情报 · ${outcome.tileName || '未知区域'}遭遇`),
    ]));
    header.appendChild(createElement('div', { className: 'card-game-narrative' }, [
      `前方侦测到敌意实体阻碍！请检查当前地形场效应与队员属性加成，构筑本次战斗出战卡组（建议 8~15 张）。`,
    ]));
    container.appendChild(header);

    // 卡组构筑面板主体
    const deckBuilder = createElement('div', { className: 'spire-deck-builder' });

    // 顶部状态与一键全选/推荐
    const topBar = createElement('div', { className: 'spire-deck-builder-bar' });
    const countBadge = createElement('div', { className: 'spire-deck-count' }, [
      `已选出战卡牌: ${selectedDeckIds.size} / ${fullCardPool.length} 张（至少 5 张）`,
    ]);

    const btnRow = createElement('div', { style: { display: 'flex', gap: '8px' } });
    const autoSelectBtn = createElement('button', { className: 'btn', style: { fontSize: '11px', padding: '3px 8px' } }, [
      lucideIcon('sparkles', 12),
      document.createTextNode(' 智能精选 (10张)'),
    ]);
    autoSelectBtn.addEventListener('click', () => {
      selectedDeckIds.clear();
      // 优先选基础攻防 + 优质居民技能
      fullCardPool.slice(0, 10).forEach((c) => selectedDeckIds.add(c.id));
      renderPreBattleStage();
    });

    const selectAllBtn = createElement('button', { className: 'btn', style: { fontSize: '11px', padding: '3px 8px' } }, [
      document.createTextNode(selectedDeckIds.size === fullCardPool.length ? '全不选' : '全选'),
    ]);
    selectAllBtn.addEventListener('click', () => {
      if (selectedDeckIds.size === fullCardPool.length) {
        selectedDeckIds.clear();
      } else {
        fullCardPool.forEach((c) => selectedDeckIds.add(c.id));
      }
      renderPreBattleStage();
    });

    btnRow.appendChild(autoSelectBtn);
    btnRow.appendChild(selectAllBtn);
    topBar.appendChild(countBadge);
    topBar.appendChild(btnRow);
    deckBuilder.appendChild(topBar);

    // 卡牌勾选网格列表
    const grid = createElement('div', { className: 'spire-deck-grid' });
    for (const card of fullCardPool) {
      const isChecked = selectedDeckIds.has(card.id);
      const colors = CARD_COLORS[card.type] || CARD_COLORS.combat;

      const cardCard = createElement('div', {
        className: `spire-deck-card ${isChecked ? 'selected' : ''}`,
        style: {
          '--card-bg': colors.bg,
          '--card-border': colors.border,
          '--card-text': colors.text,
        },
      });

      const topRow = createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' } }, [
          lucideIcon(card.icon || getCardTypeIcon(card.type), 14),
          document.createTextNode(card.name || card.label),
        ]),
        createElement('span', { className: 'spire-card-cost' }, [`⚡${card.cost || 1}`]),
      ]);

      const descEl = createElement('div', { className: 'spire-card-desc' }, [
        card.desc || `${card.damage > 0 ? `造成 ${card.damage} 伤害 ` : ''}${card.block > 0 ? `获得 ${card.block} 护盾 ` : ''}`,
      ]);

      const sourceEl = createElement('div', { className: 'spire-card-source' }, [
        card.residentName ? `来源: ${card.residentName}` : '基础/遗物',
      ]);

      cardCard.appendChild(topRow);
      cardCard.appendChild(descEl);
      cardCard.appendChild(sourceEl);

      cardCard.addEventListener('click', () => {
        sound.play('click');
        if (selectedDeckIds.has(card.id)) {
          selectedDeckIds.delete(card.id);
        } else {
          selectedDeckIds.add(card.id);
        }
        renderPreBattleStage();
      });

      grid.appendChild(cardCard);
    }
    deckBuilder.appendChild(grid);
    container.appendChild(deckBuilder);

    // 底部开始战斗按钮
    const footer = createElement('div', { className: 'spire-prebattle-footer' });
    const startBattleBtn = createElement('button', {
      className: 'btn btn-primary',
      disabled: selectedDeckIds.size < 5,
    }, [
      lucideIcon('swords', 15),
      document.createTextNode(` 迎击遭遇（携带 ${selectedDeckIds.size} 张卡牌）`),
    ]);

    startBattleBtn.addEventListener('click', () => {
      sound.play('card_play');
      const customDeck = fullCardPool.filter((c) => selectedDeckIds.has(c.id));
      battleState = initBattle(outcome, customDeck);
      renderBattleStage();
    });

    footer.appendChild(startBattleBtn);
    container.appendChild(footer);
  }

  // ==========================================
  // 阶段二：尖塔式战斗界面 (Battle Stage)
  // ==========================================
  function renderBattleStage() {
    container.replaceChildren();
    if (!battleState) return;

    const { player, enemy, environment, turn, hand, drawPile, discardPile, isOver, victory } = battleState;

    // 1. 战场顶部：环境场效应横幅
    if (environment) {
      const envBanner = createElement('div', { className: 'spire-env-banner' });
      const leftPart = createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
        lucideIcon(environment.icon || 'sparkles', 14),
        createElement('strong', { style: { color: 'var(--text-accent)' } }, [`【战场环境】${environment.name}`]),
        createElement('span', { style: { fontSize: '11px', color: 'var(--text-secondary)' } }, [`: ${environment.desc}`]),
      ]);
      envBanner.appendChild(leftPart);
      container.appendChild(envBanner);
    }

    // 2. 对战核心对峙区 (Arena: 队伍 vs 敌人)
    const arena = createElement('div', { className: 'spire-arena' });

    // --- 左侧：开拓小队状态 ---
    const playerBox = createElement('div', { className: 'spire-fighter-box player' });
    playerBox.appendChild(createElement('div', { className: 'spire-fighter-name' }, [
      lucideIcon('shield', 15),
      document.createTextNode(' 开拓先锋小队'),
    ]));

    // HP 进度条
    const playerHpPercent = Math.max(0, Math.min(100, Math.round((player.hp / player.maxHp) * 100)));
    const playerHpBar = createElement('div', { className: 'spire-hp-bar' }, [
      createElement('div', { className: 'spire-hp-fill player', style: { width: `${playerHpPercent}%` } }),
      createElement('div', { className: 'spire-hp-text' }, [`HP ${player.hp} / ${player.maxHp}`]),
    ]);
    playerBox.appendChild(playerHpBar);

    // 护盾与能量指示器
    const playerStatusRow = createElement('div', { className: 'spire-status-row' }, [
      createElement('div', { className: 'spire-block-badge' }, [
        lucideIcon('shield', 13),
        document.createTextNode(` 护盾: ${player.block}`),
      ]),
      createElement('div', { className: 'spire-energy-badge' }, [
        lucideIcon('zap', 14),
        document.createTextNode(` 能量: ${player.energy} / ${player.maxEnergy}`),
      ]),
    ]);
    playerBox.appendChild(playerStatusRow);

    arena.appendChild(playerBox);

    // --- 中间：VS 与回合数 ---
    const centerVs = createElement('div', { className: 'spire-arena-center' }, [
      createElement('div', { className: 'spire-turn-badge' }, [`第 ${turn} 回合`]),
      createElement('div', { className: 'spire-vs-text' }, ['VS']),
    ]);
    arena.appendChild(centerVs);

    // --- 右侧：敌方状态与意图预告 ---
    const enemyBox = createElement('div', { className: 'spire-fighter-box enemy' });
    enemyBox.appendChild(createElement('div', { className: 'spire-fighter-name' }, [
      lucideIcon(enemy.icon || 'bot', 15),
      document.createTextNode(` ${enemy.name}`),
    ]));

    // 敌方 HP 进度条
    const enemyHpPercent = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)));
    const enemyHpBar = createElement('div', { className: 'spire-hp-bar' }, [
      createElement('div', { className: 'spire-hp-fill enemy', style: { width: `${enemyHpPercent}%` } }),
      createElement('div', { className: 'spire-hp-text' }, [`HP ${enemy.hp} / ${enemy.maxHp}`]),
    ]);
    enemyBox.appendChild(enemyHpBar);

    // 敌方护盾与意图气泡
    const enemyStatusRow = createElement('div', { className: 'spire-status-row' });
    if (enemy.block > 0) {
      enemyStatusRow.appendChild(createElement('div', { className: 'spire-block-badge' }, [
        lucideIcon('shield', 13),
        document.createTextNode(` 护盾: ${enemy.block}`),
      ]));
    }
    if (enemy.intent && !isOver) {
      const intentBubble = createElement('div', {
        className: `spire-intent-bubble ${enemy.intent.type}`,
      }, [
        lucideIcon(enemy.intent.icon || 'swords', 13),
        document.createTextNode(` 意图: ${enemy.intent.label}`),
      ]);
      enemyStatusRow.appendChild(intentBubble);
    }
    enemyBox.appendChild(enemyStatusRow);

    arena.appendChild(enemyBox);
    container.appendChild(arena);

    // 3. 战斗结束结算画面
    if (isOver) {
      renderBattleResult(victory);
      return;
    }

    // 4. 手牌区 (Hand Cards)
    const handContainer = createElement('div', { className: 'spire-hand-container' });
    const handHeader = createElement('div', { className: 'spire-hand-header' }, [
      createElement('span', {}, [`手牌 (${hand.length})`]),
      createElement('span', { style: { color: 'var(--text-dim)', fontSize: '11px' } }, [
        `🎴 抽牌堆: ${drawPile.length} | 📥 弃牌堆: ${discardPile.length}`,
      ]),
    ]);
    handContainer.appendChild(handHeader);

    const cardsRow = createElement('div', { className: 'spire-hand-cards' });
    for (const card of hand) {
      const canAfford = player.energy >= (card.cost || 1);
      const colors = CARD_COLORS[card.type] || CARD_COLORS.combat;

      const cardEl = createElement('div', {
        className: `spire-hand-card ${canAfford ? 'playable' : 'disabled'} ${card.special ? 'special' : ''}`,
        style: {
          '--card-bg': colors.bg,
          '--card-border': colors.border,
          '--card-text': colors.text,
        },
      });

      const top = createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' } }, [
          lucideIcon(card.icon || getCardTypeIcon(card.type), 14),
          document.createTextNode(card.name || card.label),
        ]),
        createElement('span', { className: 'spire-card-cost-badge' }, [`⚡${card.cost || 1}`]),
      ]);

      const desc = createElement('div', { className: 'spire-card-desc-body' }, [
        card.desc || `${card.damage > 0 ? `造成 ${card.damage} 伤害 ` : ''}${card.block > 0 ? `获得 ${card.block} 护盾 ` : ''}`,
      ]);

      const bottom = createElement('div', { className: 'spire-card-bottom-info' }, [
        createElement('span', {}, [card.residentName || '通用']),
        createElement('span', {}, [getCardTypeLabel(card.type)]),
      ]);

      cardEl.appendChild(top);
      cardEl.appendChild(desc);
      cardEl.appendChild(bottom);

      if (canAfford) {
        cardEl.addEventListener('click', () => {
          const res = playCardInBattle(battleState, card.id);
          if (res.ok) {
            sound.play('card_play');
            renderBattleStage();
          }
        });
      }

      cardsRow.appendChild(cardEl);
    }
    handContainer.appendChild(cardsRow);
    container.appendChild(handContainer);

    // 5. 底部操作栏：紧急超频共鸣技 + 结束回合
    const battleActions = createElement('div', { className: 'spire-battle-actions' });

    // 紧急超频共鸣按钮 (保底必胜大招)
    const overchargeBtn = createElement('button', {
      className: 'btn',
      style: {
        background: player.overchargeAvailable ? 'linear-gradient(135deg, rgba(231,76,60,0.3), rgba(243,156,18,0.3))' : 'rgba(255,255,255,0.05)',
        border: player.overchargeAvailable ? '1px solid #E74C3C' : '1px solid var(--border-subtle)',
        color: player.overchargeAvailable ? '#FFF' : 'var(--text-dim)',
      },
      disabled: !player.overchargeAvailable,
    }, [
      lucideIcon('flame', 14),
      document.createTextNode(player.overchargeAvailable ? ' 紧急超频共鸣 (爆发12伤+8盾，每局1次)' : ' 紧急超频已使用'),
    ]);
    overchargeBtn.addEventListener('click', () => {
      if (triggerOvercharge(battleState)) {
        sound.play('tech');
        renderBattleStage();
      }
    });

    // 结束回合按钮
    const endTurnBtn = createElement('button', {
      className: 'btn btn-primary',
      style: { padding: '8px 24px', fontWeight: 'bold' },
    }, [
      lucideIcon('fast-forward', 14),
      document.createTextNode(' 结束回合'),
    ]);
    endTurnBtn.addEventListener('click', () => {
      sound.play('click');
      endTurnInBattle(battleState);
      renderBattleStage();
    });

    battleActions.appendChild(overchargeBtn);
    battleActions.appendChild(endTurnBtn);
    container.appendChild(battleActions);
  }

  // ==========================================
  // 战斗结算画面 (Battle Result)
  // ==========================================
  function renderBattleResult(victory) {
    const summaryEl = createElement('div', { className: 'card-game-summary' });
    const icon = victory ? 'trophy' : 'shield-alert';
    const title = victory ? '大获全胜！成功击退异星威胁' : '防线战术撤退';
    const desc = victory
      ? `小队成功击败敌人！全面化解危机，探索奖励倍率提升至 1.5 倍！`
      : '小队在掩护下安全撤回，虽未全胜但带回了基础物资，无人员伤亡。';

    summaryEl.appendChild(createElement('div', { className: 'card-game-summary-icon' }, [
      lucideIcon(icon, 36),
    ]));
    summaryEl.appendChild(createElement('div', { className: 'card-game-summary-title' }, [title]));
    summaryEl.appendChild(createElement('div', { className: 'card-game-summary-desc' }, [desc]));

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      ui.closeModal();
      const rewards = calculateRewards(victory ? 3 : 1, 3, outcome.tileType);
      if (onComplete) onComplete(rewards);
    };

    const confirmBtn = createElement('button', { className: 'btn btn-primary', style: { marginTop: '14px' } }, ['确认并完成探索']);
    confirmBtn.addEventListener('click', settle);
    summaryEl.appendChild(confirmBtn);

    container.appendChild(summaryEl);
    setTimeout(settle, 6000);
  }

  // 默认从阶段一（战前构筑）开始
  renderPreBattleStage();

  const content = ui.createModalContent('尖塔对决 · 异星遭遇战', 'swords', container);
  ui.openModal(content, 'modal-lg', { priority: 20 });
}
