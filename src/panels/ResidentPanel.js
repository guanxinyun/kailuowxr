/**
 * 星尘殖民地 — 居民面板
 */
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { aiAdvisor } from '../core/AIAdvisor.js';
import { AI_REQUEST_TYPES } from '../ai/AIPrompts.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { GRAVITY_CONFIG } from '../data/gamedata.js';
import { getMoodLabel, getMoodColor, GRAVITY_LABELS } from '../data/residents.js';
import { createRadarChart } from './DiplomacyPanel.js';

export function openResidentPanel() {
  const container = createElement('div', { className: 'resident-panel-inner' });

  // AI 顾问消息（信号接收 → 打字机效果）
  const aiContainer = createElement('div', { style: { marginBottom: '12px' } });
  container.appendChild(aiContainer);

  const residents = gameState.state.residents;
  const avgMood = residents.reduce((sum, r) => sum + r.mood, 0) / residents.length;

  aiAdvisor.showWithPlaceholder(
    AI_REQUEST_TYPES.RESIDENT_TIP,
    { avgMood },
    aiContainer,
    { label: 'AI 顾问', typeSpeed: 25 }
  );

  const list = createElement('div', { className: 'resident-list' });

  for (const resident of residents) {
    list.appendChild(createResidentCard(resident));
  }

  container.appendChild(list);

  const content = ui.createModalContent('殖民者', 'users', container);
  ui.openModal(content, 'modal-lg');
}

function createResidentCard(resident) {
  const card = createElement('div', { className: 'resident-card' });

  // Header (clickable to expand)
  const header = createElement('div', { className: 'resident-header' });
  header.appendChild(createElement('div', { className: 'resident-avatar' }, [lucideIcon(resident.icon, 22)]));
  header.appendChild(createElement('div', { className: 'resident-name-section' }, [
    createElement('div', { className: 'resident-name' }, [resident.name]),
    createElement('div', { className: 'resident-title' }, [resident.title]),
  ]));
  header.appendChild(createElement('span', { className: 'resident-level' }, [`Lv.${resident.level}`]));
  header.addEventListener('click', () => card.classList.toggle('expanded'));
  card.appendChild(header);

  // Tags
  const tags = createElement('div', { className: 'resident-tags' });
  for (const trait of resident.traits) {
    tags.appendChild(createElement('span', { className: 'tag' }, [trait]));
  }
  card.appendChild(tags);

  // Expandable detail
  const detail = createElement('div', { className: 'resident-detail' });
  const inner = createElement('div', { className: 'resident-detail-inner' });

  // Mood
  const moodColor = getMoodColor(resident.mood);
  const moodLabel = getMoodLabel(resident.mood);
  inner.appendChild(createElement('div', { className: 'resident-mood' }, [
    createElement('span', { className: 'mood-label' }, ['心情']),
    createElement('div', { className: 'mood-bar' }, [
      createElement('div', { className: 'mood-fill', style: { width: `${resident.mood}%`, background: moodColor } }),
    ]),
    createElement('span', { className: 'mood-value', style: { color: moodColor } }, [`${resident.mood} ${moodLabel}`]),
  ]));

  // Gravity preference radar
  inner.appendChild(createElement('div', { className: 'species-radar-section' }, [
    createElement('h4', {}, ['引力偏好']),
    createRadarChart(resident.gravityPreference, 120),
  ]));

  // Skills
  const skillsSection = createElement('div', { className: 'resident-stats' }, [
    createElement('h4', {}, ['技能']),
  ]);
  for (const [skill, val] of Object.entries(resident.skills)) {
    const skillNames = {
      engineering: '工程', research: '研究', farming: '农业',
      combat: '战斗', social: '社交', survival: '生存',
    };
    skillsSection.appendChild(createElement('div', { className: 'stat-bar' }, [
      createElement('span', { style: { fontSize: '12px', minWidth: '36px' } }, [skillNames[skill] || skill]),
      createElement('div', { className: 'progress-bar', style: { flex: '1' } }, [
        createElement('div', { className: 'progress-fill', style: { width: `${val * 10}%` } }),
      ]),
      createElement('span', { style: { fontSize: '12px', fontFamily: 'var(--font-mono)', minWidth: '20px', textAlign: 'right' } }, [`${val}`]),
    ]));
  }
  inner.appendChild(skillsSection);

  // Diary
  const diary = createElement('div', { className: 'resident-diary' }, [
    createElement('h4', {}, [
      lucideIcon('scroll', 14),
      document.createTextNode('日志'),
    ]),
  ]);
  if (resident.diary && resident.diary.length > 0) {
    for (const entry of resident.diary.slice(-3)) {
      diary.appendChild(createElement('p', {
        style: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '4px' },
      }, [entry]));
    }
  }

  // AI生成日记按钮
  const aiDiaryBtn = createElement('button', { className: 'btn btn-sm', style: { marginTop: '8px' } }, [
    lucideIcon('brain', 12),
    document.createTextNode('AI 生成日记'),
  ]);
  aiDiaryBtn.addEventListener('click', async () => {
    aiDiaryBtn.disabled = true;
    aiDiaryBtn.style.opacity = '0.5';

    // 显示信号接收占位符
    const phContainer = createElement('div', { style: { marginTop: '4px' } });
    diary.insertBefore(phContainer, aiDiaryBtn);
    const ph = aiAdvisor.createSignalPlaceholder(phContainer, '日记生成中');

    const diaryText = await aiAdvisor.generateDiary(resident);
    const entry = `第${gameState.state.day}天：${diaryText}`;
    resident.diary.push(entry);
    if (resident.diary.length > 10) resident.diary.shift();

    // 替换占位符为打字机文本
    ph.destroy();
    const p = createElement('p', {
      style: { fontSize: '12px', color: 'var(--text-accent)', lineHeight: '1.6', marginBottom: '4px' },
    });
    phContainer.appendChild(p);
    aiAdvisor.typewriterEffect(p, entry, 20);
  });
  diary.appendChild(aiDiaryBtn);

  inner.appendChild(diary);

  detail.appendChild(inner);
  card.appendChild(detail);

  return card;
}
