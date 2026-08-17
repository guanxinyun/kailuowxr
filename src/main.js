/**
 * 星尘殖民地 — 主入口
 * Initializes all systems and wires up the UI
 */
import { bus } from './core/EventBus.js';
import { gameState } from './core/GameState.js';
import { CanvasRenderer } from './core/CanvasRenderer.js';
import { ui } from './core/UIManager.js';
import { aiAdvisor } from './core/AIAdvisor.js';
import { $, $$, createElement, lucideIcon, formatNumber } from './core/utils.js';
import { generateMap } from './core/MapGenerator.js';
import { RESOURCES, GRAVITY_CONFIG, SEASONS, TILE_TYPES } from './data/gamedata.js';
import { BUILDINGS, getBuildingById } from './data/buildings.js';
import { PRODUCTION_RECIPES, getQuality } from './data/production.js';
import { openBuildPanel } from './panels/BuildPanel.js';
import { openTechPanel } from './panels/TechPanel.js';
import { openDiplomacyPanel } from './panels/DiplomacyPanel.js';
import { openResidentPanel } from './panels/ResidentPanel.js';
import { openAnnualPanel } from './panels/AnnualPanel.js';
import { triggerRandomEvent } from './panels/EventModal.js';
import { openBlockDispatchModal, showBlockEventModal } from './panels/BlockExplorationPanel.js';
import { openDebugPanel } from './panels/DebugPanel.js';
import { openExplorePanel, openStatsPanel, openSettingsPanel } from './panels/UtilityPanels.js';
import { openProductionPanel } from './panels/ProductionPanel.js';
import { openBuildingManagementPanel } from './panels/BuildingManagementPanel.js';
import { openTourismPanel } from './panels/TourismPanel.js';
import { TutorialManager } from './core/TutorialManager.js';
import { updateTouristSystem } from './core/TouristManager.js';
import { updateProductionSystem, processAutoQueue, getInventoryEntry, addInventory, canStartProduction, startProduction, getAutoQueue, setAutoProduction, cancelAutoProduction, getProductionSummary } from './core/ProductionSystem.js';
import { textureManager } from './core/TextureManager.js';
import { getBuildingEfficiency, getBuildingOperationalState, getBuildingLevel, getUpgradeCost, upgradeBuilding, demolishBuilding, recalculatePopulationCapacity, assignWorkers } from './core/BuildingSystem.js';
import { evaluateCombos } from './core/ComboSystem.js';
import { updateTradeSystem, ensureTradeState } from './core/TradeSystem.js';
import { normalizeAllResidents, updateResidentGrowth } from './core/ResidentGrowthSystem.js';
import { normalizeExplorationState, updateExplorationSystem, unlockRegion } from './core/ExplorationSystem.js';
import { updateBlockExplorations } from './core/BlockExplorationSystem.js';
import { saveManager } from './core/SaveManager.js';
import { generateComboComment, handleAIContentMilestone, restoreDynamicContent, updateDynamicContent, runMonthlyComboCheck } from './core/DynamicContentSystem.js';
import { openAIContentPanel } from './panels/AIContentPanel.js';
import { BALANCE } from './data/balance.js';
import { sound } from './core/SoundSystem.js';
import { getCurrentDailyResourceFlow, getCurrentBuildingDailyOutput, formatDailyRate } from './core/ResourceFlowSystem.js';
import { updateWarehouseHauling } from './core/LogisticsSystem.js';
import { runMonthlyMaintenance } from './core/MaintenanceSystem.js';
import { showMonthlyBriefing } from './panels/MonthlyBriefingPanel.js';
import { buildMonthlyBriefingFacts } from './core/AIContentFacts.js';
import { updateBuildingWorkCycle, getBuildingBufferStatus } from './core/WorkerScheduleSystem.js';
import { handleTechCardUnlock } from './core/CardGameSystem.js';

