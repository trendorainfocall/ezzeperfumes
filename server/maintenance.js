// Baza təmizliyi və yenilənməsi.
//   npm run db:clean                  → köhnə/korlanmış məlumatları düzəlt, yetim qeydləri sil
//   npm run db:clean -- --dry         → heç nə dəyişmədən nəyin ediləcəyini göstər
//   npm run db:clean -- --files       → əlavə olaraq heç yerdə istifadə olunmayan yüklənmiş faylları sil
//   npm run db:superadmin -- --check  → heç nə dəyişmədən .env şifrəsinin bazadakı ilə uyğun olub-olmadığını yoxla
//   npm run db:superadmin             → .env-dəki SUPERADMIN_EMAIL/PASSWORD/PIN dəyərlərini bazadakı Süper Admin-ə yazır (yoxdursa yaradır)
//   npm run db:reset                  → məhsul/sifariş/promokod/bildiriş/mesaj/xəbər/filial və yüklənmiş faylları sil, sonra seed et
//                                       (istifadəçilər və adminlər QALIR; təsdiq üçün RESET yazılır, --yes ilə soruşmur)
import './env.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Product, Order, Promo, Setting, Notification, Message, Post, Branch, VOLUMES } from './models.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.join(DIR, 'uploads');
const IMGS = path.join(UPLOADS, 'img');
const PDF_RE = /^[a-f0-9]{32}\.pdf$/, IMG_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const [cmd, ...flags] = process.argv.slice(2);
const has = (f) => flags.includes(f);
const dry = has('--dry');
const log = (m) => console.log((dry ? '[sınaq] ' : '') + m);

const nearest = (v) => VOLUMES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), VOLUMES[0]);
const listFiles = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f)) : []);

async function clean() {
  // 1) köhnə / yanlış məhsul sahələrini düzəlt
  let fixed = 0;
  for (const p of await Product.find().select('volume gender discount stock').lean()) {
    const fix = {};
    if (!VOLUMES.includes(p.volume)) fix.volume = nearest(Number(p.volume) || 50);
    if (!['Kişi', 'Qadın', 'Unisex'].includes(p.gender)) fix.gender = 'Unisex';
    if (typeof p.discount !== 'number' || p.discount < 0 || p.discount > 90) fix.discount = Math.min(90, Math.max(0, Number(p.discount) || 0));
    if (typeof p.stock !== 'number' || p.stock < 0) fix.stock = Math.max(0, Number(p.stock) || 0);
    if (!Object.keys(fix).length) continue;
    fixed++; log(`Məhsul ${p._id} düzəldilir: ${JSON.stringify(fix)}`);
    if (!dry) await Product.updateOne({ _id: p._id }, { $set: fix });
  }
  log(`Düzəldilən məhsul: ${fixed}`);

  // 2) sahibi silinmiş bildiriş və mesajlar
  const userIds = (await User.find().select('_id').lean()).map((u) => u._id);
  if (userIds.length) {
    const q = { user: { $nin: userIds } };
    log(`Sahibi silinmiş bildiriş: ${await Notification.countDocuments(q)}, mesaj: ${await Message.countDocuments(q)}`);
    if (!dry) { await Notification.deleteMany(q); await Message.deleteMany(q); }
  }

  // 3) 180 gündən köhnə oxunmuş bildirişlər
  const oldQ = { read: true, createdAt: { $lt: new Date(Date.now() - 180 * 864e5) } };
  log(`180 gündən köhnə oxunmuş bildiriş: ${await Notification.countDocuments(oldQ)}`);
  if (!dry) await Notification.deleteMany(oldQ);

  // 4) vaxtı bitmiş PIN blokları
  const lockQ = { lockUntil: { $lt: new Date() } };
  log(`Vaxtı bitmiş PIN bloku: ${await User.countDocuments(lockQ)}`);
  if (!dry) await User.updateMany(lockQ, { $set: { pinAttempts: 0 }, $unset: { lockUntil: 1 } });

  // 5) heç bir qeyddən istifadə olunmayan fayllar (yalnız --files ilə silinir; son 1 saatda yüklənənlərə toxunulmur)
  const refs = new Set();
  const ref = (u) => u && refs.add(path.basename(String(u)));
  for (const M of [Product, Post, Branch]) for (const x of await M.find().select('image').lean()) ref(x.image);
  for (const o of await Order.find().select('items.image pdfs.filename').lean()) { (o.items || []).forEach((i) => ref(i.image)); (o.pdfs || []).forEach((f) => ref(f.filename)); }
  const orphans = [...listFiles(UPLOADS, PDF_RE), ...listFiles(IMGS, IMG_RE)]
    .filter((f) => !refs.has(path.basename(f)) && fs.statSync(f).mtimeMs < Date.now() - 36e5);
  log(`İstifadə olunmayan fayl: ${orphans.length}${orphans.length && !has('--files') ? ' (silmək üçün --files əlavə edin)' : ''}`);
  if (has('--files') && !dry) for (const f of orphans) fs.unlinkSync(f);
  console.log('✅ Təmizlik bitdi');
}

