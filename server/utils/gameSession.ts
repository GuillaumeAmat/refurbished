import { useRedis } from './redis';

const SESSION_TTL_S = 900; // 15 min
const sessionKey = (token: string) => `game_session:${token}`;

const ORDER_FIRST_DELAY_MS = 3_000;
const ORDER_SPAWN_MIN_MS = 15_000;
const ORDER_MAX_ACTIVE = 4;

interface GameSession {
  score: number;
  eventCount: number;
  createdAt: number;
}

export async function createGameSession(): Promise<string> {
  const token = crypto.randomUUID();
  const session: GameSession = { score: 0, eventCount: 0, createdAt: Date.now() };
  const redis = useRedis();
  await redis.set(sessionKey(token), session, { ex: SESSION_TTL_S });
  return token;
}

export async function recordGameEvent(token: string, delta: number): Promise<boolean> {
  const redis = useRedis();
  const session = await redis.get<GameSession>(sessionKey(token));
  if (!session) return false;

  const elapsed = Date.now() - session.createdAt;
  const maxEvents =
    Math.floor((elapsed - ORDER_FIRST_DELAY_MS) / ORDER_SPAWN_MIN_MS) + ORDER_MAX_ACTIVE;

  if (session.eventCount + 1 > maxEvents) return false;

  session.score += delta;
  session.eventCount += 1;

  await redis.set(sessionKey(token), session, { ex: SESSION_TTL_S });
  return true;
}

export async function consumeGameSession(token: string): Promise<{ score: number } | null> {
  const redis = useRedis();
  const session = await redis.getdel<GameSession>(sessionKey(token));
  if (!session) return null;
  return { score: session.score };
}
