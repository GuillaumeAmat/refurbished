import { createError, defineEventHandler, readBody } from 'h3';

import { recordGameEvent } from '../../utils/gameSession';

// Duplicated from game/constants.ts (server bundle cannot import client code)
const ORDER_BASE_POINTS = 20;
const ORDER_EXPIRE_PENALTY = -20;
// floor((ORDER_DURATION_MS + ORDER_DURATION_MS/3) / 1000 / 2) — longest burst order
const MAX_TIME_BONUS = 63;
const MAX_MULTIPLIER = 4;

function isValidDelta(delta: number): boolean {
  if (!Number.isInteger(delta)) return false;
  if (delta === ORDER_EXPIRE_PENALTY) return true;
  // delta must decompose as (ORDER_BASE_POINTS + timeBonus) * multiplier
  for (let m = 1; m <= MAX_MULTIPLIER; m++) {
    if (delta % m !== 0) continue;
    const timeBonus = delta / m - ORDER_BASE_POINTS;
    if (timeBonus >= 0 && timeBonus <= MAX_TIME_BONUS) return true;
  }
  return false;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { token, delta } = body as { token: unknown; delta: unknown };

  if (typeof token !== 'string' || !token || typeof delta !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid fields' });
  }

  if (!isValidDelta(delta)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid delta' });
  }

  const ok = await recordGameEvent(token, delta);
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' });
  }

  return { ok: true };
});
