/**
 * 星尘殖民地 — 探索 + 统计 + 设置面板
 */
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon, formatNumber } from '../core/utils.js';
import { RESOURCES, EXPLORE_REGIONS, MAP_EXPANSION } from '../data/gamedata.js';
import { bus } from '../core/EventBus.js';
import { TutorialManager } from '../core/TutorialManager.js';
import { textureManager } from '../core/TextureManager.js';
import { TEXTURE_SLOTS, getTextureSlotsByCategory } from '../data/textureSlots.js';
import { openCropModal } from './TextureCropModal.js';
import { openBuildingFaceModal } from './BuildingFaceModal.js';
import { openSpriteFaceModal } from './SpriteFaceModal.js';
import { canStartExpedition, startExpedition, generateRandomExpedition } from '../core/ExplorationSystem.js';
import { getInventoryQuantity } from '../core/ProductionSystem.js';
import { saveManager } from '../core/SaveManager.js';
import { getCurrentDailyResourceFlow, formatDailyRate } from '../core/ResourceFlowSystem.js';
import { canExpand, getExpansionCost, purchaseExpansion } from '../core/MapExpansionSystem.js';

// ===== 探索面板 =====

function formatRewardPool(pool) {
  return Object.entries(pool).map(([res, range]) => {
    const name = RESOURCES[res]?.name || res;
    return Array.isArray(range) ? `${name} ${range[0]}~${range[1]}` : `${name} ${range}`;
  }).join('、');
}

function renderRegionCard(region, residentId, active, render) {
  const explored = gameState.state.exploredRegions.includes(region.id);
  const validation = canStartExpedition(region.id, residentId);
  const card = createElement('div', { className: `region-card ${explored ? 'explored' : ''}` });
  const iconName = explored ? 'check' : region.isRandom ? 'shuffle' : region.biome === 'snow' ? 'snowflake' : region.biome === 'desert' ? 'sun' : 'compass';
  card.appendChild(createElement('div', { style: { flex: '0 0 32px' } }, [lucideIcon(iconName, 20)]));
  const info = createElement('div', { style: { flex: '1' } });
  info.appendChild(createElement('div', { style: { fontWeight: '700', marginBottom: '2px' } }, [
    region.name,
    region.isRandom ? ' ✦' : '',
  ]));
  info.appendChild(createElement('div', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, [region.desc]));
  // 奖励范围
  const pool = region.rewardPool || region.rewards;
  if (pool && !explored) {
    info.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--color-food)', marginTop: '2px' } }, [`可能获得：${formatRewardPool(pool)}`]));
  }
  // 需求
  const requirements = [];
  if (region.days) requirements.push(`${region.days}天`);
  else if (region.distance) requirements.push(`${Math.max(2, region.distance)}天`);
  if (region.requiredExploration) requirements.push(`探索力${region.requiredExploration}`);
  if (region.requiredSurvival) requirements.push(`生存${region.requiredSurvival}`);
  if (region.supply) requirements.push(`补给 ${getInventoryQuantity(region.supply)}/1`);
  if (requirements.length) info.appendChild(createElement('div', { className: 'exploration-requirements' }, [requirements.join(' · ')]));
  if (!explored && !validation.ok) info.appendChild(createElement('div', { className: 'exploration-blocked' }, [validation.reason]));
  card.appendChild(info);
  if (!explored && !active) {
    const button = createElement('button', { className: `btn btn-primary ${validation.ok ? '' : 'is-blocked'}`, title: validation.ok ? '开始考察' : validation.reason }, [lucideIcon('send', 14), document.createTextNode(' 出发')]);
    button.addEventListener('click', () => {
      const result = startExpedition(region.id, residentId);
      if (!result.ok) gameState.addNotification({ title: '无法出发', text: result.reason, type: 'warning', icon: 'info' });
      render();
    });
    card.appendChild(button);
  }
  return card;
}

