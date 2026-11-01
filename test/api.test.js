'use strict';
/* End-to-end API tests on the in-memory demo server (same handlers and services as the MongoDB server). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDemoServer } = require('../dev/demo-server');

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);

let demo;
let base;
let token;

async function call(path, opts) {
  opts = opts || {};
  const headers = Object.assign({}, opts.headers || {});
  let body = opts.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  if (opts.auth) headers.Authorization = 'Bearer ' + opts.auth;
  const res = await fetch(base + path, { method: opts.method || 'GET', headers, body });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* not json */ }
  return { status: res.status, json, text, headers: res.headers };
}

const customer = { name: 'Dr Asha Mehta', org: 'City Care Hospital', phone: '98123 45678', email: 'purchase@citycare.in', addr: 'Plot 4, Sector 7, Rohini', city: 'Delhi', state: 'Delhi', pin: '110085' };

test.before(async () => {
  demo = createDemoServer({ env: { ADMIN_PASSWORD: 'rankinc@admin', PUBLIC_URL: '' } });
  const port = await demo.start(0);
  base = 'http://127.0.0.1:' + port;
});
test.after(() => demo.stop());

test('health, public store and SEO pages', async () => {
  assert.equal((await call('/api/health')).json.ok, true);
  const s = await call('/api/store');
  assert.equal(s.status, 200);
  assert.equal(s.json.products.length, 100);
  assert.equal(s.json.cats.length, 8);
  assert.equal(s.json.store.whatsapp, '919811641315');
  const home = await call('/');
  assert.equal(home.status, 200);
  assert.ok(home.text.includes('"products":[{'), 'store is injected into the page');
  assert.ok(home.text.includes('"@type":"Organization"'));
  assert.match(home.headers.get('content-security-policy'), /script-src 'self';/);
  const prod = await call('/product/lab-coat');
  assert.equal(prod.status, 200);
  assert.ok(prod.text.includes('<title>Lab Coat — Hospital Apparels | Rank INC</title>'));
  const cat = await call('/category/surgical-drapes');
  assert.ok(cat.text.includes('Cesarean Drape with Incise Pouch'));
  assert.equal((await call('/product/does-not-exist')).status, 404);
  assert.equal((await call('/some/random/page')).status, 404);
  assert.equal((await call('/api/nope')).status, 404);
  const map = await call('/sitemap.xml');
  assert.ok(map.text.includes('/product/classic-scrub-suit</loc>'));
  assert.ok((await call('/robots.txt')).text.includes('Disallow: /admin'));
});

test('bundled assets are cached by version', async () => {
  const home = await call('/');
  const v = /app\.js\?v=([a-f0-9]{10})/.exec(home.text)[1];
  const js = await call('/assets/app.js?v=' + v);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('cache-control'), /immutable/);
  assert.match(js.headers.get('content-type'), /javascript/);
  const css = await call('/assets/app.css');
  assert.equal(css.headers.get('cache-control'), 'no-cache');
  assert.equal((await call('/assets/other.js')).status, 404);
});

test('admin login', async () => {
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
  const ok = await call('/api/auth/login', { method: 'POST', body: { password: 'rankinc@admin' } });
  assert.equal(ok.status, 200);
  token = ok.json.token;
  assert.equal((await call('/api/auth/me', { auth: token })).status, 200);
  assert.equal((await call('/api/admin/store')).status, 401);
});

test('publish with version check, prices, stock tracking, hidden products', async () => {
  const cur = (await call('/api/admin/store', { auth: token })).json;
  const data = JSON.parse(JSON.stringify(cur));
  data.brand.name = 'Rank INC.';
  data.store.gstPct = 5;
  data.store.coupon = 'BULK5';
  data.store.couponPct = 5;
  const scrub = data.products.find((p) => p.id === 'classic-scrub-suit');
  scrub.price = 650;
  scrub.track = true;
  scrub.sizes = { S: 10, M: 40, L: 40, XL: 5 };
  data.products.find((p) => p.id === 'cesarean-pack').moq = 10;
  data.products.find((p) => p.id === 'hip-pack').hidden = true;
  const pub = await call('/api/admin/store', { method: 'PUT', auth: token, body: { rev: cur.rev, data } });
  assert.equal(pub.status, 200, pub.text);
  assert.equal(pub.json.rev, cur.rev + 1);
  const stale = await call('/api/admin/store', { method: 'PUT', auth: token, body: { rev: cur.rev, data } });
  assert.equal(stale.status, 409);
  const pubStore = (await call('/api/store')).json;
  assert.equal(pubStore.brand.name, 'Rank INC.');
  assert.equal(pubStore.products.length, 99);
  assert.equal((await call('/product/hip-pack')).status, 404);
});

