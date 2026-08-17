/**
 * 星尘殖民地 — 建筑分面拼合弹窗
 * 用户分别上传正面、顶面（必须）和侧面（可选），
 * 通过仿射变换拼合成等距建筑纹理，滑块调整宽/深/高比例。
 */
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';

const PREVIEW_MAX = 128; // 预览 canvas 最大边长

/**
 * 将参数映射到等距盒体尺寸
 * @param {number} widthR  宽度比例 0.5–2.0
 * @param {number} depthR  深度比例 0.5–2.0
 * @param {number} heightR 高度比例 1.0–3.0
 * @param {number} outW    输出画布宽度
 * @param {number} outH    输出画布高度
 */
function calcBoxParams(widthR, depthR, heightR, outW, outH) {
  // 基准：宽度比例 1.0 → 半宽 = outW/4，深度 1.0 → 半深 = outH/6，高度 2.0 → 墙高 = outH/2
  let bw = widthR * (outW / 4);
  let bd = depthR * (outH / 6);
  let bh = heightR * (outH / 4);
  // clamp 到输出尺寸
  if (2 * bw > outW) bw = outW / 2;
  const totalH = 2 * bd + bh;
  if (totalH > outH) {
    const s = outH / totalH;
    bd *= s;
    bh *= s;
  }
  const ox = (outW - 2 * bw) / 2;
  const oy = outH - (2 * bd + bh);
  return { bw, bd, bh, ox, oy };
}

/**
 * 绘制等距建筑（仿射变换拼合三个面）
 * @param {boolean} withBackground 是否画棋盘格背景（预览用）
 */
function renderBuilding(ctx, frontImg, topImg, sideImg, bw, bd, bh, ox, oy, outW, outH, withBackground) {
  ctx.clearRect(0, 0, outW, outH);

  if (withBackground) {
    // 棋盘格透明背景（仅预览）
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, 0, outW, outH);
    for (let py = 0; py < outH; py += 8) {
      for (let px = 0; px < outW; px += 8) {
        if ((px + py) % 16 === 0) {
          ctx.fillStyle = '#3a3a4a';
          ctx.fillRect(px, py, 8, 8);
        }
      }
    }
  }

  // 如果没有正面和顶面，画占位线框
  if (!frontImg || !topImg) {
    drawWireframe(ctx, bw, bd, bh, ox, oy);
    return;
  }

  const rImg = sideImg || frontImg;
  const mirrored = !sideImg;

  // 1. 右墙（最远）
  ctx.save();
  const rsw = rImg.width, rsh = rImg.height;
  if (mirrored) {
    ctx.setTransform(-bw / rsw, bd / rsw, 0, bh / rsh, ox + 2 * bw, oy + bd);
  } else {
    ctx.setTransform(bw / rsw, -bd / rsw, 0, bh / rsh, ox + bw, oy + 2 * bd);
  }
  ctx.drawImage(rImg, 0, 0);
  ctx.restore();

  // 2. 左墙（正面）
  ctx.save();
  const fsw = frontImg.width, fsh = frontImg.height;
  ctx.setTransform(bw / fsw, bd / fsw, 0, bh / fsh, ox, oy + bd);
  ctx.drawImage(frontImg, 0, 0);
  ctx.restore();

  // 3. 顶面（最前）
  ctx.save();
  const tW = topImg.width;
  const tH = topImg.height;
  ctx.setTransform(bw / tW, -bd / tW, bw / tH, bd / tH, ox, oy + bd);
  ctx.drawImage(topImg, 0, 0);
  ctx.restore();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** 画线框占位 */
function drawWireframe(ctx, bw, bd, bh, ox, oy) {
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  // 顶面菱形
  ctx.beginPath();
  ctx.moveTo(ox + bw, oy);
  ctx.lineTo(ox + 2 * bw, oy + bd);
  ctx.lineTo(ox + bw, oy + 2 * bd);
  ctx.lineTo(ox, oy + bd);
  ctx.closePath();
  ctx.stroke();

  // 左墙
  ctx.beginPath();
  ctx.moveTo(ox, oy + bd);
  ctx.lineTo(ox, oy + bd + bh);
  ctx.lineTo(ox + bw, oy + 2 * bd + bh);
  ctx.lineTo(ox + bw, oy + 2 * bd);
  ctx.closePath();
  ctx.stroke();

  // 右墙
  ctx.beginPath();
  ctx.moveTo(ox + 2 * bw, oy + bd);
  ctx.lineTo(ox + 2 * bw, oy + bd + bh);
  ctx.lineTo(ox + bw, oy + 2 * bd + bh);
  ctx.lineTo(ox + bw, oy + 2 * bd);
  ctx.closePath();
  ctx.stroke();

  ctx.setLineDash([]);
}

/**
 * 打开分面拼合弹窗
 * @param {number} targetW 输出宽度
 * @param {number} targetH 输出高度
 * @returns {Promise<Blob|'cancel'>}
 */
