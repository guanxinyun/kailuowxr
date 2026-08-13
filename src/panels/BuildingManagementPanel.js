import { bus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, formatNumber, lucideIcon } from '../core/utils.js';
import { RESOURCES } from '../data/gamedata.js';
import { getManagedBuildings, upgradeBuilding } from '../core/BuildingSystem.js';
import { getComboSummary } from '../core/ComboSystem.js';
import { getCurrentBuildingDailyOutput, formatDailyRate } from '../core/ResourceFlowSystem.js';
import { getShelfSlots, stockShelf, removeFromShelf, PRODUCT_PRICES, buyResource, getDailyBuyLimit, setPromotionLevel, startCampaign, PROMOTION_LEVELS, CAMPAIGN_TEMPLATES, getPromotionBonus } from '../core/TradeSystem.js';
import { getInventoryEntry, getInventoryQuantity, getBuildingAutoProductionStatus, toggleBuildingAutoProduction } from '../core/ProductionSystem.js';
import { getQuality, PRODUCTION_RECIPES } from '../data/production.js';

const RESOURCE_NAMES = {
  metal: '金属', crystal: '晶体', energy: '能量', food: '食物',
  alloy: '星尘合金', crystal_circuit: '晶体电路', nutrient_pack: '营养补给包',
  energy_cell: '能量电池', bio_sample: '生态标本',
};

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

      // ===== 自动加工信息与开关 =====
      const autoStatuses = getBuildingAutoProductionStatus(entry.building);
      if (autoStatuses.length > 0 && entry.operation.operational) {
        const autoSection = createElement('div', { className: 'building-auto-production-section' });
        autoSection.appendChild(createElement('div', { className: 'auto-production-header' }, [
          lucideIcon('cog', 14),
          document.createTextNode(' 自动加工'),
        ]));
        for (const status of autoStatuses) {
          const { recipe, enabled, active, progress } = status;
          const row = createElement('div', { className: `auto-production-row ${enabled ? '' : 'disabled'}` });

          // 配方信息
          const recipeInfo = createElement('div', { className: 'auto-production-info' });
          const inputsText = Object.entries(recipe.inputs)
            .map(([id, amount]) => `${RESOURCE_NAMES[id] || id} ${amount}`)
            .join(' + ');
          recipeInfo.appendChild(createElement('strong', {}, [recipe.name]));
          recipeInfo.appendChild(createElement('div', { className: 'auto-production-detail' }, [
            `消耗：${inputsText} → 产出：${recipe.output.name} ×${recipe.output.quantity}`,
          ]));

          // 进度（如果正在加工中）
          if (enabled && active) {
            const pct = Math.min(100, Math.round(progress * 100));
            recipeInfo.appendChild(createElement('div', { className: 'auto-production-progress' }, [
              createElement('span', { className: 'auto-progress-bar', style: { width: `${pct}%` } }),
            ]));
            recipeInfo.appendChild(createElement('span', { className: 'auto-progress-text' }, [`加工中 ${pct}%`]));
          } else if (!enabled) {
            recipeInfo.appendChild(createElement('span', { className: 'auto-progress-text muted' }, ['已暂停']));
          }

          row.appendChild(recipeInfo);

          // 开关按钮
          const toggleBtn = createElement('button', {
            className: `btn btn-sm ${enabled ? 'btn-active' : 'btn-muted'}`,
            title: enabled ? '点击关闭自动加工' : '点击开启自动加工',
          }, [
            lucideIcon(enabled ? 'toggle-right' : 'toggle-left', 16),
            document.createTextNode(enabled ? ' 开' : ' 关'),
          ]);
          toggleBtn.addEventListener('click', () => {
            toggleBuildingAutoProduction(entry.building, recipe.id);
            render();
          });
          row.appendChild(toggleBtn);

          autoSection.appendChild(row);
        }
        card.appendChild(autoSection);
      }

      if (entry.upgradeCost) {
        const products = entry.upgradeCost._products;
        const resourceCost = Object.fromEntries(
          Object.entries(entry.upgradeCost).filter(([k]) => k !== '_products'),
        );
        const costParts = Object.entries(resourceCost)
          .map(([resource, amount]) => `${RESOURCES[resource]?.name || resource} ${formatNumber(amount)}`);
        if (products) {
          for (const [productId, amount] of Object.entries(products)) {
            const recipe = PRODUCTION_RECIPES.find(r => r.id === productId);
            costParts.push(`${recipe?.name || productId} ×${amount}`);
          }
        }
        const costText = costParts.join(' · ');
        const canAffordResources = gameState.canAfford(resourceCost);
        const canAffordProducts = !products || Object.entries(products).every(
          ([pid, amt]) => getInventoryQuantity(pid) >= amt,
        );
        const button = createElement('button', {
          className: 'btn btn-primary',
          disabled: !entry.operation.operational || !canAffordResources || !canAffordProducts,
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

      // ===== 货架系统 =====
      const shelfSlots = getShelfSlots(entry.building.buildingId);
      if (shelfSlots > 0 && entry.operation.operational) {
        const shelfSection = createElement('div', { className: 'building-shelf-section' });
        shelfSection.appendChild(createElement('div', { className: 'shelf-header' }, [
          lucideIcon('shopping-bag', 14),
          document.createTextNode(` 货架 (${(entry.building.shopShelf || []).length}/${shelfSlots})`),
        ]));

        // 显示已上架商品
        for (const item of (entry.building.shopShelf || [])) {
          const recipe = PRODUCTION_RECIPES.find(r => r.id === item.productId);
          const quality = getQuality(item.qualityScore);
          const row = createElement('div', { className: 'shelf-item' }, [
            createElement('span', {}, [`${recipe?.name || item.productId} [${quality.grade}] × ${item.stock}`]),
          ]);
          const removeBtn = createElement('button', { className: 'btn btn-sm' }, ['下架']);
          removeBtn.addEventListener('click', () => { removeFromShelf(entry.building, item.productId); render(); });
          row.appendChild(removeBtn);
          shelfSection.appendChild(row);
        }

        // 上架按钮
        if ((entry.building.shopShelf || []).length < shelfSlots) {
          const sellableProducts = Object.keys(PRODUCT_PRICES).filter(pid => {
            const inv = getInventoryEntry(pid);
            return inv && inv.quantity > 0 && !(entry.building.shopShelf || []).some(s => s.productId === pid);
          });
          if (sellableProducts.length > 0) {
            const select = createElement('select', { className: 'shelf-select' });
            select.appendChild(createElement('option', { value: '' }, ['选择商品...']));
            for (const pid of sellableProducts) {
              const recipe = PRODUCTION_RECIPES.find(r => r.id === pid);
              const inv = getInventoryEntry(pid);
              select.appendChild(createElement('option', { value: pid }, [`${recipe?.name || pid} (库存${inv.quantity})`]));
            }
            const qtyInput = createElement('input', { type: 'number', className: 'shelf-qty', min: 1, value: 1, placeholder: '数量' });
            const addBtn = createElement('button', { className: 'btn btn-primary btn-sm' }, ['上架']);
            addBtn.addEventListener('click', () => {
              const pid = select.value;
              const qty = parseInt(qtyInput.value) || 1;
              if (!pid) return;
              const result = stockShelf(entry.building, pid, qty);
              if (!result.ok) gameState.addNotification({ title: '上架失败', text: result.reason, type: 'warning', icon: 'alert-triangle' });
              render();
            });
            const addRow = createElement('div', { className: 'shelf-add-row' }, [select, qtyInput, addBtn]);
            shelfSection.appendChild(addRow);
          }
        }
        card.appendChild(shelfSection);
      }

      // ===== 贸易站特殊功能：采购 + 宣传 =====
      if (entry.building.buildingId === 'trade_hub' && entry.operation.operational) {
        const tradeSection = createElement('div', { className: 'trade-hub-section' });
        tradeSection.appendChild(createElement('h4', {}, [lucideIcon('arrow-left-right', 14), document.createTextNode(' 贸易站功能')]));

        // 采购资源
        const buySection = createElement('div', { className: 'trade-buy-section' });
        buySection.appendChild(createElement('div', { className: 'trade-subtitle' }, [`采购资源 (今日上限: ${getDailyBuyLimit()}单位)`]));
        for (const [res, price] of Object.entries({ metal: 3, crystal: 8, energy: 2, food: 2 })) {
          const row = createElement('div', { className: 'trade-buy-row' });
          row.appendChild(createElement('span', {}, [`${RESOURCES[res].name} — ${price}星币/单位`]));
          const qtyInput = createElement('input', { type: 'number', className: 'trade-qty', min: 1, value: 5 });
          const buyBtn = createElement('button', { className: 'btn btn-sm' }, ['购买']);
          buyBtn.addEventListener('click', () => {
            const qty = parseInt(qtyInput.value) || 5;
            const result = buyResource(res, qty);
            if (result.ok) {
              gameState.addNotification({ title: '采购成功', text: `购入 ${result.bought} ${RESOURCES[res].name}，花费 ${result.cost} 星币`, type: 'success', icon: 'coins' });
            } else {
              gameState.addNotification({ title: '采购失败', text: result.reason, type: 'warning', icon: 'alert-triangle' });
            }
            render();
          });
          row.appendChild(qtyInput);
          row.appendChild(buyBtn);
          buySection.appendChild(row);
        }
        tradeSection.appendChild(buySection);

        // 宣传引流
        const promoSection = createElement('div', { className: 'trade-promo-section' });
        promoSection.appendChild(createElement('div', { className: 'trade-subtitle' }, [`宣传引流 (当前加成: +${Math.round(getPromotionBonus() * 100)}%)`]));

        // 持续投入
        const promoSelect = createElement('select', { className: 'promo-select' });
        for (const p of PROMOTION_LEVELS) {
          const opt = createElement('option', { value: p.level, selected: p.level === (gameState.state.trade?.promotionLevel || 0) },
            [`${p.label}${p.cost ? ` (${p.cost}星币/天, +${Math.round(p.bonus * 100)}%)` : ''}`]);
          promoSelect.appendChild(opt);
        }
        promoSelect.addEventListener('change', () => { setPromotionLevel(parseInt(promoSelect.value)); render(); });
        promoSection.appendChild(createElement('div', { className: 'promo-row' }, [
          createElement('span', {}, ['持续投入：']), promoSelect,
        ]));

        // 临时活动
        const campaign = gameState.state.trade?.campaign;
        if (campaign) {
          const remaining = campaign.duration - (gameState.state.day - campaign.startDay);
          promoSection.appendChild(createElement('div', { className: 'campaign-active' }, [
            `${campaign.label}进行中 — 剩余${remaining}天，游客+${Math.round(campaign.bonus * 100)}%`,
          ]));
        } else {
          for (const tpl of CAMPAIGN_TEMPLATES) {
            const btn = createElement('button', {
              className: 'btn btn-sm',
              disabled: !gameState.canAfford({ credits: tpl.cost }),
            }, [`${tpl.label} (${tpl.cost}星币, ${tpl.duration}天, +${Math.round(tpl.bonus * 100)}%)`]);
            btn.addEventListener('click', () => { startCampaign(tpl.type); render(); });
            promoSection.appendChild(btn);
          }
        }
        tradeSection.appendChild(promoSection);
        card.appendChild(tradeSection);
      }

      list.appendChild(card);
    }
    container.appendChild(list);
  };

  const unsubscribers = [
    bus.on('building:placed', render),
    bus.on('building:upgraded', render),
    bus.on('resource:change', render),
    bus.on('trade:shelf-updated', render),
    bus.on('trade:product-sold', render),
    bus.on('building:auto-production-toggled', render),
    bus.on('day:advance', render),
  ];
  render();
  const content = ui.createModalContent('设施管理', 'building-2', container);
  ui.openModal(content, 'modal-lg');
  bus.once('modal:close', () => unsubscribers.forEach((unsubscribe) => unsubscribe()));
}