test('photo upload is stored and served with ranges', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'scrub.jpg');
  const up = await call('/api/admin/uploads', { method: 'POST', auth: token, body: fd });
  assert.equal(up.status, 201);
  assert.match(up.json.url, /^\/api\/files\/[a-f0-9]{24}$/);
  const get = await fetch(base + up.json.url);
  assert.equal(get.headers.get('content-type'), 'image/jpeg');
  const part = await fetch(base + up.json.url, { headers: { Range: 'bytes=0-9' } });
  assert.equal(part.status, 206);
  const svg = new FormData();
  svg.append('file', new Blob(['<svg onload=alert(1)>'], { type: 'image/svg+xml' }), 'x.svg');
  assert.equal((await call('/api/admin/uploads', { method: 'POST', auth: token, body: svg })).status, 400);
});

test('basket orders: server pricing, GST, quotes, MOQ, order photo, stock on confirm/cancel', async () => {
  const fd = new FormData();
  fd.append('order', JSON.stringify({
    ref: 'RA-TEST01', coupon: 'bulk5', customer, payment: 'NEFT', note: 'Deliver to store room',
    items: [{ id: 'classic-scrub-suit', ci: 1, size: 'M', qty: 20, price: 1 }, { id: 'cesarean-pack', ci: 0, size: 'Standard', qty: 25 }],
  }));
  fd.append('card', new Blob([JPEG], { type: 'image/jpeg' }), 'order.jpg');
  const placed = await call('/api/orders', { method: 'POST', body: fd });
  assert.equal(placed.status, 201, placed.text);
  assert.equal(placed.json.ref, 'RA-TEST01');
  assert.equal(placed.json.subtotal, 13000);
  assert.equal(placed.json.discount, 650);
  assert.equal(placed.json.gst, 618);
  assert.equal(placed.json.total, 12968);
  assert.equal(placed.json.quote, true);
  assert.equal(placed.json.items[1].unit, 'pack');
  assert.match(placed.json.pageUrl, /\/o\/[a-f0-9]{32}$/);

  const page = await call(new URL(placed.json.pageUrl).pathname);
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('og:image'));
  assert.ok(page.text.includes('City Care Hospital'));
  const card = await fetch(placed.json.cardUrl);
  assert.equal(card.headers.get('content-type'), 'image/jpeg');

  const again = await call('/api/orders', { method: 'POST', body: { ref: 'RA-TEST01', items: [{ id: 'classic-scrub-suit', ci: 1, size: 'M', qty: 20 }], customer } });
  assert.equal(again.json.token, placed.json.token, 'double tap returns the same order');

  const bad = await call('/api/orders', { method: 'POST', body: { items: [{ id: 'lab-coat', size: 'M', qty: 1 }], customer: { name: 'x' } } });
  assert.equal(bad.status, 400);
  assert.ok(bad.json.fields.phone);
  const moq = await call('/api/orders', { method: 'POST', body: { items: [{ id: 'cesarean-pack', size: 'Standard', qty: 2 }], customer } });
  assert.equal(moq.status, 400);
  assert.equal(moq.json.error, 'below_moq');
  const tooMany = await call('/api/orders', { method: 'POST', body: { items: [{ id: 'classic-scrub-suit', ci: 0, size: 'XL', qty: 6 }], customer } });
  assert.equal(tooMany.status, 409);
  const hidden = await call('/api/orders', { method: 'POST', body: { items: [{ id: 'hip-pack', size: 'Standard', qty: 1 }], customer } });
  assert.equal(hidden.status, 404);

  const list = await call('/api/admin/orders?status=new', { auth: token });
  assert.equal(list.json.total, 1);
  assert.equal(list.json.items[0].customer.org, 'City Care Hospital');

  const confirm = await call('/api/admin/orders/RA-TEST01', { method: 'PATCH', auth: token, body: { status: 'confirmed' } });
  assert.equal(confirm.status, 200);
  assert.equal(confirm.json.stockChanged, true);
  assert.equal((await call('/api/products/classic-scrub-suit')).json.sizes.M, 20);
  await call('/api/admin/orders/RA-TEST01', { method: 'PATCH', auth: token, body: { status: 'cancelled' } });
  assert.equal((await call('/api/products/classic-scrub-suit')).json.sizes.M, 40);
  const tracked = await call('/api/track?ref=RA-TEST01&phone=%2B91%2098123%2045678');
  assert.equal(tracked.status, 200, tracked.text);
  assert.equal(tracked.json.status, 'cancelled');
  assert.equal(tracked.json.items.length, 2);
  assert.equal(tracked.json.customer, undefined, 'tracking never returns customer details');
  assert.equal((await call('/api/track?ref=RA-TEST01&phone=9999999999')).status, 404);
  assert.equal((await call('/track')).status, 200);
  assert.ok((await call('/terms')).text.includes('Terms of sale'));
  const stats = (await call('/api/admin/orders/stats', { auth: token })).json;
  assert.equal(stats.byStatus.cancelled, 1);
});

