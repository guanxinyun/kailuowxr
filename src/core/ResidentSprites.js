/**
 * 星尘殖民地 — 居民精灵系统
 * 仿照开罗《宇宙探险物语》风格，在地图上显示可移动的像素小人
 * 使用A*寻路，居民有目的地行走（工作/回家/休闲）
 */
import { gameState } from './GameState.js';
import { gridToIso } from './MapGenerator.js';
import { clamp } from './utils.js';
import { findRoadPath, isRoadWalkable, hasRoad } from './Pathfinding.js';
import { textureManager } from './TextureManager.js';
import { getSpriteDrawRect, SPRITE_FRAME_SIZE } from './TexturePresentation.js';

const TILE_W = 64;
const TILE_H = 32;

// 像素小人颜色方案（每个居民不同颜色）
const SPRITE_COLORS = [
  { body: '#4A90D9', hair: '#2C3E50', skin: '#F5D6BA', pants: '#34495E', accent: '#5DADE2' },
  { body: '#2ECC71', hair: '#1A1A2E', skin: '#FDEBD0', pants: '#27AE60', accent: '#82E0AA' },
  { body: '#E74C3C', hair: '#4A2C2A', skin: '#F0D5C8', pants: '#C0392B', accent: '#F1948A' },
  { body: '#9B59B6', hair: '#2C3E50', skin: '#FAE5D3', pants: '#7D3C98', accent: '#C39BD3' },
  { body: '#F39C12', hair: '#1B2631', skin: '#F5CBA7', pants: '#D68910', accent: '#F9E79F' },
  { body: '#1ABC9C', hair: '#17202A', skin: '#FDEBD0', pants: '#148F77', accent: '#76D7C4' },
];

// 外星人精灵颜色（用于游客）
export const ALIEN_COLORS = {
  squid:   { body: '#FF7B9C', hair: '#D4507A', skin: '#FFB5C8', pants: '#CC3366', accent: '#FF9EB5' },
  crystal: { body: '#C8BFE7', hair: '#9B8FD0', skin: '#E8E0FF', pants: '#7A6CB8', accent: '#D8D0F0' },
  mecha:   { body: '#7F8C8D', hair: '#5D6D6E', skin: '#B0BEC5', pants: '#455A64', accent: '#90A4AE' },
  flora:   { body: '#A8D8B9', hair: '#6BAF7B', skin: '#C8F0D4', pants: '#4A9060', accent: '#B8E8C8' },
};

const DIRECTIONS = ['down', 'up', 'left', 'right'];

/**
 * 绘制一个像素小人
 */
function drawPixelPerson(ctx, x, y, colors, frame, direction, scale = 1) {
  const s = scale;
  const px = (n) => n * s;
  const baseY = y;
  const baseX = x;
  const bounce = frame === 1 ? px(-1) : 0;
  const legOffset = frame === 0 ? px(-1) : frame === 2 ? px(1) : 0;

  ctx.save();

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + px(1), px(4), px(2), 0, 0, Math.PI * 2);
  ctx.fill();

  // 脚
  ctx.fillStyle = colors.pants;
  ctx.fillRect(baseX - px(3) + legOffset, baseY - px(2), px(2), px(2));
  ctx.fillRect(baseX + px(1) - legOffset, baseY - px(2), px(2), px(2));

  // 腿
  ctx.fillStyle = colors.pants;
  ctx.fillRect(baseX - px(3) + legOffset, baseY - px(5) + bounce, px(2), px(3));
  ctx.fillRect(baseX + px(1) - legOffset, baseY - px(5) + bounce, px(2), px(3));

  // 身体
  ctx.fillStyle = colors.body;
  ctx.fillRect(baseX - px(4), baseY - px(10) + bounce, px(8), px(5));

  // 身体高光
  ctx.fillStyle = colors.accent;
  ctx.fillRect(baseX - px(3), baseY - px(9) + bounce, px(2), px(3));

  // 手臂
  ctx.fillStyle = colors.skin;
  const armSwing = frame === 0 ? px(1) : frame === 2 ? px(-1) : 0;
  ctx.fillRect(baseX - px(5), baseY - px(9) + bounce + armSwing, px(1), px(4));
  ctx.fillRect(baseX + px(4), baseY - px(9) + bounce - armSwing, px(1), px(4));

  // 头
  ctx.fillStyle = colors.skin;
  ctx.fillRect(baseX - px(3), baseY - px(14) + bounce, px(6), px(4));

  // 头发
  ctx.fillStyle = colors.hair;
  ctx.fillRect(baseX - px(3), baseY - px(15) + bounce, px(6), px(2));
  if (direction === 'left' || direction === 'down') {
    ctx.fillRect(baseX - px(3), baseY - px(13) + bounce, px(1), px(2));
  }
  if (direction === 'right' || direction === 'down') {
    ctx.fillRect(baseX + px(2), baseY - px(13) + bounce, px(1), px(2));
  }

  // 眼睛
  ctx.fillStyle = '#1a1a2e';
  if (direction !== 'up') {
    ctx.fillRect(baseX - px(2), baseY - px(13) + bounce, px(1), px(1));
    ctx.fillRect(baseX + px(1), baseY - px(13) + bounce, px(1), px(1));
  }

  ctx.restore();
}

