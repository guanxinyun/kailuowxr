/**
 * 星尘殖民地 — 尖塔式卡牌战斗与遭遇系统 (Slay the Spire 风格)
 * 具备 HP/护盾/能量/意图预告/抽弃循环/居民属性动态加成/环境场效应/战前配卡/超频共鸣技。
 * 核心规则本地确定，AI 生成叙事文本。
 * 无永久死亡：全胜得丰厚奖励，撤退得保底物资。
 */
import { gameState } from './GameState.js';
import { bus } from './EventBus.js';
import { BALANCE } from '../data/balance.js';
import { aiClient } from '../ai/AIClient.js';
import { clamp } from './utils.js';
import { GENERAL_CARDS, ENVIRONMENT_CARDS, getGeneralCardById, getCardsUnlockedByTech, getDroppableCards } from '../data/cards.js';
import { sound } from './SoundSystem.js';

/** 技能类型（含中文标签和图标） */
const SKILL_TYPES = [
  { type: 'combat',     label: '战斗',   icon: 'swords' },
  { type: 'engineering', label: '工程',   icon: 'wrench' },
  { type: 'research',   label: '研究',   icon: 'flask-conical' },
  { type: 'farming',    label: '农耕',   icon: 'sprout' },
  { type: 'survival',   label: '生存',   icon: 'tent' },
  { type: 'social',     label: '社交',   icon: 'users' },
];

export function getCardTypeIcon(type) {
  return SKILL_TYPES.find((s) => s.type === type)?.icon || 'sparkles';
}

export function getCardTypeLabel(type) {
  return SKILL_TYPES.find((s) => s.type === type)?.label || type;
}

export function getAllSkillTypes() {
  return SKILL_TYPES.map((s) => s.type);
}

/** 洗牌算法（Fisher-Yates） */
export function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 基础卡牌保底注入：
 * 保证无论队员多偏科，底池里始终有最基础的攻、防、研手段，杜绝“卡死无牌可用”
 */
export function getStarterCards() {
  return [
    {
      id: 'starter_strike_1',
      name: '开拓打击',
      type: 'combat',
      cost: 1,
      damage: 7,
      block: 0,
      stats: { combat: 7, social: -1 },
      residentName: '队伍标配',
      label: '开拓打击',
      icon: 'swords',
      special: false,
      desc: '造成 7 点攻击伤害。',
    },
    {
      id: 'starter_strike_2',
      name: '开拓打击',
      type: 'combat',
      cost: 1,
      damage: 7,
      block: 0,
      stats: { combat: 7, social: -1 },
      residentName: '队伍标配',
      label: '开拓打击',
      icon: 'swords',
      special: false,
      desc: '造成 7 点攻击伤害。',
    },
    {
      id: 'starter_defend_1',
      name: '力场警戒',
      type: 'survival',
      cost: 1,
      damage: 0,
      block: 7,
      stats: { survival: 7, engineering: 1 },
      residentName: '队伍标配',
      label: '力场警戒',
      icon: 'shield',
      special: false,
      desc: '获得 7 点护盾。',
    },
    {
      id: 'starter_defend_2',
      name: '力场警戒',
      type: 'survival',
      cost: 1,
      damage: 0,
      block: 7,
      stats: { survival: 7, engineering: 1 },
      residentName: '队伍标配',
      label: '力场警戒',
      icon: 'shield',
      special: false,
      desc: '获得 7 点护盾。',
    },
    {
      id: 'starter_scan',
      name: '战术勘探',
      type: 'research',
      cost: 1,
      damage: 5,
      block: 5,
      draw: 1,
      stats: { research: 6, combat: 2 },
      residentName: '队伍标配',
      label: '战术勘探',
      icon: 'radar',
      special: false,
      desc: '造成 5 伤害，获得 5 护盾，抽 1 张牌。',
    },
  ];
}

/**
 * 居民属性深度强化卡牌算法：
 * 居民各项属性与专精等级对卡牌攻防、护盾、费用和额外效果进行动态缩放强化
 */
