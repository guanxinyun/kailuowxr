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
  discovery: { positive: { research: 10, blueprint: 1 }, neutral: { crystal: 6 } },
  science: { positive: { research: 12, blueprint: 1 }, neutral: { research: 5, food: 3 } },
  trade: { positive: { credits: 40 }, neutral: { credits: 18 } },
  wonder: { positive: { happiness: 10, culture: 3 }, neutral: { happiness: 5 } },
  exploration: { positive: { metal: 8, crystal: 4 }, neutral: { research: 6 } },
  diplomacy: { positive: { diplomacy: 8, credits: 25 }, neutral: { diplomacy: 4 } },
  alien: { positive: { research: 15, diplomacy: 6 }, neutral: { research: 8 } },
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

/** 本地降级事件（AI 不可用时仍能产出新事件） */
export function fallbackEvent() {
  return {
    title: '不期而遇的善意',
    type: 'wonder',
    narrative: '一位路过的星际旅人在降落点外留下了一篮奇异的果实，没有留下姓名。',
    choices: [
      { text: '分享给全体居民', result: '大家都尝到了来自远方的甜味。', tone: 'positive' },
      { text: '留作研究样本', result: '样本被妥善保存，等待进一步分析。', tone: 'neutral' },
    ],
  };
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
