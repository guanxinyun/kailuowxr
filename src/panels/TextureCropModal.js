/**
 * 星尘殖民地 — 纹理裁剪弹窗
 * 用户上传图片后，在 canvas 上选择裁剪区域，输出指定尺寸的 PNG Blob。
 * 地形类型 (kind === 'tile') 裁剪正方形区域后等距投影成菱形。
 */
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { drawCheckerboard, drawContainedImage } from '../core/TexturePresentation.js';

/**
 * 将正方形源图区域等距投影到菱形 canvas
 * 正方形 (0,0)-(s,0)-(s,s)-(0,s) → 菱形 (W/2,0)-(W,H/2)-(W/2,H)-(0,H/2)
 * 仿射矩阵: a=W/(2s), b=H/(2s), c=-W/(2s), d=H/(2s), e=W/2, f=0
 */
function drawIsometricProjection(outCtx, sourceImage, sx, sy, sw, sh, outW, outH) {
  outCtx.save();
  // 菱形 clip
  outCtx.beginPath();
  outCtx.moveTo(outW / 2, 0);
  outCtx.lineTo(outW, outH / 2);
  outCtx.lineTo(outW / 2, outH);
  outCtx.lineTo(0, outH / 2);
  outCtx.closePath();
  outCtx.clip();
  // 仿射变换：正方形 → 菱形
  // (1,0) 方向 → (outW/2, outH/2) / sw  即 a=outW/(2*sw), b=outH/(2*sw)
  // (0,1) 方向 → (-outW/2, outH/2) / sh 即 c=-outW/(2*sh), d=outH/(2*sh)
  // 平移：(0,0) → (outW/2, 0) 即 e=outW/2, f=0
  const a = outW / (2 * sw);
  const b = outH / (2 * sw);
  const c = -outW / (2 * sh);
  const d = outH / (2 * sh);
  const e = outW / 2;
  const f = 0;
  outCtx.setTransform(a, b, c, d, e, f);
  // 在变换坐标系中，绘制源图裁剪区域到 (0,0)-(sw,sh)
  outCtx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, sw, sh);
  outCtx.restore();
  // 恢复默认变换
  outCtx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * 打开裁剪弹窗
 * @param {HTMLImageElement|ImageBitmap} sourceImage 原始图片
 * @param {number} targetW 目标宽度
 * @param {number} targetH 目标高度
 * @param {object} [opts]
 * @param {string} [opts.kind] 槽位类型：'tile' 时裁剪正方形并等距投影成菱形
 * @returns {Promise<Blob|null>} 裁剪后的 PNG Blob，取消返回 'cancel'，使用原图返回 null
 */
