/**
 * 星尘殖民地 — 贸易系统
 * 挂载销售（建筑货架）、贸易站采购资源、宣传引流
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { getBuildingOperationalState } from './BuildingSystem.js';
import { getInventoryEntry, addInventory } from './ProductionSystem.js';
import { getQuality } from '../data/production.js';

// ===== 常量 =====

/** 可挂载销售的建筑及其货架槽位数 */
const SHOP_BUILDINGS = {
  trade_hub: 3,
  plaza: 1,
  museum: 1,
  concert_hall: 1,
  monument: 1,
};

/** 加工品基础售价 */
export const PRODUCT_PRICES = {
  alloy: 15,
  crystal_circuit: 20,
  nutrient_pack: 8,
  energy_cell: 12,
  bio_sample: 18,
  thermal_kit: 35,
  cooling_kit: 40,
  star_souvenir: 25,
};

/** 品质售价乘数 */
const QUALITY_PRICE_MULTIPLIER = { D: 0.6, C: 0.8, B: 1.0, A: 1.3, S: 1.8 };

/** 基础资源采购价格（星币/单位） */
const RESOURCE_BUY_PRICES = { metal: 3, crystal: 8, energy: 2, food: 2 };

/** 宣传档位 */
export const PROMOTION_LEVELS = [
  { level: 0, label: '关闭', cost: 0, bonus: 0 },
  { level: 1, label: '低', cost: 3, bonus: 0.15 },
  { level: 2, label: '中', cost: 8, bonus: 0.35 },
  { level: 3, label: '高', cost: 15, bonus: 0.60 },
];

/** 临时宣传活动模板 */
export const CAMPAIGN_TEMPLATES = [
  { type: 'small', label: '小型宣传', cost: 50, duration: 10, bonus: 0.30 },
  { type: 'large', label: '大型宣传', cost: 120, duration: 15, bonus: 0.60 },
];

// ===== 贸易状态初始化 =====

export function ensureTradeState() {
  const s = gameState.state;
  if (!s.trade) {
    s.trade = { dailyBought: {}, lastTradeDay: 0, promotionLevel: 0, campaign: null };
  }
  // 确保所有建筑有 shopShelf
  for (const b of s.buildings) {
    if (SHOP_BUILDINGS[b.buildingId] != null && !b.shopShelf) {
      b.shopShelf = [];
    }
  }
}

// ===== 货架管理 =====

/** 获取建筑的最大货架槽位数 */
export function getShelfSlots(buildingId) {
  return SHOP_BUILDINGS[buildingId] ?? 0;
}

/** 上架加工品到建筑货架 */
export function stockShelf(building, productId, quantity) {
  const slots = getShelfSlots(building.buildingId);
  if (!slots) return { ok: false, reason: '该建筑不支持挂载销售' };
  if (!building.shopShelf) building.shopShelf = [];

  const inv = getInventoryEntry(productId);
  if (!inv || inv.quantity < quantity) return { ok: false, reason: '库存不足' };
  if (!(productId in PRODUCT_PRICES)) return { ok: false, reason: '该产品不可出售' };

  // 查找已有同产品的槽位
  const existing = building.shopShelf.find(s => s.productId === productId);
  if (existing) {
    addInventory(productId, -quantity);
    existing.stock += quantity;
    bus.emit('trade:shelf-updated', { building, productId });
    return { ok: true };
  }

  // 新槽位
  if (building.shopShelf.length >= slots) return { ok: false, reason: '货架已满' };
  addInventory(productId, -quantity);
  building.shopShelf.push({ productId, qualityScore: inv.qualityScore, stock: quantity });
  bus.emit('trade:shelf-updated', { building, productId });
  return { ok: true };
}

/** 从货架移除加工品（退回库存） */
export function removeFromShelf(building, productId) {
  if (!building.shopShelf) return { ok: false, reason: '无货架' };
  const idx = building.shopShelf.findIndex(s => s.productId === productId);
  if (idx === -1) return { ok: false, reason: '货架上没有该产品' };
  const item = building.shopShelf[idx];
  addInventory(productId, item.stock, item.qualityScore);
  building.shopShelf.splice(idx, 1);
  bus.emit('trade:shelf-updated', { building, productId });
  return { ok: true };
}

