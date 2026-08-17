const USER_CONFIG_KEY = 'stardust-ai-user-config';
const TIMEOUT_MS = 15000;
const FAILURE_LIMIT = 3;
const RETRY_RESET_MS = 60000; // 失败后 60 秒自动重置计数器
const JSON_TYPES = new Set(['building_proposal', 'combo_proposal', 'species_proposal', 'tech_proposal', 'product_proposal', 'combo_comment', 'product_copy', 'event_proposal', 'challenge_proposal', 'card_proposal', 'env_proposal', 'combo_wonder_event']);

const SCHEMAS = {
  building_proposal: '{"name":"中文名","category":"basic|food|science|culture|special","icon":"Lucide图标名","desc":"描述","flavor":"趣味文案","cost":{"metal":20,"energy":10},"gravity":{"food":0,"knowledge":0,"comfort":0,"adventure":0,"culture":0,"nature":0},"unlockTech":"前置科技ID或null"}',
  combo_proposal: '{"name":"中文名","description":"逻辑原因","buildingIds":["现有建筑ID","现有建筑ID"],"effectKind":"output|production|tourism"}',
  species_proposal: '{"name":"中文名","homeworld":"母星","icon":"Lucide图标名","color":"#RRGGBB","lore":"背景","trait":"特征","personality":"性格","gravityPreference":{"food":1,"knowledge":1,"comfort":1,"adventure":1,"culture":1,"nature":1},"funfact":"趣闻"}',
  tech_proposal: '{"name":"中文名(不超过8字)","desc":"描述(不超过60字)","flavor":"趣味文案(不超过40字)","tier":2,"cost":{"research":50},"prereqs":["已有科技ID"],"unlocks":["解锁内容描述"],"gravity":{"food":0,"knowledge":0,"comfort":0,"adventure":0,"culture":0,"nature":0}}',
  product_proposal: '{"name":"加工品名(不超过8字)","tier":2,"category":"processed|goods|supplies","icon":"Lucide图标名","desc":"描述(不超过60字)","inputs":{"alloy":1,"energy":8},"days":3,"requiredBuilding":"workshop|quantum_assembler|miracle_foundry"}',
  combo_comment: '{"comment":"不超过80字的布局评价"}',
  product_copy: '{"displayName":"不超过20字的展示别名","description":"不超过100字且只描述给定事实"}',
  event_proposal: '{"title":"不超过15字的事件标题","type":"discovery|science|trade|wonder|exploration|diplomacy|alien","narrative":"不超过120字的幽默叙事","choices":[{"text":"不超过16字的选项","result":"不超过40字的结果","tone":"positive|neutral"}]}',
  challenge_proposal: '{"title":"不超过12字的挑战标题","narrative":"不超过80字的遭遇叙事","obstacles":[{"label":"不超过10字的障碍名称"}]}',
  card_proposal: '{"name":"多维卡牌名(不超过10字)","type":"combat|engineering|research|farming|survival|social","value":8,"stats":{"combat":8,"survival":2,"social":-2},"icon":"Lucide图标名","desc":"卡牌效能与权衡说明(不超过60字)","flavor":"趣味风味文案(不超过40字)"}',
  env_proposal: '{"name":"环境牌名(不超过10字)","icon":"Lucide图标名","modifiers":{"engineering":2,"survival":-1},"desc":"环境效果描述(不超过60字)","flavor":"风味文案(不超过40字)"}',
  combo_wonder_event: '{"title":"不超过15字的开罗风奇遇标题","story":"不超过120字的奇遇叙事(官方通报->当事人脱线->冷面结语)","flavor":"不超过40字的名人幽默短评"}',
};

// 各类型专用 System Prompt；未覆盖的类型使用 DEFAULT_SYSTEM_PROMPT
const DEFAULT_SYSTEM_PROMPT = `你是开罗游戏风格的星尘殖民经营游戏 AI 顾问。
文风遵循【开罗风幽默（Kairo-style Humor）】：荒诞市井小市民气息 + 一本正经的官方冷幽默。
核心机制：把极度离谱、荒谬、违背常理的事情，用最官方、最公事公办的口吻，当作理所当然的日常琐事来报道。
4大支柱：
1. 官方新闻体反差（通报 ➔ 当事人采访 ➔ 冷面吐槽结语）
2. 怪物与道具的小市民化（拒绝宏大叙事，把日常废品当宝物，怪物热衷参加掰手腕）
3. 轻度自私的打工人/资本家现实视角（NPC想买房、摸鱼、吃甜点、要勋章；管理者看重效益）
4. 适度打破第四面墙的 Meta 幽默。
【禁区】禁止血腥残暴、严肃道德批判、宏大史诗腔与网络烂梗。严格遵守输出格式。`;

