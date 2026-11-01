'use strict';
/* Order rules: customer checks, server-side pricing, minimum quantities and stock checks. */
const crypto = require('node:crypto');
const { HttpError, bad } = require('./http');
const { str, PAYMENTS } = require('./normalize');

const STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
/* While an order is in one of these states its items are taken out of stock. */
const STOCK_HELD = ['confirmed', 'shipped', 'delivered'];
const ENQUIRY_STATUSES = ['new', 'contacted', 'quoted', 'closed'];
const STORE_DEFAULTS = { shipFee: 0, freeShipAbove: 0, coupon: '', couponPct: 0, gstPct: 0 };
const MAX_QTY = 100000;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

function cleanPhone(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

function validateCustomer(c) {
  c = c && typeof c === 'object' ? c : {};
  const out = {
    name: str(c.name, 80),
    org: str(c.org, 120),
    phone: cleanPhone(c.phone),
    email: str(c.email, 160).toLowerCase(),
    gstin: str(c.gstin, 20).toUpperCase().replace(/\s/g, ''),
    addr: str(c.addr, 300),
    city: str(c.city, 60),
    state: str(c.state, 60),
    pin: String(c.pin == null ? '' : c.pin).replace(/\D/g, ''),
  };
  const fields = {};
  if (out.name.length < 2) fields.name = 'Add your name';
  if (!/^[6-9]\d{9}$/.test(out.phone)) fields.phone = 'Enter a valid 10-digit mobile number';
  if (out.email && !EMAIL.test(out.email)) fields.email = 'Check the email address';
  if (out.gstin && !GSTIN.test(out.gstin)) fields.gstin = 'GSTIN has 15 characters, like 07ABCDE1234F1Z5';
  if (out.addr.length < 8) fields.addr = 'Add the full delivery address';
  if (!out.city) fields.city = 'Add the city';
  if (!/^\d{6}$/.test(out.pin)) fields.pin = 'Pincode has 6 digits';
  if (Object.keys(fields).length) throw new HttpError(400, 'invalid', 'Fill in the highlighted details.', { fields });
  return out;
}

function validateEnquiry(e) {
  e = e && typeof e === 'object' ? e : {};
  const out = {
    name: str(e.name, 80),
    org: str(e.org, 120),
    phone: cleanPhone(e.phone),
    email: str(e.email, 160).toLowerCase(),
    city: str(e.city, 60),
    topic: str(e.topic, 60) || 'General enquiry',
    product: str(e.product, 160),
    message: str(e.message, 3000),
  };
  const fields = {};
  if (out.name.length < 2) fields.name = 'Add your name';
  if (!/^[6-9]\d{9}$/.test(out.phone) && !(out.phone.length >= 8 && out.phone.length <= 15 && out.email)) {
    fields.phone = 'Enter a valid mobile number';
  }
  if (out.email && !EMAIL.test(out.email)) fields.email = 'Check the email address';
  if (out.message.length < 5) fields.message = 'Tell us what you need';
  if (Object.keys(fields).length) throw new HttpError(400, 'invalid', 'Fill in the highlighted details.', { fields });
  return out;
}

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/*
 * Prices the order from the products saved in the database (never from what the
 * browser says), checks minimum order quantities and, for stock-tracked products,
 * that there is enough stock. Products with price 0 are "price on request": they
 * are saved as a quote request and the store confirms the price on WhatsApp.
 */
function priceItems(rawItems, productsById, settings, couponInput) {
  const merged = new Map();
  for (const raw of rawItems) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const id = String(r.id == null ? '' : r.id);
    const p = productsById.get(id);
    if (!p || p.hidden) throw new HttpError(404, 'unavailable', 'One of these products is no longer available.');
    const ci = Number(r.ci == null ? 0 : r.ci);
    if (!Number.isInteger(ci) || ci < 0 || ci >= p.colors.length) throw bad('bad_colour', 'Pick a colour for ' + p.name + '.');
    const size = String(r.size || '');
    if (!size || !hasOwn(p.sizes, size)) throw bad('bad_size', 'Pick a size for ' + p.name + '.');
    const qty = Number(r.qty == null ? 1 : r.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw bad('bad_qty', 'Quantity must be between 1 and ' + MAX_QTY + '.');
    const emb = p.emb ? str(r.emb, 60) : '';
    const key = id + '|' + ci + '|' + size + '|' + emb.toLowerCase();
    const prev = merged.get(key);
    if (prev) prev.qty += qty;
    else merged.set(key, { p, ci, size, qty, emb });
  }
  const items = [];
  const perSize = new Map();
  for (const m of merged.values()) perSize.set(m.p.id + '|' + m.size, (perSize.get(m.p.id + '|' + m.size) || 0) + m.qty);
  for (const { p, ci, size, qty, emb } of merged.values()) {
    const moq = Number(p.moq) || 1;
    if (qty < moq) {
      throw new HttpError(400, 'below_moq', 'The minimum order for ' + p.name + ' is ' + moq + ' ' + (p.unit || 'pc') + '.', { id: p.id, moq });
    }
    if (p.track) {
      const left = Number(p.sizes[size]) || 0;
      if (perSize.get(p.id + '|' + size) > left) {
        throw new HttpError(409, 'out_of_stock',
          left ? 'Only ' + left + ' left in size ' + size + ' for ' + p.name + '.' : p.name + ' is out of stock in size ' + size + '.',
          { id: p.id, size, left });
      }
    }
    const col = p.colors[ci];
    const photo = col.imgs && col.imgs[0] && !String(col.imgs[0]).startsWith('data:') ? col.imgs[0] : '';
    items.push({
      id: p.id, code: p.code || '', name: p.name, cat: p.cat, color: col.name, colorHex: col.hex,
      size, qty, emb, unit: p.unit || 'pc', price: p.price, lineTotal: p.price * qty, img: photo, track: !!p.track,
    });
  }
  const store = Object.assign({}, STORE_DEFAULTS, (settings && settings.store) || {});
  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const quote = items.some((it) => !it.price);
  const code = String(couponInput == null ? '' : couponInput).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const valid = !!code && !!store.coupon && code === String(store.coupon).toUpperCase() && subtotal > 0;
  const discount = valid ? Math.round((subtotal * (Number(store.couponPct) || 0)) / 100) : 0;
  const after = subtotal - discount;
  const gst = Math.round((after * (Number(store.gstPct) || 0)) / 100);
  const fee = Number(store.shipFee) || 0;
  const shipping = !fee || subtotal === 0 || (Number(store.freeShipAbove) > 0 && after >= Number(store.freeShipAbove)) ? 0 : fee;
  return { items, subtotal, discount, coupon: valid ? code : '', gst, gstPct: Number(store.gstPct) || 0, shipping, total: after + gst + shipping, quote };
}

function cleanPayment(v, settings) {
  const allowed = settings && settings.store && Array.isArray(settings.store.payments) && settings.store.payments.length
    ? settings.store.payments : PAYMENTS;
  return allowed.includes(v) ? v : allowed[0];
}

function cleanRef(v) {
  const s = String(v == null ? '' : v).toUpperCase();
  return /^[A-Z]{2}-[A-Z0-9]{4,8}$/.test(s) ? s : '';
}

function makeRef(brandName, prefix) {
  const letters = prefix || String(brandName || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  const rand = crypto.randomBytes(5).readUIntBE(0, 5).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return (letters.length === 2 ? letters : 'OD') + '-' + rand;
}

function statsFrom(rows, last24h) {
  const byStatus = {};
  for (const s of STATUSES) byStatus[s] = 0;
  let revenue = 0;
  let total = 0;
  for (const r of rows) {
    if (!STATUSES.includes(r.status)) continue;
    byStatus[r.status] = r.count;
    total += r.count;
    if (STOCK_HELD.includes(r.status)) revenue += r.total || 0;
  }
  return { byStatus, revenue, total, last24h };
}

module.exports = {
  STATUSES, STOCK_HELD, ENQUIRY_STATUSES, MAX_QTY,
  cleanPhone, validateCustomer, validateEnquiry, priceItems, cleanPayment, cleanRef, makeRef, statsFrom,
};
