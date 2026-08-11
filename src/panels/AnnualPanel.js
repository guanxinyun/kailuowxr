/**
 * 星尘殖民地 — 年终评比面板
 */
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { aiAdvisor } from '../core/AIAdvisor.js';
import { AI_REQUEST_TYPES } from '../ai/AIPrompts.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { GRAVITY_CONFIG } from '../data/gamedata.js';
import { createRadarChart } from './DiplomacyPanel.js';

export function openAnnualPanel(reviewData = null) {
  const data = reviewData || generateMockReview();
  const container = createElement('div', { className: 'annual-panel-inner' });

  // Year header
  container.appendChild(createElement('div', { className: 'annual-header' }, [
    createElement('div', { className: 'annual-year' }, [`第 ${data.year} 年`]),
    createElement('div', { className: 'annual-subtitle' }, ['殖民地年度评估报告']),
  ]));

  // Rank
  const rankChange = data.rankDelta > 0 ? 'up' : data.rankDelta < 0 ? 'down' : '';
  container.appendChild(createElement('div', { className: 'annual-rank' }, [
    createElement('div', { className: 'annual-rank-label' }, ['星际排名']),
    createElement('div', { className: 'annual-rank-number' }, [`#${data.rank}`]),
    rankChange ? createElement('div', { className: `annual-rank-change ${rankChange}` }, [
      lucideIcon(rankChange === 'up' ? 'chevron-up' : 'chevron-down', 20),
      document.createTextNode(Math.abs(data.rankDelta).toString()),
    ]) : null,
  ].filter(Boolean)));

  // Grade
  container.appendChild(createElement('div', {
    className: 'annual-grade',
    style: { color: getGradeColor(data.grade) },
  }, [data.grade]));

  // Radar chart
  container.appendChild(createElement('div', { className: 'annual-radar-container' }, [
    createRadarChart(data.scores, 280),
  ]));

  // Score bars
  const scores = createElement('div', { className: 'annual-scores' });
  const dims = Object.keys(GRAVITY_CONFIG);
  for (const dim of dims) {
    const cfg = GRAVITY_CONFIG[dim];
    const val = data.scores[dim] || 0;
    const comment = data.comments[dim] || '';

    scores.appendChild(createElement('div', { className: 'annual-score-row' }, [
      createElement('div', { className: 'annual-score-dim' }, [
        createElement('span', { className: 'dim-dot', style: { background: cfg.color } }),
        document.createTextNode(cfg.name),
      ]),
      createElement('div', { className: 'annual-score-bar' }, [
        createElement('div', { className: 'progress-bar' }, [
          createElement('div', {
            className: `progress-fill ${dim}`,
            style: { width: `${val * 10}%` },
          }),
        ]),
      ]),
      createElement('span', { className: 'annual-score-value', style: { color: cfg.color } }, [`${val}`]),
      createElement('span', { className: 'annual-score-comment' }, [comment]),
    ]));
  }
  container.appendChild(scores);

  // AI Commentary (信号接收 → 打字机效果)
  const commentaryContainer = createElement('div', { className: 'annual-commentary' });
  container.appendChild(commentaryContainer);

  // 计算平均分并请求 AI 评语
  const avgScore = Object.values(data.scores).reduce((a, b) => a + b, 0) / 6;
  aiAdvisor.showWithPlaceholder(
    AI_REQUEST_TYPES.ANNUAL_COMMENT,
    { score: avgScore * 10 },
    commentaryContainer,
    { label: 'AI 年度评审', typeSpeed: 25 }
  );

  // Awards
  if (data.awards && data.awards.length > 0) {
    const awards = createElement('div', { className: 'annual-awards' });
    for (const award of data.awards) {
      awards.appendChild(createElement('div', { className: 'annual-award' }, [
        lucideIcon('award', 16),
        document.createTextNode(award),
      ]));
    }
    container.appendChild(awards);
  }

  const content = ui.createModalContent('年终评比', 'trophy', container);
  content.querySelector('.modal-body').classList.add('annual-panel');
  ui.openModal(content, 'modal-lg');
}

function generateMockReview() {
  const year = gameState.state.year;
  return {
    year,
    rank: Math.max(1, 50 - year * 3 - Math.floor(Math.random() * 10)),
    rankDelta: Math.floor(Math.random() * 6) - 1,
    grade: ['D', 'C', 'B', 'A', 'S'][Math.min(year - 1, 4)],
    scores: {
      food: 3 + Math.floor(Math.random() * 4),
      knowledge: 2 + Math.floor(Math.random() * 5),
      comfort: 3 + Math.floor(Math.random() * 3),
      adventure: 1 + Math.floor(Math.random() * 4),
      culture: 2 + Math.floor(Math.random() * 4),
      nature: 2 + Math.floor(Math.random() * 5),
    },
    comments: {
      food: '基本温饱',
      knowledge: '稳步积累',
      comfort: '尚可接受',
      adventure: '有待探索',
      culture: '初具雏形',
      nature: '生态萌芽',
    },
    commentary: null, // AI placeholder
    awards: year > 1 ? ['新星殖民地', '生存先锋'] : ['勇敢的第一步'],
  };
}

function getGradeColor(grade) {
  const colors = { S: '#F0C040', A: '#2ECC71', B: '#4A90D9', C: '#A8D8B9', D: '#8B8AA0' };
  return colors[grade] || '#8B8AA0';
}
