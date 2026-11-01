'use strict';
/*
 * Password hashing (scrypt) and login tokens (HS256 JWT) using only Node's
 * built-in crypto module, so there is nothing extra to install.
 */
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const KEYLEN = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password), salt, KEYLEN, PARAMS);
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (!salt.length || expected.length !== KEYLEN) return false;
  const key = await scrypt(String(password), salt, KEYLEN, PARAMS);
  return crypto.timingSafeEqual(key, expected);
}

const b64url = (value) => Buffer.from(value).toString('base64url');

function signToken(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, { iat: now, exp: now + ttlSeconds });
  const data = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifyToken(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let head;
  let body;
  try {
    head = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    body = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!head || head.alg !== 'HS256') return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0] + '.' + parts[1]).digest();
  const got = Buffer.from(parts[2], 'base64url');
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
  if (!body || typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}

function bearer(req) {
  const h = req.headers && req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, bearer };
