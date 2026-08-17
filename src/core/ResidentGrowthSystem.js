import { bus } from './EventBus.js';
import { gameState } from './GameState.js';

export const GROWTH_SKILLS = ['engineering', 'research', 'farming', 'social', 'survival'];
export const GROWTH_ATTRIBUTES = ['stamina', 'labor', 'exploration'];

const DEFAULT_GROWTH = {
  xp: 0,
  stamina: 10,
  labor: 10,
  exploration: 10,
  proficiency: {
    engineering: 0,
    research: 0,
    farming: 0,
    social: 0,
    survival: 0,
  },
  housingStage: 1,
  growthLog: [],
};

export function normalizeResidentGrowth(resident) {
  resident.xp = Number.isFinite(resident.xp) ? Math.max(0, resident.xp) : DEFAULT_GROWTH.xp;
  resident.stamina = Number.isFinite(resident.stamina) ? Math.max(1, resident.stamina) : DEFAULT_GROWTH.stamina;
  resident.labor = Number.isFinite(resident.labor) ? Math.max(1, resident.labor) : DEFAULT_GROWTH.labor;
  resident.exploration = Number.isFinite(resident.exploration) ? Math.max(1, resident.exploration) : DEFAULT_GROWTH.exploration;
  resident.proficiency = { ...DEFAULT_GROWTH.proficiency, ...(resident.proficiency || {}) };
  resident.housingStage = resident.housingStage === 2 || resident.housingStage === 3
    ? resident.housingStage
    : resident.level >= 7 ? 3 : resident.level >= 4 ? 2 : 1;
  resident.growthLog = Array.isArray(resident.growthLog) ? resident.growthLog : [];
  return resident;
}

export function normalizeAllResidents() {
  for (const resident of gameState.state.residents || []) normalizeResidentGrowth(resident);
}

export function xpToNextLevel(level) {
  return 100 + Math.max(0, level - 1) * 60;
}

export function getGrowthSummary(resident) {
  normalizeResidentGrowth(resident);
  return {
    level: resident.level || 1,
    xp: resident.xp,
    xpToNext: xpToNextLevel(resident.level || 1),
    stamina: resident.stamina,
    labor: resident.labor,
    exploration: resident.exploration,
    proficiency: { ...resident.proficiency },
    housingStage: resident.housingStage,
  };
}

export function addResidentExperience(resident, amount, skill = null, reason = '日常工作') {
  if (!resident || amount <= 0) return [];
  normalizeResidentGrowth(resident);
  const levels = [];
  resident.xp += amount;
  if (skill && GROWTH_SKILLS.includes(skill)) {
    resident.proficiency[skill] = Math.min(100, resident.proficiency[skill] + Math.max(1, Math.round(amount * 0.35)));
  }

  while (resident.xp >= xpToNextLevel(resident.level || 1)) {
    resident.xp -= xpToNextLevel(resident.level || 1);
    resident.level = (resident.level || 1) + 1;
    resident.stamina += 2;
    resident.labor += 2;
    resident.exploration += 1;
    for (const growthSkill of GROWTH_SKILLS) {
      resident.skills[growthSkill] = Math.min(10, (resident.skills[growthSkill] || 1) + (growthSkill === skill ? 1 : 0));
    }
    const stage = resident.level >= 7 ? 3 : resident.level >= 4 ? 2 : 1;
    if (stage > resident.housingStage) {
      resident.housingStage = stage;
      resident.growthLog.unshift(`住宅翻修阶段 ${stage} 已升级`);
      // 同步升级专属房屋
      if (resident.houseId) {
        const house = gameState.state.buildings.find((b) => b.id === resident.houseId);
        if (house) {
          house.level = stage;
          bus.emit('building:upgraded', { building: house });
        }
      }
      if (!resident.diary) resident.diary = [];
      const diaryText = stage === 3
        ? `第${gameState.state.day}天：我的住宅升级为豪华星际别墅！拥有了全景星空天窗与恒温浴缸！`
        : `第${gameState.state.day}天：居住舱完成扩建翻新，终于有了宽敞的独立工作台与柔软沙发！`;
      resident.diary.push(diaryText);
      bus.emit('resident:housing-upgraded', { resident, stage });
    }
    levels.push(resident.level);
  }

  if (levels.length) {
    resident.growthLog.unshift(`因${reason}成长：${levels.map((level) => `${level}级`).join('、')}`);
    resident.growthLog = resident.growthLog.slice(0, 8);
    gameState.addNotification({
      title: '居民成长',
      text: `${resident.name} ${levels.map((level) => `达到 ${level}级`).join('，')}`,
      type: 'success',
      icon: 'trending-up',
    });
    bus.emit('resident:level-up', { resident, levels });
  }
  bus.emit('resident:growth', { resident, amount, skill, reason });
  return levels;
}

export function updateResidentGrowth() {
  normalizeAllResidents();
  const buildings = gameState.state.buildings.filter((building) => building.built);
  const hasProduction = buildings.some((building) => building.buildingId === 'workshop');
  const hasResearch = buildings.some((building) => ['lab', 'observatory', 'quantum_lab', 'xeno_lab'].includes(building.buildingId));
  const hasFood = buildings.some((building) => ['hydro_farm', 'protein_vat', 'greenhouse', 'algae_reactor'].includes(building.buildingId));

  for (const resident of gameState.state.residents) {
    const skill = resident.skills || {};
    if (hasProduction && (skill.engineering || 0) >= Math.max(skill.research || 0, skill.farming || 0)) {
      addResidentExperience(resident, 3, 'engineering', '维护生产设施');
    } else if (hasResearch && (skill.research || 0) >= (skill.farming || 0)) {
      addResidentExperience(resident, 3, 'research', '参与科研记录');
    } else if (hasFood) {
      addResidentExperience(resident, 3, 'farming', '照料生态设施');
    } else {
      addResidentExperience(resident, 1, 'social', '参与殖民地日常');
    }
  }
}
