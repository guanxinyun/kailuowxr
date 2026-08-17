const USER_CONFIG_KEY = 'stardust-ai-user-config';
const TIMEOUT_MS = 15000;
const FAILURE_LIMIT = 3;
const RETRY_RESET_MS = 60000; // 失败后 60 秒自动重置计数器
const JSON_TYPES = new Set(['building_proposal', 'combo_proposal', 'species_proposal', 'tech_proposal', 'combo_comment', 'product_copy', 'event_proposal', 'challenge_proposal', 'card_proposal']);

const SCHEMAS = {
  building_proposal: '{"name":"中文名","category":"basic|food|science|culture|special","icon":"Lucide图标名","desc":"描述","flavor":"趣味文案","cost":{"metal":20,"energy":10},"gravity":{"food":0,"knowledge":0,"comfort":0,"adventure":0,"culture":0,"nature":0},"unlockTech":"前置科技ID或null"}',
  combo_proposal: '{"name":"中文名","description":"逻辑原因","buildingIds":["现有建筑ID","现有建筑ID"],"effectKind":"output|production|tourism"}',
  species_proposal: '{"name":"中文名","homeworld":"母星","icon":"Lucide图标名","color":"#RRGGBB","lore":"背景","trait":"特征","personality":"性格","gravityPreference":{"food":1,"knowledge":1,"comfort":1,"adventure":1,"culture":1,"nature":1},"funfact":"趣闻"}',
  tech_proposal: '{"name":"中文名(不超过8字)","desc":"描述(不超过60字)","flavor":"趣味文案(不超过40字)","tier":2,"cost":{"research":50},"prereqs":["已有科技ID"],"unlocks":["解锁内容描述"],"gravity":{"food":0,"knowledge":0,"comfort":0,"adventure":0,"culture":0,"nature":0}}',
  combo_comment: '{"comment":"不超过80字的布局评价"}',
  product_copy: '{"displayName":"不超过20字的展示别名","description":"不超过100字且只描述给定事实"}',
  event_proposal: '{"title":"不超过15字的事件标题","type":"discovery|science|trade|wonder|exploration|diplomacy|alien","narrative":"不超过120字的幽默叙事","choices":[{"text":"不超过16字的选项","result":"不超过40字的结果","tone":"positive|neutral"}]}',
  challenge_proposal: '{"title":"不超过12字的挑战标题","narrative":"不超过80字的遭遇叙事","obstacles":[{"label":"不超过10字的障碍名称"}]}',
  card_proposal: '{"name":"技能卡牌名(不超过10字)","type":"combat|engineering|research|farming|survival|social","value":8,"icon":"Lucide图标名","desc":"卡牌效能说明(不超过60字)","flavor":"趣味风味文案(不超过40字)"}',
};

// 各类型专用 System Prompt；未覆盖的类型使用 DEFAULT_SYSTEM_PROMPT
const DEFAULT_SYSTEM_PROMPT = '你是轻松和平的殖民经营游戏内容设计师。严格遵守用户要求的输出格式。';
const SYSTEM_PROMPTS = {
  event_proposal: `你是开罗游戏风格的殖民经营游戏内容设计师，精通「弊誌新闻体」冷幽默。
【文风结构】三段式：一本正经的官方新闻通报 → 当事人荒诞脱线的发言 → 冷面记者的泼冷水结语。
【范文原文示例】
1. 设施报道："最近势头强劲的殖民地新设了训练场。'从今天起我要挥镐一千次再出门！'这位精神饱满的居民由于肌肉酸痛，目前正在家里躺着。弊誌将持续关注后续发展。"
2. 怪物/意外事件："弊誌获悉，某地下城攻略成功的喜讯传来。探险居民热泪盈眶地表示：'以后也会一边享受设施一边变强，请大家多多支持！'不过据邻居反映，他回来第一件事是在浴室泡了三小时。"
3. 访客/人气调查："据全国协会调查，来到殖民地的访客全员都申请了定居。一位接受采访的异星旅人笑道：'这里设施齐全，饭也很好吃，完全没有理由回老家嘛。'说完便快步走向了小吃摊。"
4. 日常鸡毛蒜皮："弊誌追踪调查发现，某居民最近总是不太积极。原因竟是'觉得房间不够大'。送点小礼物或者发个奖章，或许能让他的干劲一口气涌上来。"
【要点】允许开罗式的轻度怪物、冒险、道场、巨大生物足音等玩笑；NPC 动机极其真实（摸鱼、买房、吃甜点、抢功劳）；把废品当成宝物。
【禁区】禁止真正血腥残暴、永久死亡、严肃道德批判、毁灭世界宏大史诗腔与网络烂梗。严格遵守输出格式。`,
  challenge_proposal: `你是开罗游戏风格的殖民经营游戏内容设计师。把探索遭遇用官方通报的口吻轻描淡写地写成荒诞小插曲（通报 → 当事人脱线发言 → 冷面结语）。例如："在岩层中发现了两足行走的奇怪生物正在举行腕力大会，队员表示'不能输给野生蘑菇'。不过大家似乎只是想借机休息一下。"保持礼貌冷幽默，禁止血腥、死亡、残酷破坏与宏大史诗腔。严格遵守输出格式。`,
};

