import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

import type { TextTextureResult } from './createTextTexture';

export interface PillButtonTextureOptions {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  paddingX?: number;
  paddingY?: number;
  fixedHeight?: number;
  transparent?: boolean;
  minCanvasWidth?: number;
}

export function createPillButtonTexture(options: PillButtonTextureOptions): TextTextureResult {
  const {
    text,
    fontSize = 36,
    fontFamily = 'BMDupletTXT, system-ui, sans-serif',
    fontWeight = '600',
    color,
    backgroundColor = '#000000',
    paddingX = 64,
    paddingY = 24,
    fixedHeight,
    transparent = false,
    minCanvasWidth,
  } = options;

  const resolvedColor = color ?? (transparent ? '#000000' : '#FFFFFF');

  const dpr = Math.min(window.devicePixelRatio, 2);
  const scaledFontSize = fontSize * dpr;
  const scaledPaddingX = paddingX * dpr;
  const scaledPaddingY = paddingY * dpr;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  const fontString = `${fontWeight ? fontWeight + ' ' : ''}${scaledFontSize}px ${fontFamily}`;
  ctx.font = fontString;
  const metrics = ctx.measureText(text);
  const textWidth = Math.max(metrics.width, 1);
  const textHeight = scaledFontSize;

  canvas.height = fixedHeight ? Math.ceil(fixedHeight * dpr) : Math.ceil(textHeight + scaledPaddingY * 2);
  const r = canvas.height / 2;
  canvas.width = Math.ceil(textWidth + scaledPaddingX * 2 + r * 2 - scaledPaddingX * 2);
  // Ensure minimum width so semicircles don't overlap
  canvas.width = Math.max(canvas.width, Math.ceil(textWidth + r * 2));
  if (minCanvasWidth) {
    canvas.width = Math.max(canvas.width, Math.ceil(minCanvasWidth * dpr));
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!transparent) {
    // Draw stadium shape (rect with perfect semicircle caps)
    const cy = canvas.height / 2;
    ctx.beginPath();
    ctx.arc(r, cy, r, Math.PI / 2, -Math.PI / 2);
    ctx.lineTo(canvas.width - r, 0);
    ctx.arc(canvas.width - r, cy, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(r, canvas.height);
    ctx.closePath();
    ctx.fillStyle = backgroundColor;
    ctx.fill();
  }

  // Draw centered text
  ctx.font = fontString;
  ctx.textBaseline = 'top';
  ctx.fillStyle = resolvedColor;
  const tx = (canvas.width - textWidth) / 2;
  const ty = (canvas.height - textHeight) / 2;
  ctx.fillText(text, tx, ty);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  return {
    texture,
    width,
    height,
    aspectRatio: width / height,
  };
}
