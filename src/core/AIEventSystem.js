/**
 * 星尘殖民地 — AI 生成随机事件
 * AI 只写标题、叙事、选项文案与基调；数值效果由本地模板确定，绝不由 AI 决定。
 */
import { aiClient } from '../ai/AIClient.js';
import { BALANCE } from '../data/balance.js';

const FORBIDDEN = /死亡|毁灭|战争|血腥|不可逆摧毁|永久死亡|惩罚性清零/;
const TYPES = new Set(['discovery', 'science', 'trade', 'wonder', 'exploration', 'diplomacy', 'alien']);

// 本地确定性效果模板：按类型 + 基调给出，AI 无法决定数值
const EFFECT_BY_TYPE = {
  discovery: { positive: { research: 10, blueprint: 1, aiBuilding: 1 }, neutral: { crystal: 6 } },
  science: { positive: { research: 12, blueprint: 1, aiContent: 'tech_proposal' }, neutral: { research: 5, food: 3 } },
  trade: { positive: { credits: 40 }, neutral: { credits: 18 } },
  wonder: { positive: { happiness: 10, culture: 3, aiContent: 'combo_proposal' }, neutral: { happiness: 5 } },
  exploration: { positive: { metal: 8, crystal: 4 }, neutral: { research: 6 } },
  diplomacy: { positive: { diplomacy: 8, credits: 25, aiContent: 'species_proposal' }, neutral: { diplomacy: 4 } },
  alien: { positive: { research: 15, diplomacy: 6, aiContent: 'species_proposal' }, neutral: { research: 8 } },
};

const ICON_BY_TYPE = {
  discovery: 'radio', science: 'flask-conical', trade: 'package',
  wonder: 'rainbow', exploration: 'compass',
  diplomacy: 'handshake', alien: 'sparkles',
};

function text(value, max) {
  return typeof value === 'string' && value.trim() && value.length <= max && !FORBIDDEN.test(value);
}

/** 校验 AI 事件提案；通过则返回可用的完整事件对象 */
export function validateEventProposal(raw) {
  if (!raw || !text(raw.title, 15) || !text(raw.narrative, 120) || !TYPES.has(raw.type)) {
    return { ok: false, reason: '事件标题/叙事/类型无效' };
  }
  if (!Array.isArray(raw.choices) || raw.choices.length < 2 || raw.choices.length > 3) {
    return { ok: false, reason: '事件选项数量无效' };
  }
  const choices = [];
  for (const c of raw.choices) {
    if (!text(c.text, 16) || !text(c.result, 40)) return { ok: false, reason: '选项文案无效' };
    const tone = c.tone === 'positive' ? 'positive' : 'neutral';
    choices.push({ text: c.text.trim(), result: c.result.trim(), effect: { ...EFFECT_BY_TYPE[raw.type][tone] } });
  }
  const id = `ai_event_${raw.type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  return {
    ok: true,
    value: {
      id,
      name: raw.title.trim(),
      type: raw.type,
      icon: ICON_BY_TYPE[raw.type],
      narrative: raw.narrative.trim(),
      choices,
      weight: 5,
      minDay: 0,
      generated: true,
    },
  };
}

/** 本地降级事件池（AI 不可用时随机抽取，覆盖多种类型含外交） */
const FALLBACK_EVENTS = [
  {
    title: '不期而遇的善意',
    type: 'wonder',
    narrative: '一位路过的星际旅人在降落点外留下了一篮奇异的果实，没有留下姓名。',
    choices: [
      { text: '分享给全体居民', result: '大家都尝到了来自远方的甜味。', tone: 'positive' },
      { text: '留作研究样本', result: '样本被妥善保存，等待进一步分析。', tone: 'neutral' },
    ],
  },
  {
    title: '星际礼品交换日',
    type: 'diplomacy',
    narrative: '一支外星使团携带了大量"友好赠品"抵达殖民地。赠品清单包括一台自动削苹果器和三箱标注"绝对不是监控设备"的水晶球。使团团长微笑表示这是最高规格的社交礼仪。',
    choices: [
      { text: '回赠手工编织围巾', result: '使团团长感动得当场把围巾戴上了触角。', tone: 'positive' },
      { text: '礼貌收下并送研究所', result: '研究员发现水晶球折射率数据很有学术价值。', tone: 'neutral' },
    ],
  },
  {
    title: '调味瓶收购风波',
    type: 'diplomacy',
    narrative: '外星游客在食堂将调味瓶误认为珍贵收藏品，当场掏出星际信用卡要求高价收购。食堂大妈一脸茫然地表示那只是过期的胡椒粉。外交部门正在紧急协调定价问题。',
    choices: [
      { text: '郑重赠送一整套调味品', result: '对方当即宣布将殖民地列为五星推荐目的地。', tone: 'positive' },
      { text: '安排文化交流讲座', result: '双方互相科普了饮食文化，虽然有人全程偷吃零食。', tone: 'neutral' },
    ],
  },
  {
    title: '深空漂流瓶',
    type: 'discovery',
    narrative: '通讯阵列截获了一段来自未知星系的加密广播。技术员花了三小时解码后发现内容是一份外星烤肉食谱，附赠一句"祝用餐愉快"。',
    choices: [
      { text: '按食谱试做一份', result: '味道出奇地好，食堂决定将其列为本周特供。', tone: 'positive' },
      { text: '存入数据库备查', result: '食谱被归档到"跨星际饮食文化"分类下。', tone: 'neutral' },
    ],
  },
  {
    title: '实验室意外收获',
    type: 'science',
    narrative: '研究员在清洗试管时不慎将两种样本混合，结果产生了一种会发出悦耳哼唱声的新型晶体。整个实验室的人都停下来听了五分钟。',
    choices: [
      { text: '申请专项研究经费', result: '新晶体的声学特性引发了一系列突破性发现。', tone: 'positive' },
      { text: '做成桌面摆件出售', result: '哼唱晶体摆件在贸易站一上架就被抢购一空。', tone: 'neutral' },
    ],
  },
  {
    title: '外星邻居的包裹',
    type: 'alien',
    narrative: '降落点外出现了一个造型古怪的包裹，上面贴着用七种语言写的"请勿倒置"。拆开后发现是一台迷你全息投影仪，正在循环播放某种生物跳舞的画面。',
    choices: [
      { text: '回赠殖民地纪念品', result: '不久后收到了一封措辞极其正式的感谢电报。', tone: 'positive' },
      { text: '研究投影仪技术', result: '工程师从中提取了三项可用的光学参数。', tone: 'neutral' },
    ],
  },
];

export function fallbackEvent() {
  return FALLBACK_EVENTS[Math.floor(Math.random() * FALLBACK_EVENTS.length)];
}

/** 生成一个 AI 随机事件；失败或离线返回 null（调用方回退到本地事件池） */
export async function generateAIEvent(context = {}, { forceType } = {}) {
  // forceType：调试面板用，把请求类型写进上下文，让 AI 优先生成指定类型（非硬约束）
  const ctx = forceType ? { ...context, forceType } : context;
  const raw = await aiClient.generate('event_proposal', ctx, fallbackEvent, { cache: false });
  const result = validateEventProposal(raw);
  return result.ok ? result.value : null;
}

/** 是否应尝试 AI 生成事件（概率由配置控制） */
export function shouldGenerateAIEvent() {
  return Math.random() < (BALANCE.events?.aiGeneratedChance ?? 0.3);
}
