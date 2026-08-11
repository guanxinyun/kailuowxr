/**
 * 星尘殖民地 — 探索 + 统计 + 设置面板
 */
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon, formatNumber } from '../core/utils.js';
import { EXPLORE_REGIONS } from '../data/gamedata.js';
import { bus } from '../core/EventBus.js';
import { TutorialManager } from '../core/TutorialManager.js';

// ===== 探索面板 =====
export function openExplorePanel() {
  const container = createElement('div', { className: 'explore-panel-inner' });
  const list = createElement('div', { className: 'explore-regions' });

  for (const region of EXPLORE_REGIONS) {
    const explored = gameState.state.exploredRegions.includes(region.id);
    const card = createElement('div', { className: 'region-card' });

    card.appendChild(createElement('div', { style: { flex: '0 0 32px' } }, [
      lucideIcon(explored ? 'check' : 'compass', 20),
    ]));

    const info = createElement('div', { style: { flex: '1' } });
    info.appendChild(createElement('div', { style: { fontWeight: '700', marginBottom: '2px' } }, [region.name]));
    info.appendChild(createElement('div', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, [region.desc]));
    card.appendChild(info);

    // Danger pips
    const danger = createElement('div', { className: 'region-danger' });
    for (let i = 0; i < 5; i++) {
      danger.appendChild(createElement('div', {
        className: `region-danger-pip ${i < region.danger ? 'active' : ''}`,
      }));
    }
    card.appendChild(danger);

    if (!explored) {
      card.addEventListener('click', () => {
        ui.showConfirm({
          title: `探索 ${region.name}`,
          text: `危险等级: ${region.danger}/5。确定派遣探索队吗？`,
          icon: 'compass',
          confirmText: '出发',
          onConfirm: () => {
            gameState.state.exploredRegions.push(region.id);
            bus.emit('explore:start', region);
            gameState.addNotification({
              title: '探索队出发',
              text: `探索队已前往${region.name}`,
              type: 'event',
              icon: 'compass',
            });
            ui.closeModal();
          },
        });
      });
    } else {
      card.style.opacity = '0.5';
    }

    list.appendChild(card);
  }

  container.appendChild(list);
  const content = ui.createModalContent('探索', 'compass', container);
  ui.openModal(content, 'modal-md');
}

// ===== 统计面板 =====
export function openStatsPanel() {
  const s = gameState.state;
  const stats = s.stats;

  const container = createElement('div', { className: 'stats-panel-inner' });
  const grid = createElement('div', { className: 'stats-grid' });

  const items = [
    { label: '已存活天数', value: stats.daysPlayed, icon: 'sun' },
    { label: '当前年份', value: `Y${s.year}`, icon: 'calendar' },
    { label: '人口', value: `${s.population}/${s.maxPopulation}`, icon: 'users' },
    { label: '幸福度', value: `${s.happiness}%`, icon: 'star' },
    { label: '已建造建筑', value: stats.totalBuildings, icon: 'home' },
    { label: '已研究科技', value: s.researchedTechs.length, icon: 'flask-conical' },
    { label: '已触发事件', value: stats.eventsTriggered, icon: 'zap' },
    { label: '已探索区域', value: s.exploredRegions.length, icon: 'compass' },
  ];

  for (const item of items) {
    grid.appendChild(createElement('div', { className: 'stat-card' }, [
      createElement('div', { className: 'stat-card-label' }, [
        lucideIcon(item.icon, 12),
        document.createTextNode(' ' + item.label),
      ]),
      createElement('div', { className: 'stat-card-value' }, [String(item.value)]),
    ]));
  }

  container.appendChild(grid);

  // Resource summary
  container.appendChild(createElement('h3', {
    style: { fontSize: '16px', fontWeight: '700', margin: '24px 0 12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' },
  }, ['资源总览']));

  const resGrid = createElement('div', { className: 'stats-grid' });
  for (const [key, val] of Object.entries(s.resources)) {
    const max = s.storage[key];
    resGrid.appendChild(createElement('div', { className: 'stat-card' }, [
      createElement('div', { className: 'stat-card-label' }, [key]),
      createElement('div', { className: 'stat-card-value' }, [formatNumber(val)]),
      max !== Infinity ? createElement('div', { className: 'progress-bar', style: { marginTop: '4px' } }, [
        createElement('div', { className: 'progress-fill', style: { width: `${(val / max) * 100}%` } }),
      ]) : null,
    ].filter(Boolean)));
  }
  container.appendChild(resGrid);

  const content = ui.createModalContent('统计', 'bar-chart-3', container);
  ui.openModal(content, 'modal-lg');
}

