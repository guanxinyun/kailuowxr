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
  const previousRank = state.annualReview?.rank || 50;
  const rank = Math.max(1, Math.round(51 - average * 5));
  const rankDelta = previousRank - rank;
  const strongest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  const awards = [];
  if (production.completed >= 3 || productQuantity >= 3) awards.push('加工新星');
  if (combos.discovered.length >= 2) awards.push('布局发现家');
  if (avgResidentLevel >= 4) awards.push('居民成长伙伴');
  if (diplomacyAverage >= 30) awards.push('友好殖民地');
  if (!awards.length) awards.push('勇敢的又一年');

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