export function getGlobalPriceBonus() {
  let bonus = 0;
  if (!gameState.state?.buildings) return bonus;
  for (const b of gameState.state.buildings) {
    if (!b.built) continue;
    const data = getBuildingById(b.buildingId);
    if (data?.effect?.globalPriceBonus) {
      bonus += data.effect.globalPriceBonus;
    }
  }
  return bonus;
}

/** 游客购买货架商品（由 TouristManager 调用） */
export function touristBuyFromShelf(building, tourist) {
  if (!building.shopShelf?.length) return 0;
  let totalSpent = 0;
  const globalBonus = getGlobalPriceBonus();

  for (const slot of building.shopShelf) {
    if (slot.stock <= 0) continue;
    // 购买概率 = 满意度 × 0.3
    const buyChance = (tourist.satisfaction || 50) / 100 * 0.3;
    if (Math.random() > buyChance) continue;
    const quality = getQuality(slot.qualityScore);
    const priceMultiplier = QUALITY_PRICE_MULTIPLIER[quality.grade] || 1;
    const basePrice = PRODUCT_PRICES[slot.productId] || 10;
    const price = Math.floor(basePrice * priceMultiplier * (1 + globalBonus));
    if (price > (tourist.budget - tourist.spent)) continue;
    slot.stock--;
    tourist.spent += price;
    totalSpent += price;
    bus.emit('trade:product-sold', { building, productId: slot.productId, price, tourist });
  }
  // 清除售罄的槽位
  building.shopShelf = building.shopShelf.filter(s => s.stock > 0);
  return totalSpent;
}

// ===== 贸易站采购资源 =====

/** 计算资源购买价格（递增） */
export function getResourceBuyPrice(resourceType, quantity) {
  const base = RESOURCE_BUY_PRICES[resourceType];
  if (!base) return Infinity;
  let total = 0;
  for (let i = 0; i < quantity; i++) {
    const tier = Math.floor(i / 10);
    total += Math.ceil(base * Math.pow(1.2, tier));
  }
  return total;
}

/** 获取每日购买上限 */
export function getDailyBuyLimit() {
  const tradeHubs = gameState.state.buildings.filter(
    b => b.buildingId === 'trade_hub' && getBuildingOperationalState(b).operational
  );
  if (!tradeHubs.length) return 0;
  const maxLevel = Math.max(...tradeHubs.map(b => b.level || 1));
  return maxLevel * 20;
}

/** 购买资源 */
export function buyResource(resourceType, quantity) {
  ensureTradeState();
  const limit = getDailyBuyLimit();
  if (!limit) return { ok: false, reason: '需要运营中的贸易站' };
  if (!(resourceType in RESOURCE_BUY_PRICES)) return { ok: false, reason: '该资源不可购买' };

  const trade = gameState.state.trade;
  const day = gameState.state.day;
  if (trade.lastTradeDay !== day) {
    trade.dailyBought = {};
    trade.lastTradeDay = day;
  }
  const alreadyBought = trade.dailyBought[resourceType] || 0;
  const canBuy = Math.min(quantity, limit - alreadyBought);
  if (canBuy <= 0) return { ok: false, reason: '今日购买量已达上限' };

  const cost = getResourceBuyPrice(resourceType, canBuy);
  if (!gameState.canAfford({ credits: cost })) return { ok: false, reason: '星币不足' };

  gameState.spend({ credits: cost });
  gameState.addResource(resourceType, canBuy);
  trade.dailyBought[resourceType] = alreadyBought + canBuy;
  bus.emit('trade:resource-bought', { resourceType, quantity: canBuy, cost });
  return { ok: true, bought: canBuy, cost };
}

// ===== 出售资源换取星币 =====

/** 基础资源出售价格（星币/单位） */
export const RESOURCE_SELL_PRICES = { metal: 2, crystal: 5, energy: 1, food: 1 };

/**
 * 出售基础资源换取星币（通用动作，无建筑门槛）
 * 物资只能卖或作为加工原料，这里提供「卖」的出口。
 */