function userConfig() {
  try { return JSON.parse(sessionStorage.getItem(USER_CONFIG_KEY) || 'null'); } catch { return null; }
}

function onlineEndpointAvailable() {
  if (typeof location === 'undefined') return false;
  return Boolean(userConfig()?.endpoint && userConfig()?.model);
}

export function getModelsEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (/\/models\/?$/.test(url.pathname)) {
    url.search = '';
    return url.toString();
  }
  const derived = url.pathname.replace(/\/chat\/completions\/?$/, '/models');
  url.pathname = derived === url.pathname
    ? `${url.pathname.replace(/\/$/, '')}/models`
    : derived;
  url.search = '';
  return url.toString();
}

// Ollama 原生模型列表端点；仅在本地主机时适用，避免对远程接口发起无关请求。
export function getOllamaTagsEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return null;
  url.pathname = '/api/tags';
  url.search = '';
  return url.toString();
}

// 把用户填写的基础地址归一化为完整 /chat/completions 端点：
// 已含 /chat/completions 原样保留；仅根域名补 /v1/chat/completions；其余补 /chat/completions。
export function normalizeChatEndpoint(endpoint) {
  const url = new URL(endpoint);
  const path = url.pathname.replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(path)) {
    url.pathname = path;
    url.search = '';
    return url.toString();
  }
  url.pathname = path === '' ? '/v1/chat/completions' : `${path}/chat/completions`;
  url.search = '';
  return url.toString();
}

export function normalizeModelList(payload) {
  const entries = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models) ? payload.models : [];
  return [...new Set(entries
    .map((entry) => typeof entry === 'string' ? entry : entry?.id || entry?.model || entry?.name)
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim()))];
}

export function getModelsPageEndpoint(endpoint, page) {
  if (!page?.has_more || !page.last_id) return null;
  const url = new URL(endpoint);
  url.searchParams.set('after', page.last_id);
  return url.toString();
}

async function readError(response, fallback) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || body?.error || body?.message || '';
  } catch {
    // Ignore non-JSON error bodies.
  }
  return new Error(detail ? `${fallback}: ${detail}` : fallback);
}

