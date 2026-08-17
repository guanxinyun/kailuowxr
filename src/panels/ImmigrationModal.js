/**
 * 星尘殖民地 — 移民中心与居民招募弹窗
 * 消耗星币发布银河招募令，候选人抵达后触发考评面试（技能卡牌匹配挑战）。
 * 挑战判定通过正式接纳为新居民，并自动绑定居住舱。
 */
import { bus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { showCardGameModal } from './CardGameModal.js';
import { sound } from '../core/SoundSystem.js';

const CANDIDATE_ARCHETYPES = [
  { name: '雷克斯', title: '地质采矿工程师', icon: 'pickaxe', skills: { combat: 3, engineering: 8, research: 4, farming: 2, survival: 6, social: 3 }, traits: ['沉稳', '勤勉'] },
  { name: '艾莉亚', title: '星际植物学家', icon: 'sprout', skills: { combat: 2, engineering: 3, research: 7, farming: 8, survival: 5, social: 4 }, traits: ['细心', '热爱自然'] },
  { name: '诺亚', title: '量子计算学者', icon: 'flask-conical', skills: { combat: 1, engineering: 5, research: 9, farming: 1, survival: 3, social: 5 }, traits: ['博学', '夜猫子'] },
  { name: '薇薇安', title: '探险游侠', icon: 'compass', skills: { combat: 7, engineering: 4, research: 3, farming: 3, survival: 8, social: 6 }, traits: ['勇敢', '敏锐'] },
  { name: '奥利弗', title: '殖民地调解员', icon: 'smile', skills: { combat: 2, engineering: 3, research: 4, farming: 4, survival: 4, social: 9 }, traits: ['热情', '善谈'] },
];

export function openImmigrationModal() {
  const container = createElement('div', { className: 'immigration-modal-inner', style: { display: 'flex', flexDirection: 'column', gap: '16px' } });

  const hasImmigrationCenter = gameState.state.buildings.some((b) => b.buildingId === 'immigration_center' && b.built);
  const currentPop = gameState.state.residents.length;
  const maxPop = gameState.state.maxPopulation || 4;
  const RECRUIT_COST = 120;

  // 头部介绍
  const banner = createElement('div', {
    style: {
      padding: '12px 16px',
      background: 'linear-gradient(135deg, rgba(74,144,217,0.15), rgba(155,89,182,0.15))',
      borderRadius: '8px',
      border: '1px solid rgba(74,144,217,0.3)',
      fontSize: '13px',
      lineHeight: '1.6',
    },
  }, [
    createElement('div', { style: { fontWeight: 'bold', fontSize: '14px', color: 'var(--color-knowledge)', marginBottom: '4px' } }, [
      lucideIcon('users', 16), document.createTextNode(' 银河开拓者招募署'),
    ]),
    document.createTextNode(`当前殖民地人口：${currentPop} / ${maxPop} (居住舱容量)。向深空通讯网络广播招募令，吸引专业技术人才前来应聘！`),
  ]);
  container.appendChild(banner);

  if (!hasImmigrationCenter) {
    container.appendChild(createElement('div', {
      style: { textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: '13px' },
    }, [
      lucideIcon('lock', 24),
      createElement('p', { style: { marginTop: '8px' } }, ['尚未建造【星际移民中心】！请先研发 Tier 1 科技【星际招募协议】并建造移民中心。']),
    ]));
  } else {
    // 招募按钮区域
    const actionBox = createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        border: '1px solid var(--border-glow)',
      },
    });

    const info = createElement('div', {}, [
      createElement('strong', { style: { display: 'block', fontSize: '14px' } }, ['发布全频段招募令']),
      createElement('span', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, [`消耗 ${RECRUIT_COST} 星币 · 开启候选人能力面试小游戏`]),
    ]);

    const recruitBtn = createElement('button', {
      className: 'btn btn-primary',
      disabled: gameState.state.resources.credits < RECRUIT_COST || currentPop >= maxPop,
    }, [
      lucideIcon('send', 14),
      document.createTextNode(currentPop >= maxPop ? ' 居住舱已满' : ` 发起招募 (${RECRUIT_COST} 🪙)`),
    ]);

    recruitBtn.addEventListener('click', () => {
      if (gameState.state.resources.credits < RECRUIT_COST) {
        gameState.addNotification({ title: '星币不足', text: `需要 ${RECRUIT_COST} 星币`, type: 'warning', icon: 'coins' });
        return;
      }

      gameState.addResource('credits', -RECRUIT_COST);
      sound.play('cash');
      ui.closeModal();

      // 挑选候选人
      const existingNames = new Set(gameState.state.residents.map((r) => r.name));
      const pool = CANDIDATE_ARCHETYPES.filter((c) => !existingNames.has(c.name));
      const candidate = pool.length ? pool[Math.floor(Math.random() * pool.length)] : {
        name: `开拓者${Math.floor(Math.random() * 900 + 100)}号`,
        title: '多功能技师',
        icon: 'user',
        skills: { combat: 5, engineering: 5, research: 5, farming: 5, survival: 5, social: 5 },
        traits: ['坚毅'],
      };

      // 启动考评面试卡牌小游戏
      setTimeout(() => {
        showCardGameModal({
          tileName: '移民中心面试处',
          isChallenge: true,
          residentIds: gameState.state.residents.map((r) => r.id),
        }, ({ allWon, someWon }) => {
          if (allWon || someWon) {
            // 招募成功
            const newResident = {
              id: `res_${Date.now()}`,
              name: candidate.name,
              title: candidate.title,
              icon: candidate.icon,
              skills: { ...candidate.skills },
              traits: [...candidate.traits],
              level: 1,
              xp: 0,
              mood: 90,
              diary: [`第${gameState.state.day}天：通过了殖民地面试，正式成为这里的一员！`],
            };
            gameState.state.residents.push(newResident);
            sound.play('card_win');
            gameState.addNotification({
              title: '新居民入驻！',
              text: `${candidate.name}（${candidate.title}）顺利通过考核，已正式加入殖民地！`,
              type: 'success',
              icon: 'user-plus',
              duration: 6000,
            });
            bus.emit('resident:recruited', { resident: newResident });
          } else {
            // 未通过退还一半星币
            const refund = Math.floor(RECRUIT_COST * 0.5);
            gameState.addResource('credits', refund);
            sound.play('card_fail');
            gameState.addNotification({
              title: '面试未通过',
              text: `候选人未能与团队达成默契，已退还部分公关差旅费 ${refund} 星币。`,
              type: 'info',
              icon: 'rotate-ccw',
              duration: 5000,
            });
          }
        });
      }, 300);
    });

    actionBox.appendChild(info);
    actionBox.appendChild(recruitBtn);
    container.appendChild(actionBox);
  }

  const content = ui.createModalContent('星际移民与招募', 'users', container);
  ui.openModal(content, 'modal-md');
}
