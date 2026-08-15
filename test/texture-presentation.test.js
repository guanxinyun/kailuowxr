import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containRect,
  getBottomCenterDrawPosition,
  getFullImageFrame,
  getFullImageDrawRect,
  SPRITE_FRAME_SIZE,
  getSpriteDrawRect,
} from '../src/core/TexturePresentation.js';
import { aiClient, getModelsEndpoint, getModelsPageEndpoint, normalizeModelList } from '../src/ai/AIClient.js';

test('完整建筑图保持比例缩放到最大框，不被拉扁', () => {
  assert.deepEqual(containRect(400, 200, 64, 48), {
    width: 64, height: 32, x: 0, y: 8,
  });
  assert.deepEqual(containRect(100, 300, 64, 48), {
    width: 16, height: 48, x: 24, y: 0,
  });
});

test('建筑完整图按底边中心锚定地块中心', () => {
  assert.deepEqual(getBottomCenterDrawPosition(320, 240, 400, 200, 64, 48), {
    x: 288, y: 208, width: 64, height: 32,
  });
});

test('完整图帧同时保存宽深高参数', () => {
  assert.deepEqual(getFullImageFrame(400, 200, 1.4, 0.8, 2.2), {
    sourceW: 400, sourceH: 200, widthR: 1.4, depthR: 0.8, heightR: 2.2,
  });
});

test('完整图宽高参数控制图像尺寸，深度控制底面位置', () => {
  assert.deepEqual(getFullImageDrawRect(400, 200, 64, 48, 2, 2, 3), {
    width: 64, height: 32, x: 0, y: 16,
  });
  assert.deepEqual(getFullImageDrawRect(400, 200, 64, 48, 2, 0.5, 3), {
    width: 64, height: 32, x: 0, y: 0,
  });
  assert.deepEqual(getFullImageDrawRect(100, 300, 64, 48, 2, 2, 1.5), {
    width: 8, height: 24, x: 28, y: 24,
  });
});

test('精灵表单帧尺寸固定为 32×32', () => {
  assert.deepEqual(SPRITE_FRAME_SIZE, { width: 32, height: 32 });
});

test('小人按 32×32 单帧尺寸绘制并以脚底中心锚定', () => {
  assert.deepEqual(getSpriteDrawRect(100, 80, 1), {
    x: 84, y: 48, width: 32, height: 32,
  });
});

test('OpenAI 兼容聊天端点可推导模型列表端点', () => {
  assert.equal(getModelsEndpoint('http://localhost:11434/v1/chat/completions'), 'http://localhost:11434/v1/models');
  assert.equal(getModelsEndpoint('https://example.com/api/chat/completions'), 'https://example.com/api/models');
});

test('模型列表兼容 id、model 和 name 字段并去重', () => {
  assert.deepEqual(normalizeModelList({ data: [
    { id: 'qwen' }, { model: 'llama3' }, { name: 'mistral' },
    { id: '' }, { name: '' }, 'bad',
  ] }), ['qwen', 'llama3', 'mistral', 'bad']);
});

test('模型列表分页参数使用 after 游标', () => {
  assert.equal(
    getModelsPageEndpoint('http://localhost:11434/v1/models', { has_more: true, last_id: 'page-2' }),
    'http://localhost:11434/v1/models?after=page-2',
  );
  assert.equal(getModelsPageEndpoint('http://localhost:11434/v1/models', { has_more: false, last_id: 'page-2' }), null);
});

test('AI 客户端暴露模型拉取和连接测试能力', () => {
  assert.equal(typeof aiClient.listModels, 'function');
  assert.equal(typeof aiClient.testConnection, 'function');
});