export function scaleCardByResident(card, resident) {
  if (!resident) return card;
  const skills = resident.skills || {};
  const prof = resident.proficiency || {};
  const isSpec = (prof[card.type] || 0) >= 3;

  // 战斗属性加成物理/能量攻击
  const combatBonus = Math.floor((skills.combat || 0) * 0.4);
  // 生存/工程属性加成护盾
  const shieldBonus = Math.floor(((skills.survival || 0) + (skills.engineering || 0)) * 0.25);
  // 研究属性加成抽牌或解析
  const researchBonus = Math.floor((skills.research || 0) * 0.3);
  // 社交/农耕加成治疗与减伤
  const healBonus = Math.floor(((skills.farming || 0) + (skills.social || 0)) * 0.2);

  const scaled = { ...card };
  scaled.stats = { ...(card.stats || { [card.type]: card.value }) };

  if (scaled.damage > 0) {
    scaled.damage += combatBonus + (scaled.type === 'research' ? researchBonus : 0);
  }
  if (scaled.block > 0) {
    scaled.block += shieldBonus;
  }
  if (scaled.heal > 0) {
    scaled.heal += healBonus;
  }

  // 专精特殊觉醒
  scaled.special = Boolean(isSpec);
  if (isSpec) {
    scaled.damage = scaled.damage > 0 ? scaled.damage + 3 : 0;
    scaled.block = scaled.block > 0 ? scaled.block + 3 : 0;
    scaled.label = `【专精】${scaled.name || scaled.label}`;
  }

  // 更新描述文本
  let descParts = [];
  if (scaled.damage > 0) descParts.push(`造成 ${scaled.damage} 点伤害`);
  if (scaled.block > 0) descParts.push(`获得 ${scaled.block} 点护盾`);
  if (scaled.heal > 0) descParts.push(`恢复 ${scaled.heal} 点生命`);
  if (scaled.draw > 0) descParts.push(`抽 ${scaled.draw} 张牌`);
  if (scaled.energyGain > 0) descParts.push(`恢复 ${scaled.energyGain} 点能量`);
  if (scaled.weaken > 0) descParts.push(`削弱敌方 ${scaled.weaken} 点攻击`);
  if (descParts.length > 0) scaled.desc = descParts.join('，') + '。';

  return scaled;
}

/** 为一组居民生成技能卡牌 */
export function generateResidentCards(residentIds) {
  const residents = residentIds
    .map((id) => gameState.state.residents.find((r) => r.id === id))
    .filter(Boolean);
  const cards = [];

  for (const r of residents) {
    const skills = r.skills || {};

    for (const { type, label, icon } of SKILL_TYPES) {
      const value = skills[type] || 0;
      if (value < 3) continue;

      let cost = 1;
      let damage = 0;
      let block = 0;
      let draw = 0;
      let heal = 0;
      let weaken = 0;

      if (type === 'combat') {
        cost = value >= 7 ? 2 : 1;
        damage = value >= 7 ? Math.round(value * 2.2) : Math.round(value * 1.5);
      } else if (type === 'survival' || type === 'engineering') {
        cost = 1;
        block = Math.round(value * 1.4);
        if (type === 'engineering') damage = 4;
      } else if (type === 'research') {
        cost = 1;
        damage = Math.round(value * 1.0);
        draw = 1;
      } else if (type === 'social') {
        cost = 1;
        block = Math.round(value * 1.1);
        weaken = 3;
      } else if (type === 'farming') {
        cost = 1;
        damage = Math.round(value * 1.0);
        block = 4;
        heal = 3;
      }

      const baseCard = {
        id: `card_${r.id}_${type}`,
        name: `${r.name}的${label}`,
        label: `${r.name}的${label}`,
        type,
        value,
        cost,
        damage,
        block,
        draw,
        heal,
        weaken,
        stats: { [type]: value },
        residentName: r.name,
        residentId: r.id,
        icon,
        isEnvironment: false,
      };

      cards.push(scaleCardByResident(baseCard, r));
    }
  }

  // 每人最多 4 张（按技能主数值降序排序）
  const byResident = new Map();
  for (const c of cards) {
    const list = byResident.get(c.residentId) || [];
    list.push(c);
    byResident.set(c.residentId, list);
  }
  const filtered = [];
  for (const list of byResident.values()) {
    list.sort((a, b) => (b.value || 0) - (a.value || 0));
    filtered.push(...list.slice(0, 4));
  }
  return filtered;
}

