import { BALANCE } from '../data/balance.js';

export function buildProductFacts(recipe, quality = {}) {
  return { id: recipe.id, baseName: recipe.name, inputs: { ...recipe.inputs }, outputQuantity: recipe.output.quantity, days: recipe.days, quality: quality.grade || 'D' };
}

export function buildTouristFacts(tourist) {
  return { id: tourist.id, speciesName: tourist.speciesName, preference: { ...(tourist.preference || {}) }, visitedStops: [...(tourist.visitedStops || [])], satisfaction: Math.round(tourist.satisfaction || 0), spent: tourist.spent || 0 };
}

export function buildExplorationFacts(region, resident, phase) {
  return { phase, regionId: region.id, regionName: region.name, days: region.days || region.distance || 0, rewards: { ...(region.rewards || {}) }, residentName: resident.name };
}

export function buildBlockEventFacts(outcome) {
  return {
    residentNames: [...(outcome.residentNames || [])],
    tileName: outcome.tileName || '未知区域',
    good: !!outcome.good,
    effectText: outcome.effectText || '',
    bonusText: outcome.bonusText || '',
  };
}

export function buildDiaryFacts(resident, facts = []) {
  return { residentName: resident.name, mood: Math.round(resident.mood || 0), facts: facts.map(fact => ({ type: fact.type, text: fact.text })) };
}

export function buildAnnualFacts(review) {
  return { year: review.year, grade: review.grade, scores: { ...(review.scores || {}) }, awards: [...(review.awards || [])], strongest: review.strongest, facts: { ...(review.facts || {}) } };
}

export function getNarrationFallback(type, facts) {
  const text = {
    product_copy: `${facts.baseName || '这件产品'}完成了可靠加工，适合殖民地日常使用。`,
    tourist_personality: '这位游客温和而好奇，喜欢慢慢观察殖民地。',
    tourist_review: `这次旅程令人难忘，满意度约为${facts.satisfaction ?? 70}%。`,
    exploration_log: `${facts.residentName || '考察员'}记录了当地环境的和平生态现象。`,
    exploration_event: `${facts.residentNames?.[0] || '探索队'}在${facts.tileName || '未知区域'}${facts.good ? '有所收获' : '遇到了一点小波折'}：${facts.effectText || ''}${facts.bonusText ? `，${facts.bonusText}` : ''}。`,
    factual_diary: facts.facts?.[0]?.text ? `今天，${facts.facts[0].text}。` : '今天的殖民地依然平稳，我期待新的发现。',
    annual_summary: `第${facts.year || 1}年稳步结束，继续发挥优势并照顾资源净变化。`,
  };
  return text[type] || '殖民地记录已更新。';
}

/** 汇总本周期（自上次结算以来）的事件，供月度简报 AI 生成 */
export function buildMonthlyBriefingFacts(state) {
  const monthDays = BALANCE.monthly?.monthDays || 30;
  const sinceDay = Math.max(0, state.day - monthDays);
  const events = (state.eventLog || [])
    .filter((e) => e.day > sinceDay)
    .slice(-20)
    .map((e) => ({
      day: e.day,
      category: e.category,
      title: e.title,
      text: e.text,
      good: !!e.good,
    }));
  return {
    year: state.year,
    day: state.day,
    population: state.population,
    happiness: Math.round(state.happiness || 0),
    buildings: (state.buildings || []).filter((b) => b.built).length,
    resources: { ...(state.resources || {}) },
    events,
  };
}

/**
 * 月度简报本地降级：范文.txt「news」条目风格 —— 「弊誌」记者口吻 + 冷幽默。
 * 返回多段文本，用 \n\n 分隔。
 */
export function getMonthlyBriefingFallback(facts) {
  const events = facts.events || [];
  const good = events.filter((e) => e.good).length;
  const bad = events.filter((e) => !e.good).length;

  const openers = [
    `【星尘月报】第${facts.year}年，第${facts.day}天。弊誌记者仍在不眠不休地追踪${facts.population || 0}名殖民者的一举一动——当然，他们本人似乎并不知情。`,
    `【星尘月报】转眼又是 30 天。弊誌的记者蹲在降落点门口，终于等来了一位愿意开口的殖民者。以下是本月值得记录的大小事。`,
    `【星尘月报】第${facts.year}年，第${facts.day}天。编辑部照例派出一名记者潜入殖民地，结果照例被当场认出并请了出去。`,
  ];

  const headline = events[0]
    ? `本月最受瞩目的消息：${events[0].title}——${events[0].text}`
    : '本月风平浪静，弊誌记者一度以为自己要失业了。';

  const tally = (good + bad) > 0
    ? `本月共记录 ${good + bad} 起事件：${good} 起喜事、${bad} 起波折。${bad > good ? '编辑部决定本月不派记者出门，以免触霉头。' : '殖民地似乎正走在一条不错的上坡路上。'}`
    : '';

  const mood = `幸福度 ${facts.happiness}%，${facts.buildings || 0} 栋建筑在运营。${facts.happiness < 40 ? '弊誌建议给殖民者们放个假——当然，费用自理。' : facts.happiness > 70 ? '殖民者们笑得挺开心，记者却总觉得少了点什么。' : '日子过得中规中矩，编辑部也无话可说。'}`;

  return [openers[0], headline, tally, mood].filter(Boolean).join('\n\n');
}
