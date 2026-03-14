import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

import { COLORS } from '../constants';
import type { TextTextureResult } from './createTextTexture';

export interface ScoreEntry {
  rank: number;
  player1: string;
  player2: string;
  score: number;
}

const BG_COLOR = '#F0F0F0';
const LILAC = COLORS.lilac;
const FONT_FAMILY = 'RobotoMono, monospace';
const TOP_5_COUNT = 5;

export function createLeaderboardTableTexture(
  scores: ScoreEntry[],
  maxRows = 15,
  targetHeight?: number,
): TextTextureResult {
  const dpr = Math.min(window.devicePixelRatio, 2);

  // Scale factor to get a sharp canvas texture.
  // targetHeight is in CSS px; we render at 2× that for crisp text.
  const scale = 2;
  const baseFontSize = targetHeight
    ? Math.floor((targetHeight * scale * dpr) / (maxRows * 1.8 + 2))
    : 32 * dpr;
  const fontSize = Math.max(baseFontSize, 16 * dpr);
  const rowHeight = fontSize * 2;
  const paddingX = fontSize * 1.4;
  const paddingY = fontSize * 0.9;
  const cornerRadius = 12 * dpr * scale;

  const canvasWidth = targetHeight
    ? Math.ceil(targetHeight * 0.72 * scale * dpr)
    : 720 * dpr;
  const canvasHeight = rowHeight * maxRows + paddingY * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(canvasWidth);
  canvas.height = Math.ceil(canvasHeight);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Failed to get 2D context');

  // Draw rounded-rect background
  drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, cornerRadius, BG_COLOR);

  // Column positions — names centered with even gaps to rank and score columns
  const rankColWidth = fontSize * 2.4;
  const scoreColWidth = fontSize * 3;
  const rankX = paddingX + rankColWidth / 2;
  const scoreX = canvas.width - paddingX - fontSize * 0.5;
  const namesCenter = paddingX + rankColWidth + (canvas.width - paddingX * 2 - rankColWidth - scoreColWidth) / 2;

  // Draw one continuous lilac pill (stadium shape) behind ranks 1–5
  if (maxRows >= TOP_5_COUNT) {
    const firstRowY = paddingY;
    const lastRowY = paddingY + (TOP_5_COUNT - 1) * rowHeight;
    const pillMargin = fontSize * 0.08;
    const fullW = rankColWidth + pillMargin * 2;
    const pillW = fullW * 2 / 3;
    const pillX = paddingX - pillMargin + (fullW - pillW) / 2;
    const pillY = firstRowY + pillMargin;
    const pillH = lastRowY + rowHeight - firstRowY - pillMargin * 2;
    const r = pillW / 2;
    const cx = pillX + r; // horizontal center

    ctx.beginPath();
    // Top semi-circle
    ctx.arc(cx, pillY + r, r, Math.PI, 0);
    // Right edge down
    ctx.lineTo(pillX + pillW, pillY + pillH - r);
    // Bottom semi-circle
    ctx.arc(cx, pillY + pillH - r, r, 0, Math.PI);
    // Left edge up (closed automatically)
    ctx.closePath();
    ctx.fillStyle = LILAC;
    ctx.fill();
  }

  for (let i = 0; i < maxRows; i++) {
    const entry = scores[i];
    const y = paddingY + i * rowHeight;
    const textY = y + rowHeight / 2;
    const isTop5 = i < TOP_5_COUNT;
    const fontWeight = isTop5 ? '700' : '400';
    const fontString = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
    const textColor = '#000000';

    ctx.font = fontString;
    ctx.textBaseline = 'middle';

    const rankText = entry ? `${entry.rank}` : `${i + 1}`;

    // Rank (center-aligned in rank column)
    ctx.font = fontString;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.fillText(rankText, rankX, textY);

    if (entry) {
      // Names (centered between rank and score columns)
      ctx.textAlign = 'center';
      const names = `${entry.player1} & ${entry.player2}`;
      const maxNamesWidth = canvas.width - paddingX * 2 - rankColWidth - scoreColWidth - fontSize;
      ctx.fillText(truncate(ctx, names, maxNamesWidth), namesCenter, textY);

      // Score (right-aligned)
      ctx.textAlign = 'right';
      ctx.fillText(`${entry.score}`, scoreX, textY);
    } else {
      // Placeholder names
      ctx.textAlign = 'center';
      ctx.fillText('.........', namesCenter, textY);

      // Placeholder score
      ctx.textAlign = 'right';
      ctx.fillText('0', scoreX, textY);
    }
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}
