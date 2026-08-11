/**
 * 星尘殖民地 — 主入口
 * Initializes all systems and wires up the UI
 */
import { bus } from './core/EventBus.js';
import { gameState } from './core/GameState.js';
import { CanvasRenderer } from './core/CanvasRenderer.js';
import { ui } from './core/UIManager.js';
import { aiAdvisor } from './core/AIAdvisor.js';
import { $, $$, lucideIcon, formatNumber } from './core/utils.js';
import { generateMap } from './core/MapGenerator.js';
import { RESOURCES, GRAVITY_CONFIG, SEASONS } from './data/gamedata.js';
import { BUILDINGS, getBuildingById } from './data/buildings.js';
import { openBuildPanel } from './panels/BuildPanel.js';
import { openTechPanel } from './panels/TechPanel.js';
import { openDiplomacyPanel } from './panels/DiplomacyPanel.js';
import { openResidentPanel } from './panels/ResidentPanel.js';
import { openAnnualPanel } from './panels/AnnualPanel.js';
import { triggerRandomEvent } from './panels/EventModal.js';
import { openExplorePanel, openStatsPanel, openSettingsPanel } from './panels/UtilityPanels.js';
import { TutorialManager } from './core/TutorialManager.js';
import { updateTouristSystem } from './core/TouristManager.js';
import { RESIDENT_NAME_POOL, TRAIT_POOL } from './data/residents.js';

// ===== Initialize =====
function init() {
  // Generate map
  const map = generateMap(32, Math.floor(Math.random() * 10000));
  gameState.set('map', map);

  // Setup UI components
  setupTopBar();
  setupToolPanel();
  setupSpeedControls();
  setupBottomBar();

  // Setup canvas
  const container = $('#canvas-container');
  const renderer = new CanvasRenderer(container);
  renderer.centerOnMap();
  renderer.start();

  // Game loop
  let lastTick = performance.now();
  const TICK_INTERVAL = 2000; // 2 seconds per game tick at speed 1 (开罗风格节奏)

  function gameLoop(now) {
    const speed = gameState.state.speed;
    if (speed > 0 && !gameState.state.paused) {
      const elapsed = now - lastTick;
      const interval = TICK_INTERVAL / speed;
      if (elapsed >= interval) {
        lastTick = now;
        gameTick();
      }
    } else {
      lastTick = now;
    }
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);

  // Building placement
  bus.on('building:place', ({ building: buildingId, tile }) => {
    const data = getBuildingById(buildingId);
    if (!data) return;
    if (!gameState.canAfford(data.cost)) {
      gameState.addNotification({ title: '资源不足', text: `建造${data.name}所需资源不足`, type: 'warning', icon: 'alert-triangle' });
      return;
    }

    gameState.spend(data.cost);
    gameState.addBuilding({
      id: `bld_${Date.now()}`,
      buildingId,
      x: tile.x,
      y: tile.y,
      built: false,
      progress: 0,
    });
    tile.building = buildingId;

    // Update gravity field
    for (const [dim, val] of Object.entries(data.gravity)) {
      updateGravityField(tile.x, tile.y, dim, val);
    }

    gameState.set('placingBuilding', null);
    gameState.addNotification({ title: '开始建造', text: `${data.name} 建造中...`, type: 'success', icon: 'hammer' });
    renderer.markDirty();
  });

  // AI tip display
  bus.on('ai:tip', (tip) => {
    ui.setBottomMessage(`[AI] ${tip}`);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      case 'b': case 'B': openBuildPanel(); break;
      case 't': case 'T': openTechPanel(); break;
      case 'd': case 'D': openDiplomacyPanel(); break;
      case 'r': case 'R': openResidentPanel(); break;
      case 'e': case 'E': openExplorePanel(); break;
      case 'Escape':
        gameState.set('placingBuilding', null);
        break;
      case ' ':
        e.preventDefault();
        gameState.set('speed', gameState.state.speed === 0 ? 1 : 0);
        break;
      case '1': gameState.set('speed', 1); break;
      case '2': gameState.set('speed', 2); break;
      case '3': gameState.set('speed', 3); break;
    }
  });

  // Welcome notification
  setTimeout(() => {
    gameState.addNotification({
      title: '着陆成功',
      text: '殖民飞船已安全着陆。开始建设你的星尘殖民地吧！',
      type: 'success',
      icon: 'sparkles',
      duration: 5000,
    });
  }, 500);

  // 启动教程（如果未完成）
  if (!localStorage.getItem('stardust_tutorial_done')) {
    setTimeout(() => {
      const tutorial = new TutorialManager();
      tutorial.start();
    }, 1500);
  }

  // AI welcome tip
  setTimeout(() => {
    aiAdvisor.getContextualTip().then((tip) => {
      ui.setBottomMessage(`[AI] ${tip}`);
    });
  }, 2000);

  // Update resource display
  ui.updateResourceDisplay();
}

