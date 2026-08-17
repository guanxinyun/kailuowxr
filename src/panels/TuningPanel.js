/**
 * 星尘殖民地 — 全数值调制面板 (Tuning / Modding Panel)
 * 允许玩家实时调制全分类核心数值、一键应用预设、导出分享为 MOD JSON、导入玩家平衡包
 */
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { gameState } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { sound } from '../core/SoundSystem.js';
import { BUILDINGS } from '../data/buildings.js';
import { RESOURCES } from '../data/gamedata.js';
import {
  currentBalance,
  DEFAULT_BALANCE,
  BALANCE_PRESETS,
  setBalanceValue,
  applyPreset,
  exportBalanceMod,
  importBalanceMod,
  resetBalanceToDefault,
} from '../core/DynamicBalanceManager.js';

export function openTuningPanel() {
  const container = createElement('div', { className: 'tuning-panel' });

  let activeTab = 'presets'; // 'presets' | 'buildings' | 'general' | 'economy' | 'exploration' | 'import_export'

  const render = () => {
    container.replaceChildren();

    // 头部说明
    const header = createElement('div', {
      style: {
        padding: '12px 16px',
        background: 'rgba(241,196,15,0.08)',
        borderRadius: '8px',
        border: '1px solid rgba(241,196,15,0.25)',
        marginBottom: '14px',
        fontSize: '13px',
        lineHeight: '1.6',
        color: 'var(--text-secondary)',
      },
    }, [
      createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        createElement('strong', { style: { color: 'var(--color-energy)', fontSize: '14px' } }, [
          lucideIcon('sliders', 15),
          document.createTextNode(' 全局数值调制与 MOD 工坊'),
        ]),
        createElement('span', { style: { fontSize: '11px', opacity: 0.8 } }, ['实时热更新 · 支持导出分享']),
      ]),
      createElement('p', { style: { margin: '6px 0 0 0' } }, [
        '在这里你可以自由微调殖民地运行的一切规则、每个建筑的独立产出数值等。修改后即时生效，还可以将调制的平衡包导出为 JSON 分享给其他玩家！',
      ]),
    ]);
    container.appendChild(header);

    // 选项卡切换
    const tabsBar = createElement('div', {
      style: {
        display: 'flex',
        gap: '6px',
        borderBottom: '1px solid var(--border-glow)',
        paddingBottom: '8px',
        marginBottom: '14px',
        overflowX: 'auto',
      },
    });

    const tabDefs = [
      { id: 'presets', label: '🌟 官方预设', icon: 'sparkles' },
      { id: 'buildings', label: '🏗️ 建筑产出数值', icon: 'hammer' },
      { id: 'general', label: '⚙️ 生产与生活', icon: 'home' },
      { id: 'economy', label: '🪙 商业与贸易', icon: 'coins' },
      { id: 'exploration', label: '🧭 探索与卡牌', icon: 'compass' },
      { id: 'import_export', label: '📦 导出与导入', icon: 'file-json' },
    ];

    for (const tab of tabDefs) {
      const btn = createElement('button', {
        className: `btn ${activeTab === tab.id ? 'btn-primary' : ''}`,
        style: { fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' },
      }, [
        lucideIcon(tab.icon, 13),
        document.createTextNode(` ${tab.label}`),
      ]);
      btn.addEventListener('click', () => {
        activeTab = tab.id;
        render();
      });
      tabsBar.appendChild(btn);
    }
    container.appendChild(tabsBar);

    // 内容主体
    const contentBox = createElement('div', { className: 'tuning-content-box' });

    if (activeTab === 'presets') {
      renderPresetsTab(contentBox, render);
    } else if (activeTab === 'buildings') {
      renderBuildingsTab(contentBox);
    } else if (activeTab === 'general') {
      renderGeneralTab(contentBox);
    } else if (activeTab === 'economy') {
      renderEconomyTab(contentBox);
    } else if (activeTab === 'exploration') {
      renderExplorationTab(contentBox);
    } else if (activeTab === 'import_export') {
      renderImportExportTab(contentBox, render);
    }

    container.appendChild(contentBox);

    // 底部全局重置按钮
    const footer = createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      },
    }, [
      createElement('span', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, ['修改已自动保存在当前浏览器中']),
      createElement('button', { className: 'btn', style: { color: 'var(--color-danger)' } }, [
        lucideIcon('refresh-cw', 13),
        document.createTextNode(' 恢复官方默认数值'),
      ]),
    ]);
    footer.querySelector('button').addEventListener('click', () => {
      resetBalanceToDefault();
      sound.play('click');
      gameState.addNotification({
        title: '已重置数值',
        text: '所有游戏数值已恢复为官方标准设计。',
        type: 'info',
        icon: 'refresh-cw',
      });
      render();
    });
    container.appendChild(footer);
  };

  render();
  const content = ui.createModalContent('数值调制模式 (Modding Mode)', 'sliders', container);
  ui.openModal(content, 'modal-lg');
}

