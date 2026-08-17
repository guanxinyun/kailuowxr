import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { getBuildingOperationalState, getBuildingLevel } from './BuildingSystem.js';
import { getProductionSummary } from './ProductionSystem.js';
import { getComboSummary } from './ComboSystem.js';
import { getGrowthSummary } from './ResidentGrowthSystem.js';

const clampScore = (value) => Math.max(0, Math.min(10, Math.round(value * 10) / 10));

function scoreLabel(score, low, high) {
  if (score >= 8) return high;
  if (score >= 5) return '稳步发展';
  return low;
}

export function calculateAnnualReview() {
  const state = gameState.state;
  const operational = state.buildings.filter(building => getBuildingOperationalState(building).operational);
  const production = getProductionSummary();
  const combos = getComboSummary();
  const residents = state.residents.map(getGrowthSummary);

  const foodBuildings = operational.filter(b => getBuildingById(b.buildingId)?.effect?.food);
  const researchBuildings = operational.filter(b => getBuildingById(b.buildingId)?.effect?.research);
  const cultureBuildings = operational.filter(b => getBuildingById(b.buildingId)?.effect?.tourism || getBuildingById(b.buildingId)?.effect?.happiness);
  const natureGravity = operational.reduce((sum, b) => sum + (getBuildingById(b.buildingId)?.gravity?.nature || 0), 0);
  const avgLevel = operational.length ? operational.reduce((sum, b) => sum + getBuildingLevel(b), 0) / operational.length : 0;
  const avgResidentLevel = residents.length ? residents.reduce((sum, r) => sum + r.level, 0) / residents.length : 0;
  const avgExploration = residents.length ? residents.reduce((sum, r) => sum + r.exploration, 0) / residents.length : 0;
  const diplomacyAverage = Object.values(state.diplomacy).reduce((sum, item) => sum + item.reputation, 0) / Object.keys(state.diplomacy).length;
  const productQuantity = Object.values(production.inventory).reduce((sum, entry) => sum + entry.quantity, 0);

  const scores = {
    food: clampScore(state.resources.food / 45 + foodBuildings.length * 1.8),
    knowledge: clampScore(state.resources.research / 30 + researchBuildings.length * 1.7 + state.researchedTechs.length * 0.8),
    comfort: clampScore(state.happiness / 15 + avgResidentLevel * 0.45),
    adventure: clampScore(state.exploredRegions.length * 1.5 + avgExploration / 3 + diplomacyAverage / 35),
    culture: clampScore(cultureBuildings.length * 1.7 + diplomacyAverage / 22 + combos.active.length * 0.7),
    nature: clampScore(natureGravity / 4 + foodBuildings.length * 0.8),
  };

  const average = Object.values(scores).reduce((sum, score) => sum + score, 0) / 6;
  const grade = average >= 9 ? 'S' : average >= 7.5 ? 'A' : average >= 6 ? 'B' : average >= 4 ? 'C' : 'D';
  // 全银河系5000个殖民地排位体系
  const baseRank = Math.max(120, Math.round(4800 - (state.year - 1) * 600 - average * 380));
  const previousRank = state.annualReview?.rank || Math.min(5000, baseRank + 400 + Math.floor(Math.random() * 200));
  const rank = Math.max(1, Math.min(5000, baseRank));
  const rankDelta = previousRank - rank;
  const strongest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  // 幽默开罗式年度特色奖项库
  const FUN_AWARD_POOL = [
    { cond: production.completed >= 3 || productQuantity >= 4, name: '🏆 全银河草莓味软糖与零件高产地' },
    { cond: scores.food >= 7.5, name: '🏆 宇宙级干饭示范模范区' },
    { cond: scores.culture >= 7.0 || diplomacyAverage >= 35, name: '🏆 最佳章鱼星人发呆与度假胜地' },
    { cond: combos.discovered.length >= 2, name: '🏆 银河美学城市规划金奖' },
    { cond: avgResidentLevel >= 4, name: '🏆 年度最任劳任怨挥镐先锋奖' },
    { cond: state.resources.energy <= 5, name: '🏆 宇宙级低碳（常年断电）典范奖' },
    { cond: state.happiness >= 80, name: '🏆 每天都在傻乐的乐天派殖民地' },
    { cond: state.exploredRegions.length >= 2, name: '🏆 特种兵式荒野大镖客探险队' },
  ];

  const awards = FUN_AWARD_POOL.filter((a) => a.cond).map((a) => a.name);
  if (!awards.length) awards.push('🏆 坚韧不拔又熬过一年的勇敢奖');

  const review = {
    year: state.year,
    rank,
    rankDelta,
    grade,
    scores,
    average: Math.round(average * 10),
    comments: {
      food: scoreLabel(scores.food, '需要更多储备', '供应充足'),
      knowledge: scoreLabel(scores.knowledge, '科研基础较少', '知识繁荣'),
      comfort: scoreLabel(scores.comfort, '关注居民心情', '安居乐业'),
      adventure: scoreLabel(scores.adventure, '世界仍待认识', '见闻广博'),
      culture: scoreLabel(scores.culture, '文化设施尚少', '交流活跃'),
      nature: scoreLabel(scores.nature, '生态投入不足', '自然共生'),
    },
    awards,
    strongest: strongest[0],
    facts: {
      operationalBuildings: operational.length,
      averageFacilityLevel: Math.round(avgLevel * 10) / 10,
      averageResidentLevel: Math.round(avgResidentLevel * 10) / 10,
      productsCompleted: production.completed,
      activeCombos: combos.active.length,
      diplomacyAverage: Math.round(diplomacyAverage),
    },
  };

  state.annualReview = review;
  return review;
}
