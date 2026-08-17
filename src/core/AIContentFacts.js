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

export function buildSceneryVisitFacts(visitorName, buildingName, eventType, effectDesc, isTourist) {
  return {
    visitorName,
    buildingName,
    eventType,
    effectDesc,
    isTourist: !!isTourist,
  };
}

export function buildComboWonderFacts(buildingNames = [], visitor = null) {
  return {
    buildingNames,
    visitorName: visitor?.name || '殖民地开拓者',
    speciesName: visitor?.speciesName || '人类',
    isTourist: !!visitor?.speciesId,
  };
}

export function getNarrationFallback(type, facts) {
  const text = {
    product_copy: `【工坊优选】${facts.baseName || '这件产品'}已顺利出厂。虽然做工扎实，但居民们似乎一致认为它非常适合拿来当压泡面盖的重物。`,
    tourist_personality: '“只要有冰淇淋和纪念品，即使被外星触手缠住我也能给好评。” ——该游客在入境登记表上的自述。',
    tourist_review: `“景观非常宏伟，不过烤冷面摊位前排队太长了，扣一星。” 满意度约 ${facts.satisfaction ?? 70}%，下次还会带亲戚来。`,
    exploration_log: `【考察快讯】${facts.residentName || '考察员'}在野外发现了奇怪的荧光矿石，顺手捡了两块准备带回宿舍当小夜灯。`,
    exploration_event: `【野外速报】${facts.residentNames?.[0] || '探索队'}在${facts.tileName || '未知区域'}${facts.good ? '发现了宝藏' : '遭遇了一点小波折'}：${facts.effectText || ''}${facts.bonusText ? `，${facts.bonusText}` : ''}。“虽然差点把鞋跑丢，但收获颇丰。”`,
    scenery_event: `【景观打卡】${facts.visitorName} 拜访了 ${facts.buildingName}：${facts.effectDesc || '在反重力喷泉前吃烤肠，不慎把酱汁喷到了外交官衬衫上，对方评价‘咸淡适中’'}。`,
    combo_wonder_event: `【弊誌快讯】${facts.visitorName || '居民'}在${facts.buildingNames?.join('与') || '建筑群'}附近目击了不可思议的共振现象！研究员当场宣布菠菜具备了量子计算能力，但菠菜表示只想被炒成菜。`,
    factual_diary: facts.facts?.[0]?.text ? `【观察员手记】今天，${facts.facts[0].text}。工会代表向编辑部保证：只要发点心，大家绝不会消极怠工。` : '【观察员手记】今天的殖民地依然平稳，只是自来水管里偶尔会流出草莓味果汁。',
    annual_summary: `【星尘年报】第${facts.year || 1}年正式收官。评审委员会一致认为殖民地运营良好，尤其是年末发放勋章后，居民的摸鱼现象得到了明显遏制。`,
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
 * 月度简报本地降级：开罗风幽默（Kairo-style Humor）新闻体
 * 三段式：官方通报 ➔ 当事人脱线采访 ➔ 冷面吐槽结语
 * 保持荒诞市井小市民气息 + 一本正经的官方冷幽默
 */
export function getMonthlyBriefingFallback(facts) {
  const events = facts.events || [];
  const good = events.filter((e) => e.good).length;
  const bad = events.filter((e) => !e.good).length;

  const openers = [
    `【星尘月报 · 弊誌专栏】第${facts.year}年第${facts.day}天。据弊誌特派员调查，殖民地目前已有 ${facts.population || 0} 名居民与 ${facts.buildings || 0} 栋建筑在平稳运转。“只要按时发放草莓味口粮，大家就绝不会消极怠工。”工会代表接受采访时如此保证道。`,
    `【星尘月报 · 弊誌专栏】转眼又是 30 天。弊誌记者潜入降落点生活区暗访，发现居民们正聚在自制长椅上认真研读《三分钟掌握星际摸鱼微操作》。以下为本月官方通报要闻。`,
    `【星尘月报 · 弊誌专栏】第${facts.year}年第${facts.day}天。弊誌编辑部向全体开拓者致以亲切问候——虽然上周派去采访的记者因为误把外星杏鲍菇当成麦克风，目前正在医务室接受心理疏导。`,
  ];
  const opener = openers[(facts.day || 0) % openers.length];

  let headline = '';
  if (events[0]) {
    headline = `【本月要闻】关于“${events[0].title}”的专项通报：${events[0].text}。当事居民兴奋地表示“以后还要再接再厉”，不过他今天因严重肌肉酸痛正在家中静养。弊誌将持续关注后续动向。`;
  } else {
    headline = '【本月要闻】全月风平浪静，大家除了按部就班拧螺丝外没有发生任何意外，弊誌记者一度因缺乏大新闻而感到深深的失业危机。';
  }

  const tally = (good + bad) > 0
    ? `【劳资与民生简报】本月共记录 ${good + bad} 起大情小事（${good} 起喜报、${bad} 起小波折）。${bad > good ? '调查表明，如果不给开拓者们发点礼物或勋章，他们可能会集体宅在宿舍里打扑克。' : '整体态势蒸蒸日上，不少外星游客甚至当场打听起了购房落户政策。'}`
    : '';

  const mood = `【殖民地评级】当前居民综合幸福度为 ${facts.happiness}%。${facts.happiness < 40 ? '满意度明显偏低，建议管理者尽快新建娱乐设施，或者在年末举办一场感人肺腑的勋章授与式。' : facts.happiness > 70 ? '居民们笑逐颜开，纷纷夸赞食堂饭菜香甜、居住舱宽敞明亮，恨不得下一部作品还住在这里。' : '各项指标中规中矩，大家在努力工作与偷懒摸鱼之间维持着微妙而完美的平衡。'}`;

  return [opener, headline, tally, mood].filter(Boolean).join('\n\n');
}
