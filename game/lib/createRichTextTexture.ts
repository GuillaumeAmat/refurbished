import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

import type { TextTextureResult } from './createTextTexture';

export interface RichTextSegment {
  text: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
}

export interface RichTextTextureOptions {
  segments: RichTextSegment[];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  padding?: number;
}

export function createRichTextTexture(options: RichTextTextureOptions): TextTextureResult {
  const {
    segments,
    fontSize = 48,
    fontFamily = 'BMDupletTXT, system-ui, sans-serif',
    fontWeight = '',
    fontStyle = '',
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

  const buildFontString = (seg: RichTextSegment) => {
    const fs = seg.fontStyle ?? fontStyle;
    const fw = seg.fontWeight ?? fontWeight;
    const ff = seg.fontFamily ?? fontFamily;
    return `${fs ? fs + ' ' : ''}${fw ? fw + ' ' : ''}${scaledFontSize}px ${ff}`;
  };

  // Measure total width
  let totalWidth = 0;
  for (const seg of segments) {
    ctx.font = buildFontString(seg);
    totalWidth += ctx.measureText(seg.text).width;
  }

  totalWidth = Math.max(totalWidth, 1);
  const textHeight = scaledFontSize;

  canvas.width = Math.ceil(totalWidth + scaledPadding * 2);
  canvas.height = Math.ceil(textHeight + scaledPadding * 2);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;

  let x = scaledPadding;
  for (const seg of segments) {
    ctx.font = buildFontString(seg);
    ctx.fillText(seg.text, x, scaledPadding);
    x += ctx.measureText(seg.text).width;
  }

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