export function openBuildingFaceModal(targetW, targetH) {
  // 预览画布与输出保持相同宽高比，避免等距预览与实际纹理比例不一致
  const previewScale = Math.min(PREVIEW_MAX / targetW, PREVIEW_MAX / targetH);
  const previewW = Math.round(targetW * previewScale);
  const previewH = Math.round(targetH * previewScale);

  return new Promise((resolve) => {
    // 状态
    const faces = { front: null, top: null, side: null };
    let widthR = 1.0, depthR = 1.0, heightR = 2.0;

    // 预览 canvas（与输出同宽高比）
    const previewCanvas = createElement('canvas', {
      width: previewW, height: previewH, className: 'face-preview-canvas',
    });
    const previewCtx = previewCanvas.getContext('2d');

    function redraw() {
      // 预览用与输出同宽高比的画布 + 棋盘格背景
      const { bw, bd, bh, ox, oy } = calcBoxParams(widthR, depthR, heightR, previewW, previewH);
      renderBuilding(previewCtx, faces.front, faces.top, faces.side, bw, bd, bh, ox, oy, previewW, previewH, true);
      confirmBtn.disabled = !(faces.front && faces.top);
    }

    // === 上传按钮 ===
    function createFaceUpload(label, key, required) {
      const fileInput = createElement('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
      fileInput.style.display = 'none';

      const btn = createElement('button', { className: 'btn face-upload-btn' }, [
        lucideIcon('upload', 14),
        document.createTextNode(` ${label}${required ? '' : '(可选)'}`),
      ]);

      btn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        try {
          const img = typeof createImageBitmap === 'function'
            ? await createImageBitmap(file)
            : await new Promise((res, rej) => {
                const url = URL.createObjectURL(file);
                const image = new Image();
                image.onload = () => { URL.revokeObjectURL(url); res(image); };
                image.onerror = () => { URL.revokeObjectURL(url); rej(new Error('图片无法解码')); };
                image.src = url;
              });
          faces[key] = img;
          btn.classList.add('uploaded');
          btn.textContent = '';
          btn.appendChild(lucideIcon('check', 14));
          btn.appendChild(document.createTextNode(` ${label} ✓`));
          redraw();
        } catch {
          // 解码失败忽略
        }
      });

      const wrapper = createElement('div', { className: 'face-upload-item' }, [fileInput, btn]);
      return wrapper;
    }

    const uploadRow = createElement('div', { className: 'face-upload-row' }, [
      createFaceUpload('正面', 'front', true),
      createFaceUpload('顶面', 'top', true),
      createFaceUpload('侧面', 'side', false),
    ]);

    // === 滑块 ===
    function createSlider(label, min, max, step, defaultVal, onChange) {
      const valueLabel = createElement('span', { className: 'face-slider-value' }, [defaultVal.toFixed(1)]);
      const range = createElement('input', {
        type: 'range', min: String(min), max: String(max), step: String(step), value: String(defaultVal),
        className: 'face-slider-input',
      });
      range.addEventListener('input', () => {
        const v = parseFloat(range.value);
        valueLabel.textContent = v.toFixed(1);
        onChange(v);
        redraw();
      });
      return createElement('div', { className: 'face-slider-row' }, [
        createElement('span', { className: 'face-slider-label' }, [label]),
        range,
        valueLabel,
      ]);
    }

    const sliders = createElement('div', { className: 'face-sliders' }, [
      createSlider('宽度', 0.5, 2.0, 0.1, 1.0, (v) => { widthR = v; }),
      createSlider('深度', 0.5, 2.0, 0.1, 1.0, (v) => { depthR = v; }),
      createSlider('高度', 1.0, 3.0, 0.1, 2.0, (v) => { heightR = v; }),
    ]);

    // === 按钮 ===
    const confirmBtn = createElement('button', { className: 'btn btn-primary', disabled: true }, [
      lucideIcon('box', 14), document.createTextNode(' 确认拼合'),
    ]);
    confirmBtn.addEventListener('click', () => {
      // 输出用目标尺寸，透明背景
      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const outCtx = outCanvas.getContext('2d');
      const { bw, bd, bh, ox, oy } = calcBoxParams(widthR, depthR, heightR, targetW, targetH);
      renderBuilding(outCtx, faces.front, faces.top, faces.side, bw, bd, bh, ox, oy, targetW, targetH, false);
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
      `输出 ${targetW}×${targetH} 透明 PNG。上传正面和顶面（必须），侧面可选（缺省镜像正面）。`,
    ]);

    const container = createElement('div', { className: 'crop-modal face-modal' }, [
      info,
      uploadRow,
      sliders,
      createElement('div', { className: 'face-preview-box' }, [
        createElement('div', { className: 'crop-preview-label' }, ['等距预览']),
        previewCanvas,
      ]),
      controls,
    ]);

    const content = ui.createModalContent('分面拼合建筑纹理', 'box', container);
    ui.openModal(content, 'modal-md');

    // 初始绘制线框
    redraw();
  });
}
