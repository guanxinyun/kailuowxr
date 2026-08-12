import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { PRODUCTION_RECIPES, getQuality } from '../data/production.js';
import { canStartProduction, getEstimatedProductionQuality, getProductionSummary, startProduction } from '../core/ProductionSystem.js';
import { bus } from '../core/EventBus.js';

const PRODUCT_COPY = new Map();

const RESOURCE_NAMES = {
  metal: '金属',
  crystal: '晶体',
  energy: '能量',
  food: '食物',
  alloy: '星尘合金',
  crystal_circuit: '晶体电路',
};

export function openProductionPanel() {
  const container = createElement('div', { className: 'production-panel-inner' });
  const render = () => {
    container.replaceChildren();
    const summary = getProductionSummary();
    const workshopText = summary.workshops > 0 ? `已建造 ${summary.workshops} 座综合工坊` : '尚未建造综合工坊';
    container.appendChild(createElement('p', { className: 'settings-hint' }, [workshopText]));

    const inventory = createElement('div', { className: 'production-inventory' });
    const inventoryEntries = Object.entries(summary.inventory).filter(([, entry]) => entry.quantity > 0);
    inventory.appendChild(createElement('h3', {}, ['加工库存']));
    if (!inventoryEntries.length) {
      inventory.appendChild(createElement('div', { className: 'production-empty' }, ['还没有加工品']));
    } else {
      for (const [id, entry] of inventoryEntries) {
        const quality = getQuality(entry.qualityScore);
        const purpose = id === 'star_souvenir' ? ' · 游客会购买' : '';
        const copy = PRODUCT_COPY.get(id);
        inventory.appendChild(createElement('span', {
          className: 'production-inventory-item',
          style: { borderColor: quality.color },
          title: copy?.description || '',
        }, [`${copy?.displayName || RESOURCE_NAMES[id] || id} ×${entry.quantity} · ${quality.grade}级${purpose}`]));
      }
    }
    container.appendChild(inventory);

    const queue = createElement('div', { className: 'production-queue' });
    queue.appendChild(createElement('h3', {}, [`生产队列（${summary.queue.length}/3）`]));
    if (!summary.queue.length) queue.appendChild(createElement('div', { className: 'production-empty' }, ['队列为空']));
    for (const job of summary.queue) {
      const progress = Math.max(0, Math.min(100, ((job.totalDays - job.remainingDays) / job.totalDays) * 100));
      queue.appendChild(createElement('div', { className: 'production-job' }, [
        createElement('div', { className: 'production-job-header' }, [
          createElement('strong', {}, [job.recipe.name]),
          createElement('span', {}, [`还需 ${Math.ceil(job.remainingDays)} 天`]),
        ]),
        createElement('div', { className: 'production-progress' }, [
          createElement('span', { style: { width: `${progress}%` } }),
        ]),
      ]));
    }
    container.appendChild(queue);

    const recipes = createElement('div', { className: 'production-recipes' });
    recipes.appendChild(createElement('h3', {}, ['加工配方']));
    for (const recipe of PRODUCTION_RECIPES) {
      const validation = canStartProduction(recipe.id);
      const quality = getEstimatedProductionQuality();
      const card = createElement('div', { className: 'production-recipe' });
      card.appendChild(createElement('div', { className: 'production-recipe-icon' }, [lucideIcon(recipe.icon, 20)]));
      const details = createElement('div', { className: 'production-recipe-details' });
      details.appendChild(createElement('strong', {}, [recipe.name]));
      details.appendChild(createElement('p', {}, [recipe.desc]));
      details.appendChild(createElement('div', { className: 'production-cost' }, [
        `需要：${Object.entries(recipe.inputs).map(([id, amount]) => `${RESOURCE_NAMES[id] || id} ${amount}`).join(' · ')}`,
      ]));
      details.appendChild(createElement('div', { className: 'production-output' }, [
        `产出：${recipe.output.name} ×${recipe.output.quantity} · ${recipe.days}天 · 预计${quality.grade}级`,
      ]));
      card.appendChild(details);
      const button = createElement('button', { className: `btn btn-primary ${validation.ok ? '' : 'is-blocked'}` }, [
        lucideIcon('play', 14), document.createTextNode(' 开始'),
      ]);
      button.title = validation.ok ? '开始加工' : validation.reason;
      button.addEventListener('click', () => {
        const result = startProduction(recipe.id);
        if (!result.ok) {
          gameState.addNotification({ title: '无法开始加工', text: result.reason, type: 'warning', icon: 'alert-triangle' });
          return;
        }
        render();
      });
      card.appendChild(button);
      recipes.appendChild(card);
    }
    container.appendChild(recipes);
  };

  const unsubscribers = [
    bus.on('day:advance', render),
    bus.on('production:inventory', render),
    bus.on('production:started', render),
    bus.on('production:completed', render),
    bus.on('production:copy', ({ productId, copy }) => { PRODUCT_COPY.set(productId, copy); render(); }),
  ];
  render();
  const content = ui.createModalContent('生产加工', 'factory', container);
  ui.openModal(content, 'modal-lg');
  bus.once('modal:close', () => unsubscribers.forEach((unsubscribe) => unsubscribe()));
}
