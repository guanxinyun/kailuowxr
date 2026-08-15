const BUILDING_MAX_WIDTH = 64;
const BUILDING_MAX_HEIGHT = 48;

export const SPRITE_FRAME_SIZE = Object.freeze({ width: 32, height: 32 });
const SPRITE_DRAW_SIZE = 32;

export function getFullImageFrame(sourceW, sourceH, widthR = 1, depthR = 1, heightR = 1) {
  return { sourceW, sourceH, widthR, depthR, heightR };
}

export function getFullImageDrawRect(sourceW, sourceH, maxW, maxH, widthR = 1, depthR = 1, heightR = 2) {
  const widthScale = Math.min(2, Math.max(0.5, widthR)) / 2;
  const heightScale = Math.min(3, Math.max(1, heightR)) / 3;
  const rect = containRect(sourceW, sourceH, maxW * widthScale, maxH * heightScale);
  const depthPosition = (Math.min(2, Math.max(0.5, depthR)) - 0.5) / 1.5;
  return {
    width: rect.width,
    height: rect.height,
    x: Math.round((maxW - rect.width) / 2),
    y: Math.round((maxH - rect.height) * depthPosition),
  };
}

export function getSpriteDrawRect(anchorX, anchorY, scale = 1) {
  const width = SPRITE_DRAW_SIZE * scale;
  const height = SPRITE_DRAW_SIZE * scale;
  return {
    x: anchorX - width / 2,
    y: anchorY - height,
    width,
    height,
  };
}

export function containRect(sourceW, sourceH, maxW, maxH) {
  if (!(sourceW > 0) || !(sourceH > 0) || !(maxW > 0) || !(maxH > 0)) {
    return { width: 0, height: 0, x: 0, y: 0 };
  }
  const scale = Math.min(maxW / sourceW, maxH / sourceH);
  const width = Math.round(sourceW * scale);
  const height = Math.round(sourceH * scale);
  return {
    width,
    height,
    x: Math.round((maxW - width) / 2),
    y: Math.round((maxH - height) / 2),
  };
}

export function getBottomCenterDrawPosition(anchorX, anchorY, sourceW, sourceH, maxW = BUILDING_MAX_WIDTH, maxH = BUILDING_MAX_HEIGHT) {
  const rect = containRect(sourceW, sourceH, maxW, maxH);
  return {
    x: anchorX - rect.width / 2,
    y: anchorY - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

export function getBuildingDrawPosition(anchorX, anchorY, sourceW, sourceH) {
  return getBottomCenterDrawPosition(anchorX, anchorY, sourceW, sourceH, BUILDING_MAX_WIDTH, BUILDING_MAX_HEIGHT);
}

export function drawCheckerboard(ctx, width, height, cellSize = 8) {
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(0, 0, width, height);
  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      if ((x / cellSize + y / cellSize) % 2 === 0) {
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }
}

export function drawContainedImage(ctx, image, maxW, maxH, options = {}) {
  const sourceW = image.width || image.naturalWidth;
  const sourceH = image.height || image.naturalHeight;
  const rect = options.frame
    ? getFullImageDrawRect(sourceW, sourceH, maxW, maxH, options.frame.widthR, options.frame.depthR, options.frame.heightR)
    : containRect(sourceW, sourceH, maxW, maxH);
  const x = options.frame
    ? rect.x
    : options.bottomCenter ? (maxW - rect.width) / 2 : rect.x;
  const y = options.frame
    ? rect.y
    : options.bottomCenter ? maxH - rect.height : rect.y;
  ctx.drawImage(image, x, y, rect.width, rect.height);
  return { ...rect, x, y };
}
