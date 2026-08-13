import { TILE_TYPES } from './gamedata.js';
import { BUILDINGS } from './buildings.js';

const tileSlots = Object.keys(TILE_TYPES).map((tileType) => ({
  id: `terrain.${tileType}`,
  label: `地形：${TILE_TYPES[tileType].name}`,
  category: 'terrain',
  kind: 'tile',
  targetWidth: 64,
  targetHeight: 48,
  hint: '建议 64×48，顶部中心对齐；透明 PNG 可叠加在等距地块上。',
}));

const buildingSlots = [
  { id: 'building.road', label: '道路', category: 'building', kind: 'tile', targetWidth: 64, targetHeight: 32, hint: '上传正方形图片，等距投影为菱形道路。' },
  ...BUILDINGS.map((building) => ({
    id: `building.${building.id}`,
    label: `建筑：${building.name}`,
    category: 'building',
    kind: 'building',
    targetWidth: 64,
    targetHeight: 48,
    hint: '建议透明 PNG，底部中心对齐，64×48。',
  })),
];

export const TEXTURE_SLOTS = [
  ...tileSlots,
  ...buildingSlots,
  { id: 'resident.default', label: '居民：默认', category: 'resident', kind: 'sprite', targetWidth: 96, targetHeight: 128, hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
  { id: 'tourist.squid', label: '游客：虹吸水母族', category: 'tourist', kind: 'sprite', targetWidth: 96, targetHeight: 128, hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
  { id: 'tourist.crystal', label: '游客：晶体共鸣者', category: 'tourist', kind: 'sprite', targetWidth: 96, targetHeight: 128, hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
  { id: 'tourist.mecha', label: '游客：铁骑军团', category: 'tourist', kind: 'sprite', targetWidth: 96, targetHeight: 128, hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
  { id: 'tourist.flora', label: '游客：星芽网络', category: 'tourist', kind: 'sprite', targetWidth: 96, targetHeight: 128, hint: '精灵表需为 3 列×4 行：动作帧×方向。' },
];

export const TEXTURE_SLOT_MAP = Object.fromEntries(TEXTURE_SLOTS.map((slot) => [slot.id, slot]));

export function getTextureSlot(id) {
  return TEXTURE_SLOT_MAP[id] || null;
}

export function getTextureSlotsByCategory(category) {
  return TEXTURE_SLOTS.filter((slot) => slot.category === category);
}
