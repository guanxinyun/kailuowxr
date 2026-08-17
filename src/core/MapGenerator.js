/**
 * 星尘殖民地 — 地图生成器
 * Generates a 2D tile map using simplex noise
 */
import { initNoise, noise2D } from './utils.js';
import { TILE_TYPES } from '../data/gamedata.js';

export function generateMap(size = 32, seed = 42) {
  initNoise(seed);
  const map = [];

  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const elevation = noise2D(x * 0.08, y * 0.08);
      const moisture  = noise2D(x * 0.06 + 100, y * 0.06 + 100);
      const mineral   = noise2D(x * 0.12 + 200, y * 0.12 + 200);
      const edge = Math.max(Math.abs(x - size / 2), Math.abs(y - size / 2)) / (size / 2);

      let type = 'plains';

      if (elevation > 0.55) type = 'mountain';
      else if (elevation < -0.45) type = 'water';
      else if (moisture > 0.4 && elevation > -0.1) type = 'forest';
      else if (mineral > 0.5 && elevation > 0) type = 'metal';
      else if (mineral > 0.45 && elevation < 0) type = 'crystal';

      // Edge biomes: cold north/west, dry south/east
      if (edge > 0.68 && y < size * 0.38 && elevation < 0.6) type = 'snow';
      else if (edge > 0.68 && y > size * 0.62 && elevation > -0.5) type = 'desert';

      // Rare ruins
      if (type === 'plains' && Math.abs(noise2D(x * 0.3 + 300, y * 0.3 + 300)) > 0.7) {
        type = 'ruins';
      }

      // Craters near mountains
      if (type === 'mountain' && noise2D(x * 0.2 + 400, y * 0.2 + 400) > 0.6) {
        type = 'crater';
      }

      row.push({
        type,
        x, y,
        building: null,
        // 初始已探明区域为 4×8 矩形（8 宽 × 4 高，覆盖初始建筑与降落点）
        explored: x >= size / 2 - 4 && x < size / 2 + 4 && y >= size / 2 - 2 && y < size / 2 + 2,
        gravityField: { food: 0, knowledge: 0, comfort: 0, adventure: 0, culture: 0, nature: 0 },
      });
    }
    map.push(row);
  }

  // Clear starting area
  const center = Math.floor(size / 2);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const ty = center + dy;
      const tx = center + dx;
      if (ty >= 0 && ty < size && tx >= 0 && tx < size) {
        map[ty][tx].type = 'plains';
        map[ty][tx].explored = true;
      }
    }
  }

  return map;
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Convert grid coords to isometric screen coords
 */
export function gridToIso(gx, gy, tileW = 64, tileH = 32) {
  return {
    x: (gx - gy) * (tileW / 2),
    y: (gx + gy) * (tileH / 2),
  };
}

/**
 * Convert screen coords back to grid coords
 */
export function isoToGrid(sx, sy, tileW = 64, tileH = 32) {
  const gx = (sx / (tileW / 2) + sy / (tileH / 2)) / 2;
  const gy = (sy / (tileH / 2) - sx / (tileW / 2)) / 2;
  return { x: Math.floor(gx), y: Math.floor(gy) };
}
