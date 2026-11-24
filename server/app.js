import './env.js';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { User, Product, Order, Promo, Setting, Notification, Message, Post, Branch, VOLUMES } from './models.js';
import { streamInvoice } from './invoice.js';

const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + '.pdf'),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname) ? cb(null, true) : cb(new Error('Yalnız PDF fayl yükləmək olar')),
});
const IMG_DIR = path.join(UPLOAD_DIR, 'img');
fs.mkdirSync(IMG_DIR, { recursive: true });
const IMG_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const imgUpload = multer({
  storage: multer.diskStorage({
    destination: IMG_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (IMG_EXT[file.mimetype] || '.bin')),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (IMG_EXT[file.mimetype] ? cb(null, true) : cb(new Error('Yalnız JPG, PNG və ya WEBP şəkil yükləmək olar'))),
});
const receiveImage = (req, res) => new Promise((ok, no) => imgUpload.single('file')(req, res, (e) => (e ? no(Object.assign(e, { status: 400 })) : ok())));
const isRealImage = (file) => {
  const b = Buffer.alloc(12); const fd = fs.openSync(file, 'r'); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd);
  return (b[0] === 0xff && b[1] === 0xd8) || b.subarray(0, 4).toString('hex') === '89504e47' || (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP');
};
// yalnız şəkil qovluğu açıqdır (PDF-lər auth ilə qorunur)
const cleanImg = (v) => {
  const x = String(v || '').trim();
  if (!x) return '';
  if (/^\/uploads\/img\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(x) || /^https?:\/\/\S+$/i.test(x)) return x;
  throw bad('Şəkil ünvanı düzgün deyil');
};
const cleanUrl = (v) => {
  const x = String(v || '').trim();
  if (!x) return '';
  if (!/^https?:\/\/\S+$/i.test(x)) throw bad('Link http:// və ya https:// ilə başlamalıdır');
  return x;
};
const receivePdf = (req, res) => new Promise((ok, no) => upload.single('file')(req, res, (e) => (e ? no(Object.assign(e, { status: 400 })) : ok())));
const isRealPdf = (file) => { const b = Buffer.alloc(4); const fd = fs.openSync(file, 'r'); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd); return b.toString() === '%PDF'; };
const notify = (user, type, title, message, order) => Notification.create({ user, type, title, message, order }).catch(() => {});
const orderNo = (o) => '#' + String(o._id).slice(-6).toUpperCase();

const app = express();
app.use(cors());
app.disable('x-powered-by');
app.use(express.json());
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }); // köhnəlmiş (keşlənmiş) API cavabı olmasın
app.use('/uploads/img', express.static(IMG_DIR, { fallthrough: false, maxAge: '7d', index: false, dotfiles: 'deny' }));

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  const status = e.status || (e.name === 'ValidationError' || e.name === 'CastError' ? 400 : 500);
  if (status === 500) console.error(e);
  res.status(status).json({ message: status === 500 ? 'Server xətası. Bir az sonra yenidən cəhd edin' : e.message });
});
const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });
const isAdmin = (r) => r === 'admin' || r === 'superadmin';
const auth = (req, res, next) => {
  try {
    req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ message: 'Giriş tələb olunur' }); }
};
const admin = (req, res, next) => (isAdmin(req.user.role) ? next() : res.status(403).json({ message: 'İcazə yoxdur' }));
const superOnly = (req, res, next) => (req.user.role === 'superadmin' ? next() : res.status(403).json({ message: 'Yalnız Süper Admin' }));
const PIN_RE = /^\d{4,6}$/;

// sadə yaddaş-içi limiter: açar başına `ms` müddətində ən çox `max` sorğu
const limiter = (max, ms, msg) => {
  const hits = new Map();
  const recent = (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < ms);
    if (arr.length) hits.set(key, arr); else hits.delete(key);
    return arr;
  };
  const check = (key) => { if (recent(key).length >= max) throw bad(msg, 429); };
  const add = (key) => {
    const arr = recent(key); arr.push(Date.now()); hits.set(key, arr);
    if (hits.size > 5000) for (const k of [...hits.keys()]) recent(k);
  };
  return { check, add, clear: (key) => hits.delete(key), hit: (key) => { check(key); add(key); } };
};
// giriş: yalnız UĞURSUZ cəhdlər sayılır (10 / 10 dəq.), uğurlu girişdə sayğac sıfırlanır
const loginGuard = limiter(10, 10 * 60 * 1000, 'Çox yanlış cəhd edilib. 10 dəqiqədən sonra yenidən yoxlayın');
const msgThrottle = limiter(20, 60 * 1000, 'Çox tez-tez mesaj göndərirsiniz. Bir az gözləyin');

