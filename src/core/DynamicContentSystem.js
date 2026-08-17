import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { BUILDINGS } from '../data/buildings.js';
import { BUILDING_COMBOS } from '../data/combos.js';
import { SPECIES } from '../data/species.js';
import { TECHS, getTechById } from '../data/techs.js';
import { PRODUCTION_RECIPES } from '../data/production.js';
import { GENERAL_CARDS, ENVIRONMENT_CARDS } from '../data/cards.js';
import { aiClient } from '../ai/AIClient.js';
import { createAITriggerState, recordMilestone, updateShortages, canCreateProposal, markTriggered } from './AITriggerSystem.js';

const DIMS = ['food', 'knowledge', 'comfort', 'adventure', 'culture', 'nature'];
const SKILL_TYPES = ['combat', 'engineering', 'research', 'farming', 'survival', 'social'];
const FORBIDDEN = /死亡|毁灭|战争|血腥|不可逆摧毁|永久死亡|惩罚性清零/;
const CATEGORIES = new Set(['basic', 'food', 'science', 'culture', 'special']);
const ICONS = new Set(['sparkles', 'factory', 'sprout', 'flask-conical', 'landmark', 'gem', 'sun', 'snowflake', 'leaf', 'radio', 'orbit', 'waves', 'zap', 'shield', 'radar', 'mountain', 'swords', 'wrench', 'flame', 'cookie', 'cpu', 'battery-charging', 'gift']);
const MAX_TOTAL_RECIPES = 20;

function contentState() {
  if (!gameState.state.aiContent) gameState.state.aiContent = { enabled: true, pending: [], researchSlots: [], acceptedBuildings: [], acceptedCombos: [], acceptedSpecies: [], acceptedTechs: [], acceptedProducts: [], acceptedCards: [], acceptedEnvCards: [], lastGeneratedDay: {}, triggers: createAITriggerState() };
  if (!gameState.state.aiContent.researchSlots) gameState.state.aiContent.researchSlots = [];
  if (!gameState.state.aiContent.acceptedTechs) gameState.state.aiContent.acceptedTechs = [];
  if (!gameState.state.aiContent.acceptedProducts) gameState.state.aiContent.acceptedProducts = [];
  if (!gameState.state.aiContent.acceptedCards) gameState.state.aiContent.acceptedCards = [];
  if (!gameState.state.aiContent.acceptedEnvCards) gameState.state.aiContent.acceptedEnvCards = [];
  gameState.state.aiContent.triggers = createAITriggerState(gameState.state.aiContent.triggers);
  return gameState.state.aiContent;
}
function slug(prefix, name) {
  let hash = 0;
  for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `ai_${prefix}_${Math.abs(hash).toString(36)}`;
}
function text(value, max) { return typeof value === 'string' && value.trim() && value.length <= max && !FORBIDDEN.test(value); }
function proposal(type, content) { return { id: `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`, type, content, createdDay: gameState.state.day }; }

export function validateBuildingProposal(raw) {
  if (!raw || !text(raw.name, 18) || !text(raw.desc, 120) || !text(raw.flavor, 80) || !CATEGORIES.has(raw.category)) return { ok: false, reason: '建筑文本或分类无效' };
  if (BUILDINGS.some(item => item.name === raw.name)) return { ok: false, reason: '建筑名称重复' };
  const gravity = {};
  let gravityTotal = 0;
  for (const dim of DIMS) { const value = Number(raw.gravity?.[dim] || 0); if (!Number.isFinite(value) || value < 0 || value > 8) return { ok: false, reason: '引力超出范围' }; gravity[dim] = value; gravityTotal += value; }
  if (gravityTotal > 24) return { ok: false, reason: '引力预算超限' };
  const allowedCost = ['metal', 'crystal', 'energy', 'food', 'research', 'credits'];
  const cost = {};
  for (const [key, value] of Object.entries(raw.cost || {})) { if (!allowedCost.includes(key) || !Number.isFinite(value) || value < 1 || value > 150) return { ok: false, reason: '建造成本无效' }; cost[key] = Math.round(value); }
  if (!Object.keys(cost).length) return { ok: false, reason: '建筑必须有成本' };
  const effectByCategory = { food: { food: 5 }, science: { research: 3 }, culture: { happiness: 4, tourism: 3 }, basic: { energy: 3 }, special: { income: 4 } };
  const unlockTech = raw.unlockTech && getTechById(raw.unlockTech) ? raw.unlockTech : null;
  return { ok: true, value: { id: slug('building', raw.name), name: raw.name.trim(), category: raw.category, icon: ICONS.has(raw.icon) ? raw.icon : 'sparkles', desc: raw.desc.trim(), flavor: raw.flavor.trim(), cost, buildTime: 3, size: [2, 2], gravity, effect: effectByCategory[raw.category], unlockTech, generated: true } };
}

