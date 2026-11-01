'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('../src/lib/auth');
const { normalizeStoreData, normalizeProduct } = require('../src/lib/normalize');
const { validateCustomer, validateEnquiry, priceItems, cleanRef, makeRef, cleanPhone } = require('../src/lib/order');
const { sniff, parseRange } = require('../src/lib/files');
const { clean } = require('../src/lib/security');
const { injectStore, orderPage, renderPage, sitemap, resolveRoute } = require('../src/lib/pages');

test('passwords hash and verify', async () => {
  const h = await hashPassword('rankinc@admin');
  assert.match(h, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword('rankinc@admin', h), true);
  assert.equal(await verifyPassword('wrong', h), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
});

test('tokens sign, verify, expire and reject tampering', () => {
  const t = signToken({ sub: 'admin', pv: 1 }, 'secret-secret-secret', 60);
  assert.equal(verifyToken(t, 'secret-secret-secret').sub, 'admin');
  assert.equal(verifyToken(t, 'other-secret-other'), null);
  const [h, , s] = t.split('.');
  const forged = h + '.' + Buffer.from(JSON.stringify({ sub: 'admin', pv: 1, exp: 9e9 })).toString('base64url') + '.' + s;
  assert.equal(verifyToken(forged, 'secret-secret-secret'), null);
  assert.equal(verifyToken(signToken({ sub: 'admin' }, 'secret-secret-secret', -5), 'secret-secret-secret'), null);
});

test('store data is cleaned', () => {
  const d = normalizeStoreData({
    brand: { name: '  Rank INC  ', primary: '#123abc', accent: 'red', evil: 1, logo: 'javascript:alert(1)' },
    store: { whatsapp: '+91 98116-41315', coupon: 'bulk 10!', couponPct: 500, gstPct: 99, payments: ['NEFT', 'BTC', 'NEFT'], social: { linkedin: 'http://x', facebook: 'https://facebook.com/rank' } },
    home: { show: { featured: false, nope: true }, testimonials: [{ name: 'A', text: 'Good' }, { name: 'B', text: '' }] },
    cats: [{ name: 'Surgical Drapes', blurb: 'x' }, { id: 'Bad ID!!', name: 'Packs' }, { name: '' }],
    faq: [{ q: 'Q?', a: 'A' }, { q: '', a: '' }],
    products: [
      { id: 'p1', cat: 'Surgical Drapes', name: 'Drape', price: '699.4', moq: 0, sizes: { 'M': '5', 'a.b': 3, '$x': 1, Large: '' }, specs: [{ k: 'GSM', v: '40' }, { k: '', v: 'x' }],
        colors: [{ name: 'Blue', hex: 'nope', imgs: ['/api/files/0123456789abcdef01234567', 'javascript:x'] }], tags: ['new', 'new', 'bad'], art: 'rocket' },
      { id: 'p1' },
    ],
  });
  assert.equal(d.brand.name, 'Rank INC');
  assert.equal(d.brand.primary, '#123ABC');
  assert.equal(d.brand.accent, undefined);
  assert.equal(d.brand.logo, '');
  assert.equal(d.brand.evil, undefined);
  assert.equal(d.store.whatsapp, '919811641315');
  assert.equal(d.store.coupon, 'BULK10');
  assert.equal(d.store.couponPct, 90);
  assert.equal(d.store.gstPct, 28);
  assert.deepEqual(d.store.payments, ['NEFT']);
  assert.deepEqual(d.store.social, { facebook: 'https://facebook.com/rank', linkedin: '' });
  assert.deepEqual(d.home.show, { featured: false });
  assert.equal(d.home.testimonials.length, 1);
  assert.deepEqual(d.cats.map((c) => c.id), ['surgical-drapes', 'bad-id']);
  assert.equal(d.faq.length, 1);
  const p = d.products[0];
  assert.equal(p.cat, 'surgical-drapes');
  assert.equal(p.price, 699);
  assert.equal(p.moq, 1);
  assert.deepEqual(p.sizes, { M: 5 });
  assert.deepEqual(p.specs, [{ k: 'GSM', v: '40' }]);
  assert.deepEqual(p.colors[0].imgs, ['/api/files/0123456789abcdef01234567']);
  assert.equal(p.colors[0].hex, '#E8EEF0');
  assert.deepEqual(p.tags, ['new']);
  assert.equal(p.art, 'sheet');
  assert.notEqual(d.products[1].id, 'p1');
  assert.deepEqual(d.products[1].sizes, { Standard: 0 });
  const sp = normalizeProduct({ sizeImgs: ['/api/files/0123456789abcdef01234567', 'javascript:x', 'https://x.in/chart.png'], sizeNote: ' Chest in inches ' });
  assert.deepEqual(sp.sizeImgs, ['/api/files/0123456789abcdef01234567', 'https://x.in/chart.png']);
  assert.equal(sp.sizeNote, 'Chest in inches');
});

test('customer and enquiry details are checked', () => {
  assert.equal(cleanPhone('+91 98116 41315'), '9811641315');
  const ok = validateCustomer({ name: 'Dr Mehta', org: 'City Hospital', phone: '09812345678', email: 'Buy@CityHosp.in', gstin: '07abcde1234f1z5', addr: 'Sector 7, Rohini', city: 'Delhi', pin: '110085' });
  assert.equal(ok.phone, '9812345678');
  assert.equal(ok.email, 'buy@cityhosp.in');
  assert.equal(ok.gstin, '07ABCDE1234F1Z5');
  assert.throws(() => validateCustomer({ name: 'R', phone: '123', addr: 'x', city: '', pin: '11', email: 'nope', gstin: '123' }), (e) => {
    assert.equal(e.status, 400);
    assert.deepEqual(Object.keys(e.extra.fields).sort(), ['addr', 'city', 'email', 'gstin', 'name', 'phone', 'pin']);
    return true;
  });
  assert.equal(validateEnquiry({ name: 'Asha', phone: '9812345678', message: 'Need 500 scrub sets' }).topic, 'General enquiry');
  assert.throws(() => validateEnquiry({ name: 'A', phone: '1', message: '' }), (e) => e.status === 400 && !!e.extra.fields.message);
});

test('orders are priced from the database, with MOQ, GST, coupon, freight and stock checks', () => {
  const tracked = normalizeProduct({ id: 'p1', name: 'Scrub', price: 600, unit: 'set', track: true, colors: [{ name: 'Navy', hex: '#000000' }, { name: 'Ceil', hex: '#ffffff' }], sizes: { M: 20, L: 0 } });
  const quote = normalizeProduct({ id: 'p2', name: 'Pack', price: 0, moq: 10, unit: 'pack', sizes: { Standard: 0 } });
  const map = new Map([['p1', tracked], ['p2', quote]]);
  const settings = { store: { shipFee: 250, freeShipAbove: 10000, coupon: 'BULK5', couponPct: 5, gstPct: 5 } };
  const one = priceItems([{ id: 'p1', ci: 1, size: 'M', qty: 2, price: 1 }], map, settings, '');
  assert.equal(one.subtotal, 1200);
  assert.equal(one.gst, 60);
  assert.equal(one.shipping, 250);
  assert.equal(one.total, 1510);
  assert.equal(one.items[0].color, 'Ceil');
  assert.equal(one.quote, false);
  const big = priceItems([{ id: 'p1', ci: 0, size: 'M', qty: 20 }], map, settings, 'bulk5');
  assert.equal(big.discount, 600);
  assert.equal(big.gst, 570);
  assert.equal(big.shipping, 0);
  assert.equal(big.total, 11970);
  const mixed = priceItems([{ id: 'p2', size: 'Standard', qty: 50 }], map, settings, '');
  assert.equal(mixed.quote, true);
  assert.equal(mixed.total, 0);
  assert.equal(mixed.shipping, 0);
  assert.throws(() => priceItems([{ id: 'p2', size: 'Standard', qty: 5 }], map, settings), (e) => e.code === 'below_moq' && e.extra.moq === 10);
  assert.throws(() => priceItems([{ id: 'p1', ci: 0, size: 'M', qty: 21 }], map, settings), (e) => e.status === 409 && e.extra.left === 20);
  assert.throws(() => priceItems([{ id: 'p1', ci: 0, size: 'L', qty: 1 }], map, settings), (e) => e.status === 409);
  assert.throws(() => priceItems([{ id: 'p1', ci: 5, size: 'M', qty: 1 }], map, settings), (e) => e.code === 'bad_colour');
  assert.throws(() => priceItems([{ id: 'p1', ci: 0, size: 'XS', qty: 1 }], map, settings), (e) => e.code === 'bad_size');
  assert.throws(() => priceItems([{ id: 'nope', size: 'M', qty: 1 }], map, settings), (e) => e.status === 404);
});

test('order refs', () => {
  assert.equal(cleanRef('ra-abc12'), 'RA-ABC12');
  assert.equal(cleanRef('<script>'), '');
  assert.match(makeRef('Rank INC'), /^RA-[A-Z0-9]{6}$/);
  assert.match(makeRef('', 'EQ'), /^EQ-[A-Z0-9]{6}$/);
});

test('file types are detected from content and ranges parsed', () => {
  assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(sniff(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniff(Buffer.from('<svg onload=alert(1)>')), null);
  assert.equal(sniff(Buffer.from('\0\0\0\x18ftypheic\0\0\0\0')), null);
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.equal(parseRange('bytes=2000-', 1000), 'invalid');
  assert.equal(parseRange(undefined, 1000), null);
});

test('request bodies lose MongoDB operators', () => {
  assert.deepEqual(clean({ a: { $gt: '' }, 'b.c': 1, d: [{ $where: 'x', ok: 1 }], __proto__: { x: 1 } }), { a: {}, d: [{ ok: 1 }] });
});

test('pages get their own SEO tags, safe JSON and a sitemap', () => {
  const store = {
    brand: { name: 'Rank<INC', tagline: 'Medical textiles', logo: '/api/files/0123456789abcdef01234567' },
    store: { phone: '+91-9811641315', email: 'a@b.in', address: 'Bawana' }, home: { headline: 'H', sub: 'S' }, about: {}, faq: [],
    cats: [{ id: 'surgical-drapes', name: 'Surgical Drapes', blurb: 'Drapes' }],
    products: [{ id: 'hip-drape', cat: 'surgical-drapes', name: '</script><script>alert(1)</script>', desc: 'd', price: 0, unit: 'pc', colors: [{ name: 'Std', imgs: ['https://x.in/a.webp'] }], sizes: { Standard: 0 }, specs: [] },
      { id: 'secret', cat: 'surgical-drapes', name: 'Hidden', hidden: true, colors: [], sizes: {} }],
  };
  const tpl = '<head><!--SEO--><link href="/assets/app.css?v={{V}}"></head><body><div id="root"><!--SSR--></div><script type="application/json" id="store-data">null</script></body>';
  const prod = renderPage(tpl, { store, pathname: '/product/hip-drape', base: 'https://rankinc.in', assetV: 'abc' });
  assert.equal(prod.status, 200);
  assert.ok(prod.html.includes('<link rel="canonical" href="https://rankinc.in/product/hip-drape">'));
  assert.ok(prod.html.includes('"@type":"Product"'));
  assert.ok(prod.html.includes('og:image" content="https://x.in/a.webp"'));
  assert.ok(prod.html.includes('app.css?v=abc'));
  assert.ok(!prod.html.includes('</script><script>alert'));
  assert.equal(renderPage(tpl, { store, pathname: '/product/secret', base: 'https://x' }).status, 404);
  assert.equal(renderPage(tpl, { store, pathname: '/nope', base: 'https://x' }).status, 404);
  assert.equal(resolveRoute('/category/surgical-drapes/', store).name, 'category');
  assert.ok(renderPage(tpl, { store, pathname: '/admin', base: 'https://x' }).html.includes('noindex'));
  const map = sitemap(store, 'https://rankinc.in');
  assert.ok(map.includes('<loc>https://rankinc.in/product/hip-drape</loc>'));
  assert.ok(!map.includes('secret'));
  const out = injectStore('<title>X</title><script type="application/json" id="store-data">null</script>', store);
  assert.ok(out.includes('<title>Rank&lt;INC</title>'));
  const page = orderPage({ ref: 'RA-ABC123', token: 'a'.repeat(32), quote: true, items: [{ name: 'Pack', color: 'Std', size: 'Standard', qty: 10, unit: 'pack', price: 0, lineTotal: 0 }], total: 0, shipping: 0, discount: 0, payment: 'NEFT', cardFileId: 'x', customer: { org: 'City Hospital' } }, 'https://rankinc.in', 'Rank INC');
  assert.ok(page.includes('<meta property="og:image" content="https://rankinc.in/o/' + 'a'.repeat(32) + '/card.jpg">'));
  assert.ok(page.includes('Quote request RA-ABC123'));
});
