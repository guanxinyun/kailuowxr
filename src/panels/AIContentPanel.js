import { bus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { acceptProposal, startAIResearchProject, rejectProposal } from '../core/DynamicContentSystem.js';
import { aiClient } from '../ai/AIClient.js';
import { sound } from '../core/SoundSystem.js';

const LABELS = {
  building_proposal: '新建筑',
  combo_proposal: '新组合',
  species_proposal: '新外星种族',
  tech_proposal: '新科技',
  product_proposal: '新加工品',
  card_proposal: '多维技能卡',
  env_proposal: '异星环境牌',
};

export function openAIContentPanel() {
  const container = createElement('div', { className: 'ai-content-panel' });
  const initialConfig = aiClient.getConfiguration();
  let endpointValue = initialConfig?.endpoint || '';
  let modelValue = initialConfig?.model || '';
  let apiKeyValue = '';
  let instructionValue = '';
  let availableModels = [];
  const render = () => {
    container.replaceChildren();
    const state = gameState.state.aiContent;
    const status = aiClient.getStatus();
    const statusLabels = { online: '在线模型', fallback: '本地降级', offline: '等待配置' };
    const statusText = statusLabels[status.mode] || status.mode;
    const errorHint = status.lastError ? ` · 最近错误: ${status.lastError}` : '';
    const failureHint = status.failures > 0 ? ` · 失败${status.failures}/${3}次` : '';
    const toggle = createElement('input', { type: 'checkbox' });
    toggle.checked = state.enabled;
    toggle.addEventListener('change', () => { state.enabled = toggle.checked; render(); });
    container.appendChild(createElement('div', { className: 'ai-content-status' }, [
      createElement('div', {}, [createElement('strong', {}, ['运行时 AI 内容']), createElement('span', {}, [`${statusText}${failureHint}${errorHint} · 所有规则先校验再确认`])]),
      toggle,
    ]));

    const endpoint = createElement('input', { className: 'settings-pack-name', type: 'url', placeholder: 'OpenAI兼容接口，如 http://localhost:11434 或 https://api.deepseek.com/v1', value: endpointValue });
    const model = createElement('input', { className: 'settings-pack-name', type: 'text', placeholder: '模型名，如 qwen2.5:7b', value: modelValue, list: 'ai-model-list' });
    const modelList = createElement('datalist', { id: 'ai-model-list' }, availableModels.map(id => createElement('option', { value: id })));
    const apiKey = createElement('input', { className: 'settings-pack-name', type: 'password', placeholder: initialConfig?.hasKey ? 'Key 已在当前标签页保存；留空保持不变' : 'API Key（本地模型可留空）', value: apiKeyValue });
    endpoint.addEventListener('input', () => { endpointValue = endpoint.value; });
    model.addEventListener('input', () => { modelValue = model.value; });
    apiKey.addEventListener('input', () => { apiKeyValue = apiKey.value; });
    const saveConfig = createElement('button', { className: 'btn btn-primary' }, ['保存当前标签页配置']);
    saveConfig.addEventListener('click', () => {
      try {
        aiClient.configure({ endpoint: endpointValue, model: modelValue, apiKey: apiKeyValue || undefined });
        apiKeyValue = '';
        gameState.addNotification({ title: 'AI配置已保存', text: '配置只保留到当前标签页关闭，不会进入存档。', type: 'success', icon: 'sparkles' });
        render();
      } catch (error) { gameState.addNotification({ title: 'AI配置无效', text: error.message, type: 'warning', icon: 'alert-triangle' }); }
    });
    const fetchModels = createElement('button', { className: 'btn' }, ['自动获取模型']);
    fetchModels.addEventListener('click', async () => {
      fetchModels.disabled = true;
      try {
        availableModels = await aiClient.listModels({ endpoint: endpointValue, apiKey: apiKeyValue || undefined });
        if (!availableModels.includes(modelValue)) modelValue = availableModels[0];
        gameState.addNotification({ title: '模型列表已更新', text: `找到 ${availableModels.length} 个模型`, type: 'success', icon: 'list' });
      } catch (error) {
        gameState.addNotification({ title: '无法获取模型', text: error.message, type: 'warning', icon: 'alert-triangle' });
      }
      render();
    });
    const testConnection = createElement('button', { className: 'btn' }, ['测试连接']);
    testConnection.addEventListener('click', async () => {
      testConnection.disabled = true;
      try {
        await aiClient.testConnection({ endpoint: endpointValue, model: modelValue, apiKey: apiKeyValue || undefined });
        gameState.addNotification({ title: 'AI连接成功', text: `模型 ${modelValue} 已返回兼容响应`, type: 'success', icon: 'check-circle' });
      } catch (error) {
        gameState.addNotification({ title: 'AI连接失败', text: error.message, type: 'warning', icon: 'alert-triangle' });
      }
      render();
    });
    const clearConfig = createElement('button', { className: 'btn' }, ['清除在线配置']);
    clearConfig.addEventListener('click', () => { aiClient.clearConfiguration(); endpointValue=''; modelValue=''; apiKeyValue=''; availableModels=[]; render(); });
    const resetConnection = createElement('button', { className: 'btn' }, ['重置连接']);
    resetConnection.addEventListener('click', () => { aiClient.reset(); gameState.addNotification({ title: 'AI连接已重置', text: '失败计数已清零，将重新尝试在线模型。', type: 'success', icon: 'refresh-cw' }); render(); });
    container.appendChild(createElement('div', { className: 'ai-config-box' }, [
      createElement('h3', {}, ['玩家自己的 AI']), endpoint, model, modelList, apiKey,
      createElement('div', { className: 'settings-hint' }, ['支持 HTTP/HTTPS OpenAI兼容接口；基础地址会自动补全 /chat/completions，并从同路径 /models 拉取模型。HTTPS页面调用远程HTTP可能被浏览器拦截；Key仅存sessionStorage。']),
      createElement('div', { className: 'ai-proposal-buttons' }, [saveConfig, fetchModels, testConnection, clearConfig, resetConnection]),
    ]));

    // 研发中心立项说明
    const rAndDHeader = createElement('div', {
      style: {
        padding: '10px 14px',
        background: 'rgba(74,144,217,0.1)',
        borderRadius: '6px',
        border: '1px solid rgba(74,144,217,0.3)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
      },
    }, [
      createElement('strong', { style: { color: 'var(--color-knowledge)' } }, ['🔬 AI 课题立项研发流程：']),
      document.createTextNode(' 手动发起提案需消耗 30 点研究点 + 50 星币，立项后将进入 2 天的课题论证与构思周期，完成后自动提交至待确认提案。'),
    ]);
    container.appendChild(rAndDHeader);

    // 正在进行的研发队列
    const researchQueueContainer = createElement('div', { className: 'ai-research-queue-container' });
    const updateResearchQueue = () => {
      researchQueueContainer.replaceChildren();
      if (state.researchSlots && state.researchSlots.length > 0) {
        const researchQueue = createElement('div', {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '6px',
            border: '1px solid var(--border-glow)',
          },
        });
        researchQueue.appendChild(createElement('strong', { style: { fontSize: '13px', color: 'var(--color-knowledge)' } }, [`正在进行的研发课题（${state.researchSlots.length}）`]));
        for (const slot of state.researchSlots) {
          const row = createElement('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' },
          }, [
            createElement('span', {}, [
              lucideIcon('flask-conical', 12),
              document.createTextNode(` 【${LABELS[slot.type] || slot.type}】${slot.instruction ? ` · 导向: ${slot.instruction}` : ''}`),
            ]),
            createElement('span', { style: { color: 'var(--color-energy)', fontWeight: 'bold' } }, [`剩余 ${slot.remainingDays} 天`]),
          ]);
          researchQueue.appendChild(row);
        }
        researchQueueContainer.appendChild(researchQueue);
      }
    };
    updateResearchQueue();
    container.appendChild(researchQueueContainer);

    const instruction = createElement('textarea', { className: 'ai-instruction', placeholder: '可选：描述你想生成的内容，例如“生成适合雪地的食品建筑”' });
    instruction.value = instructionValue;
    instruction.addEventListener('input', () => { instructionValue = instruction.value; });
    container.appendChild(instruction);

    const actions = createElement('div', { className: 'ai-content-actions' });
    const updateActionButtons = () => {
      actions.replaceChildren();
      for (const [type, label] of Object.entries(LABELS)) {
        const canAfford = (gameState.state.resources.research || 0) >= 30 && (gameState.state.resources.credits || 0) >= 50;
        const button = createElement('button', { className: 'btn', disabled: !state.enabled || !canAfford }, [
          lucideIcon('sparkles', 13),
          document.createTextNode(` 立项${label} (30🧪+50🪙)`),
        ]);
        button.addEventListener('click', () => {
          const result = startAIResearchProject(type, instructionValue);
          if (!result.ok) {
            gameState.addNotification({ title: '立项失败', text: result.reason, type: 'warning', icon: 'info' });
          } else {
            sound.play('tech');
            gameState.addNotification({
              title: '研发立项已启动',
              text: `已为【${label}】立项，研发周期 2 天。`,
              type: 'success',
              icon: 'flask-conical',
            });
          }
          render();
        });
        actions.appendChild(button);
      }
    };
    updateActionButtons();
    container.appendChild(actions);

    const pending = createElement('div', { className: 'ai-proposal-list' });
    const acceptedCount = createElement('div', { className: 'ai-content-accepted' });

    const updateProposals = () => {
      pending.replaceChildren();
      pending.appendChild(createElement('h3', {}, [`待确认提案（${state.pending.length}）`]));
      if (!state.pending.length) pending.appendChild(createElement('div', { className: 'production-empty' }, ['随着研发立项完成、建设、考察和年份推进，这里会出现动态内容提案。']));
      for (const item of state.pending) {
        const content = item.content;
        const summary = item.type === 'building_proposal'
          ? `${content.category} · 成本 ${Object.entries(content.cost).map(([key, value]) => `${key} ${value}`).join('、')}`
          : item.type === 'combo_proposal'
            ? `${content.buildingIds.join(' + ')} · ${content.effectText}`
            : item.type === 'tech_proposal'
              ? `${content.tier}阶 · 研究 ${content.cost.research} · ${content.unlocks.join('、')}`
              : item.type === 'product_proposal'
                ? `${content.tier}级加工 · 消耗 ${Object.entries(content.inputs || {}).map(([k, v]) => `${k}×${v}`).join('、')}`
                : item.type === 'card_proposal'
                  ? `多维属性: ${Object.entries(content.stats || {}).map(([k, v]) => `${k} ${v > 0 ? `+${v}` : v}`).join('、')}`
                  : item.type === 'env_proposal'
                    ? `环境修正: ${Object.entries(content.modifiers || {}).map(([k, v]) => `${k} ${v > 0 ? `+${v}` : v}`).join('、')}`
                    : `${content.homeworld} · ${content.personality}`;
        const card = createElement('div', { className: 'ai-proposal-card' }, [
          createElement('div', { className: 'ai-proposal-header' }, [createElement('strong', {}, [content.name]), createElement('span', {}, [LABELS[item.type]])]),
          createElement('p', {}, [content.desc || content.description || content.lore]),
          createElement('div', { className: 'ai-proposal-summary' }, [summary]),
        ]);
        const accept = createElement('button', { className: 'btn btn-primary' }, ['接受']);
        accept.addEventListener('click', () => { acceptProposal(item.id); render(); });
        const reject = createElement('button', { className: 'btn' }, ['忽略']);
        reject.addEventListener('click', () => { rejectProposal(item.id); render(); });
        card.appendChild(createElement('div', { className: 'ai-proposal-buttons' }, [accept, reject]));
        pending.appendChild(card);
      }

      acceptedCount.textContent = `已接受：建筑 ${state.acceptedBuildings.length} · 组合 ${state.acceptedCombos.length} · 科技 ${(state.acceptedTechs || []).length} · 加工品 ${(state.acceptedProducts || []).length} · 卡牌 ${(state.acceptedCards || []).length} · 环境牌 ${(state.acceptedEnvCards || []).length} · 外星种族 ${state.acceptedSpecies.length}`;
    };

    updateProposals();
    container.appendChild(pending);
    container.appendChild(acceptedCount);

    return {
      onDayAdvance: () => {
        updateResearchQueue();
        updateActionButtons();
        updateProposals();
      },
    };
  };

  let activePanelState = render();

  const unsubs = [
    bus.on('ai-content:proposed', () => { render(); }),
    bus.on('ai-content:accepted', () => { render(); }),
    bus.on('ai-research:started', () => { render(); }),
    bus.on('day:advance', () => {
      if (activePanelState?.onDayAdvance) {
        activePanelState.onDayAdvance();
      }
    }),
  ];
  render();
  const content = ui.createModalContent('AI 内容工坊', 'sparkles', container);
  ui.openModal(content, 'modal-lg');
  bus.once('modal:close', () => unsubs.forEach(unsub => unsub()));
}
