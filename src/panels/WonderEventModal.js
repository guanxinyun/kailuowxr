/**
 * 星尘殖民地 — 开罗风奇遇结果弹窗 (Wonder Event Modal)
 */
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';

export function openWonderEventModal(eventData) {
  if (typeof document === 'undefined') return;
  const container = createElement('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '14px' },
  });

  // 顶部徽章
  const badge = createElement('div', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      alignSelf: 'flex-start',
      padding: '4px 12px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: '700',
      color: '#F39C12',
      background: 'rgba(243, 156, 18, 0.15)',
      border: '1px solid rgba(243, 156, 18, 0.4)',
    },
  }, [
    lucideIcon('sparkles', 13),
    document.createTextNode('✦ 殖民地奇趣见闻'),
  ]);
  container.appendChild(badge);

  // 标题
  container.appendChild(createElement('div', {
    style: { fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' },
  }, [eventData.title || '绝妙奇遇']));

  // 涉及建筑与目击者
  if (eventData.buildingNames?.length) {
    container.appendChild(createElement('div', {
      style: { fontSize: '12px', color: 'var(--text-secondary)' },
    }, [
      lucideIcon('map-pin', 12),
      document.createTextNode(` 发生地点：${eventData.buildingNames.join(' ✦ ')}`),
    ]));
  }

  // 正文故事
  const storyBox = createElement('div', {
    style: {
      fontSize: '13px',
      lineHeight: '1.7',
      color: 'var(--text-primary)',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '8px',
      padding: '10px 12px',
    },
  }, [eventData.story]);
  container.appendChild(storyBox);

  // 风味评语
  if (eventData.flavor) {
    container.appendChild(createElement('div', {
      style: {
        fontSize: '12px',
        color: 'var(--text-dim)',
        fontStyle: 'italic',
        lineHeight: '1.5',
      },
    }, [eventData.flavor]));
  }

  // 奖励结果
  if (eventData.rewardDesc) {
    const rewardBox = createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: '700',
        color: 'var(--color-knowledge)',
        background: 'rgba(74, 144, 217, 0.1)',
        border: '1px solid rgba(74, 144, 217, 0.3)',
        borderRadius: '6px',
        padding: '8px 12px',
      },
    }, [
      lucideIcon('gift', 15),
      document.createTextNode(`奇遇收获：${eventData.rewardDesc}`),
    ]);
    container.appendChild(rewardBox);
  }

  // 底部确定按钮
  const footer = createElement('div', {
    style: { display: 'flex', justifyContent: 'flex-end', marginTop: '6px' },
  });
  const confirmBtn = createElement('button', {
    className: 'btn btn-primary',
  }, ['太妙了！']);
  confirmBtn.addEventListener('click', () => ui.closeModal());
  footer.appendChild(confirmBtn);
  container.appendChild(footer);

  const content = ui.createModalContent('殖民地奇遇', 'sparkles', container);
  ui.openModal(content, 'modal-sm', { priority: 12 });
}