export function validateComboProposal(raw) {
  if (!raw || !text(raw.name, 20) || !text(raw.description, 120) || !Array.isArray(raw.buildingIds) || raw.buildingIds.length < 2 || raw.buildingIds.length > 5) return { ok: false, reason: '组合格式无效' };
  const ids = raw.buildingIds;
  if (ids.some(id => !BUILDINGS.some(building => building.id === id))) return { ok: false, reason: '组合引用未知建筑' };
  const sortedIds = [...ids].sort();
  if (BUILDING_COMBOS.some(item => item.name === raw.name || (item.buildingIds.length === sortedIds.length && [...item.buildingIds].sort().every((id, i) => id === sortedIds[i])))) return { ok: false, reason: '组合重复' };
  const maxDist = ids.length <= 2 ? 2 : ids.length <= 3 ? 3 : ids.length <= 4 ? 4 : 5;
  const effects = {
    output: [{ type: 'building_output', buildingIds: ids, multiplier: 1 + 0.06 * ids.length }],
    production: [{ type: 'production_speed', multiplier: 1 + 0.06 * ids.length }],
    tourism: [{ type: 'tourism_attraction', buildingIds: ids, multiplier: 1 + 0.08 * ids.length }],
  };
  const kind = effects[raw.effectKind] ? raw.effectKind : 'output';
  const pct = kind === 'tourism' ? Math.round(8 * ids.length) : Math.round(6 * ids.length);
  const labels = { output: `参与设施产出 +${pct}%`, production: `加工速度 +${pct}%`, tourism: `参与设施旅游吸引力 +${pct}%` };
  return { ok: true, value: { id: slug('combo', raw.name), name: raw.name.trim(), icon: 'sparkles', buildingIds: ids, maxDistance: maxDist, description: raw.description.trim(), effects: effects[kind], effectText: labels[kind], generated: true } };
}

export function validateSpeciesProposal(raw) {
  if (!raw || !text(raw.name, 20) || !text(raw.homeworld, 60) || !text(raw.lore, 240) || !text(raw.trait, 60) || !text(raw.personality, 60) || !text(raw.funfact, 120)) return { ok: false, reason: '种族文本无效' };
  if (SPECIES.some(item => item.name === raw.name)) return { ok: false, reason: '种族名称重复' };
  const gravityPreference = {}; let total = 0;
  for (const dim of DIMS) { const value = Number(raw.gravityPreference?.[dim]); if (!Number.isFinite(value) || value < 1 || value > 10) return { ok: false, reason: '偏好超出范围' }; gravityPreference[dim] = Math.round(value); total += value; }
  if (total < 18 || total > 38) return { ok: false, reason: '偏好预算无效' };
  const id = slug('species', raw.name);
  return { ok: true, value: { id, name: raw.name.trim(), homeworld: raw.homeworld.trim(), icon: ICONS.has(raw.icon) ? raw.icon : 'sparkles', color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : '#8FB8D8', lore: raw.lore.trim(), trait: raw.trait.trim(), personality: raw.personality.trim(), gravityPreference, tiers: [{ level: 20, name: '初次交流', reward: '获得友好纪念品' }, { level: 50, name: '文化互访', reward: '旅游收入小幅提升' }, { level: 80, name: '深度理解', reward: '获得独特装饰' }], funfact: raw.funfact.trim(), initialReputation: 10, generated: true } };
}

