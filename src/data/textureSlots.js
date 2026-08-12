import { TILE_TYPES } from './gamedata.js';
import { BUILDINGS } from './buildings.js';

const tileSlots = Object.keys(TILE_TYPES).map((tileType) => ({
  id: `terrain.${tileType}`,
  label: `地形：${TILE_TYPES[tileType].name}`,
  category: 'terrain',
  kind: 'tile',
  hint: '建议 64×48，顶部中心对齐；透明 PNG 可叠加在等距地块上。',
}));

const buildingSlots = [
  { id: 'building.road', label: '道路', category: 'building', kind: 'building', hint: '建议 64×32，中心对齐。' },
  ...BUILDINGS.map((building) => ({
    id: `building.${building.id}`,
    label: `建筑：${building.name}`,
    category: 'building',
    kind: 'building',
    hint: '建议透明 PNG，底部中心对齐，最大 128×128。',
  })),
];

export const TEXTURE_SLOTS = [
  ...tileSlots,
  ...buildingSlots,
  { id: 'resident.default', label: '居民：默认', category: 'resident', kind: 'sprite', hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
  { id: 'tourist.squid', label: '游客：虹吸水母族', category: 'tourist', kind: 'sprite', hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
  { id: 'tourist.crystal', label: '游客：晶体共鸣者', category: 'tourist', kind: 'sprite', hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
  { id: 'tourist.mecha', label: '游客：铁骑军团', category: 'tourist', kind: 'sprite', hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
  { id: 'tourist.flora', label: '游客：星芽网络', category: 'tourist', kind: 'sprite', hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
];

export const TEXTURE_SLOT_MAP = Object.fromEntries(TEXTURE_SLOTS.map((slot) => [slot.id, slot]));

export function getTextureSlot(id) {
  return TEXTURE_SLOT_MAP[id] || null;
}

export function getTextureSlotsByCategory(category) {
  return TEXTURE_SLOTS.filter((slot) => slot.category === category);
}
