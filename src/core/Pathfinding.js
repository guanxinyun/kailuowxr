/**
 * 星尘殖民地 — A* 寻路系统
 * 支持道路加速、地形障碍物检测
 */

/**
 * 判断地块是否可行走
 */
export function isWalkable(map, x, y) {
  if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return false;
  const tile = map[y][x];
  if (!tile.explored) return false;
  if (tile.type === 'water' || tile.type === 'mountain') return false;
  return true;
}

/**
 * 判断地块是否有道路
 */
export function hasRoad(map, x, y) {
  if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return false;
  return map[y][x].building === 'road';
}

/**
 * A* 寻路算法
 * @param {Array} map - 2D地图数组 map[y][x]
 * @param {number} sx - 起点x
 * @param {number} sy - 起点y
 * @param {number} ex - 终点x
 * @param {number} ey - 终点y
 * @returns {Array|null} 路径点数组 [{x,y},...] 或 null
 */
export function findPath(map, sx, sy, ex, ey) {
  // 边界检查
  if (!isWalkable(map, sx, sy) || !isWalkable(map, ex, ey)) return null;
  if (sx === ex && sy === ey) return [{ x: ex, y: ey }];

  const MAX_NODES = 500;
  const cols = map[0].length;

  // 用数字key加速查找
  const key = (x, y) => y * cols + x;

  const openSet = new Map(); // key -> node
  const closedSet = new Set();

  const startKey = key(sx, sy);
  openSet.set(startKey, {
    x: sx, y: sy,
    g: 0,
    h: heuristic(sx, sy, ex, ey),
    f: heuristic(sx, sy, ex, ey),
    parent: null,
  });

  // 四方向邻居
  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  let iterations = 0;

  while (openSet.size > 0) {
    if (++iterations > MAX_NODES) return null; // 防止卡死

    // 找f值最小的节点
    let bestKey = null;
    let bestF = Infinity;
    for (const [k, node] of openSet) {
      if (node.f < bestF) {
        bestF = node.f;
        bestKey = k;
      }
    }

    const current = openSet.get(bestKey);
    openSet.delete(bestKey);
    closedSet.add(bestKey);

    // 到达终点
    if (current.x === ex && current.y === ey) {
      return reconstructPath(current);
    }

    // 遍历邻居
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = key(nx, ny);

      if (closedSet.has(nk)) continue;
      if (!isWalkable(map, nx, ny)) continue;

      // 道路上移动成本更低
      const moveCost = hasRoad(map, nx, ny) ? 0.5 : 1.0;
      const tentativeG = current.g + moveCost;

      const existing = openSet.get(nk);
      if (existing && tentativeG >= existing.g) continue;

      openSet.set(nk, {
        x: nx, y: ny,
        g: tentativeG,
        h: heuristic(nx, ny, ex, ey),
        f: tentativeG + heuristic(nx, ny, ex, ey),
        parent: current,
      });
    }
  }

  return null; // 无路径
}

/**
 * 曼哈顿距离启发函数
 */
function heuristic(x1, y1, x2, y2) {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**
 * 从终点回溯重建路径
 */
function reconstructPath(node) {
  const path = [];
  let current = node;
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  // 去掉起点（居民已经在起点了）
  if (path.length > 1) path.shift();
  return path;
}

/**
 * 检查建筑是否通过道路连接到指挥部
 * 使用BFS从建筑位置搜索到任意有指挥部的位置
 */
export function isConnectedToHQ(map, buildings, bx, by) {
  // 找到指挥部位置（建筑列表中没有单独的HQ，初始地图中心就是）
  // 简化：检查是否能通过道路/建筑网络到达地图中心区域
  const mapSize = map.length;
  const center = Math.floor(mapSize / 2);

  // BFS搜索道路连通性
  const visited = new Set();
  const queue = [{ x: bx, y: by }];
  visited.add(key(bx, by));

  const cols = map[0].length;
  function key(x, y) { return y * cols + x; }

  const dirs = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const { x, y } = queue.shift();

    // 到达中心区域（指挥部附近）
    if (Math.abs(x - center) <= 1 && Math.abs(y - center) <= 1) return true;

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const nk = key(nx, ny);

      if (visited.has(nk)) continue;
      if (ny < 0 || ny >= mapSize || nx < 0 || nx >= map[0].length) continue;

      const tile = map[ny][nx];
      // 只能通过道路或有建筑的格子连通
      if (tile.building || tile.type === 'plains') {
        visited.add(nk);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return false;
}