// ===== 预设选项卡 =====
function renderPresetsTab(container, refresh) {
  const grid = createElement('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' },
  });

  for (const preset of BALANCE_PRESETS) {
    const card = createElement('div', {
      style: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-glow)',
        borderRadius: '8px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '10px',
      },
    }, [
      createElement('div', {}, [
        createElement('h4', { style: { margin: '0 0 6px 0', fontSize: '14px', color: 'var(--color-energy)' } }, [preset.name]),
        createElement('p', { style: { margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' } }, [preset.desc]),
      ]),
      createElement('button', { className: 'btn btn-primary', style: { width: '100%', fontSize: '12px' } }, ['一键套用该预设']),
    ]);

    card.querySelector('button').addEventListener('click', () => {
      applyPreset(preset.id);
      sound.play('tech');
      gameState.addNotification({
        title: '预设已套用',
        text: `已切换至【${preset.name}】数值平衡。`,
        type: 'success',
        icon: 'check-circle',
      });
      refresh();
    });

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

// ===== 辅助组件：数值滑块调节行 =====
function createTuningRow(label, desc, path, value, min, max, step, unit = '', isInt = false) {
  const row = createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '10px 14px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.05)',
      marginBottom: '8px',
    },
  });

  const top = createElement('div', {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  }, [
    createElement('strong', { style: { fontSize: '13px', color: 'var(--text-primary)' } }, [label]),
    createElement('span', { className: 'tuning-val-display', style: { fontSize: '13px', fontWeight: 'bold', color: 'var(--color-energy)' } }, [`${value}${unit}`]),
  ]);

  const sub = createElement('div', {
    style: { fontSize: '11px', color: 'var(--text-secondary)' },
  }, [desc]);

  const slider = createElement('input', {
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    style: { width: '100%', cursor: 'pointer' },
  });

  slider.addEventListener('input', () => {
    const val = isInt ? parseInt(slider.value, 10) : parseFloat(slider.value);
    top.querySelector('.tuning-val-display').textContent = `${val}${unit}`;
    setBalanceValue(path, val);
  });

  row.appendChild(top);
  row.appendChild(sub);
  row.appendChild(slider);
  return row;
}

// ===== 建筑产出数值选项卡 =====
function renderBuildingsTab(container) {
  const b = currentBalance;
  if (!b.buildingBaseOutputs) b.buildingBaseOutputs = {};

  const hint = createElement('div', {
    style: {
      padding: '8px 12px',
      background: 'rgba(74, 144, 217, 0.08)',
      border: '1px solid rgba(74, 144, 217, 0.2)',
      borderRadius: '6px',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      marginBottom: '12px',
    },
  }, ['直接微调各建筑的基础日产出物理数值（金属/晶体/能量/食物/科研/星币），修改后立即影响每日产量结算。']);
  container.appendChild(hint);

  // 筛选出具有产出效果的建筑
  const productiveBuildings = BUILDINGS.filter(building => {
    if (!building.effect) return false;
    return building.effect.metal !== undefined ||
      building.effect.crystal !== undefined ||
      building.effect.energy !== undefined ||
      building.effect.food !== undefined ||
      building.effect.research !== undefined ||
      building.effect.income !== undefined;
  });

  for (const bldg of productiveBuildings) {
    const card = createElement('div', {
      style: {
        marginBottom: '12px',
        padding: '12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        border: '1px solid var(--border-glow)',
      },
    });

    const header = createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
    }, [
      lucideIcon(bldg.icon || 'building', 15),
      createElement('strong', { style: { fontSize: '13px', color: 'var(--text-primary)' } }, [bldg.name]),
      createElement('span', { style: { fontSize: '11px', color: 'var(--text-dim)' } }, [`(${bldg.desc})`]),
    ]);
    card.appendChild(header);

    // 各产出资源数值调节
    const resourceKeys = [
      { key: 'metal', label: '金属产出', max: 50, step: 1, unit: ' 单位' },
      { key: 'crystal', label: '晶体产出', max: 30, step: 1, unit: ' 单位' },
      { key: 'energy', label: '电力产出', max: 60, step: 1, unit: ' 单位' },
      { key: 'food', label: '食物产出', max: 50, step: 1, unit: ' 单位' },
      { key: 'research', label: '科研点产出', max: 40, step: 1, unit: ' 点' },
      { key: 'income', label: '星币收益', max: 100, step: 2, unit: ' 🪙' },
    ];

    for (const res of resourceKeys) {
      if (bldg.effect[res.key] !== undefined) {
        const defaultVal = Number(bldg.effect[res.key]) || 0;
        const currentVal = b.buildingBaseOutputs[bldg.id]?.[res.key] !== undefined
          ? b.buildingBaseOutputs[bldg.id][res.key]
          : defaultVal;

        const row = createTuningRow(
          `${res.label}`,
          `原版基础设计值: ${defaultVal}`,
          `buildingBaseOutputs.${bldg.id}.${res.key}`,
          currentVal,
          0,
          res.max,
          res.step,
          res.unit,
          true,
        );
        card.appendChild(row);
      }
    }

    container.appendChild(card);
  }
}