// URL-dəki id düzgün deyilsə 500 yox, 404 qaytar
for (const p of ['id', 'userId', 'pdfId']) {
  app.param(p, (req, res, next, v) => (mongoose.isValidObjectId(v) ? next() : res.status(404).json({ message: 'Tapılmadı' })));
}

// ---------- DIAQNOSTİKA ----------
// Brauzerdə /api/health açın: sayt HANSI bazaya baxır və Süper Admin orada varmı (şifrə/açar göstərilmir)
app.get('/api/health', wrap(async (req, res) => {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const sa = email ? await User.findOne({ email }).select('role').lean() : null;
  res.json({ ok: true, db: mongoose.connection.name, cluster: mongoose.connection.host, superadminEmailConfigured: !!email, superadminExists: !!sa, role: sa?.role || null });
}));

// ---------- AUTH ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password, pin } = req.body;
  if (!name || !email || !password || password.length < 6) throw bad('Bütün sahələri doldurun (şifrə min. 6 simvol)');
  if (!PIN_RE.test(pin || '')) throw bad('PIN kod 4-6 rəqəmdən ibarət olmalıdır');
  if (await User.findOne({ email: email.toLowerCase() })) throw bad('Bu e-poçt artıq qeydiyyatdan keçib');
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const user = await User.create({ name, firstName, lastName: rest.join(' '), email, password: await bcrypt.hash(password, 10), pin: await bcrypt.hash(pin, 10) });
  res.json({ token: sign(user), user: pub(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const key = req.ip + '|' + email;
  loginGuard.check(key);
  const user = await User.findOne({ email });
  const ok = !!user && (await bcrypt.compare(String(req.body.password || ''), user.password));
  if (!ok) {
    loginGuard.add(key);
    console.warn(`[giriş] uğursuz (baza: ${mongoose.connection.name}): ${email} — ${user ? 'şifrə uyğun gəlmir' : 'bu e-poçtla istifadəçi bazada yoxdur'}`); // şifrə yazılmır
    throw bad('E-poçt və ya şifrə yanlışdır');
  }
  loginGuard.clear(key);
  res.json({ token: sign(user), user: pub(user) });
}));

// PIN ilə şifrə bərpası (5 uğursuz cəhddən sonra 15 dəq. bloklanır)
app.post('/api/auth/reset-password', wrap(async (req, res) => {
  const { email, pin, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw bad('Yeni şifrə min. 6 simvol olmalıdır');
  const u = await User.findOne({ email: (email || '').toLowerCase() });
  if (!u || !u.pin) throw bad('E-poçt və ya PIN yanlışdır');
  if (u.lockUntil && u.lockUntil > new Date()) throw bad('Çox cəhd edilib. 15 dəqiqədən sonra yenidən yoxlayın', 429);
  if (!(await bcrypt.compare(String(pin || ''), u.pin))) {
    u.pinAttempts += 1;
    if (u.pinAttempts >= 5) { u.lockUntil = new Date(Date.now() + 15 * 60 * 1000); u.pinAttempts = 0; }
    await u.save();
    throw bad('E-poçt və ya PIN yanlışdır');
  }
  u.password = await bcrypt.hash(newPassword, 10);
  u.pinAttempts = 0; u.lockUntil = undefined;
  await u.save();
  res.json({ ok: true });
}));

app.get('/api/auth/me', auth, wrap(async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!u) throw bad('Giriş tələb olunur', 401);
  res.json(pub(u));
}));

