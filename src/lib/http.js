'use strict';
/* Small HTTP helpers that work with both Express and plain Node http. */

class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}

const bad = (code, message, extra) => new HttpError(400, code, message, extra);
const notFound = (message) => new HttpError(404, 'not_found', message || 'Not found.');

function send(res, status, body) {
  if (res.headersSent || res.writableEnded) return;
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', Buffer.byteLength(json));
  res.end(json);
}

function errorBody(err) {
  if (err instanceof HttpError) {
    return [err.status, Object.assign({ error: err.code, message: err.message }, err.extra || {})];
  }
  if (err && (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE')) {
    return [413, { error: 'too_large', message: 'That upload is too big.' }];
  }
  if (err && err.type === 'entity.parse.failed') {
    return [400, { error: 'bad_json', message: 'The request body is not valid JSON.' }];
  }
  if (err && err.name === 'MulterError') {
    return [400, { error: 'bad_upload', message: err.message }];
  }
  return null;
}

function handleError(err, req, res) {
  const known = errorBody(err);
  if (known) return send(res, known[0], known[1]);
  console.error('[error]', req && req.method, req && (req.originalUrl || req.url), err);
  if (res.headersSent) { try { res.destroy(); } catch (e) { /* ignore */ } return; }
  send(res, 500, { error: 'server_error', message: 'Something went wrong on the server. Try again.' });
}

/* Turn an async (req, res) handler into middleware whose errors become JSON responses. */
function wrap(fn) {
  return function wrapped(req, res) {
    Promise.resolve().then(() => fn(req, res)).catch((err) => handleError(err, req, res));
  };
}

const HOST_RX = /^[a-z0-9.\-:[\]]+$/i;

/* The public base URL of this server, used for links that leave the site (WhatsApp previews). */
function baseUrl(req, config) {
  if (config.publicUrl) return config.publicUrl;
  const h = req.headers || {};
  const fwdProto = config.trustProxy && h['x-forwarded-proto'] ? String(h['x-forwarded-proto']).split(',')[0].trim() : '';
  const fwdHost = config.trustProxy && h['x-forwarded-host'] ? String(h['x-forwarded-host']).split(',')[0].trim() : '';
  const proto = fwdProto === 'https' || fwdProto === 'http' ? fwdProto : (req.socket && req.socket.encrypted ? 'https' : 'http');
  let host = fwdHost || h.host || 'localhost';
  if (!HOST_RX.test(host)) host = 'localhost';
  return proto + '://' + host;
}

function clientIp(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { HttpError, bad, notFound, send, handleError, wrap, baseUrl, clientIp };
