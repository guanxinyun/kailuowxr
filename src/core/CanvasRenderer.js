/**
 * 星尘殖民地 — Canvas 渲染器
 * 仿照开罗《宇宙探险物语》风格
 * Dual-layer canvas: terrain (static) + dynamic (entities, selection)
 * + optional heatmap overlay layer
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { gridToIso, isoToGrid } from './MapGenerator.js';
import { TILE_TYPES, GRAVITY_CONFIG } from '../data/gamedata.js';
import { getBuildingById } from '../data/buildings.js';
import { clamp, lucideIcon } from './utils.js';
import { getBuildingOperationalState, requiresRoadConnection } from './BuildingSystem.js';
import { getProductionState } from './ProductionSystem.js';
import { getBuildingBufferStatus } from './WorkerScheduleSystem.js';
import { ResidentSpriteManager } from './ResidentSprites.js';
import { textureManager } from './TextureManager.js';
import { getBuildingDrawPosition } from './TexturePresentation.js';
import { getExplorableBlocks, getBlockTiles, getActiveBlockExploration, getBlockOf } from './BlockExplorationSystem.js';

const TILE_W = 64;
const TILE_H = 32;

// 开罗风格的明亮像素色板
const TILE_COLORS = {
  plains:   { top: '#4A7A3A', sides: '#3D6B30', highlight: '#5C8E4C' },
  mountain: { top: '#8B8B9E', sides: '#6E6E82', highlight: '#A0A0B0', peak: '#C8C8D8' },
  water:    { top: '#3A7ABF', sides: '#2D6AA0', highlight: '#5A9AD8', wave: '#6AB0E8' },
  crystal:  { top: '#7A5AAF', sides: '#6348A0', highlight: '#9A7ACF', gem: '#C8A0F0' },
  metal:    { top: '#7A7A88', sides: '#5E5E6E', highlight: '#9090A0', ore: '#B0A070' },
  ruins:    { top: '#5A5A70', sides: '#484860', highlight: '#707088', stone: '#8888A0' },
  crater:   { top: '#3A3A48', sides: '#2E2E3A', highlight: '#505060' },
  forest:   { top: '#2E7A3E', sides: '#246830', highlight: '#3E8E50', tree: '#1E6030' },
  snow:     { top: '#D8ECF2', sides: '#A8C8D8', highlight: '#F2FCFF' },
  desert:   { top: '#C88A45', sides: '#9A642F', highlight: '#E8B66A' },
};

// 装饰物种子随机
function seededRandom(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

export class CanvasRenderer {
  constructor(container, textures = textureManager) {
    this.container = container;
    this.textures = textures;
    this.terrainCanvas = container.querySelector('#canvas-terrain');
    this.dynamicCanvas = container.querySelector('#canvas-dynamic');
    this.heatmapCanvas = container.querySelector('#canvas-heatmap');

    this.terrainCtx = this.terrainCanvas.getContext('2d');
    this.dynamicCtx = this.dynamicCanvas.getContext('2d');
    this.heatmapCtx = this.heatmapCanvas.getContext('2d');

    // Camera
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.lastMouse = { x: 0, y: 0 };
    this.hoveredTile = null;

    this._terrainDirty = true;
    this._dynamicDirty = true;
    this._heatmapDirty = true;
    this._animFrame = null;

    // 居民精灵管理器
    this.spriteManager = new ResidentSpriteManager(this.textures);

    // 动画时间
    this._time = 0;
    this._lastProcessingPhase = 0;

    this._setupEvents();
    this._resize();

    bus.on('building:placed', () => { this._terrainDirty = true; this._dynamicDirty = true; });
    bus.on('map:expanded', () => { this._terrainDirty = true; });
    bus.on('map:revealed', () => { this._terrainDirty = true; });
    // 区块探索开始/完成：重绘待探索区块的发暗标记
    bus.on('explore:block-started', () => { this._terrainDirty = true; });
    bus.on('explore:block-completed', () => { this._terrainDirty = true; });
    bus.on('state:gravityOverlay', () => { this._heatmapDirty = true; });
    bus.on('textures:changed', ({ slotId } = {}) => {
      if (!slotId || slotId.startsWith('terrain.') || slotId.startsWith('building.') || !slotId) this._terrainDirty = true;
      if (!slotId || slotId.startsWith('resident.') || slotId.startsWith('tourist.')) this._dynamicDirty = true;
    });

    // 外星游客到达时添加精灵
    bus.on('tourist:arrived', ({ tourists, species }) => {
      for (const t of tourists) {
        this.spriteManager.addTourist(t, species);
      }
      this._dynamicDirty = true;
    });

    // 外星游客离开时移除精灵
    bus.on('tourist:destination', ({ tourist, building }) => {
      const sprite = this.spriteManager.touristSprites.find(s => s.resident.id === tourist.id);
      const map = gameState.state.map;
      if (sprite && map) {
        sprite.navigateTo(map, Math.floor(sprite.gridX), Math.floor(sprite.gridY), building.x, building.y);
      }
    });

    bus.on('tourist:leaving', ({ tourists }) => {
      for (const t of tourists) {
        // 找到对应的精灵并移除
        const sprite = this.spriteManager.touristSprites.find(s => s.resident.id === t.id);
        if (sprite) {
          this.spriteManager.removeTourist(sprite);
        }
      }
      this._dynamicDirty = true;
    });

    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    for (const canvas of [this.terrainCanvas, this.dynamicCanvas, this.heatmapCanvas]) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.scale(dpr, dpr);
    }
    this.width = rect.width;
    this.height = rect.height;
    this._terrainDirty = true;
    this._dynamicDirty = true;
    this._heatmapDirty = true;
  }

  _setupEvents() {
    const canvas = this.dynamicCanvas;

    // ---- 双指缩放状态 ----
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    const activePointers = new Map();

    canvas.addEventListener('pointerdown', (e) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        // 进入双指模式
        const pts = [...activePointers.values()];
        pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        pinchStartZoom = this.camera.zoom;
        this.isDragging = false;
        return;
      }
      if (e.button !== 0) return;          // 只响应左键
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size >= 2) {
        // 双指缩放
        const pts = [...activePointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (pinchStartDist > 0) {
          const oldZoom = this.camera.zoom;
          this.camera.zoom = clamp(pinchStartZoom * (dist / pinchStartDist), 0.3, 3);
          const rect = canvas.getBoundingClientRect();
          const mx = (pts[0].x + pts[1].x) / 2 - rect.left;
          const my = (pts[0].y + pts[1].y) / 2 - rect.top;
          const scale = this.camera.zoom / oldZoom;
          this.camera.x = mx - (mx - this.camera.x) * scale;
          this.camera.y = my - (my - this.camera.y) * scale;
          this._terrainDirty = true;
          this._dynamicDirty = true;
          this._heatmapDirty = true;
        }
        return;
      }
      this.lastMouse = { x: e.clientX, y: e.clientY };
      if (this.isDragging) {
        this.camera.x = e.clientX - this.dragStart.x;
        this.camera.y = e.clientY - this.dragStart.y;
        this._terrainDirty = true;
        this._dynamicDirty = true;
        this._heatmapDirty = true;
      } else {
        this._updateHover(e);
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      const wasPinching = activePointers.size >= 2;
      activePointers.delete(e.pointerId);
      if (wasPinching) {
        pinchStartDist = 0;
        this.isDragging = false;
        return;
      }
      if (e.button !== 0) return;           // 只响应左键
      if (this.isDragging) {
        const dx = Math.abs(e.clientX - (this.dragStart.x + this.camera.x));
        const dy = Math.abs(e.clientY - (this.dragStart.y + this.camera.y));
        if (dx < 4 && dy < 4) {
          this._handleClick(e);
        }
      }
      this.isDragging = false;
    });

    canvas.addEventListener('pointercancel', (e) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) pinchStartDist = 0;
      this.isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const oldZoom = this.camera.zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoom = clamp(this.camera.zoom * delta, 0.3, 3);

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scale = this.camera.zoom / oldZoom;
      this.camera.x = mx - (mx - this.camera.x) * scale;
      this.camera.y = my - (my - this.camera.y) * scale;

      this._terrainDirty = true;
      this._dynamicDirty = true;
      this._heatmapDirty = true;
    }, { passive: false });

    // 右键退出放置模式
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (gameState.state.placingBuilding) {
        gameState.set('placingBuilding', null);
      }
    });
  }

  _updateHover(e) {
    const rect = this.dynamicCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
    const sy = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;
    const grid = isoToGrid(sx, sy, TILE_W, TILE_H);
    const map = gameState.state.map;
    if (map && grid.x >= 0 && grid.y >= 0 && grid.x < map[0].length && grid.y < map.length) {
      const newTile = map[grid.y][grid.x];
      if (this.hoveredTile !== newTile) {
        this.hoveredTile = newTile;
        this._dynamicDirty = true;
        bus.emit('tile:hover', newTile);
      }
    } else if (this.hoveredTile) {
      this.hoveredTile = null;
      this._dynamicDirty = true;
    }
  }

  _handleClick(e) {
    // 从点击坐标直接计算格子（手机端 pointermove 可能未触发，hoveredTile 为空）
    const rect = this.dynamicCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
    const sy = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;
    const grid = isoToGrid(sx, sy, TILE_W, TILE_H);
    const map = gameState.state.map;
    if (!map || grid.x < 0 || grid.y < 0 || grid.x >= map[0].length || grid.y >= map.length) return;
    const tile = map[grid.y][grid.x];

    // 同步 hoveredTile 以保持一致
    this.hoveredTile = tile;
    this._dynamicDirty = true;

    const placing = gameState.state.placingBuilding;

    if (placing) {
      const tileInfo = TILE_TYPES[tile.type];
      const techUnlocked = tileInfo.techUnlock ? gameState.state.researchedTechs.includes(tileInfo.techUnlock) : false;
      if ((tileInfo.buildable || techUnlocked) && !tile.building) {
        bus.emit('building:place', { building: placing, tile });
      }
    } else {
      // 点击未探索但可派遣的区块 → 打开派遣弹窗
      if (!tile.explored) {
        const { bx, by } = getBlockOf(tile.x, tile.y);
        if (getExplorableBlocks().some((b) => b.bx === bx && b.by === by)) {
          bus.emit('explore:block-click', { bx, by });
          return;
        }
      }
      bus.emit('tile:click', tile);
    }
  }

  centerOnMap() {
    const map = gameState.state.map;
    if (!map) return;
    const size = map.length;
    const center = gridToIso(size / 2, size / 2, TILE_W, TILE_H);
    this.camera.x = this.width / 2 - center.x * this.camera.zoom;
    this.camera.y = this.height / 2 - center.y * this.camera.zoom;
    this._terrainDirty = true;
    this._dynamicDirty = true;
  }

  start() {
    // 初始化居民精灵
    this.spriteManager.init();

    const loop = () => {
      this._time = performance.now();

      // 建筑状态闪烁（加工中/储备已满）：检测相位变化，需要重绘地形层
      const newPhase = Math.floor((this._time / 500) % 3);
      if (newPhase !== this._lastProcessingPhase) {
        this._lastProcessingPhase = newPhase;
        this._terrainDirty = true;
      }

      // 更新居民精灵（每帧都更新）
      this.spriteManager.update();
      this._dynamicDirty = true; // 精灵在移动，需要每帧重绘dynamic层

      if (this._terrainDirty) { this._renderTerrain(); this._terrainDirty = false; }
      if (this._dynamicDirty) { this._renderDynamic(); this._dynamicDirty = false; }
      if (this._heatmapDirty) { this._renderHeatmap(); this._heatmapDirty = false; }
      this._animFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }

  // ===== 地形渲染（开罗风格） =====
  _renderTerrain() {
    const ctx = this.terrainCtx;
    const map = gameState.state.map;
    if (!map) return;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    const size = map.length;

    // 先画所有地形
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tile = map[y][x];
        if (!tile.explored) continue;

        const iso = gridToIso(x, y, TILE_W, TILE_H);

        // Viewport culling
        const sx = iso.x * this.camera.zoom + this.camera.x;
        const sy = iso.y * this.camera.zoom + this.camera.y;
        if (sx < -TILE_W * 2 || sx > this.width + TILE_W * 2 ||
            sy < -TILE_H * 2 || sy > this.height + TILE_H * 2) continue;

        this._drawKairoTile(ctx, iso.x, iso.y, tile);
      }
    }

    // 先画道路（在地形之上，建筑之下）
    for (const building of gameState.state.buildings) {
      if (building.buildingId === 'road') {
        const iso = gridToIso(building.x, building.y, TILE_W, TILE_H);
        this._drawRoad(ctx, iso.x, iso.y, building);
      }
    }

    // 再画建筑（在地形之上，道路之上）
    for (const building of gameState.state.buildings) {
      if (building.buildingId === 'road') continue;
      const iso = gridToIso(building.x, building.y, TILE_W, TILE_H);
      this._drawKairoBuilding(ctx, iso.x, iso.y, building);
    }

    // 待探索区块：发暗显示 + 标注「待探索」，点击可派遣
    this._drawUnexploredBlocks(ctx);

    ctx.restore();
  }

  /**
   * 绘制待探索区块：未探明地块发暗，区块中心标注「待探索」/「探索中」
   */
  _drawUnexploredBlocks(ctx) {
    const blocks = getExplorableBlocks();
    if (!blocks.length) return;
    for (const block of blocks) {
      const active = getActiveBlockExploration(block.bx, block.by);
      const tiles = getBlockTiles(block.bx, block.by);
      let centerX = 0;
      let centerY = 0;
      for (const tile of tiles) {
        centerX += tile.x;
        centerY += tile.y;
        if (tile.explored) continue;
        const iso = gridToIso(tile.x, tile.y, TILE_W, TILE_H);
        const sx = iso.x * this.camera.zoom + this.camera.x;
        const sy = iso.y * this.camera.zoom + this.camera.y;
        if (sx < -TILE_W * 2 || sx > this.width + TILE_W * 2 || sy < -TILE_H * 2 || sy > this.height + TILE_H * 2) continue;
        const hw = TILE_W / 2;
        const hh = TILE_H / 2;
        ctx.beginPath();
        ctx.moveTo(iso.x, iso.y);
        ctx.lineTo(iso.x + hw, iso.y + hh);
        ctx.lineTo(iso.x, iso.y + TILE_H);
        ctx.lineTo(iso.x - hw, iso.y + hh);
        ctx.closePath();
        ctx.fillStyle = active ? 'rgba(30,40,60,0.5)' : 'rgba(8,12,22,0.62)';
        ctx.fill();
        ctx.strokeStyle = active ? 'rgba(120,180,255,0.5)' : 'rgba(110,150,255,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const centerIso = gridToIso(centerX / tiles.length, centerY / tiles.length, TILE_W, TILE_H);
      const label = active ? '探索中' : '待探索';
      ctx.font = 'bold 11px "Noto Sans SC"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width;
      const bw = tw + 16;
      const bh = 18;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(centerIso.x - bw / 2, centerIso.y - bh / 2, bw, bh);
      ctx.strokeStyle = active ? 'rgba(120,180,255,0.6)' : 'rgba(140,170,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(centerIso.x - bw / 2, centerIso.y - bh / 2, bw, bh);
      ctx.fillStyle = active ? '#BFE0FF' : '#C8D8F0';
      ctx.fillText(label, centerIso.x, centerIso.y + 1);
    }
  }

  /**
   * 开罗风格等距瓦片
   */
  _drawKairoTile(ctx, x, y, tile) {
    const customImage = this.textures.getImage(`terrain.${tile.type}`);
    if (customImage) {
      const hw = TILE_W / 2;
      const hh = TILE_H / 2;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // 菱形 clip — 让自定义纹理贴合等距地块形状
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + hw, y + hh);
      ctx.lineTo(x, y + TILE_H);
      ctx.lineTo(x - hw, y + hh);
      ctx.closePath();
      ctx.clip();
      // 将图片缩放到 TILE_W × TILE_H 并居中对齐菱形
      ctx.drawImage(customImage, x - hw, y, TILE_W, TILE_H);
      ctx.restore();
      return;
    }

    const colors = TILE_COLORS[tile.type] || TILE_COLORS.plains;
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const depth = tile.type === 'mountain' ? 12 : tile.type === 'water' ? 2 : 6;

    // === 侧面（深色） ===
    ctx.fillStyle = colors.sides;
    // 左侧面
    ctx.beginPath();
    ctx.moveTo(x - hw, y + hh);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x, y + TILE_H + depth);
    ctx.lineTo(x - hw, y + hh + depth);
    ctx.closePath();
    ctx.fill();
    // 右侧面（稍亮）
    ctx.fillStyle = tile.type === 'water' ? colors.sides : this._lighten(colors.sides, 10);
    ctx.beginPath();
    ctx.moveTo(x + hw, y + hh);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x, y + TILE_H + depth);
    ctx.lineTo(x + hw, y + hh + depth);
    ctx.closePath();
    ctx.fill();

    // === 顶面 ===
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + hw, y + hh);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x - hw, y + hh);
    ctx.closePath();
    ctx.fillStyle = colors.top;
    ctx.fill();

    // === 顶面高光边 ===
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + hw, y + hh);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - hw, y + hh);
    ctx.stroke();

    // === 网格线 ===
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + hw, y + hh);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x - hw, y + hh);
    ctx.closePath();
    ctx.stroke();

    // === 地形装饰 ===
    const rng = seededRandom(tile.x, tile.y);
    const rng2 = seededRandom(tile.x, tile.y, 42);

    switch (tile.type) {
      case 'plains':
        this._drawGrassDecor(ctx, x, y, rng, rng2);
        break;
      case 'forest':
        this._drawTreeDecor(ctx, x, y, rng, rng2, colors);
        break;
      case 'water':
        this._drawWaterDecor(ctx, x, y, colors);
        break;
      case 'mountain':
        this._drawMountainDecor(ctx, x, y, rng, colors);
        break;
      case 'crystal':
        this._drawCrystalDecor(ctx, x, y, rng, colors);
        break;
      case 'metal':
        this._drawMetalDecor(ctx, x, y, rng, colors);
        break;
      case 'ruins':
        this._drawRuinsDecor(ctx, x, y, rng, colors);
        break;
      case 'crater':
        this._drawCraterDecor(ctx, x, y, rng, colors);
        break;
      case 'snow':
        ctx.fillStyle = '#F4FCFF';
        ctx.fillRect(x - 8, y + TILE_H / 2 - 2, 6, 2);
        ctx.fillRect(x + 5, y + TILE_H / 2 + 2, 4, 1);
        break;
      case 'desert':
        ctx.strokeStyle = '#E2AA61';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 12, y + 12); ctx.quadraticCurveTo(x, y + 7, x + 12, y + 12); ctx.stroke();
        break;
    }
  }

  // --- 草地装饰 ---
  _drawGrassDecor(ctx, x, y, rng, rng2) {
    const count = Math.floor(rng * 4) + 1;
    ctx.fillStyle = '#5C9E4C';
    for (let i = 0; i < count; i++) {
      const ox = (seededRandom(i, 0, rng * 1000) - 0.5) * 20;
      const oy = (seededRandom(i, 1, rng * 1000) - 0.5) * 8 + TILE_H / 2;
      ctx.fillRect(x + ox, y + oy, 2, 3);
      ctx.fillRect(x + ox + 1, y + oy - 1, 1, 1);
    }
    // 偶尔画小花
    if (rng2 > 0.7) {
      const fx = (rng2 - 0.7) * 60 - 9;
      const fy = TILE_H / 2 + rng * 4;
      ctx.fillStyle = rng2 > 0.85 ? '#F0E060' : '#E08080';
      ctx.fillRect(x + fx, y + fy, 2, 2);
      ctx.fillStyle = '#5C9E4C';
      ctx.fillRect(x + fx + 0.5, y + fy + 2, 1, 2);
    }
  }

  // --- 树木装饰 ---
  _drawTreeDecor(ctx, x, y, rng, rng2, colors) {
    const treeCount = Math.floor(rng * 2) + 1;
    for (let i = 0; i < treeCount; i++) {
      const tx = x + (seededRandom(i, 2, rng * 1000) - 0.5) * 18;
      const ty = y + TILE_H / 2 - 2 + (seededRandom(i, 3, rng * 1000) - 0.5) * 6;

      // 树干
      ctx.fillStyle = '#5A4030';
      ctx.fillRect(tx - 1, ty - 4, 2, 6);

      // 树冠（三角形像素风格）
      ctx.fillStyle = colors.tree || '#1E6030';
      ctx.fillRect(tx - 4, ty - 6, 8, 2);
      ctx.fillRect(tx - 3, ty - 8, 6, 2);
      ctx.fillRect(tx - 2, ty - 10, 4, 2);
      ctx.fillRect(tx - 1, ty - 11, 2, 1);

      // 树冠高光
      ctx.fillStyle = '#3E9E50';
      ctx.fillRect(tx - 3, ty - 8, 2, 1);
      ctx.fillRect(tx - 1, ty - 10, 2, 1);
    }
  }

  // --- 水面装饰 ---
  _drawWaterDecor(ctx, x, y, colors) {
    const t = this._time * 0.001;
    ctx.fillStyle = colors.wave;
    ctx.globalAlpha = 0.3 + Math.sin(t + x * 0.1) * 0.15;
    ctx.fillRect(x - 8, y + TILE_H / 2 - 1, 6, 1);
    ctx.fillRect(x + 4, y + TILE_H / 2 + 2, 5, 1);
    ctx.globalAlpha = 1;
  }

  // --- 山脉装饰 ---
  _drawMountainDecor(ctx, x, y, rng, colors) {
    // 山峰
    ctx.fillStyle = colors.peak;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 2);
    ctx.lineTo(x, y - 6);
    ctx.lineTo(x + 4, y + 2);
    ctx.closePath();
    ctx.fill();

    // 雪顶
    ctx.fillStyle = '#E8E8F0';
    ctx.fillRect(x - 1, y - 6, 2, 2);

    if (rng > 0.5) {
      ctx.fillStyle = colors.peak;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 6);
      ctx.lineTo(x + 9, y);
      ctx.lineTo(x + 12, y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- 晶矿装饰 ---
  _drawCrystalDecor(ctx, x, y, rng, colors) {
    const count = Math.floor(rng * 3) + 1;
    for (let i = 0; i < count; i++) {
      const cx = x + (seededRandom(i, 4, rng * 1000) - 0.5) * 16;
      const cy = y + TILE_H / 2 - 2 + (seededRandom(i, 5, rng * 1000) - 0.5) * 4;

      // 晶体
      ctx.fillStyle = colors.gem;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 3, cy - 2);
      ctx.lineTo(cx + 2, cy + 1);
      ctx.lineTo(cx - 2, cy + 1);
      ctx.lineTo(cx - 3, cy - 2);
      ctx.closePath();
      ctx.fill();

      // 闪光
      ctx.fillStyle = '#F0E0FF';
      ctx.fillRect(cx - 1, cy - 5, 1, 1);
    }
  }

  // --- 矿脉装饰 ---
  _drawMetalDecor(ctx, x, y, rng, colors) {
    ctx.fillStyle = colors.ore;
    const count = Math.floor(rng * 4) + 2;
    for (let i = 0; i < count; i++) {
      const ox = (seededRandom(i, 6, rng * 1000) - 0.5) * 20;
      const oy = (seededRandom(i, 7, rng * 1000) - 0.5) * 8 + TILE_H / 2;
      ctx.fillRect(x + ox, y + oy, 3, 2);
    }
  }

  // --- 遗迹装饰 ---
  _drawRuinsDecor(ctx, x, y, rng, colors) {
    ctx.fillStyle = colors.stone;
    // 残柱
    ctx.fillRect(x - 6, y + TILE_H / 2 - 8, 3, 8);
    ctx.fillRect(x - 7, y + TILE_H / 2 - 9, 5, 2);
    if (rng > 0.4) {
      ctx.fillRect(x + 4, y + TILE_H / 2 - 5, 3, 5);
    }
    // 碎石
    ctx.fillStyle = '#6A6A80';
    ctx.fillRect(x + 1, y + TILE_H / 2 + 1, 2, 1);
    ctx.fillRect(x - 3, y + TILE_H / 2 + 2, 2, 1);
  }

  // --- 陨石坑装饰 ---
  _drawCraterDecor(ctx, x, y, rng, colors) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + TILE_H / 2, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.highlight;
    ctx.beginPath();
    ctx.ellipse(x, y + TILE_H / 2, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 开罗风格建筑渲染
   */
  _drawKairoBuilding(ctx, x, y, building) {
    const data = getBuildingById(building.buildingId);
    if (!data) return;

    if (building.built) {
      const customImage = this.textures.getImage(`building.${building.buildingId}`);
      if (customImage) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const draw = getBuildingDrawPosition(
          x,
          y + TILE_H / 2,
          customImage.width,
          customImage.height,
        );
        ctx.drawImage(customImage, draw.x, draw.y, draw.width, draw.height);
        ctx.restore();
        this._drawBuildingName(ctx, x, draw.y - 5, building);
        return;
      }
    }

    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const bh = building.built ? 20 : 12; // 建筑高度

    // 建筑颜色根据类别
    const catColors = {
      basic:    { wall: '#6090C0', roof: '#4A78A8', side: '#4A6890', accent: '#80B0E0' },
      food:     { wall: '#90A060', roof: '#788840', side: '#607030', accent: '#B0C880' },
      science:  { wall: '#7080B0', roof: '#5868A0', side: '#485888', accent: '#90A0D0' },
      culture:  { wall: '#A07090', roof: '#886078', side: '#705060', accent: '#C090B0' },
      military: { wall: '#808090', roof: '#686878', side: '#585868', accent: '#A0A0B0' },
      special:  { wall: '#A09060', roof: '#887848', side: '#706038', accent: '#C0B080' },
    };
    const bc = catColors[data.category] || catColors.basic;

    if (!building.built) {
      // === 建造中 ===
      ctx.globalAlpha = 0.6;

      // 脚手架
      ctx.strokeStyle = '#A08040';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - hw * 0.4, y - bh + hh, hw * 0.8, bh);
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.4, y + hh);
      ctx.lineTo(x + hw * 0.4, y - bh + hh);
      ctx.stroke();

      // 半成品墙体
      ctx.fillStyle = bc.wall;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x - hw * 0.35, y + hh - bh * building.progress, hw * 0.7, bh * building.progress);

      ctx.globalAlpha = 1;

      // 进度条
      const pw = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - pw / 2, y - 4, pw, 5);
      ctx.fillStyle = '#F0C040';
      ctx.fillRect(x - pw / 2 + 1, y - 3, (pw - 2) * building.progress, 3);

      // 建造中文字
      ctx.fillStyle = '#F0C040';
      ctx.font = '9px "Noto Sans SC"';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(building.progress * 100)}%`, x, y - 8);
      return;
    }

    // === 完成的建筑 ===

    // 屋顶（等距菱形）
    ctx.fillStyle = bc.roof;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + hw * 0.5, y + hh * 0.5 - bh);
    ctx.lineTo(x, y + TILE_H * 0.5 - bh + 2);
    ctx.lineTo(x - hw * 0.5, y + hh * 0.5 - bh);
    ctx.closePath();
    ctx.fill();

    // 左墙
    ctx.fillStyle = bc.wall;
    ctx.beginPath();
    ctx.moveTo(x - hw * 0.5, y + hh * 0.5 - bh);
    ctx.lineTo(x, y + TILE_H * 0.5 - bh + 2);
    ctx.lineTo(x, y + TILE_H * 0.5 + 2);
    ctx.lineTo(x - hw * 0.5, y + hh * 0.5);
    ctx.closePath();
    ctx.fill();

    // 右墙（稍暗）
    ctx.fillStyle = bc.side;
    ctx.beginPath();
    ctx.moveTo(x + hw * 0.5, y + hh * 0.5 - bh);
    ctx.lineTo(x, y + TILE_H * 0.5 - bh + 2);
    ctx.lineTo(x, y + TILE_H * 0.5 + 2);
    ctx.lineTo(x + hw * 0.5, y + hh * 0.5);
    ctx.closePath();
    ctx.fill();

    // 窗户（像素风格）
    ctx.fillStyle = '#F0E880';
    ctx.globalAlpha = 0.7;
    // 左墙窗
    ctx.fillRect(x - hw * 0.3, y + hh * 0.3 - bh * 0.3, 3, 3);
    ctx.fillRect(x - hw * 0.15, y + hh * 0.3 - bh * 0.3, 3, 3);
    // 右墙窗
    ctx.fillRect(x + hw * 0.1, y + hh * 0.3 - bh * 0.3, 3, 3);
    ctx.globalAlpha = 1;

    // 门
    ctx.fillStyle = '#4A3828';
    ctx.fillRect(x - 2, y + TILE_H * 0.5 - 2, 4, 4);

    // 屋顶高光线
    ctx.strokeStyle = bc.accent;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + hw * 0.5, y + hh * 0.5 - bh);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x - hw * 0.5, y + hh * 0.5 - bh);
    ctx.stroke();

    // 建筑名称（工作中时三状态闪烁变色）
    this._drawBuildingName(ctx, x, y - bh - 5, building);

    // 未连接降落点的警告三角
    if (requiresRoadConnection(building)) {
      const opState = getBuildingOperationalState(building);
      if (!opState.operational && opState.reason === '未通过道路连接降落点') {
        this._drawWarningTriangle(ctx, x + hw * 0.35, y - bh - 10);
      }
    }
  }

  /**
   * 建筑名称标签 — 自定义纹理建筑同样显示（工作中时三状态闪烁变色）
   */
  _drawBuildingName(ctx, x, topY, building) {
    const data = getBuildingById(building.buildingId);
    if (!data) return;
    // 加工中（工坊有队列）→ 绿色闪烁；储备已满（需搬运）→ 琥珀色闪烁
    const isProcessing = building.buildingId === 'workshop' && getProductionState().queue.length > 0;
    const isBufferFull = getBuildingBufferStatus(building).full;
    if (isProcessing || isBufferFull) {
      // 三状态循环：正常→亮→暗，每组 1.5 秒
      const phase = Math.floor((this._time / 500) % 3);
      const palette = isProcessing
        ? ['#FFFFFF', '#80FF90', '#40C060']
        : ['#FFFFFF', '#FFD080', '#E0A040'];
      ctx.fillStyle = palette[phase];
    } else {
      ctx.fillStyle = '#FFFFFF';
    }
    ctx.font = 'bold 9px "Noto Sans SC"';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(data.name, x, topY);
    ctx.shadowBlur = 0;
  }

  /**
   * 警告三角标志 — 未连接降落点时显示
   */
  _drawWarningTriangle(ctx, cx, cy) {
    const size = 7;
    ctx.save();

    // 三角形背景
    ctx.fillStyle = '#E74C3C';
    ctx.strokeStyle = '#C0392B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy + size * 0.6);
    ctx.lineTo(cx - size, cy + size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 感叹号
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy);

    ctx.restore();
  }

  /**
   * 开罗风格道路渲染 - 扁平的发光通道
   */
  _drawRoad(ctx, x, y, building) {
    const customImage = this.textures.getImage('building.road');
    if (customImage) {
      const hw = TILE_W / 2;
      const hh = TILE_H / 2;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + hw, y + hh);
      ctx.lineTo(x, y + TILE_H);
      ctx.lineTo(x - hw, y + hh);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(customImage, x - hw, y, TILE_W, TILE_H);
      ctx.restore();
      return;
    }

    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

    // 道路菱形（略小于地块）
    const inset = 4;
    const ihw = hw - inset;
    const ihh = hh - inset / 2;

    // 道路底色
    ctx.fillStyle = building.built ? '#3A4060' : '#2A2E40';
    ctx.beginPath();
    ctx.moveTo(x, y + inset / 2);
    ctx.lineTo(x + ihw, y + ihh);
    ctx.lineTo(x, y + TILE_H - inset / 2);
    ctx.lineTo(x - ihw, y + ihh);
    ctx.closePath();
    ctx.fill();

    // 道路高光边
    ctx.strokeStyle = building.built ? '#6080C0' : '#404868';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 中央装饰线（虚线效果）
    if (building.built) {
      ctx.strokeStyle = 'rgba(160,200,255,0.4)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x - ihw * 0.6, y + ihh);
      ctx.lineTo(x + ihw * 0.6, y + ihh);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 建造中进度条
    if (!building.built) {
      const pw = 24;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - pw / 2, y + 2, pw, 4);
      ctx.fillStyle = '#F0C040';
      ctx.fillRect(x - pw / 2 + 1, y + 3, (pw - 2) * building.progress, 2);
    }
  }

  // ===== 动态层渲染 =====
  _renderDynamic() {    const ctx = this.dynamicCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // 渲染居民精灵
    this.spriteManager.render(ctx, this.camera.zoom);

    // 区块探索进度条（含随机事件标记点）
    this._drawExplorationProgress(ctx);

    // 悬停高亮
    if (this.hoveredTile) {
      const tile = this.hoveredTile;

      // 未探索的地块不显示任何信息
      if (!tile.explored) {
        // 只显示迷雾中的问号提示
        const iso = gridToIso(tile.x, tile.y, TILE_W, TILE_H);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.moveTo(iso.x, iso.y);
        ctx.lineTo(iso.x + TILE_W / 2, iso.y + TILE_H / 2);
        ctx.lineTo(iso.x, iso.y + TILE_H);
        ctx.lineTo(iso.x - TILE_W / 2, iso.y + TILE_H / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px "Noto Sans SC"';
        ctx.textAlign = 'center';
        ctx.fillText('未探索区域', iso.x, iso.y - 8);
      } else {
      const iso = gridToIso(tile.x, tile.y, TILE_W, TILE_H);

      ctx.beginPath();
      ctx.moveTo(iso.x, iso.y);
      ctx.lineTo(iso.x + TILE_W / 2, iso.y + TILE_H / 2);
      ctx.lineTo(iso.x, iso.y + TILE_H);
      ctx.lineTo(iso.x - TILE_W / 2, iso.y + TILE_H / 2);
      ctx.closePath();

      const placing = gameState.state.placingBuilding;
      if (placing) {
        const tileInfo = TILE_TYPES[tile.type];
        const techUnlocked = tileInfo.techUnlock ? gameState.state.researchedTechs.includes(tileInfo.techUnlock) : false;
        const canPlace = (tileInfo.buildable || techUnlocked) && !tile.building;
        ctx.fillStyle = canPlace ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)';
        ctx.strokeStyle = canPlace ? 'rgba(46,204,113,0.8)' : 'rgba(231,76,60,0.8)';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      }
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 瓦片信息
      const tileInfo = TILE_TYPES[tile.type];
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px "Noto Sans SC"';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(`${tileInfo.name} (${tile.x}, ${tile.y})`, iso.x, iso.y - 8);
      ctx.shadowBlur = 0;
      } // end explored tile hover
    }

    ctx.restore();
  }

  /**
   * 绘制进行中的区块探索进度条（区块中心），带随机事件位置标记点
   */
  _drawExplorationProgress(ctx) {
    const explorations = gameState.state.blockExplorations || [];
    if (!explorations.length) return;
    for (const exp of explorations) {
      const tiles = getBlockTiles(exp.bx, exp.by);
      if (!tiles.length) continue;
      const centerX = tiles.reduce((sum, t) => sum + t.x, 0) / tiles.length;
      const centerY = tiles.reduce((sum, t) => sum + t.y, 0) / tiles.length;
      const iso = gridToIso(centerX, centerY, TILE_W, TILE_H);
      const progress = exp.totalDays > 0 ? 1 - exp.remainingDays / exp.totalDays : 1;

      const bw = TILE_W * 2.6;
      const bh = 7;
      const bx = iso.x - bw / 2;
      const by = iso.y - bh / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#5A9AD8';
      ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, progress)), bh);

      // 事件位置标记点（未触发偏红、已触发偏金）
      for (const ev of exp.events || []) {
        const px = bx + bw * ev.position;
        ctx.fillStyle = ev.fired ? '#F0C040' : '#E08080';
        ctx.beginPath();
        ctx.arc(px, by + bh / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px "Noto Sans SC"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(`探索中 ${Math.ceil(exp.remainingDays)}天`, iso.x, iso.y - 14);
      ctx.shadowBlur = 0;
    }
  }

  // ===== 热力图渲染 =====
  _renderHeatmap() {
    const ctx = this.heatmapCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    const dim = gameState.state.gravityOverlay;
    if (!dim) return;

    const map = gameState.state.map;
    if (!map) return;

    const config = GRAVITY_CONFIG[dim];
    if (!config) return;

    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    const size = map.length;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tile = map[y][x];
        if (!tile.explored) continue;

        const value = tile.gravityField[dim] || 0;
        if (value <= 0) continue;

        const iso = gridToIso(x, y, TILE_W, TILE_H);
        const alpha = clamp(value / 20, 0.05, 0.6);

        ctx.beginPath();
        ctx.moveTo(iso.x, iso.y);
        ctx.lineTo(iso.x + TILE_W / 2, iso.y + TILE_H / 2);
        ctx.lineTo(iso.x, iso.y + TILE_H);
        ctx.lineTo(iso.x - TILE_W / 2, iso.y + TILE_H / 2);
        ctx.closePath();

        // 将hex颜色转为rgba
        const r = parseInt(config.color.slice(1, 3), 16);
        const g = parseInt(config.color.slice(3, 5), 16);
        const b = parseInt(config.color.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  markDirty() {
    this._terrainDirty = true;
    this._dynamicDirty = true;
    this._heatmapDirty = true;
  }

  // 工具函数：颜色加亮
  _lighten(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${clamp(r + amount, 0, 255)},${clamp(g + amount, 0, 255)},${clamp(b + amount, 0, 255)})`;
  }
}