export function validateCardProposal(raw) {
  if (!raw || !text(raw.name, 16) || !text(raw.desc, 80) || !text(raw.flavor, 60)) return { ok: false, reason: '卡牌文本无效' };
  if (!SKILL_TYPES.includes(raw.type)) return { ok: false, reason: '卡牌主类型无效' };
  const value = Math.max(5, Math.min(10, Math.round(Number(raw.value) || 8)));

  // 规范多维 stats（正负属性）
  const stats = { [raw.type]: value };
  if (raw.stats && typeof raw.stats === 'object') {
    for (const [k, v] of Object.entries(raw.stats)) {
      if (SKILL_TYPES.includes(k)) {
        const n = Math.round(Number(v) || 0);
        if (n >= -5 && n <= 10) stats[k] = n;
      }
    }
  }
  // 若未指定副属性/负面代价，自动补充一个负面权衡
  if (Object.keys(stats).length <= 1) {
    const penaltyType = raw.type === 'combat' ? 'social' : raw.type === 'engineering' ? 'survival' : raw.type === 'research' ? 'combat' : raw.type === 'farming' ? 'engineering' : 'combat';
    stats[penaltyType] = -2;
  }

  const icon = ICONS.has(raw.icon) ? raw.icon : (raw.type === 'combat' ? 'swords' : raw.type === 'engineering' ? 'wrench' : raw.type === 'research' ? 'flask-conical' : raw.type === 'farming' ? 'sprout' : raw.type === 'survival' ? 'tent' : 'users');
  return {
    ok: true,
    value: {
      id: slug('card', raw.name),
      name: raw.name.trim(),
      type: raw.type,
      value,
      stats,
      icon,
      desc: raw.desc.trim(),
      flavor: raw.flavor.trim(),
      generated: true,
      sourceDrop: true,
    },
  };
}

export function validateEnvProposal(raw) {
  if (!raw || !text(raw.name, 16) || !text(raw.desc, 80) || !text(raw.flavor, 60)) return { ok: false, reason: '环境牌文本无效' };
  const modifiers = {};
  if (raw.modifiers && typeof raw.modifiers === 'object') {
    for (const [k, v] of Object.entries(raw.modifiers)) {
      if (SKILL_TYPES.includes(k)) {
        const n = Math.round(Number(v) || 0);
        if (n >= -4 && n <= 4 && n !== 0) modifiers[k] = n;
      }
    }
  }
  if (!Object.keys(modifiers).length) {
    modifiers.engineering = 2;
    modifiers.survival = -1;
  }
  const icon = ICONS.has(raw.icon) ? raw.icon : 'sparkles';
  return {
    ok: true,
    value: {
      id: slug('env', raw.name),
      name: raw.name.trim(),
      icon,
      modifiers,
      desc: raw.desc.trim(),
      flavor: raw.flavor.trim(),
      generated: true,
      isEnvironment: true,
    },
  };
}

