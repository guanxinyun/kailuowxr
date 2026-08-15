/**
 * 星尘殖民地 — 精灵分片拼合弹窗
 * 用户分别上传 4 个方向的图片（下/上/左/右），
 * 每个方向可上传 1 张（自动复制为 3 帧）或 3 张（走路动画帧），
 * 拼合成 3 列×4 行的精灵表。
 */
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { drawContainedImage } from '../core/TexturePresentation.js';

const PREVIEW_SIZE = 192;
const DIRECTIONS = [
  { key: 'down', label: '正面（下）' },
  { key: 'up', label: '背面（上）' },
  { key: 'left', label: '左侧' },
  { key: 'right', label: '右侧' },
];

/**
 * 打开精灵分片拼合弹窗
 * @param {number} targetW 输出宽度（如 96）
 * @param {number} targetH 输出高度（如 128）
 * @returns {Promise<Blob|'cancel'>}
 */
export function openSpriteFaceModal(targetW, targetH) {
  return new Promise((resolve) => {
    const frameW = targetW / 3;
    const frameH = targetH / 4;

    // 每个方向最多 3 帧
    const faces = {
      down: [],
      up: [],
      left: [],
      right: [],
    };

    // 预览 canvas
    const previewCanvas = createElement('canvas', {
      width: PREVIEW_SIZE, height: PREVIEW_SIZE, className: 'face-preview-canvas',
    });
    const previewCtx = previewCanvas.getContext('2d');

    function redraw() {
      previewCtx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
      // 棋盘格背景
      previewCtx.fillStyle = '#2a2a3a';
      previewCtx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
      for (let py = 0; py < PREVIEW_SIZE; py += 8) {
        for (let px = 0; px < PREVIEW_SIZE; px += 8) {
          if ((px + py) % 16 === 0) {
            previewCtx.fillStyle = '#3a3a4a';
            previewCtx.fillRect(px, py, 8, 8);
          }
        }
      }

      // 绘制精灵表预览（缩放到 PREVIEW_SIZE）
      const scaleX = PREVIEW_SIZE / targetW;
      const scaleY = PREVIEW_SIZE / targetH;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (PREVIEW_SIZE - targetW * scale) / 2;
      const offsetY = (PREVIEW_SIZE - targetH * scale) / 2;

      previewCtx.save();
      previewCtx.imageSmoothingEnabled = false;

      // 画网格线
      previewCtx.strokeStyle = 'rgba(79, 195, 247, 0.3)';
      previewCtx.lineWidth = 1;
      for (let col = 0; col <= 3; col++) {
        const x = offsetX + col * frameW * scale;
        previewCtx.beginPath();
        previewCtx.moveTo(x, offsetY);
        previewCtx.lineTo(x, offsetY + targetH * scale);
        previewCtx.stroke();
      }
      for (let row = 0; row <= 4; row++) {
        const y = offsetY + row * frameH * scale;
        previewCtx.beginPath();
        previewCtx.moveTo(offsetX, y);
        previewCtx.lineTo(offsetX + targetW * scale, y);
        previewCtx.stroke();
      }

      // 画已上传的帧
      for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const dir = DIRECTIONS[dirIdx].key;
        const imgs = faces[dir];
        const frames = getFrames(imgs);
        for (let f = 0; f < 3; f++) {
          if (!frames[f]) continue;
          const dx = offsetX + f * frameW * scale;
          const dy = offsetY + dirIdx * frameH * scale;
          previewCtx.save();
          previewCtx.translate(dx, dy);
          drawContainedImage(previewCtx, frames[f], frameW * scale, frameH * scale, { bottomCenter: true });
          previewCtx.restore();
        }
      }

      previewCtx.restore();

      // 方向标签
      previewCtx.fillStyle = 'rgba(255,255,255,0.5)';
      previewCtx.font = '10px "Noto Sans SC"';
      previewCtx.textAlign = 'left';
      for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const y = offsetY + dirIdx * frameH * scale + frameH * scale / 2;
        previewCtx.fillText(DIRECTIONS[dirIdx].label, 2, y + 3);
      }

      // 更新确认按钮状态
      const hasAny = DIRECTIONS.some(d => faces[d.key].length > 0);
      confirmBtn.disabled = !hasAny;
    }

    /** 从上传的图片列表生成 3 帧（1 张→复制为 3 帧，3 张→直接用） */
    function getFrames(imgs) {
      if (imgs.length === 0) return [null, null, null];
      if (imgs.length === 1) return [imgs[0], imgs[0], imgs[0]];
      if (imgs.length === 2) return [imgs[0], imgs[1], imgs[0]];
      return [imgs[0], imgs[1], imgs[2]];
    }

    // === 上传区域 ===
    function createDirectionUpload(dir) {
      const { key, label } = dir;
      const row = createElement('div', { className: 'sprite-dir-row' });
      row.appendChild(createElement('span', { className: 'sprite-dir-label' }, [label]));

      const fileInput = createElement('input', {
        type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true,
      });
      fileInput.style.display = 'none';

      const statusSpan = createElement('span', { className: 'sprite-dir-status' }, ['未上传']);

      const btn = createElement('button', { className: 'btn face-upload-btn' }, [
        lucideIcon('upload', 14),
        document.createTextNode(' 上传(1~3张)'),
      ]);
      btn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        const files = [...(fileInput.files || [])].slice(0, 3);
        fileInput.value = '';
        if (!files.length) return;
        try {
          const imgs = [];
          for (const file of files) {
            const img = typeof createImageBitmap === 'function'
              ? await createImageBitmap(file)
              : await new Promise((res, rej) => {
                  const url = URL.createObjectURL(file);
                  const image = new Image();
                  image.onload = () => { URL.revokeObjectURL(url); res(image); };
                  image.onerror = () => { URL.revokeObjectURL(url); rej(new Error('图片无法解码')); };
                  image.src = url;
                });
            imgs.push(img);
          }
          faces[key] = imgs;
          statusSpan.textContent = `已上传 ${imgs.length} 张`;
          btn.classList.add('uploaded');
          redraw();
        } catch {
          // 解码失败忽略
        }
      });

      row.appendChild(btn);
      row.appendChild(statusSpan);
      row.appendChild(fileInput);
      return row;
    }

    const uploadSection = createElement('div', { className: 'sprite-upload-section' });
    for (const dir of DIRECTIONS) {
      uploadSection.appendChild(createDirectionUpload(dir));
    }

    // === 按钮 ===
    const confirmBtn = createElement('button', { className: 'btn btn-primary', disabled: true }, [
      lucideIcon('layers', 14), document.createTextNode(' 确认拼合'),
    ]);
    confirmBtn.addEventListener('click', () => {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const outCtx = outCanvas.getContext('2d');
      outCtx.imageSmoothingEnabled = false;

      for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const dir = DIRECTIONS[dirIdx].key;
        const frames = getFrames(faces[dir]);
        for (let f = 0; f < 3; f++) {
          if (!frames[f]) continue;
          const dx = f * frameW;
          const dy = dirIdx * frameH;
          outCtx.save();
          outCtx.translate(dx, dy);
          drawContainedImage(outCtx, frames[f], frameW, frameH, { bottomCenter: true });
          outCtx.restore();
        }
      }

      outCanvas.toBlob((blob) => {
        ui.closeModal();
        resolve(blob);
      }, 'image/png');
    });

    const cancelBtn = createElement('button', { className: 'btn' }, [
      lucideIcon('x', 14), document.createTextNode(' 取消'),
    ]);
    cancelBtn.addEventListener('click', () => {
      ui.closeModal();
      resolve('cancel');
    });

    const controls = createElement('div', { className: 'crop-controls' }, [confirmBtn, cancelBtn]);

    const info = createElement('div', { className: 'crop-info' }, [
      `输出 ${targetW}×${targetH} 精灵表（3帧×4方向）。每个方向上传 1 张（自动复制为 3 帧）或 3 张走路动画帧。`,
    ]);

    const container = createElement('div', { className: 'crop-modal sprite-face-modal' }, [
      info,
      uploadSection,
      createElement('div', { className: 'face-preview-box' }, [
        createElement('div', { className: 'crop-preview-label' }, ['精灵表预览']),
        previewCanvas,
      ]),
      controls,
    ]);

    const content = ui.createModalContent('分片拼合精灵表', 'user', container);
    ui.openModal(content, 'modal-md');

    // 初始绘制
    redraw();
  });
}
