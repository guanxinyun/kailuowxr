export function buildProductFacts(recipe, quality = {}) {
  return { id: recipe.id, baseName: recipe.name, inputs: { ...recipe.inputs }, outputQuantity: recipe.output.quantity, days: recipe.days, quality: quality.grade || 'D' };
}

export function buildTouristFacts(tourist) {
  return { id: tourist.id, speciesName: tourist.speciesName, preference: { ...(tourist.preference || {}) }, visitedStops: [...(tourist.visitedStops || [])], satisfaction: Math.round(tourist.satisfaction || 0), spent: tourist.spent || 0 };
}

export function buildExplorationFacts(region, resident, phase) {
  return { phase, regionId: region.id, regionName: region.name, days: region.days || region.distance || 0, rewards: { ...(region.rewards || {}) }, residentName: resident.name };
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
    factual_diary: facts.facts?.[0]?.text ? `今天，${facts.facts[0].text}。` : '今天的殖民地依然平稳，我期待新的发现。',
    annual_summary: `第${facts.year || 1}年稳步结束，继续发挥优势并照顾资源净变化。`,
  };
  return text[type] || '殖民地记录已更新。';
}