// ---------- PRODUCTS ----------
app.get('/api/products', wrap(async (req, res) => {
  const { q, volume, season, gender, best } = req.query;
  const f = {};
  if (q) f.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (volume) f.volume = { $in: volume.split(',').map(Number) };
  if (season) f.season = season;
  if (gender) f.gender = gender;
  if (req.query.ids) f._id = { $in: req.query.ids.split(',').filter((x) => mongoose.isValidObjectId(x)) };
  let query = Product.find(f);
  if (best) query = query.sort({ sold: -1 }).limit(8);
  res.json(await query);
}));
app.get('/api/products/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw bad('Məhsul tapılmadı', 404);
  const p = await Product.findById(req.params.id);
  if (!p) throw bad('Məhsul tapılmadı', 404);
  res.json(p);
}));
const pickProduct = (b) => {
  const o = {};
  for (const k of ['name', 'brand', 'season', 'gender', 'description', 'color', 'image']) if (b[k] !== undefined) o[k] = b[k];
  for (const k of ['price', 'volume', 'stock']) if (b[k] !== undefined) o[k] = Number(b[k]);
  if (o.price !== undefined && !(o.price > 0)) throw bad('Qiymət düzgün deyil');
  if (o.volume !== undefined && !VOLUMES.includes(o.volume)) throw bad('Həcm düzgün deyil (' + VOLUMES.join(', ') + ' ml)');
  if (o.image) o.image = cleanImg(o.image);
  if (b.discount !== undefined) {
    const d = Number(b.discount) || 0;
    if (d < 0 || d > 90) throw bad('Endirim 0-90% arasında olmalıdır');
    o.discount = d;
  }
  if (b.notes) o.notes = { top: b.notes.top, middle: b.notes.middle, base: b.notes.base };
  return o;
};
app.post('/api/products', auth, admin, wrap(async (req, res) => res.json(await Product.create(pickProduct(req.body)))));
app.put('/api/products/:id', auth, admin, wrap(async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, pickProduct(req.body), { new: true, runValidators: true });
  if (!p) throw bad('Məhsul tapılmadı', 404);
  res.json(p);
}));
app.delete('/api/products/:id', auth, admin, wrap(async (req, res) => { await Product.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// ---------- PROMO ----------
async function applyPromo(code, subtotal) {
  if (!code) return { discount: 0 };
  const p = await Promo.findOne({ code: String(code).toUpperCase().trim(), active: true });
  if (!p) throw bad('Promokod yanlışdır');
  if (p.expiresAt && p.expiresAt < new Date()) throw bad('Promokodun müddəti bitib');
  if (p.usageLimit && p.used >= p.usageLimit) throw bad('Promokodun istifadə limiti bitib');
  if (subtotal < p.minOrder) throw bad(`Bu promokod minimum ${p.minOrder} ₼ sifariş üçündür`);
  const d = p.type === 'percent' ? (subtotal * p.value) / 100 : p.value;
  return { discount: Math.min(+d.toFixed(2), subtotal), promo: p };
}
app.post('/api/promos/validate', wrap(async (req, res) => {
  const { discount, promo } = await applyPromo(req.body.code, +req.body.subtotal || 0);
  res.json({ code: promo.code, discount, type: promo.type, value: promo.value });
}));
app.get('/api/promos', auth, admin, wrap(async (req, res) => res.json(await Promo.find().sort('-createdAt'))));
app.post('/api/promos', auth, admin, wrap(async (req, res) => {
  const b = req.body, type = b.type === 'fixed' ? 'fixed' : 'percent';
  if (!String(b.code || '').trim() || !(+b.value > 0)) throw bad('Kod və dəyər vacibdir');
  if (type === 'percent' && +b.value > 100) throw bad('Faiz 100-dən çox ola bilməz');
  try { res.json(await Promo.create({ code: b.code, type, value: +b.value, minOrder: Math.max(0, +b.minOrder || 0), usageLimit: Math.max(0, parseInt(b.usageLimit) || 0), expiresAt: b.expiresAt || undefined })); }
  catch (e) { throw bad(e.code === 11000 ? 'Bu promokod artıq mövcuddur' : e.message); }
}));
app.put('/api/promos/:id', auth, admin, wrap(async (req, res) => res.json(await Promo.findByIdAndUpdate(req.params.id, { active: req.body.active }, { new: true }))));
app.delete('/api/promos/:id', auth, admin, wrap(async (req, res) => { await Promo.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// ---------- SETTINGS (footer + WhatsApp) ----------
const getSettings = () => Setting.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true, new: true });
app.get('/api/settings', wrap(async (req, res) => res.json(await getSettings())));
app.put('/api/settings', auth, admin, wrap(async (req, res) => {
  const b = req.body, upd = {};
  for (const k of ['footerText', 'address', 'phone', 'email', 'instagram']) if (typeof b[k] === 'string') upd[k] = b[k].trim();
  if (upd.instagram) upd.instagram = cleanUrl(upd.instagram);
  if (b.whatsapp !== undefined) upd.whatsapp = String(b.whatsapp || '').replace(/\D/g, '');
  res.json(await Setting.findOneAndUpdate({ key: 'main' }, upd, { upsert: true, new: true }));
}));

// ---------- ORDERS ----------
app.post('/api/orders', auth, wrap(async (req, res) => {
  const { items, customer = {}, promoCode } = req.body;
  const { firstName, lastName, phone, address } = customer;
  if (!Array.isArray(items) || !items.length) throw bad('Səbət boşdur');
  if (!firstName || !lastName || !phone || !address) throw bad('Ad, soyad, telefon və ünvan vacibdir');
  // eyni məhsul bir neçə dəfə gəlibsə say toplanır
  const want = new Map();
  for (const it of items) {
    if (!mongoose.isValidObjectId(it?.product)) throw bad('Səbətdə yanlış məhsul var');
    want.set(String(it.product), (want.get(String(it.product)) || 0) + Math.max(1, parseInt(it.qty) || 1));
  }
  const lines = []; let subtotal = 0;
  for (const [id, qty] of want) {
    const p = await Product.findById(id);
    if (!p || p.stock < qty) throw bad(`${p?.name || 'Məhsul'} stokda yoxdur`);
    lines.push({ product: p._id, name: p.name, price: p.salePrice, originalPrice: p.price, discount: p.discount || 0, qty, image: p.image, color: p.color, volume: p.volume });
    subtotal += p.salePrice * qty;
  }
  subtotal = +subtotal.toFixed(2);
  const { discount, promo } = await applyPromo(promoCode, subtotal);

  // stok və promokod sayı atomik rezerv olunur (eyni anda sifariş verənlər stoku mənfiyə salmasın); xəta olarsa geri qaytarılır
  const reserved = []; let promoTaken = false;
  let order;
  try {
    for (const l of lines) {
      const r = await Product.updateOne({ _id: l.product, stock: { $gte: l.qty } }, { $inc: { stock: -l.qty, sold: l.qty } });
      if (!r.modifiedCount) throw bad(`${l.name} stokda yoxdur`);
      reserved.push(l);
    }
    if (promo) {
      const limit = promo.usageLimit ? { $expr: { $lt: ['$used', '$usageLimit'] } } : {};
      const r = await Promo.updateOne({ _id: promo._id, ...limit }, { $inc: { used: 1 } });
      if (!r.modifiedCount) throw bad('Promokodun istifadə limiti bitib');
      promoTaken = true;
    }
    order = await Order.create({
      user: req.user.id, items: lines, subtotal, discount, promoCode: promo?.code,
      total: +(subtotal - discount).toFixed(2),
      customer: { firstName, lastName, phone, address, note: customer.note || '' },
    });
  } catch (e) {
    for (const l of reserved) await Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty, sold: -l.qty } }).catch(() => {});
    if (promoTaken) await Promo.updateOne({ _id: promo._id }, { $inc: { used: -1 } }).catch(() => {});
    throw e;
  }
  await notify(req.user.id, 'info', 'Sifarişiniz qəbul olundu', `Sifariş ${orderNo(order)} qəbul edildi. Cəmi: ${order.total.toFixed(2)} ₼`, order._id);
  res.json(order);
}));
const CANCEL_MS = 5 * 60 * 1000;
const cancelLeft = (o) => (o.status === 'Hazırlanır' ? Math.max(0, new Date(o.createdAt).getTime() + CANCEL_MS - Date.now()) : 0);
app.get('/api/orders/mine', auth, wrap(async (req, res) => {
  const list = await Order.find({ user: req.user.id }).select('-pdfs.filename').sort('-createdAt');
  // qalan vaxt serverin saatı ilə hesablanır (müştərinin saatından asılı deyil)
  res.json(list.map((o) => ({ ...o.toObject(), cancelMs: cancelLeft(o) })));
}));

// Sifarişi yaradıldığı andan 5 dəqiqə ərzində ləğv et (yalnız sahibi, yalnız "Hazırlanır")
app.post('/api/orders/:id/cancel', auth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw bad('Sifariş tapılmadı', 404);
  // atomik: status və vaxt şərti eyni sorğuda yoxlanılır → ikiqat ləğv / yarış vəziyyəti olmur
  const o = await Order.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id, status: 'Hazırlanır', createdAt: { $gte: new Date(Date.now() - CANCEL_MS) } },
    { status: 'Ləğv edilib', cancelledAt: new Date() }, { new: true });
  if (!o) {
    const ex = await Order.findOne({ _id: req.params.id, user: req.user.id });
    if (!ex) throw bad('Sifariş tapılmadı', 404);
    if (ex.status === 'Ləğv edilib') throw bad('Sifariş artıq ləğv edilib');
    if (ex.status !== 'Hazırlanır') throw bad('Sifariş artıq işlənir, ləğv etmək mümkün deyil');
    throw bad('Ləğv müddəti (5 dəqiqə) bitib');
  }
  for (const i of o.items) if (i.product) await Product.findByIdAndUpdate(i.product, { $inc: { stock: i.qty, sold: -i.qty } });
  if (o.promoCode) await Promo.updateOne({ code: o.promoCode, used: { $gt: 0 } }, { $inc: { used: -1 } });
  await notify(o.user, 'info', 'Sifariş ləğv edildi', `Sifariş ${orderNo(o)} ləğv olundu.`, o._id);
  res.json({ ...o.toObject(), cancelMs: 0 });
}));
app.get('/api/orders', auth, admin, wrap(async (req, res) => res.json(await Order.find().populate('user', 'name email').populate('items.product', 'image color name').select('-pdfs.filename').sort('-createdAt'))));
app.put('/api/orders/:id', auth, admin, wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw bad('Sifariş tapılmadı', 404);
  if (o.status === 'Ləğv edilib') throw bad('Ləğv edilmiş sifarişin statusu dəyişdirilə bilməz');
  if (!['Hazırlanır', 'Çatdırılmaya verilib', 'Çatdırılıb'].includes(req.body.status)) throw bad('Yanlış status');
  if (o.status !== req.body.status) {
    o.status = req.body.status;
    await o.save();
    await notify(o.user, 'status', 'Sifariş statusu dəyişdi', `Sifariş ${orderNo(o)} statusu: ${o.status}`, o._id);
  }
  res.json(o);
}));