// ===== 设置面板 =====
export function openSettingsPanel() {
  const container = createElement('div', { className: 'settings-panel-inner' });

  // Game settings
  const gameSection = createElement('div', { className: 'settings-section' });
  gameSection.appendChild(createElement('h3', {}, ['游戏']));

  // Volume
  gameSection.appendChild(createSettingRow('音效音量', createSlider(70)));
  gameSection.appendChild(createSettingRow('音乐音量', createSlider(50)));

  // Toggle settings
  gameSection.appendChild(createSettingRow('自动保存', createToggle(true)));
  gameSection.appendChild(createSettingRow('显示教程提示', createToggle(true)));
  gameSection.appendChild(createSettingRow('显示网格线', createToggle(true)));

  // 重新开始教程按钮
  const tutorialBtn = createElement('button', { className: 'btn btn-primary', style: { marginTop: '8px' } }, [
    lucideIcon('book-open', 14),
    document.createTextNode(' 重新开始教程'),
  ]);
  tutorialBtn.addEventListener('click', () => {
    localStorage.removeItem('stardust_tutorial_done');
    ui.closeModal();
    setTimeout(() => {
      const tutorial = new TutorialManager();
      tutorial.start();
    }, 300);
  });
  gameSection.appendChild(tutorialBtn);

  container.appendChild(gameSection);

  // Display settings
  const displaySection = createElement('div', { className: 'settings-section' });
  displaySection.appendChild(createElement('h3', {}, ['显示']));
  displaySection.appendChild(createSettingRow('动画效果', createToggle(true)));
  displaySection.appendChild(createSettingRow('粒子效果', createToggle(true)));
  displaySection.appendChild(createSettingRow('高DPI渲染', createToggle(true)));
  container.appendChild(displaySection);

  // Save/Load
  const dataSection = createElement('div', { className: 'settings-section' });
  dataSection.appendChild(createElement('h3', {}, ['数据']));

  const saveBtn = createElement('button', { className: 'btn btn-primary' }, [
    lucideIcon('save', 14),
    document.createTextNode(' 保存游戏'),
  ]);
  saveBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('stardust-colony-save', gameState.serialize());
      gameState.addNotification({ title: '保存成功', text: '游戏数据已保存到本地存储', type: 'success', icon: 'save' });
    } catch (e) {
      gameState.addNotification({ title: '保存失败', text: e.message, type: 'warning', icon: 'alert-triangle' });
    }
  });

  const loadBtn = createElement('button', { className: 'btn' }, [
    lucideIcon('download', 14),
    document.createTextNode(' 读取存档'),
  ]);
  loadBtn.addEventListener('click', () => {
    const data = localStorage.getItem('stardust-colony-save');
    if (data) {
      ui.showConfirm({
        title: '读取存档',
        text: '当前进度将被覆盖，确定要读取存档吗？',
        onConfirm: () => {
          gameState.deserialize(data);
          gameState.addNotification({ title: '读取成功', text: '存档已加载', type: 'success', icon: 'download' });
        },
      });
    } else {
      gameState.addNotification({ title: '无存档', text: '未找到本地存档数据', type: 'warning', icon: 'info' });
    }
  });

  const resetBtn = createElement('button', { className: 'btn btn-danger' }, [
    lucideIcon('alert-triangle', 14),
    document.createTextNode(' 重置游戏'),
  ]);
  resetBtn.addEventListener('click', () => {
    ui.showConfirm({
      title: '重置游戏',
      text: '所有进度将被清除，此操作不可撤销！',
      confirmText: '确认重置',
      onConfirm: () => {
        gameState.reset();
        location.reload();
      },
    });
  });

  dataSection.appendChild(createElement('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, [
    saveBtn, loadBtn, resetBtn,
  ]));
  container.appendChild(dataSection);

  const content = ui.createModalContent('设置', 'settings', container);
  ui.openModal(content, 'modal-md');
}

function createSettingRow(label, control) {
  return createElement('div', { className: 'settings-row' }, [
    createElement('span', { className: 'settings-label' }, [label]),
    control,
  ]);
}

function createSlider(value) {
  const input = createElement('input', {
    type: 'range',
    className: 'settings-input',
    style: { accentColor: 'var(--text-accent)' },
  });
  input.value = value;
  input.min = 0;
  input.max = 100;
  return input;
}

function createToggle(checked) {
  const label = createElement('label', {
    style: {
      position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer',
    },
  });
  const input = createElement('input', { type: 'checkbox' });
  input.checked = checked;
  input.style.cssText = 'opacity:0;width:0;height:0;';

  const slider = createElement('span', {
    style: {
      position: 'absolute', inset: '0', background: checked ? 'var(--text-accent)' : 'rgba(255,255,255,0.15)',
      borderRadius: '11px', transition: 'background 0.2s',
    },
  });
  const dot = createElement('span', {
    style: {
      position: 'absolute', top: '3px', left: checked ? '20px' : '3px', width: '16px', height: '16px',
      background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
    },
  });
  slider.appendChild(dot);

  input.addEventListener('change', () => {
    slider.style.background = input.checked ? 'var(--text-accent)' : 'rgba(255,255,255,0.15)';
    dot.style.left = input.checked ? '20px' : '3px';
  });

  label.appendChild(input);
  label.appendChild(slider);
  return label;
}
