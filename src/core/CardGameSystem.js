/**
 * 星尘殖民地 — 探索卡牌小游戏
 * 居民技能映射为技能卡，探索遭遇挑战时玩家选卡应对轮次。
 * 核心规则本地确定，AI 只生成叙事文本。
 * 无永久失败：全败只是少拿奖励。
 */
import { gameState } from './GameState.js';
import { bus } from './EventBus.js';
import { BALANCE } from '../data/balance.js';
import { aiClient } from '../ai/AIClient.js';
import { clamp } from './utils.js';
import { GENERAL_CARDS, getGeneralCardById, getCardsUnlockedByTech, getDroppableCards } from '../data/cards.js';
import { sound } from './SoundSystem.js';

/** 技能类型（含中文标签和图标） */
const SKILL_TYPES = [
  { type: 'combat',     label: '战斗',   icon: 'swords' },
  { type: 'engineering', label: '工程',   icon: 'wrench' },
  { type: 'research',   label: '研究',   icon: 'flask-conical' },
  { type: 'farming',    label: '农耕',   icon: 'sprout' },
  { type: 'survival',   label: '生存',   icon: 'tent' },
  { type: 'social',     label: '社交',   icon: 'users' },
];

export function getCardTypeIcon(type) {
  return SKILL_TYPES.find((s) => s.type === type)?.icon || 'sparkles';
}

export function getCardTypeLabel(type) {
  return SKILL_TYPES.find((s) => s.type === type)?.label || type;
}

export function getAllSkillTypes() {
  return SKILL_TYPES.map((s) => s.type);
}

/** 为一组居民生成技能卡牌 */
export function generateResidentCards(residentIds) {
  const residents = residentIds
    .map((id) => gameState.state.residents.find((r) => r.id === id))
    .filter(Boolean);
  const cards = [];

  for (const r of residents) {
    const skills = r.skills || {};
    const prof = r.proficiency || {};
    for (const { type, label, icon } of SKILL_TYPES) {
      const value = skills[type] || 0;
      if (value < 3) continue; // 技能太低不生成卡牌
      cards.push({
        id: `card_${r.id}_${type}`,
        type,
        value,
        residentName: r.name,
        residentId: r.id,
        label,
        icon,
        special: (prof[type] || 0) >= 3,
      });
    }
  }

  // 每人最多 4 张（按技能值排序取前 4）
  const byResident = new Map();
  for (const c of cards) {
    const list = byResident.get(c.residentId) || [];
    list.push(c);
    byResident.set(c.residentId, list);
  }
  const filtered = [];
  for (const list of byResident.values()) {
    list.sort((a, b) => b.value - a.value);
    filtered.push(...list.slice(0, 4));
  }
  return filtered;
}

/** 生成卡牌挑战（本地数值，AI 叙事异步替换） */
export function generateChallenge(tileType, avgExploration = 10) {
  const cfg = BALANCE.cardGame || {};
  const roundsMin = cfg.roundsMin ?? 2;
  const roundsMax = cfg.roundsMax ?? 3;

  const roundCount = roundsMin + Math.floor(Math.random() * (roundsMax - roundsMin + 1));
  const availableTypes = getAllSkillTypes();
  const rounds = [];
  for (let i = 0; i < roundCount; i++) {
    const type = Math.random() < 0.3 ? 'any' : availableTypes[Math.floor(Math.random() * availableTypes.length)];
    // 任意类型可出任意牌（最多 3 张），门槛更高；具体类型牌池小，门槛更低
    const reqMin = type === 'any' ? (cfg.anyValueMin ?? 12) : (cfg.requiredValueMin ?? 8);
    const reqMax = type === 'any' ? (cfg.anyValueMax ?? 16) : (cfg.requiredValueMax ?? 12);
    // 难度基于平均探索力微调，探索力越高需求越容易
    const difficultyOffset = clamp((avgExploration - 10) * 0.4, -3, 3);
    let required = Math.floor(reqMin + Math.random() * (reqMax - reqMin + 1)) - difficultyOffset;
    required = clamp(required, reqMin, reqMax);
    rounds.push({ type, required, label: type === 'any' ? '任意' : getCardTypeLabel(type) });
  }

  return {
    title: `${tileType}遭遇`,
    narrative: `探索队在${tileType}遇到了意外状况，需要居民们各展所长。`,
    rounds,
    tileType,
  };
}

/** 掷探索骰：d6 映射为运气值（-2 ~ +2），为判定加入运气成分 */
export function rollExplorationDie() {
  const luck = BALANCE.cardGame?.dice?.luck || [-2, -1, 0, 0, 1, 2];
  const index = Math.floor(Math.random() * luck.length);
  return { roll: index + 1, luck: luck[index] };
}

