/**
 * 星尘殖民地 — 卡牌图鉴 / 牌库面板
 * 展示已解锁的通用技能卡牌与全部可收集卡牌，以及当前全体居民的个人技能卡。
 */
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { gameState } from '../core/GameState.js';
import { GENERAL_CARDS } from '../data/cards.js';
import { getTechById } from '../data/techs.js';
import { generateResidentCards, getCardTypeLabel } from '../core/CardGameSystem.js';

const CARD_COLORS = {
  combat:     { bg: 'rgba(231,76,60,0.12)',  border: 'rgba(231,76,60,0.4)',  text: '#E74C3C' },
  engineering: { bg: 'rgba(243,156,18,0.12)', border: 'rgba(243,156,18,0.4)', text: '#F39C12' },
  research:   { bg: 'rgba(74,144,217,0.12)',  border: 'rgba(74,144,217,0.4)',  text: '#4A90D9' },
  farming:    { bg: 'rgba(46,204,113,0.12)',  border: 'rgba(46,204,113,0.4)',  text: '#2ECC71' },
  survival:   { bg: 'rgba(155,89,182,0.12)',  border: 'rgba(155,89,182,0.4)',  text: '#9B59B6' },
  social:     { bg: 'rgba(52,152,219,0.12)',  border: 'rgba(52,152,219,0.4)',  text: '#3498DB' },
};

export function openCardCollectionModal() {
  const container = createElement('div', { className: 'card-collection-inner', style: { display: 'flex', flexDirection: 'column', gap: '16px' } });

  const unlockedSet = new Set(gameState.state.cards?.unlocked || []);
  const dynamicCards = gameState.state.cards?.dynamicCards || [];
  const allCards = [...GENERAL_CARDS, ...dynamicCards.filter((dc) => !GENERAL_CARDS.some((gc) => gc.id === dc.id))];

  // === 顶部统计 ===
  const unlockedCount = allCards.filter((c) => unlockedSet.has(c.id)).length;
  const header = createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
      borderRadius: '8px', border: '1px solid var(--border-subtle)',
    },
  }, [
    createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
      lucideIcon('layers', 18),
      createElement('span', { style: { fontWeight: '600', fontSize: '14px' } }, ['殖民地开拓卡牌库（无上限收录）']),
    ]),
    createElement('span', { style: { fontSize: '13px', color: 'var(--text-accent)' } }, [
      `已收藏 ${unlockedCount} 张技能卡牌（无限开拓中）`,
    ]),
  ]);
  container.appendChild(header);

  // === 通用卡牌网格 ===
  const grid = createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '10px',
      maxHeight: '320px',
      overflowY: 'auto',
      paddingRight: '4px',
    },
  });

  for (const card of allCards) {
    const isUnlocked = unlockedSet.has(card.id);
    const colors = CARD_COLORS[card.type] || CARD_COLORS.combat;

    const isDynamic = Boolean(card.generated);
    const cardEl = createElement('div', {
      className: `${isUnlocked && isDynamic ? 'relic' : ''}`,
      style: {
        padding: '10px 12px',
        borderRadius: '8px',
        background: isUnlocked ? colors.bg : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isUnlocked ? (isDynamic ? '#b48cff' : colors.border) : 'rgba(255,255,255,0.06)'}`,
        opacity: isUnlocked ? '1' : '0.5',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxShadow: isUnlocked && isDynamic ? '0 0 10px rgba(180, 140, 255, 0.3)' : 'none',
      },
    });

    const topRow = createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
      createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
        lucideIcon(isUnlocked ? card.icon : 'lock', 16),
        createElement('strong', { style: { fontSize: '13px', color: isUnlocked ? colors.text : 'var(--text-dim)' } }, [
          isUnlocked ? card.name : '？？？',
        ]),
      ]),
      createElement('span', {
        style: {
          fontWeight: '700', fontSize: '13px', color: isUnlocked ? colors.text : 'var(--text-dim)',
        },
      }, [isUnlocked ? `${getCardTypeLabel(card.type)} ${card.value}` : '未解锁']),
    ]);
    cardEl.appendChild(topRow);

    const descEl = createElement('div', {
      style: { fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' },
    }, [
      isUnlocked
        ? card.desc
        : card.sourceTech
          ? `研究科技【${getTechById(card.sourceTech)?.name || card.sourceTech}】解锁`
          : '在区块探索事件中拾取获得',
    ]);
    cardEl.appendChild(descEl);

    if (isUnlocked && card.flavor) {
      cardEl.appendChild(createElement('div', {
        style: { fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic' },
      }, [card.flavor]));
    }

    grid.appendChild(cardEl);
  }
  container.appendChild(grid);

  // === 居民当前可用手牌 ===
  const residents = gameState.state.residents || [];
  const resCardSection = createElement('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' },
  });
  resCardSection.appendChild(createElement('div', {
    style: { fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' },
  }, ['居民个人技能卡牌（随技能成长与专精生效）']));

  const resList = createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
  for (const r of residents) {
    const rCards = generateResidentCards([r.id]);
    const row = createElement('div', {
      style: {
        padding: '8px 10px',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '6px',
      },
    }, [
      createElement('span', { style: { fontSize: '12px', fontWeight: '600' } }, [`${r.name}（${r.title || '殖民者'}）`]),
      createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        rCards.map((c) => {
          const colors = CARD_COLORS[c.type] || CARD_COLORS.combat;
          return createElement('span', {
            style: {
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            },
          }, [`${c.label} ${c.value}${c.special ? ' ★专精' : ''}`]);
        }),
      ),
    ]);
    resList.appendChild(row);
  }
  resCardSection.appendChild(resList);
  container.appendChild(resCardSection);

  const content = ui.createModalContent('卡牌图鉴', 'layers', container);
  ui.openModal(content, 'modal-lg');
}
