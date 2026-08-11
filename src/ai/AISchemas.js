/**
 * 星尘殖民地 — AI 输出校验
 * 校验 AI 响应的格式和内容是否符合预期
 * 未来接入真实 AI API 时用于过滤异常响应
 */

import { AI_REQUEST_TYPES, REQUEST_CONFIG } from './AIPrompts.js';

/**
 * 通用文本校验
 * @param {string} text - AI 响应文本
 * @param {object} config - 请求配置
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateText(text, config) {
  if (!text || typeof text !== 'string') {
    return { valid: false, reason: '响应为空或非字符串' };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: '响应内容为空' };
  }

  if (config.maxLength && trimmed.length > config.maxLength * 2) {
    return { valid: false, reason: `响应过长: ${trimmed.length} 字符` };
  }

  return { valid: true };
}

// ===== 各类型专用校验器 =====

const validators = {
  [AI_REQUEST_TYPES.CONTEXTUAL_TIP](text) {
    const config = REQUEST_CONFIG[AI_REQUEST_TYPES.CONTEXTUAL_TIP];
    const base = validateText(text, config);
    if (!base.valid) return base;
    // 建议类文本不应包含代码或特殊标记
    if (text.includes('```') || text.includes('<script')) {
      return { valid: false, reason: '响应包含非法内容' };
    }
    return { valid: true };
  },

  [AI_REQUEST_TYPES.BUILDING_TIP](text) {
    const config = REQUEST_CONFIG[AI_REQUEST_TYPES.BUILDING_TIP];
    return validateText(text, config);
  },

  [AI_REQUEST_TYPES.DIARY](text) {
    const config = REQUEST_CONFIG[AI_REQUEST_TYPES.DIARY];
    const base = validateText(text, config);
    if (!base.valid) return base;
    // 日记应该有一定长度
    if (text.trim().length < 10) {
      return { valid: false, reason: '日记内容过短' };
    }
    return { valid: true };
  },

  [AI_REQUEST_TYPES.ANNUAL_COMMENT](text) {
    const config = REQUEST_CONFIG[AI_REQUEST_TYPES.ANNUAL_COMMENT];
    const base = validateText(text, config);
    if (!base.valid) return base;
    if (text.trim().length < 20) {
      return { valid: false, reason: '年终评语过短' };
    }
    return { valid: true };
  },

  [AI_REQUEST_TYPES.DIPLOMACY_ADVICE](text) {
    const config = REQUEST_CONFIG[AI_REQUEST_TYPES.DIPLOMACY_ADVICE];
    return validateText(text, config);
  },

  [AI_REQUEST_TYPES.RESIDENT_TIP](text) {
    const config = REQUEST_CONFIG[AI_REQUEST_TYPES.RESIDENT_TIP];
    return validateText(text, config);
  },

  [AI_REQUEST_TYPES.EVENT_NARRATION](text) {
    const config = REQUEST_CONFIG[AI_REQUEST_TYPES.EVENT_NARRATION];
    return validateText(text, config);
  },
};

/**
 * 校验 AI 响应
 * @param {string} type - 请求类型（AI_REQUEST_TYPES 枚举值）
 * @param {string} text - AI 响应文本
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateResponse(type, text) {
  const validator = validators[type];
  if (!validator) {
    return { valid: false, reason: `未知请求类型: ${type}` };
  }
  return validator(text);
}