/** 敌方意图生成器（AI 风格/尖塔风格清晰预告） */
const ENEMY_TEMPLATES = [
  { name: '结晶伏击兽', maxHp: 30, icon: 'shield-alert', atkMin: 6, atkMax: 9, blkMin: 5, blkMax: 8 },
  { name: '巡航机械残骸', maxHp: 26, icon: 'bot', atkMin: 7, atkMax: 10, blkMin: 4, blkMax: 6 },
  { name: '狂暴荆棘幼体', maxHp: 32, icon: 'sprout', atkMin: 5, atkMax: 8, blkMin: 6, blkMax: 9 },
  { name: '电浆共振体', maxHp: 28, icon: 'zap', atkMin: 8, atkMax: 11, blkMin: 3, blkMax: 6 },
];

export function createEnemy(tileType, avgExploration = 10) {
  const template = ENEMY_TEMPLATES[Math.floor(Math.random() * ENEMY_TEMPLATES.length)];
  const scale = clamp(1 + (avgExploration - 10) * 0.03, 0.85, 1.2);
  const maxHp = Math.round(template.maxHp * scale);

  return {
    name: `${tileType ? `${tileType}·` : ''}${template.name}`,
    maxHp,
    hp: maxHp,
    block: 0,
    icon: template.icon,
    template,
    turnCount: 0,
    intent: null,
  };
}

export function rollEnemyIntent(enemy) {
  enemy.turnCount++;
  const t = enemy.template;
  const isAttack = enemy.turnCount % 2 === 1 || Math.random() < 0.6;
  if (isAttack) {
    const rawAtk = Math.floor(t.atkMin + Math.random() * (t.atkMax - t.atkMin + 1));
    const damage = enemy.turnCount === 1 ? Math.max(4, rawAtk - 2) : rawAtk;
    enemy.intent = {
      type: 'attack',
      damage,
      icon: 'swords',
      label: `攻击准备: 造成 ${damage} 点伤害`,
    };
  } else {
    const block = Math.floor(t.blkMin + Math.random() * (t.blkMax - t.blkMin + 1));
    enemy.intent = {
      type: 'defend',
      block,
      icon: 'shield',
      label: `坚固屏障: 获得 ${block} 点护盾`,
    };
  }
  return enemy.intent;
}

/** 获取战前可构筑的全部卡牌备选池 */
export function getBattleCardPool(outcome) {
  const starterCards = getStarterCards();
  const residentCards = generateResidentCards(outcome.residentIds || []);
  const generalCards = getUnlockedGeneralCards();
  return [...starterCards, ...residentCards, ...generalCards];
}

/** 初始化一场尖塔式对战（支持战前自定义卡组） */
export function initBattle(outcome, customDeck = null) {
  const allCards = customDeck && customDeck.length >= 5
    ? customDeck
    : getBattleCardPool(outcome);

  const avgExploration = outcome.avgExploration || 10;
  const enemy = createEnemy(outcome.tileName || '荒野', avgExploration);
  rollEnemyIntent(enemy);

  const resCount = outcome.residentIds?.length || 1;
  const playerMaxHp = 35 + resCount * 8;

  let environment = null;
  const envPool = (ENVIRONMENT_CARDS || []).filter(
    (e) => !e.tileType || e.tileType === outcome.tileType,
  );
  if (envPool.length > 0 && Math.random() < 0.85) {
    environment = envPool[Math.floor(Math.random() * envPool.length)];
  }

  const baseEnergy = environment?.modifiers?.energyMax ? 3 + environment.modifiers.energyMax : 3;

  const battle = {
    tileName: outcome.tileName,
    tileType: outcome.tileType,
    environment,
    player: {
      maxHp: playerMaxHp,
      hp: playerMaxHp,
      block: 0,
      energy: baseEnergy,
      maxEnergy: baseEnergy,
      overchargeAvailable: true,
    },
    enemy,
    drawPile: shuffleDeck(allCards),
    hand: [],
    discardPile: [],
    turn: 1,
    isOver: false,
    victory: false,
  };

  const initialDraw = environment?.modifiers?.drawCount ? 5 + environment.modifiers.drawCount : 5;
  drawToHand(battle, initialDraw);
  return battle;
}