test('embroidery is kept per line, departments and kits are published', async () => {
  const s = (await call('/api/store')).json;
  assert.equal(s.depts.length, 9);
  assert.equal(s.kits.length, 6);
  assert.ok(s.products.find((p) => p.id === 'lab-coat').emb);
  const r = await call('/api/orders', { method: 'POST', body: { customer, items: [
    { id: 'lab-coat', size: 'M', qty: 5, emb: 'City Care Hospital' }, { id: 'lab-coat', size: 'M', qty: 3 }, { id: 'cut-sheets', size: 'Standard', qty: 4, emb: 'ignored' }] } });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.items.length, 3);
  assert.equal(r.json.items[0].emb, 'City Care Hospital');
  assert.equal(r.json.items[1].emb, '');
  assert.equal(r.json.items[2].emb, '', 'products without embroidery ignore the text');
  assert.ok((await call(new URL(r.json.pageUrl).pathname)).text.includes('Embroidery: City Care Hospital'));
  assert.ok((await call('/department/operation-theatre')).text.includes('Operation Theatre supplies'));
  assert.ok((await call('/kits')).text.includes('Ward bed kit'));
});

test('enquiries from the contact form', async () => {
  const bad = await call('/api/enquiries', { method: 'POST', body: { name: 'A' } });
  assert.equal(bad.status, 400);
  const ok = await call('/api/enquiries', { method: 'POST', body: { name: 'Ravi Kumar', org: 'Kumar Distributors', phone: '9876543210', email: 'ravi@kd.in', topic: 'Bulk quote', product: 'Isolation Gown', message: 'Need 2,000 isolation gowns per month.', $where: 'x' } });
  assert.equal(ok.status, 201, ok.text);
  assert.match(ok.json.ref, /^EQ-/);
  assert.equal((await call('/api/admin/enquiries')).status, 401);
  const list = await call('/api/admin/enquiries?q=kumar', { auth: token });
  assert.equal(list.json.total, 1);
  assert.equal(list.json.byStatus.new, 1);
  const upd = await call('/api/admin/enquiries/' + ok.json.ref, { method: 'PATCH', auth: token, body: { status: 'quoted', note: 'Sent rates' } });
  assert.equal(upd.json.status, 'quoted');
  assert.equal((await call('/api/admin/enquiries/' + ok.json.ref, { method: 'PATCH', auth: token, body: { status: 'nope' } })).status, 400);
  assert.equal((await call('/api/admin/enquiries/' + ok.json.ref, { method: 'DELETE', auth: token })).status, 200);
});

test('external photos are copied into the database', async () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);
  const fakeFetch = async (url) => (url.includes('IMG07790')
    ? { ok: true, status: 200, arrayBuffer: async () => PNG }
    : { ok: false, status: 404, arrayBuffer: async () => Buffer.alloc(0) });
  const r = await demo.services.importImages({ fetch: fakeFetch, limit: 400 });
  assert.equal(r.copied, 1);
  assert.ok(r.failed.length > 10);
  const coat = (await call('/api/products/lab-coat')).json;
  assert.match(coat.colors[0].imgs[0], /^\/api\/files\/[a-f0-9]{24}$/);
});

