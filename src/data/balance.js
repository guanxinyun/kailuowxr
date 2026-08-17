export const BALANCE = Object.freeze({
  buildingOutputRate: 0.15,
  foodPerResidentPerDay: 0.3,
  construction: Object.freeze({ buildTimeDays: 10 }),
  production: Object.freeze({ durationMultiplier: 1 }),
  growth: Object.freeze({ experienceMultiplier: 1 }),
  tourism: Object.freeze({ incomeMultiplier: 1, minimumArrivalDays: 5, baseArrivalDays: 20 }),
  events: Object.freeze({ dailyChance: 0.015, aiGeneratedChance: 0.3 }),
  mapExpansion: Object.freeze({ stripDepth: 3, costMultiplier: 0.5 }),
  blockExploration: Object.freeze({
    blockSize: 4,
    baseDays: 7,          // 基础探索天数，每多派 1 人 -1 天
    costCredits: 50,      // 每次派遣的星币成本
    eventCount: 2,        // 进度条上的随机事件数量
    goodChanceBase: 0.55, // 好事基础概率（受居民平均探索力微调）
  }),
  inventory: Object.freeze({ maxPerItem: 50 }), // 加工品/特殊道具单类储备上限
  trade: Object.freeze({
    terrainCostMultiplier: 1.8,       // 特殊地形建造成本倍率
    terrainCredits: 30,               // 特殊地形建造星币成本
    mountainProducts: { alloy: 2 },   // 山地建造需要的加工品
    waterProducts: { crystal_circuit: 2 }, // 水域建造需要的加工品
    upgradeCreditsCost: Object.freeze({ 2: 30, 3: 80 }), // 升级星币成本
  }),
  aiTriggers: Object.freeze({
    proposalLimit: 3,
    buildingCooldownDays: 120,
    comboCooldownDays: 90,
    speciesCooldownDays: 240,
    shortageDays: 5,
    shortageCooldownDays: 30,
    shortageThresholds: Object.freeze({ food: 20, energy: 15, metal: 15 }),
  }),
  monthly: Object.freeze({
    monthDays: 30,        // 每月 = 30 天（对齐季节切换）
  }),
  maintenance: Object.freeze({
    // 每栋运营中建筑每月星币维护费（按类别）
    creditsByCategory: Object.freeze({
      basic: 4, food: 5, science: 8, culture: 6, military: 9, special: 12,
    }),
    // 高级类别建筑每月额外消耗的资源（按类别）
    resourceByCategory: Object.freeze({
      science: Object.freeze({ energy: 3 }),
      military: Object.freeze({ energy: 4 }),
      special: Object.freeze({ energy: 4, crystal: 1 }),
    }),
  }),
  // 每周工作节奏：工作 workDays 天、休息 weekDays-workDays 天
  workSchedule: Object.freeze({ weekDays: 7, workDays: 5 }),
  // 建筑独立储备上限：累计产出达到该值即「储备已满」，需仓储中心员工搬运入库
  buildingBuffer: Object.freeze({ capacity: 5 }),
  // 仓储搬运：每名搬运员工每天可搬运进全局库存的总单位
  logistics: Object.freeze({ haulPerDay: 12 }),
  // 探索卡牌小游戏
  cardGame: Object.freeze({
    challengeChance: 0.3,     // 探索事件转为卡牌挑战的概率
    roundsMin: 2,
    roundsMax: 3,
    requiredValueMin: 8,      // 具体类型求和门槛下限（可出同类型牌，牌池小）
    requiredValueMax: 12,     // 具体类型求和门槛上限
    anyValueMin: 12,          // 「任意」类型求和门槛下限（可出任意牌）
    anyValueMax: 16,          // 「任意」类型求和门槛上限
    maxCardsPerRound: 3,      // 每轮最多出牌数
    bonusMultiplier: 1.5,     // 全胜奖励倍率
    dice: Object.freeze({ luck: [-2, -1, 0, 0, 1, 2] }), // 探索骰运气分布（d6）
  }),
});
