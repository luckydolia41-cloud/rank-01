'use strict';
/* Simple in-memory rate limiter (per IP), enough for a single server. */
const { send, clientIp } = require('./http');

function rateLimit(opts) {
  const windowMs = opts.windowMs;
  const max = opts.max;
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, Math.min(windowMs, 60000));
  if (timer.unref) timer.unref();

  return function limiter(req, res, next) {
    const key = clientIp(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return send(res, 429, { error: 'too_many_requests', message: opts.message || 'Too many requests. Try again later.' });
    }
    next();
  };
}

module.exports = { rateLimit };
