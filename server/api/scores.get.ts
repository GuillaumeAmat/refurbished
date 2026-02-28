import { defineEventHandler, getQuery } from 'h3';

import { useRedis } from '../utils/redis';

const LEADERBOARD_KEY = 'leaderboard';
const scoreKey = (id: string) => `score:${id}`;

export default defineEventHandler(async (event) => {
  const { limit = '10' } = getQuery(event) as { limit?: string };
  const max = Math.min(Number(limit) || 10, 50);

  const redis = useRedis();

  const ids = await redis.zrange<string[]>(LEADERBOARD_KEY, 0, max - 1, { rev: true });

  if (!ids.length) return [];

  const pipeline = redis.pipeline();
  for (const id of ids) {
    pipeline.hgetall(scoreKey(id));
  }
  const records = await pipeline.exec();

  return ids.map((id, i) => {
    const record = records[i] as { player1: string; player2: string; score: string; stars: string; date: string } | null;
    if (!record) return null;
    return {
      id,
      player1: record.player1,
      player2: record.player2,
      score: Number(record.score),
      stars: Number(record.stars),
      date: record.date,
      rank: i + 1,
    };
  }).filter(Boolean);
});