// ===== Game Tick =====
function gameTick() {
  gameState.advanceDay();

  // 当前季节效果
  const season = SEASONS[gameState.state.season];
  const seasonFoodMult = season.effect?.food || 1;
  const seasonEnergyMult = season.effect?.energy || 1;

  // ===== 居民技能加成计算 =====
  const residents = gameState.state.residents;
  let avgEngineering = 0, avgResearch = 0, avgFarming = 0;
  let avgCombat = 0, avgSocial = 0, avgSurvival = 0;
  if (residents.length > 0) {
    for (const r of residents) {
      avgEngineering += (r.skills?.engineering || 1);
      avgResearch    += (r.skills?.research || 1);
      avgFarming     += (r.skills?.farming || 1);
      avgCombat      += (r.skills?.combat || 1);
      avgSocial      += (r.skills?.social || 1);
      avgSurvival    += (r.skills?.survival || 1);
    }
    avgEngineering /= residents.length;
    avgResearch    /= residents.length;
    avgFarming     /= residents.length;
    avgCombat      /= residents.length;
    avgSocial      /= residents.length;
    avgSurvival    /= residents.length;
  }
  // 技能加成：基础值1.0，每点技能+5%（技能范围1-10）
  const skillBuildBonus    = 1 + (avgEngineering - 1) * 0.05; // 工程技能加速建造
  const skillFarmBonus     = 1 + (avgFarming - 1) * 0.05;     // 农业技能加速食物产出
  const skillResearchBonus = 1 + (avgResearch - 1) * 0.05;    // 研究技能加速科研
  const skillDefenseBonus  = 1 + (avgCombat - 1) * 0.05;      // 战斗技能加强防御
  const skillHappyBonus    = 1 + (avgSocial - 1) * 0.03;      // 社交技能提升幸福度

  // 全局效率加成
  const globalEff = gameState.state.globalEfficiency || 0;
  const farmBonus = gameState.state.farmBonus || 1;
  const researchBonus = gameState.state.researchBonus || 1;
  const buildBonus = gameState.state.buildBonus || 1;

  // 建筑存储上限
  let storageBonus = 0;
  let totalDefense = 0;
  let totalHappiness = 0;
  let totalTourism = 0;
  let totalIncome = 0;

  // Resource production from buildings
  for (const building of gameState.state.buildings) {
    if (!building.built) {
      // Construction progress (buildTime=2 → 20天建好，速度1约40秒)
      // 工程技能加速建造
      const data = getBuildingById(building.buildingId);
      building.progress += (1 / (data.buildTime * 10)) * buildBonus * skillBuildBonus;
      if (building.progress >= 1) {
        building.built = true;
        building.progress = 1;
        gameState.addNotification({
          title: '建造完成',
          text: `${data.name} 已建造完成！`,
          type: 'success',
          icon: 'check',
        });
        // Apply instant-on-build effects
        if (data.effect.population) {
          gameState.set('maxPopulation', gameState.state.maxPopulation + data.effect.population);
        }
      }
      continue; // 未建完不产出
    }

    // 建成建筑的生产
    const data = getBuildingById(building.buildingId);
    if (!data || !data.effect) continue;

    const eff = 1 + globalEff;
    const prodRate = 0.15; // 基础产出倍率

    // 食物生产（受季节、农场加成和农业技能影响）
    if (data.effect.food) {
      gameState.addResource('food', data.effect.food * prodRate * seasonFoodMult * farmBonus * skillFarmBonus * eff);
    }
    // 能源生产（受季节影响）
    if (data.effect.energy) {
      gameState.addResource('energy', data.effect.energy * prodRate * seasonEnergyMult * eff);
    }
    // 研究点生产（受研究加成和研究技能影响）
    if (data.effect.research) {
      gameState.addResource('research', data.effect.research * prodRate * researchBonus * skillResearchBonus * eff);
    }
    // 氧气
    if (data.effect.oxygen) {
      // 氧气暂无独立资源，折算为能量
      gameState.addResource('energy', data.effect.oxygen * 0.08);
    }
    // 星币收入（贸易站等）
    if (data.effect.income) {
      totalIncome += data.effect.income * prodRate * eff;
    }
    // 贸易解锁（trade_hub 产生持续收入）
    if (data.effect.trade) {
      totalIncome += 2 * prodRate * eff;
    }

    // 收集非即时效果（在下面统一处理）
    if (data.effect.happiness) totalHappiness += data.effect.happiness * 0.01;
    if (data.effect.defense) totalDefense += data.effect.defense;
    if (data.effect.tourism) totalTourism += data.effect.tourism;
    if (data.effect.storageBonus) storageBonus += data.effect.storageBonus;
    if (data.effect.globalEfficiency) {
      // AI核心等全局效率已在初始化时处理，这里跳过
    }
  }

  // 应用存储上限
  if (storageBonus > 0) {
    const currentStorage = gameState.state.storage;
    if (!gameState.state._storageApplied) {
      gameState.state._storageApplied = true;
      for (const res of ['metal', 'crystal', 'energy', 'food']) {
        currentStorage[res] = (currentStorage[res] || 0) + storageBonus;
      }
    }
  }

  // 星币收入结算
  if (totalIncome > 0) {
    gameState.addResource('credits', totalIncome);
  }

  // 幸福度变化（建筑加成 - 消耗 - 季节影响 + 社交技能加成）
  const happinessDelta = totalHappiness * skillHappyBonus - 0.1 + (season.effect?.comfort || 0) * 0.01;
  const newHappiness = Math.max(0, Math.min(100, gameState.state.happiness + happinessDelta));
  if (Math.abs(newHappiness - gameState.state.happiness) > 0.5) {
    gameState.set('happiness', Math.round(newHappiness));
  }

  // Food consumption
  const foodConsumption = gameState.state.population * 0.3;
  gameState.addResource('food', -foodConsumption);

  // 如果食物耗尽，幸福度下降
  if (gameState.state.resources.food <= 0) {
    gameState.set('happiness', Math.max(0, gameState.state.happiness - 1));
    if (gameState.state.day % 5 === 0) {
      gameState.addNotification({
        title: '食物短缺！',
        text: '殖民地食物储备耗尽，居民幸福度下降。请尽快建造农场！',
        type: 'warning',
        icon: 'alert-triangle',
      });
    }
  }

  // Research progress (fixed: use flat rate, not exponential)
  if (gameState.state.currentResearch) {
    const cr = gameState.state.currentResearch;
    const techData = gameState.state.researchedTechs; // 已研究列表
    // 研究速度 = 研究点产出率（不是存量）的固定比例
    const labBuildings = gameState.state.buildings.filter(b =>
      b.built && getBuildingById(b.buildingId)?.effect?.research
    );
    let researchRate = 0;
    for (const lb of labBuildings) {
      const d = getBuildingById(lb.buildingId);
      researchRate += d.effect.research * 0.002 * researchBonus * skillResearchBonus;
    }
    cr.progress += researchRate;
    if (cr.progress >= 1) {
      gameState.state.researchedTechs.push(cr.techId);
      gameState.addNotification({
        title: '研究完成',
        text: `科技研究完成！`,
        type: 'research',
        icon: 'flask-conical',
      });
      gameState.set('currentResearch', null);
    }
  }

  // 人口增长（幸福度高 + 有空余住房 + 食物充足）
  const state = gameState.state;
  if (state.population < state.maxPopulation &&
      state.happiness >= 60 &&
      state.resources.food > 20 &&
      state.day % 10 === 0) {
    if (Math.random() < 0.4) {
      growPopulation();
    }
  }

  // 外星游客系统
  updateTouristSystem();

  // Random events (1.5% chance per day)
  if (Math.random() < 0.015 && gameState.state.day > 5) {
    triggerRandomEvent();
  }

  // AI periodic tips (every ~30 days)
  if (gameState.state.day % 30 === 15) {
    aiAdvisor.getContextualTip().then((tip) => {
      bus.emit('ai:tip', tip);
    });
  }

  // Generate AI diary entries for residents (every ~20 days)
  if (gameState.state.day % 20 === 0) {
    const residents = gameState.state.residents;
    const randomResident = residents[Math.floor(Math.random() * residents.length)];
    if (randomResident) {
      aiAdvisor.generateDiary(randomResident).then((diaryText) => {
        const entry = `第${gameState.state.day}天：${diaryText}`;
        randomResident.diary.push(entry);
        if (randomResident.diary.length > 10) {
          randomResident.diary.shift();
        }
      });
    }
  }

  // Annual review
  if (gameState.state.day % 120 === 0) {
    bus.emit('year:review');
  }

  // Update UI
  ui.updateResourceDisplay();
}