// ---- Sifariş məlumatlarının avtomatik PDF-i (admin və sifarişin sahibi)
app.get('/api/orders/:id/invoice', auth, wrap(async (req, res) => {
  const o = await Order.findById(req.params.id).populate('items.product', 'image color');
  if (!o || (String(o.user) !== req.user.id && !isAdmin(req.user.role))) throw bad('Tapılmadı', 404);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sifaris-${String(o._id).slice(-6).toUpperCase()}.pdf"`);
  await streamInvoice(o, res);
}));

// ---- Sifarişə PDF (admin yükləyir, müştəri baxır/yükləyir)
app.post('/api/orders/:id/pdfs', auth, admin, wrap(async (req, res) => {
  await receivePdf(req, res);
  if (!req.file) throw bad('PDF fayl seçilməyib');
  const o = await Order.findById(req.params.id);
  if (!o || !isRealPdf(req.file.path)) {
    fs.unlink(req.file.path, () => {});
    throw bad(!o ? 'Sifariş tapılmadı' : 'Fayl düzgün PDF deyil');
  }
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  o.pdfs.push({ originalName, filename: req.file.filename, note: (req.body.note || '').slice(0, 200) });
  await o.save();
  await notify(o.user, 'pdf', 'Sifarişinizə yeni sənəd əlavə olundu', `${orderNo(o)} üçün "${originalName}" faylı yükləndi.${req.body.note ? ' Qeyd: ' + req.body.note : ''}`, o._id);
  res.json({ ok: true });
}));
app.get('/api/orders/:id/pdfs/:pdfId', auth, wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o || (String(o.user) !== req.user.id && !isAdmin(req.user.role))) throw bad('Tapılmadı', 404);
  const f = o.pdfs.id(req.params.pdfId);
  if (!f) throw bad('Fayl tapılmadı', 404);
  const full = path.join(UPLOAD_DIR, path.basename(f.filename));
  if (!fs.existsSync(full)) throw bad('Fayl serverdə yoxdur', 404);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.originalName || 'sened.pdf')}`);
  fs.createReadStream(full).pipe(res);
}));
app.delete('/api/orders/:id/pdfs/:pdfId', auth, admin, wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  const f = o?.pdfs.id(req.params.pdfId);
  if (!f) throw bad('Fayl tapılmadı', 404);
  fs.unlink(path.join(UPLOAD_DIR, path.basename(f.filename)), () => {});
  f.deleteOne();
  await o.save();
  res.json({ ok: true });
}));

// ---------- PROFILE ----------
const full = (u) => ({
  ...pub(u), firstName: u.firstName || u.name.split(' ')[0], lastName: u.lastName ?? u.name.split(' ').slice(1).join(' '),
  phone: u.phone || '', address: u.address || '', createdAt: u.createdAt,
});
app.get('/api/profile', auth, wrap(async (req, res) => res.json(full(await User.findById(req.user.id)))));
app.put('/api/profile', auth, wrap(async (req, res) => {
  const { firstName, lastName, phone, address } = req.body;
  if (!firstName?.trim()) throw bad('Ad vacibdir');
  const u = await User.findByIdAndUpdate(req.user.id,
    { firstName: firstName.trim(), lastName: (lastName || '').trim(), name: `${firstName.trim()} ${(lastName || '').trim()}`.trim(), phone: phone || '', address: address || '' }, { new: true });
  res.json(full(u));
}));
app.put('/api/profile/password', auth, wrap(async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!(await bcrypt.compare(req.body.oldPassword || '', u.password))) throw bad('Köhnə şifrə yanlışdır');
  if (!req.body.newPassword || req.body.newPassword.length < 6) throw bad('Yeni şifrə min. 6 simvol olmalıdır');
  u.password = await bcrypt.hash(req.body.newPassword, 10);
  await u.save();
  res.json({ ok: true });
}));

// ---------- NOTIFICATIONS ----------
app.get('/api/notifications', auth, wrap(async (req, res) => {
  const items = await Notification.find({ user: req.user.id }).sort('-createdAt').limit(100);
  res.json({ items, unread: items.filter((n) => !n.read).length });
}));
app.put('/api/notifications/read-all', auth, wrap(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ ok: true });
}));
app.put('/api/notifications/:id', auth, wrap(async (req, res) =>
  res.json(await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { read: !!req.body.read }, { new: true }))));
app.delete('/api/notifications/:id', auth, wrap(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, user: req.user.id });
  res.json({ ok: true });
}));

// ---------- ADMINS (yalnız Süper Admin) ----------
app.get('/api/admins', auth, admin, superOnly, wrap(async (req, res) =>
  res.json(await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('-password -pin').sort('createdAt'))));
app.post('/api/admins', auth, admin, superOnly, wrap(async (req, res) => {
  const { name, email, password, pin } = req.body;
  if (!name || !email || !password || password.length < 6) throw bad('Ad, e-poçt və şifrə (min. 6) vacibdir');
  if (!PIN_RE.test(pin || '')) throw bad('PIN kod 4-6 rəqəm olmalıdır');
  if (await User.findOne({ email: email.toLowerCase() })) throw bad('Bu e-poçt artıq mövcuddur');
  const u = await User.create({ name, email, role: 'admin', password: await bcrypt.hash(password, 10), pin: await bcrypt.hash(pin, 10) });
  res.json(pub(u));
}));
app.delete('/api/admins/:id', auth, admin, superOnly, wrap(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw bad('Tapılmadı', 404);
  if (u.role === 'superadmin') throw bad('Süper Admini silmək olmaz');
  await u.deleteOne();
  res.json({ ok: true });
}));

// ---------- ŞƏKİL YÜKLƏMƏ (admin) ----------
app.post('/api/uploads/image', auth, admin, wrap(async (req, res) => {
  await receiveImage(req, res);
  if (!req.file) throw bad('Şəkil seçilməyib');
  if (!isRealImage(req.file.path)) { fs.unlink(req.file.path, () => {}); throw bad('Fayl düzgün şəkil deyil'); }
  res.json({ url: '/uploads/img/' + req.file.filename });
}));
const dropImg = (url) => { if (/^\/uploads\/img\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(url || '')) fs.unlink(path.join(IMG_DIR, path.basename(url)), () => {}); };

// ---------- DƏSTƏK (müştəri ↔ admin yazışması, polling ilə) ----------
const pubMsg = (m) => ({ _id: m._id, from: m.from, adminName: m.adminName, text: m.text, createdAt: m.createdAt });
const cleanText = (t) => {
  const x = String(t || '').trim();
  if (!x) throw bad('Mesaj boşdur');
  if (x.length > 2000) throw bad('Mesaj çox uzundur (maks. 2000 simvol)');
  return x;
};
app.get('/api/support/messages', auth, wrap(async (req, res) => {
  const f = { user: req.user.id };
  if (req.query.after && !isNaN(new Date(req.query.after))) f.createdAt = { $gt: new Date(req.query.after) };
  const list = await Message.find(f).sort('createdAt').limit(500);
  if (list.some((m) => m.from === 'admin' && !m.readByUser)) await Message.updateMany({ user: req.user.id, from: 'admin', readByUser: false }, { readByUser: true });
  res.json(list.map(pubMsg));
}));
app.get('/api/support/unread', auth, wrap(async (req, res) => res.json({ unread: await Message.countDocuments({ user: req.user.id, from: 'admin', readByUser: false }) })));
app.post('/api/support/messages', auth, wrap(async (req, res) => {
  msgThrottle.hit(req.user.id);
  const m = await Message.create({ user: req.user.id, from: 'user', text: cleanText(req.body.text), readByUser: true });
  res.json(pubMsg(m));
}));

// admin tərəfi
app.get('/api/admin/support', auth, admin, wrap(async (req, res) => {
  const rows = await Message.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$user', last: { $first: '$$ROOT' }, unread: { $sum: { $cond: [{ $and: [{ $eq: ['$from', 'user'] }, { $eq: ['$readByAdmin', false] }] }, 1, 0] } } } },
    { $sort: { 'last.createdAt': -1 } }, { $limit: 200 },
  ]);
  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('name email');
  const um = new Map(users.map((u) => [String(u._id), u]));
  res.json(rows.map((r) => ({ user: { id: r._id, name: um.get(String(r._id))?.name || 'Silinmiş istifadəçi', email: um.get(String(r._id))?.email || '' }, lastText: r.last.text, lastFrom: r.last.from, lastAt: r.last.createdAt, unread: r.unread })));
}));
app.get('/api/admin/support/unread', auth, admin, wrap(async (req, res) => res.json({ unread: await Message.countDocuments({ from: 'user', readByAdmin: false }) })));
app.get('/api/admin/support/:userId', auth, admin, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) throw bad('Tapılmadı', 404);
  const f = { user: req.params.userId };
  if (req.query.after && !isNaN(new Date(req.query.after))) f.createdAt = { $gt: new Date(req.query.after) };
  const list = await Message.find(f).sort('createdAt').limit(500);
  await Message.updateMany({ user: req.params.userId, from: 'user', readByAdmin: false }, { readByAdmin: true });
  res.json(list.map(pubMsg));
}));
app.post('/api/admin/support/:userId', auth, admin, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId) || !(await User.exists({ _id: req.params.userId }))) throw bad('İstifadəçi tapılmadı', 404);
  const me = await User.findById(req.user.id).select('name');
  const m = await Message.create({ user: req.params.userId, from: 'admin', admin: req.user.id, adminName: me?.name || 'Dəstək', text: cleanText(req.body.text), readByAdmin: true });
  res.json(pubMsg(m));
}));

// ---------- XƏBƏRLƏR / BLOQ ----------
const pickPost = (b) => {
  const title = String(b.title || '').trim(), content = String(b.content || '').trim();
  if (!title || !content) throw bad('Başlıq və mətn vacibdir');
  return { title, content, summary: String(b.summary || '').trim().slice(0, 400), image: cleanImg(b.image), published: b.published !== false };
};
app.get('/api/posts', wrap(async (req, res) => res.json(await Post.find({ published: true }).select('-content').sort('-createdAt').limit(100))));
app.get('/api/posts/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw bad('Xəbər tapılmadı', 404);
  const p = await Post.findOne({ _id: req.params.id, published: true });
  if (!p) throw bad('Xəbər tapılmadı', 404);
  res.json(p);
}));
app.get('/api/admin/posts', auth, admin, wrap(async (req, res) => res.json(await Post.find().sort('-createdAt'))));
app.post('/api/admin/posts', auth, admin, wrap(async (req, res) => {
  const me = await User.findById(req.user.id).select('name');
  res.json(await Post.create({ ...pickPost(req.body), author: me?.name }));
}));
app.put('/api/admin/posts/:id', auth, admin, wrap(async (req, res) => {
  const old = await Post.findById(req.params.id);
  if (!old) throw bad('Xəbər tapılmadı', 404);
  const data = pickPost(req.body);
  if (old.image && old.image !== data.image) dropImg(old.image);
  res.json(await Post.findByIdAndUpdate(req.params.id, data, { new: true }));
}));
app.delete('/api/admin/posts/:id', auth, admin, wrap(async (req, res) => {
  const p = await Post.findByIdAndDelete(req.params.id);
  if (p) dropImg(p.image);
  res.json({ ok: true });
}));

// ---------- FİLİALLAR ----------
const pickBranch = (b) => {
  const name = String(b.name || '').trim();
  if (!name) throw bad('Filial adı vacibdir');
  const num = (v, min, max, label) => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw bad(label + ' düzgün deyil');
    return n;
  };
  const lat = num(b.lat, -90, 90, 'Enlik (lat)'), lng = num(b.lng, -180, 180, 'Uzunluq (lng)');
  if ((lat === undefined) !== (lng === undefined)) throw bad('Koordinat üçün həm enlik, həm uzunluq daxil edin');
  return { name, image: cleanImg(b.image), hours: String(b.hours || '').trim(), address: String(b.address || '').trim(), phone: String(b.phone || '').trim(), mapUrl: cleanUrl(b.mapUrl), lat, lng };
};
app.get('/api/branches', wrap(async (req, res) => res.json(await Branch.find().sort('createdAt'))));
app.post('/api/branches', auth, admin, wrap(async (req, res) => res.json(await Branch.create(pickBranch(req.body)))));
app.put('/api/branches/:id', auth, admin, wrap(async (req, res) => {
  const old = await Branch.findById(req.params.id);
  if (!old) throw bad('Filial tapılmadı', 404);
  const data = pickBranch(req.body);
  if (old.image && old.image !== data.image) dropImg(old.image);
  // koordinat silinibsə $unset et
  const upd = { $set: { ...data }, $unset: {} };
  for (const k of ['lat', 'lng']) if (data[k] === undefined) { delete upd.$set[k]; upd.$unset[k] = 1; }
  res.json(await Branch.findByIdAndUpdate(req.params.id, upd, { new: true }));
}));
app.delete('/api/branches/:id', auth, admin, wrap(async (req, res) => {
  const b = await Branch.findByIdAndDelete(req.params.id);
  if (b) dropImg(b.image);
  res.json({ ok: true });
}));

// ---------- STATS ----------
app.get('/api/admin/stats', auth, admin, wrap(async (req, res) => {
  const orders = await Order.find({ status: { $ne: 'Ləğv edilib' } }).sort('createdAt');
  const products = await Product.find().select('name');
  const map = new Map(products.map((x) => [String(x._id), { id: String(x._id), name: x.name, orders: 0, qty: 0 }]));
  for (const o of orders) {
    const seen = new Set();
    for (const i of o.items) {
      const r = map.get(String(i.product));
      if (!r) continue; // silinmiş məhsul
      r.qty += i.qty;
      if (!seen.has(r.id)) { r.orders += 1; seen.add(r.id); }
    }
  }
  const all = [...map.values()];
  const desc = [...all].sort((a, b) => b.orders - a.orders || b.qty - a.qty);
  const asc = [...all].sort((a, b) => a.orders - b.orders || a.qty - b.qty);
  res.json({
    totalSales: +orders.reduce((s, o) => s + o.total, 0).toFixed(2),
    activeOrders: orders.filter((o) => o.status !== 'Çatdırılıb').length,
    customers: await User.countDocuments({ role: 'user' }),
    lowStock: await Product.countDocuments({ stock: { $lte: 5 } }),
    totalProducts: all.length,
    chart: orders.slice(-12).map((o) => o.total),
    top: desc.filter((r) => r.orders > 0).slice(0, 5),
    least: asc.slice(0, 5),
  });
}));

// ---------- 404 / XƏTA İDARƏÇİSİ ----------
app.use('/api', (req, res) => res.status(404).json({ message: 'Tapılmadı' }));

// --- React (Vite) build-i eyni servisdən göstər ---
const CLIENT_DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, {
    index: false,
    setHeaders: (res, file) => {
      // index.html həmişə təzə yoxlanılır; hash-li /assets faylları uzun müddət keşlənir
      res.setHeader('Cache-Control', file.includes(path.sep + 'assets' + path.sep) ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(CLIENT_DIST, 'index.html')); });
}

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Göndərilən JSON düzgün deyil' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Göndərilən məlumat çox böyükdür' });
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({ message: err.status && err.status < 500 ? err.message : 'Server xətası' });
});

export default app;