// ===== 生产与生活选项卡 =====
function renderGeneralTab(container) {
  const b = currentBalance;
  container.appendChild(createTuningRow('居民每日口粮消耗', '每位殖民者每天消耗的基础食物数量（默认 0.3）', 'foodPerResidentPerDay', b.foodPerResidentPerDay ?? 0.3, 0.05, 1.0, 0.05, ' 食物'));
  container.appendChild(createTuningRow('工坊加工时间倍率', '工坊加工订单所需天数倍率（越小加工越快，默认 1.0）', 'production.durationMultiplier', b.production?.durationMultiplier ?? 1.0, 0.1, 3.0, 0.1, 'x'));
  container.appendChild(createTuningRow('单栋建筑独立储备缓冲', '建筑产出累积达到该值后停滞，需搬运工入库（默认 5）', 'buildingBuffer.capacity', b.buildingBuffer?.capacity ?? 5, 1, 30, 1, ' 份', true));
  container.appendChild(createTuningRow('搬运员工日运载量', '每位物流搬运工每天可运送的最大物资件数（默认 12）', 'logistics.haulPerDay', b.logistics?.haulPerDay ?? 12, 2, 50, 2, ' 件', true));
  container.appendChild(createTuningRow('每周工作日天数', '标准工作周中居民出勤的天数（默认 5 天工作 2 天休息）', 'workSchedule.workDays', b.workSchedule?.workDays ?? 5, 1, 7, 1, ' 天/周', true));
}

// ===== 商业与经济选项卡 =====
function renderEconomyTab(container) {
  const b = currentBalance;
  container.appendChild(createTuningRow('游客基础消费倍率', '外星游客在餐厅、游乐场等商业设施消费的金额乘数（默认 1.0）', 'tourism.incomeMultiplier', b.tourism?.incomeMultiplier ?? 1.0, 0.2, 5.0, 0.2, 'x'));
  container.appendChild(createTuningRow('游客来访频率（最少间隔）', '两批游客到访殖民地的最短天数间隔（默认 5 天）', 'tourism.minimumArrivalDays', b.tourism?.minimumArrivalDays ?? 5, 1, 20, 1, ' 天', true));
  container.appendChild(createTuningRow('单类加工品储备上限', '仓库中每种加工品独立存放的封顶数量（默认 50）', 'inventory.maxPerItem', b.inventory?.maxPerItem ?? 50, 20, 500, 10, ' 份', true));
  container.appendChild(createTuningRow('日常奇遇与AI事件概率', '每天自然触发开罗风建筑奇遇或突发事件的基础概率（默认 1.5%）', 'events.dailyChance', Math.round((b.events?.dailyChance ?? 0.015) * 1000) / 10, 0.1, 10.0, 0.1, '%'));
}

// ===== 探索与卡牌选项卡 =====
function renderExplorationTab(container) {
  const b = currentBalance;
  container.appendChild(createTuningRow('区块探索初始派遣费', '探索新区块时每位队员需缴纳的初始准备金（默认 20）', 'blockExploration.costPerResident', b.blockExploration?.costPerResident ?? 20, 0, 100, 5, ' 🪙', true));
  container.appendChild(createTuningRow('探索队员每月维持费', '进行区块探索时每位队员每月的补给维持费（默认 20）', 'blockExploration.monthlyFeePerResident', b.blockExploration?.monthlyFeePerResident ?? 20, 0, 100, 5, ' 🪙/月', true));
  container.appendChild(createTuningRow('卡牌小游戏挑战概率', '探索遭遇事件时触发卡牌挑战判定的概率（默认 30%）', 'cardGame.challengeChance', Math.round((b.cardGame?.challengeChance ?? 0.3) * 100), 0, 100, 5, '%', true));
  container.appendChild(createTuningRow('卡牌全胜奖励倍率', '小游戏全部轮次完美过关时的物资与金币奖励倍率（默认 1.5x）', 'cardGame.bonusMultiplier', b.cardGame?.bonusMultiplier ?? 1.5, 1.0, 3.0, 0.1, 'x'));
  container.appendChild(createTuningRow('卡牌判定门槛下限', '单轮挑战判定所需技能值的随机最低要求（默认 8）', 'cardGame.requiredValueMin', b.cardGame?.requiredValueMin ?? 8, 3, 15, 1, ' 点', true));
}