/**
 * 人口增长 - 生成新居民
 */
function growPopulation() {
  const state = gameState.state;
  const name = RESIDENT_NAME_POOL[Math.floor(Math.random() * RESIDENT_NAME_POOL.length)];
  const traits = [];
  const traitCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < traitCount; i++) {
    const t = TRAIT_POOL[Math.floor(Math.random() * TRAIT_POOL.length)];
    if (!traits.includes(t)) traits.push(t);
  }

  const newResident = {
    id: `res_${String(state.residents.length + 1).padStart(3, '0')}`,
    name,
    title: '殖民者',
    icon: 'user',
    level: 1,
    traits,
    gravityPreference: {
      food: 3 + Math.floor(Math.random() * 5),
      knowledge: 2 + Math.floor(Math.random() * 5),
      comfort: 3 + Math.floor(Math.random() * 4),
      adventure: 2 + Math.floor(Math.random() * 5),
      culture: 2 + Math.floor(Math.random() * 4),
      nature: 2 + Math.floor(Math.random() * 5),
    },
    skills: {
      engineering: 1 + Math.floor(Math.random() * 4),
      research: 1 + Math.floor(Math.random() * 4),
      farming: 1 + Math.floor(Math.random() * 4),
      combat: 1 + Math.floor(Math.random() * 4),
      social: 1 + Math.floor(Math.random() * 4),
      survival: 1 + Math.floor(Math.random() * 4),
    },
    mood: state.happiness,
    diary: [`第${state.day}天：我来到了星尘殖民地，这里将是我的新家。`],
  };

  state.residents.push(newResident);
  state.population = state.residents.length;
  bus.emit('state:population', { value: state.population });

  gameState.addNotification({
    title: '新居民加入！',
    text: `${name} 加入了殖民地。人口：${state.population}/${state.maxPopulation}`,
    type: 'success',
    icon: 'user-plus',
    duration: 4000,
  });
}

