import { createError, defineEventHandler, readBody } from 'h3';

import { consumeGameSession } from '../utils/gameSession';
import { useRedis } from '../utils/redis';

const LEADERBOARD_KEY = 'leaderboard';
const scoreKey = (id: string) => `score:${id}`;

const STAR_THRESHOLDS = [80, 200, 400];
const PLAYER_NAME_RE = /^[A-Z0-9_]{1,12}$/;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { token, player1, player2 } = body as {
    token: string;
    player1: string;
    player2: string;
  };

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' });
  }

  const session = await consumeGameSession(token);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' });
  }

  if (!PLAYER_NAME_RE.test(player1) || !PLAYER_NAME_RE.test(player2)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid player names' });
  }

  const { score } = session;
  const stars = STAR_THRESHOLDS.filter((t) => score >= t).length;

  const redis = useRedis();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await Promise.all([
    redis.hset(scoreKey(id), {
      player1: JSON.stringify(player1),
      player2: JSON.stringify(player2),
      score,
      stars,
      date: new Date().toISOString(),
    }),
    redis.zadd(LEADERBOARD_KEY, { score, member: id }),
  ]);

  const rank = await redis.zrevrank(LEADERBOARD_KEY, id);

  return { id, rank: rank !== null ? rank + 1 : null };
});
