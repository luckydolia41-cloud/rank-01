'use strict';
/* In-memory version of src/repo/mongo.js, used by the demo server and the tests. Data is lost on restart. */
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { statsFrom } = require('../src/lib/order');

const copy = (v) => (v == null ? v : structuredClone(v));

function createMemoryRepo() {
  let settings = null;
  let products = [];
  let orders = [];
  let enquiries = [];
  let admin = null;
  const files = new Map();

  return {
    async init() {},
    async ping() { return true; },

    async getSettings() { return copy(settings); },
    async createSettings(s) {
      if (settings) return null;
      settings = copy(s);
      return copy(settings);
    },
    async updateSettings(rev, s) {
      if (!settings || settings.rev !== rev) return null;
      settings = Object.assign({}, settings, copy(s));
      return copy(settings);
    },
    async bumpRev() {
      if (!settings) return null;
      settings.rev += 1;
      settings.updated = new Date().toISOString();
      return settings.rev;
    },

    async listProducts() { return copy(products); },
    async getProducts(ids) { return copy(products.filter((p) => ids.includes(p.id))); },
    async replaceProducts(list) { products = copy(list); },
    async upsertProduct(p) {
      const i = products.findIndex((x) => x.id === p.id);
      if (i >= 0) products[i] = copy(p);
      else products.push(copy(p));
    },
    async deleteProduct(id) {
      const before = products.length;
      products = products.filter((p) => p.id !== id);
      return products.length < before;
    },
    async adjustStock(id, size, delta) {
      const p = products.find((x) => x.id === id);
      if (!p || !Object.prototype.hasOwnProperty.call(p.sizes, size)) return false;
      if (delta < 0 && p.sizes[size] < -delta) return false;
      p.sizes[size] += delta;
      return true;
    },

    async createOrder(o) {
      if (orders.some((x) => x.ref === o.ref)) throw Object.assign(new Error('duplicate'), { code: 'duplicate' });
      orders.push(copy(o));
    },
    async getOrder(ref) { return copy(orders.find((o) => o.ref === ref) || null); },
    async getOrderByToken(token) { return copy(orders.find((o) => o.token === token) || null); },
    async listOrders({ status, q, skip, limit }) {
      let list = orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (status) list = list.filter((o) => o.status === status);
      if (q) {
        const needle = q.toLowerCase();
        const digits = q.replace(/\D/g, '');
        list = list.filter((o) => o.ref.toLowerCase().includes(needle) ||
          o.customer.name.toLowerCase().includes(needle) || o.customer.city.toLowerCase().includes(needle) ||
          (digits.length >= 4 && o.customer.phone.includes(digits)));
      }
      return { items: copy(list.slice(skip, skip + limit)), total: list.length };
    },
    async updateOrder(ref, set, historyEntry) {
      const o = orders.find((x) => x.ref === ref);
      if (!o) return null;
      Object.assign(o, copy(set), { updatedAt: new Date() });
      o.history.push(copy(historyEntry));
      return copy(o);
    },
    async deleteOrder(ref) {
      const i = orders.findIndex((o) => o.ref === ref);
      if (i < 0) return null;
      return orders.splice(i, 1)[0];
    },
    async orderStats() {
      const groups = new Map();
      for (const o of orders) {
        const g = groups.get(o.status) || { status: o.status, count: 0, total: 0 };
        g.count += 1;
        g.total += o.total;
        groups.set(o.status, g);
      }
      const since = Date.now() - 24 * 3600 * 1000;
      return statsFrom([...groups.values()], orders.filter((o) => new Date(o.createdAt).getTime() >= since).length);
    },

    async createEnquiry(e) {
      if (enquiries.some((x) => x.ref === e.ref)) throw Object.assign(new Error('duplicate'), { code: 'duplicate' });
      enquiries.push(copy(e));
    },
    async listEnquiries({ status, q, skip, limit }) {
      let list = enquiries.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (status) list = list.filter((e) => e.status === status);
      if (q) {
        const needle = q.toLowerCase();
        const digits = q.replace(/\D/g, '');
        list = list.filter((e) => [e.ref, e.name, e.org, e.city, e.email, e.product].some((v) => String(v || '').toLowerCase().includes(needle)) ||
          (digits.length >= 4 && String(e.phone).includes(digits)));
      }
      return { items: copy(list.slice(skip, skip + limit)), total: list.length };
    },
    async updateEnquiry(ref, set) {
      const e = enquiries.find((x) => x.ref === ref);
      if (!e) return null;
      Object.assign(e, copy(set), { updatedAt: new Date() });
      return copy(e);
    },
    async deleteEnquiry(ref) {
      const i = enquiries.findIndex((e) => e.ref === ref);
      return i < 0 ? null : enquiries.splice(i, 1)[0];
    },
    async enquiryCounts() {
      const out = {};
      for (const e of enquiries) out[e.status] = (out[e.status] || 0) + 1;
      return out;
    },

    async saveFile(buffer, { filename, contentType, kind }) {
      const id = crypto.randomBytes(12).toString('hex');
      files.set(id, { buffer: Buffer.from(buffer), info: { id, length: buffer.length, contentType, kind, filename, uploadDate: new Date() } });
      return { id, length: buffer.length, contentType, kind };
    },
    async getFileInfo(id) { const f = files.get(id); return f ? Object.assign({}, f.info) : null; },
    openFileStream(id, start, end) { return Readable.from([files.get(id).buffer.subarray(start, end)]); },
    async deleteFile(id) { return files.delete(id); },
    async listFiles({ kind }) {
      return [...files.values()].map((f) => Object.assign({}, f.info)).filter((f) => !kind || f.kind === kind).reverse();
    },

    async getAdmin() { return copy(admin); },
    async setAdmin({ hash, ver }) { admin = { key: 'admin', hash, ver }; return copy(admin); },
  };
}

module.exports = { createMemoryRepo };
