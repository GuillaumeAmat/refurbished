import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface TextTextureOptions {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  padding?: number;
}

export interface TextTextureResult {
  texture: CanvasTexture;
  width: number;
  height: number;
  aspectRatio: number;
}

export function createTextTexture(options: TextTextureOptions): TextTextureResult {
  const {
    text,
    fontSize = 48,
    fontFamily = 'BMDupletDSP, system-ui, sans-serif',
    fontWeight = '',
    color = '#FFFFFF',
    padding = 4,
  } = options;

  const dpr = Math.min(window.devicePixelRatio, 2);
  const scaledFontSize = fontSize * dpr;
  const scaledPadding = padding * dpr;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  const fontString = `${fontWeight ? fontWeight + ' ' : ''}${scaledFontSize}px ${fontFamily}`;
  ctx.font = fontString;
  const metrics = ctx.measureText(text || ' ');
  const textWidth = Math.max(metrics.width, 1);
  const textHeight = scaledFontSize;

  canvas.width = Math.ceil(textWidth + scaledPadding * 2);
  canvas.height = Math.ceil(textHeight + scaledPadding * 2);

  // Clear to transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Re-apply font after resize
  ctx.font = fontString;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(text, scaledPadding, scaledPadding);

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
