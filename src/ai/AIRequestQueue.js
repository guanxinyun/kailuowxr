/**
 * 星尘殖民地 — AI 请求队列
 * 核心 AI 调度系统：优先级队列、并发控制、模拟延迟、缓存、回退机制
 * 提供信号接收占位符 DOM 创建和打字机替换功能
 *
 * 当前为前端原型模式：使用 AIFallbacks 模板生成模拟 AI 响应
 * 未来可替换 _processRequest 方法接入真实 AI API
 */

import { AI_REQUEST_TYPES, REQUEST_CONFIG } from './AIPrompts.js';
import { validateResponse } from './AISchemas.js';
import * as Fallbacks from './AIFallbacks.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { gameState } from '../core/GameState.js';
import { GRAVITY_CONFIG } from '../data/gamedata.js';
import { getBuildingById } from '../data/buildings.js';
import { aiClient } from './AIClient.js';

const MAX_CONCURRENT = 2;

class AIRequestQueue {
  constructor() {
    this._queue = [];          // 待处理请求
    this._active = 0;          // 当前活跃请求数
    this._cache = new Map();   // 内存缓存 { key: { text, timestamp } }
    this._requestId = 0;
  }

  /**
   * 发起 AI 请求
   * @param {string} type - AI_REQUEST_TYPES 枚举值
   * @param {object} context - 请求上下文数据
   * @returns {Promise<string>} AI 响应文本
   */
  request(type, context = {}) {
    const config = REQUEST_CONFIG[type];
    if (!config) {
      return Promise.resolve(this._getFallback(type, context));
    }

    // 检查缓存
    if (config.cacheTTL > 0) {
      const cacheKey = `${type}:${JSON.stringify(context)}`;
      const cached = this._cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < config.cacheTTL) {
        return Promise.resolve(cached.text);
      }
    }