export function drawToHand(battle, count = 5) {
  while (battle.hand.length < count) {
    if (battle.drawPile.length === 0) {
      if (battle.discardPile.length === 0) break;
      battle.drawPile = shuffleDeck(battle.discardPile);
      battle.discardPile = [];
    }
    battle.hand.push(battle.drawPile.pop());
  }
}

/** 玩家打出一张卡牌 */
export function playCardInBattle(battle, cardId) {
  if (battle.isOver) return { ok: false, reason: '战斗已结束' };
  const idx = battle.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { ok: false, reason: '手牌不存在' };
  const card = battle.hand[idx];

  const cost = card.cost || 1;
  if (battle.player.energy < cost) {
    return { ok: false, reason: '能量不足' };
  }

  battle.player.energy -= cost;
  battle.hand.splice(idx, 1);
  battle.discardPile.push(card);

  let appliedDmg = 0;
  let appliedBlk = 0;
  let appliedHeal = 0;

  // 1. 造成伤害（先扣敌人护盾，溢出扣 HP）
  if (card.damage > 0) {
    let dmg = card.damage;
    if (battle.environment?.modifiers?.combat) {
      dmg += battle.environment.modifiers.combat;
    }
    dmg = Math.max(1, dmg);

    if (battle.enemy.block >= dmg) {
      battle.enemy.block -= dmg;
    } else {
      const rem = dmg - battle.enemy.block;
      battle.enemy.block = 0;
      battle.enemy.hp = Math.max(0, battle.enemy.hp - rem);
    }
    appliedDmg = dmg;
  }

  // 2. 获得护盾
  if (card.block > 0) {
    let blk = card.block;
    if (battle.environment?.modifiers?.survival) {
      blk += battle.environment.modifiers.survival;
    }
    blk = Math.max(1, blk);
    battle.player.block += blk;
    appliedBlk = blk;
  }

  // 3. 队伍生命恢复
  if (card.heal > 0) {
    let healAmt = card.heal;
    if (battle.environment?.modifiers?.healBonus) {
      healAmt += battle.environment.modifiers.healBonus;
    }
    battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + healAmt);
    appliedHeal = healAmt;
  }

  // 4. 削弱敌方意图攻击
  if (card.weaken > 0 && battle.enemy.intent?.damage) {
    battle.enemy.intent.damage = Math.max(1, battle.enemy.intent.damage - card.weaken);
    battle.enemy.intent.label = `攻击准备: 造成 ${battle.enemy.intent.damage} 点伤害 (已削弱)`;
  }

  // 5. 额外能量恢复
  if (card.energyGain > 0) {
    battle.player.energy += card.energyGain;
  }

  // 6. 抽牌效果
  if (card.draw > 0) {
    drawToHand(battle, battle.hand.length + card.draw);
  }

  if (battle.enemy.hp <= 0) {
    battle.isOver = true;
    battle.victory = true;
  }

  return { ok: true, card, appliedDmg, appliedBlk, appliedHeal };
}

/** 队伍紧急超频共鸣技（每场限 1 次，破局必胜保底） */
export function triggerOvercharge(battle) {
  if (!battle.player.overchargeAvailable || battle.isOver) return false;
  battle.player.overchargeAvailable = false;

  const dmg = 12;
  if (battle.enemy.block >= dmg) {
    battle.enemy.block -= dmg;
  } else {
    const rem = dmg - battle.enemy.block;
    battle.enemy.block = 0;
    battle.enemy.hp = Math.max(0, battle.enemy.hp - rem);
  }
  battle.player.block += 8;

  if (battle.enemy.hp <= 0) {
    battle.isOver = true;
    battle.victory = true;
  }
  return true;
}

