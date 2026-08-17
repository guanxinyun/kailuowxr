import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiClient,
  getModelsEndpoint,
  getOllamaTagsEndpoint,
  normalizeChatEndpoint,
} from '../src/ai/AIClient.js';

test('getModelsEndpoint 幂等：已是 /models 端点不重复拼接', () => {
  assert.equal(getModelsEndpoint('https://example.com/v1/models'), 'https://example.com/v1/models');
  assert.equal(getModelsEndpoint('https://example.com/v1/models?x=1'), 'https://example.com/v1/models');
});

test('getModelsEndpoint 从根域名或 /v1 基础路径推导', () => {
  assert.equal(getModelsEndpoint('https://example.com'), 'https://example.com/models');
  assert.equal(getModelsEndpoint('https://example.com/v1'), 'https://example.com/v1/models');
});

test('getOllamaTagsEndpoint 仅本地主机返回原生端点', () => {
  assert.equal(getOllamaTagsEndpoint('http://localhost:11434/v1/chat/completions'), 'http://localhost:11434/api/tags');
  assert.equal(getOllamaTagsEndpoint('http://127.0.0.1:11434/v1'), 'http://127.0.0.1:11434/api/tags');
  assert.equal(getOllamaTagsEndpoint('https://api.deepseek.com/v1/chat/completions'), null);
});

test('normalizeChatEndpoint 自动补全 /chat/completions', () => {
  assert.equal(normalizeChatEndpoint('http://localhost:11434'), 'http://localhost:11434/v1/chat/completions');
  assert.equal(normalizeChatEndpoint('http://localhost:11434/v1'), 'http://localhost:11434/v1/chat/completions');
  assert.equal(normalizeChatEndpoint('https://api.deepseek.com/v1'), 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(normalizeChatEndpoint('https://api.deepseek.com/v1/chat/completions'), 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(normalizeChatEndpoint('https://api.deepseek.com/v1/chat/completions/'), 'https://api.deepseek.com/v1/chat/completions');
});

test('listModels 在远程接口不支持 /models 时给出可操作提示', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url) => {
    if (String(url).includes('/models')) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    throw new Error('不应请求到其他端点: ' + url);
  };
  await assert.rejects(
    () => aiClient.listModels({ endpoint: 'https://api.deepseek.com/v1/chat/completions' }),
    /不支持自动获取模型列表/,
  );
});

test('listModels 在本地 Ollama 不支持 /v1/models 时回退 /api/tags', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url) => {
    if (String(url).includes('/v1/models')) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (String(url).includes('/api/tags')) {
      return { ok: true, status: 200, json: async () => ({ models: [{ name: 'llama3', model: 'llama3' }] }) };
    }
    throw new Error('意外请求: ' + url);
  };
  const models = await aiClient.listModels({ endpoint: 'http://localhost:11434/v1/chat/completions' });
  assert.deepEqual(models, ['llama3']);
});

test('listModels 正常解析 OpenAI /models 返回', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: [{ id: 'gpt-4' }, { id: 'gpt-3.5' }] }),
  });
  const models = await aiClient.listModels({ endpoint: 'https://api.example.com/v1/chat/completions' });
  assert.deepEqual(models, ['gpt-4', 'gpt-3.5']);
});