// ===== Initialize =====
async function init() {
  await textureManager.init();
  const loadedSave = saveManager.loadActive();
  if (!loadedSave) {
    const map = generateMap(32, Math.floor(Math.random() * 10000));
    gameState.set('map', map);
    const center = Math.floor(32 / 2);
    const landingPad = { id: 'bld_landing', buildingId: 'landing_pad', x: center, y: center, built: true, progress: 1 };
    gameState.addBuilding(landingPad);
    map[center][center].building = 'landing_pad';

    // 开局自带：3 间住宅 + 一段连接通道（居民/游客只走道路）
    const startingBuildings = [
      { id: 'bld_habitat_1', buildingId: 'habitat', x: 14, y: 16 },
      { id: 'bld_habitat_2', buildingId: 'habitat', x: 15, y: 16 },
      { id: 'bld_habitat_3', buildingId: 'habitat', x: 17, y: 16 },
      { id: 'bld_road_1', buildingId: 'road', x: 14, y: 15 },
      { id: 'bld_road_2', buildingId: 'road', x: 15, y: 15 },
      { id: 'bld_road_3', buildingId: 'road', x: 16, y: 15 },
      { id: 'bld_road_4', buildingId: 'road', x: 17, y: 15 },
      { id: 'bld_road_5', buildingId: 'road', x: 18, y: 15 },
    ];
    for (const b of startingBuildings) {
      gameState.addBuilding({ ...b, built: true, progress: 1 });
      map[b.y][b.x].building = b.buildingId;
    }
  }
  normalizeAllResidents();
  normalizeExplorationState();
  ensureTradeState();
  restoreDynamicContent();
  recalculatePopulationCapacity();
  assignWorkers();

  // 事件解锁探索区域
  bus.on('event:resolved', ({ event }) => {
    if (event.unlockRegion) unlockRegion(event.unlockRegion);
  });

  // 区块探索进度条上的随机事件 → 弹出结果（本地掷骰效果 + AI 叙事）
  bus.on('explore:block-event', ({ outcome }) => {
    showBlockEventModal(outcome);
  });

  // 点击待探索区块 → 派遣弹窗
  bus.on('explore:block-click', ({ bx, by }) => {
    openBlockDispatchModal(bx, by);
  });

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

    // 计算总建造成本（基础 + 地形额外）
    const tileInfo = TILE_TYPES[tile.type];
    const isSpecialTerrain = !tileInfo.buildable && tileInfo.techUnlock;
    let totalCost = { ...data.cost };

    if (isSpecialTerrain) {
      // 特殊地形：基础成本 ×1.8 + 星币
      const terrainMult = BALANCE.trade.terrainCostMultiplier;
      for (const key of Object.keys(totalCost)) {
        totalCost[key] = Math.ceil(totalCost[key] * terrainMult);
      }
      totalCost.credits = (totalCost.credits || 0) + BALANCE.trade.terrainCredits;

      // 检查加工品需求
      const requiredProducts = tile.type === 'mountain'
        ? BALANCE.trade.mountainProducts
        : BALANCE.trade.waterProducts;
      for (const [pid, qty] of Object.entries(requiredProducts)) {
        const inv = getInventoryEntry(pid);
        if (!inv || inv.quantity < qty) {
          const recipeName = pid === 'alloy' ? '星尘合金' : '晶体电路';
          gameState.addNotification({ title: '材料不足', text: `在${tileInfo.name}上建造需要 ${qty} ${recipeName}`, type: 'warning', icon: 'alert-triangle' });
          return;
        }
      }
    }

    if (!gameState.canAfford(totalCost)) {
      gameState.addNotification({ title: '资源不足', text: `建造${data.name}所需资源不足`, type: 'warning', icon: 'alert-triangle' });
      return;
    }

    // 扣除资源
    gameState.spend(totalCost);

    // 扣除加工品
    if (isSpecialTerrain) {
      const requiredProducts = tile.type === 'mountain'
        ? BALANCE.trade.mountainProducts
        : BALANCE.trade.waterProducts;
      for (const [pid, qty] of Object.entries(requiredProducts)) {
        addInventory(pid, -qty);
      }
    }

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

    // 连续铺设：放置后保持放置模式，资源不足时自动退出
    if (!gameState.canAfford(data.cost)) {
      gameState.set('placingBuilding', null);
    }
    const terrainNote = isSpecialTerrain ? `（${tileInfo.name}地形）` : '';
    gameState.addNotification({ title: '开始建造', text: `${data.name}${terrainNote} 建造中...`, type: 'success', icon: 'hammer' });
    sound.play('build');
    renderer.markDirty();
  });

  // Building demolished — reverse gravity field
  bus.on('building:demolished', ({ building: removed, data }) => {
    if (data?.gravity) {
      for (const [dim, val] of Object.entries(data.gravity)) {
        updateGravityField(removed.x, removed.y, dim, -val);
      }
    }
    renderer.markDirty();
  });

  // AI tip display
  bus.on('ai:tip', (tip) => {
    ui.setBottomMessage(`[AI] ${tip}`);
  });
  bus.on('combo:discovered', ({ combo }) => {
    if (!gameState.state.aiContent.enabled) return;
    generateComboComment(combo.buildingIds).then(comment => ui.setBottomMessage(`[组合评价] ${comment}`));
    handleAIContentMilestone('combo', combo.id, `围绕首次发现的${combo.name}提出新组合`);
  });
  bus.on('map:revealed', ({ biome }) => handleAIContentMilestone('biome', biome, `生成适合${biome}生态区的设施`));
  bus.on('diplomacy:tier', ({ species, tier }) => handleAIContentMilestone('diplomacy', `${species}:${tier.level}`, '根据新外交阶段生成和平交流内容'));
  bus.on('tech:completed', ({ techId }) => {
    sound.play('tech');
    handleTechCardUnlock(techId);
    handleAIContentMilestone('technology', techId, '根据刚完成的科技生成相关设施');
  });
  bus.on('ai:shortage', ({ resource }) => aiAdvisor.getContextualTip().then(tip => ui.setBottomMessage(`[资源提醒] ${tip}`)));

  // Tile click — open building info side panel
  bus.on('tile:click', (tile) => {
    if (!tile.building) {
      ui.closeSidePanel();
      return;
    }
    const building = gameState.state.buildings.find(
      (b) => b.x === tile.x && b.y === tile.y,
    );
    if (!building) return;
    openBuildingInfoPanel(building);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    // 隐藏调试入口：Ctrl+Shift+D 打开 AI 事件调试面板（调制模式）
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      openDebugPanel();
      return;
    }
    switch (e.key) {
      case 'b': case 'B': openBuildPanel(); break;
      case 't': case 'T': openTechPanel(); break;
      case 'd': case 'D': openDiplomacyPanel(); break;
      case 'r': case 'R': openResidentPanel(); break;
      case 'e': case 'E': openExplorePanel(); break;
      case 'p': case 'P': openProductionPanel(); break;
      case 'm': case 'M': openBuildingManagementPanel(); break;
      case 'v': case 'V': openTourismPanel(); break;
      case 'a': case 'A': openAIContentPanel(); break;
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

  evaluateCombos();
  updateTradeSystem();
  updateResidentGrowth();
  updateExplorationSystem();
  updateBlockExplorations();
  updateDynamicContent();

  // 当前季节效果
  const season = SEASONS[gameState.state.season];
  // ===== 居民技能加成计算 =====
  const residents = gameState.state.residents;
  let avgEngineering = 0, avgResearch = 0, avgFarming = 0;
  let avgSocial = 0;
  if (residents.length > 0) {
    for (const r of residents) {
      avgEngineering += (r.skills?.engineering || 1);
      avgResearch    += (r.skills?.research || 1);
      avgFarming     += (r.skills?.farming || 1);
      avgSocial      += (r.skills?.social || 1);
    }
    avgEngineering /= residents.length;
    avgResearch    /= residents.length;
    avgFarming     /= residents.length;
    avgSocial      /= residents.length;
  }
  // 技能加成：基础值1.0，每点技能+5%（技能范围1-10）
  const skillBuildBonus    = 1 + (avgEngineering - 1) * 0.05; // 工程技能加速建造
  const skillResearchBonus = 1 + (avgResearch - 1) * 0.05;    // 研究技能加速科研
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

  // Resource production from buildings
  for (const building of gameState.state.buildings) {
    if (!building.built) {
      // Construction progress (buildTime=2 → 20天建好，速度1约40秒)
      // 工程技能加速建造
      const data = getBuildingById(building.buildingId);
      building.progress += (1 / (data.buildTime * BALANCE.construction.buildTimeDays)) * buildBonus * skillBuildBonus;
      if (building.progress >= 1) {
        building.built = true;
        building.progress = 1;
        gameState.addNotification({
          title: '建造完成',
          text: `${data.name} 已建造完成！`,
          type: 'success',
          icon: 'check',
        });
        // 建筑建成后：重算人口上限并重新分配居民工作
        recalculatePopulationCapacity();
        assignWorkers();
      }
      continue; // 未建完不产出
    }

    // 建成建筑的生产
    const data = getBuildingById(building.buildingId);
    if (!data || !data.effect) continue;
    if (!getBuildingOperationalState(building).operational) continue;

    // 收集非资源持续效果（资源流在循环后统一结算）
    if (data.effect.happiness) totalHappiness += data.effect.happiness * 0.01;
    if (data.effect.defense) totalDefense += data.effect.defense;
    if (data.effect.tourism) totalTourism += data.effect.tourism;
    if (data.effect.storageBonus) storageBonus += data.effect.storageBonus;
    if (data.effect.globalEfficiency) {
      // AI核心等全局效率已在初始化时处理，这里跳过
    }
  }

  // 地图资源地块被动产出（已探索的矿脉/晶矿地块每天少量产出）
  if (gameState.state.day % 3 === 0) { // 每3天结算一次
    const map = gameState.state.map;
    if (map) {
      let metalTiles = 0, crystalTiles = 0;
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[0].length; x++) {
          const tile = map[y][x];
          if (!tile.explored) continue;
          if (tile.type === 'metal') metalTiles++;
          if (tile.type === 'crystal') crystalTiles++;
        }
      }
      if (metalTiles > 0) {
        gameState.addResource('metal', metalTiles * 0.3 * skillBuildBonus);
      }
      if (crystalTiles > 0) {
        gameState.addResource('crystal', crystalTiles * 0.15 * skillBuildBonus);
      }
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

  // 每日资源流统一结算：
  // - 抽象资源（研究点/星币）直接入账；搬运类资源（金属/晶体/能量/食物）先进入各建筑储备
  const dailyFlow = getCurrentDailyResourceFlow();
  for (const [resource, amount] of Object.entries(dailyFlow.production)) {
    if ((resource === 'research' || resource === 'credits') && amount) {
      gameState.addResource(resource, amount);
    }
  }
  for (const [resource, amount] of Object.entries(dailyFlow.consumption)) {
    if (amount) gameState.addResource(resource, -amount);
  }

  // 居民工作节奏：产出累计进各建筑储备，储备满则停滞（休息日自动跳过）
  updateBuildingWorkCycle();

  // 仓储搬运：仓储中心/搬运站的居民把周边建筑储备搬进全局库存
  updateWarehouseHauling();

  // 幸福度变化（建筑加成 - 消耗 - 季节影响 + 社交技能加成）
  const happinessDelta = totalHappiness * skillHappyBonus - 0.1 + (season.effect?.comfort || 0) * 0.01;
  const newHappiness = Math.max(0, Math.min(100, gameState.state.happiness + happinessDelta));
  if (Math.abs(newHappiness - gameState.state.happiness) > 0.5) {
    gameState.set('happiness', Math.round(newHappiness));
  }

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
      bus.emit('tech:completed', { techId: cr.techId });
      gameState.addNotification({
        title: '研究完成',
        text: `科技研究完成！`,
        type: 'research',
        icon: 'flask-conical',
      });
      gameState.set('currentResearch', null);
    }
  }

  // 生产加工系统
  updateProductionSystem();
  processAutoQueue();

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

  // ===== 月度结算：维护费 + 星尘月报 =====
  if (gameState.state.day % BALANCE.monthly.monthDays === 0) {
    const maintenance = runMonthlyMaintenance();
    if (maintenance.summary.credits > 0) {
      gameState.addNotification({
        title: '月度维护',
        text: `本月 ${maintenance.summary.buildings} 栋设施维护，扣除 ${maintenance.summary.credits} 星币`,
        type: 'info',
        icon: 'wrench',
      });
    }
    const facts = buildMonthlyBriefingFacts(gameState.state);
    showMonthlyBriefing(facts);

    // 月度组合自动检查（AI 根据已建成设施提出并采纳布局组合）
    runMonthlyComboCheck();
  }

  // Update UI
  ui.updateResourceDisplay();
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
    badge.title = res.name; // 鼠标悬停显示资源名称
    badge.innerHTML = '';
    badge.appendChild(lucideIcon(res.icon, 14));
    // 添加资源名称标签
    const nameSpan = document.createElement('span');
    nameSpan.className = 'resource-name';
    nameSpan.textContent = res.name;
    nameSpan.style.cssText = 'font-size:10px;opacity:0.7;margin-right:2px;';
    badge.appendChild(nameSpan);
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
    { id: 'production', icon: 'factory',        label: '物资 (P)',    action: openProductionPanel },
    { id: 'manage',    icon: 'building-2',      label: '设施 (M)',    action: openBuildingManagementPanel },
    { id: 'tourism',   icon: 'map-pinned',      label: '旅游 (V)',    action: openTourismPanel },
    { id: 'ai-content', icon: 'sparkles',       label: 'AI工坊 (A)',  action: openAIContentPanel },
    { id: 'stats',     icon: 'bar-chart-3',      label: '统计',       action: openStatsPanel },
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