/** 结束玩家回合，执行敌方行动 */
export function endTurnInBattle(battle) {
  if (battle.isOver) return;

  // 1. 玩家手牌弃入弃牌堆
  battle.discardPile.push(...battle.hand);
  battle.hand = [];

  // 2. 敌方执行意图
  const intent = battle.enemy.intent;
  if (intent) {
    if (intent.type === 'attack') {
      const dmg = intent.damage;
      if (battle.player.block >= dmg) {
        battle.player.block -= dmg;
      } else {
        const rem = dmg - battle.player.block;
        battle.player.block = 0;
        battle.player.hp = Math.max(0, battle.player.hp - rem);
      }
    } else if (intent.type === 'defend') {
      battle.enemy.block += intent.block;
    }
  }

  if (battle.player.hp <= 0) {
    battle.isOver = true;
    battle.victory = false;
    return;
  }

  // 3. 进入下一回合：重置能量、护盾保留 50%、抽牌、预告新意图
  battle.turn++;
  battle.player.energy = battle.player.maxEnergy;
  battle.player.block = Math.floor(battle.player.block * 0.5);
  battle.enemy.block = Math.floor(battle.enemy.block * 0.5);

  rollEnemyIntent(battle.enemy);
  const drawCount = battle.environment?.modifiers?.drawCount ? 5 + battle.environment.modifiers.drawCount : 5;
  drawToHand(battle, drawCount);
}

/** 掷探索骰（兼容器件） */
export function rollExplorationDie() {
  const luck = BALANCE.cardGame?.dice?.luck || [-1, 0, 0, 1, 1, 2];
  const index = Math.floor(Math.random() * luck.length);
  return { roll: index + 1, luck: luck[index] };
}

/** 获取当前解锁的所有通用卡牌实例 */
export function getUnlockedGeneralCards(state = gameState.state) {
  const ids = state.cards?.unlocked || [];
  return ids.map((id) => getGeneralCardById(id, state)).filter(Boolean).map((c) => ({
    id: `unlocked_${c.id}`,
    cardId: c.id,
    type: c.type,
    value: c.value,
    cost: c.cost || 1,
    damage: c.damage || Math.round(c.value * 1.5),
    block: c.block || 0,
    draw: c.draw || 0,
    heal: c.heal || 0,
    weaken: c.weaken || 0,
    energyGain: c.energyGain || 0,
    stats: c.stats || { [c.type]: c.value },
    residentName: c.generated ? '外星遗物' : '殖民地资产',
    label: c.name,
    icon: c.icon,
    special: false,
    isGeneral: true,
    isEnvironment: false,
    desc: c.desc,
    flavor: c.flavor,
    generated: Boolean(c.generated),
  }));
}

/** 解锁通用卡牌 */
export function unlockGeneralCard(cardId, state = gameState.state, cardData = null) {
  if (!state.cards) state.cards = { unlocked: [], dynamicCards: [] };
  if (!state.cards.dynamicCards) state.cards.dynamicCards = [];
  if (cardData && !state.cards.dynamicCards.some((c) => c.id === cardData.id)) {
    state.cards.dynamicCards.push(cardData);
  }
  if (state.cards.unlocked.includes(cardId)) return false;
  const card = cardData || getGeneralCardById(cardId, state);
  if (!card) return false;
  state.cards.unlocked.push(cardId);
  sound.play('tech');
  bus.emit('card:unlocked', { cardId, card });
  gameState.addNotification({
    title: '解锁新卡牌！',
    text: `获得${card.generated ? '未知遗物' : '通用技能'}卡牌【${card.name}】（${getCardTypeLabel(card.type)} ${card.value}）`,
    type: 'success',
    icon: card.icon || 'sparkles',
  });
  return true;
}

export function handleTechCardUnlock(techId, state = gameState.state) {
  const cards = getCardsUnlockedByTech(techId);
  const unlocked = [];
  for (const c of cards) {
    if (unlockGeneralCard(c.id, state)) unlocked.push(c);
  }
  return unlocked;
}