export function validateProductProposal(raw) {
  if (!raw || !text(raw.name, 18) || !text(raw.desc, 120)) return { ok: false, reason: '加工品文本无效' };
  if (PRODUCTION_RECIPES.some(item => item.name === raw.name)) return { ok: false, reason: '加工品名称重复' };
  if (PRODUCTION_RECIPES.length >= MAX_TOTAL_RECIPES) return { ok: false, reason: `加工品种类已达上限（最多 ${MAX_TOTAL_RECIPES} 种）` };

  const tier = Number(raw.tier) || 2;
  if (tier < 1 || tier > 3) return { ok: false, reason: '加工品阶级无效' };
  const days = Math.max(2, Math.min(8, Math.round(Number(raw.days) || 3)));
  const icon = ICONS.has(raw.icon) ? raw.icon : 'package';
  const category = ['processed', 'goods', 'supplies'].includes(raw.category) ? raw.category : 'processed';

  // 必须绑定合法工坊（现有综合工坊或高级工坊）
  const requiredBuilding = raw.requiredBuilding && BUILDINGS.some(b => b.id === raw.requiredBuilding)
    ? raw.requiredBuilding
    : (tier === 3 ? 'miracle_foundry' : tier === 2 ? 'quantum_assembler' : 'workshop');

  // 校验原料消耗 inputs（必须包含已有基础资源或前置加工品）
  const inputs = {};
  if (raw.inputs && typeof raw.inputs === 'object') {
    for (const [k, v] of Object.entries(raw.inputs)) {
      const amount = Math.round(Number(v) || 0);
      if (amount > 0 && amount <= 30) {
        inputs[k] = amount;
      }
    }
  }
  if (!Object.keys(inputs).length) {
    inputs.alloy = 1;
    inputs.energy = 6;
  }

  const id = slug('prod', raw.name);
  return {
    ok: true,
    value: {
      id,
      name: raw.name.trim(),
      tier,
      category,
      icon,
      desc: raw.desc.trim(),
      inputs,
      output: { id, name: raw.name.trim(), quantity: 1 },
      days,
      requiredBuilding,
      generated: true,
    },
  };
}

export function validateTechProposal(raw) {
  if (!raw || !text(raw.name, 18) || !text(raw.desc, 120) || !text(raw.flavor, 80)) return { ok: false, reason: '科技文本无效' };
  if (TECHS.some(item => item.name === raw.name)) return { ok: false, reason: '科技名称重复' };
  const tier = Number(raw.tier);
  if (!Number.isFinite(tier) || tier < 1 || tier > 5) return { ok: false, reason: '科技阶级无效' };
  if (!raw.cost || !Number.isFinite(raw.cost.research) || raw.cost.research < 10 || raw.cost.research > 200) return { ok: false, reason: '研究成本无效' };
  const prereqs = Array.isArray(raw.prereqs) ? raw.prereqs.filter(id => getTechById(id)) : [];
  if (!Array.isArray(raw.unlocks) || !raw.unlocks.length || raw.unlocks.some(u => typeof u !== 'string' || !u.trim())) return { ok: false, reason: '解锁内容无效' };
  const gravity = {};
  let gravityTotal = 0;
  for (const dim of DIMS) { const value = Number(raw.gravity?.[dim] || 0); if (!Number.isFinite(value) || value < 0 || value > 8) return { ok: false, reason: '引力超出范围' }; gravity[dim] = value; gravityTotal += value; }
  if (gravityTotal > 24) return { ok: false, reason: '引力预算超限' };
  const icon = ICONS.has(raw.icon) ? raw.icon : 'sparkles';
  const aiTechs = TECHS.filter(t => t.generated);
  const col = aiTechs.length % 5;
  const row = Math.floor(aiTechs.length / 5);
  const position = { x: 100 + col * 160, y: 560 + row * 120 };
  return { ok: true, value: { id: slug('tech', raw.name), name: raw.name.trim(), tier: Math.round(tier), icon, desc: raw.desc.trim(), flavor: raw.flavor.trim(), cost: { research: Math.round(raw.cost.research) }, prereqs, unlocks: raw.unlocks.map(u => u.trim()), gravity, position, generated: true } };
}

