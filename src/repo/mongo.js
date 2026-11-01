'use strict';
/* Data access on MongoDB (Mongoose + GridFS). Same functions as dev/memory-repo.js. */
const { mongoose, bucket } = require('../db');
const { Settings, Product, Order, Enquiry, Admin } = require('../models');
const { statsFrom } = require('../lib/order');

const { ObjectId } = mongoose.mongo;

function stripId(doc) {
  if (!doc) return null;
  const out = Object.assign({}, doc);
  delete out._id;
  return out;
}

function toProduct(doc) {
  if (!doc) return null;
  const { _id, pid, order, createdAt, updatedAt, ...rest } = doc;
  return Object.assign({ id: pid }, rest, { sizes: rest.sizes || {}, colors: rest.colors || [], tags: rest.tags || [] });
}

function fromProduct(p) {
  const { id, ...rest } = p;
  return Object.assign({ pid: id }, rest);
}

function toOrder(doc) {
  if (!doc) return null;
  const { _id, ...o } = doc;
  o.items = (o.items || []).map(({ productId, ...it }) => Object.assign({ id: productId }, it));
  return o;
}

function fromOrder(o) {
  const { createdAt, updatedAt, ...rest } = o;
  rest.items = (rest.items || []).map(({ id, ...it }) => Object.assign({ productId: id }, it));
  return rest;
}

