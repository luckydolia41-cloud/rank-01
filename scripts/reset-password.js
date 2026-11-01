'use strict';
/*
 * Forgot the admin password? Set a new one directly in the database:
 *   npm run reset-password -- "my-new-password"
 */
const path = require('node:path');
const { loadEnvFile, loadConfig } = require('../src/config');

loadEnvFile(path.join(__dirname, '..', '.env'));

const db = require('../src/db');
const { createMongoRepo } = require('../src/repo/mongo');
const { createServices } = require('../src/services');

(async () => {
  const next = process.argv[2];
  if (!next || next.length < 8) {
    console.error('Usage: npm run reset-password -- "new-password"   (at least 8 characters)');
    process.exit(1);
  }
  const config = loadConfig();
  await db.connect(config.mongoUri, config.dbName);
  const services = createServices(createMongoRepo(), config);
  await services.ensureAdmin();
  await services.resetPassword(next);
  console.log('[admin] password changed. All admin sessions are logged out.');
  await db.disconnect();
})().catch(async (err) => {
  console.error('[admin] failed: ' + err.message);
  await db.disconnect().catch(() => {});
  process.exit(1);
});
