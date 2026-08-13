export const BALANCE = Object.freeze({
  buildingOutputRate: 0.15,
  foodPerResidentPerDay: 0.3,
  construction: Object.freeze({ buildTimeDays: 10 }),
  production: Object.freeze({ durationMultiplier: 1 }),
  growth: Object.freeze({ experienceMultiplier: 1 }),
  tourism: Object.freeze({ incomeMultiplier: 1, minimumArrivalDays: 5, baseArrivalDays: 20 }),
  events: Object.freeze({ dailyChance: 0.015 }),
  mapExpansion: Object.freeze({ stripDepth: 3, costMultiplier: 0.5 }),
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
});