/**
 * 绘制外星人精灵（与普通小人有区别的外观）
 */
function drawAlienPerson(ctx, x, y, colors, frame, direction, scale = 1, speciesId = 'squid') {
  const s = scale;
  const px = (n) => n * s;
  const baseY = y;
  const baseX = x;
  const bounce = frame === 1 ? px(-1) : 0;
  const legOffset = frame === 0 ? px(-1) : frame === 2 ? px(1) : 0;

  ctx.save();

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + px(1), px(4), px(2), 0, 0, Math.PI * 2);
  ctx.fill();

  // 身体（外星人身体更圆润）
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(baseX, baseY - px(6) + bounce, px(5), px(6), 0, 0, Math.PI * 2);
  ctx.fill();

  // 身体高光
  ctx.fillStyle = colors.accent;
  ctx.fillRect(baseX - px(2), baseY - px(8) + bounce, px(2), px(3));

  // 腿/触手（根据种族不同）
  ctx.fillStyle = colors.pants;
  if (speciesId === 'squid') {
    // 水母族 — 触手
    for (let i = -2; i <= 2; i++) {
      const wave = Math.sin(frame * 1.5 + i) * px(1);
      ctx.fillRect(baseX + i * px(2), baseY - px(1) + wave, px(1), px(2));
    }
  } else if (speciesId === 'mecha') {
    // 机甲族 — 方形腿
    ctx.fillRect(baseX - px(3) + legOffset, baseY - px(2), px(3), px(2));
    ctx.fillRect(baseX + px(0) - legOffset, baseY - px(2), px(3), px(2));
  } else {
    // 其他 — 普通腿
    ctx.fillRect(baseX - px(3) + legOffset, baseY - px(2), px(2), px(2));
    ctx.fillRect(baseX + px(1) - legOffset, baseY - px(2), px(2), px(2));
  }

  // 头（外星人头更大）
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.ellipse(baseX, baseY - px(13) + bounce, px(4), px(4), 0, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛（外星人眼睛更大更亮）
  ctx.fillStyle = '#FFFFFF';
  if (direction !== 'up') {
    ctx.beginPath();
    ctx.ellipse(baseX - px(2), baseY - px(13) + bounce, px(1.5), px(1.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(baseX + px(2), baseY - px(13) + bounce, px(1.5), px(1.5), 0, 0, Math.PI * 2);
    ctx.fill();
    // 瞳孔
    ctx.fillStyle = colors.hair;
    ctx.fillRect(baseX - px(2), baseY - px(13) + bounce, px(1), px(1));
    ctx.fillRect(baseX + px(1.5), baseY - px(13) + bounce, px(1), px(1));
  }

  // 种族特征装饰
  ctx.fillStyle = colors.accent;
  if (speciesId === 'squid') {
    // 头顶发光触角
    ctx.fillRect(baseX - px(1), baseY - px(18) + bounce, px(1), px(3));
    ctx.fillRect(baseX + px(1), baseY - px(17) + bounce, px(1), px(2));
  } else if (speciesId === 'crystal') {
    // 晶体头冠
    ctx.fillRect(baseX - px(2), baseY - px(17) + bounce, px(1), px(2));
    ctx.fillRect(baseX, baseY - px(18) + bounce, px(1), px(3));
    ctx.fillRect(baseX + px(2), baseY - px(17) + bounce, px(1), px(2));
  } else if (speciesId === 'flora') {
    // 花朵/叶子
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(baseX - px(3), baseY - px(16) + bounce, px(2), px(1));
    ctx.fillRect(baseX + px(2), baseY - px(16) + bounce, px(2), px(1));
  }

  ctx.restore();
}

// ===== 居民行为状态 =====
const STATE = {
  IDLE: 'idle',
  WALKING: 'walking',
  WORKING: 'working',
  RESTING: 'resting',
};

/**
 * 居民精灵类 — 带寻路的目标驱动行为
 */
export class ResidentSprite {
  constructor(resident, colorIndex, textures = textureManager) {
    this.resident = resident;
    this.textures = textures;
    this.colors = SPRITE_COLORS[colorIndex % SPRITE_COLORS.length];
    this.isAlien = false;
    this.speciesId = null;

    // 网格位置（浮点数，用于平滑移动）
    this.gridX = 0;
    this.gridY = 0;

    // 寻路路径
    this.path = [];        // 路径点队列 [{x,y}, ...]
    this.currentWaypoint = null;

    // 动画
    this.frame = 0;
    this.frameTimer = 0;
    this.direction = 'down';
    this.isMoving = false;
    // 移动速度：高级住宅（住宅阶段 2/3）提升行走速度
    const level = this.resident.level || 1;
    const housingStage = this.resident.housingStage || (level >= 7 ? 3 : level >= 4 ? 2 : 1);
    const housingSpeedMult = housingStage >= 3 ? 1.6 : housingStage >= 2 ? 1.3 : 1.0;
    this.speed = (1.5 + Math.random() * 0.5) * housingSpeedMult; // 格/秒

    // 行为状态机
    this.state = STATE.IDLE;
    this.stateTimer = 0;

    // 状态气泡
    this.bubbleIcon = null;
    this.bubbleTimer = 0;
  }

  /**
   * 初始化位置到殖民地中心附近的可行走格子
   */
  initPosition(mapSize, map) {
    const center = Math.floor(mapSize / 2);
    // 找到中心附近的可行走格子
    for (let r = 0; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = center + dx;
          const y = center + dy;
          if (map && isRoadWalkable(map, x, y)) {
            this.gridX = x + 0.5;
            this.gridY = y + 0.5;
            return;
          }
        }
      }
    }
    this.gridX = center;
    this.gridY = center;
  }

  /**
   * 更新逻辑
   */
  update(dt, map) {
    if (!map) return;
    const mapSize = map.length;

    // 安全检查：如果居民当前位置在未探索区域，传送回已探索区域
    const curTileX = Math.floor(this.gridX);
    const curTileY = Math.floor(this.gridY);
    if (!isRoadWalkable(map, curTileX, curTileY)) {
      this.initPosition(mapSize, map);
      this.enterIdle(500);
      return;
    }

    // 动画帧更新
    this.frameTimer += dt;
    if (this.frameTimer > 200) {
      this.frameTimer = 0;
      if (this.isMoving) {
        this.frame = (this.frame + 1) % 3;
      } else {
        this.frame = 0;
      }
    }

    // 气泡计时
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.bubbleIcon = null;
      }
    }

    // 状态机更新
    switch (this.state) {
      case STATE.IDLE:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.pickNewDestination(map, mapSize);
        }
        break;

      case STATE.WALKING:
        this.followPath(dt, map);
        break;

      case STATE.WORKING:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.showBubble();
          this.enterIdle(500 + Math.random() * 1000);
        }
        break;

      case STATE.RESTING:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.enterIdle(500 + Math.random() * 1000);
        }
        break;
    }
  }

  /**
   * 进入空闲状态
   */
  enterIdle(duration = 1000 + Math.random() * 2000) {
    this.state = STATE.IDLE;
    this.stateTimer = duration;
    this.isMoving = false;
    this.path = [];
    this.currentWaypoint = null;
  }

  /**
   * 选择新的目的地并寻路
   */
  pickNewDestination(map, mapSize) {
    const buildings = gameState.state.buildings.filter(b => {
      if (!b.built) return false;
      // 只选择已探索区域内的建筑
      const tile = map[b.y] && map[b.y][b.x];
      return tile && tile.explored;
    });
    const myX = Math.floor(this.gridX);
    const myY = Math.floor(this.gridY);

    let targetX, targetY;
    const roll = Math.random();

    // 如果是外星游客，优先根据其当前设定目的地或停留期限状态寻路
    if (this.isAlien && this.resident) {
      const tourist = this.resident;
      const day = gameState.state.day;
      const isDeparting = tourist.isDeparting || (day >= (tourist.visitDay + tourist.stayDuration));

      if (isDeparting) {
        // 到期准备离开：寻路前往降落点(landing_pad)
        const pad = buildings.find(b => b.buildingId === 'landing_pad') || buildings[0];
        if (pad) {
          this.navigateTo(map, myX, myY, pad.x, pad.y);
          return;
        }
      } else if (tourist.currentDestination) {
        const destBuilding = buildings.find(b => b.id === tourist.currentDestination);
        if (destBuilding) {
          this.navigateTo(map, myX, myY, destBuilding.x, destBuilding.y);
          return;
        }
      }
    }

    if (buildings.length > 0) {
      if (roll < 0.4) {
        // 40% 去工作建筑（优先自己分配到的岗位）
        const workplace = buildings.find(b => b.workerId === this.resident.id);
        const b = workplace || buildings[Math.floor(Math.random() * buildings.length)];
        targetX = b.x;
        targetY = b.y;
      } else if (roll < 0.7) {
        // 30% 去住宅（或随机建筑）
        const homes = buildings.filter(b => {
          const id = b.buildingId;
          return id === 'habitat' || id === 'b_tent' || id === 'b_cottage';
        });
        const target = homes.length > 0
          ? homes[Math.floor(Math.random() * homes.length)]
          : buildings[Math.floor(Math.random() * buildings.length)];
        targetX = target.x;
        targetY = target.y;
      } else {
        // 30% 随机闲逛
        this.pickRandomWalkableTarget(map, mapSize, myX, myY);
        return;
      }
    } else {
      // 没有建筑，随机闲逛
      this.pickRandomWalkableTarget(map, mapSize, myX, myY);
      return;
    }

    // 寻路到目标
    this.navigateTo(map, myX, myY, targetX, targetY);
  }

  /**
   * 选择随机可行走目标
   */
  pickRandomWalkableTarget(map, mapSize, myX, myY) {
    const range = 5;
    for (let attempt = 0; attempt < 15; attempt++) {
      const tx = myX + Math.floor((Math.random() - 0.5) * range * 2);
      const ty = myY + Math.floor((Math.random() - 0.5) * range * 2);
      if (isRoadWalkable(map, tx, ty) && (tx !== myX || ty !== myY)) {
        this.navigateTo(map, myX, myY, tx, ty);
        return;
      }
    }
    // 找不到目标，继续等待
    this.enterIdle(2000);
  }

  /**
   * 寻路到指定位置
   */
  navigateTo(map, fromX, fromY, toX, toY) {
    const path = findRoadPath(map, fromX, fromY, toX, toY);
    if (path && path.length > 0) {
      this.path = path;
      this.currentWaypoint = this.path.shift();
      this.state = STATE.WALKING;
      this.isMoving = true;
    } else {
      // 寻路失败，等一会再试
      this.enterIdle(2000 + Math.random() * 2000);
    }
  }

  /**
   * 沿路径行走
   */
  followPath(dt, map) {
    if (!this.currentWaypoint) {
      // 到达目的地
      this.arriveAtDestination();
      return;
    }

    // 检查当前路径点是否仍在已探索区域内
    const wpX = this.currentWaypoint.x;
    const wpY = this.currentWaypoint.y;
    if (!isRoadWalkable(map, wpX, wpY)) {
      // 路径点不可达（可能进入了迷雾），停下来重新寻路
      this.enterIdle(500 + Math.random() * 1000);
      return;
    }

    const targetX = this.currentWaypoint.x + 0.5; // 格子中心
    const targetY = this.currentWaypoint.y + 0.5;
    const dx = targetX - this.gridX;
    const dy = targetY - this.gridY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.08) {
      // 到达当前路径点
      this.gridX = targetX;
      this.gridY = targetY;

      if (this.path.length > 0) {
        this.currentWaypoint = this.path.shift();
      } else {
        this.currentWaypoint = null;
        this.arriveAtDestination();
      }
      return;
    }

    // 计算移动速度（道路上加速50%）
    const tileX = Math.floor(this.gridX);
    const tileY = Math.floor(this.gridY);
    const onRoad = hasRoad(map, tileX, tileY);
    const speedMult = onRoad ? 1.5 : 1.0;
    const moveAmount = this.speed * speedMult * dt * 0.001;

    this.gridX += (dx / dist) * moveAmount;
    this.gridY += (dy / dist) * moveAmount;

    // 更新方向
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }
  }

  /**
   * 到达目的地
   */
  arriveAtDestination() {
    this.isMoving = false;
    const tileX = Math.floor(this.gridX);
    const tileY = Math.floor(this.gridY);
    const map = gameState.state.map;

    if (map && map[tileY] && map[tileY][tileX]) {
      const tile = map[tileY][tileX];
      if (tile.building && tile.building !== 'road') {
        // 在建筑处停留（工作或休息）
        const roll = Math.random();
        if (roll < 0.5) {
          this.state = STATE.WORKING;
          this.stateTimer = 3000 + Math.random() * 5000;
        } else {
          this.state = STATE.RESTING;
          this.stateTimer = 2000 + Math.random() * 3000;
        }
        // 偶尔显示气泡
        if (Math.random() < 0.3) {
          this.showBubble();
        }
        return;
      }
    }

    // 在空地上短暂停留
    this.enterIdle(1000 + Math.random() * 2000);
    if (Math.random() < 0.15) {
      this.showBubble();
    }
  }

  /**
   * 显示状态气泡
   */
  showBubble() {
    const mood = this.resident.mood;
    if (mood >= 80) {
      this.bubbleIcon = 'heart';
    } else if (mood >= 60) {
      this.bubbleIcon = 'note';
    } else if (mood >= 40) {
      this.bubbleIcon = 'sweat';
    } else {
      this.bubbleIcon = 'angry';
    }
    this.bubbleTimer = 2000;
  }

  /**
   * 渲染
   */
  render(ctx, cameraZoom) {
    const iso = gridToIso(this.gridX, this.gridY, TILE_W, TILE_H);
    const scale = clamp(cameraZoom * 0.8, 0.5, 2);
    const imageSlots = this.isAlien
      ? [`tourist.${this.speciesId}`]
      : [`resident.${this.resident.id}`, 'resident.default'];
    const image = this.textures.resolveImage(imageSlots);

    if (image) {
      this.renderCustomSprite(ctx, iso.x, iso.y, scale, image);
    } else if (this.isAlien) {
      drawAlienPerson(ctx, iso.x, iso.y, this.colors, this.frame, this.direction, scale, this.speciesId);
    } else {
      drawPixelPerson(ctx, iso.x, iso.y, this.colors, this.frame, this.direction, scale);
    }

    // 名字标签 — 自定义立绘（32×32 帧）比像素小人更高，名字需抬到立绘上方避免遮挡
    const nameLift = image ? (SPRITE_FRAME_SIZE.height + 4) * scale : 18 * scale;
    ctx.fillStyle = this.isAlien ? '#FFD700' : '#E8E6F0';
    ctx.font = `${Math.max(8, 9 * scale)}px "Noto Sans SC"`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.85;
    ctx.fillText(this.resident.name, iso.x, iso.y - nameLift);
    ctx.globalAlpha = 1;

    // 状态气泡
    if (this.bubbleIcon && this.bubbleTimer > 0) {
      this.renderBubble(ctx, iso.x, iso.y, scale);
    }
  }

  renderCustomSprite(ctx, x, y, scale, image) {
    const frameWidth = image.width / 3;
    const frameHeight = image.height / 4;
    const directionIndex = Math.max(0, DIRECTIONS.indexOf(this.direction));
    const sourceX = Math.min(2, this.frame) * frameWidth;
    const sourceY = directionIndex * frameHeight;
    const drawRect = getSpriteDrawRect(x, y, scale);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      sourceX, sourceY, frameWidth, frameHeight,
      drawRect.x, drawRect.y, drawRect.width, drawRect.height,
    );
    ctx.restore();
  }

  /**
   * 渲染状态气泡
   */
  renderBubble(ctx, x, y, scale) {
    const bx = x + 6 * scale;
    const by = y - 22 * scale;
    const bs = 8 * scale;

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(bx, by, bs, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bx - 2 * scale, by + bs * 0.7);
    ctx.lineTo(bx - 4 * scale, by + bs * 1.3);
    ctx.lineTo(bx + 1 * scale, by + bs * 0.8);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.font = `${Math.max(6, 7 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const icons = {
      heart: '♥',
      note: '♪',
      sweat: '•',
      angry: '!',
      star: '★',
    };
    ctx.fillText(icons[this.bubbleIcon] || '?', bx, by);
    ctx.textBaseline = 'alphabetic';
  }
}

/**
 * 居民精灵管理器 — 管理所有居民和游客精灵
 */
export class ResidentSpriteManager {
  constructor(textures = textureManager) {
    this.textures = textures;
    this.sprites = [];
    this.touristSprites = [];  // 外星游客精灵
    this.lastUpdate = performance.now();
  }

  /**
   * 初始化精灵
   */
  init() {
    const residents = gameState.state.residents;
    const map = gameState.state.map;
    const mapSize = gameState.state.mapSize || 32;

    this.sprites = residents.map((r, i) => {
      const sprite = new ResidentSprite(r, i, this.textures);
      sprite.initPosition(mapSize, map);
      return sprite;
    });
  }

  /**
   * 添加外星游客精灵
   */
  addTourist(tourist, speciesId) {
    const sprite = new ResidentSprite(tourist, 0, this.textures);
    sprite.isAlien = true;
    sprite.speciesId = speciesId;
    sprite.colors = ALIEN_COLORS[speciesId] || ALIEN_COLORS.squid;
    const map = gameState.state.map;
    const mapSize = gameState.state.mapSize || 32;
    sprite.initPosition(mapSize, map);
    this.touristSprites.push(sprite);
    return sprite;
  }

  /**
   * 移除过期的游客精灵
   */
  removeTourist(sprite) {
    const idx = this.touristSprites.indexOf(sprite);
    if (idx >= 0) this.touristSprites.splice(idx, 1);
  }

  /**
   * 更新所有精灵
   */
  update() {
    const now = performance.now();
    const dt = now - this.lastUpdate;
    this.lastUpdate = now;

    const map = gameState.state.map;
    if (!map) return;

    // 同步居民数据（新增居民时创建精灵）
    const residents = gameState.state.residents;
    while (this.sprites.length < residents.length) {
      const i = this.sprites.length;
      const sprite = new ResidentSprite(residents[i], i, this.textures);
      sprite.initPosition(gameState.state.mapSize || 32, map);
      this.sprites.push(sprite);
    }

    // 更新居民精灵
    for (const sprite of this.sprites) {
      sprite.update(dt, map);
    }

    // 更新游客精灵
    for (const sprite of this.touristSprites) {
      sprite.update(dt, map);
    }
  }

  /**
   * 渲染所有精灵
   */
  render(ctx, cameraZoom) {
    // 合并所有精灵并按y坐标排序（正确遮挡）
    const all = [...this.sprites, ...this.touristSprites];
    const sorted = all.sort((a, b) => a.gridY - b.gridY);
    for (const sprite of sorted) {
      sprite.render(ctx, cameraZoom);
    }
  }
}
