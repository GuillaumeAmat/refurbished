import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface TextTextureOptions {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  padding?: number;
  backgroundColor?: string;
  borderRadius?: number;
  backgroundPaddingX?: number;
  backgroundPaddingY?: number;
  backgroundPaddingTop?: number;
  referenceText?: string;
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
    fontStyle = '',
    color = '#FFFFFF',
    padding = 4,
    backgroundColor,
    borderRadius = 0,
    backgroundPaddingX = 0,
    backgroundPaddingY = 0,
    backgroundPaddingTop,
    referenceText,
  } = options;

  const dpr = Math.min(window.devicePixelRatio, 2);
  const scaledFontSize = fontSize * dpr;
  const scaledPadding = padding * dpr;
  const scaledBgPaddingX = backgroundPaddingX * dpr;
  const scaledBgPaddingBottom = backgroundPaddingY * dpr;
  const scaledBgPaddingTop = (backgroundPaddingTop ?? backgroundPaddingY) * dpr;
  const scaledBorderRadius = borderRadius * dpr;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  const fontString = `${fontStyle ? fontStyle + ' ' : ''}${fontWeight ? fontWeight + ' ' : ''}${scaledFontSize}px ${fontFamily}`;
  ctx.font = fontString;
  const refMetrics = ctx.measureText(referenceText ?? text ?? ' ');
  const textWidth = Math.max(refMetrics.width, 1);
  const textHeight = scaledFontSize;

  canvas.width = Math.ceil(textWidth + scaledPadding * 2 + scaledBgPaddingX * 2);
  canvas.height = Math.ceil(textHeight + scaledPadding * 2 + scaledBgPaddingTop + scaledBgPaddingBottom);

  // Clear to transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background container
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, scaledBorderRadius);
    ctx.fill();
  }

  // Re-apply font after resize
  ctx.font = fontString;
  ctx.textBaseline = 'middle';
  ctx.textAlign = referenceText ? 'center' : 'left';
  ctx.fillStyle = color;
  const textX = referenceText ? canvas.width / 2 : scaledPadding + scaledBgPaddingX;
  const textY = scaledPadding + scaledBgPaddingTop + textHeight / 2;
  ctx.fillText(text, textX, textY);

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