function fallback(type) {
  const state = contentState();
  const candidates = BUILDINGS.filter(b => b.id !== 'road');
  let pairs = candidates.slice(-2).map(b => b.id);
  for (let i = 0; i < candidates.length && BUILDING_COMBOS.some(combo => combo.buildingIds.every(id => pairs.includes(id))); i++) {
    pairs = [candidates[i].id, candidates[(i + 3) % candidates.length].id];
  }
  const buildingIndex = state.acceptedBuildings.length + state.pending.filter(item => item.type === 'building_proposal').length + 1;
  const comboIndex = state.acceptedCombos.length + state.pending.filter(item => item.type === 'combo_proposal').length + 1;
  const speciesIndex = state.acceptedSpecies.length + state.pending.filter(item => item.type === 'species_proposal').length + 1;
  if (type === 'building_proposal') return { name: `星辉休憩站${buildingIndex}型`, category: 'culture', icon: 'sparkles', desc: '利用柔和光谱为居民和游客提供安静休憩空间。', flavor: '连星光都愿意在这里坐一会儿。', cost: { metal: 45, energy: 20 }, gravity: { food: 0, knowledge: 1, comfort: 5, adventure: 0, culture: 3, nature: 1 } };
  if (type === 'combo_proposal') return { name: `邻里协奏${comboIndex}`, description: '相邻设施共享客流与维护经验，形成温和的协同。', buildingIds: pairs, effectKind: 'output' };
  if (type === 'species_proposal') return { name: `云絮漫游者${speciesIndex}支`, homeworld: '高空云海星 · 轻羽环带', icon: 'waves', color: '#9CCFE0', lore: '生活在浮空云海中的轻盈智慧生命，以交换故事记录旅程。', trait: '浮空迁徙 · 故事记忆', personality: '温和好奇，喜欢慢慢观察', gravityPreference: { food: 3, knowledge: 7, comfort: 6, adventure: 5, culture: 7, nature: 4 }, funfact: '它们用云朵的形状记录日期。' };
  if (type === 'tech_proposal') {
    const techIndex = state.acceptedTechs.length + state.pending.filter(item => item.type === 'tech_proposal').length + 1;
    const researchedIds = gameState.state.researchedTechs || [];
    const prereq = researchedIds.length ? [researchedIds[researchedIds.length - 1]] : [];
    return { name: `星际协议${techIndex}型`, desc: '整合殖民地现有技术积累，开辟新的研究方向。', flavor: '每一次突破都始于一个大胆的假设。', tier: 2, cost: { research: 40 + techIndex * 10 }, prereqs: prereq, unlocks: ['新型设施蓝图'], gravity: { food: 0, knowledge: 4, comfort: 1, adventure: 2, culture: 1, nature: 0 } };
  }
  if (type === 'card_proposal') {
    const cardIndex = (state.acceptedCards?.length || 0) + state.pending.filter(item => item.type === 'card_proposal').length + 1;
    const pType = SKILL_TYPES[cardIndex % SKILL_TYPES.length];
    const penalty = pType === 'combat' ? 'social' : pType === 'engineering' ? 'survival' : 'combat';
    return {
      name: `远古秘宝${cardIndex}号`,
      type: pType,
      value: 8,
      stats: { [pType]: 8, [penalty]: -2, survival: 1 },
      icon: 'sparkles',
      desc: '记录了先驱者开拓经验的异星记忆晶体，效能强劲但伴随能量过载。',
      flavor: '知识跨越光年，在此刻重新发光。',
    };
  }
  if (type === 'env_proposal') {
    const envIndex = (state.acceptedEnvCards?.length || 0) + state.pending.filter(item => item.type === 'env_proposal').length + 1;
    return {
      name: `异星异象${envIndex}号`,
      icon: 'sparkles',
      modifiers: { research: 2, engineering: 2, survival: -1 },
      desc: '由星系潮汐引发的奇异能量波动，激发工程灵感但伴随环境压力。',
      flavor: '星空在此刻微微泛红。',
    };
  }
  if (type === 'product_proposal') {
    const prodIndex = (state.acceptedProducts?.length || 0) + state.pending.filter(item => item.type === 'product_proposal').length + 1;
    return {
      name: `超能晶元${prodIndex}型`,
      tier: 2,
      category: 'processed',
      icon: 'cpu',
      desc: '由 AI 辅助推演出的复合晶体核心，可大幅加速科研与高端工业。',
      inputs: { crystal_circuit: 1, alloy: 1, energy: 8 },
      days: 3,
      requiredBuilding: 'quantum_assembler',
    };
  }
  return { comment: '这些设施的引力彼此呼应，继续观察布局变化，也许会出现新的协同。' };
}