function toObjectId(id) {
  return /^[a-f0-9]{24}$/.test(String(id)) ? new ObjectId(String(id)) : null;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileInfo(f) {
  const meta = f.metadata || {};
  return {
    id: String(f._id),
    length: f.length,
    contentType: meta.contentType || f.contentType || 'application/octet-stream',
    kind: meta.kind || 'image',
    filename: f.filename,
    uploadDate: f.uploadDate,
  };
}

function createMongoRepo() {
  return {
    async init() {
      await Promise.all([Settings.init(), Product.init(), Order.init(), Enquiry.init(), Admin.init()]);
    },

    async ping() {
      if (mongoose.connection.readyState !== 1) return false;
      await mongoose.connection.db.admin().ping();
      return true;
    },

    /* settings */
    async getSettings() {
      return stripId(await Settings.findOne({ key: 'main' }).lean());
    },
    async createSettings(s) {
      try {
        const doc = await Settings.create(Object.assign({}, s, { key: 'main' }));
        return stripId(doc.toObject());
      } catch (e) {
        if (e && e.code === 11000) return null;
        throw e;
      }
    },
    async updateSettings(rev, s) {
      return stripId(await Settings.findOneAndUpdate({ key: 'main', rev }, { $set: s }, { new: true }).lean());
    },
    async bumpRev() {
      const doc = await Settings.findOneAndUpdate(
        { key: 'main' },
        { $inc: { rev: 1 }, $set: { updated: new Date().toISOString() } },
        { new: true },
      ).lean();
      return doc ? doc.rev : null;
    },

    /* products */
    async listProducts() {
      return (await Product.find({}).sort({ order: 1, _id: 1 }).lean()).map(toProduct);
    },
    async getProducts(ids) {
      return (await Product.find({ pid: { $in: ids.map(String) } }).lean()).map(toProduct);
    },
    async replaceProducts(list) {
      if (list.length) {
        await Product.bulkWrite(list.map((p, i) => ({
          updateOne: { filter: { pid: p.id }, update: { $set: Object.assign(fromProduct(p), { order: i }) }, upsert: true },
        })), { ordered: false });
      }
      await Product.deleteMany({ pid: { $nin: list.map((p) => p.id) } });
    },
    async upsertProduct(p) {
      const existing = await Product.findOne({ pid: p.id }, { order: 1 }).lean();
      let order = existing ? existing.order : null;
      if (order == null) {
        const last = await Product.findOne({}, { order: 1 }).sort({ order: -1 }).lean();
        order = last ? last.order + 1 : 0;
      }
      await Product.updateOne({ pid: p.id }, { $set: Object.assign(fromProduct(p), { order }) }, { upsert: true });
    },
    async deleteProduct(id) {
      const r = await Product.deleteOne({ pid: id });
      return r.deletedCount === 1;
    },
    /* Atomic stock change; refuses to go below zero. */
    async adjustStock(id, size, delta) {
      const path = 'sizes.' + size;
      const filter = { pid: id };
      filter[path] = delta < 0 ? { $gte: -delta } : { $exists: true };
      const r = await Product.updateOne(filter, { $inc: { [path]: delta } });
      return r.modifiedCount === 1;
    },

    /* orders */
    async createOrder(o) {
      try {
        await Order.create(fromOrder(o));
      } catch (e) {
        if (e && e.code === 11000) throw Object.assign(new Error('duplicate'), { code: 'duplicate' });
        throw e;
      }
    },
    async getOrder(ref) {
      if (!ref) return null;
      return toOrder(await Order.findOne({ ref }).lean());
    },
    async getOrderByToken(token) {
      return toOrder(await Order.findOne({ token }).lean());
    },
    async listOrders({ status, q, skip, limit }) {
      const filter = {};
      if (status) filter.status = status;
      if (q) {
        const rx = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ ref: rx }, { 'customer.name': rx }, { 'customer.city': rx }];
        const digits = q.replace(/\D/g, '');
        if (digits.length >= 4) filter.$or.push({ 'customer.phone': new RegExp(digits) });
      }
      const [items, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Order.countDocuments(filter),
      ]);
      return { items: items.map(toOrder), total };
    },
    async updateOrder(ref, set, historyEntry) {
      return toOrder(await Order.findOneAndUpdate({ ref }, { $set: set, $push: { history: historyEntry } }, { new: true }).lean());
    },
    async deleteOrder(ref) {
      if (!ref) return null;
      return toOrder(await Order.findOneAndDelete({ ref }).lean());
    },
    async orderStats() {
      const rows = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }]);
      const last24h = await Order.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } });
      return statsFrom(rows.map((r) => ({ status: r._id, count: r.count, total: r.total })), last24h);
    },

    /* enquiries */
    async createEnquiry(e) {
      try {
        await Enquiry.create(e);
      } catch (err) {
        if (err && err.code === 11000) throw Object.assign(new Error('duplicate'), { code: 'duplicate' });
        throw err;
      }
    },
    async listEnquiries({ status, q, skip, limit }) {
      const filter = {};
      if (status) filter.status = status;
      if (q) {
        const rx = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ ref: rx }, { name: rx }, { org: rx }, { city: rx }, { email: rx }, { product: rx }];
        const digits = q.replace(/\D/g, '');
        if (digits.length >= 4) filter.$or.push({ phone: new RegExp(digits) });
      }
      const [items, total] = await Promise.all([
        Enquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Enquiry.countDocuments(filter),
      ]);
      return { items: items.map(stripId), total };
    },
    async updateEnquiry(ref, set) {
      return stripId(await Enquiry.findOneAndUpdate({ ref }, { $set: set }, { new: true }).lean());
    },
    async deleteEnquiry(ref) {
      return stripId(await Enquiry.findOneAndDelete({ ref }).lean());
    },
    async enquiryCounts() {
      const rows = await Enquiry.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
      const out = {};
      for (const r of rows) out[r._id] = r.count;
      return out;
    },

    /* files (GridFS) */
    saveFile(buffer, { filename, contentType, kind }) {
      return new Promise((resolve, reject) => {
        const upload = bucket().openUploadStream(filename, { metadata: { contentType, kind } });
        upload.once('error', reject);
        upload.once('finish', () => resolve({ id: String(upload.id), length: buffer.length, contentType, kind }));
        upload.end(buffer);
      });
    },
    async getFileInfo(id) {
      const _id = toObjectId(id);
      if (!_id) return null;
      const [f] = await bucket().find({ _id }).limit(1).toArray();
      return f ? fileInfo(f) : null;
    },
    openFileStream(id, start, end) {
      return bucket().openDownloadStream(toObjectId(id), { start, end });
    },
    async deleteFile(id) {
      const _id = toObjectId(id);
      if (!_id) return false;
      try {
        await bucket().delete(_id);
        return true;
      } catch (e) {
        if (/not found/i.test(String(e && e.message))) return false;
        throw e;
      }
    },
    async listFiles({ kind }) {
      const filter = kind ? { 'metadata.kind': kind } : {};
      return (await bucket().find(filter).sort({ uploadDate: -1 }).limit(300).toArray()).map(fileInfo);
    },

    /* admin */
    async getAdmin() {
      return stripId(await Admin.findOne({ key: 'admin' }).lean());
    },
    async setAdmin({ hash, ver }) {
      return stripId(await Admin.findOneAndUpdate(
        { key: 'admin' },
        { $set: { hash, ver } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).lean());
    },
  };
}

module.exports = { createMongoRepo };
