import { defineEventHandler, getQuery } from 'h3';

import { useRedis } from '../utils/redis';

const LEADERBOARD_KEY = 'leaderboard';
const scoreKey = (id: string) => `score:${id}`;

export default defineEventHandler(async (event) => {
  const { limit = '10' } = getQuery(event) as { limit?: string };
  const max = Math.min(Number(limit) || 10, 50);

  const redis = useRedis();

  // ZRANGE WITHSCORES returns a flat alternating array: [member, score, member, score, ...]
  const flat = await redis.zrange<(string | number)[]>(
    LEADERBOARD_KEY, 0, max - 1, { rev: true, withScores: true }
  );

  if (!flat.length) return [];

  const entries: { member: string; score: number }[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    entries.push({ member: flat[i] as string, score: Number(flat[i + 1]) });
  }

  const pipeline = redis.pipeline();
  for (const { member } of entries) {
    pipeline.hgetall(scoreKey(member));
  }
  const records = await pipeline.exec();

  return entries.map(({ member, score }, i) => {
    const record = records[i] as { player1: string; player2: string; stars: string; date: string } | null;
    if (!record) return null;
    return {
      id: member,
      player1: record.player1,
      player2: record.player2,
      score,
      stars: Number(record.stars),
      date: record.date,
      rank: i + 1,
    };
  }).filter(Boolean);
});
