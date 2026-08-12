export const BALANCE = Object.freeze({
  buildingOutputRate: 0.15,
  foodPerResidentPerDay: 0.3,
  construction: Object.freeze({ buildTimeDays: 10 }),
  production: Object.freeze({ durationMultiplier: 1 }),
  growth: Object.freeze({ experienceMultiplier: 1 }),
  tourism: Object.freeze({ incomeMultiplier: 1, minimumArrivalDays: 5, baseArrivalDays: 20 }),
  events: Object.freeze({ dailyChance: 0.015 }),
  mapExpansion: Object.freeze({ stripDepth: 3, costMultiplier: 0.5 }),
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