function context(instruction = '') {
  return {
    instruction: String(instruction).trim().slice(0, 300),
    day: gameState.state.day,
    year: gameState.state.year,
    buildings: BUILDINGS.map(({ id, name, category, gravity }) => ({ id, name, category, gravity })),
    exploredRegions: gameState.state.exploredRegions,
    species: SPECIES.map(({ id, name, gravityPreference }) => ({ id, name, gravityPreference })),
    techs: TECHS.map(({ id, name, tier }) => ({ id, name, tier })),
    recipes: PRODUCTION_RECIPES.map(({ id, name, tier, inputs, requiredBuilding }) => ({ id, name, tier, inputs, requiredBuilding })),
    researchedTechs: gameState.state.researchedTechs,
  };
}

const generating = new Set();

export async function generateProposal(type, instruction = '') {
  if (!contentState().enabled) return { ok: false, reason: 'AI 内容生成已关闭' };
  if (generating.has(type)) return { ok: false, reason: '同类提案正在生成' };
  generating.add(type);
  let raw;
  try {
    raw = await aiClient.generate(type, context(instruction), () => fallback(type), { cache: false });
  } finally {
    generating.delete(type);
  }
  if (type === 'combo_comment') return { ok: true, value: raw.comment || fallback(type).comment };
  const validator = type === 'building_proposal' ? validateBuildingProposal
    : type === 'combo_proposal' ? validateComboProposal
    : type === 'tech_proposal' ? validateTechProposal
    : type === 'product_proposal' ? validateProductProposal
    : type === 'card_proposal' ? validateCardProposal
    : type === 'env_proposal' ? validateEnvProposal
    : validateSpeciesProposal;
  const result = validator(raw);
  if (!result.ok) return result;
  const item = proposal(type, result.value);
  contentState().pending.push(item);
  contentState().lastGeneratedDay[type] = gameState.state.day;
  bus.emit('ai-content:proposed', item);
  return { ok: true, proposal: item };
}

export function acceptProposal(id) {
  const state = contentState();
  const item = state.pending.find(entry => entry.id === id);
  if (!item) return { ok: false, reason: '提案不存在' };
  if (item.type === 'building_proposal') { BUILDINGS.push(item.content); state.acceptedBuildings.push(item.content); }
  else if (item.type === 'combo_proposal') { BUILDING_COMBOS.push(item.content); state.acceptedCombos.push(item.content); }
  else if (item.type === 'tech_proposal') { TECHS.push(item.content); state.acceptedTechs.push(item.content); }
  else if (item.type === 'product_proposal') {
    if (!state.acceptedProducts) state.acceptedProducts = [];
    state.acceptedProducts.push(item.content);
    if (!PRODUCTION_RECIPES.some(r => r.id === item.content.id)) {
      PRODUCTION_RECIPES.push(item.content);
    }
  }
  else if (item.type === 'card_proposal') {
    if (!state.acceptedCards) state.acceptedCards = [];
    state.acceptedCards.push(item.content);
    if (!gameState.state.cards) gameState.state.cards = { unlocked: [], dynamicCards: [], dynamicEnvCards: [] };
    if (!gameState.state.cards.dynamicCards) gameState.state.cards.dynamicCards = [];
    if (!gameState.state.cards.dynamicCards.some((c) => c.id === item.content.id)) {
      gameState.state.cards.dynamicCards.push(item.content);
    }
    if (!gameState.state.cards.unlocked.includes(item.content.id)) {
      gameState.state.cards.unlocked.push(item.content.id);
    }
  }
  else if (item.type === 'env_proposal') {
    if (!state.acceptedEnvCards) state.acceptedEnvCards = [];
    state.acceptedEnvCards.push(item.content);
    if (!gameState.state.cards) gameState.state.cards = { unlocked: [], dynamicCards: [], dynamicEnvCards: [] };
    if (!gameState.state.cards.dynamicEnvCards) gameState.state.cards.dynamicEnvCards = [];
    if (!gameState.state.cards.dynamicEnvCards.some((c) => c.id === item.content.id)) {
      gameState.state.cards.dynamicEnvCards.push(item.content);
    }
    ENVIRONMENT_CARDS.push(item.content);
  }
  else if (item.type === 'species_proposal') { SPECIES.push(item.content); state.acceptedSpecies.push(item.content); gameState.state.diplomacy[item.content.id] = { reputation: item.content.initialReputation, contacted: true }; }
  state.pending = state.pending.filter(entry => entry.id !== id);
  bus.emit('ai-content:accepted', item);
  return { ok: true, item };
}