function requestHeaders(apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class AIClient {
  constructor() {
    this.failures = 0;
    this.cache = new Map();
    this.inFlight = new Map();
    this.status = 'offline';
    this.lastError = '';
    this._lastFailureTime = 0;
  }

  async generate(type, context, fallback, { cache = true } = {}) {
    const key = `${type}:${JSON.stringify(context)}`;
    if (cache && this.cache.has(key)) return this.cache.get(key);
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    // 失败后自动重试：超过 RETRY_RESET_MS 后重置失败计数
    if (this.failures >= FAILURE_LIMIT && this._lastFailureTime && Date.now() - this._lastFailureTime > RETRY_RESET_MS) {
      this.failures = 0;
      this.status = 'offline';
      this.lastError = '';
    }

    if (!onlineEndpointAvailable() || this.failures >= FAILURE_LIMIT || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      this.status = 'fallback';
      return fallback();
    }

    const task = this._request(type, context).catch((err) => {
      this.lastError = err.message || String(err);
      return fallback();
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, task);
    const result = await task;
    if (cache) this.cache.set(key, result);
    return result;
  }

  async _request(type, context) {
    const config = userConfig();
    const endpoint = normalizeChatEndpoint(config.endpoint);
    const headers = requestHeaders(config?.apiKey);
    const wantsJson = JSON_TYPES.has(type);
    try {
      const prompt = wantsJson
        ? `只输出合法JSON，不使用Markdown。类型:${type}。必须匹配Schema:${SCHEMAS[type]}。禁止血腥、死亡、战争和永久惩罚。当前事实:${JSON.stringify(context).slice(0, 12000)}`
        : `根据事实生成简短中文游戏文本。类型:${type}。不超过150字，不添加事实，不涉及血腥或死亡。事实:${JSON.stringify(context).slice(0, 12000)}`;
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPTS[type] || DEFAULT_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1200,
        }),
      });
      if (!response.ok) throw await readError(response, `AI ${response.status}`);
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
      this._lastFailureTime = Date.now();
      this.lastError = error.message || String(error);
      this.status = this.failures >= FAILURE_LIMIT ? 'fallback' : 'offline';
      throw error;
    }
  }

  async listModels({ endpoint, apiKey } = {}) {
    const config = userConfig() || {};
    const rawTarget = (endpoint ?? config.endpoint ?? '').trim();
    if (!rawTarget) throw new Error('请先填写 AI 接口');
    const target = normalizeChatEndpoint(rawTarget);
    const key = apiKey === undefined ? config.apiKey : apiKey;
    const headers = key ? { Authorization: `Bearer ${key}` } : {};

    // 依次尝试 OpenAI 兼容 /models 与本地 Ollama 原生 /api/tags，取首个返回非空者。
    const sources = [getModelsEndpoint(target), getOllamaTagsEndpoint(target)];
    for (const start of sources) {
      if (!start) continue;
      const models = await this._collectModels(start, headers);
      if (models.length) return models;
    }
    throw new Error('该接口不支持自动获取模型列表，请手动填写模型名后用「测试连接」验证');
  }

  async _collectModels(start, headers) {
    const models = [];
    let pageUrl = start;
    let unsupported = false;
    try {
      for (let pageIndex = 0; pageUrl && pageIndex < 100; pageIndex++) {
        const response = await fetchWithTimeout(pageUrl, { headers });
        if (response.status === 404 || response.status === 405 || response.status === 501) {
          unsupported = true;
          break;
        }
        if (!response.ok) throw await readError(response, `模型列表 ${response.status}`);
        const page = await response.json();
        models.push(...normalizeModelList(page));
        const nextUrl = typeof page?.next === 'string' && page.next
          ? new URL(page.next, pageUrl).toString()
          : getModelsPageEndpoint(pageUrl, page);
        pageUrl = nextUrl === pageUrl ? null : nextUrl;
      }
    } catch (err) {
      if (!unsupported) throw err;
    }
    return [...new Set(models)];
  }

  async testConnection({ endpoint, model, apiKey } = {}) {
    const config = userConfig() || {};
    const rawEndpoint = (endpoint ?? config.endpoint ?? '').trim();
    const targetModel = (model ?? config.model ?? '').trim();
    if (!rawEndpoint) throw new Error('请先填写 AI 接口');
    if (!targetModel) throw new Error('请先选择模型');
    const targetEndpoint = normalizeChatEndpoint(rawEndpoint);
    const response = await fetchWithTimeout(targetEndpoint, {
      method: 'POST',
      headers: requestHeaders(apiKey === undefined ? config.apiKey : apiKey),
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: '只回复 OK' }],
        temperature: 0,
        max_tokens: 8,
      }),
    });
    if (!response.ok) throw await readError(response, `连接测试 ${response.status}`);
    const data = await response.json();
    if (typeof data?.choices?.[0]?.message?.content !== 'string') {
      throw new Error('连接成功，但响应不是 OpenAI 兼容格式');
    }
    this.failures = 0;
    this.status = 'online';
    this.lastError = '';
    return true;
  }

  configure({ endpoint = '', model = '', apiKey }) {
    if (endpoint && !/^https?:\/\//.test(endpoint)) throw new Error('AI 接口必须以 http:// 或 https:// 开头');
    let normalizedEndpoint = '';
    if (endpoint) {
      try {
        normalizedEndpoint = normalizeChatEndpoint(endpoint);
      } catch {
        throw new Error('AI 接口地址格式无效');
      }
    }
    const previous = userConfig();
    sessionStorage.setItem(USER_CONFIG_KEY, JSON.stringify({ endpoint: normalizedEndpoint, model: model.trim(), apiKey: apiKey === undefined ? previous?.apiKey || '' : apiKey }));
    this.reset();
  }
  clearConfiguration() { sessionStorage.removeItem(USER_CONFIG_KEY); this.reset(); }
  getConfiguration() { const value = userConfig(); return value ? { endpoint: value.endpoint || '', model: value.model || '', hasKey: Boolean(value.apiKey) } : null; }
  reset() { this.failures = 0; this.status = 'offline'; this.lastError = ''; this._lastFailureTime = 0; this.cache.clear(); }
  getStatus() { return { mode: this.status, failures: this.failures, custom: Boolean(userConfig()?.endpoint), lastError: this.lastError }; }
}

export const aiClient = new AIClient();
