import { createError, defineEventHandler, readBody } from 'h3';

import { useRedis } from '../utils/redis';

const LEADERBOARD_KEY = 'leaderboard';
const scoreKey = (id: string) => `score:${id}`;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { player1, player2, score, stars } = body as {
    player1: string;
    player2: string;
    score: number;
    stars: number;
  };

  if (!player1 || !player2 || typeof score !== 'number' || typeof stars !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid fields' });
  }

  const redis = useRedis();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await Promise.all([
    redis.hset(scoreKey(id), {
      player1,
      player2,
      score,
      stars,
      date: new Date().toISOString(),
    }),
    redis.zadd(LEADERBOARD_KEY, { score, member: id }),
  ]);

  const rank = await redis.zrevrank(LEADERBOARD_KEY, id);

  return { id, rank: rank !== null ? rank + 1 : null };
});
