/* ---------- core: utilities, storage, API, state ---------- */
var R = window.RankStore = {};
var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function money(n) { return '₹' + Math.round(+n || 0).toLocaleString('en-IN'); }
function digits(s) { return String(s || '').replace(/\D/g, ''); }
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
function uid(p) { return (p || 'p') + Math.random().toString(36).slice(2, 8); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(), t = ks.reduce(function (a, k) { if (a[k] == null) a[k] = {}; return a[k]; }, o); t[last] = v; }
function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }

function storeOf(kind) {
  var s; try { s = window[kind]; } catch (e) { s = null; }
  return {
    get: function (k, d) { try { var v = s.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { s.removeItem(k); } catch (e) { /* ignore */ } }
  };
}
var LS = storeOf('localStorage'), SS = storeOf('sessionStorage');

/* ---------- API ---------- */
var API = (function () {
  var m = document.querySelector('meta[name="rk-api"]'), v = m && m.getAttribute('content');
  if (!v || (v.charAt(0) === '/' && location.protocol === 'file:')) return null;
  return v.replace(/\/+$/, '');
})();
var apiToken = SS.get('rk:token', null);
function apiOrigin() { return /^https?:\/\//i.test(API || '') ? API.replace(/\/api$/, '') : ''; }
function absUrl(u) { if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; if (u.charAt(0) === '/') return (apiOrigin() || location.origin) + u; return ''; }
function apiFetch(path, opts) {
  opts = opts || {};
  if (!API) return Promise.reject(Object.assign(new Error('This copy of the site is not connected to the store server.'), { status: 0, data: {} }));
  var h = {}, body = opts.body;
  if (apiToken) h.Authorization = 'Bearer ' + apiToken;
  if (body != null && !(body instanceof FormData)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  return fetch(API + path, { method: opts.method || 'GET', headers: h, body: body }).then(function (r) {
    return r.text().then(function (t) {
      var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* not json */ }
      if (!r.ok) {
        var err = new Error((j && j.message) || ('The server answered ' + r.status + '.'));
        err.status = r.status; err.data = j || {};
        if (r.status === 401 && apiToken && path.indexOf('/auth/') !== 0 && R.loggedOut) R.loggedOut();
        throw err;
      }
      return j;
    });
  }, function () {
    var err = new Error('Can’t reach the server. Check your internet connection and try again.');
    err.status = 0; err.data = {}; throw err;
  });
}

/* ---------- data shape (mirrors src/lib/normalize.js) ---------- */
var DEF = {
  brand: { name: 'Rank INC', tagline: '', logo: '', primary: '#1F5C52', accent: '#8FB3CC' },
  store: { whatsapp: '', phone: '', phone2: '', email: '', address: '', hours: '', mapUrl: '', gstin: '', gstPct: 0, shipFee: 0, freeShipAbove: 0,
    freightNote: 'Confirmed with your quote', coupon: '', couponPct: 0, dispatch: '', payments: ['NEFT', 'UPI', 'CREDIT', 'COD'],
    social: { facebook: '', instagram: '', linkedin: '', twitter: '', youtube: '' } },
  home: { announce: '', headline: 'Hospital textiles', sub: '', cta: 'Browse the catalogue', cta2: 'Request a bulk quote', customTitle: '', customSub: '',
    show: { slides: true, quick: true, depts: true, kits: true, newin: true, brand: true, trust: true, categories: true, colours: true, rows: true, featured: true, process: true, custom: true, clients: true, testimonials: true, seo: true, faq: true },
    stats: [], testimonials: [], slides: [], clients: [], seoTitle: '', seoBody: '' },
  about: { title: 'About us', body: '', mission: '', vision: '' }
};
var PAYMENTS = { NEFT: ['Bank transfer', 'NEFT / RTGS / IMPS'], UPI: ['UPI', 'Any UPI app'], CREDIT: ['Credit terms', 'For existing institutional accounts'], COD: ['Cash on delivery', 'Pay when the goods arrive'] };
var ARTS = ['scrub', 'coat', 'gown', 'patient', 'apron', 'coverall', 'sheet', 'pillow', 'mattress', 'blanket', 'pack', 'drape', 'bag', 'towel', 'warming'];
var SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Free size', 'Standard', 'Small', 'Medium', 'Large', 'Single', 'Double', 'Adult', 'Paediatric'];

function normP(p) {
  p = p || {};
  var cols = (Array.isArray(p.colors) && p.colors.length ? p.colors : [{ name: 'Standard', hex: '#E8EEF0' }]).map(function (c) {
    return { name: String(c.name || 'Standard'), hex: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#E8EEF0', imgs: Array.isArray(c.imgs) ? c.imgs.filter(Boolean) : [] };
  });
  var sz = {};
  if (p.sizes && typeof p.sizes === 'object') Object.keys(p.sizes).forEach(function (k) { if (p.sizes[k] !== '' && p.sizes[k] != null) sz[k] = Math.max(0, parseInt(p.sizes[k], 10) || 0); });
  if (!Object.keys(sz).length) sz.Standard = 0;
  return {
    id: String(p.id || uid()), cat: String(p.cat || 'other'), sub: String(p.sub || ''), code: String(p.code || ''), name: String(p.name || 'Untitled product'),
    price: Math.max(0, +p.price || 0), mrp: Math.max(0, +p.mrp || 0), unit: String(p.unit || 'pc'), moq: Math.max(1, parseInt(p.moq, 10) || 1), track: !!p.track,
    tags: Array.isArray(p.tags) ? p.tags.filter(function (t) { return ['new', 'bestseller', 'featured'].indexOf(t) > -1; }) : [],
    art: ARTS.indexOf(p.art) > -1 ? p.art : 'sheet', colors: cols, sizes: sz, desc: String(p.desc || ''), long: String(p.long || ''),
    specs: Array.isArray(p.specs) ? p.specs.filter(function (s) { return s && (s.k || s.v); }).map(function (s) { return { k: String(s.k || ''), v: String(s.v || '') }; }) : [],
    emb: !!p.emb, hidden: !!p.hidden,
    sizeImgs: Array.isArray(p.sizeImgs) ? p.sizeImgs.filter(Boolean) : [], sizeNote: String(p.sizeNote || '')
  };
}
function normalize(d) { return withCats(normalizeRaw(d)); }
function normalizeRaw(d) {
  d = d && typeof d === 'object' ? d : {};
  var h = d.home || {}, st = d.store || {};
  return {
    rev: +d.rev || 0, updated: d.updated || '',
    brand: Object.assign({}, DEF.brand, d.brand || {}),
    store: Object.assign({}, DEF.store, st, { social: Object.assign({}, DEF.store.social, st.social || {}), payments: Array.isArray(st.payments) && st.payments.length ? st.payments : DEF.store.payments }),
    home: Object.assign({}, DEF.home, h, { show: Object.assign({}, DEF.home.show, h.show || {}), stats: Array.isArray(h.stats) ? h.stats : [], testimonials: Array.isArray(h.testimonials) ? h.testimonials : [],
      slides: Array.isArray(h.slides) ? h.slides.map(function (x) { return { title: String(x.title || ''), sub: String(x.sub || ''), cta: String(x.cta || ''), link: String(x.link || ''), img: String(x.img || ''), bg: /^#[0-9a-f]{6}$/i.test(x.bg) ? x.bg : '#DCE8F0' }; }) : [],
      clients: Array.isArray(h.clients) ? h.clients.map(function (x) { return { name: String(x.name || ''), logo: String(x.logo || '') }; }) : [] }),
    about: Object.assign({}, DEF.about, d.about || {}),
    legal: Object.assign({ privacy: '', terms: '' }, d.legal || {}),
    depts: Array.isArray(d.depts) ? d.depts.map(function (x) { return { id: String(x.id || slugify(x.name)), name: String(x.name || ''), blurb: String(x.blurb || ''), icon: String(x.icon || 'layers'), keys: String(x.keys || '') }; }) : [],
    kits: Array.isArray(d.kits) ? d.kits.map(function (k) { return { id: String(k.id || slugify(k.name)), name: String(k.name || ''), blurb: String(k.blurb || ''), for: String(k.for || ''), items: Array.isArray(k.items) ? k.items.map(function (i) { return { id: String(i.id || ''), qty: Math.max(1, parseInt(i.qty, 10) || 1) }; }) : [] }; }) : [],
    cats: Array.isArray(d.cats) ? d.cats.map(function (c) { return { id: String(c.id || slugify(c.name)), name: String(c.name || ''), blurb: String(c.blurb || ''), art: ARTS.indexOf(c.art) > -1 ? c.art : 'sheet', img: String(c.img || '') }; }) : [],
    faq: Array.isArray(d.faq) ? d.faq.map(function (f) { return { q: String(f.q || ''), a: String(f.a || '') }; }) : [],
    products: Array.isArray(d.products) ? d.products.map(normP) : []
  };
}
/* Never show an empty menu: when a store has products but no categories (for example data from an
   older template), build the categories from the products themselves. */
function withCats(st) {
  var have = {}; st.cats.forEach(function (c) { have[c.id] = 1; });
  var missing = [];
  st.products.forEach(function (p) { if (!have[p.cat]) { have[p.cat] = 1; missing.push(p.cat); } });
  missing.forEach(function (id) { st.cats.push({ id: id, name: id === 'other' ? 'Other products' : id.replace(/-/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }), blurb: '', art: 'sheet', img: '', auto: true }); });
  return st;
}

/* ---------- state ---------- */
var embedded = null;
try { embedded = JSON.parse((document.getElementById('store-data') || {}).textContent || 'null'); } catch (e) { embedded = null; }
var published = normalize(embedded);
var state = clone(published);           /* what the site shows (the admin's draft while editing) */
var isAdmin = !!apiToken;
var staleDraft = null;
(function () {
  var dr = LS.get('rk:draft', null);
  if (isAdmin && dr && dr.data) { if (dr.base === published.rev) state = normalize(dr.data); else staleDraft = dr; }
})();

function dirty() { return JSON.stringify(state) !== JSON.stringify(published); }
function vis() { return state.products.filter(function (p) { return !p.hidden; }); }
function find(id) { for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i]; return null; }
function catOf(id) { for (var i = 0; i < state.cats.length; i++) if (state.cats[i].id === id) return state.cats[i]; return null; }
function catName(id) { var c = catOf(id); return c ? c.name : 'Other products'; }
function sizeList(p) { return Object.keys(p.sizes); }
function stockOf(p) { return Object.keys(p.sizes).reduce(function (a, k) { return a + (p.sizes[k] || 0); }, 0); }
function available(p, size) { if (!p.track) return true; if (size) return (p.sizes[size] || 0) > 0; return stockOf(p) > 0; }
function maxQty(p, size) { return p.track ? (p.sizes[size] || 0) : 100000; }
function priceHtml(p, big) {
  if (!p.price) return '<span class="price req">Price on request</span>';
  return '<span class="price">' + money(p.price) + ' <small>/ ' + esc(p.unit) + '</small>' + (p.mrp > p.price ? '<s>' + money(p.mrp) + '</s>' : '') + '</span>' +
    (big && state.store.gstPct ? ' <span class="small muted">+ ' + state.store.gstPct + '% GST</span>' : '');
}
function firstImg(p, ci) {
  var c = p.colors[ci || 0] || p.colors[0];
  if (c && c.imgs[0]) return c.imgs[0];
  for (var i = 0; i < p.colors.length; i++) if (p.colors[i].imgs[0]) return p.colors[i].imgs[0];
  return '';
}
function waNumber() { var d = digits(state.store.whatsapp); if (d.length === 10) d = '91' + d; return d; }
function waLink(text) { var n = waNumber(); return n ? 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '') : ''; }
function telHref(s) { return 'tel:' + String(s || '').replace(/[^\d+]/g, ''); }

/* ---------- icons ---------- */
var IC = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart: '<path d="M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 7.5 6.3Z"/>',
  basket: '<path d="M3 9h18l-1.6 10.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Z"/><path d="m8 9 3-6M16 9l-3-6M9 13v4M15 13v4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m6 15 6-6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  check: '<path d="m5 12 5 5 9-10"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  wa: '<path d="M4 20.5 5.3 16.6A8.5 8.5 0 1 1 8.6 19.5L4 20.5Z"/><path d="M9 8.6c.2 2.6 2.7 5.2 5.4 5.6l1.2-1.3-1.7-1-1 .8a4 4 0 0 1-2.2-2.2l.8-1-1-1.7L9 8.6Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>', out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z"/>', box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>', file: '<path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.6-1.5-1.6-1.5-3 0-1 .8-1.5 2-1.5H17a4 4 0 0 0 4-4C21 6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7" r="1.2"/>',
  cart: '<path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6l2-8Z"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  ruler: '<path d="m3 17 14-14 4 4L7 21l-4-4Z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  needle: '<path d="M4 20 18 6"/><circle cx="19" cy="5" r="1.6"/><path d="M6 14c-3-1-3-5 1-6 3-.6 4 2 7 1"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>', refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z"/>', ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  li: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>', tw: '<path d="M4 4l16 16M20 4 4 20"/>', yt: '<rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10 9.5 5 2.5-5 2.5v-5Z"/>',
  d_scalpel: '<path d="M14 4 4 14l3 3L19 5c-1.5-1.5-3.5-2-5-1Z"/><path d="m7 17-3 3M10 14l3 3"/>',
  d_bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
  d_baby: '<circle cx="12" cy="8" r="4"/><path d="M10 7.5h.01M14 7.5h.01M10.5 10a2 2 0 0 0 3 0M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/>',
  d_bone: '<path d="M8.5 15.5 15.5 8.5M7 13a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 1 1 7 8l1 1M17 11a2.5 2.5 0 1 1 2.5 2.5A2.5 2.5 0 1 1 17 16l-1-1"/>',
  d_heart: '<path d="M3 12h4l2-4 3 8 2-4h7"/>',
  d_brain: '<path d="M12 5a3 3 0 0 0-5.8 1A3 3 0 0 0 4 11a3 3 0 0 0 2 5 3 3 0 0 0 6 1V5ZM12 5a3 3 0 0 1 5.8 1A3 3 0 0 1 20 11a3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
  d_flask: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
  d_broom: '<path d="M14 4 10 12M6 13h8l2 8H4l2-8ZM8 17v4M12 17v4"/>',
  d_shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="M12 8v8M8 12h8"/>',
  d_users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  d_box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  d_layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  kit: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M12 11v5M9.5 13.5h5"/>'
};
function deptMatches(d) {
  var keys = String(d.keys || '').toLowerCase().split(',').map(function (k) { return k.trim(); }).filter(Boolean);
  return vis().filter(function (p) { var h = (p.name + ' ' + p.sub + ' ' + p.cat).toLowerCase(); return keys.some(function (k) { return h.indexOf(k) > -1; }); });
}
function deptOf(id) { for (var i = 0; i < state.depts.length; i++) if (state.depts[i].id === id) return state.depts[i]; return null; }
function dic(name, s) { return ic(IC['d_' + name] ? 'd_' + name : 'd_layers', s); }
function ic(n, s) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"' + (s ? ' style="width:' + s + 'px;height:' + s + 'px"' : '') + '>' + (IC[n] || '') + '</svg>'; }

/* ---------- small UI helpers ---------- */
function toast(msg, action) {
  var box = $('#toasts'); if (!box) return;
  var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<a href="' + esc(action.href) + '">' + esc(action.label) + '</a>' : '');
  box.appendChild(t);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 3600);
}
var lastFocus = null;
function modal(html, cls) {
  var m = $('#modal'); lastFocus = document.activeElement;
  m.innerHTML = '<div class="' + (cls || 'modal') + '" data-act="mback">' + html + '</div>';
  document.body.style.overflow = 'hidden';
  var f = m.querySelector('[autofocus],input,select,textarea,button:not([data-act="mclose"])') || m.querySelector('button');
  if (f) setTimeout(function () { if (!m.contains(document.activeElement)) f.focus(); }, 40);
}
function closeModal() {
  var m = $('#modal'); if (!m || !m.innerHTML) return;
  m.innerHTML = ''; document.body.style.overflow = '';
  if (R.onModalClose) { var fn = R.onModalClose; R.onModalClose = null; fn(); }
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
}
function copyText(t) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return fallbackCopy(t); });
  return Promise.resolve(fallbackCopy(t));
}
function fallbackCopy(t) { var a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } a.remove(); return ok; }
function fldErr(form, fields) {
  $$('.fld.err', form).forEach(function (f) { f.classList.remove('err'); var h = f.querySelector('.fld-h'); if (h && h.dataset.hint != null) h.textContent = h.dataset.hint; });
  var first = null;
  Object.keys(fields || {}).forEach(function (k) {
    var inp = form.querySelector('[name="' + k + '"]'); if (!inp) return;
    var f = inp.closest('.fld'); f.classList.add('err'); var h = f.querySelector('.fld-h');
    if (h) { if (h.dataset.hint == null) h.dataset.hint = h.textContent; h.textContent = fields[k]; }
    if (!first) first = inp;
  });
  if (first) first.focus();
}
function field(label, name, o) {
  o = o || {}; var id = 'f-' + name + (o.idsfx || '');
  var attrs = ' id="' + id + '" name="' + name + '"' + (o.req ? ' required' : '') + (o.ac ? ' autocomplete="' + o.ac + '"' : '') + (o.im ? ' inputmode="' + o.im + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '');
  var inp = o.rows ? '<textarea' + attrs + ' rows="' + o.rows + '">' + esc(o.v || '') + '</textarea>'
    : o.opts ? '<select' + attrs + '>' + o.opts.map(function (x) { var v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (String(o.v) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>'
    : '<input type="' + (o.type || 'text') + '"' + attrs + ' value="' + esc(o.v || '') + '">';
  return '<div class="fld' + (o.full ? ' full' : '') + '"><label class="fld-l" for="' + id + '">' + label + (o.opt ? ' <i>(optional)</i>' : '') + '</label>' + inp + '<span class="fld-h">' + (o.hint || '') + '</span></div>';
}
function formData(form) {
  var o = {}; $$('input,select,textarea', form).forEach(function (el) { if (!el.name) return; if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else if (el.type === 'checkbox') o[el.name] = el.checked; else o[el.name] = el.value; });
  return o;
}

/* Product photos: a broken link falls back to the WordPress thumbnail, then to the drawn illustration. */
function thumbVariant(src) {
  var m = /^(https:\/\/rankinc\.in\/wp-content\/uploads\/.+?)(\.(?:webp|jpe?g|png))$/i.exec(src || '');
  if (!m || /-\d+x\d+\.(webp|jpe?g|png)$/i.test(src)) return '';
  return m[1] + '-300x300' + m[2];
}
function imgTag(src, alt, art, hex, opts) {
  opts = opts || {};
  return '<img src="' + esc(absUrl(src) || src) + '" alt="' + esc(alt) + '"' + (opts.eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async" width="' + (opts.w || 600) + '" height="' + (opts.h || 600) + '" data-art="' + esc(art) + '" data-hex="' + esc(hex || '') + '"' + (thumbVariant(src) ? ' data-alt="' + esc(thumbVariant(src)) + '"' : '') + '>';
}
document.addEventListener('error', function (e) {
  var img = e.target; if (!img || img.tagName !== 'IMG' || !img.dataset.art) return;
  if (img.dataset.alt) { var a = img.dataset.alt; img.removeAttribute('data-alt'); img.src = a; return; }
  if (img.classList.contains('alt-img')) { img.remove(); return; }
  var span = document.createElement('span'); span.className = 'art'; span.style.display = 'contents';
  span.innerHTML = R.art(img.dataset.art, img.dataset.hex);
  img.replaceWith(span.firstChild);
}, true);
function media(p, ci, idx, opts) {
  var c = p.colors[ci || 0] || p.colors[0], src = c.imgs[idx || 0] || (idx ? '' : firstImg(p, ci));
  return src ? imgTag(src, p.name + (p.colors.length > 1 ? ' — ' + c.name : ''), p.art, c.hex, opts) : R.art(p.art, c.hex);
}
