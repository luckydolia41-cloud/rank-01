'use strict';
/*
 * All the store's business logic. It talks to the database only through `repo`,
 * so the same code runs on MongoDB (src/repo/mongo.js) and on the in-memory
 * demo (dev/memory-repo.js).
 */
const crypto = require('node:crypto');
const { HttpError, bad, notFound } = require('./lib/http');
const { normalizeStoreData, normalizeProduct, str, num } = require('./lib/normalize');
const { STATUSES, STOCK_HELD, ENQUIRY_STATUSES, validateCustomer, validateEnquiry, priceItems, cleanPayment, cleanRef, makeRef } = require('./lib/order');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./lib/auth');
const { sniff, LIMITS } = require('./lib/files');

const FILE_ID = /^[a-f0-9]{24}$/;
const TOKEN = /^[a-f0-9]{32}$/;

function createServices(repo, config) {
  let adminVersion = null;
  const S = {};

  S.ping = () => repo.ping();

  /* ---------- store ---------- */

  S.getStore = async function getStore(opts) {
    const s = await repo.getSettings();
    if (!s) return null;
    let products = await repo.listProducts();
    if (!(opts && opts.admin)) products = products.filter((p) => !p.hidden);
    return {
      rev: s.rev || 0,
      updated: s.updated || '',
      brand: s.brand || {},
      store: s.store || {},
      home: s.home || {},
      about: s.about || {},
      cats: s.cats || [],
      legal: s.legal || {},
      depts: s.depts || [],
      kits: s.kits || [],
      faq: s.faq || [],
      products,
    };
  };

  /* Saves everything the admin edited. `rev` stops two people overwriting each other. */
  S.publishStore = async function publishStore(rev, data) {
    if (!data || typeof data !== 'object') throw bad('no_data', 'Nothing to publish.');
    const cur = await repo.getSettings();
    if (cur && Number(rev) !== cur.rev) {
      throw new HttpError(409, 'conflict', 'The store changed since you loaded it. Reload to get the latest version.', { rev: cur.rev });
    }
    const clean = normalizeStoreData(data);
    await repo.replaceProducts(clean.products);
    const next = {
      brand: clean.brand, store: clean.store, home: clean.home, about: clean.about, cats: clean.cats, legal: clean.legal, depts: clean.depts, kits: clean.kits, faq: clean.faq,
      rev: (cur ? cur.rev : 0) + 1, updated: new Date().toISOString(),
    };
    const saved = cur ? await repo.updateSettings(cur.rev, next) : await repo.createSettings(next);
    if (!saved) throw new HttpError(409, 'conflict', 'The store changed while publishing. Reload and try again.');
    return S.getStore({ admin: true });
  };

  S.seed = async function seed(data, opts) {
    const force = !!(opts && opts.force);
    const cur = await repo.getSettings();
    if (cur && !force) return false;
    const clean = normalizeStoreData(data);
    await repo.replaceProducts(clean.products);
    const next = {
      brand: clean.brand, store: clean.store, home: clean.home, about: clean.about, cats: clean.cats, legal: clean.legal, depts: clean.depts, kits: clean.kits, faq: clean.faq,
      rev: (cur ? cur.rev : 0) + 1, updated: new Date().toISOString(),
    };
    if (cur) await repo.updateSettings(cur.rev, next);
    else await repo.createSettings(next);
    return true;
  };

  async function backupCurrent(reason) {
    const cur = await repo.getSettings();
    if (!cur) return null;
    const products = await repo.listProducts();
    const name = 'backup-' + reason + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    const f = await repo.saveFile(Buffer.from(JSON.stringify({ settings: cur, products }, null, 1)), { filename: name, contentType: 'application/json', kind: 'backup' });
    return { id: f.id, name };
  }

  /*
   * Brings a database written by an older version of the store up to date when the server starts.
   *  - Settings with no product categories come from a different store (for example the LOWKEY CO. template):
   *    they are backed up to the database, then replaced by the Rank INC catalogue. Orders, enquiries,
   *    the admin password and uploaded files are kept.
   *  - Sections added in later versions (departments, kits, banner slides, policies) are filled in from
   *    the catalogue only when they are missing, so nothing the admin edited is overwritten.
   */
  S.upgrade = async function upgrade(data) {
    const cur = await repo.getSettings();
    if (!cur) return { action: 'none' };
    if (!Array.isArray(cur.cats) || !cur.cats.length) {
      const backup = await backupCurrent('before-rank-catalogue');
      await S.seed(data, { force: true });
      return { action: 'replaced', backup };
    }
    const clean = normalizeStoreData(data);
    const next = {};
    for (const key of ['depts', 'kits', 'legal']) if (cur[key] === undefined) next[key] = clean[key];
    const home = cur.home || {};
    const addHome = {};
    for (const key of ['slides', 'clients', 'seoTitle', 'seoBody', 'customTitle', 'customSub']) if (home[key] === undefined && clean.home[key] !== undefined) addHome[key] = clean.home[key];
    if (Object.keys(addHome).length) next.home = Object.assign({}, home, addHome);
    let filled = Object.keys(next);
    if ((await repo.listProducts()).length === 0) { await repo.replaceProducts(clean.products); filled = filled.concat('products'); }
    if (!Object.keys(next).length) return { action: filled.length ? 'filled' : 'none', filled };
    next.rev = cur.rev + 1;
    next.updated = new Date().toISOString();
    await repo.updateSettings(cur.rev, next);
    return { action: 'filled', filled };
  };

  /* Admin button: replace products and website settings with the Rank INC catalogue (orders are kept). */
  S.resetCatalogue = async function resetCatalogue(data) {
    const backup = await backupCurrent('before-reset');
    await S.seed(data, { force: true });
    return Object.assign(await S.getStore({ admin: true }), { backup });
  };

  /* ---------- products ---------- */

  S.listProducts = async function listProducts(query) {
    let list = (await repo.listProducts()).filter((p) => !p.hidden);
    if (query && query.cat) list = list.filter((p) => p.cat === String(query.cat));
    return list;
  };

  S.getProduct = async function getProduct(id, opts) {
    const [p] = await repo.getProducts([String(id)]);
    if (!p || (p.hidden && !(opts && opts.admin))) throw notFound('Product not found.');
    return p;
  };

  S.upsertProduct = async function upsertProduct(id, body) {
    const input = Object.assign({}, body || {});
    if (id) input.id = String(id);
    const p = normalizeProduct(input);
    if (id && p.id !== String(id)) throw bad('bad_id', 'Product ids use letters, numbers, - and _ (2 to 40 characters).');
    await repo.upsertProduct(p);
    await repo.bumpRev();
    return p;
  };

  S.deleteProduct = async function deleteProduct(id) {
    const ok = await repo.deleteProduct(String(id));
    if (!ok) throw notFound('Product not found.');
    await repo.bumpRev();
    return { ok: true };
  };

  /* ---------- orders ---------- */

  function publicOrder(o, base) {
    return {
      ref: o.ref,
      token: o.token,
      status: o.status,
      items: o.items.map((it) => ({
        id: it.id, code: it.code, name: it.name, color: it.color, size: it.size, qty: it.qty, emb: it.emb || '', unit: it.unit, price: it.price, lineTotal: it.lineTotal,
      })),
      subtotal: o.subtotal,
      discount: o.discount,
      coupon: o.coupon,
      gst: o.gst || 0,
      gstPct: o.gstPct || 0,
      shipping: o.shipping,
      total: o.total,
      quote: !!o.quote,
      payment: o.payment,
      pageUrl: base + '/o/' + o.token,
      cardUrl: o.cardFileId ? base + '/o/' + o.token + '/card.jpg' : '',
      createdAt: o.createdAt,
    };
  }

  function adminOrder(o) {
    if (!o) return null;
    return Object.assign({}, o, {
      pageUrl: '/o/' + o.token,
      cardUrl: o.cardFileId ? '/o/' + o.token + '/card.jpg' : '',
    });
  }

  S.placeOrder = async function placeOrder(input, card, meta) {
    input = input && typeof input === 'object' ? input : {};
    meta = meta || {};
    const settings = await repo.getSettings();
    if (!settings) throw new HttpError(503, 'not_ready', 'The store is not set up yet.');
    const rawItems = Array.isArray(input.items) ? input.items.slice(0, 40) : [];
    if (!rawItems.length) throw bad('no_items', 'Choose a product first.');
    const ids = [...new Set(rawItems.map((i) => String((i && i.id) || '')))];
    const products = await repo.getProducts(ids);
    const priced = priceItems(rawItems, new Map(products.map((p) => [p.id, p])), settings, input.coupon);
    const customer = validateCustomer(input.customer);
    const brandName = settings.brand && settings.brand.name;

    let ref = cleanRef(input.ref) || makeRef(brandName);
    const existing = await repo.getOrder(ref);
    if (existing) {
      /* The same customer tapping twice gets the same order back instead of a duplicate. */
      const recent = Date.now() - new Date(existing.createdAt).getTime() < 15 * 60 * 1000;
      if (existing.customer.phone === customer.phone && recent) return publicOrder(existing, meta.base || '');
      ref = makeRef(brandName);
    }

    let cardFileId = '';
    if (card && Buffer.isBuffer(card.buffer) && card.buffer.length) {
      const type = sniff(card.buffer);
      if ((type === 'image/jpeg' || type === 'image/png') && card.buffer.length <= 3 * 1024 * 1024) {
        const f = await repo.saveFile(card.buffer, { filename: ref + (type === 'image/png' ? '.png' : '.jpg'), contentType: type, kind: 'order-card' });
        cardFileId = f.id;
      }
    }

    const now = new Date();
    const order = {
      ref,
      token: crypto.randomBytes(16).toString('hex'),
      items: priced.items,
      subtotal: priced.subtotal,
      discount: priced.discount,
      coupon: priced.coupon,
      gst: priced.gst,
      gstPct: priced.gstPct,
      shipping: priced.shipping,
      total: priced.total,
      quote: priced.quote,
      customer,
      payment: cleanPayment(input.payment, settings),
      note: str(input.note, 600),
      status: 'new',
      history: [{ status: 'new', at: now, note: '' }],
      cardFileId,
      stockApplied: false,
      ip: str(meta.ip, 64),
      ua: str(meta.ua, 200),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await repo.createOrder(order);
    } catch (e) {
      if (!e || e.code !== 'duplicate') throw e;
      order.ref = makeRef(brandName);
      await repo.createOrder(order);
    }
    return publicOrder(order, meta.base || '');
  };

  S.listOrders = async function listOrders(query) {
    query = query || {};
    const status = STATUSES.includes(query.status) ? query.status : '';
    const limit = num(query.limit, 1, 100, 20);
    const page = num(query.page, 1, 100000, 1);
    const r = await repo.listOrders({ status, q: str(query.q, 60), skip: (page - 1) * limit, limit });
    return { items: r.items.map(adminOrder), total: r.total, page, pages: Math.max(1, Math.ceil(r.total / limit)) };
  };

  S.orderStats = () => repo.orderStats();

  /* Changing status moves stock: confirming takes items out, cancelling puts them back. */
  S.updateOrder = async function updateOrder(ref, body) {
    const o = await repo.getOrder(cleanRef(ref));
    if (!o) throw notFound('Order not found.');
    const status = body && body.status;
    if (!STATUSES.includes(status)) throw bad('bad_status', 'Unknown order status.');
    const note = str(body.note, 300);
    let stockApplied = !!o.stockApplied;
    let stockChanged = false;
    const hold = STOCK_HELD.includes(status);
    const tracked = o.items.filter((it) => it.track);
    if (hold && !stockApplied) {
      const done = [];
      for (const it of tracked) {
        const ok = await repo.adjustStock(it.id, it.size, -it.qty);
        if (!ok) {
          for (const d of done) await repo.adjustStock(d.id, d.size, d.qty);
          throw new HttpError(409, 'out_of_stock',
            'Not enough stock of ' + it.name + ' in size ' + it.size + ' to confirm this order. Restock it first.');
        }
        done.push(it);
      }
      stockApplied = true;
      stockChanged = tracked.length > 0;
    } else if (!hold && stockApplied) {
      for (const it of tracked) await repo.adjustStock(it.id, it.size, it.qty);
      stockApplied = false;
      stockChanged = tracked.length > 0;
    }
    const updated = await repo.updateOrder(o.ref, { status, stockApplied }, { status, at: new Date(), note });
    const rev = stockChanged ? await repo.bumpRev() : null;
    return { order: adminOrder(updated), stockChanged, rev };
  };

  S.deleteOrder = async function deleteOrder(ref) {
    const o = await repo.deleteOrder(cleanRef(ref));
    if (!o) throw notFound('Order not found.');
    if (o.cardFileId) await repo.deleteFile(o.cardFileId).catch(() => false);
    return { ok: true };
  };

  /* ---------- enquiries (contact and bulk-quote forms) ---------- */

  S.createEnquiry = async function createEnquiry(input, meta) {
    meta = meta || {};
    const e = validateEnquiry(input);
    const now = new Date();
    const doc = Object.assign(e, {
      ref: makeRef('', 'EQ'), status: 'new', note: '', ip: str(meta.ip, 64), ua: str(meta.ua, 200), createdAt: now, updatedAt: now,
    });
    try {
      await repo.createEnquiry(doc);
    } catch (err) {
      if (!err || err.code !== 'duplicate') throw err;
      doc.ref = makeRef('', 'EQ');
      await repo.createEnquiry(doc);
    }
    return { ref: doc.ref, createdAt: now };
  };

  S.listEnquiries = async function listEnquiries(query) {
    query = query || {};
    const status = ENQUIRY_STATUSES.includes(query.status) ? query.status : '';
    const limit = num(query.limit, 1, 100, 20);
    const page = num(query.page, 1, 100000, 1);
    const [r, counts] = await Promise.all([
      repo.listEnquiries({ status, q: str(query.q, 60), skip: (page - 1) * limit, limit }),
      repo.enquiryCounts(),
    ]);
    const byStatus = {};
    for (const s of ENQUIRY_STATUSES) byStatus[s] = counts[s] || 0;
    return { items: r.items, total: r.total, page, pages: Math.max(1, Math.ceil(r.total / limit)), byStatus };
  };

  S.updateEnquiry = async function updateEnquiry(ref, body) {
    const set = {};
    if (body && body.status != null) {
      if (!ENQUIRY_STATUSES.includes(body.status)) throw bad('bad_status', 'Unknown enquiry status.');
      set.status = body.status;
    }
    if (body && body.note != null) set.note = str(body.note, 1000);
    const e = await repo.updateEnquiry(cleanRef(ref), set);
    if (!e) throw notFound('Enquiry not found.');
    return e;
  };

  S.deleteEnquiry = async function deleteEnquiry(ref) {
    const e = await repo.deleteEnquiry(cleanRef(ref));
    if (!e) throw notFound('Enquiry not found.');
    return { ok: true };
  };

  /*
   * Copies product photos that are still linked from another website (for example
   * the old WordPress site) into MongoDB, so the store keeps working if that site goes away.
   */
  S.importImages = async function importImages(opts) {
    opts = opts || {};
    const fetcher = opts.fetch || globalThis.fetch;
    const store = await S.getStore({ admin: true });
    if (!store) throw new HttpError(404, 'not_set_up', 'The store has no data yet.');
    const urls = new Set();
    const remote = (u) => typeof u === 'string' && /^https:\/\//i.test(u);
    for (const p of store.products) for (const c of p.colors) for (const u of c.imgs) if (remote(u)) urls.add(u);
    if (remote(store.brand && store.brand.logo)) urls.add(store.brand.logo);
    for (const c of store.cats || []) if (remote(c.img)) urls.add(c.img);
    const list = [...urls].slice(0, num(opts.limit, 1, 400, 120));
    const map = new Map();
    const failed = [];
    let i = 0;
    async function worker() {
      while (i < list.length) {
        const url = list[i++];
        try {
          const res = await fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const buf = Buffer.from(await res.arrayBuffer());
          const type = sniff(buf);
          if (!type || !type.startsWith('image/') || buf.length > LIMITS[type]) throw new Error('not a supported photo');
          const name = (url.split('/').pop() || 'photo').split('?')[0].replace(/[^\w.-]+/g, '_').slice(0, 100);
          const f = await repo.saveFile(buf, { filename: name, contentType: type, kind: 'image' });
          map.set(url, '/api/files/' + f.id);
        } catch (e) {
          failed.push({ url, reason: String((e && e.message) || e).slice(0, 120) });
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (map.size) {
      const swap = (u) => map.get(u) || u;
      const data = JSON.parse(JSON.stringify(store));
      for (const p of data.products) for (const c of p.colors) c.imgs = c.imgs.map(swap);
      if (data.brand && data.brand.logo) data.brand.logo = swap(data.brand.logo);
      for (const c of data.cats || []) if (c.img) c.img = swap(c.img);
      await S.publishStore(store.rev, data);
    }
    return { copied: map.size, failed, remaining: Math.max(0, urls.size - list.length) };
  };

  /* Customers can check an order with its reference and their mobile number. */
  S.trackOrder = async function trackOrder(ref, phone) {
    const o = await repo.getOrder(cleanRef(ref));
    const p = String(phone == null ? '' : phone).replace(/\D/g, '').slice(-10);
    if (!o || p.length !== 10 || String(o.customer.phone).slice(-10) !== p) {
      throw notFound('No order matches that reference and mobile number.');
    }
    return {
      ref: o.ref, status: o.status, quote: !!o.quote, createdAt: o.createdAt,
      history: (o.history || []).map((h) => ({ status: h.status, at: h.at })),
      items: o.items.map((it) => ({ name: it.name, color: it.color, size: it.size, qty: it.qty, unit: it.unit })),
      total: o.total, subtotal: o.subtotal, city: o.customer.city,
    };
  };

  S.orderByToken = async function orderByToken(token) {
    return TOKEN.test(String(token)) ? repo.getOrderByToken(String(token)) : null;
  };

  /* ---------- files (stored in MongoDB GridFS) ---------- */

  S.uploadFile = async function uploadFile(file) {
    if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) throw bad('no_file', 'Choose a file to upload.');
    const type = sniff(file.buffer);
    if (!type) throw bad('bad_type', 'Upload a JPG, PNG, WEBP, GIF, MP4 or WEBM file.');
    if (file.buffer.length > LIMITS[type]) {
      throw new HttpError(413, 'too_large', type.startsWith('video') ? 'Videos can be up to 40 MB.' : 'Photos can be up to 8 MB.');
    }
    const kind = type.startsWith('video') ? 'video' : 'image';
    const filename = str(file.originalname, 100).replace(/[^\w.-]+/g, '_') || kind;
    const f = await repo.saveFile(file.buffer, { filename, contentType: type, kind });
    return { id: f.id, url: '/api/files/' + f.id, contentType: type, size: f.length, kind };
  };

  S.listBackups = async function listBackups() {
    return (await repo.listFiles({ kind: 'backup' })).map((f) => ({ id: f.id, name: f.filename, size: f.length, date: f.uploadDate }));
  };

  S.fileInfo = async (id) => (FILE_ID.test(String(id)) ? repo.getFileInfo(String(id)) : null);
  S.openFile = (id, start, end) => repo.openFileStream(id, start, end);

  S.listFiles = async function listFiles() {
    const files = await repo.listFiles({});
    return files.filter((f) => f.kind !== 'order-card' && f.kind !== 'backup').map((f) => Object.assign({}, f, { url: '/api/files/' + f.id }));
  };

  S.deleteFile = async function deleteFile(id) {
    if (!FILE_ID.test(String(id))) throw notFound('File not found.');
    const ok = await repo.deleteFile(String(id));
    if (!ok) throw notFound('File not found.');
    return { ok: true };
  };

  /* ---------- admin login ---------- */

  S.ensureAdmin = async function ensureAdmin() {
    let admin = await repo.getAdmin();
    if (!admin) {
      admin = await repo.setAdmin({ hash: await hashPassword(config.adminPassword), ver: 1 });
      admin.created = true;
    }
    adminVersion = admin.ver || 1;
    return admin;
  };

  function issue(ver) {
    const ttl = config.tokenHours * 3600;
    return { token: signToken({ sub: 'admin', pv: ver }, config.jwtSecret, ttl), expiresIn: ttl };
  }

  S.login = async function login(password) {
    const admin = await repo.getAdmin();
    if (!admin || !(await verifyPassword(String(password == null ? '' : password), admin.hash))) {
      throw new HttpError(401, 'wrong_password', 'Wrong password. Try again.');
    }
    adminVersion = admin.ver || 1;
    return issue(adminVersion);
  };

  S.checkToken = function checkToken(token) {
    const payload = verifyToken(token, config.jwtSecret);
    if (!payload || payload.sub !== 'admin') return false;
    return adminVersion == null || payload.pv === adminVersion;
  };

  async function setPassword(next) {
    next = String(next == null ? '' : next);
    if (next.length < 8) throw bad('weak_password', 'Use at least 8 characters for the new password.');
    if (next.length > 128) throw bad('weak_password', 'Use at most 128 characters for the new password.');
    const admin = await repo.getAdmin();
    const ver = ((admin && admin.ver) || 1) + 1;
    await repo.setAdmin({ hash: await hashPassword(next), ver });
    adminVersion = ver;
    return ver;
  }

  /* Changing the password logs out every other admin session. */
  S.changePassword = async function changePassword(current, next) {
    const admin = await repo.getAdmin();
    if (!admin || !(await verifyPassword(String(current == null ? '' : current), admin.hash))) {
      throw new HttpError(400, 'wrong_password', 'Your current password is wrong.');
    }
    const ver = await setPassword(next);
    return issue(ver);
  };

  S.resetPassword = async (next) => { await setPassword(next); return true; };

  return S;
}

module.exports = { createServices };
