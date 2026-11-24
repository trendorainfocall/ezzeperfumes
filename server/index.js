import './env.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from './app.js';
import { User } from './models.js';

const missing = ['MONGO_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error('❌ server/.env faylında bu dəyişənlər yoxdur:', missing.join(', '));
  process.exit(1);
}
if (process.env.JWT_SECRET === 'change_me') console.warn('⚠️  JWT_SECRET hələ "change_me"-dir — uzun təsadüfi dəyərlə əvəz edin.');

// Server hər başlayanda (yerli və Render-də) .env / Environment-dəki Süper Admin məlumatlarını bazaya tətbiq edir:
// hesab yoxdursa yaradır, şifrə/PIN fərqlidirsə yeniləyir. Beləliklə saytın baxdığı baza hansı olursa olsun, giriş işləyir.
// Söndürmək üçün: SYNC_SUPERADMIN=off
async function syncSuperadmin() {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const { SUPERADMIN_PASSWORD: password, SUPERADMIN_PIN: pin } = process.env;
  if (process.env.SYNC_SUPERADMIN === 'off') return;
  if (!email || !password) return console.warn('⚠️  SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD təyin olunmayıb — Süper Admin avtomatik yoxlanmadı (Render-də Environment bölməsinə əlavə edin)');
  if (password.length < 8) return console.warn('⚠️  SUPERADMIN_PASSWORD ən azı 8 simvol olmalıdır — avtomatik yoxlama ötürüldü');
  try {
    const u = await User.findOne({ email });
    if (!u) {
      await User.create({ name: 'Süleyman Kengerli', email, role: 'superadmin', password: await bcrypt.hash(password, 10), pin: await bcrypt.hash(/^\d{4,6}$/.test(pin || '') ? pin : '123456', 10) });
      return console.log('✅ Süper Admin bazada yox idi, yaradıldı:', email);
    }
    const set = {};
    if (u.role !== 'superadmin') set.role = 'superadmin';
    if (!(await bcrypt.compare(password, u.password))) set.password = await bcrypt.hash(password, 10);
    if (/^\d{4,6}$/.test(pin || '') && !(u.pin && (await bcrypt.compare(pin, u.pin)))) set.pin = await bcrypt.hash(pin, 10);
    if (Object.keys(set).length) { await User.updateOne({ _id: u._id }, { $set: set, $unset: { lockUntil: 1 } }); console.log('✅ Süper Admin yeniləndi (' + Object.keys(set).join(', ') + '):', email); }
    else console.log('✅ Süper Admin hazırdır:', email);
  } catch (e) { console.error('⚠️  Süper Admin yoxlanmadı:', e.message); }
}

const PORT = process.env.PORT || 5000;
try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ MongoDB bağlandı: ${mongoose.connection.host}/${mongoose.connection.name}`);
  await syncSuperadmin();
  app.listen(PORT, () => console.log('🚀 Server: http://localhost:' + PORT));
} catch (e) {
  console.error('❌ MongoDB xətası:', e.message);
  process.exit(1);
}
