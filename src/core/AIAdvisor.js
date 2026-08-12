/**
 * 星尘殖民地 — AI 顾问系统（薄包装层）
 * 基于 src/ai/ 模块系统，提供面向业务的 AI 接口
 * 管理 EventBus 事件监听和定时触发
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { aiQueue } from '../ai/AIRequestQueue.js';
import { AI_REQUEST_TYPES } from '../ai/AIPrompts.js';
import { GRAVITY_CONFIG, SEASONS } from '../data/gamedata.js';
import { aiClient } from '../ai/AIClient.js';
import { buildDiaryFacts, getNarrationFallback } from './AIContentFacts.js';

class AIAdvisor {
  constructor() {
    this._lastTipTime = 0;
    this._tipInterval = 60000; // 每60秒最多一条建议
    this._setupListeners();
  }

  _setupListeners() {
    // 监听季节变化 → 推送季节建议
    bus.on('season:change', (season) => {
      this._queueTip();
    });

    // 监听资源变化 → 低资源警告
    bus.on('resource:change', ({ type, value }) => {
      const storage = gameState.state.storage[type];
      if (storage !== Infinity && value < storage * 0.15) {
        this._queueTip();
      }
    });

    // 监听建筑放置
    bus.on('building:placed', (building) => {
      setTimeout(() => {
        this._queueTip();
      }, 1000);
    });
  }

  /**
   * 获取情境建议（异步，通过请求队列）
   * @returns {Promise<string>}
   */
  async getContextualTip() {
    return aiQueue.request(AI_REQUEST_TYPES.CONTEXTUAL_TIP);
  }

  /**
   * 获取建筑建议（异步）
   * @param {string} buildingId
   * @returns {Promise<string>}
   */
  async getBuildingTip(buildingId) {
    return aiQueue.request(AI_REQUEST_TYPES.BUILDING_TIP, { buildingId });
  }

  /**
   * 生成居民日记（异步）
   * @param {object} resident
   * @returns {Promise<string>}
   */
  async generateDiary(resident, recentFacts = []) {
    const facts = buildDiaryFacts(resident, recentFacts);
    return aiClient.generate('factual_diary', facts, () => getNarrationFallback('factual_diary', facts), { cache: false });
  }

  /**
   * 生成年终评语（异步）
   * @param {number} score - 综合得分 0-100
   * @returns {Promise<string>}
   */
  async generateAnnualComment(score) {
    return aiQueue.request(AI_REQUEST_TYPES.ANNUAL_COMMENT, { score });
  }

  /**
   * 生成外交建议（异步）
   * @param {string} speciesId
   * @param {string} speciesName
   * @returns {Promise<string>}
   */
  async generateDiplomacyAdvice(speciesId, speciesName) {
    return aiQueue.request(AI_REQUEST_TYPES.DIPLOMACY_ADVICE, { speciesId, speciesName });
  }

  /**
   * 获取居民面板建议（异步）
   * @returns {Promise<string>}
   */
  async getResidentTip() {
    const residents = gameState.state.residents;
    const avgMood = residents.reduce((sum, r) => sum + r.mood, 0) / residents.length;
    return aiQueue.request(AI_REQUEST_TYPES.RESIDENT_TIP, { avgMood });
  }

  /**
   * 获取事件叙述增强（异步）
   * @param {string} phase - 'beforeChoice' | 'afterChoice'
   * @returns {Promise<string>}
   */
  async getEventNarration(phase = 'beforeChoice') {
    return aiQueue.request(AI_REQUEST_TYPES.EVENT_NARRATION, { phase });
  }

  /**
   * 在容器中显示信号接收占位符 → AI 内容（自动过渡）
   * @param {string} type - AI_REQUEST_TYPES 枚举值
   * @param {object} context - 请求上下文
   * @param {HTMLElement} container - DOM 容器
   * @param {object} [opts] - 选项
   * @returns {Promise<string>}
   */
  async showWithPlaceholder(type, context, container, opts = {}) {
    return aiQueue.requestWithPlaceholder(type, context, container, opts);
  }

  /**
   * 打字机效果（直接使用，无占位符）
   */
  typewriterEffect(el, text, speed = 30) {
    return aiQueue._typewriter(el, text, speed);
  }

  /**
   * 创建信号接收占位符
   */
  createSignalPlaceholder(container, label) {
    return aiQueue.createPlaceholder(container, label);
  }

  /**
   * 速率限制的提示推送
   */
  async _queueTip() {
    const now = Date.now();
    if (now - this._lastTipTime < this._tipInterval) return;
    this._lastTipTime = now;

    const tip = await this.getContextualTip();
    bus.emit('ai:tip', tip);
  }
}

export const aiAdvisor = new AIAdvisor();
