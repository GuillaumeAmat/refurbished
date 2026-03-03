import { defineEventHandler } from 'h3';

import { createGameSession } from '../../utils/gameSession';

export default defineEventHandler(async () => {
  const token = await createGameSession();
  return { token };
});