    return new Promise((resolve) => {
      const id = ++this._requestId;
      this._queue.push({
        id,
        type,
        context,
        config,
        resolve,
        priority: config.priority,
      });

      // 按优先级排序（数字越小优先级越高）
      this._queue.sort((a, b) => a.priority - b.priority);

      this._processNext();
    });
  }

  /**
   * 创建信号接收占位符 DOM
   * 显示三点闪烁 + 雷达扫描动画
   * @param {HTMLElement} container - 父容器
   * @param {string} [label] - 可选标签文字
   * @returns {{ el: HTMLElement, destroy: Function }}
   */
  createPlaceholder(container, label) {
    const placeholder = createElement('div', { className: 'ai-placeholder' });

    // 雷达图标
    const radar = createElement('div', { className: 'ai-placeholder-radar' });
    placeholder.appendChild(radar);

    // 文字 + 三点
    const textWrap = createElement('span', { className: 'ai-placeholder-text' }, [
      label || '信号接收中',
    ]);
    placeholder.appendChild(textWrap);

    const dots = createElement('span', { className: 'ai-placeholder-dots' });
    for (let i = 0; i < 3; i++) {
      dots.appendChild(createElement('span', { className: 'ai-dot' }));
    }
    placeholder.appendChild(dots);

    container.appendChild(placeholder);

    return {
      el: placeholder,
      destroy() {
        if (placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder);
        }
      },
    };
  }

  /**
   * 发起请求并自动管理占位符 → 内容过渡
   * @param {string} type - 请求类型
   * @param {object} context - 请求上下文
   * @param {HTMLElement} container - 内容容器
   * @param {object} [opts] - 选项
   * @param {string} [opts.label] - 占位符标签
   * @param {number} [opts.typeSpeed] - 打字机速度 ms/字
   * @param {boolean} [opts.showIcon] - 是否显示 AI 图标
   * @returns {Promise<string>} 最终显示的文本
   */
  async requestWithPlaceholder(type, context, container, opts = {}) {
    const { label, typeSpeed = 25, showIcon = true } = opts;

    // 创建 AI 消息容器
    const msgEl = createElement('div', { className: 'ai-message' });

    if (showIcon) {
      const iconWrap = createElement('div', { className: 'ai-message-icon' });
      iconWrap.appendChild(lucideIcon('brain', 14));
      msgEl.appendChild(iconWrap);
    }

    const textWrap = createElement('div', { className: 'ai-message-text' });
    if (label) {
      textWrap.appendChild(createElement('div', { className: 'ai-message-label' }, [label]));
    }

    // 信号接收占位符
    const contentArea = createElement('div', { className: 'ai-content-area' });
    textWrap.appendChild(contentArea);
    msgEl.appendChild(textWrap);
    container.appendChild(msgEl);

    const ph = this.createPlaceholder(contentArea);

    // 发起请求
    const text = await this.request(type, context);

    // 移除占位符，打字机显示内容
    ph.destroy();
    const textEl = createElement('span');
    contentArea.appendChild(textEl);
    await this._typewriter(textEl, text, typeSpeed);

    return text;
  }

  /**
   * 打字机效果
   */
  _typewriter(el, text, speed = 25) {
    return new Promise((resolve) => {
      el.textContent = '';
      let i = 0;
      const cursor = createElement('span', { className: 'ai-cursor' });
      el.appendChild(cursor);

      const type = () => {
        if (i < text.length) {
          el.insertBefore(document.createTextNode(text[i]), cursor);
          i++;
          setTimeout(type, speed);
        } else {
          cursor.classList.add('done');
          setTimeout(() => {
            cursor.remove();
            resolve();
          }, 500);
        }
      };
      type();
    });
  }

  // ===== 内部方法 =====

  _processNext() {
    if (this._active >= MAX_CONCURRENT || this._queue.length === 0) return;

    const req = this._queue.shift();
    this._active++;

    this._processRequest(req)
      .then((text) => {
        // 校验
        const validation = validateResponse(req.type, text);
        if (!validation.valid) {
          console.warn(`AI 响应校验失败 [${req.type}]: ${validation.reason}`);
          return this._getFallback(req.type, req.context);
        }

        // 缓存
        if (req.config.cacheTTL > 0) {
          const cacheKey = `${req.type}:${JSON.stringify(req.context)}`;
          this._cache.set(cacheKey, { text, timestamp: Date.now() });
        }

        return text;
      })
      .catch((err) => {
        console.warn(`AI 请求失败 [${req.type}]:`, err);
        return this._getFallback(req.type, req.context);
      })
      .then((finalText) => {
        this._active--;
        req.resolve(finalText);
        this._processNext();
      });
  }

  /**
   * 处理单个请求（模拟 AI 延迟 + 模板生成）
   * 未来接入真实 API 时替换此方法
   */
  _processRequest(req) {
    const { type, context } = req;
    return aiClient.generate(type, context, () => this._generateFromFallback(type, context));
  }

  /**
   * 使用回退模板生成文本
   */
  _generateFromFallback(type, context) {
    switch (type) {
      case AI_REQUEST_TYPES.CONTEXTUAL_TIP:
        return this._generateContextualTip(context);

      case AI_REQUEST_TYPES.BUILDING_TIP:
        return this._generateBuildingTip(context);

      case AI_REQUEST_TYPES.DIARY:
        return this._generateDiary(context);

      case AI_REQUEST_TYPES.ANNUAL_COMMENT:
        return this._generateAnnualComment(context);

      case AI_REQUEST_TYPES.DIPLOMACY_ADVICE:
        return this._generateDiplomacyAdvice(context);

      case AI_REQUEST_TYPES.RESIDENT_TIP:
        return this._generateResidentTip(context);

      case AI_REQUEST_TYPES.EVENT_NARRATION:
        return this._generateEventNarration(context);

      default:
        return this._getFallback(type, context);
    }
  }

  _generateContextualTip(context) {
    const state = gameState.state;
    const pools = [];

    if (state.resources.food < 20) pools.push(...Fallbacks.TIPS.lowFood);
    if (state.resources.energy < 15) pools.push(...Fallbacks.TIPS.lowEnergy);
    if (state.resources.metal < 20) pools.push(...Fallbacks.TIPS.lowMetal);
    if (state.resources.crystal < 5) pools.push(...Fallbacks.TIPS.lowCrystal);

    const allGood = state.resources.food > 50 && state.resources.energy > 30 && state.resources.metal > 50;
    if (allGood) pools.push(...Fallbacks.TIPS.surplus);

    pools.push(...Fallbacks.TIPS.general);

    const tip = Fallbacks.pickRandom(pools);
    return Fallbacks.fillTemplate(tip, {
      days: Math.floor(state.resources.food / 3),
      year: state.year,
    });
  }

  _generateBuildingTip(context) {
    const { buildingId } = context;
    const building = getBuildingById(buildingId);
    if (!building) return '建筑数据加载中...';

    const gravityDims = Object.entries(building.gravity).filter(([, v]) => v > 0);

    if (gravityDims.length === 0) {
      const pool = Fallbacks.BUILDING_TIPS[building.category] || Fallbacks.BUILDING_TIPS.basic;
      return Fallbacks.fillTemplate(Fallbacks.pickRandom(pool), { name: building.name });
    }

    const mainDim = gravityDims.sort((a, b) => b[1] - a[1])[0];
    const dimName = GRAVITY_CONFIG[mainDim[0]]?.name || mainDim[0];

    // 50% 概率用引力维度建议，50% 用类别建议
    if (Math.random() > 0.5) {
      return Fallbacks.fillTemplate(Fallbacks.BUILDING_TIPS.gravityTip, {
        name: building.name,
        dimName,
        dimValue: mainDim[1],
      });
    }

    const pool = Fallbacks.BUILDING_TIPS[building.category] || Fallbacks.BUILDING_TIPS.basic;
    return Fallbacks.fillTemplate(Fallbacks.pickRandom(pool), {
      name: building.name,
      dimension: dimName,
    });
  }

  _generateDiary(context) {
    const template = Fallbacks.pickRandom(Fallbacks.DIARY_TEMPLATES);
    return Fallbacks.fillTemplate(template, {
      weather: Fallbacks.pickRandom(Fallbacks.DIARY_FRAGMENTS.weather),
      activity: Fallbacks.pickRandom(Fallbacks.DIARY_FRAGMENTS.activity),
      feeling: Fallbacks.pickRandom(Fallbacks.DIARY_FRAGMENTS.feeling),
      observation: Fallbacks.pickRandom(Fallbacks.DIARY_FRAGMENTS.observation),
      thought: Fallbacks.pickRandom(Fallbacks.DIARY_FRAGMENTS.thought),
      location: Fallbacks.pickRandom(Fallbacks.DIARY_FRAGMENTS.location),
    });
  }

  _generateAnnualComment(context) {
    const { score = 50 } = context;
    let category;
    if (score >= 80) category = 'excellent';
    else if (score >= 60) category = 'good';
    else if (score >= 40) category = 'average';
    else category = 'poor';

    const comment = Fallbacks.pickRandom(Fallbacks.ANNUAL_COMMENTS[category]);

    // 找出最弱维度
    const dims = Object.keys(GRAVITY_CONFIG);
    const weakDim = dims[Math.floor(Math.random() * dims.length)];
    const weakLabel = GRAVITY_CONFIG[weakDim]?.name || '未知';

    return Fallbacks.fillTemplate(comment, { weakDim: weakLabel });
  }

  _generateDiplomacyAdvice(context) {
    const { speciesId, speciesName } = context;
    const speciesPool = Fallbacks.DIPLOMACY_ADVICE[speciesId] || Fallbacks.DIPLOMACY_ADVICE.general;
    const tip = Fallbacks.pickRandom(speciesPool);

    const dims = Object.keys(GRAVITY_CONFIG);
    const dim = GRAVITY_CONFIG[dims[Math.floor(Math.random() * dims.length)]];

    return Fallbacks.fillTemplate(tip, {
      species: speciesName || '外星种族',
      dimension: dim?.name || '综合',
    });
  }

  _generateResidentTip(context) {
    const { avgMood = 60 } = context;
    let pool;
    if (avgMood >= 70) pool = Fallbacks.RESIDENT_TIPS.highMood;
    else if (avgMood >= 50) pool = Fallbacks.RESIDENT_TIPS.mediumMood;
    else pool = Fallbacks.RESIDENT_TIPS.lowMood;

    return Fallbacks.pickRandom(pool);
  }

  _generateEventNarration(context) {
    const { phase = 'beforeChoice' } = context;
    const pool = Fallbacks.EVENT_NARRATION[phase] || Fallbacks.EVENT_NARRATION.beforeChoice;
    return Fallbacks.pickRandom(pool);
  }

  /**
   * 获取回退文本（当所有其他方式失败时）
   */
  _getFallback(type, context) {
    try {
      return this._generateFromFallback(type, context);
    } catch (e) {
      return '星际通讯信号微弱，请稍后再试。';
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * 获取队列状态（调试用）
   */
  getStatus() {
    return {
      queueLength: this._queue.length,
      activeRequests: this._active,
      cacheSize: this._cache.size,
    };
  }
}

export const aiQueue = new AIRequestQueue();
