import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRound,
  unlockGeneralCard,
  handleTechCardUnlock,
  getUnlockedGeneralCards,
} from '../src/core/CardGameSystem.js';
import { GENERAL_CARDS, getCardsUnlockedByTech, getDroppableCards } from '../src/data/cards.js';
import { validateEventProposal } from '../src/core/AIEventSystem.js';

test('通用卡牌数据完整且类型覆盖', () => {
  assert.ok(GENERAL_CARDS.length >= 10);
  const types = new Set(GENERAL_CARDS.map((c) => c.type));
  assert.ok(types.has('combat'));
  assert.ok(types.has('engineering'));
  assert.ok(types.has('research'));
  assert.ok(types.has('farming'));
  assert.ok(types.has('survival'));
  assert.ok(types.has('social'));
});

test('专精卡牌在判定时额外获得+1加成', () => {
  const normalCard = { type: 'combat', value: 5, special: false };
  const specialCard = { type: 'combat', value: 5, special: true };

  const normalRes = evaluateRound([normalCard], { type: 'combat', required: 6 }, 0);
  assert.equal(normalRes.sum, 5);
  assert.equal(normalRes.specialBonus, 0);
  assert.equal(normalRes.total, 5);
  assert.equal(normalRes.passed, false);

  const specialRes = evaluateRound([specialCard], { type: 'combat', required: 6 }, 0);
  assert.equal(specialRes.sum, 5);
  assert.equal(specialRes.specialBonus, 1);
  assert.equal(specialRes.total, 6);
  assert.equal(specialRes.passed, true);
});

test('通用卡牌解锁、去重与手牌转换', () => {
  const fakeState = { cards: { unlocked: [] } };
  assert.equal(unlockGeneralCard('card_tech_biotech', fakeState), true);
  assert.equal(unlockGeneralCard('card_tech_biotech', fakeState), false); // 重复解锁返回 false
  assert.deepEqual(fakeState.cards.unlocked, ['card_tech_biotech']);

  const generalCards = getUnlockedGeneralCards(fakeState);
  assert.equal(generalCards.length, 1);
  assert.equal(generalCards[0].cardId, 'card_tech_biotech');
  assert.equal(generalCards[0].isGeneral, true);
  assert.equal(generalCards[0].residentName, '殖民地资产');
});

test('科技研究自动解锁对应卡牌', () => {
  const fakeState = { cards: { unlocked: [] } };
  const unlocked = handleTechCardUnlock('biotech_1', fakeState);
  assert.equal(unlocked.length, 1);
  assert.equal(unlocked[0].id, 'card_tech_biotech');
  assert.ok(fakeState.cards.unlocked.includes('card_tech_biotech'));
});

test('未解锁的掉落卡牌可被正确列出', () => {
  const allDroppable = getDroppableCards([]);
  assert.ok(allDroppable.length > 0);
  const firstId = allDroppable[0].id;
  const remaining = getDroppableCards([firstId]);
  assert.equal(remaining.length, allDroppable.length - 1);
  assert.ok(!remaining.some((c) => c.id === firstId));
});

test('AI 动态卡牌校验与自动扩充牌库', () => {
  const dynamicCardRaw = {
    name: '星核裂变冲击',
    type: 'combat',
    value: 9,
    desc: '释放压缩星核的定向冲击波化解障碍。',
    flavor: '请勿在室内尝试。',
  };
  const fakeState = { cards: { unlocked: [], dynamicCards: [] } };
  const cardData = {
    id: 'ai_card_test_1',
    ...dynamicCardRaw,
    generated: true,
    sourceDrop: true,
  };
  assert.equal(unlockGeneralCard('ai_card_test_1', fakeState, cardData), true);
  assert.ok(fakeState.cards.unlocked.includes('ai_card_test_1'));
  assert.ok(fakeState.cards.dynamicCards.some((c) => c.id === 'ai_card_test_1'));

  const unlocked = getUnlockedGeneralCards(fakeState);
  assert.ok(unlocked.some((c) => c.cardId === 'ai_card_test_1' && c.generated === true));
});

test('AI 事件系统支持 diplomacy 与 alien 类型并校验通过', () => {
  const dipProposal = {
    title: '邻星使节团到访',
    type: 'diplomacy',
    narrative: '一支挥舞着旗帜的异星使节团降落在外围，声称要考察这里的点心铺。',
    choices: [
      { text: '招待招牌茶点', result: '使节团对食物赞不绝口。', tone: 'positive' },
      { text: '例行公事交接', result: '双方交换了基本信息。', tone: 'neutral' },
    ],
  };
  const result = validateEventProposal(dipProposal);
  assert.equal(result.ok, true);
  assert.equal(result.value.type, 'diplomacy');
  assert.equal(result.value.icon, 'handshake');
  assert.equal(result.value.choices[0].effect.diplomacy, 8);

  const alienProposal = {
    title: '发光的未知巨茧',
    type: 'alien',
    narrative: '勘探队在山洞深处发现了散发微光的巨茧，正在发出有节奏的呼噜声。',
    choices: [
      { text: '小心采集荧光样本', result: '获得了稀有的生物数据。', tone: 'positive' },
      { text: '保持距离静默观察', result: '记录了其生长规律。', tone: 'neutral' },
    ],
  };
  const alienRes = validateEventProposal(alienProposal);
  assert.equal(alienRes.ok, true);
  assert.equal(alienRes.value.type, 'alien');
  assert.equal(alienRes.value.icon, 'sparkles');
});