// ===== Building Info Side Panel =====
const CATEGORY_NAMES = {
  basic: '基础', food: '食物', science: '科研',
  culture: '文化', military: '防御', special: '特殊',
};

/** 资源/加工品的中文标签（优先取全局资源名，再取配方名） */
function resourceLabel(id) {
  if (RESOURCES[id]?.name) return RESOURCES[id].name;
  const recipe = PRODUCTION_RECIPES.find((r) => r.id === id);
  return recipe?.output?.name || recipe?.name || id;
}

/** 综合工坊的加工配置子页：配方 + 本工坊自动生产 + 全局队列 */
function renderWorkshopSection(panel, building) {
  const section = createElement('div', { className: 'building-info-section' });
  section.appendChild(createElement('h4', {}, ['加工配置']));

  const blueprints = gameState.state.blueprints?.products || [];
  const autoQueue = getAutoQueue();
  const summary = getProductionSummary();

  for (const recipe of PRODUCTION_RECIPES) {
    const blueprintLocked = recipe.requiresBlueprint && !blueprints.includes(recipe.id);
    const validation = blueprintLocked ? { ok: false, reason: '需要从探索中获得加工品图纸' } : canStartProduction(recipe.id);
    const inputsText = Object.entries(recipe.inputs)
      .map(([id, amount]) => `${resourceLabel(id)} ${amount}`).join(' + ');

    const row = createElement('div', { className: 'building-info-auto-row' });
    row.appendChild(createElement('div', { className: 'building-info-auto-detail' }, [
      createElement('strong', {}, [recipe.name]),
      createElement('div', {}, [
        blueprintLocked ? '需要从探索中获得加工品图纸' : `${inputsText} → ${recipe.output.name} ×${recipe.output.quantity}`,
      ]),
    ]));

    // 手动开始
    const startBtn = createElement('button', {
      className: `btn btn-sm btn-primary ${validation.ok ? '' : 'is-blocked'}`,
      title: validation.ok ? '开始加工' : validation.reason,
    }, [lucideIcon('play', 12), document.createTextNode(' 开始')]);
    startBtn.addEventListener('click', () => {
      const result = startProduction(recipe.id);
      if (!result.ok) {
        gameState.addNotification({ title: '无法开始加工', text: result.reason, type: 'warning', icon: 'alert-triangle' });
      }
      openBuildingInfoPanel(building); // 刷新面板
    });
    row.appendChild(startBtn);
    section.appendChild(row);

    // 自动生产（绑定到本工坊，另起一行，避免挤占配方信息）
    if (!blueprintLocked) {
      const autoRow = createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingLeft: '8px', marginTop: '2px' },
      });
      const autoEntry = autoQueue.find((e) => e.recipeId === recipe.id && e.buildingId === building.id);
      if (autoEntry) {
        const label = autoEntry.mode === 'continuous' ? '持续生产中' : `自动：剩余 ${autoEntry.remaining} 个`;
        autoRow.appendChild(createElement('span', { className: 'auto-status active' }, [label]));
        const cancelBtn = createElement('button', { className: 'btn btn-sm btn-danger' }, ['取消']);
        cancelBtn.addEventListener('click', () => {
          cancelAutoProduction(recipe.id, building.id);
          openBuildingInfoPanel(building);
        });
        autoRow.appendChild(cancelBtn);
      } else {
        const countInput = createElement('input', { type: 'number', min: '1', max: '99', value: '5', className: 'auto-count-input' });
        const countBtn = createElement('button', { className: 'btn btn-sm' }, ['产N个']);
        countBtn.addEventListener('click', () => {
          setAutoProduction(recipe.id, 'count', parseInt(countInput.value) || 5, building.id);
          openBuildingInfoPanel(building);
        });
        const contBtn = createElement('button', { className: 'btn btn-sm' }, ['持续']);
        contBtn.addEventListener('click', () => {
          setAutoProduction(recipe.id, 'continuous', 1, building.id);
          openBuildingInfoPanel(building);
        });
        autoRow.appendChild(countInput);
        autoRow.appendChild(countBtn);
        autoRow.appendChild(contBtn);
      }
      section.appendChild(autoRow);
    }
  }

  // 生产队列（全局，最多 3）
  section.appendChild(createElement('div', { className: 'building-info-output-row' }, [
    lucideIcon('list', 12),
    document.createTextNode(` 生产队列 ${summary.queue.length}/3`),
  ]));
  for (const job of summary.queue) {
    const progress = Math.max(0, Math.min(100, ((job.totalDays - job.remainingDays) / job.totalDays) * 100));
    section.appendChild(createElement('div', { className: 'production-job' }, [
      createElement('div', { className: 'production-job-header' }, [
        createElement('strong', {}, [job.recipe?.name || job.recipeId]),
        createElement('span', {}, [`还需 ${Math.ceil(job.remainingDays)} 天`]),
      ]),
      createElement('div', { className: 'production-progress' }, [
        createElement('span', { style: { width: `${progress}%` } }),
      ]),
    ]));
  }

  panel.appendChild(section);
}

