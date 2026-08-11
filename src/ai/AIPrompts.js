/**
 * 星尘殖民地 — AI 请求类型定义 & 提示词模板
 * 定义所有 AI 请求类型、优先级、模拟延迟和提示词
 * 未来接入真实 AI API 时，提示词将作为 system prompt 发送
 */

// ===== 请求类型枚举 =====
export const AI_REQUEST_TYPES = {
  CONTEXTUAL_TIP:   'contextual_tip',    // 情境建议（底部消息栏）
  BUILDING_TIP:     'building_tip',      // 建筑建议（建造面板）
  DIARY:            'diary',             // 居民日记生成
  ANNUAL_COMMENT:   'annual_comment',    // 年终评语
  DIPLOMACY_ADVICE: 'diplomacy_advice',  // 外交建议
  RESIDENT_TIP:     'resident_tip',      // 居民面板建议
  EVENT_NARRATION:  'event_narration',   // 事件叙述增强
};

// ===== 请求配置 =====
export const REQUEST_CONFIG = {
  [AI_REQUEST_TYPES.CONTEXTUAL_TIP]: {
    priority: 3,        // 低优先级（后台定期触发）
    minDelay: 500,      // 模拟最小延迟 ms
    maxDelay: 1200,     // 模拟最大延迟 ms
    cacheTTL: 60000,    // 缓存有效期 1 分钟
    maxLength: 100,     // 最大文本长度
  },
  [AI_REQUEST_TYPES.BUILDING_TIP]: {
    priority: 2,        // 中优先级（用户主动查看）
    minDelay: 600,
    maxDelay: 1500,
    cacheTTL: 300000,   // 缓存 5 分钟
    maxLength: 120,
  },
  [AI_REQUEST_TYPES.DIARY]: {
    priority: 2,
    minDelay: 800,
    maxDelay: 2000,
    cacheTTL: 0,        // 不缓存（每次生成不同内容）
    maxLength: 200,
  },
  [AI_REQUEST_TYPES.ANNUAL_COMMENT]: {
    priority: 1,        // 高优先级（重要 UI 展示）
    minDelay: 1000,
    maxDelay: 2500,
    cacheTTL: 0,
    maxLength: 300,
  },
  [AI_REQUEST_TYPES.DIPLOMACY_ADVICE]: {
    priority: 2,
    minDelay: 600,
    maxDelay: 1500,
    cacheTTL: 120000,   // 缓存 2 分钟
    maxLength: 150,
  },
  [AI_REQUEST_TYPES.RESIDENT_TIP]: {
    priority: 2,
    minDelay: 500,
    maxDelay: 1200,
    cacheTTL: 30000,    // 缓存 30 秒
    maxLength: 120,
  },
  [AI_REQUEST_TYPES.EVENT_NARRATION]: {
    priority: 1,
    minDelay: 400,
    maxDelay: 1000,
    cacheTTL: 0,
    maxLength: 100,
  },
};

// ===== 系统提示词模板 =====
// 未来接入真实 AI API 时使用
export const SYSTEM_PROMPTS = {
  [AI_REQUEST_TYPES.CONTEXTUAL_TIP]: `你是星尘殖民地的AI顾问系统。根据当前殖民地状态生成一条简短的建议。
要求：
- 使用中文
- 不超过50个字
- 语气专业但友好
- 根据提供的资源数据给出针对性建议
当前状态：{context}`,

  [AI_REQUEST_TYPES.BUILDING_TIP]: `你是星尘殖民地的建筑顾问。为指定建筑生成建造建议。
要求：
- 使用中文
- 不超过60个字
- 说明该建筑的战略价值和最佳放置位置
建筑信息：{context}`,

  [AI_REQUEST_TYPES.DIARY]: `你是星尘殖民地的居民{name}。以第一人称写一篇简短的日记。
要求：
- 使用中文
- 50-100字
- 反映角色性格特征：{traits}
- 包含对殖民地生活的观察和感受
当前心情：{mood}`,

  [AI_REQUEST_TYPES.ANNUAL_COMMENT]: `你是星尘殖民地的年度评估系统。根据各维度得分生成年终评语。
要求：
- 使用中文
- 80-150字
- 客观分析优势和不足
- 给出下一年的发展建议
评分数据：{context}`,

  [AI_REQUEST_TYPES.DIPLOMACY_ADVICE]: `你是星尘殖民地的外交顾问。为与指定外星种族的外交关系提供建议。
要求：
- 使用中文
- 不超过60个字
- 根据种族特点给出具体的外交策略
种族信息：{context}`,

  [AI_REQUEST_TYPES.RESIDENT_TIP]: `你是星尘殖民地的人力资源顾问。分析居民状态并给出管理建议。
要求：
- 使用中文
- 不超过60个字
- 关注居民幸福度和工作效率
居民数据：{context}`,

  [AI_REQUEST_TYPES.EVENT_NARRATION]: `你是星尘殖民地的事件记录员。为随机事件添加叙事描述。
要求：
- 使用中文
- 不超过40个字
- 增强事件的沉浸感
事件信息：{context}`,
};