// ===== Setup Functions =====
function setupTopBar() {
  const container = $('#topbar-resources');
  if (!container) return;

  const resourceOrder = ['metal', 'crystal', 'energy', 'food', 'research', 'credits'];
  for (const key of resourceOrder) {
    const res = RESOURCES[key];
    const badge = document.createElement('div');
    badge.className = 'resource-badge';
    badge.innerHTML = '';
    badge.appendChild(lucideIcon(res.icon, 14));
    const val = document.createElement('span');
    val.className = 'resource-value';
    val.dataset.resource = key;
    val.textContent = formatNumber(gameState.state.resources[key]);
    badge.appendChild(val);
    container.appendChild(badge);
  }

  // Logo icon
  const logoIcon = $('#logo-icon');
  if (logoIcon) logoIcon.appendChild(lucideIcon('sparkles', 18));

  // Population icon
  const popIcon = $('#pop-icon');
  if (popIcon) popIcon.appendChild(lucideIcon('users', 14));

  // Season
  const seasonEl = $('#season-indicator');
  if (seasonEl) {
    const s = SEASONS[gameState.state.season];
    seasonEl.textContent = s.name;
    seasonEl.style.color = s.color;
  }
}

function setupToolPanel() {
  const container = $('#tool-buttons');
  if (!container) return;

  const tools = [
    { id: 'build',     icon: 'hammer',         label: '建造 (B)',    action: openBuildPanel },
    { id: 'tech',      icon: 'flask-conical',   label: '科技 (T)',    action: openTechPanel },
    { id: 'diplomacy', icon: 'globe',           label: '外交 (D)',    action: openDiplomacyPanel },
    { id: 'residents', icon: 'users',           label: '居民 (R)',    action: openResidentPanel },
    { id: 'explore',   icon: 'compass',         label: '探索 (E)',    action: openExplorePanel },
    { id: 'stats',     icon: 'bar-chart-3',     label: '统计',       action: openStatsPanel },
    { id: 'settings',  icon: 'settings',        label: '设置',       action: openSettingsPanel },
  ];

  for (const tool of tools) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.dataset.tool = tool.id;
    btn.appendChild(lucideIcon(tool.icon, 20));

    const label = document.createElement('span');
    label.className = 'tool-btn-label';
    label.textContent = tool.label;
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      $$('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tool.action();
    });

    container.appendChild(btn);
  }

  // Gravity toggles
  const gravityContainer = $('#gravity-toggles');
  if (!gravityContainer) return;

  for (const [dim, cfg] of Object.entries(GRAVITY_CONFIG)) {
    const toggle = document.createElement('button');
    toggle.className = `gravity-toggle ${dim}`;
    toggle.title = cfg.name;
    toggle.appendChild(lucideIcon(cfg.icon, 13));

    toggle.addEventListener('click', () => {
      const current = gameState.state.gravityOverlay;
      if (current === dim) {
        gameState.set('gravityOverlay', null);
        toggle.classList.remove('active');
      } else {
        $$('.gravity-toggle').forEach(t => t.classList.remove('active'));
        gameState.set('gravityOverlay', dim);
        toggle.classList.add('active');
      }
    });

    gravityContainer.appendChild(toggle);
  }
}

