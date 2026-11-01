'use strict';
/*
 * Loads the Rank INC catalogue into MongoDB.
 *   npm run seed         only if the database is empty
 *   npm run seed:force   replaces the current products and settings (orders are kept)
 */
const path = require('node:path');
const { loadEnvFile, loadConfig, redactUri } = require('../src/config');

loadEnvFile(path.join(__dirname, '..', '.env'));

const db = require('../src/db');
const { createMongoRepo } = require('../src/repo/mongo');
const { createServices } = require('../src/services');

(async () => {
  const config = loadConfig();
  const force = process.argv.includes('--force');
  console.log('[seed] connecting to ' + redactUri(config.mongoUri));
  await db.connect(config.mongoUri, config.dbName);
  const repo = createMongoRepo();
  await repo.init();
  const services = createServices(repo, config);
  await services.ensureAdmin();
  const data = require('./seed-data.json');
  const done = await services.seed(data, { force });
  console.log(done
    ? '[seed] loaded ' + data.products.length + ' products and the store settings'
    : '[seed] the database already has a store. Run "npm run seed:force" to replace it.');
  await db.disconnect();
})().catch(async (err) => {
  console.error('[seed] failed: ' + err.message);
  await db.disconnect().catch(() => {});
  process.exit(1);
});