export function rejectProposal(id) { contentState().pending = contentState().pending.filter(entry => entry.id !== id); }

export function restoreDynamicContent() {
  const state = contentState();
  state.acceptedBuildings = state.acceptedBuildings.filter(item => validateBuildingProposal(item).ok || BUILDINGS.some(entry => entry.id === item.id));
  for (const item of state.acceptedBuildings) if (!BUILDINGS.some(entry => entry.id === item.id)) BUILDINGS.push(item);
  state.acceptedCombos = state.acceptedCombos.filter(item => validateComboProposal(item).ok || BUILDING_COMBOS.some(entry => entry.id === item.id));
  for (const item of state.acceptedCombos) if (!BUILDING_COMBOS.some(entry => entry.id === item.id)) BUILDING_COMBOS.push(item);
  state.acceptedTechs = (state.acceptedTechs || []).filter(item => validateTechProposal(item).ok || TECHS.some(entry => entry.id === item.id));
  for (const item of state.acceptedTechs) if (!TECHS.some(entry => entry.id === item.id)) TECHS.push(item);
  state.acceptedProducts = (state.acceptedProducts || []).filter(item => validateProductProposal(item).ok || PRODUCTION_RECIPES.some(entry => entry.id === item.id));
  for (const item of (state.acceptedProducts || [])) if (!PRODUCTION_RECIPES.some(entry => entry.id === item.id)) PRODUCTION_RECIPES.push(item);
  state.acceptedSpecies = state.acceptedSpecies.filter(item => validateSpeciesProposal(item).ok || SPECIES.some(entry => entry.id === item.id));
  for (const item of state.acceptedSpecies) { if (!SPECIES.some(entry => entry.id === item.id)) SPECIES.push(item); if (!gameState.state.diplomacy[item.id]) gameState.state.diplomacy[item.id] = { reputation: item.initialReputation || 10, contacted: true }; }
  for (const item of (state.acceptedEnvCards || [])) {
    if (!ENVIRONMENT_CARDS.some(e => e.id === item.id)) ENVIRONMENT_CARDS.push(item);
  }
}

export async function generateComboComment(buildingIds) {
  const result = await aiClient.generate('combo_comment', { buildingIds, buildings: BUILDINGS.filter(item => buildingIds.includes(item.id)) }, () => fallback('combo_comment'));
  return result.comment || fallback('combo_comment').comment;
}

function requestTriggeredProposal(type, instruction) {
  const state = contentState();
  const day = gameState.state.day;
  if (!state.enabled || !canCreateProposal(state.triggers, type, day, state.pending.length)) return;
  markTriggered(state.triggers, type, day);
  generateProposal(type, instruction);
}

export function handleAIContentMilestone(kind, id, instruction = '') {
  const state = contentState();
  if (!state.enabled || !recordMilestone(state.triggers, `${kind}:${id}`)) return false;
  const type = kind === 'diplomacy' ? 'species_proposal' : kind === 'combo' ? 'combo_proposal' : kind === 'tech' ? 'tech_proposal' : 'building_proposal';
  requestTriggeredProposal(type, instruction || `围绕${kind} ${id}生成适合当前殖民地的和平内容`);
  return true;
}