function setupSpeedControls() {
  const icons = { 0: 'pause', 1: 'play', 2: 'fast-forward', 3: 'skip-forward' };
  for (const [speed, iconName] of Object.entries(icons)) {
    const btn = $(`.speed-btn[data-speed="${speed}"]`);
    if (btn) {
      btn.appendChild(lucideIcon(iconName, 14));
      btn.addEventListener('click', () => {
        gameState.set('speed', parseInt(speed));
        $$('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }
  }
}

function setupBottomBar() {
  const icon = $('#bottom-icon');
  if (icon) icon.appendChild(lucideIcon('radio', 12));

  // 教程按钮（底部栏右侧）
  const bottomBar = $('#bottombar');
  if (bottomBar) {
    const tutBtn = document.createElement('button');
    tutBtn.className = 'tool-btn';
    tutBtn.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);padding:4px 10px;font-size:11px;gap:4px;';
    tutBtn.title = '新手教程';
    tutBtn.appendChild(lucideIcon('book-open', 14));
    const label = document.createElement('span');
    label.textContent = '教程';
    label.style.fontSize = '11px';
    tutBtn.appendChild(label);
    tutBtn.addEventListener('click', () => {
      localStorage.removeItem('stardust_tutorial_done');
      const tutorial = new TutorialManager();
      tutorial.start();
    });
    bottomBar.appendChild(tutBtn);
  }

  // Year review listener
  bus.on('year:review', () => {
    openAnnualPanel();
  });
}

function updateGravityField(cx, cy, dim, value) {
  const map = gameState.state.map;
  if (!map) return;
  const radius = 4;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const ty = cy + dy;
      const tx = cx + dx;
      if (ty < 0 || ty >= map.length || tx < 0 || tx >= map[0].length) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const falloff = 1 - (dist / radius);
      map[ty][tx].gravityField[dim] += value * falloff;
    }
  }
}

// ===== Boot =====
document.addEventListener('DOMContentLoaded', init);