function openBuildingInfoPanel(building) {
  const data = getBuildingById(building.buildingId);
  if (!data) return;

  const level = getBuildingLevel(building);
  const efficiency = getBuildingEfficiency(building);
  const opState = getBuildingOperationalState(building);
  const upgradeCost = getUpgradeCost(building);

  const panel = createElement('div', { className: 'building-info-panel' });

  // 关闭按钮
  const closeBtn = createElement('button', {
    className: 'building-info-close',
    title: '关闭',
  }, [lucideIcon('x', 16)]);
  closeBtn.addEventListener('click', () => ui.closeSidePanel());
  panel.appendChild(closeBtn);

  // 标题区
  const header = createElement('div', { className: 'building-info-header' });
  header.appendChild(createElement('div', { className: 'building-info-icon' }, [lucideIcon(data.icon, 28)]));
  const titleBlock = createElement('div', { className: 'building-info-title' });
  titleBlock.appendChild(createElement('h3', {}, [data.name]));
  titleBlock.appendChild(createElement('span', { className: 'building-info-cat' }, [
    `${CATEGORY_NAMES[data.category] || data.category} · ${level}级`,
  ]));
  header.appendChild(titleBlock);
  panel.appendChild(header);

  // 状态
  const statusClass = opState.operational ? 'online' : 'offline';
  const statusText = !building.built ? `建造中 ${Math.floor(building.progress * 100)}%`
    : opState.operational ? '运行中' : opState.reason;
  const statusEl = createElement('div', { className: `building-info-status ${statusClass}` }, [
    lucideIcon(opState.operational ? 'check' : 'alert-triangle', 14),
    document.createTextNode(` ${statusText}`),
  ]);
  panel.appendChild(statusEl);

  // 坐标与效率
  panel.appendChild(createElement('div', { className: 'building-info-meta' }, [
    `坐标 (${building.x}, ${building.y}) · 效率 ${Math.round(efficiency * 100)}%`,
  ]));

  // 描述
  if (data.desc) {
    panel.appendChild(createElement('p', { className: 'building-info-desc' }, [data.desc]));
  }

  // 产出
  if (building.built) {
    const dailyOutput = getCurrentBuildingDailyOutput(building);
    const outputEntries = Object.entries(dailyOutput).filter(([, v]) => v !== 0);
    if (outputEntries.length) {
      const outputSection = createElement('div', { className: 'building-info-section' });
      outputSection.appendChild(createElement('h4', {}, ['每日产出']));
      for (const [resource, amount] of outputEntries) {
        const res = RESOURCES[resource];
        const sign = amount >= 0 ? '+' : '';
        outputSection.appendChild(createElement('div', { className: 'building-info-output-row' }, [
          lucideIcon(res?.icon || 'circle-dot', 14),
          document.createTextNode(` ${res?.name || resource} ${sign}${formatDailyRate(amount)}/天`),
        ]));
      }
      panel.appendChild(outputSection);
    }
  }

  // 引力效果
  const gravityEntries = Object.entries(data.gravity || {}).filter(([, v]) => v !== 0);
  if (gravityEntries.length) {
    const gravSection = createElement('div', { className: 'building-info-section' });
    gravSection.appendChild(createElement('h4', {}, ['引力场']));
    for (const [dim, val] of gravityEntries) {
      const sign = val > 0 ? '+' : '';
      gravSection.appendChild(createElement('div', { className: 'building-info-output-row' }, [
        `${dim} ${sign}${val}`,
      ]));
    }
    panel.appendChild(gravSection);
  }

  // 建筑储备：生产建筑展示各自储备上限与当前占用
  const producesHaulable = ['metal', 'crystal', 'energy', 'food'].some((k) => (data.effect?.[k] || 0) > 0);
  if (building.built && producesHaulable) {
    const buffer = getBuildingBufferStatus(building);
    const bufferSection = createElement('div', { className: 'building-info-section' });
    bufferSection.appendChild(createElement('h4', {}, ['储备']));
    bufferSection.appendChild(createElement('div', { className: 'building-info-output-row' }, [
      lucideIcon('box', 14),
      document.createTextNode(` ${buffer.total}/${buffer.capacity}${buffer.full ? ' · 已满，需搬运' : ''}`),
    ]));
    panel.appendChild(bufferSection);
  }

  // 综合工坊：加工配置（选择配方与自动生产都放在建筑自己的子页里）
  if (building.built && building.buildingId === 'workshop') {
    renderWorkshopSection(panel, building);
  }

  // 按钮区
  const actions = createElement('div', { className: 'building-info-actions' });

  // 升级按钮
  if (upgradeCost && building.built) {
    const costText = Object.entries(upgradeCost)
      .map(([resource, amount]) => `${RESOURCES[resource]?.name || resource} ${formatNumber(amount)}`)
      .join(' · ');
    const canAfford = gameState.canAfford(upgradeCost);
    const upgradeBtn = createElement('button', {
      className: 'btn btn-primary',
      disabled: !opState.operational || !canAfford,
      title: `升级消耗：${costText}`,
    }, [lucideIcon('arrow-up-circle', 14), document.createTextNode(` 升级 (${costText})`)]);
    upgradeBtn.addEventListener('click', () => {
      const result = upgradeBuilding(building.id);
      if (result.ok) {
        openBuildingInfoPanel(building); // 刷新面板
        renderer.markDirty();
      } else {
        gameState.addNotification({ title: '无法升级', text: result.reason, type: 'warning', icon: 'alert-triangle' });
      }
    });
    actions.appendChild(upgradeBtn);
  } else if (level >= 3 && building.buildingId !== 'landing_pad' && building.buildingId !== 'road') {
    actions.appendChild(createElement('span', { className: 'building-info-max' }, ['已满级']));
  }

  // 拆除按钮（降落点不可拆除）
  if (building.buildingId !== 'landing_pad') {
    const refundText = data.cost
      ? Object.entries(data.cost)
          .map(([resource, amount]) => `${RESOURCES[resource]?.name || resource} ${Math.floor(amount * 0.5)}`)
          .join(' · ')
      : '';
    const demolishBtn = createElement('button', {
      className: 'btn btn-danger',
      title: refundText ? `回收：${refundText}` : '拆除建筑',
    }, [lucideIcon('hammer', 14), document.createTextNode(' 拆除')]);
    demolishBtn.addEventListener('click', () => {
      ui.showConfirm({
        title: '确认拆除',
        text: `确定要拆除 ${data.name} 吗？${refundText ? `\n将回收：${refundText}` : ''}`,
        confirmText: '拆除',
        onConfirm: () => {
          const result = demolishBuilding(building.id);
          if (result.ok) {
            ui.closeSidePanel();
            renderer.markDirty();
          } else {
            gameState.addNotification({ title: '无法拆除', text: result.reason, type: 'warning', icon: 'alert-triangle' });
          }
        },
      });
    });
    actions.appendChild(demolishBtn);
  }

  panel.appendChild(actions);

  ui.openSidePanel(panel);
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