export function openCropModal(sourceImage, targetW, targetH, opts = {}) {
  const isDiamond = opts.kind === 'tile';
  const isBuilding = opts.kind === 'building';
  // 地形模式：裁剪框强制正方形（1:1），输出时投影成菱形
  const cropRatio = isDiamond ? 1 : targetW / targetH;

  return new Promise((resolve) => {
    let widthR = 2;
    let depthR = 2;
    let heightR = 3;
    let useCrop = false;
    const srcW = sourceImage.width || sourceImage.naturalWidth;
    const srcH = sourceImage.height || sourceImage.naturalHeight;

    // ===== 裁剪状态 =====
    const crop = { x: 0, y: 0, w: 0, h: 0 };

    // 初始裁剪框：居中，尽可能大，保持裁剪比例
    if (srcW / srcH > cropRatio) {
      crop.h = srcH;
      crop.w = Math.round(srcH * cropRatio);
    } else {
      crop.w = srcW;
      crop.h = Math.round(srcW / cropRatio);
    }
    crop.x = Math.round((srcW - crop.w) / 2);
    crop.y = Math.round((srcH - crop.h) / 2);

    // ===== Canvas 显示 =====
    const CANVAS_MAX = 480;
    const displayScale = Math.min(1, CANVAS_MAX / srcW, CANVAS_MAX / srcH);
    const canvasW = Math.round(srcW * displayScale);
    const canvasH = Math.round(srcH * displayScale);

    // 投影预览 canvas（地形模式下显示在主 canvas 右侧）
    let previewCanvas = null;
    let previewCtx = null;
    if (isDiamond || isBuilding) {
      const previewSize = 128;
      previewCanvas = createElement('canvas', {
        width: previewSize,
        height: isDiamond ? previewSize / 2 : previewSize,
        className: 'crop-preview-canvas',
      });
      previewCtx = previewCanvas.getContext('2d');
    }

    const canvas = createElement('canvas', {
      width: canvasW,
      height: canvasH,
      className: 'crop-canvas',
    });
    const ctx = canvas.getContext('2d');

    // ===== 绘制 =====
    function draw() {
      ctx.clearRect(0, 0, canvasW, canvasH);
      // 绘制原图
      ctx.drawImage(sourceImage, 0, 0, canvasW, canvasH);
      // 半透明遮罩
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // 裁剪区域显示坐标
      const dx = crop.x * displayScale;
      const dy = crop.y * displayScale;
      const dw = crop.w * displayScale;
      const dh = crop.h * displayScale;

      // 地形模式：裁剪框是正方形，但显示投影预览
      // 非地形模式：裁剪框是目标比例矩形
      ctx.drawImage(sourceImage, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh);

      // 边框
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(dx, dy, dw, dh);
      ctx.setLineDash([]);

      // 四角手柄
      const handleSize = 8;
      ctx.fillStyle = '#4fc3f7';
      const corners = [
        [dx, dy], [dx + dw, dy],
        [dx, dy + dh], [dx + dw, dy + dh],
      ];
      for (const [cx, cy] of corners) {
        ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
      }

      // 地形模式：在裁剪框内叠加菱形参考线
      if (isDiamond) {
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(dx + dw / 2, dy);
        ctx.lineTo(dx + dw, dy + dh / 2);
        ctx.lineTo(dx + dw / 2, dy + dh);
        ctx.lineTo(dx, dy + dh / 2);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 尺寸标注
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      const label = isDiamond ? `${crop.w}×${crop.h} → 菱形投影` : `${crop.w}×${crop.h}`;
      ctx.fillText(label, dx + dw / 2, dy - 6);

      // 更新最终效果预览
      if (previewCtx && previewCanvas) {
        const pw = previewCanvas.width;
        const ph = previewCanvas.height;
        previewCtx.clearRect(0, 0, pw, ph);
        drawCheckerboard(previewCtx, pw, ph);
        if (isDiamond) {
          drawIsometricProjection(previewCtx, sourceImage, crop.x, crop.y, crop.w, crop.h, pw, ph);
        } else if (isBuilding) {
          let image = sourceImage;
          if (useCrop) {
            const cropped = document.createElement('canvas');
            cropped.width = crop.w;
            cropped.height = crop.h;
            cropped.getContext('2d').drawImage(sourceImage, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
            image = cropped;
          }
          previewCtx.save();
          previewCtx.imageSmoothingEnabled = true;
          drawContainedImage(previewCtx, image, pw, ph, { frame: { widthR, depthR, heightR } });
          previewCtx.restore();
        }
      }
    }

    // ===== 交互 =====
    let dragging = null; // null | 'move' | 'nw' | 'ne' | 'sw' | 'se'
    let dragStart = { mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 };

    function getCanvasPos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvasW / rect.width),
        y: (e.clientY - rect.top) * (canvasH / rect.height),
      };
    }

    function hitTest(pos) {
      const dx = crop.x * displayScale;
      const dy = crop.y * displayScale;
      const dw = crop.w * displayScale;
      const dh = crop.h * displayScale;
      const margin = 12;

      // 矩形四角
      if (Math.abs(pos.x - dx) < margin && Math.abs(pos.y - dy) < margin) return 'nw';
      if (Math.abs(pos.x - (dx + dw)) < margin && Math.abs(pos.y - dy) < margin) return 'ne';
      if (Math.abs(pos.x - dx) < margin && Math.abs(pos.y - (dy + dh)) < margin) return 'sw';
      if (Math.abs(pos.x - (dx + dw)) < margin && Math.abs(pos.y - (dy + dh)) < margin) return 'se';
      // 矩形内部
      if (pos.x >= dx && pos.x <= dx + dw && pos.y >= dy && pos.y <= dy + dh) return 'move';
      return null;
    }

    canvas.addEventListener('mousedown', (e) => {
      const pos = getCanvasPos(e);
      const hit = hitTest(pos);
      if (!hit) return;
      dragging = hit;
      dragStart = { mx: pos.x, my: pos.y, cx: crop.x, cy: crop.y, cw: crop.w, ch: crop.h };
      e.preventDefault();
    });

    canvas.addEventListener('mousemove', (e) => {
      const pos = getCanvasPos(e);
      if (!dragging) {
        const hit = hitTest(pos);
        canvas.style.cursor = hit === 'move' ? 'move'
          : hit === 'nw' || hit === 'se' ? 'nwse-resize'
          : hit === 'ne' || hit === 'sw' ? 'nesw-resize'
          : 'default';
        return;
      }
      const deltaX = (pos.x - dragStart.mx) / displayScale;
      const deltaY = (pos.y - dragStart.my) / displayScale;

      if (dragging === 'move') {
        crop.x = Math.max(0, Math.min(srcW - crop.w, Math.round(dragStart.cx + deltaX)));
        crop.y = Math.max(0, Math.min(srcH - crop.h, Math.round(dragStart.cy + deltaY)));
      } else {
        // 角落缩放，保持比例
        let newW, newH;
        if (dragging === 'se') {
          newW = Math.round(dragStart.cw + deltaX);
        } else if (dragging === 'nw') {
          newW = Math.round(dragStart.cw - deltaX);
        } else if (dragging === 'ne') {
          newW = Math.round(dragStart.cw + deltaX);
        } else { // sw
          newW = Math.round(dragStart.cw - deltaX);
        }
        newH = Math.round(newW / cropRatio);
        // 最小尺寸
        const minDim = 16;
        newW = Math.max(minDim, newW);
        newH = Math.max(minDim, newH);
        // 不超出原图
        if (dragging === 'nw' || dragging === 'sw') {
          const maxW = dragStart.cx + dragStart.cw;
          newW = Math.min(newW, maxW);
          newH = Math.round(newW / cropRatio);
          crop.x = Math.round(dragStart.cx + dragStart.cw - newW);
        } else {
          newW = Math.min(newW, srcW - dragStart.cx);
          newH = Math.round(newW / cropRatio);
        }
        if (dragging === 'nw' || dragging === 'ne') {
          const maxH = dragStart.cy + dragStart.ch;
          if (newH > maxH) {
            newH = maxH;
            newW = Math.round(newH * cropRatio);
          }
          crop.y = Math.round(dragStart.cy + dragStart.ch - newH);
        } else {
          if (newH > srcH - dragStart.cy) {
            newH = srcH - dragStart.cy;
            newW = Math.round(newH * cropRatio);
          }
        }
        crop.w = newW;
        crop.h = newH;
      }
      draw();
    });

    const onMouseUp = () => { dragging = null; };
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    // 滚轮缩放
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const centerX = crop.x + crop.w / 2;
      const centerY = crop.y + crop.h / 2;
      let newW = Math.round(crop.w * zoomFactor);
      let newH = Math.round(newW / cropRatio);
      newW = Math.max(16, Math.min(srcW, newW));
      newH = Math.round(newW / cropRatio);
      if (newH > srcH) { newH = srcH; newW = Math.round(newH * cropRatio); }
      crop.w = newW;
      crop.h = newH;
      crop.x = Math.max(0, Math.min(srcW - crop.w, Math.round(centerX - crop.w / 2)));
      crop.y = Math.max(0, Math.min(srcH - crop.h, Math.round(centerY - crop.h / 2)));
      draw();
    }, { passive: false });

    const sliders = createElement('div', { className: 'face-sliders' });
    if (isBuilding) {
      const createSlider = (label, min, max, step, value, onChange) => {
        const valueLabel = createElement('span', { className: 'face-slider-value' }, [value.toFixed(1)]);
        const range = createElement('input', {
          type: 'range', min: String(min), max: String(max), step: String(step), value: String(value),
          className: 'face-slider-input',
        });
        range.addEventListener('input', () => {
          const next = Number(range.value);
          valueLabel.textContent = next.toFixed(1);
          onChange(next);
          draw();
        });
        return createElement('div', { className: 'face-slider-row' }, [
          createElement('span', { className: 'face-slider-label' }, [label]), range, valueLabel,
        ]);
      };
      sliders.append(
        createSlider('宽度', 0.5, 2, 0.1, widthR, value => { widthR = value; }),
        createSlider('深度', 0.5, 2, 0.1, depthR, value => { depthR = value; }),
        createSlider('高度', 1, 3, 0.1, heightR, value => { heightR = value; }),
      );
    }

    // ===== 按钮 =====
    const confirmBtn = createElement('button', { className: 'btn btn-primary' }, [
      lucideIcon('crop', 14), document.createTextNode(isDiamond ? ' 确认（等距投影）' : isBuilding ? ' 确认导入' : ' 确认裁剪'),
    ]);
    confirmBtn.addEventListener('click', () => {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const outCtx = outCanvas.getContext('2d');

      if (isDiamond) {
        // 等距投影：正方形 → 菱形
        drawIsometricProjection(outCtx, sourceImage, crop.x, crop.y, crop.w, crop.h, targetW, targetH);
      } else if (isBuilding) {
        let image = sourceImage;
        if (useCrop) {
          const cropped = document.createElement('canvas');
          cropped.width = crop.w;
          cropped.height = crop.h;
          cropped.getContext('2d').drawImage(sourceImage, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
          image = cropped;
        }
        drawContainedImage(outCtx, image, targetW, targetH, { frame: { widthR, depthR, heightR } });
      } else {
        outCtx.drawImage(sourceImage, crop.x, crop.y, crop.w, crop.h, 0, 0, targetW, targetH);
      }

      outCanvas.toBlob((blob) => {
        ui.closeModal();
        resolve(blob);
      }, 'image/png');
    });

    const originalBtn = createElement('button', { className: 'btn' }, [
      lucideIcon('crop', 14), document.createTextNode(isBuilding ? ' 使用裁剪区域' : ' 使用原图'),
    ]);
    originalBtn.addEventListener('click', () => {
      if (!isBuilding) {
        ui.closeModal();
        resolve(null);
        return;
      }
      useCrop = !useCrop;
      originalBtn.classList.toggle('uploaded', useCrop);
      originalBtn.textContent = '';
      originalBtn.appendChild(lucideIcon(useCrop ? 'check' : 'crop', 14));
      originalBtn.appendChild(document.createTextNode(useCrop ? ' 已使用裁剪区域' : ' 使用裁剪区域'));
      draw();
    });

    const cancelBtn = createElement('button', { className: 'btn' }, [
      lucideIcon('x', 14), document.createTextNode(' 取消'),
    ]);
    cancelBtn.addEventListener('click', () => {
      ui.closeModal();
      resolve('cancel');
    });

    const shapeHint = isDiamond
      ? '（正方形→等距菱形投影）'
      : isBuilding ? '（保持比例，不做等距投影）' : '';
    const info = createElement('div', { className: 'crop-info' }, [
      `原图 ${srcW}×${srcH} → 输出 ${targetW}×${targetH}${shapeHint}　宽/深/高控制最终尺寸；需要裁剪时拖拽或滚轮调整后启用“使用裁剪区域”`,
    ]);

    const controls = createElement('div', { className: 'crop-controls' }, [
      confirmBtn, originalBtn, cancelBtn,
    ]);

    const children = [info];
    if (isBuilding) children.push(sliders);
    if ((isDiamond || isBuilding) && previewCanvas) {
      const canvasRow = createElement('div', { className: 'crop-canvas-row' }, [
        canvas,
        createElement('div', { className: 'crop-preview-box' }, [
          createElement('div', { className: 'crop-preview-label' }, [isDiamond ? '投影预览' : '完整图预览']),
          previewCanvas,
        ]),
      ]);
      children.push(canvasRow);
    } else {
      children.push(canvas);
    }
    children.push(controls);

    const container = createElement('div', { className: 'crop-modal' }, children);

    const content = ui.createModalContent('裁剪纹理', 'crop', container);
    ui.openModal(content, 'modal-md');

    // 初始绘制
    draw();
  });
}
