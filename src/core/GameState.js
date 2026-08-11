/**
 * 星尘殖民地 — 游戏状态管理
 * Single source of truth for all game data
 */
import { bus } from './EventBus.js';
import { INITIAL_RESIDENTS } from '../data/residents.js';
import { SEASONS } from '../data/gamedata.js';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const DEFAULT_STATE = {
  // 时间
  day: 1,
  season: 0,       // 0-3
  year: 1,
  speed: 1,        // 0=暂停, 1=正常, 2=快速, 3=极速
  paused: false,

  // 资源
  resources: {
    metal: 100,
    crystal: 10,
    energy: 50,
    food: 80,
    research: 0,
    credits: 50,
  },
  storage: {
    metal: 500,
    crystal: 100,
    energy: 200,
    food: 300,
    research: Infinity,
    credits: Infinity,
  },

  // 人口
  population: 3,
  maxPopulation: 4,
  happiness: 68,

  // 建筑
  buildings: [],       // { id, buildingId, x, y, built: bool, progress: 0-1 }
  placingBuilding: null,

  // 科技
  researchedTechs: [],
  currentResearch: null,   // { techId, progress: 0-1 }

  // 居民
  residents: deepClone(INITIAL_RESIDENTS),

  // 外交
  diplomacy: {
    squid:   { reputation: 15, contacted: false },
    crystal: { reputation: 10, contacted: false },
    mecha:   { reputation: 5,  contacted: false },
    flora:   { reputation: 20, contacted: false },
  },

  // 地图
  map: null,           // 2D array of tile types
  mapSize: 32,
  camera: { x: 0, y: 0, zoom: 1 },

  // 引力热力图
  gravityOverlay: null, // null or dimension key

  // 探索
  exploredRegions: [],
  activeExploration: null,

  // 统计
  stats: {
    totalBuildings: 0,
    totalResearch: 0,
    totalFood: 0,
    daysPlayed: 0,
    eventsTriggered: 0,
  },

  // 通知队列
  notifications: [],

  // 年终评比
  annualReview: null,
};

class GameState {
  constructor() {
    this._state = deepClone(DEFAULT_STATE);
    this._history = [];
  }

  get state() {
    return this._state;
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  }

  set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((obj, key) => obj[key], this._state);
    const old = target[last];
    target[last] = value;
    bus.emit('state:change', { path, value, old });
    bus.emit(`state:${path}`, { value, old });
  }

  update(path, fn) {
    const current = this.get(path);
    this.set(path, fn(current));
  }

  addResource(type, amount) {
    const current = this._state.resources[type];
    const max = this._state.storage[type];
    const newVal = Math.min(Math.max(0, current + amount), max);
    this._state.resources[type] = newVal;
    bus.emit('resource:change', { type, value: newVal, delta: amount });
  }

  canAfford(costs) {
    for (const [type, amount] of Object.entries(costs)) {
      if ((this._state.resources[type] || 0) < amount) return false;
    }
    return true;
  }

  spend(costs) {
    if (!this.canAfford(costs)) return false;
    for (const [type, amount] of Object.entries(costs)) {
      this.addResource(type, -amount);
    }
    return true;
  }

  addBuilding(building) {
    this._state.buildings.push(building);
    this._state.stats.totalBuildings++;
    bus.emit('building:placed', building);
  }

  addNotification(notification) {
    const n = { id: Date.now() + Math.random(), time: this._state.day, ...notification };
    this._state.notifications.push(n);
    bus.emit('notification:new', n);
    return n;
  }

  getCurrentSeason() {
    return SEASONS[this._state.season];
  }

  getSeasonName() {
    return SEASONS[this._state.season].name;
  }

  advanceDay() {
    this._state.day++;
    this._state.stats.daysPlayed++;

    // Season change every 30 days
    if (this._state.day % 30 === 0) {
      this._state.season = (this._state.season + 1) % 4;
      bus.emit('season:change', this.getCurrentSeason());

      // Year change every 120 days (4 seasons)
      if (this._state.season === 0) {
        this._state.year++;
        bus.emit('year:change', this._state.year);
      }
    }

    bus.emit('day:advance', { day: this._state.day, season: this._state.season });
  }

  reset() {
    this._state = deepClone(DEFAULT_STATE);
    bus.emit('state:reset');
  }

  serialize() {
    return JSON.stringify(this._state);
  }

  deserialize(json) {
    try {
      this._state = JSON.parse(json);
      bus.emit('state:loaded');
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }
}

export const gameState = new GameState();