// ===== 导出与导入选项卡 =====
function renderImportExportTab(container, refresh) {
  const box = createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });

  // 1. 导出区
  const exportSection = createElement('div', {
    style: {
      padding: '14px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '8px',
      border: '1px solid var(--border-glow)',
    },
  });
  exportSection.appendChild(createElement('h4', { style: { margin: '0 0 8px 0', fontSize: '13px', color: 'var(--color-energy)' } }, ['📤 导出当前平衡包（MOD JSON）']));

  const modNameInput = createElement('input', {
    className: 'settings-pack-name',
    placeholder: '平衡包名称（例如：超爽极速工坊MOD）',
    value: '我的自定义星尘平衡包',
  });
  const authorInput = createElement('input', {
    className: 'settings-pack-name',
    placeholder: '作者昵称',
    value: gameState.state.colonyName ? `${gameState.state.colonyName}指挥官` : '指挥官',
  });
  const exportBtn = createElement('button', { className: 'btn btn-primary', style: { alignSelf: 'flex-start' } }, [
    lucideIcon('download', 13),
    document.createTextNode(' 复制并下载平衡包 JSON'),
  ]);

  exportBtn.addEventListener('click', () => {
    const jsonStr = exportBalanceMod({
      name: modNameInput.value.trim(),
      author: authorInput.value.trim(),
    });

    // 复制到剪贴板
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).catch(() => {});
    }

    // 下载文件
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stardust-balance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    sound.play('cash');
    gameState.addNotification({
      title: '平衡包已导出',
      text: '已将 MOD JSON 复制到剪贴板并触发下载文件，可直接分享给他人！',
      type: 'success',
      icon: 'download',
    });
  });

  exportSection.appendChild(createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } }, [modNameInput, authorInput]));
  exportSection.appendChild(exportBtn);
  box.appendChild(exportSection);

  // 2. 导入区
  const importSection = createElement('div', {
    style: {
      padding: '14px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '8px',
      border: '1px solid var(--border-glow)',
    },
  });
  importSection.appendChild(createElement('h4', { style: { margin: '0 0 8px 0', fontSize: '13px', color: 'var(--color-knowledge)' } }, ['📥 导入玩家平衡包']));

  const jsonTextarea = createElement('textarea', {
    className: 'ai-instruction',
    placeholder: '在此粘贴从社区或朋友处获得的平衡包 JSON 文本...',
    style: { minHeight: '90px' },
  });

  const importActions = createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } });

  const importBtn = createElement('button', { className: 'btn btn-primary' }, [
    lucideIcon('upload', 13),
    document.createTextNode(' 导入并应用平衡包'),
  ]);

  const fileInput = createElement('input', { type: 'file', accept: '.json', style: { display: 'none' } });
  const uploadFileBtn = createElement('button', { className: 'btn' }, [
    lucideIcon('file-up', 13),
    document.createTextNode(' 从文件加载'),
  ]);

  uploadFileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        jsonTextarea.value = evt.target?.result || '';
      };
      reader.readAsText(file);
    }
  });

  importBtn.addEventListener('click', () => {
    const content = jsonTextarea.value.trim();
    if (!content) {
      gameState.addNotification({ title: '导入失败', text: '请先粘贴或上传平衡包 JSON 内容', type: 'warning', icon: 'alert-triangle' });
      return;
    }
    const result = importBalanceMod(content);
    if (!result.ok) {
      gameState.addNotification({ title: '导入失败', text: result.reason, type: 'danger', icon: 'x-circle' });
    } else {
      sound.play('tech');
      gameState.addNotification({
        title: '平衡包导入成功！',
        text: `已成功载入【${result.meta.modName || '自定义平衡'}】（作者: ${result.meta.author || '匿名'}），数值已即时生效。`,
        type: 'success',
        icon: 'check-circle',
        duration: 5000,
      });
      refresh();
    }
  });

  importActions.appendChild(importBtn);
  importActions.appendChild(uploadFileBtn);
  importActions.appendChild(fileInput);

  importSection.appendChild(jsonTextarea);
  importSection.appendChild(importActions);
  box.appendChild(importSection);

  container.appendChild(box);
}
