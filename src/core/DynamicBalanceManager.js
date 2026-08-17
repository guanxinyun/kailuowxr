/**
 * 星尘殖民地 — 动态数值调制管理器 (Dynamic Balance & Modding Manager)
 * 允许实时调整、预设切换、持久化、导出和导入全游戏平衡数值
 */
import { bus } from './EventBus.js';

export function createDefaultBalance() {
  return {
    buildingOutputRate: 0.15,
    foodPerResidentPerDay: 0.3,
    construction: { buildTimeDays: 10 },
    production: { durationMultiplier: 1 },
    growth: { experienceMultiplier: 1 },
    tourism: { incomeMultiplier: 1, minimumArrivalDays: 5, baseArrivalDays: 20 },
    events: { dailyChance: 0.015, aiGeneratedChance: 0.5 },
    mapExpansion: { stripDepth: 3, costMultiplier: 0.5 },
    blockExploration: {
      blockSize: 4,
      minDays: 30,
      maxDays: 90,
      costPerResident: 20,
      monthlyFeePerResident: 20,
      eventCount: 2,
      goodChanceBase: 0.55,
    },
    expedition: {
      minDays: 30,
      maxDays: 120,
      costPerResident: 30,
      monthlyFeePerResident: 25,
    },
    inventory: { maxPerItem: 50 },
    trade: {
      terrainCostMultiplier: 1.8,
      terrainCredits: 30,
      mountainProducts: { alloy: 2 },
      waterProducts: { crystal_circuit: 2 },
      upgradeCreditsCost: { 2: 30, 3: 80 },
    },
    aiTriggers: {
      proposalLimit: 3,
      buildingCooldownDays: 120,
      comboCooldownDays: 90,
      speciesCooldownDays: 240,
      shortageDays: 5,
      shortageCooldownDays: 30,
      shortageThresholds: { food: 20, energy: 15, metal: 15 },
    },
    monthly: {
      monthDays: 30,
    },
    maintenance: {
      creditsByCategory: {
        basic: 4, food: 5, science: 8, culture: 6, military: 9, special: 12,
      },
      resourceByCategory: {
        science: { energy: 3 },
        military: { energy: 4 },
        special: { energy: 4, crystal: 1 },
      },
    },
    workSchedule: { weekDays: 7, workDays: 5 },
    buildingBuffer: { capacity: 5 },
    logistics: { haulPerDay: 12 },
    buildingBaseOutputs: {}, // 各建筑基础产出直接数值覆盖，如 { mine: { metal: 6 }, solar_panel: { energy: 8 } }
    buildingOutputRates: {}, // 兼容独立倍率
    cardGame: {
      challengeChance: 0.3,
      roundsMin: 2,
      roundsMax: 3,
      requiredValueMin: 8,
      requiredValueMax: 12,
      anyValueMin: 12,
      anyValueMax: 16,
      handSize: 5,
      maxCardsPerRound: 3,
      bonusMultiplier: 1.5,
      redrawChance: 1,
      dice: { luck: [-1, 0, 0, 1, 1, 2] },
    },
  };
}

export const DEFAULT_BALANCE = createDefaultBalance();

// 官方预设包
export const BALANCE_PRESETS = [
  {
    id: 'default',
    name: '⚖️ 标准经典（默认）',
    desc: '官方设计的标准节奏，温和成长与稳步开拓。',
    overrides: {},
  },
  {
    id: 'relaxed',
    name: '🕊️ 轻松休闲（养老模式）',
    desc: '建造时间大幅缩短、口粮消耗减半、游客消费翻倍、探索经费大幅减免。',
    overrides: {
      foodPerResidentPerDay: 0.15,
      production: { durationMultiplier: 0.5 },
      tourism: { incomeMultiplier: 2, minimumArrivalDays: 3, baseArrivalDays: 10 },
      blockExploration: { costPerResident: 10, monthlyFeePerResident: 10, goodChanceBase: 0.75 },
      expedition: { costPerResident: 15, monthlyFeePerResident: 10 },
      cardGame: { bonusMultiplier: 2.0, requiredValueMin: 5, requiredValueMax: 9 },
    },
  },
  {
    id: 'industrial',
    name: '⚡ 工业帝国（极速制造）',
    desc: '加工速度 ×3、仓储上限大幅放宽、搬运效率翻倍。',
    overrides: {
      buildingOutputRate: 0.3,
      production: { durationMultiplier: 0.35 },
      inventory: { maxPerItem: 200 },
      buildingBuffer: { capacity: 15 },
      logistics: { haulPerDay: 30 },
    },
  },
  {
    id: 'hardcore',
    name: '🪐 严苛深空（硬核生存）',
    desc: '口粮与能源维护要求更严格，探索开销增加，需要精打细算。',
    overrides: {
      foodPerResidentPerDay: 0.45,
      buildingBuffer: { capacity: 3 },
      blockExploration: { costPerResident: 35, monthlyFeePerResident: 35, goodChanceBase: 0.4 },
      maintenance: {
        creditsByCategory: {
          basic: 6, food: 8, science: 12, culture: 9, military: 14, special: 18,
        },
      },
    },
  },
];

