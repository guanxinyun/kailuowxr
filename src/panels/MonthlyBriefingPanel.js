/**
 * 星尘殖民地 — 月度简报弹窗
 * 开罗风格「星尘月报」：弊誌记者口吻的月度事件汇总（AI 生成 + 本地降级）。
 */
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { aiClient } from '../ai/AIClient.js';
import { getMonthlyBriefingFallback } from '../core/AIContentFacts.js';

/** 展示月度简报：先用本地降级渲染，AI 返回后在原位替换。 */
export function showMonthlyBriefing(facts) {
  const container = createElement('div', { className: 'monthly-briefing-inner' });

  container.appendChild(createElement('div', { className: 'monthly-briefing-date' }, [
    `第 ${facts.year} 年 · 第 ${facts.day} 天`,
  ]));

  const body = createElement('div', { className: 'monthly-briefing-body' });
  container.appendChild(body);

  container.appendChild(createElement('div', { className: 'monthly-briefing-footer' }, [
    '—— 星尘月报 · 弊誌记者 敬上',
  ]));

  const render = (text) => {
    body.innerHTML = '';
    for (const para of String(text || '').split('\n\n').filter(Boolean)) {
      body.appendChild(createElement('p', {}, [para]));
    }
  };

  const fallback = getMonthlyBriefingFallback(facts);
  render(fallback);

  const content = ui.createModalContent('星尘季报', 'book-open', container);
  ui.openModal(content, 'modal-md', { priority: 10 });

  aiClient.generate('monthly_briefing', facts, () => fallback, { cache: false }).then((text) => {
    if (text && text !== fallback) render(text);
  });
}
