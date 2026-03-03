import { createError, defineEventHandler, readBody } from 'h3';

import { recordGameEvent } from '../../utils/gameSession';

const VALID_DELTAS = new Set([-10, 20, 24, 28, 40, 48, 56, 60, 72, 84, 80, 96, 112]);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { token, delta } = body as { token: unknown; delta: unknown };

  if (typeof token !== 'string' || !token || typeof delta !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid fields' });
  }

  if (!VALID_DELTAS.has(delta)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid delta' });
  }

  const ok = await recordGameEvent(token, delta);
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' });
  }

  return { ok: true };
});
