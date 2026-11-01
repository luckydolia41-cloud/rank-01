'use strict';
/* Starts the store: connects to MongoDB, prepares the admin login, then serves the website and API. */
const path = require('node:path');
const { loadEnvFile, loadConfig, redactUri } = require('./config');

loadEnvFile(path.join(__dirname, '..', '.env'));

const db = require('./db');
const { createMongoRepo } = require('./repo/mongo');
const { createServices } = require('./services');
const { createApp } = require('./app');

const HINTS = [
  [/ECONNREFUSED/i, 'MongoDB is not running at that address. Start MongoDB, or use a MongoDB Atlas link in MONGODB_URI.'],
  [/querySrv|ENOTFOUND|EAI_AGAIN/i, 'The MongoDB address could not be found. Check MONGODB_URI and your internet connection.'],
  [/bad auth|Authentication failed/i, 'MongoDB rejected the username or password in MONGODB_URI. Check the database user in Atlas.'],
  [/Server selection timed out|whitelist|IP.*not allowed/i, 'MongoDB did not answer in time. In Atlas, open Network Access and allow your IP (or 0.0.0.0/0 for hosting).'],
];

async function main() {
  const config = loadConfig();
  if (config.jwtSecretGenerated) {
    console.warn('[warn] JWT_SECRET is missing or shorter than 16 characters. Using a temporary one, so admins are logged out on every restart.');
  }
  console.log('[db] connecting to ' + redactUri(config.mongoUri) + ' (database "' + config.dbName + '")');
  await db.connect(config.mongoUri, config.dbName);
  console.log('[db] connected');

  const repo = createMongoRepo();
  await repo.init();
  const services = createServices(repo, config);

  const admin = await services.ensureAdmin();
  if (admin.created) {
    console.log('[admin] admin login created from ' + (config.adminPasswordDefault ? 'the default password "rankinc@admin"' : 'ADMIN_PASSWORD') +
      '. Change it from Admin > Settings > Admin password.');
  }

  const seedData = require('../scripts/seed-data.json');
  if (await services.seed(seedData)) {
    console.log('[db] empty database: loaded the Rank INC catalogue');
  } else {
    const up = await services.upgrade(seedData);
    if (up.action === 'replaced') {
      console.log('[db] this database held another store\'s products and settings. Saved a backup (' + up.backup.name +
        ') and loaded the Rank INC catalogue. Orders, enquiries and the admin password were kept.');
    } else if (up.action === 'filled') {
      console.log('[db] updated the store with new sections: ' + up.filled.join(', '));
    }
  }

  const app = createApp({ services, config, publicDir: path.join(__dirname, '..', 'public') });
  const server = app.listen(config.port, () => {
    console.log('[ready] store running at http://localhost:' + config.port + '  (admin: http://localhost:' + config.port + '/admin)');
  });

  const stop = (signal) => {
    console.log('[stop] ' + signal);
    server.close(() => db.disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('[fatal] ' + (err && err.message));
  const hint = HINTS.find(([rx]) => rx.test(String(err && err.message)));
  if (hint) console.error('[hint] ' + hint[1]);
  process.exit(1);
});