export function openExplorePanel() {
  const container = createElement('div', { className: 'explore-panel-inner' });
  const selectedResident = gameState.state.residents[0]?.id || '';
  let residentId = selectedResident;
  const residentSelect = createElement('select', { className: 'settings-texture-select' });
  for (const resident of gameState.state.residents) {
    residentSelect.appendChild(createElement('option', { value: resident.id }, [`${resident.name} · 探索力${resident.exploration || 10} · 生存${resident.skills?.survival || 1}`]));
  }
  residentSelect.addEventListener('change', () => { residentId = residentSelect.value; render(); });
  container.appendChild(createSettingRow('考察居民', residentSelect));
  const list = createElement('div', { className: 'explore-regions' });
  container.appendChild(list);
  const expansionSection = createElement('div');
  container.appendChild(expansionSection);

  const render = () => {
    list.replaceChildren();
    const active = gameState.state.activeExploration;

    // 当前进行中
    if (active) {
      const randomExp = gameState.state.randomExpedition;
      const region = active.isRandom ? randomExp : EXPLORE_REGIONS.find(entry => entry.id === active.regionId);
      const resident = gameState.state.residents.find(entry => entry.id === active.residentId);
      list.appendChild(createElement('div', { className: 'exploration-active' }, [
        createElement('strong', {}, [`${resident?.name || '居民'}正在考察${region?.name || '未知区域'}`]),
        createElement('span', {}, [`剩余 ${Math.ceil(active.remainingDays)} / ${active.totalDays} 天`]),
      ]));
    }

    // 特殊区域（已解锁的）
    const unlockedSet = new Set(gameState.state.unlockedRegions);
    let hasSpecial = false;
    for (const region of EXPLORE_REGIONS) {
      if (!unlockedSet.has(region.id)) continue;
      hasSpecial = true;
      list.appendChild(renderRegionCard(region, residentId, active, render));
    }

    // 锁定提示
    const totalLocked = EXPLORE_REGIONS.filter(r => !unlockedSet.has(r.id)).length;
    if (totalLocked > 0) {
      list.appendChild(createElement('div', {
        style: { textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }
      }, [`还有 ${totalLocked} 个特殊区域等待发现…`]));
    }

    // 随机考察任务
    if (!active || active.isRandom) {
      const divider = createElement('div', {
        style: { fontWeight: '700', fontSize: '13px', margin: '12px 0 6px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }
      }, ['随机考察']);
      list.appendChild(divider);

      if (!active) {
        const randomExp = generateRandomExpedition();
        list.appendChild(renderRegionCard(randomExp, residentId, active, render));
      }
    }

    // 地图拓展
    renderExpansion();
  };

  const renderExpansion = () => {
    expansionSection.replaceChildren();
    expansionSection.appendChild(createElement('div', {
      style: { fontWeight: '700', fontSize: '13px', margin: '14px 0 8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }
    }, ['地图拓展']));

    const check = canExpand();
    const cost = getExpansionCost();
    const count = gameState.state.mapExpansion.count || 0;
    const card = createElement('div', {
      style: { padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }
    });
    card.appendChild(createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
      lucideIcon(MAP_EXPANSION.icon, 16),
      createElement('span', { style: { fontWeight: '600', fontSize: '13px' } }, [MAP_EXPANSION.label]),
      ...(count > 0 ? [createElement('span', { style: { fontSize: '11px', color: 'var(--text-dim)' } }, [`×${count}`])] : []),
    ]));
    if (check.reason === '地图已完全探索') {
      card.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' } }, ['✓ 已完全探索']));
    } else {
      if (cost) {
        const costText = Object.entries(cost).map(([res, amt]) => `${RESOURCES[res]?.name || res} ${amt}`).join(' + ');
        card.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' } }, [costText]));
      }
      card.appendChild(createElement('div', { style: { fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' } }, ['向四周扩展 3 层']));
      const btn = createElement('button', {
        className: `btn btn-primary ${check.ok ? '' : 'is-blocked'}`,
        title: check.ok ? '购买拓展' : (check.reason || ''),
        style: { marginTop: '6px', fontSize: '12px', padding: '4px 10px' },
      }, [lucideIcon('map', 13), document.createTextNode(' 拓展')]);
      btn.addEventListener('click', () => { purchaseExpansion(); render(); });
      card.appendChild(btn);
    }
    expansionSection.appendChild(card);
  };

  render();
  const content = ui.createModalContent('和平考察', 'compass', container);
  ui.openModal(content, 'modal-lg');
}

// ===== 统计面板 =====
export function openStatsPanel() {
  const s = gameState.state;
  const stats = s.stats;

  const container = createElement('div', { className: 'stats-panel-inner' });
  const grid = createElement('div', { className: 'stats-grid' });

  const items = [
    { label: '已存活天数', value: stats.daysPlayed, icon: 'sun' },
    { label: '当前年份', value: `Y${s.year}`, icon: 'calendar' },
    { label: '人口', value: `${s.population}/${s.maxPopulation}`, icon: 'users' },
    { label: '幸福度', value: `${s.happiness}%`, icon: 'star' },
    { label: '已建造建筑', value: stats.totalBuildings, icon: 'home' },
    { label: '已研究科技', value: s.researchedTechs.length, icon: 'flask-conical' },
    { label: '已触发事件', value: stats.eventsTriggered, icon: 'zap' },
    { label: '已探索区域', value: s.exploredRegions.length, icon: 'compass' },
  ];

  for (const item of items) {
    grid.appendChild(createElement('div', { className: 'stat-card' }, [
      createElement('div', { className: 'stat-card-label' }, [
        lucideIcon(item.icon, 12),
        document.createTextNode(' ' + item.label),
      ]),
      createElement('div', { className: 'stat-card-value' }, [String(item.value)]),
    ]));
  }

  container.appendChild(grid);

  // Resource summary
  container.appendChild(createElement('h3', {
    style: { fontSize: '16px', fontWeight: '700', margin: '24px 0 12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' },
  }, ['资源总览']));

  const dailyFlow = getCurrentDailyResourceFlow();
  const resGrid = createElement('div', { className: 'stats-grid' });
  for (const [key, val] of Object.entries(s.resources)) {
    const max = s.storage[key];
    const resInfo = RESOURCES[key];
    const resName = resInfo ? resInfo.name : key;
    resGrid.appendChild(createElement('div', { className: 'stat-card' }, [
      createElement('div', { className: 'stat-card-label' }, [
        resInfo ? lucideIcon(resInfo.icon, 12) : null,
        document.createTextNode(' ' + resName),
      ].filter(Boolean)),
      createElement('div', { className: 'stat-card-value' }, [formatNumber(val)]),
      createElement('div', { className: 'stat-card-flow' }, [
        `产出 +${formatDailyRate(dailyFlow.production[key])}/天`,
        dailyFlow.consumption[key] > 0 ? ` · 消耗 -${formatDailyRate(dailyFlow.consumption[key])}/天` : '',
        ` · ${dailyFlow.net[key] >= 0 ? '净增 +' : '净减 -'}${formatDailyRate(Math.abs(dailyFlow.net[key]))}/天`,
      ]),
      max !== Infinity ? createElement('div', { className: 'progress-bar', style: { marginTop: '4px' } }, [
        createElement('div', { className: 'progress-fill', style: { width: `${(val / max) * 100}%` } }),
      ]) : null,
    ].filter(Boolean)));
  }
  container.appendChild(resGrid);

  const content = ui.createModalContent('统计', 'bar-chart-3', container);
  ui.openModal(content, 'modal-lg');
}

// ===== 设置面板 =====
export function openSettingsPanel() {
  const container = createElement('div', { className: 'settings-panel-inner' });

  // Game settings
  const gameSection = createElement('div', { className: 'settings-section' });
  gameSection.appendChild(createElement('h3', {}, ['游戏']));

  // Volume
  gameSection.appendChild(createSettingRow('音效音量', createSlider(70)));
  gameSection.appendChild(createSettingRow('音乐音量', createSlider(50)));

  // Toggle settings
  gameSection.appendChild(createSettingRow('自动保存', createToggle(true)));
  gameSection.appendChild(createSettingRow('显示教程提示', createToggle(true)));
  gameSection.appendChild(createSettingRow('显示网格线', createToggle(true)));

  // 重新开始教程按钮
  const tutorialBtn = createElement('button', { className: 'btn btn-primary', style: { marginTop: '8px' } }, [
    lucideIcon('book-open', 14),
    document.createTextNode(' 重新开始教程'),
  ]);
  tutorialBtn.addEventListener('click', () => {
    localStorage.removeItem('stardust_tutorial_done');
    ui.closeModal();
    setTimeout(() => {
      const tutorial = new TutorialManager();
      tutorial.start();
    }, 300);
  });
  gameSection.appendChild(tutorialBtn);

  container.appendChild(gameSection);

  container.appendChild(createTextureSettings());

  // Display settings
  const displaySection = createElement('div', { className: 'settings-section' });
  displaySection.appendChild(createElement('h3', {}, ['显示']));
  displaySection.appendChild(createSettingRow('动画效果', createToggle(true)));
  displaySection.appendChild(createSettingRow('粒子效果', createToggle(true)));
  displaySection.appendChild(createSettingRow('高DPI渲染', createToggle(true)));
  container.appendChild(displaySection);

  const dataSection = createSaveSettings();

  const resetBtn = createElement('button', { className: 'btn btn-danger' }, [
    lucideIcon('alert-triangle', 14),
    document.createTextNode(' 重置游戏'),
  ]);
  resetBtn.addEventListener('click', () => {
    ui.showConfirm({
      title: '重置游戏',
      text: '所有进度将被清除，此操作不可撤销！',
      confirmText: '确认重置',
      onConfirm: () => {
        saveManager.clearActive();
        gameState.reset();
        location.reload();
      },
    });
  });

  dataSection.appendChild(resetBtn);
  container.appendChild(dataSection);

  const content = ui.createModalContent('设置', 'settings', container);
  ui.openModal(content, 'modal-md');
}

function createSaveSettings() {
  const section = createElement('div', { className: 'settings-section save-settings' });
  section.appendChild(createElement('h3', {}, ['存档']));
  const list = createElement('div', { className: 'save-slot-list' });
  const render = () => {
    list.replaceChildren();
    for (const slot of saveManager.list()) {
      const card = createElement('div', { className: 'save-slot' });
      const name = createElement('input', { type: 'text', className: 'settings-pack-name', value: slot.name, maxlength: 30 });
      const meta = createElement('div', { className: 'save-slot-meta' }, [slot.empty ? '空槽位' : `Y${slot.year} · 第${slot.day}天 · ${new Date(slot.savedAt).toLocaleString()}`]);
      const save = createElement('button', { className: 'btn btn-primary' }, [lucideIcon('save', 13), document.createTextNode(' 保存')]);
      save.addEventListener('click', () => { saveManager.save(slot.slotId, name.value); render(); });
      const load = createElement('button', { className: 'btn', disabled: slot.empty }, [lucideIcon('download', 13), document.createTextNode(' 读取')]);
      load.addEventListener('click', () => ui.showConfirm({ title: '读取存档', text: '当前未保存进度将被覆盖。', onConfirm: () => { saveManager.load(slot.slotId); location.reload(); } }));
      const exportBtn = createElement('button', { className: 'btn', disabled: slot.empty }, ['导出']);
      exportBtn.addEventListener('click', () => { const url=URL.createObjectURL(saveManager.export(slot.slotId)); const a=document.createElement('a'); a.href=url; a.download=`${name.value||`存档${slot.slotId}`}.json`; a.click(); URL.revokeObjectURL(url); });
      const importInput = createElement('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
      const importBtn = createElement('button', { className: 'btn' }, ['导入']);
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async () => { try { await saveManager.import(slot.slotId, importInput.files?.[0]); render(); } catch (error) { gameState.addNotification({ title:'导入失败', text:error.message, type:'warning', icon:'alert-triangle' }); } importInput.value=''; });
      const remove = createElement('button', { className: 'btn btn-danger', disabled: slot.empty }, ['删除']);
      remove.addEventListener('click', () => { saveManager.remove(slot.slotId); render(); });
      card.append(name, meta, createElement('div', { className: 'save-slot-actions' }, [save, load, exportBtn, importBtn, remove, importInput]));
      list.appendChild(card);
    }
  };
  render();
  section.appendChild(list);
  return section;
}

function createTextureSettings() {
  const section = createElement('div', { className: 'settings-section texture-settings' });
  section.appendChild(createElement('h3', {}, ['自定义纹理']));
  section.appendChild(createElement('p', { className: 'settings-hint' }, [
    '上传 PNG 替换地形、建筑、居民或游客素材；没有素材时自动使用默认绘图。',
  ]));

  const slotSelect = createElement('select', { className: 'settings-texture-select' });
  for (const slot of TEXTURE_SLOTS) {
    slotSelect.appendChild(createElement('option', { value: slot.id }, [slot.label]));
  }
  section.appendChild(createSettingRow('素材槽位', slotSelect));

  const hint = createElement('div', { className: 'texture-slot-hint' });
  const preview = createElement('img', { className: 'texture-preview', alt: '纹理预览' });
  const status = createElement('div', { className: 'texture-status' });
  const fileInput = createElement('input', { type: 'file', accept: 'image/png', style: { display: 'none' } });
  const packInput = createElement('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });

  const refresh = () => {
    const slot = TEXTURE_SLOTS.find((entry) => entry.id === slotSelect.value);
    const record = textureManager.getRecord(slot.id);
    const image = textureManager.getImage(slot.id);
    hint.textContent = slot.hint;
    // 分面拼合按钮仅对非道路建筑显示；上传按钮始终显示
    const isBuildingNotRoad = slot.kind === 'building' && slot.id !== 'building.road';
    faceButton.style.display = isBuildingNotRoad ? '' : 'none';
    // 精灵分片按钮仅对精灵类型显示
    const isSprite = slot.kind === 'sprite';
    spriteFaceButton.style.display = isSprite ? '' : 'none';
    uploadButton.style.display = '';
    if (image) {
      preview.src = typeof image.src === 'string' ? image.src : '';
      if (!preview.src) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        preview.src = canvas.toDataURL('image/png');
      }
      preview.style.display = 'block';
      status.textContent = `${record.width}×${record.height}，${Math.ceil(record.size / 1024)}KB，已启用自定义素材`;
    } else {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      status.textContent = '当前使用默认程序绘图';
    }
  };

  const uploadButton = createElement('button', { className: 'btn btn-primary' }, [
    lucideIcon('upload', 14), document.createTextNode(' 上传 PNG'),
  ]);
  uploadButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    uploadButton.disabled = true;
    status.textContent = '正在读取素材…';
    try {
      const slot = TEXTURE_SLOTS.find((entry) => entry.id === slotSelect.value);
      const targetW = slot?.targetWidth;
      const targetH = slot?.targetHeight;

      // 先解码图片检查尺寸
      const img = typeof createImageBitmap === 'function'
        ? await createImageBitmap(file)
        : await new Promise((res, rej) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => { URL.revokeObjectURL(url); res(image); };
            image.onerror = () => { URL.revokeObjectURL(url); rej(new Error('图片无法解码')); };
            image.src = url;
          });

      const imgW = img.width || img.naturalWidth;
      const imgH = img.height || img.naturalHeight;

      // 完整建筑图始终进入预览/裁剪流程；其他已匹配尺寸的素材可直接安装
      const needsPresentation = slot?.kind === 'building' || (targetW && targetH && (imgW !== targetW || imgH !== targetH));
      if (!needsPresentation || !targetW || !targetH) {
        await textureManager.install(slotSelect.value, file);
        gameState.addNotification({ title: '纹理已更新', text: '自定义素材已应用到游戏画面', type: 'success', icon: 'image' });
      } else {
        const result = await openCropModal(img, targetW, targetH, { kind: slot?.kind === 'building' ? 'building' : slot?.kind });
        if (result === 'cancel') {
          // 用户取消
        } else if (result === null) {
          // 使用原图
          await textureManager.install(slotSelect.value, file);
          gameState.addNotification({ title: '纹理已更新', text: '使用原图已应用到游戏画面', type: 'success', icon: 'image' });
        } else {
          // 裁剪后的 Blob
          await textureManager.install(slotSelect.value, result);
          gameState.addNotification({ title: '纹理已更新', text: `已裁剪为 ${targetW}×${targetH} 并应用`, type: 'success', icon: 'image' });
        }
      }
    } catch (error) {
      gameState.addNotification({ title: '纹理上传失败', text: error.message, type: 'warning', icon: 'alert-triangle' });
    } finally {
      uploadButton.disabled = false;
      refresh();
    }
  });

  const faceButton = createElement('button', { className: 'btn' }, [
    lucideIcon('box', 14), document.createTextNode(' 分面拼合'),
  ]);
  faceButton.addEventListener('click', async () => {
    const slot = TEXTURE_SLOTS.find((entry) => entry.id === slotSelect.value);
    const targetW = slot?.targetWidth || 128;
    const targetH = slot?.targetHeight || 128;
    const result = await openBuildingFaceModal(targetW, targetH);
    if (result === 'cancel') return;
    if (result instanceof Blob) {
      await textureManager.install(slotSelect.value, result);
      gameState.addNotification({ title: '纹理已更新', text: '分面拼合建筑纹理已应用', type: 'success', icon: 'image' });
      refresh();
    }
  });

  const spriteFaceButton = createElement('button', { className: 'btn' }, [
    lucideIcon('user', 14), document.createTextNode(' 分片拼合'),
  ]);
  spriteFaceButton.addEventListener('click', async () => {
    const slot = TEXTURE_SLOTS.find((entry) => entry.id === slotSelect.value);
    const targetW = slot?.targetWidth || 96;
    const targetH = slot?.targetHeight || 128;
    const result = await openSpriteFaceModal(targetW, targetH);
    if (result === 'cancel') return;
    if (result instanceof Blob) {
      await textureManager.install(slotSelect.value, result);
      gameState.addNotification({ title: '纹理已更新', text: '分片拼合精灵表已应用', type: 'success', icon: 'image' });
      refresh();
    }
  });

  const resetButton = createElement('button', { className: 'btn' }, [
    lucideIcon('rotate-ccw', 14), document.createTextNode(' 恢复默认'),
  ]);
  resetButton.addEventListener('click', async () => {
    await textureManager.remove(slotSelect.value);
    refresh();
  });

  const clearButton = createElement('button', { className: 'btn btn-danger' }, [
    lucideIcon('trash-2', 14), document.createTextNode(' 清除全部纹理'),
  ]);

  const packName = createElement('input', {
    type: 'text',
    className: 'settings-pack-name',
    placeholder: '纹理包名称',
    value: '我的星尘纹理',
    maxlength: 40,
  });
  const exportButton = createElement('button', { className: 'btn' }, [
    lucideIcon('package', 14), document.createTextNode(' 导出纹理包'),
  ]);
  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true;
    try {
      const blob = await textureManager.exportPack(packName.value.trim() || '我的星尘纹理');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(packName.value.trim() || 'stardust-textures').replace(/[\\/:*?"<>|]/g, '_')}.json`;
      link.click();
      URL.revokeObjectURL(url);
      gameState.addNotification({ title: '导出成功', text: '纹理包已下载', type: 'success', icon: 'download' });
    } catch (error) {
      gameState.addNotification({ title: '导出失败', text: error.message, type: 'warning', icon: 'alert-triangle' });
    } finally {
      exportButton.disabled = false;
    }
  });

  const importButton = createElement('button', { className: 'btn' }, [
    lucideIcon('upload-cloud', 14), document.createTextNode(' 导入纹理包'),
  ]);
  importButton.addEventListener('click', () => packInput.click());
  packInput.addEventListener('change', async () => {
    const file = packInput.files?.[0];
    packInput.value = '';
    if (!file) return;
    importButton.disabled = true;
    status.textContent = '正在校验纹理包…';
    try {
      const result = await textureManager.importPack(file);
      gameState.addNotification({ title: '导入成功', text: `已安装 ${result.count} 张纹理`, type: 'success', icon: 'package' });
      refresh();
    } catch (error) {
      gameState.addNotification({ title: '导入失败', text: error.message, type: 'warning', icon: 'alert-triangle' });
      refresh();
    } finally {
      importButton.disabled = false;
    }
  });
  clearButton.addEventListener('click', () => {
    ui.showConfirm({
      title: '清除全部纹理',
      text: '所有自定义素材将恢复为默认绘图，确定继续吗？',
      confirmText: '确认清除',
      onConfirm: async () => {
        await textureManager.clearAll();
        refresh();
      },
    });
  });

  const controls = createElement('div', { className: 'texture-controls' }, [uploadButton, faceButton, spriteFaceButton, resetButton, clearButton, fileInput]);
  const packControls = createElement('div', { className: 'texture-pack-controls' }, [packName, exportButton, importButton, packInput]);
  section.appendChild(createElement('div', { className: 'texture-preview-row' }, [preview, createElement('div', {}, [hint, status])]));
  section.appendChild(controls);
  section.appendChild(packControls);
  slotSelect.addEventListener('change', refresh);
  refresh();
  return section;
}

function createSettingRow(label, control) {
  return createElement('div', { className: 'settings-row' }, [
    createElement('span', { className: 'settings-label' }, [label]),
    control,
  ]);
}

function createSlider(value) {
  const input = createElement('input', {
    type: 'range',
    className: 'settings-input',
    style: { accentColor: 'var(--text-accent)' },
  });
  input.value = value;
  input.min = 0;
  input.max = 100;
  return input;
}

function createToggle(checked) {
  const label = createElement('label', {
    style: {
      position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer',
    },
  });
  const input = createElement('input', { type: 'checkbox' });
  input.checked = checked;
  input.style.cssText = 'opacity:0;width:0;height:0;';

  const slider = createElement('span', {
    style: {
      position: 'absolute', inset: '0', background: checked ? 'var(--text-accent)' : 'rgba(255,255,255,0.15)',
      borderRadius: '11px', transition: 'background 0.2s',
    },
  });
  const dot = createElement('span', {
    style: {
      position: 'absolute', top: '3px', left: checked ? '20px' : '3px', width: '16px', height: '16px',
      background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
    },
  });
  slider.appendChild(dot);

  input.addEventListener('change', () => {
    slider.style.background = input.checked ? 'var(--text-accent)' : 'rgba(255,255,255,0.15)';
    dot.style.left = input.checked ? '20px' : '3px';
  });

  label.appendChild(input);
  label.appendChild(slider);
  return label;
}
