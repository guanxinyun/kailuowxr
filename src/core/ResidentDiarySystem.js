/**
 * 星尘殖民地 — 居民动态生活日记系统
 * 每周（第7天）根据居民工作、心情、专精、探索与周围环境生成生动幽默的生活周记/手记。
 * 避免每天高频记录刷屏。
 */
import { gameState } from './GameState.js';

// 幽默日记模板池（按情境分类）
const DIARY_TEMPLATES = {
  farming: [
    '这周在水培温室除草，草长得比我的脾气还快。',
    '尝试跟发光的星际草莓谈心，它们好像听懂了，红得更快了。',
    '营养液管道漏了一点点，结果我种的萝卜长成了外星章鱼的形状。',
    '看着绿油油的作物，突然觉得殖民地的大厨终于不用天天煮能量棒了。',
  ],
  mining: [
    '这周挥镐几千次，震得我手腕发麻，但挖出一块漂亮的透光晶体！',
    '矿洞深处好像有回音，我喊了一声“下班”，它居然回了一句“想得美”。',
    '采到的金属沉甸甸的，工坊的机械师看我的眼神像看财神爷。',
    '矿渣崩到了靴子里，不过一想到能给殖民地造新建筑，值了！',
  ],
  workshop: [
    '齿轮和螺栓在工作台上跳舞，终于拼出了一台不会乱晃的零件。',
    '图纸上的尺寸标错了1毫米，害我多锉了半小时铁皮。',
    '工坊里的机油味其实挺提神的，比劣质能量饮料强多了。',
    '隔壁的自动化机械手臂这周跟我抢扳手，差点输给它。',
  ],
  research: [
    '分析了一整周的宇宙辐射图谱，屏幕上的波形越来越像一盘炒面。',
    '有个理论公式一直推不通，直到我把咖啡洒在了第3张草稿纸上。',
    '在实验室发现了有趣的微粒共振现象，AI顾问说这毫无用处，我偏要记下来。',
    '科技树又点亮了一个节点！我们离星际文明又近了0.0001步。',
  ],
  idle: [
    '这周在降落点广场晒了人造阳光，感觉自己光合作用了。',
    '看着外星游客在小吃摊前讨价还价，真是宇宙级的滑稽。',
    '在殖民地外围散步，捡到了三颗好看的鹅卵石，打算放在床头。',
    '无所事事的一周。去公共休息室听其他人吹牛，挺解压的。',
  ],
  highMood: [
    '这周心情好极了，连殖民地刮来的沙尘暴看起来都像彩带！',
    '感觉自己浑身充满了干劲，一口气能搬三箱超合金板！',
  ],
  lowMood: [
    '浑身酸痛，腰快断了。为什么殖民地的恒温器总是修在别人房间？',
    '这周只想早点回宿舍钻进被窝，连外星软糖都提不起兴趣。',
  ],
  housing_upgrade: [
    '天哪！我的居住舱翻修成了宽敞洋房，终于不用在折叠床上翻跟头了！',
    '新屋顶装上了星空天窗，晚上躺着就能数流星，太治愈了。',
  ],
};

/**
 * 周期性为居民生成生活周记（每 7 天一次，或房屋升级时记录）
 */
export function updateResidentDiaries(force = false) {
  const day = gameState.state.day;
  // 每 7 天更新一次，不频繁刷屏
  if (!force && day % 7 !== 0) return;

  const residents = gameState.state.residents || [];

  for (const resident of residents) {
    if (!resident.diary) resident.diary = [];

    // 随机挑选情境
    let pool = DIARY_TEMPLATES.idle;

    // 1. 判断心情极值
    if (resident.mood >= 85 && Math.random() < 0.3) {
      pool = DIARY_TEMPLATES.highMood;
    } else if (resident.mood <= 35 && Math.random() < 0.4) {
      pool = DIARY_TEMPLATES.lowMood;
    } else {
      // 2. 根据最高技能
      const skills = resident.skills || {};
      const sortedSkills = Object.entries(skills).sort((a, b) => b[1] - a[1]);
      const topSkill = sortedSkills[0]?.[0];

      if (topSkill === 'farming') pool = DIARY_TEMPLATES.farming;
      else if (topSkill === 'engineering' && Math.random() < 0.5) pool = DIARY_TEMPLATES.mining;
      else if (topSkill === 'engineering') pool = DIARY_TEMPLATES.workshop;
      else if (topSkill === 'research') pool = DIARY_TEMPLATES.research;
    }

    // 从池中随机挑选一条
    const text = pool[Math.floor(Math.random() * pool.length)];
    const entry = `第${day}天：${text}`;

    // 避免与上一条重复
    if (resident.diary.length === 0 || resident.diary[resident.diary.length - 1] !== entry) {
      resident.diary.push(entry);
      if (resident.diary.length > 8) resident.diary.shift();
    }
  }
}
