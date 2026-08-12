import { bus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { acceptProposal, generateProposal, rejectProposal } from '../core/DynamicContentSystem.js';
import { aiClient } from '../ai/AIClient.js';

const LABELS = { building_proposal: '新建筑', combo_proposal: '新组合', species_proposal: '新外星种族' };

export function openAIContentPanel() {
  const container = createElement('div', { className: 'ai-content-panel' });
  const initialConfig = aiClient.getConfiguration();
  let endpointValue = initialConfig?.endpoint || '';
  let modelValue = initialConfig?.model || '';
  let apiKeyValue = '';
  let instructionValue = '';
  const render = () => {
    container.replaceChildren();
    const state = gameState.state.aiContent;
    const status = aiClient.getStatus();
    const toggle = createElement('input', { type: 'checkbox' });
    toggle.checked = state.enabled;
    toggle.addEventListener('change', () => { state.enabled = toggle.checked; render(); });
    container.appendChild(createElement('div', { className: 'ai-content-status' }, [
      createElement('div', {}, [createElement('strong', {}, ['运行时 AI 内容']), createElement('span', {}, [`${status.mode === 'online' ? '在线模型' : '本地降级'} · 所有规则先校验再确认`])]),
      toggle,
    ]));

    const endpoint = createElement('input', { className: 'settings-pack-name', type: 'url', placeholder: 'OpenAI兼容接口，如 http://localhost:11434/v1/chat/completions', value: endpointValue });
    const model = createElement('input', { className: 'settings-pack-name', type: 'text', placeholder: '模型名，如 qwen2.5:7b', value: modelValue });
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
    const clearConfig = createElement('button', { className: 'btn' }, ['清除在线配置']);
    clearConfig.addEventListener('click', () => { aiClient.clearConfiguration(); endpointValue=''; modelValue=''; apiKeyValue=''; render(); });
    container.appendChild(createElement('div', { className: 'ai-config-box' }, [
      createElement('h3', {}, ['玩家自己的 AI']), endpoint, model, apiKey,
      createElement('div', { className: 'settings-hint' }, ['支持 HTTP/HTTPS OpenAI兼容 /chat/completions。HTTPS页面调用远程HTTP可能被浏览器拦截；Key仅存sessionStorage。']),
      createElement('div', { className: 'ai-proposal-buttons' }, [saveConfig, clearConfig]),
    ]));

    const instruction = createElement('textarea', { className: 'ai-instruction', placeholder: '可选：描述你想生成的内容，例如“生成适合雪地的食品建筑”' });
    instruction.value = instructionValue;
    instruction.addEventListener('input', () => { instructionValue = instruction.value; });
    container.appendChild(instruction);

    const actions = createElement('div', { className: 'ai-content-actions' });
    for (const [type, label] of Object.entries(LABELS)) {
      const button = createElement('button', { className: 'btn', disabled: !state.enabled }, [lucideIcon('sparkles', 13), document.createTextNode(` 生成${label}`)]);
      button.addEventListener('click', async () => {
        button.disabled = true;
        const result = await generateProposal(type, instructionValue);
        if (!result.ok) gameState.addNotification({ title: '提案未生成', text: result.reason, type: 'warning', icon: 'info' });
        render();
      });
      actions.appendChild(button);
    }
    container.appendChild(actions);

    const pending = createElement('div', { className: 'ai-proposal-list' });
    pending.appendChild(createElement('h3', {}, [`待确认提案（${state.pending.length}）`]));
    if (!state.pending.length) pending.appendChild(createElement('div', { className: 'production-empty' }, ['随着建设、考察和年份推进，这里会出现动态内容提案。']));
    for (const item of state.pending) {
      const content = item.content;
      const summary = item.type === 'building_proposal'
        ? `${content.category} · 成本 ${Object.entries(content.cost).map(([key, value]) => `${key} ${value}`).join('、')}`
        : item.type === 'combo_proposal'
          ? `${content.buildingIds.join(' + ')} · ${content.effectText}`
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
    container.appendChild(pending);

    container.appendChild(createElement('div', { className: 'ai-content-accepted' }, [
      `已接受：建筑 ${state.acceptedBuildings.length} · 组合 ${state.acceptedCombos.length} · 外星种族 ${state.acceptedSpecies.length}`,
    ]));
  };

  const unsubs = [bus.on('ai-content:proposed', render), bus.on('ai-content:accepted', render)];
  render();
  const content = ui.createModalContent('AI 内容工坊', 'sparkles', container);
  ui.openModal(content, 'modal-lg');
  bus.once('modal:close', () => unsubs.forEach(unsub => unsub()));
}