/** 兼容旧版测试与轮次判定的 evaluateRound */
export function evaluateRound(selectedCards, requirement, diceLuck = 0, environment = null) {
  const totals = {};
  const skillTypes = getAllSkillTypes();
  for (const st of skillTypes) {
    totals[st] = 0;
  }

  let sum = 0;
  let specialBonus = 0;
  if (Array.isArray(selectedCards)) {
    for (const c of selectedCards) {
      const stats = c.stats || (c.type ? { [c.type]: c.value } : {});
      for (const [st, val] of Object.entries(stats)) {
        totals[st] = (totals[st] || 0) + val;
      }
      if (requirement.type === 'any' || (c.type && c.type === requirement.type)) {
        sum += c.value || 0;
      } else if (!requirement.type && stats[Object.keys(stats)[0]]) {
        sum += stats[Object.keys(stats)[0]];
      }
      if (c.special) specialBonus += 1;
    }
  }

  if (environment && environment.modifiers) {
    for (const [st, mod] of Object.entries(environment.modifiers)) {
      totals[st] = (totals[st] || 0) + mod;
    }
  }

  if (requirement.type && requirement.type !== 'any') {
    totals[requirement.type] = (totals[requirement.type] || 0) + diceLuck + specialBonus;
  }

  const reqs = requirement.requirements || (requirement.required !== undefined ? { [requirement.type]: requirement.required } : {});
  const dimResults = {};
  let passed = true;

  if (requirement.type === 'any' && requirement.required !== undefined) {
    const allSum = selectedCards.reduce((acc, c) => acc + (c.value || 0), 0) + specialBonus + diceLuck;
    passed = selectedCards.length > 0 && allSum >= requirement.required;
    dimResults.any = {
      actual: allSum,
      required: requirement.required,
      passed,
    };
  } else {
    for (const [reqDim, reqVal] of Object.entries(reqs)) {
      const actual = totals[reqDim] || 0;
      const ok = actual >= reqVal;
      dimResults[reqDim] = {
        actual,
        required: reqVal,
        passed,
      };
      if (!ok) passed = false;
    }
  }

  const primaryTotal = requirement.type === 'any'
    ? selectedCards.reduce((acc, c) => acc + (c.value || 0), 0) + specialBonus + diceLuck
    : (totals[requirement.type] || sum + specialBonus + diceLuck);

  return {
    passed,
    total: primaryTotal,
    sum,
    totals,
    dimResults,
    specialBonus,
    diceLuck,
    requirements: reqs,
  };
}

/** 兼容旧版挑战生成 */
export function generateChallenge(tileType, avgExploration = 10) {
  const cfg = BALANCE.cardGame || {};
  const roundsMin = cfg.roundsMin ?? 2;
  const roundsMax = cfg.roundsMax ?? 3;
  const roundCount = roundsMin + Math.floor(Math.random() * (roundsMax - roundsMin + 1));
  const availableTypes = getAllSkillTypes();
  const rounds = [];

  for (let i = 0; i < roundCount; i++) {
    const mainType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const reqMin = cfg.requiredValueMin ?? 8;
    const reqMax = cfg.requiredValueMax ?? 12;
    const mainVal = clamp(Math.floor(reqMin + Math.random() * (reqMax - reqMin + 1)), reqMin, reqMax);
    rounds.push({
      type: mainType,
      required: mainVal,
      requirements: { [mainType]: mainVal },
      label: `${getCardTypeLabel(mainType)} ≥ ${mainVal}`,
    });
  }

  return {
    title: `${tileType}遭遇`,
    narrative: `探索队在${tileType}遇到了异星阻碍，请运用卡牌与战术化解危机。`,
    rounds,
    tileType,
  };
}

export function calculateRewards(wonRounds, totalRounds, tileType) {
  const cfg = BALANCE.cardGame || {};
  const allWon = wonRounds === totalRounds;
  const someWon = wonRounds > 0;
  return { allWon, someWon, wonRounds, totalRounds, bonusMultiplier: allWon ? (cfg.bonusMultiplier ?? 1.5) : 1 };
}

// ===== AI 叙事 =====
export async function generateChallengeNarrative(challenge) {
  try {
    const raw = await aiClient.generate(
      'challenge_proposal',
      { tileType: challenge.tileType },
      () => ({ title: `${challenge.tileType}遭遇`, narrative: '探索队遇到了未知的异星生物，全员已进入戒备状态。' }),
      { cache: false },
    );
    if (raw && raw.title) {
      challenge.title = raw.title;
      challenge.narrative = raw.narrative;
    }
  } catch {}
  return challenge;
}