test('an older store database is backed up and upgraded on start', async () => {
  const { createMemoryRepo } = require('../dev/memory-repo');
  const { createServices } = require('../src/services');
  const seedData = require('../scripts/seed-data.json');
  const repo = createMemoryRepo();
  const svc = createServices(repo, { tokenHours: 1, jwtSecret: 'x'.repeat(32), adminPassword: 'rankinc@admin' });
  await repo.createSettings({ rev: 3, brand: { name: 'LOWKEY CO.' }, store: { whatsapp: '919319880407' }, home: {}, about: {}, faq: [] });
  await repo.replaceProducts([{ id: 'p01', cat: 'tshirts', name: 'Static Noise Tee', price: 799, colors: [{ name: 'Black', hex: '#111111', imgs: [] }], sizes: { M: 3 }, tags: [] }]);
  await repo.createOrder({ ref: 'LO-OLD001', token: 'a'.repeat(32), items: [], customer: { phone: '9812345678' }, status: 'new', history: [], createdAt: new Date() });
  const up = await svc.upgrade(seedData);
  assert.equal(up.action, 'replaced');
  const s = await svc.getStore({ admin: true });
  assert.equal(s.cats.length, 8);
  assert.equal(s.products.length, 100);
  assert.equal(s.brand.name, 'Rank INC');
  assert.equal(s.depts.length, 9);
  assert.ok(await repo.getOrder('LO-OLD001'), 'orders are kept');
  const backups = await svc.listBackups();
  assert.equal(backups.length, 1);
  assert.match(backups[0].name, /^backup-before-rank-catalogue-/);
  assert.equal((await svc.upgrade(seedData)).action, 'none', 'second start changes nothing');

  /* a Rank INC store from an earlier version only gets the missing sections */
  const repo2 = createMemoryRepo();
  const svc2 = createServices(repo2, { tokenHours: 1, jwtSecret: 'x'.repeat(32), adminPassword: 'x' });
  await repo2.createSettings({ rev: 1, brand: { name: 'RANK INC.' }, store: {}, home: { headline: 'Mine' }, about: {}, faq: [], cats: [{ id: 'hospital-apparels', name: 'Apparel' }] });
  const up2 = await svc2.upgrade(seedData);
  assert.equal(up2.action, 'filled');
  const s2 = await svc2.getStore({ admin: true });
  assert.equal(s2.brand.name, 'RANK INC.', 'admin edits are kept');
  assert.equal(s2.home.headline, 'Mine');
  assert.equal(s2.cats.length, 1);
  assert.equal(s2.depts.length, 9);
  assert.equal(s2.kits.length, 6);
  assert.equal(s2.home.slides.length, 3);
  assert.equal(s2.products.length, 100, 'empty product list is filled');
});

test('admin can reset to the Rank INC catalogue and download server backups', async () => {
  const r = await call('/api/admin/reset-catalogue', { method: 'POST', auth: token });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.products.length, 100);
  const list = await call('/api/admin/backups', { auth: token });
  assert.ok(list.json.length >= 1);
  const dl = await fetch(base + '/api/admin/backups/' + list.json[0].id, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(dl.status, 200);
  assert.ok((await dl.json()).settings);
  assert.equal((await fetch(base + '/api/files/' + list.json[0].id)).status, 404, 'backups are never public');
});

test('password change logs out old sessions', async () => {
  const wrong = await call('/api/auth/password', { method: 'POST', auth: token, body: { current: 'nope', next: 'newpassword1' } });
  assert.equal(wrong.status, 400);
  const ok = await call('/api/auth/password', { method: 'POST', auth: token, body: { current: 'rankinc@admin', next: 'newpassword1' } });
  assert.equal(ok.status, 200);
  assert.equal((await call('/api/auth/me', { auth: token })).status, 401);
  assert.equal((await call('/api/auth/me', { auth: ok.json.token })).status, 200);
});
