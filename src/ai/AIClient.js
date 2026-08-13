const USER_CONFIG_KEY = 'stardust-ai-user-config';
const TIMEOUT_MS = 15000;
const FAILURE_LIMIT = 3;
const JSON_TYPES = new Set(['building_proposal', 'combo_proposal', 'species_proposal', 'tech_proposal', 'combo_comment', 'product_copy']);

const SCHEMAS = {
  building_proposal: '{"name":"中文名","category":"basic|food|science|culture|special","icon":"Lucide图标名","desc":"描述","flavor":"趣味文案","cost":{"metal":20,"energy":10},"gravity":{"food":0,"knowledge":0,"comfort":0,"adventure":0,"culture":0,"nature":0},"unlockTech":"前置科技ID或null"}',
  combo_proposal: '{"name":"中文名","description":"逻辑原因","buildingIds":["现有建筑ID","现有建筑ID"],"effectKind":"output|production|tourism"}',
  species_proposal: '{"name":"中文名","homeworld":"母星","icon":"Lucide图标名","color":"#RRGGBB","lore":"背景","trait":"特征","personality":"性格","gravityPreference":{"food":1,"knowledge":1,"comfort":1,"adventure":1,"culture":1,"nature":1},"funfact":"趣闻"}',
  tech_proposal: '{"name":"中文名(不超过8字)","desc":"描述(不超过60字)","flavor":"趣味文案(不超过40字)","tier":2,"cost":{"research":50},"prereqs":["已有科技ID"],"unlocks":["解锁内容描述"],"gravity":{"food":0,"knowledge":0,"comfort":0,"adventure":0,"culture":0,"nature":0}}',
  combo_comment: '{"comment":"不超过80字的布局评价"}',
  product_copy: '{"displayName":"不超过20字的展示别名","description":"不超过100字且只描述给定事实"}',
};

function userConfig() {
  try { return JSON.parse(sessionStorage.getItem(USER_CONFIG_KEY) || 'null'); } catch { return null; }
}

function onlineEndpointAvailable() {
  if (typeof location === 'undefined') return false;
  return Boolean(userConfig()?.endpoint && userConfig()?.model);
}

class AIClient {
  constructor() {
    this.failures = 0;
    this.cache = new Map();
    this.inFlight = new Map();
    this.status = 'offline';
  }

  async generate(type, context, fallback, { cache = true } = {}) {
    const key = `${type}:${JSON.stringify(context)}`;
    if (cache && this.cache.has(key)) return this.cache.get(key);
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    if (!onlineEndpointAvailable() || this.failures >= FAILURE_LIMIT || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      this.status = 'fallback';
      return fallback();
    }

    const task = this._request(type, context).catch(() => fallback()).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, task);
    const result = await task;
    if (cache) this.cache.set(key, result);
    return result;
  }

  async _request(type, context) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const config = userConfig();
      const endpoint = config.endpoint;
      const headers = { 'Content-Type': 'application/json' };
      if (config?.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
      const wantsJson = JSON_TYPES.has(type);
      const prompt = wantsJson
        ? `只输出合法JSON，不使用Markdown。类型:${type}。必须匹配Schema:${SCHEMAS[type]}。禁止战斗、敌人、伤害、死亡和惩罚。当前事实:${JSON.stringify(context).slice(0, 12000)}`
        : `根据事实生成简短中文游戏文本。类型:${type}。不超过150字，不添加事实，不涉及战斗或惩罚。事实:${JSON.stringify(context).slice(0, 12000)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: '你是轻松和平的殖民经营游戏内容设计师。严格遵守用户要求的输出格式。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1200,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`AI ${response.status}`);
      const data = await response.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (typeof raw !== 'string' || !raw.trim()) throw new Error('AI 响应格式错误');
      this.failures = 0;
      this.status = 'online';
      if (!wantsJson) return raw.trim();
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      return JSON.parse(cleaned);
    } catch (error) {
      this.failures++;
      this.status = this.failures >= FAILURE_LIMIT ? 'fallback' : 'offline';
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  configure({ endpoint = '', model = '', apiKey }) {
    if (endpoint && !/^https?:\/\//.test(endpoint)) throw new Error('AI 接口必须以 http:// 或 https:// 开头');
    const previous = userConfig();
    sessionStorage.setItem(USER_CONFIG_KEY, JSON.stringify({ endpoint: endpoint.trim(), model: model.trim(), apiKey: apiKey === undefined ? previous?.apiKey || '' : apiKey }));
    this.reset();
  }
  clearConfiguration() { sessionStorage.removeItem(USER_CONFIG_KEY); this.reset(); }
  getConfiguration() { const value = userConfig(); return value ? { endpoint: value.endpoint || '', model: value.model || '', hasKey: Boolean(value.apiKey) } : null; }
  reset() { this.failures = 0; this.status = 'offline'; }
  getStatus() { return { mode: this.status, failures: this.failures, custom: Boolean(userConfig()?.endpoint) }; }
}

export const aiClient = new AIClient();
