'use strict';
/* The Express web server: security, routes, uploads and the website files. */
const express = require('express');
const compression = require('compression');
const multer = require('multer');
const { ROUTES, UPLOAD_LIMITS } = require('./routes');
const { createHandlers } = require('./handlers');
const { securityHeaders, cors, sanitizeBody, notFoundApi } = require('./lib/security');
const { rateLimit } = require('./lib/limits');
const { wrap, handleError } = require('./lib/http');

function createApp({ services, config, publicDir }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(compression());
  app.use(securityHeaders(config));
  app.use(cors(config));
  app.use(express.json({ limit: '12mb' }));
  app.use(sanitizeBody);

  const H = createHandlers(services, config, { publicDir });
  const memory = multer.memoryStorage();
  const upload = (name) => multer({
    storage: memory,
    limits: { fileSize: UPLOAD_LIMITS[name].maxBytes, files: 1, fields: 10, fieldSize: 256 * 1024 },
  }).single(UPLOAD_LIMITS[name].field);

  const middleware = {
    admin: H.requireAdmin,
    limitLogin: rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login tries. Wait 15 minutes and try again.' }),
    limitTrack: rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Too many tries. Wait a few minutes and try again.' }),
    limitOrders: rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many orders from this network. Try again in a few minutes.' }),
    uploadFile: upload('uploadFile'),
    uploadCard: upload('uploadCard'),
  };

  for (const [method, path, name, names] of ROUTES) {
    const handler = H[name];
    if (!handler) throw new Error('Route ' + method + ' ' + path + ' has no handler "' + name + '"');
    const chain = names.map((m) => {
      if (!middleware[m]) throw new Error('Route ' + method + ' ' + path + ' uses unknown middleware "' + m + '"');
      return middleware[m];
    });
    app[method.toLowerCase()](path, ...chain, wrap(handler));
  }

  app.use(express.static(publicDir, { index: false, maxAge: '7d' }));
  app.use('/api', notFoundApi);
  /* Any other page address shows the site's own "page not found" view (status 404). */
  app.use((req, res) => {
    if (req.method === 'GET' && !/\.[a-z0-9]{2,5}$/i.test(req.path)) return wrap(H.page)(req, res);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => handleError(err, req, res));
  return app;
}

module.exports = { createApp };