const LOCAL_STORAGE_KEY = 'stardust-custom-balance-mod';

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeDeep(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      mergeDeep(target[key], source[key]);
    } else if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }
  return target;
}

// 运行时活跃的动态数值对象
export let currentBalance = createDefaultBalance();

// 尝试从 localStorage 加载保存的调制值
export function initDynamicBalance() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          mergeDeep(currentBalance, parsed.overrides || parsed);
        }
      }
    }
  } catch (e) {
    console.warn('[Balance] 加载自定义调制数据失败，使用默认值:', e);
  }
}

/**
 * 实时更新指定数值路径
 * @param {string} path 点号分隔的路径，例如 'foodPerResidentPerDay' 或 'production.durationMultiplier'
 * @param {any} value
 */
export function setBalanceValue(path, value) {
  const parts = path.split('.');
  let curr = currentBalance;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!curr[p] || typeof curr[p] !== 'object') curr[p] = {};
    curr = curr[p];
  }
  curr[parts[parts.length - 1]] = value;
  saveBalanceToStorage();
  bus.emit('balance:changed', { path, value, current: currentBalance });
}

/**
 * 应用预设
 */
export function applyPreset(presetId) {
  const preset = BALANCE_PRESETS.find(p => p.id === presetId);
  if (!preset) return false;
  // 先重置回默认纯对象
  const fresh = createDefaultBalance();
  for (const k of Object.keys(currentBalance)) {
    delete currentBalance[k];
  }
  Object.assign(currentBalance, fresh);
  mergeDeep(currentBalance, preset.overrides);
  saveBalanceToStorage();
  bus.emit('balance:changed', { presetId, current: currentBalance });
  return true;
}

/**
 * 导出当前所有自定义平衡参数为 JSON
 */
export function exportBalanceMod(meta = {}) {
  return JSON.stringify({
    modName: meta.name || '星尘殖民地自定义平衡包',
    author: meta.author || '指挥官',
    version: '1.0.0',
    description: meta.desc || '由调制模式导出的自定义游戏数值平衡包。',
    exportedAt: new Date().toISOString(),
    overrides: currentBalance,
  }, null, 2);
}

/**
 * 导入并校验平衡包 JSON
 */
export function importBalanceMod(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    const overrides = data.overrides || data;
    if (!overrides || typeof overrides !== 'object') {
      return { ok: false, reason: '无效的平衡包格式' };
    }
    const fresh = createDefaultBalance();
    for (const k of Object.keys(currentBalance)) {
      delete currentBalance[k];
    }
    Object.assign(currentBalance, fresh);
    mergeDeep(currentBalance, overrides);
    saveBalanceToStorage();
    bus.emit('balance:changed', { imported: true, current: currentBalance });
    return { ok: true, meta: { modName: data.modName, author: data.author, description: data.description } };
  } catch (e) {
    return { ok: false, reason: `JSON 解析失败: ${e.message}` };
  }
}

/**
 * 重置为官方默认
 */
export function resetBalanceToDefault() {
  const fresh = createDefaultBalance();
  for (const k of Object.keys(currentBalance)) {
    delete currentBalance[k];
  }
  Object.assign(currentBalance, fresh);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
  bus.emit('balance:changed', { reset: true, current: currentBalance });
}

function saveBalanceToStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        updatedAt: Date.now(),
        overrides: currentBalance,
      }));
    }
  } catch (e) {
    console.warn('[Balance] 写入 localStorage 失败:', e);
  }
}

// 自动初始化
initDynamicBalance();