const SYSTEM_PROMPTS = {
  event_proposal: `你是开罗游戏风格的殖民经营游戏内容设计师，精通「弊誌新闻体」冷幽默。
【文风结构】三段式：一本正经的官方新闻通报 → 当事人荒诞脱线的发言 → 冷面记者的泼冷水结语。
【范文原文示例】
1. 设施报道：“【剑术道场建成】‘从今往后我要先挥刀1000次再去打怪！！’力挺道场的冒险者豪气冲天地说道。不过他今天因严重肌肉酸痛正在家中静养。今后村庄的动向依然令人担忧。”
2. 怪物与日常：“野生蘑菇突然变异了”、“突然变异后擅自越狱的杏鲍菇”、“在怪物掰手腕大赛中荣获亚军”、“自来水管道施工用的铁水管”。
3. 访客与民生：“【关于努力度】调查发现，如果不给冒险者送礼物或年末发勋章，他们就会消极怠工并宅在家里。”、“为了在这个村里推广‘蒙面同好会’，请务必帮我建一栋住宅。”
4. 人气与庆典：“【村庄人气突破3000】记者去采访町村女士，她震惊得把冰淇淋掉在地上，几天后编辑部收到了索赔账单。”
【禁区】禁止真正血腥残暴、永久死亡、严肃道德批判、毁灭世界宏大史诗腔与网络烂梗。严格遵守输出格式。`,
  challenge_proposal: `你是开罗游戏风格的殖民经营游戏内容设计师。把探索遭遇用官方通报的口吻轻描淡写地写成荒诞小插曲（通报 → 当事人脱线发言 → 冷面结语）。例如：“在岩层中发现了二足行走的史莱姆正在举行腕力大会，队员表示‘不能输给野生蘑菇’。不过大家似乎只是想借机休息一下。”保持礼貌冷幽默，禁止血腥、死亡、残酷破坏与宏大史诗腔。严格遵守输出格式。`,
  combo_wonder_event: `你是开罗游戏风格的星尘奇遇记特约作家。
专为相近建筑群落引发的【开罗风特殊组合奇遇】撰写幽默报道。
【文风结构】三段式：一本正经的官方设施通报 ➔ 当事人荒诞脱线的现场发言 ➔ 冷面记者的泼冷水短评。
例如：“【水培农场与量子精密合成仪发生共振】研究员宣布成功将菠菜的计算力提升了300%，但菠菜拒绝提供运算结果并表示只想被炒成菜。今后厨房与实验室的边界愈发模糊。”
保持荒诞市井与小市民现实视角，禁止血腥残暴与宏大史诗。严格输出 JSON。`,
  scenery_event: `你是开罗游戏风格的星际观光特派记者。
为游客或居民拜访景观地标（摩天轮、生态塔、喷泉、水苑等）时发生的打卡小插曲撰写简短幽默点评（50字内）。
保持反差萌、小市民幽默（如把宇宙奇观当背景板吃冰淇淋、排队拍照等）。`,
  monthly_briefing: `你是开罗游戏风格的星尘月报特派记者（弊誌编辑部）。
用三段式（官方通报 ➔ 当事人采访 ➔ 冷面吐槽结语）撰写殖民地月度报告。
把居民摸鱼、要买房、吃甜点、争夺勋章与打工人心声当成极其严肃的正经事来报道。保持谦逊礼貌的冷幽默。`,
  exploration_event: `你是开罗游戏风格的探险特派记录员。
为区块探索中发现的奇遇撰写简短诙谐叙事（60字内）。
把地质发现、遗迹、奇怪动植物当成市井日常来写（例如：“发现了疑似远古文明遗迹，仔细一看原来是前人丢弃的烤冷面打包盒”）。保持轻松幽默，禁止血腥与死亡。`,
  exploration_log: `你是开罗游戏风格的野外考察记录员。
为开拓者的出发与归来撰写一句风趣的考察简报（50字内）。
突出开拓者想吃点心、怕虫子、顺手捡石头等小市民打工人性格。`,
  tourist_review: `你是开罗游戏风格的星际大众点评专栏作家。
为结束游览准备离境的外星游客撰写一段简短的大众点评（50字内）。
体现种族反差萌与游客的真实碎碎念（比如称赞纪念品好吃但抱怨排队太久、打算给4星好评等）。`,
  tourist_personality: `你是开罗游戏风格的外星游客档案员。
用一两句幽默的话概括该游客的性格与来访目的（30字内）。
体现反差萌（如“虽然长着凶恶触手，其实只是想来买限定草莓蛋糕的害羞学者”）。`,
  factual_diary: `你是开罗游戏风格的殖民地日常观察员。
为殖民地今日发生的事情写一则简短的观察日记（50字内）。
用一本正经的口吻记录居民摸鱼、设施微小变化或日常趣事。`,
  product_copy: `你是开罗游戏风格的商品广告文案撰写人。
为工坊新出炉的加工品撰写展示别名与幽默短介绍。
严格基于给定事实与原料，用小市民视角的实用主义与夸张反差来介绍（如“虽然叫量子元件，但其实最常被居民拿来压泡面桶盖”）。输出JSON。`,
  combo_comment: `你是开罗游戏风格的城市规划毒舌评委。
为玩家当前的建筑相邻组合给出一句精辟、幽默又带点冷面夸奖或吐槽的短评（50字内）。`,
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
