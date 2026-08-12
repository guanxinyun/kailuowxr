/**
 * 星尘殖民地 — 建造面板
 */
import { bus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { aiAdvisor } from '../core/AIAdvisor.js';
import { AI_REQUEST_TYPES } from '../ai/AIPrompts.js';
import { createElement, lucideIcon, formatNumber, $ } from '../core/utils.js';
import { BUILDINGS, BUILDING_CATEGORIES, getBuildingsByCategory } from '../data/buildings.js';
import { GRAVITY_CONFIG, RESOURCES } from '../data/gamedata.js';

export function openBuildPanel() {
  let activeCategory = 'basic';
  let selectedBuilding = null;

  const container = createElement('div', { className: 'build-panel-inner' });

  function render() {
    container.innerHTML = '';

    // Tabs
    const tabs = createElement('div', { className: 'tab-group build-tabs' });
    for (const cat of BUILDING_CATEGORIES) {
      const tab = createElement('div', {
        className: `tab-item ${cat.id === activeCategory ? 'active' : ''}`,
        dataset: { category: cat.id },
      }, [
        lucideIcon(cat.icon, 14),
        document.createTextNode(cat.name),
      ]);
      tab.addEventListener('click', () => {
        activeCategory = cat.id;
        selectedBuilding = null;
        render();
      });
      tabs.appendChild(tab);
    }
    container.appendChild(tabs);

    // Grid
    const grid = createElement('div', { className: 'build-grid' });
    const buildings = getBuildingsByCategory(activeCategory);

    for (const b of buildings) {
      const isLocked = b.unlockTech && !gameState.state.researchedTechs.includes(b.unlockTech);
      const canAfford = gameState.canAfford(b.cost);

      const card = createElement('div', {
        className: `building-card ${isLocked ? 'locked' : ''} ${selectedBuilding === b.id ? 'selected' : ''}`,
        dataset: { buildingId: b.id },
      });

      // Header
      const header = createElement('div', { className: 'building-card-header' }, [
        createElement('div', { className: 'building-icon' }, [lucideIcon(b.icon, 24)]),
        createElement('div', { style: { flex: '1', minWidth: '0' } }, [
          createElement('div', { className: 'building-name' }, [b.name]),
          createElement('div', { className: 'building-subtitle', title: b.desc }, [b.desc]),
        ]),
      ]);
      card.appendChild(header);

      // Cost
      const costRow = createElement('div', { className: 'building-cost' });
      for (const [res, amount] of Object.entries(b.cost)) {
        const resInfo = RESOURCES[res];
        const insufficient = (gameState.state.resources[res] || 0) < amount;
        costRow.appendChild(createElement('span', {
          className: `cost-item ${insufficient ? 'insufficient' : ''}`,
        }, [
          lucideIcon(resInfo?.icon || 'circle-dot', 12),
          document.createTextNode(formatNumber(amount)),
        ]));
      }
      card.appendChild(costRow);

      // Gravity mini bars (hidden, shown on hover)
      const gravityEl = createElement('div', { className: 'building-gravity' });
      const miniBars = createElement('div', { className: 'mini-bars' });
      for (const [dim, val] of Object.entries(b.gravity)) {
        if (val <= 0) continue;
        const cfg = GRAVITY_CONFIG[dim];
        const bar = createElement('div', { className: 'mini-bar-row' }, [
          createElement('span', {
            className: 'mini-bar-label',
            style: { color: cfg.color },
          }, [cfg.name[0]]),
          createElement('div', { className: 'mini-bar-track' }, [
            createElement('div', {
              className: 'mini-bar-fill',
              style: { width: `${Math.min(val * 10, 100)}%`, background: cfg.color },
            }),
          ]),
        ]);
        miniBars.appendChild(bar);
      }
      gravityEl.appendChild(miniBars);
      card.appendChild(gravityEl);

      // Lock info
      if (isLocked) {
        card.appendChild(createElement('div', { className: 'building-lock-info' }, [
          lucideIcon('lock', 12),
          document.createTextNode(`需要科技: ${b.unlockTech}`),
        ]));
      }

      // Click handler
      if (!isLocked) {
        card.addEventListener('click', () => {
          selectedBuilding = b.id;
          render();
          showPreview(b);
        });
      }

      grid.appendChild(card);
    }
    container.appendChild(grid);

    // Preview area
    const preview = createElement('div', {
      className: `build-preview ${selectedBuilding ? 'active' : ''}`,
      id: 'build-preview',
    });
    container.appendChild(preview);

    if (selectedBuilding) {
      const b = BUILDINGS.find(x => x.id === selectedBuilding);
      if (b) showPreview(b);
    }
  }

  function showPreview(b) {
    const preview = $('#build-preview', container);
    if (!preview) return;

    preview.innerHTML = '';
    preview.classList.add('active');

    const header = createElement('div', { className: 'build-preview-header' }, [
      createElement('span', { className: 'build-preview-name' }, [b.name]),
      (() => {
        const btn = createElement('button', { className: 'btn btn-primary' }, [
          lucideIcon('hammer', 14),
          document.createTextNode(' 建造'),
        ]);
        btn.addEventListener('click', () => {
          gameState.set('placingBuilding', b.id);
          ui.closeModal();
          bus.emit('mode:build', b);
        });
        if (!gameState.canAfford(b.cost)) {
          btn.disabled = true;
          btn.style.opacity = '0.5';
        }
        return btn;
      })(),
    ]);
    preview.appendChild(header);

    // 完整描述
    preview.appendChild(createElement('div', {
      className: 'build-preview-desc',
      style: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: 'var(--sp-3)' },
    }, [b.desc]));

    // 效果说明
    const effectItems = [];
    if (b.effect.metal) effectItems.push(`金属 +${b.effect.metal}`);
    if (b.effect.crystal) effectItems.push(`晶体 +${b.effect.crystal}`);
    if (b.effect.energy) effectItems.push(`能量 +${b.effect.energy}`);
    if (b.effect.food) effectItems.push(`食物 +${b.effect.food}`);
    if (b.effect.research) effectItems.push(`研究 +${b.effect.research}`);
    if (b.effect.population) effectItems.push(`人口上限 +${b.effect.population}`);
    if (b.effect.happiness) effectItems.push(`幸福度 +${b.effect.happiness}`);
    if (b.effect.defense) effectItems.push(`防御 +${b.effect.defense}`);
    if (b.effect.tourism) effectItems.push(`旅游 +${b.effect.tourism}`);
    if (b.effect.income) effectItems.push(`收入 +${b.effect.income}`);
    if (b.effect.trade) effectItems.push('解锁贸易');
    if (b.effect.storageBonus) effectItems.push(`存储 +${b.effect.storageBonus}`);
    if (b.effect.globalEfficiency) effectItems.push(`全局效率 +${Math.round(b.effect.globalEfficiency * 100)}%`);
    if (effectItems.length > 0) {
      preview.appendChild(createElement('div', {
        style: { fontSize: '12px', color: 'var(--text-accent)', marginBottom: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', background: 'rgba(100,140,255,0.08)', borderRadius: 'var(--radius-sm)' },
      }, [`效果：${effectItems.join('、')}`]));
    }

    if (b.flavor) {
      preview.appendChild(createElement('div', { className: 'build-preview-flavor' }, [b.flavor]));
    }

    // AI建造建议（信号接收 → 打字机效果）
    const aiContainer = createElement('div', { style: { marginTop: '8px' } });
    preview.appendChild(aiContainer);

    aiAdvisor.showWithPlaceholder(
      AI_REQUEST_TYPES.BUILDING_TIP,
      { buildingId: b.id },
      aiContainer,
      { label: 'AI 建议', typeSpeed: 20 }
    );
  }

  render();

  const content = ui.createModalContent('建造', 'hammer', container);
  ui.openModal(content, 'modal-lg');
}
