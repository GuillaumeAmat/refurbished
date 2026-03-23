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
  dropShadowColor?: string;
  dropShadowBlur?: number;
  dropShadowOffsetX?: number;
  dropShadowOffsetY?: number;
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
    dropShadowColor = '',
    dropShadowBlur = 0,
    dropShadowOffsetX = 0,
    dropShadowOffsetY = 0,
  } = options;

  const dpr = Math.min(window.devicePixelRatio, 2);
  const scaledFontSize = fontSize * dpr;
  const scaledPadding = padding * dpr;
  const scaledBgPaddingX = backgroundPaddingX * dpr;
  const scaledBgPaddingBottom = backgroundPaddingY * dpr;
  const scaledBgPaddingTop = (backgroundPaddingTop ?? backgroundPaddingY) * dpr;
  const scaledBorderRadius = borderRadius * dpr;
  const scaledShadowBlur = dropShadowBlur * dpr;
  const scaledShadowOffsetX = dropShadowOffsetX * dpr;
  const scaledShadowOffsetY = dropShadowOffsetY * dpr;
  // Extra canvas margin for shadow overflow
  const shadowMargin = dropShadowColor ? Math.ceil(scaledShadowBlur * 2 + Math.max(Math.abs(scaledShadowOffsetX), Math.abs(scaledShadowOffsetY))) : 0;

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

  const contentWidth = Math.ceil(textWidth + scaledPadding * 2 + scaledBgPaddingX * 2);
  const contentHeight = Math.ceil(textHeight + scaledPadding * 2 + scaledBgPaddingTop + scaledBgPaddingBottom);
  canvas.width = contentWidth + shadowMargin * 2;
  canvas.height = contentHeight + shadowMargin * 2;

  // Clear to transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Offset drawing by shadow margin
  ctx.translate(shadowMargin, shadowMargin);

  // Draw background container with optional drop shadow
  if (backgroundColor) {
    if (dropShadowColor) {
      ctx.shadowColor = dropShadowColor;
      ctx.shadowBlur = scaledShadowBlur;
      ctx.shadowOffsetX = scaledShadowOffsetX;
      ctx.shadowOffsetY = scaledShadowOffsetY;
    }
    ctx.fillStyle = backgroundColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, contentWidth, contentHeight, scaledBorderRadius);
    ctx.fill();
    // Reset shadow for text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Re-apply font after resize
  ctx.font = fontString;
  ctx.fillStyle = color;

  // Use actual glyph metrics for true vertical centering
  const metrics = ctx.measureText(referenceText || text || 'M');
  const glyphTop = metrics.actualBoundingBoxAscent;
  const glyphBottom = metrics.actualBoundingBoxDescent;
  const glyphHeight = glyphTop + glyphBottom;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = referenceText ? 'center' : 'left';
  const textX = referenceText ? contentWidth / 2 : scaledPadding + scaledBgPaddingX;
  const textY = (contentHeight - glyphHeight) / 2 + glyphTop;
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
