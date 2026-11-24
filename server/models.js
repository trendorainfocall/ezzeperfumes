import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const VOLUMES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 150, 200];

export const User = model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  firstName: String, lastName: String, phone: String, address: String,
  pin: String, // hash-lənmiş PIN
  pinAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
}, { timestamps: true }));

const productSchema = new Schema({
  name: { type: String, required: true },
  brand: { type: String, default: 'EZZE' },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0, min: 0, max: 90 },
  volume: { type: Number, default: 50, enum: VOLUMES },
  season: { type: String, default: 'Bütün fəsillər' },
  gender: { type: String, enum: ['Kişi', 'Qadın', 'Unisex'], default: 'Unisex' },
  notes: { top: String, middle: String, base: String },
  description: String,
  stock: { type: Number, default: 0 },
  sold: { type: Number, default: 0 },
  rating: { type: Number, default: 4.5 },
  color: { type: String, default: '#d9b45a' },
  image: String,
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
productSchema.virtual('salePrice').get(function () { return Math.round(this.price * (100 - (this.discount || 0))) / 100; });
export const Product = model('Product', productSchema);

export const Promo = model('Promo', new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  value: { type: Number, required: true },
  minOrder: { type: Number, default: 0 },
  usageLimit: { type: Number, default: 0 }, // 0 = limitsiz
  used: { type: Number, default: 0 },
  expiresAt: Date,
  active: { type: Boolean, default: true },
}, { timestamps: true }));

export const Setting = model('Setting', new Schema({
  key: { type: String, default: 'main', unique: true },
  footerText: { type: String, default: 'EZZE Parfumes – Platinum Edition. Lüks ətirlər kolleksiyası.' },
  address: { type: String, default: 'Bakı, Azərbaycan' },
  phone: { type: String, default: '' },
  email: { type: String, default: 'info@ezze.az' },
  instagram: { type: String, default: '' },
  whatsapp: { type: String, default: '' }, // yalnız rəqəmlər, məs: 994501234567
}));

export const Order = model('Order', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  customer: { firstName: String, lastName: String, phone: String, address: String, note: String },
  items: [{ product: { type: Schema.Types.ObjectId, ref: 'Product' }, name: String, price: Number, qty: Number, image: String, color: String, volume: Number, originalPrice: Number, discount: Number }],
  pdfs: [{ originalName: String, filename: String, note: String, uploadedAt: { type: Date, default: Date.now } }],
  subtotal: Number,
  promoCode: String,
  discount: { type: Number, default: 0 },
  total: Number,
  status: { type: String, enum: ['Hazırlanır', 'Çatdırılmaya verilib', 'Çatdırılıb', 'Ləğv edilib'], default: 'Hazırlanır' },
  cancelledAt: Date,
}, { timestamps: true }));

export const Notification = model('Notification', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: ['status', 'pdf', 'info'], default: 'info' },
  title: String,
  message: String,
  order: { type: Schema.Types.ObjectId, ref: 'Order' },
  read: { type: Boolean, default: false },
}, { timestamps: true }));

// Dəstək yazışması: hər müştəri üçün bir söhbət (user sahəsi ilə), mesajlar ayrı sənədlərdir
export const Message = model('Message', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // söhbətin sahibi (müştəri)
  from: { type: String, enum: ['user', 'admin'], required: true },
  admin: { type: Schema.Types.ObjectId, ref: 'User' }, // cavab verən admin
  adminName: String,
  text: { type: String, required: true, maxlength: 2000 },
  readByUser: { type: Boolean, default: false },
  readByAdmin: { type: Boolean, default: false },
}, { timestamps: true }));

export const Post = model('Post', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  summary: { type: String, trim: true, maxlength: 400, default: '' },
  content: { type: String, required: true, maxlength: 20000 },
  image: { type: String, default: '' },
  published: { type: Boolean, default: true },
  author: String,
}, { timestamps: true }));

export const Branch = model('Branch', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  image: { type: String, default: '' },
  hours: { type: String, default: '', maxlength: 400 }, // məs: "Hər gün 10:00 – 22:00"
  address: { type: String, default: '', maxlength: 300 },
  phone: { type: String, default: '', maxlength: 60 },
  mapUrl: { type: String, default: '' },
  lat: Number,
  lng: Number,
}, { timestamps: true }));
