import { bus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, formatNumber, lucideIcon } from '../core/utils.js';
import { RESOURCES } from '../data/gamedata.js';
import { getManagedBuildings, upgradeBuilding } from '../core/BuildingSystem.js';
import { getComboSummary } from '../core/ComboSystem.js';
import { getCurrentBuildingDailyOutput, formatDailyRate } from '../core/ResourceFlowSystem.js';

export function openBuildingManagementPanel() {
  const container = createElement('div', { className: 'building-management-panel' });

  const render = () => {
    container.replaceChildren();
    container.appendChild(createElement('p', { className: 'settings-hint' }, [
      '除降落点和道路外，设施必须通过连续道路连接降落点才能运转。每次升级使产出和工坊速度提升 25%。',
    ]));

    const combos = getComboSummary();
    const comboSection = createElement('div', { className: 'managed-combos' });
    comboSection.appendChild(createElement('h3', {}, ['已发现组合']));
    if (!combos.discovered.length) {
      comboSection.appendChild(createElement('div', { className: 'production-empty' }, ['调整建筑布局，也许会发现意外的协同效果。']));
    }
    for (const combo of combos.discovered) {
      const active = combos.active.some((entry) => entry.id === combo.id);
      comboSection.appendChild(createElement('div', { className: `managed-combo ${active ? 'active' : 'inactive'}` }, [
        createElement('div', { className: 'managed-combo-icon' }, [lucideIcon(combo.icon, 18)]),
        createElement('div', { className: 'managed-combo-info' }, [
          createElement('strong', {}, [combo.name]),
          createElement('div', {}, [combo.description]),
          createElement('span', {}, [active ? combo.effectText : `暂未生效 · ${combo.effectText}`]),
        ]),
      ]));
    }
    container.appendChild(comboSection);

    const list = createElement('div', { className: 'managed-building-list' });
    for (const entry of getManagedBuildings()) {
      if (!entry.data) continue;
      const card = createElement('div', { className: `managed-building ${entry.operation.operational ? 'operational' : 'offline'}` });
      card.appendChild(createElement('div', { className: 'managed-building-icon' }, [lucideIcon(entry.data.icon, 20)]));
      const info = createElement('div', { className: 'managed-building-info' });
      info.appendChild(createElement('strong', {}, [`${entry.data.name} · ${entry.level}级`]));
      info.appendChild(createElement('div', { className: 'managed-building-location' }, [`坐标 (${entry.building.x}, ${entry.building.y}) · 效率 ${Math.round(entry.efficiency * 100)}%`]));
      info.appendChild(createElement('div', {
        className: `managed-building-status ${entry.operation.operational ? 'online' : 'offline'}`,
      }, [entry.operation.operational ? '运行中' : entry.operation.reason]));
      const dailyOutput = getCurrentBuildingDailyOutput(entry.building);
      const outputText = Object.entries(dailyOutput)
        .map(([resource, amount]) => `${RESOURCES[resource]?.name || resource} +${formatDailyRate(amount)}/天`)
        .join(' · ');
      if (outputText) info.appendChild(createElement('div', { className: 'managed-building-output' }, [`当前产出：${outputText}`]));
      else if (Object.keys(entry.data.effect || {}).some(key => ['metal', 'crystal', 'energy', 'food', 'research', 'income', 'trade'].includes(key))) {
        info.appendChild(createElement('div', { className: 'managed-building-output' }, [`当前产出：0/天${entry.operation.reason ? ` · ${entry.operation.reason}` : ''}`]));
      }
      card.appendChild(info);

      if (entry.upgradeCost) {
        const costText = Object.entries(entry.upgradeCost)
          .map(([resource, amount]) => `${RESOURCES[resource]?.name || resource} ${formatNumber(amount)}`)
          .join(' · ');
        const button = createElement('button', {
          className: 'btn btn-primary',
          disabled: !entry.operation.operational || !gameState.canAfford(entry.upgradeCost),
          title: `升级消耗：${costText}`,
        }, [lucideIcon('arrow-up-circle', 14), document.createTextNode(` 升级 ${costText}`)]);
        button.addEventListener('click', () => {
          const result = upgradeBuilding(entry.building.id);
          if (!result.ok) {
            gameState.addNotification({ title: '无法升级', text: result.reason, type: 'warning', icon: 'alert-triangle' });
          }
          render();
        });
        card.appendChild(button);
      } else if (entry.level >= 3) {
        card.appendChild(createElement('span', { className: 'managed-building-max' }, ['已满级']));
      }
      list.appendChild(card);
    }
    container.appendChild(list);
  };

  const unsubscribers = [
    bus.on('building:placed', render),
    bus.on('building:upgraded', render),
    bus.on('resource:change', render),
  ];
  render();
  const content = ui.createModalContent('设施管理', 'building-2', container);
  ui.openModal(content, 'modal-lg');
  bus.once('modal:close', () => unsubscribers.forEach((unsubscribe) => unsubscribe()));
}
