'use strict';
/* Security headers, CORS and request-body cleaning. */
const { send } = require('./http');

function securityHeaders(config) {
  const connect = ["'self'"].concat(config.corsOrigins.filter((o) => o !== '*')).join(' ');
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    'connect-src ' + connect,
    "frame-ancestors 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return function headers(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Security-Policy', csp);
    if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    next();
  };
}

/* Allows a website hosted somewhere else (e.g. Netlify) to call this API. */
function cors(config) {
  const allowAll = config.corsOrigins.includes('*');
  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    if (origin && (allowAll || config.corsOrigins.includes(origin.replace(/\/+$/, '')))) {
      res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    next();
  };
}

/* Removes keys that MongoDB could treat as operators ($gt, a.b) from user input. */
function clean(value, depth) {
  depth = depth || 0;
  if (depth > 12) return undefined;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      out[key] = clean(value[key], depth + 1);
    }
    return out;
  }
  return value;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
}

function notFoundApi(req, res) {
  send(res, 404, { error: 'not_found', message: 'No such API route.' });
}

module.exports = { securityHeaders, cors, clean, sanitizeBody, notFoundApi };
