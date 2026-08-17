import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { getQuality } from '../data/production.js';
import { getProductionSummary } from '../core/ProductionSystem.js';
import { sellResource, RESOURCE_SELL_PRICES } from '../core/TradeSystem.js';
import { bus } from '../core/EventBus.js';

const PRODUCT_COPY = new Map();

const RESOURCE_NAMES = {
  metal: '金属',
  crystal: '晶体',
  energy: '能量',
  food: '食物',
  alloy: '星尘合金',
  crystal_circuit: '晶体电路',
  nutrient_pack: '营养补给包',
  energy_cell: '能量电池',
  bio_sample: '生态标本',
  thermal_kit: '保温考察包',
  cooling_kit: '降温考察包',
  star_souvenir: '星尘纪念品',
};

/**
 * 物资总览面板：出售资源、查看加工库存与生产队列。
 * 配方选择与自动生产已移到「综合工坊」的建筑子页。
 */
export function openProductionPanel() {
  const container = createElement('div', { className: 'production-panel-inner' });

  const render = () => {
    container.replaceChildren();
    const summary = getProductionSummary();

    container.appendChild(createElement('p', { className: 'settings-hint' }, [
      summary.workshops > 0
        ? `已建造 ${summary.workshops} 座综合工坊 · 点击地图上的工坊可设置加工`
        : '尚未建造综合工坊 · 加工需在综合工坊里配置',
    ]));

    // 物资概览（不再支持直接变卖，获利收敛至货架销售与游客消费）
    const resourceSection = createElement('div', { className: 'production-sell' });
    resourceSection.appendChild(createElement('h3', {}, ['基础资源库存']));
    resourceSection.appendChild(createElement('p', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' } }, [
      '💡 原料不可直接卖出，可通过建造综合工坊加工为高品质商品，或在商铺货架上架供外星游客与贸易商队购买获利。'
    ]));
    for (const res of ['metal', 'crystal', 'energy', 'food']) {
      const amount = Math.floor(gameState.state.resources[res] || 0);
      const row = createElement('div', { className: 'production-sell-row' }, [
        createElement('span', {}, [`${RESOURCE_NAMES[res] || res}`]),
        createElement('strong', { style: { color: 'var(--text-accent)' } }, [`×${amount}`]),
      ]);
      resourceSection.appendChild(row);
    }
    container.appendChild(resourceSection);

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
  };

  const unsubscribers = [
    bus.on('day:advance', render),
    bus.on('production:inventory', render),
    bus.on('production:started', render),
    bus.on('production:completed', render),
    bus.on('production:copy', ({ productId, copy }) => { PRODUCT_COPY.set(productId, copy); render(); }),
  ];
  render();
  const content = ui.createModalContent('物资总览', 'factory', container);
  ui.openModal(content, 'modal-lg');
  bus.once('modal:close', () => unsubscribers.forEach((unsubscribe) => unsubscribe()));
}
