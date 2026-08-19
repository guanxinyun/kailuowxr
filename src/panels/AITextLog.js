/**
 * 星尘殖民地 — AI 文本日志查看器（共享 UI 组件）
 * 供调试面板（桌面 Ctrl+Shift+D）与 AI 内容工坊（手机端可点入）复用。
 * 展示 aiClient.transcript 中每次实际收到的 AI 文本（在线/出错/降级）。
 */
import { createElement, lucideIcon } from '../core/utils.js';
import { aiClient } from '../ai/AIClient.js';

const SOURCE_META = {
  online: { label: '在线', color: 'var(--color-success)' },
  error: { label: '出错', color: 'var(--color-adventure)' },
  fallback: { label: '降级', color: 'var(--color-warning)' },
};

/**
 * 构建 AI 文本日志区块（含说明、刷新/清空按钮与滚动列表）
 * @returns {HTMLElement}
 */
export function buildAITextLog() {
  const container = createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });

  container.appendChild(createElement('div', {
    style: { fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.6' },
  }, ['记录每次实际收到的 AI 文本（在线成功 / 出错原文 / 本地降级），最新在最上。文本同时打印到浏览器控制台（前缀 [AI文本]）。']));

  const logBox = createElement('div', {
    style: {
      maxHeight: '320px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px',
      padding: '8px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px',
    },
  });

  const render = () => {
    logBox.replaceChildren();
    const entries = aiClient.transcript;
    if (!entries.length) {
      logBox.appendChild(createElement('div', { style: { color: 'var(--text-dim)', padding: '4px' } }, ['暂无记录。触发一次 AI 生成后刷新即可查看。']));
      return;
    }
    for (const e of [...entries].reverse()) {
      const meta = SOURCE_META[e.source] || { label: e.source, color: 'var(--text-dim)' };
      const head = createElement('div', {
        style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', flexWrap: 'wrap' },
      }, [
        createElement('span', { style: { color: 'var(--text-dim)' } }, [e.time]),
        createElement('span', { style: { color: 'var(--text-secondary)' } }, [e.type]),
        createElement('span', { style: { color: meta.color, fontWeight: '700' } }, [meta.label]),
      ]);
      const body = createElement('pre', {
        style: {
          margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontSize: '12px', lineHeight: '1.5', color: 'var(--text-secondary)',
        },
      }, [e.error ? `⚠️ ${e.error}\n${e.text}` : e.text]);
      logBox.appendChild(head);
      logBox.appendChild(body);
    }
  };
  render();

  const actions = createElement('div', { style: { display: 'flex', gap: '6px' } });
  const refreshBtn = createElement('button', { className: 'btn', style: { flex: 1, justifyContent: 'center' } }, [lucideIcon('sparkles', 14), document.createTextNode(' 刷新')]);
  refreshBtn.addEventListener('click', render);
  const clearBtn = createElement('button', { className: 'btn', style: { flex: 1, justifyContent: 'center' } }, [lucideIcon('x', 14), document.createTextNode(' 清空')]);
  clearBtn.addEventListener('click', () => { aiClient.clearTranscript(); render(); });
  actions.appendChild(refreshBtn);
  actions.appendChild(clearBtn);

  container.appendChild(actions);
  container.appendChild(logBox);
  return container;
}
