'use strict';
/*
 * Request handlers. They only use plain Node request/response methods, so the
 * Express server and the no-install demo server share exactly the same code.
 */
const fs = require('node:fs');
const path = require('node:path');
const { HttpError, bad, notFound, send, baseUrl, clientIp } = require('./lib/http');
const { bearer } = require('./lib/auth');
const { clean } = require('./lib/security');
const { parseRange } = require('./lib/files');
const { orderPage, simplePage, renderPage, sitemap, robots } = require('./lib/pages');
const { createAssets } = require('./lib/assets');

function createHandlers(services, config, opts) {
  const publicDir = opts.publicDir;
  const assets = createAssets(publicDir, config.isProd);
  let indexCache = null;

  async function readIndex() {
    if (indexCache && config.isProd) return indexCache;
    try {
      indexCache = await fs.promises.readFile(path.join(publicDir, 'index.html'), 'utf8');
    } catch (e) {
      indexCache = null;
    }
    return indexCache;
  }

  function html(res, status, body, cache) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', cache || 'no-cache');
    res.end(body);
  }

  function streamFile(req, res, info, cache) {
    const etag = '"' + info.id + '"';
    res.setHeader('Content-Type', info.contentType || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', cache);
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304;
      return res.end();
    }
    const size = info.length;
    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') {
      res.statusCode = 416;
      res.setHeader('Content-Range', 'bytes */' + size);
      return res.end();
    }
    let start = 0;
    let end = size - 1;
    if (range) {
      start = range.start;
      end = range.end;
      res.statusCode = 206;
      res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
    } else {
      res.statusCode = 200;
    }
    res.setHeader('Content-Length', size === 0 ? 0 : end - start + 1);
    if (req.method === 'HEAD' || size === 0) return res.end();
    return new Promise((resolve) => {
      const stream = services.openFile(info.id, start, end + 1);
      stream.on('error', (err) => {
        console.error('[file]', info.id, err.message);
        res.destroy(err);
        resolve();
      });
      stream.on('end', resolve);
      res.on('close', () => {
        stream.destroy();
        resolve();
      });
      stream.pipe(res);
    });
  }

  const H = {};

  /* ---------- middleware ---------- */

  H.requireAdmin = function requireAdmin(req, res, next) {
    const token = bearer(req);
    if (!token || !services.checkToken(token)) {
      return send(res, 401, { error: 'auth_required', message: 'Log in as admin to do this.' });
    }
    req.admin = true;
    next();
  };

  /* ---------- public ---------- */

  H.health = async (req, res) => {
    let up = false;
    try { up = await services.ping(); } catch (e) { up = false; }
    send(res, up ? 200 : 503, { ok: up, db: up ? 'up' : 'down', time: new Date().toISOString() });
  };

  H.getStore = async (req, res) => {
    const store = await services.getStore({ admin: false });
    if (!store) throw new HttpError(404, 'not_set_up', 'The store has no data yet. Run "npm run seed".');
    send(res, 200, store);
  };

  H.listProducts = async (req, res) => send(res, 200, await services.listProducts(req.query || {}));
  H.getProduct = async (req, res) => send(res, 200, await services.getProduct(req.params.id));

  H.placeOrder = async (req, res) => {
    let input = req.body || {};
    if (typeof input.order === 'string') {
      try {
        input = JSON.parse(input.order);
      } catch (e) {
        throw bad('bad_json', 'The order data is not valid.');
      }
    }
    const order = await services.placeOrder(clean(input), req.file || null, {
      base: baseUrl(req, config),
      ip: clientIp(req),
      ua: req.headers['user-agent'] || '',
    });
    send(res, 201, order);
  };

  H.getFile = async (req, res) => {
    const info = await services.fileInfo(req.params.id);
    if (!info || info.kind === 'order-card' || info.kind === 'backup') throw notFound('File not found.');
    return streamFile(req, res, info, 'public, max-age=31536000, immutable');
  };

  /* The link sent in WhatsApp. Its og:image makes the order photo show in the chat. */
  H.orderPage = async (req, res) => {
    const order = await services.orderByToken(req.params.token);
    if (!order) return html(res, 404, simplePage('Order not found', 'This order link is not valid.'));
    let brand = 'Rank INC';
    try {
      const store = await services.getStore({ admin: false });
      if (store && store.brand && store.brand.name) brand = store.brand.name;
    } catch (e) { /* keep default */ }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    html(res, 200, orderPage(order, baseUrl(req, config), brand), 'private, max-age=300');
  };

  H.orderCard = async (req, res) => {
    const order = await services.orderByToken(req.params.token);
    if (!order || !order.cardFileId) throw notFound('Order photo not found.');
    const info = await services.fileInfo(order.cardFileId);
    if (!info) throw notFound('Order photo not found.');
    return streamFile(req, res, info, 'private, max-age=86400');
  };

  function pathOf(req) {
    try {
      return new URL(req.originalUrl || req.url || '/', 'http://x').pathname;
    } catch (e) {
      return '/';
    }
  }

  async function publicStore() {
    try {
      return await services.getStore({ admin: false });
    } catch (e) {
      console.error('[page] could not load store:', e.message);
      return null;
    }
  }

  /* Every storefront URL: the same app, with page-specific title, meta tags, JSON-LD and plain-HTML content. */
  H.page = async (req, res) => {
    const template = await readIndex();
    if (!template) return html(res, 404, simplePage('Website missing', 'Put index.html in the public folder.'));
    const store = await publicStore();
    const out = renderPage(template, { store, pathname: pathOf(req), base: baseUrl(req, config), assetV: assets.get().v });
    if (out.route === 'admin' || out.route === 'cart') res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    html(res, out.status, out.html);
  };
  H.index = H.page;

  H.asset = async (req, res) => {
    const bundle = assets.get();
    const file = bundle.files[req.params.file];
    if (!file) throw notFound('No such file.');
    const etag = '"' + bundle.v + '"';
    res.setHeader('Content-Type', file.type);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', req.query && req.query.v === bundle.v ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304;
      return res.end();
    }
    res.statusCode = 200;
    res.setHeader('Content-Length', file.body.length);
    res.end(req.method === 'HEAD' ? undefined : file.body);
  };

  H.sitemap = async (req, res) => {
    const store = await publicStore();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(sitemap(store, baseUrl(req, config)));
  };

  H.robots = async (req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(robots(baseUrl(req, config)));
  };

  /* ---------- admin ---------- */

  H.login = async (req, res) => send(res, 200, await services.login((req.body || {}).password));
  H.me = async (req, res) => send(res, 200, { ok: true, role: 'admin' });
  H.changePassword = async (req, res) => {
    const b = req.body || {};
    send(res, 200, await services.changePassword(b.current, b.next));
  };

  H.adminGetStore = async (req, res) => {
    const store = await services.getStore({ admin: true });
    if (!store) throw new HttpError(404, 'not_set_up', 'The store has no data yet. Run "npm run seed".');
    send(res, 200, store);
  };

  H.publishStore = async (req, res) => {
    const b = req.body || {};
    send(res, 200, await services.publishStore(b.rev, b.data));
  };

  H.adminGetProduct = async (req, res) => send(res, 200, await services.getProduct(req.params.id, { admin: true }));
  H.createProduct = async (req, res) => send(res, 201, await services.upsertProduct(null, req.body || {}));
  H.updateProduct = async (req, res) => send(res, 200, await services.upsertProduct(req.params.id, req.body || {}));
  H.deleteProduct = async (req, res) => send(res, 200, await services.deleteProduct(req.params.id));

  H.listOrders = async (req, res) => send(res, 200, await services.listOrders(req.query || {}));
  H.orderStats = async (req, res) => send(res, 200, await services.orderStats());
  H.updateOrder = async (req, res) => send(res, 200, await services.updateOrder(req.params.ref, req.body || {}));
  H.deleteOrder = async (req, res) => send(res, 200, await services.deleteOrder(req.params.ref));

  H.trackOrder = async (req, res) => send(res, 200, await services.trackOrder((req.query || {}).ref, (req.query || {}).phone));
  H.createEnquiry = async (req, res) => send(res, 201, await services.createEnquiry(clean(req.body || {}), {
    ip: clientIp(req), ua: req.headers['user-agent'] || '',
  }));
  H.listEnquiries = async (req, res) => send(res, 200, await services.listEnquiries(req.query || {}));
  H.updateEnquiry = async (req, res) => send(res, 200, await services.updateEnquiry(req.params.ref, req.body || {}));
  H.deleteEnquiry = async (req, res) => send(res, 200, await services.deleteEnquiry(req.params.ref));
  H.listBackups = async (req, res) => send(res, 200, await services.listBackups());
  H.getBackup = async (req, res) => {
    const info = await services.fileInfo(req.params.id);
    if (!info || info.kind !== 'backup') throw notFound('Backup not found.');
    res.setHeader('Content-Disposition', 'attachment; filename="' + String(info.filename || 'backup.json').replace(/[^\w.-]/g, '_') + '"');
    return streamFile(req, res, info, 'private, no-store');
  };
  H.resetCatalogue = async (req, res) => send(res, 200, await services.resetCatalogue(require(path.join(__dirname, '..', 'scripts', 'seed-data.json'))));
  H.importImages = async (req, res) => send(res, 200, await services.importImages());

  H.uploadFile = async (req, res) => send(res, 201, await services.uploadFile(req.file));
  H.listFiles = async (req, res) => send(res, 200, await services.listFiles());
  H.deleteFile = async (req, res) => send(res, 200, await services.deleteFile(req.params.id));

  return H;
}

module.exports = { createHandlers };
