import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { BUILDINGS } from '../data/buildings.js';
import { BUILDING_COMBOS } from '../data/combos.js';
import { SPECIES } from '../data/species.js';
import { aiClient } from '../ai/AIClient.js';
import { createAITriggerState, recordMilestone, updateShortages, canCreateProposal, markTriggered } from './AITriggerSystem.js';

const DIMS = ['food', 'knowledge', 'comfort', 'adventure', 'culture', 'nature'];
const FORBIDDEN = /战斗|敌人|伤害|死亡|武器|战争|摧毁|惩罚/;
const CATEGORIES = new Set(['basic', 'food', 'science', 'culture', 'special']);
const ICONS = new Set(['sparkles', 'factory', 'sprout', 'flask-conical', 'landmark', 'gem', 'sun', 'snowflake', 'leaf', 'radio', 'orbit', 'waves']);

function contentState() {
  if (!gameState.state.aiContent) gameState.state.aiContent = { enabled: true, pending: [], acceptedBuildings: [], acceptedCombos: [], acceptedSpecies: [], lastGeneratedDay: {}, triggers: createAITriggerState() };
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
  return { ok: true, value: { id: slug('building', raw.name), name: raw.name.trim(), category: raw.category, icon: ICONS.has(raw.icon) ? raw.icon : 'sparkles', desc: raw.desc.trim(), flavor: raw.flavor.trim(), cost, buildTime: 3, size: [2, 2], gravity, effect: effectByCategory[raw.category], unlockTech: null, generated: true } };
}

export function validateComboProposal(raw) {
  if (!raw || !text(raw.name, 20) || !text(raw.description, 120) || !Array.isArray(raw.buildingIds) || raw.buildingIds.length !== 2) return { ok: false, reason: '组合格式无效' };
  const ids = [...new Set(raw.buildingIds)];
  if (ids.length !== 2 || ids.some(id => !BUILDINGS.some(building => building.id === id))) return { ok: false, reason: '组合引用未知建筑' };
  if (BUILDING_COMBOS.some(item => item.name === raw.name || item.buildingIds.every(id => ids.includes(id)))) return { ok: false, reason: '组合重复' };
  const effects = {
    output: [{ type: 'building_output', buildingIds: ids, multiplier: 1.12 }],
    production: [{ type: 'production_speed', multiplier: 1.12 }],
    tourism: [{ type: 'tourism_attraction', buildingIds: ids, multiplier: 1.15 }],
  };
  const kind = effects[raw.effectKind] ? raw.effectKind : 'output';
  const labels = { output: '参与设施产出 +12%', production: '加工速度 +12%', tourism: '参与设施旅游吸引力 +15%' };
  return { ok: true, value: { id: slug('combo', raw.name), name: raw.name.trim(), icon: 'sparkles', buildingIds: ids, maxDistance: 2, description: raw.description.trim(), effects: effects[kind], effectText: labels[kind], generated: true } };
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
  return { comment: '这些设施的引力彼此呼应，继续观察布局变化，也许会出现新的协同。' };
}

function context(instruction = '') {
  return { instruction: String(instruction).trim().slice(0, 300), day: gameState.state.day, year: gameState.state.year, buildings: BUILDINGS.map(({ id, name, category, gravity }) => ({ id, name, category, gravity })), exploredRegions: gameState.state.exploredRegions, species: SPECIES.map(({ id, name, gravityPreference }) => ({ id, name, gravityPreference })) };
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
  const validator = type === 'building_proposal' ? validateBuildingProposal : type === 'combo_proposal' ? validateComboProposal : validateSpeciesProposal;
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
  state.acceptedSpecies = state.acceptedSpecies.filter(item => validateSpeciesProposal(item).ok || SPECIES.some(entry => entry.id === item.id));
  for (const item of state.acceptedSpecies) { if (!SPECIES.some(entry => entry.id === item.id)) SPECIES.push(item); if (!gameState.state.diplomacy[item.id]) gameState.state.diplomacy[item.id] = { reputation: item.initialReputation || 10, contacted: true }; }
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
  const type = kind === 'diplomacy' ? 'species_proposal' : kind === 'combo' ? 'combo_proposal' : 'building_proposal';
  requestTriggeredProposal(type, instruction || `围绕${kind} ${id}生成适合当前殖民地的和平内容`);
  return true;
}

export function updateDynamicContent() {
  const state = contentState();
  if (!state.enabled) return;
  for (const resource of updateShortages(state.triggers, gameState.state.resources, gameState.state.day)) {
    bus.emit('ai:shortage', { resource });
    requestTriggeredProposal('building_proposal', `殖民地${resource}已持续短缺，请提出温和的支持设施`);
  }
  const day = gameState.state.day;
  const due = (type, interval) => day - (state.lastGeneratedDay[type] || 0) >= interval;
  if (day >= 60 && due('building_proposal', 120)) requestTriggeredProposal('building_proposal', '提供一个符合当前发展阶段的设施');
  else if (gameState.state.buildings.length >= 6 && due('combo_proposal', 90)) requestTriggeredProposal('combo_proposal', '根据现有设施提出布局组合');
  else if ((gameState.state.exploredRegions.includes('signal_source') || gameState.state.year >= 2) && due('species_proposal', 240)) requestTriggeredProposal('species_proposal', '提出一个和平友好的访客种族');
}
