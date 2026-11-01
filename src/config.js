'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');

/* Reads KEY=value lines from a .env file without overriding variables already set. */
function loadEnvFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return false;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    process.env[m[1]] = value;
  }
  return true;
}

function loadConfig(env) {
  env = env || process.env;
  const secret = env.JWT_SECRET || '';
  const generated = secret.length < 16;
  return {
    port: Number(env.PORT) || 5000,
    mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rank_store',
    dbName: String(env.DB_NAME || 'rank_store').replace(/[^\w-]/g, '').slice(0, 60) || 'rank_store',
    jwtSecret: generated ? crypto.randomBytes(32).toString('hex') : secret,
    jwtSecretGenerated: generated,
    adminPassword: env.ADMIN_PASSWORD || 'rankinc@admin',
    adminPasswordDefault: !env.ADMIN_PASSWORD,
    publicUrl: String(env.PUBLIC_URL || '').trim().replace(/\/+$/, ''),
    corsOrigins: String(env.CORS_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean),
    tokenHours: Math.min(720, Math.max(1, Number(env.TOKEN_HOURS) || 12)),
    trustProxy: env.TRUST_PROXY !== 'false',
    isProd: env.NODE_ENV === 'production',
  };
}

function redactUri(uri) {
  return String(uri).replace(/\/\/([^@/]+)@/, '//***:***@');
}

module.exports = { loadEnvFile, loadConfig, redactUri };