async function superadmin() {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const { SUPERADMIN_PASSWORD: password, SUPERADMIN_PIN: pin } = process.env;
  if (!email) throw new Error('server/.env faylında SUPERADMIN_EMAIL yoxdur');
  if (!password || password.length < 8) throw new Error('SUPERADMIN_PASSWORD ən azı 8 simvol olmalıdır');
  if (!/^\d{4,6}$/.test(pin || '')) throw new Error('SUPERADMIN_PIN 4-6 rəqəm olmalıdır');
  console.log(`Baza: ${mongoose.connection.host}/${mongoose.connection.name} · .env şifrəsinin uzunluğu: ${password.length} · e-poçt: ${email}`);
  const find = async () => (await User.findOne({ email })) || (await User.findOne({ email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }));
  const verify = async () => {
    const x = await find();
    if (!x) return console.log('❌ Bazada bu e-poçtla istifadəçi yoxdur:', email);
    const okPw = await bcrypt.compare(password, x.password), okPin = x.pin ? await bcrypt.compare(pin, x.pin) : false;
    console.log(`Yoxlama → rol: ${x.role} · .env şifrəsi bazadakı ilə ${okPw ? 'UYĞUNDUR ✅' : 'UYĞUN DEYİL ❌'} · PIN ${okPin ? 'uyğundur ✅' : 'uyğun deyil ❌'}`);
  };
  if (has('--check')) return verify(); // heç nə dəyişmədən yalnız yoxla
  const set = { email, role: 'superadmin', password: await bcrypt.hash(password, 10), pin: await bcrypt.hash(pin, 10), pinAttempts: 0 };
  const u = await find();
  if (u) { await User.updateOne({ _id: u._id }, { $set: set, $unset: { lockUntil: 1 } }); console.log('✅ Süper Admin şifrəsi və PIN-i yeniləndi:', email); }
  else { await User.create({ name: 'Süleyman Kengerli', ...set }); console.log('✅ Süper Admin yaradıldı:', email); }
  await verify();
  const others = await User.find({ role: 'superadmin', email: { $ne: email } }).select('email').lean();
  if (others.length) console.warn('⚠️  Başqa Süper Admin hesabları da var (dəyişdirilmədi):', others.map((x) => x.email).join(', '));
}

async function reset() {
  if (!has('--yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const a = await rl.question('⚠️  Bütün məhsul, sifariş, promokod, bildiriş, mesaj, xəbər, filial və yüklənmiş fayllar SİLİNƏCƏK.\n   (istifadəçilər və adminlər qalır)\n   Davam etmək üçün RESET yazın: ');
    rl.close();
    if (a.trim() !== 'RESET') return console.log('Ləğv edildi, heç nə silinmədi.');
  }
  for (const M of [Product, Order, Promo, Notification, Message, Post, Branch, Setting]) await M.deleteMany({});
  for (const f of [...listFiles(UPLOADS, PDF_RE), ...listFiles(IMGS, IMG_RE)]) fs.unlinkSync(f);
  console.log('🧹 Köhnə məlumatlar silindi, seed işləyir...');
  execFileSync(process.execPath, [path.join(DIR, 'seed.js')], { stdio: 'inherit' });
}

if (!['clean', 'reset', 'superadmin'].includes(cmd)) {
  console.error('İstifadə: node maintenance.js clean [--dry] [--files]  |  node maintenance.js reset [--yes]  |  node maintenance.js superadmin');
  process.exit(1);
}
if (!process.env.MONGO_URI) { console.error('❌ server/.env faylında MONGO_URI yoxdur'); process.exit(1); }
await mongoose.connect(process.env.MONGO_URI);
try { await ({ clean, reset, superadmin }[cmd])(); }
finally { await mongoose.disconnect().catch(() => {}); }
