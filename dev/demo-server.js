'use strict';
/*
 * Try the whole store without MongoDB and without "npm install":
 *     node dev/demo-server.js        (or: npm run demo)
 * It uses the same handlers as the real server, but keeps data in memory,
 * so everything resets when you stop it. Use "npm start" for the real thing.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const { createServices } = require('../src/services');
const { createHandlers } = require('../src/handlers');
const { ROUTES, UPLOAD_LIMITS } = require('../src/routes');
const { securityHeaders, cors, clean, notFoundApi } = require('../src/lib/security');
const { rateLimit } = require('../src/lib/limits');
const { send, handleError, wrap } = require('../src/lib/http');
const { createMemoryRepo } = require('./memory-repo');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.webm': 'video/webm', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return { fields: {}, files: [] };
  const boundary = Buffer.from('--' + (m[1] || m[2]).trim());
  const fields = {};
  const files = [];
  let pos = buf.indexOf(boundary);
  while (pos >= 0) {
    pos += boundary.length;
    if (buf[pos] === 0x2d && buf[pos + 1] === 0x2d) break;
    pos += 2;
    const headEnd = buf.indexOf('\r\n\r\n', pos);
    if (headEnd < 0) break;
    const head = buf.toString('utf8', pos, headEnd);
    const next = buf.indexOf(boundary, headEnd + 4);
    if (next < 0) break;
    const body = buf.subarray(headEnd + 4, next - 2);
    const name = /;\s*name="([^"]*)"/i.exec(head);
    const filename = /;\s*filename="([^"]*)"/i.exec(head);
    const type = /content-type:\s*([^\r\n]+)/i.exec(head);
    if (name) {
      if (filename) {
        files.push({ fieldname: name[1], originalname: filename[1], mimetype: type ? type[1].trim() : 'application/octet-stream', buffer: Buffer.from(body), size: body.length });
      } else {
        fields[name[1]] = body.toString('utf8');
      }
    }
    pos = next;
  }
  return { fields, files };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('too large'), { type: 'entity.too.large' }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function compile(pattern) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/[.]/g, '\\.').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { rx, keys };
}

function createDemoServer(opts) {
  opts = opts || {};
  const config = loadConfig(Object.assign({ JWT_SECRET: 'demo-secret-demo-secret-1234', PORT: '5050' }, process.env, opts.env || {}));
  const repo = createMemoryRepo();
  const services = createServices(repo, config);
  const publicDir = opts.publicDir || path.join(__dirname, '..', 'public');
  const H = createHandlers(services, config, { publicDir });

  const uploadMiddleware = (name) => (req, res, next) => {
    const spec = UPLOAD_LIMITS[name];
    const file = (req.files || []).find((f) => f.fieldname === spec.field) || null;
    if (file && file.size > spec.maxBytes) return send(res, 413, { error: 'too_large', message: 'That upload is too big.' });
    req.file = file;
    next();
  };
  const middleware = {
    admin: H.requireAdmin,
    limitLogin: rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login tries. Wait 15 minutes and try again.' }),
    limitTrack: rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Too many tries. Wait a few minutes and try again.' }),
    limitOrders: rateLimit({ windowMs: 10 * 60 * 1000, max: opts.orderLimit || 20, message: 'Too many orders from this network. Try again in a few minutes.' }),
    uploadFile: uploadMiddleware('uploadFile'),
    uploadCard: uploadMiddleware('uploadCard'),
  };
  const table = ROUTES.map(([method, pattern, name, names]) => {
    if (!H[name]) throw new Error('Missing handler ' + name);
    return Object.assign({ method, name, chain: names.map((n) => middleware[n]) }, compile(pattern));
  });
  const before = [securityHeaders(config), cors(config)];

  async function serveStatic(req, res, pathname) {
    let file;
    try {
      file = path.resolve(publicDir, '.' + decodeURIComponent(pathname));
    } catch (e) {
      return false;
    }
    if (file !== publicDir && !file.startsWith(publicDir + path.sep)) return false;
    let stat;
    try { stat = await fs.promises.stat(file); } catch (e) { return false; }
    if (!stat.isFile()) return false;
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(file).pipe(res);
    return true;
  }

  function run(chain, req, res, done) {
    let i = 0;
    const next = (err) => {
      if (err) return handleError(err, req, res);
      const fn = chain[i++];
      if (!fn) return done();
      try { fn(req, res, next); } catch (e) { handleError(e, req, res); }
    };
    next();
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      req.query = Object.fromEntries(url.searchParams);
      const method = req.method === 'HEAD' ? 'GET' : req.method;
      run(before, req, res, () => handleRoute().catch((err) => handleError(err, req, res)));
      async function handleRoute() {
        const route = table.find((r) => r.method === method && r.rx.test(url.pathname));
        if (!route) {
          if ((req.method === 'GET' || req.method === 'HEAD') && await serveStatic(req, res, url.pathname)) return;
          if (url.pathname.startsWith('/api/')) return notFoundApi(req, res);
          if (method === 'GET' && !/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return wrap(H.page)(req, res);
          res.statusCode = 404;
          return res.end('Not found');
        }
        const match = route.rx.exec(url.pathname);
        req.params = {};
        route.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(match[i + 1]); });
        req.body = {};
        req.files = [];
        if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
          const buf = await readBody(req, 45 * 1024 * 1024);
          const type = String(req.headers['content-type'] || '');
          if (type.includes('multipart/form-data')) {
            const parsed = parseMultipart(buf, type);
            req.body = parsed.fields;
            req.files = parsed.files;
          } else if (buf.length) {
            try { req.body = clean(JSON.parse(buf.toString('utf8'))); } catch (e) { throw Object.assign(new Error('bad json'), { type: 'entity.parse.failed' }); }
          }
        }
        run(route.chain, req, res, () => wrap(H[route.name])(req, res));
      }
    } catch (err) {
      handleError(err, req, res);
    }
  });

  return {
    server,
    services,
    repo,
    config,
    async start(port) {
      await services.ensureAdmin();
      const seedData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seed-data.json'), 'utf8'));
      if (!(await services.seed(seedData))) await services.upgrade(seedData);
      await new Promise((resolve) => server.listen(port == null ? config.port : port, resolve));
      return server.address().port;
    },
    stop() { return new Promise((resolve) => server.close(() => resolve())); },
  };
}

if (require.main === module) {
  const demo = createDemoServer();
  demo.start().then((port) => {
    console.log('[demo] no-database demo running at http://localhost:' + port);
    console.log('[demo] admin: http://localhost:' + port + '/admin   password: ' + demo.config.adminPassword);
    console.log('[demo] data is kept in memory and resets when you stop this. Use "npm start" with MongoDB for real data.');
  });
}

module.exports = { createDemoServer, parseMultipart };
