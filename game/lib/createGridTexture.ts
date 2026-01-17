import { CanvasTexture, RepeatWrapping } from 'three';

interface GridTextureOptions {
  backgroundColor?: string;
  gridColor?: string;
  gridSpacing?: number;
  lineWidth?: number;
  textureSize?: number;
  minorLineOpacity?: number;
  majorLineOpacity?: number;
  majorLineInterval?: number;
}

export function createGridTexture(options: GridTextureOptions = {}): CanvasTexture {
  const {
    backgroundColor = '#2B5F9E',
    gridColor = '#FFFFFF',
    gridSpacing = 32,
    lineWidth = 2,
    textureSize = 512,
    minorLineOpacity = 1.0,
    majorLineOpacity = 1.0,
    majorLineInterval = 1,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, textureSize, textureSize);

  // Draw grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = lineWidth;

  // Vertical lines
  let lineIndex = 0;
  for (let x = 0; x <= textureSize; x += gridSpacing) {
    ctx.globalAlpha = lineIndex % majorLineInterval === 0 ? majorLineOpacity : minorLineOpacity;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, textureSize);
    ctx.stroke();
    lineIndex++;
  }

  // Horizontal lines
  lineIndex = 0;
  for (let y = 0; y <= textureSize; y += gridSpacing) {
    ctx.globalAlpha = lineIndex % majorLineInterval === 0 ? majorLineOpacity : minorLineOpacity;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(textureSize, y);
    ctx.stroke();
    lineIndex++;
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
}