/** 获取当前解锁的所有通用卡牌实例（供手牌或牌库展示） */
export function getUnlockedGeneralCards(state = gameState.state) {
  const ids = state.cards?.unlocked || [];
  return ids.map((id) => getGeneralCardById(id, state)).filter(Boolean).map((c) => ({
    id: `unlocked_${c.id}`,
    cardId: c.id,
    type: c.type,
    value: c.value,
    residentName: c.generated ? '外星遗物' : '殖民地资产',
    label: c.name,
    icon: c.icon,
    special: false,
    isGeneral: true,
    desc: c.desc,
    flavor: c.flavor,
    generated: Boolean(c.generated),
  }));
}

/** 解锁一张通用卡牌；若已有则返回 false */
export function unlockGeneralCard(cardId, state = gameState.state, cardData = null) {
  if (!state.cards) state.cards = { unlocked: [], dynamicCards: [] };
  if (!state.cards.dynamicCards) state.cards.dynamicCards = [];
  if (cardData && !state.cards.dynamicCards.some((c) => c.id === cardData.id)) {
    state.cards.dynamicCards.push(cardData);
  }
  if (state.cards.unlocked.includes(cardId)) return false;
  const card = cardData || getGeneralCardById(cardId, state);
  if (!card) return false;
  state.cards.unlocked.push(cardId);
  sound.play('tech');
  bus.emit('card:unlocked', { cardId, card });
  gameState.addNotification({
    title: '解锁新卡牌！',
    text: `获得${card.generated ? '未知遗物' : '通用技能'}卡牌【${card.name}】（${getCardTypeLabel(card.type)} ${card.value}）`,
    type: 'success',
    icon: card.icon || 'sparkles',
  });
  return true;
}

/** 科技完成时自动解锁关联卡牌 */
export function handleTechCardUnlock(techId, state = gameState.state) {
  const cards = getCardsUnlockedByTech(techId);
  const unlocked = [];
  for (const c of cards) {
    if (unlockGeneralCard(c.id, state)) unlocked.push(c);
  }
  return unlocked;
}

/** 判定单轮：选中卡牌数值求和（专精卡牌额外+1点） + 探索骰运气 ≥ 门槛即过关 */
export function evaluateRound(selectedCards, requirement, diceLuck = 0) {
  let sum = 0;
  let specialBonus = 0;
  if (Array.isArray(selectedCards) && selectedCards.length) {
    const matched = requirement.type === 'any'
      ? selectedCards
      : selectedCards.filter((c) => c.type === requirement.type);
    for (const c of matched) {
      sum += c.value;
      if (c.special) specialBonus += 1; // 专精出牌时额外贡献 +1
    }
  }
  const total = sum + specialBonus + diceLuck;
  return {
    passed: total >= requirement.required,
    total,
    sum,
    specialBonus,
    diceLuck,
    required: requirement.required,
  };
}

/** 计算最终奖励（调用方负责实际发放） */
export function calculateRewards(wonRounds, totalRounds, tileType) {
  const cfg = BALANCE.cardGame || {};
  const allWon = wonRounds === totalRounds;
  const someWon = wonRounds > 0;
  return { allWon, someWon, wonRounds, totalRounds, bonusMultiplier: allWon ? (cfg.bonusMultiplier ?? 1.5) : 1 };
}

// ===== AI 叙事（异步，不阻塞游戏） =====
const CHALLENGE_FALLBACKS = [
  { title: '裂隙塌方', narrative: '前方地面突然塌陷，露出了一道深不见底的裂隙。' },
  { title: '异星生物', narrative: '一只体型庞大的异星生物挡住了去路，发出低沉的警告声。' },
  { title: '设备故障', narrative: '探测设备突然失灵，周围的环境数据全部变成了乱码。' },
  { title: '沙暴来袭', narrative: '一阵突如其来的沙暴将队伍困在了一处岩壁下。' },
  { title: '能量异常', narrative: '前方区域检测到强烈的能量波动，空气中弥漫着静电。' },
];

export async function generateChallengeNarrative(challenge) {
  const fallback = CHALLENGE_FALLBACKS[Math.floor(Math.random() * CHALLENGE_FALLBACKS.length)];
  try {
    const raw = await aiClient.generate(
      'challenge_proposal',
      { tileType: challenge.tileType, rounds: challenge.rounds.length },
      () => fallback,
      { cache: false },
    );
    if (raw && raw.title && raw.narrative) {
      challenge.title = raw.title;
      challenge.narrative = raw.narrative;
      if (Array.isArray(raw.obstacles)) {
        for (let i = 0; i < Math.min(challenge.rounds.length, raw.obstacles.length); i++) {
          if (raw.obstacles[i].label) {
            challenge.rounds[i].aiLabel = raw.obstacles[i].label;
          }
        }
      }
    }
  } catch {
    // AI 不可用时保持本地降级
  }
  return challenge;
}