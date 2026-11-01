'use strict';
/*
 * Cleans store data coming from the admin panel before it is saved:
 * trims text to safe lengths, keeps numbers in range and drops anything unknown.
 */
const crypto = require('node:crypto');

/* Common size labels the admin panel offers. Any other label that passes SIZE_RX is allowed too. */
const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Free size', 'Standard', 'Small', 'Medium', 'Large', 'Single', 'Double', 'Adult', 'Paediatric'];
const SIZE_RX = /^[A-Za-z0-9][A-Za-z0-9 +\-/×()']{0,23}$/;
const TAGS = ['new', 'bestseller', 'featured'];
/* Drawn illustration used when a product has no photo. */
const ARTS = ['scrub', 'coat', 'gown', 'patient', 'apron', 'coverall', 'sheet', 'pillow', 'mattress', 'blanket', 'pack', 'drape', 'bag', 'towel', 'warming'];
const PAYMENTS = ['COD', 'UPI', 'NEFT', 'CREDIT'];
const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function str(value, max) {
  if (value == null) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function num(value, min, max, fallback) {
  const n = Number(value);
  if (value === '' || value == null || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const bool = (v) => v === true || v === 'true' || v === 1;
const hex = (v, fallback) => (HEX.test(String(v || '')) ? String(v).toUpperCase() : fallback);

/* Photos may be files stored in MongoDB, https links, or small inline images. */
function image(v) {
  if (typeof v !== 'string') return null;
  v = v.trim();
  if (/^\/api\/files\/[a-f0-9]{24}$/.test(v)) return v;
  if (/^https?:\/\/[^\s"'<>\\]{1,600}$/i.test(v)) return v;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 2800000) return v;
  return null;
}

function slug(v, fallback) {
  const s = String(v == null ? '' : v).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return SLUG.test(s) ? s : fallback;
}

function productId(v) {
  const s = String(v == null ? '' : v);
  return /^[A-Za-z0-9_-]{2,60}$/.test(s) ? s : 'p' + crypto.randomBytes(4).toString('hex');
}

function sizeLabel(v) {
  const s = str(v, 24).replace(/\s+/g, ' ');
  return SIZE_RX.test(s) ? s : '';
}

function normalizeProduct(p) {
  p = p && typeof p === 'object' ? p : {};
  let colors = (Array.isArray(p.colors) ? p.colors : []).slice(0, 16).map((c) => ({
    name: str(c && c.name, 40) || 'Standard',
    hex: hex(c && c.hex, '#E8EEF0'),
    imgs: (Array.isArray(c && c.imgs) ? c.imgs : []).map(image).filter(Boolean).slice(0, 10),
  }));
  if (!colors.length) colors = [{ name: 'Standard', hex: '#E8EEF0', imgs: [] }];
  const sizes = {};
  if (p.sizes && typeof p.sizes === 'object') {
    for (const key of Object.keys(p.sizes).slice(0, 16)) {
      const label = sizeLabel(key);
      if (!label || has(sizes, label)) continue;
      const v = p.sizes[key];
      if (v === '' || v == null) continue;
      sizes[label] = num(v, 0, 999999, 0);
    }
  }
  if (!Object.keys(sizes).length) sizes.Standard = 0;
  const tags = (Array.isArray(p.tags) ? p.tags : []).filter((t, i, a) => TAGS.includes(t) && a.indexOf(t) === i);
  const specs = (Array.isArray(p.specs) ? p.specs : []).slice(0, 20)
    .map((s) => ({ k: str(s && s.k, 40), v: str(s && s.v, 200) }))
    .filter((s) => s.k && s.v);
  return {
    id: productId(p.id),
    cat: slug(p.cat, 'other'),
    sub: str(p.sub, 60),
    code: str(p.code, 40),
    name: str(p.name, 120) || 'Untitled product',
    price: num(p.price, 0, 10000000, 0),
    mrp: num(p.mrp, 0, 10000000, 0),
    unit: str(p.unit, 16) || 'pc',
    moq: num(p.moq, 1, 100000, 1),
    track: bool(p.track),
    tags,
    art: ARTS.includes(p.art) ? p.art : 'sheet',
    colors,
    sizes,
    desc: str(p.desc, 300),
    long: str(p.long, 3000),
    specs,
    emb: bool(p.emb),
    sizeImgs: (Array.isArray(p.sizeImgs) ? p.sizeImgs : []).map(image).filter(Boolean).slice(0, 6),
    sizeNote: str(p.sizeNote, 1500),
    hidden: bool(p.hidden),
  };
}

const ICONS = ['scalpel', 'bed', 'baby', 'bone', 'heart', 'brain', 'flask', 'broom', 'shield', 'users', 'box', 'layers'];
function normalizeDepts(list) {
  const seen = new Set();
  const out = [];
  for (const d of (Array.isArray(list) ? list : []).slice(0, 16)) {
    if (!d || typeof d !== 'object') continue;
    const name = str(d.name, 60);
    let id = slug(d.id, '') || slug(name, '');
    if (!name || !id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, blurb: str(d.blurb, 240), icon: ICONS.includes(d.icon) ? d.icon : 'layers', keys: str(d.keys, 600) });
  }
  return out;
}
function normalizeKits(list) {
  const seen = new Set();
  const out = [];
  for (const k of (Array.isArray(list) ? list : []).slice(0, 12)) {
    if (!k || typeof k !== 'object') continue;
    const name = str(k.name, 80);
    let id = slug(k.id, '') || slug(name, '');
    if (!name || !id || seen.has(id)) continue;
    seen.add(id);
    const items = (Array.isArray(k.items) ? k.items : []).slice(0, 20)
      .map((it) => ({ id: /^[A-Za-z0-9_-]{2,60}$/.test(String(it && it.id)) ? String(it.id) : '', qty: num(it && it.qty, 1, 100000, 1) }))
      .filter((it) => it.id);
    out.push({ id, name, blurb: str(k.blurb, 300), for: str(k.for, 80), items });
  }
  return out;
}

function normalizeCats(list) {
  const seen = new Set();
  const out = [];
  for (const c of (Array.isArray(list) ? list : []).slice(0, 40)) {
    if (!c || typeof c !== 'object') continue;
    const name = str(c.name, 60);
    if (!name) continue;
    let id = slug(c.id, '') || slug(name, '');
    if (!id) continue;
    while (seen.has(id)) id = (id + '-x').slice(-40);
    seen.add(id);
    out.push({ id, name, blurb: str(c.blurb, 240), art: ARTS.includes(c.art) ? c.art : 'sheet', img: image(c.img) || '' });
  }
  return out;
}

/* [type, ...options] for each settings field the admin panel can edit. */
const SOCIAL = { facebook: ['url', 400], instagram: ['url', 400], linkedin: ['url', 400], twitter: ['url', 400], youtube: ['url', 400] };
const SPEC = {
  brand: { name: ['s', 40], tagline: ['s', 160], logo: ['img'], primary: ['hex'], accent: ['hex'] },
  store: {
    whatsapp: ['digits', 15], phone: ['s', 40], phone2: ['s', 40], email: ['s', 120], address: ['s', 240], hours: ['s', 120],
    mapUrl: ['url', 600], gstin: ['s', 20], gstPct: ['n', 0, 28], shipFee: ['n', 0, 1000000], freeShipAbove: ['n', 0, 100000000],
    freightNote: ['s', 80], coupon: ['code', 20], couponPct: ['n', 0, 90], dispatch: ['s', 40],
    payments: ['enum', PAYMENTS], social: ['obj', SOCIAL],
  },
  home: {
    announce: ['s', 400], headline: ['s', 160], sub: ['s', 400], cta: ['s', 40], cta2: ['s', 40],
    customTitle: ['s', 120], customSub: ['s', 500],
    show: ['flags', ['slides', 'quick', 'depts', 'kits', 'newin', 'brand', 'trust', 'categories', 'colours', 'rows', 'featured', 'process', 'custom', 'clients', 'testimonials', 'seo', 'faq']],
    slides: ['list', 6, { title: ['s', 120], sub: ['s', 300], cta: ['s', 40], link: ['link', 300], img: ['img'], bg: ['hex'] }, 'title'],
    clients: ['list', 40, { name: ['s', 80], logo: ['img'] }, 'name'],
    seoTitle: ['s', 120], seoBody: ['s', 8000],
    stats: ['list', 6, { n: ['s', 12], label: ['s', 60] }, 'label'],
    testimonials: ['list', 12, { name: ['s', 60], role: ['s', 80], text: ['s', 600] }, 'text'],
  },
  about: { title: ['s', 160], body: ['s', 6000], mission: ['s', 400], vision: ['s', 400] },
  legal: { privacy: ['s', 15000], terms: ['s', 15000] },
};

function pick(obj, spec) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const key of Object.keys(spec)) {
    if (!has(obj, key)) continue;
    const rule = spec[key];
    const v = obj[key];
    switch (rule[0]) {
      case 's': out[key] = str(v, rule[1]); break;
      case 'n': { const n = num(v, rule[1], rule[2], null); if (n != null) out[key] = n; break; }
      case 'hex': { const h = hex(v, null); if (h) out[key] = h; break; }
      case 'img': out[key] = image(v) || ''; break;
      case 'link': { const s = str(v, rule[1]); out[key] = /^(\/[^\s"'<>\\]*|https:\/\/[^\s"'<>\\]+)$/i.test(s) ? s : ''; break; }
      case 'digits': out[key] = String(v == null ? '' : v).replace(/\D/g, '').slice(0, rule[1]); break;
      case 'url': { const s = str(v, rule[1]); out[key] = /^https:\/\/[^\s"'<>\\]+$/i.test(s) ? s : ''; break; }
      case 'code': out[key] = String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, rule[1]); break;
      case 'enum': out[key] = (Array.isArray(v) ? v : []).filter((x, i, a) => rule[1].includes(x) && a.indexOf(x) === i); break;
      case 'obj': out[key] = pick(v, rule[1]); break;
      case 'list': out[key] = (Array.isArray(v) ? v : []).slice(0, rule[1]).map((x) => pick(x, rule[2])).filter((x) => x[rule[3]]); break;
      case 'flags': {
        const src = v && typeof v === 'object' ? v : {};
        const flags = {};
        for (const name of rule[1]) if (has(src, name)) flags[name] = bool(src[name]);
        out[key] = flags;
        break;
      }
      default: break;
    }
  }
  return out;
}

function normalizeStoreData(d) {
  d = d && typeof d === 'object' ? d : {};
  const products = [];
  const seen = new Set();
  for (const raw of (Array.isArray(d.products) ? d.products : []).slice(0, 1000)) {
    const p = normalizeProduct(raw);
    while (seen.has(p.id)) p.id = productId('');
    seen.add(p.id);
    products.push(p);
  }
  return {
    brand: pick(d.brand, SPEC.brand),
    store: pick(d.store, SPEC.store),
    home: pick(d.home, SPEC.home),
    about: pick(d.about, SPEC.about),
    legal: pick(d.legal, SPEC.legal),
    cats: normalizeCats(d.cats),
    depts: normalizeDepts(d.depts),
    kits: normalizeKits(d.kits),
    faq: (Array.isArray(d.faq) ? d.faq : []).slice(0, 40)
      .map((f) => ({ q: str(f && f.q, 240), a: str(f && f.a, 1500) }))
      .filter((f) => f.q || f.a),
    products,
  };
}

module.exports = { ICONS, SIZE_PRESETS, ARTS, PAYMENTS, str, num, image, slug, sizeLabel, normalizeProduct, normalizeStoreData };