export function startAIResearchProject(type, instruction = '') {
  const state = contentState();
  if (!state.enabled) return { ok: false, reason: 'AI 内容生成已关闭' };

  const COST_RESEARCH = 30;
  const COST_CREDITS = 50;
  const TOTAL_DAYS = 2; // 2天研发周期

  if ((gameState.state.resources.research || 0) < COST_RESEARCH) {
    return { ok: false, reason: `研究点数不足（需要 ${COST_RESEARCH} 点）` };
  }
  if ((gameState.state.resources.credits || 0) < COST_CREDITS) {
    return { ok: false, reason: `星币不足（需要 ${COST_CREDITS} 星币）` };
  }

  // 扣除研发投入
  gameState.addResource('research', -COST_RESEARCH);
  gameState.addResource('credits', -COST_CREDITS);

  const slot = {
    id: `ai_proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type,
    instruction,
    remainingDays: TOTAL_DAYS,
    totalDays: TOTAL_DAYS,
    startDay: gameState.state.day,
  };

  state.researchSlots.push(slot);
  bus.emit('ai-research:started', slot);
  return { ok: true, slot };
}

export function updateDynamicContent() {
  const state = contentState();
  if (!state.enabled) return;

  // 推进手动立项研发周期
  if (state.researchSlots && state.researchSlots.length > 0) {
    const remainingSlots = [];
    for (const slot of state.researchSlots) {
      slot.remainingDays -= 1;
      if (slot.remainingDays <= 0) {
        generateProposal(slot.type, slot.instruction).then((res) => {
          const typeNames = {
            building_proposal: '新建筑',
            combo_proposal: '新组合',
            species_proposal: '新外星种族',
            tech_proposal: '新科技',
            card_proposal: '多维技能卡',
            env_proposal: '未知环境牌',
          };
          const name = typeNames[slot.type] || 'AI提案';
          if (res.ok) {
            gameState.addNotification({
              title: 'AI 研发立项完成！',
              text: `【${name}】方案已研发完成，请前往【AI工坊】进行论证确认！`,
              type: 'success',
              icon: 'sparkles',
              duration: 6000,
            });
          } else {
            gameState.addNotification({
              title: 'AI 研发完成',
              text: `【${name}】方案已就绪。`,
              type: 'info',
              icon: 'sparkles',
            });
          }
        });
      } else {
        remainingSlots.push(slot);
      }
    }
    state.researchSlots = remainingSlots;
  }

  for (const resource of updateShortages(state.triggers, gameState.state.resources, gameState.state.day)) {
    bus.emit('ai:shortage', { resource });
    requestTriggeredProposal('building_proposal', `殖民地${resource}已持续短缺，请提出温和的支持设施`);
  }
}

export async function runMonthlyComboCheck() {
  const state = contentState();
  if (!state.enabled) return { ok: false, reason: 'AI 内容生成已关闭' };

  const builtIds = [...new Set((gameState.state.buildings || [])
    .filter((b) => b.built && b.buildingId !== 'road' && b.buildingId !== 'landing_pad')
    .map((b) => b.buildingId))];
  if (builtIds.length < 2) return { ok: false, reason: '已建成设施不足' };

  const builtBuildings = BUILDINGS.filter((b) => builtIds.includes(b.id));
  const ctx = {
    instruction: '根据当前已建成设施提出一个布局组合，buildingIds 只能从给出的已建成设施中选择',
    day: gameState.state.day,
    buildings: builtBuildings.map(({ id, name, category }) => ({ id, name, category })),
    builtIds,
  };
  const fallback = () => ({
    name: `月度协同${builtIds.length}型`,
    description: '本月布局自然形成的协同，参与设施共享维护经验。',
    buildingIds: builtIds.slice(0, 4),
    effectKind: 'output',
  });

  const raw = await aiClient.generate('combo_proposal', ctx, fallback, { cache: false });
  const result = validateComboProposal(raw);
  if (!result.ok) return result;

  const combo = result.value;
  if (!combo.buildingIds.every((id) => builtIds.includes(id))) {
    return { ok: false, reason: '组合引用了未建成设施' };
  }

  BUILDING_COMBOS.push(combo);
  state.acceptedCombos.push(combo);
  state.lastGeneratedDay['combo_proposal'] = gameState.state.day;
  bus.emit('ai-content:accepted', { type: 'combo_proposal', content: combo });
  return { ok: true, combo };
}
