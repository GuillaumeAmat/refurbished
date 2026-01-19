import { defineEventHandler } from 'h3';

// Avoids Vue Router warnings about missing source maps in development (mostly caused by dev tools)
export default defineEventHandler((event) => {
  const url = event.node.req.url || '';

  if (url.endsWith('.map')) {
    event.node.res.statusCode = 204;
    event.node.res.end();
    return;
  }
});