export function sellResource(resourceType, quantity) {
  if (!(resourceType in RESOURCE_SELL_PRICES)) return { ok: false, reason: '该资源不可出售' };
  const available = gameState.state.resources[resourceType] || 0;
  const qty = Math.min(Math.max(1, Math.floor(quantity)), available);
  if (qty <= 0) return { ok: false, reason: '资源不足' };
  const credits = qty * RESOURCE_SELL_PRICES[resourceType];
  gameState.addResource(resourceType, -qty);
  gameState.addResource('credits', credits);
  bus.emit('trade:resource-sold', { resourceType, quantity: qty, credits });
  return { ok: true, sold: qty, credits };
}

// ===== 宣传引流 =====

/** 设置持续宣传档位 */
export function setPromotionLevel(level) {
  ensureTradeState();
  const template = PROMOTION_LEVELS.find(p => p.level === level);
  if (!template) return { ok: false, reason: '无效的宣传档位' };
  gameState.state.trade.promotionLevel = level;
  bus.emit('trade:promotion-changed', { level });
  return { ok: true };
}

/** 发起临时宣传活动 */
export function startCampaign(type) {
  ensureTradeState();
  const trade = gameState.state.trade;
  if (trade.campaign) return { ok: false, reason: '已有进行中的宣传活动' };
  const template = CAMPAIGN_TEMPLATES.find(c => c.type === type);
  if (!template) return { ok: false, reason: '无效的活动类型' };
  if (!gameState.canAfford({ credits: template.cost })) return { ok: false, reason: '星币不足' };

  gameState.spend({ credits: template.cost });
  trade.campaign = {
    type: template.type,
    label: template.label,
    startDay: gameState.state.day,
    duration: template.duration,
    bonus: template.bonus,
  };
  bus.emit('trade:campaign-started', { campaign: trade.campaign });
  gameState.addNotification({
    title: '宣传活动开始',
    text: `${template.label}已启动，持续${template.duration}天，游客到访率+${Math.round(template.bonus * 100)}%`,
    type: 'success', icon: 'megaphone', duration: 4000,
  });
  return { ok: true };
}

/** 获取当前宣传总加成（供 TouristManager 调用） */
export function getPromotionBonus() {
  ensureTradeState();
  const trade = gameState.state.trade;
  let bonus = 0;

  // 持续投入
  const promo = PROMOTION_LEVELS.find(p => p.level === trade.promotionLevel);
  if (promo) bonus += promo.bonus;

  // 临时活动
  if (trade.campaign) {
    const elapsed = gameState.state.day - trade.campaign.startDay;
    if (elapsed < trade.campaign.duration) {
      bonus += trade.campaign.bonus;
    } else {
      trade.campaign = null; // 活动结束
    }
  }

  return bonus;
}

/** 每日贸易系统更新（在 main.js gameTick 中调用） */
export function updateTradeSystem() {
  ensureTradeState();
  const trade = gameState.state.trade;

  // 扣除持续宣传费用
  const promo = PROMOTION_LEVELS.find(p => p.level === trade.promotionLevel);
  if (promo && promo.cost > 0) {
    if (gameState.canAfford({ credits: promo.cost })) {
      gameState.spend({ credits: promo.cost });
    } else {
      // 余额不足，自动降档
      const affordable = [...PROMOTION_LEVELS].reverse().find(
        p => p.cost <= (gameState.state.resources.credits || 0)
      );
      trade.promotionLevel = affordable?.level ?? 0;
      if (promo.level > 0) {
        gameState.addNotification({
          title: '宣传预算不足',
          text: `星币不足以维持宣传投入，已自动降至"${PROMOTION_LEVELS[trade.promotionLevel].label}"档。`,
          type: 'warning', icon: 'alert-triangle', duration: 4000,
        });
      }
    }
  }

  // 检查临时活动是否到期
  if (trade.campaign) {
    const elapsed = gameState.state.day - trade.campaign.startDay;
    if (elapsed >= trade.campaign.duration) {
      gameState.addNotification({
        title: '宣传活动结束',
        text: `${trade.campaign.label}已结束。`,
        type: 'info', icon: 'megaphone', duration: 3000,
      });
      trade.campaign = null;
    }
  }
}
