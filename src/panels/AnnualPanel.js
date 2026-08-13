/**
 * 星尘殖民地 — 年终评比面板
 */
import { ui } from '../core/UIManager.js';
import { aiAdvisor } from '../core/AIAdvisor.js';
import { AI_REQUEST_TYPES } from '../ai/AIPrompts.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { GRAVITY_CONFIG } from '../data/gamedata.js';
import { createRadarChart } from './DiplomacyPanel.js';
import { calculateAnnualReview } from '../core/AnnualReviewSystem.js';
import { buildAnnualFacts } from '../core/AIContentFacts.js';

export function openAnnualPanel(reviewData = null) {
  const data = reviewData || calculateAnnualReview();
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

  const facts = data.facts || {};
  container.appendChild(createElement('div', { className: 'annual-facts' }, [
    createElement('span', {}, [`运营设施 ${facts.operationalBuildings ?? 0}`]),
    createElement('span', {}, [`平均居民 ${facts.averageResidentLevel ?? 0}级`]),
    createElement('span', {}, [`完成加工 ${facts.productsCompleted ?? 0}`]),
    createElement('span', {}, [`激活组合 ${facts.activeCombos ?? 0}`]),
    createElement('span', {}, [`外交均值 ${facts.diplomacyAverage ?? 0}`]),
  ]));

  // AI Commentary (信号接收 → 打字机效果)
  const commentaryContainer = createElement('div', { className: 'annual-commentary' });
  container.appendChild(commentaryContainer);

  // 只把已经确定的年度事实交给 AI，评分本身不可修改
  aiAdvisor.showWithPlaceholder(
    AI_REQUEST_TYPES.ANNUAL_COMMENT,
    buildAnnualFacts(data),
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

function getGradeColor(grade) {
  const colors = { S: '#F0C040', A: '#2ECC71', B: '#4A90D9', C: '#A8D8B9', D: '#8B8AA0' };
  return colors[grade] || '#8B8AA0';
}
