'use strict';
/*
 * MongoDB collections:
 *   settings  - one document (key "main"): brand, store, home page, about page, categories, FAQ and the version number (rev)
 *   products  - one document per product, in display order
 *   orders    - every order / quote request placed from the website
 *   enquiries - messages from the contact and bulk-quote forms
 *   admins    - the hashed admin password
 *   uploads.files / uploads.chunks - photos, videos and order photos (GridFS)
 */
const { mongoose } = require('./db');

const { Schema } = mongoose;
const Mixed = Schema.Types.Mixed;

const SettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  rev: { type: Number, default: 0 },
  updated: { type: String, default: '' },
  brand: { type: Mixed, default: {} },
  store: { type: Mixed, default: {} },
  home: { type: Mixed, default: {} },
  about: { type: Mixed, default: {} },
  cats: { type: Mixed, default: [] },
  legal: { type: Mixed, default: {} },
  depts: { type: Mixed, default: [] },
  kits: { type: Mixed, default: [] },
  faq: { type: Mixed, default: [] },
}, { collection: 'settings', minimize: false, versionKey: false });

const ColourSchema = new Schema({
  name: String,
  hex: String,
  imgs: [String],
}, { _id: false });

const ProductSchema = new Schema({
  pid: { type: String, required: true, unique: true },
  order: { type: Number, default: 0, index: true },
  cat: { type: String, default: 'other', index: true },
  sub: String,
  code: String,
  name: { type: String, required: true },
  price: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  unit: { type: String, default: 'pc' },
  moq: { type: Number, default: 1 },
  track: { type: Boolean, default: false },
  emb: { type: Boolean, default: false },
  sizeImgs: [String],
  sizeNote: String,
  tags: [String],
  art: String,
  colors: [ColourSchema],
  sizes: { type: Mixed, default: {} },
  desc: String,
  long: String,
  specs: [{ _id: false, k: String, v: String }],
  hidden: { type: Boolean, default: false },
}, { collection: 'products', minimize: false, versionKey: false, timestamps: true });

const OrderItemSchema = new Schema({
  productId: String,
  code: String,
  name: String,
  cat: String,
  color: String,
  colorHex: String,
  size: String,
  qty: Number,
  emb: String,
  unit: String,
  price: Number,
  lineTotal: Number,
  img: String,
  track: Boolean,
}, { _id: false });

const OrderSchema = new Schema({
  ref: { type: String, required: true, unique: true },
  token: { type: String, required: true, unique: true },
  items: [OrderItemSchema],
  subtotal: Number,
  discount: Number,
  coupon: String,
  gst: Number,
  gstPct: Number,
  shipping: Number,
  total: Number,
  quote: { type: Boolean, default: false },
  customer: {
    name: String,
    org: String,
    phone: { type: String, index: true },
    email: String,
    gstin: String,
    addr: String,
    city: String,
    state: String,
    pin: String,
  },
  payment: { type: String, enum: ['COD', 'UPI', 'NEFT', 'CREDIT'], default: 'NEFT' },
  note: String,
  status: { type: String, enum: ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'], default: 'new', index: true },
  history: [{ _id: false, status: String, at: Date, note: String }],
  cardFileId: String,
  stockApplied: { type: Boolean, default: false },
  ip: String,
  ua: String,
}, { collection: 'orders', versionKey: false, timestamps: true });
OrderSchema.index({ createdAt: -1 });

const EnquirySchema = new Schema({
  ref: { type: String, required: true, unique: true },
  name: String,
  org: String,
  phone: { type: String, index: true },
  email: String,
  city: String,
  topic: String,
  product: String,
  message: String,
  status: { type: String, enum: ['new', 'contacted', 'quoted', 'closed'], default: 'new', index: true },
  note: String,
  ip: String,
  ua: String,
}, { collection: 'enquiries', versionKey: false, timestamps: true });
EnquirySchema.index({ createdAt: -1 });

const AdminSchema = new Schema({
  key: { type: String, required: true, unique: true, default: 'admin' },
  hash: { type: String, required: true },
  ver: { type: Number, default: 1 },
}, { collection: 'admins', versionKey: false, timestamps: true });

const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

module.exports = {
  Settings: model('Settings', SettingsSchema),
  Product: model('Product', ProductSchema),
  Order: model('Order', OrderSchema),
  Enquiry: model('Enquiry', EnquirySchema),
  Admin: model('Admin', AdminSchema),
};
