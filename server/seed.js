import './env.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Product, Setting } from './models.js';

if (!process.env.MONGO_URI) throw new Error('server/.env faylında MONGO_URI yoxdur');
if (!process.env.SUPERADMIN_PASSWORD) throw new Error('server/.env faylında SUPERADMIN_PASSWORD yoxdur');
await mongoose.connect(process.env.MONGO_URI);
const mk = (name, price, volume, season, gender, color, top, middle, base, sold) => ({
  name, price, volume, season, gender, color, sold, stock: 40, rating: 4.5,
  notes: { top, middle, base }, description: 'EZZE Platinum Edition kolleksiyasından lüks ətir.',
});
if ((await Product.countDocuments()) === 0)
  await Product.insertMany([
    mk('EZZE Noir', 125, 50, 'Payız', 'Kişi', '#2b1a0d', 'Bergamot, Zirə', 'Qara qızılgül', 'Oud, Ambra', 90),
    mk('EZZE Gold', 129, 50, 'Yay', 'Qadın', '#e3c26a', 'Sitrus, Zəncəfil', 'Yasəmən, Sandal', 'Vanil, Müşk', 120),
    mk('EZZE Amber', 129, 100, 'Qış', 'Unisex', '#a0522d', 'Darçın', 'Qızılgül, Ləçək', 'Ambra, Paçuli', 75),
    mk('EZZE Silver', 129, 30, 'Yaz', 'Kişi', '#9aa3ad', 'Nanə, Limon', 'Lavanda', 'Sidr, Müşk', 60),
    mk('EZZE Royal', 159, 100, 'Qış', 'Kişi', '#5a1f1f', 'Qara mövüz', 'Oud', 'Tütün, Vanil', 40),
    mk('EZZE Blanc', 99, 30, 'Yay', 'Qadın', '#efe6c8', 'Portağal çiçəyi', 'Zanbaq', 'Ağ müşk', 55),
  ]);
await Product.updateMany({ gender: { $exists: false } }, { gender: 'Unisex' }); // köhnə məhsullar üçün

await User.deleteOne({ email: 'admin@ezze.az', role: 'admin' }); // köhnə test admini
const email = (process.env.SUPERADMIN_EMAIL || 'suleyman@ezze.az').toLowerCase();
if (!(await User.findOne({ email }))) {
  await User.create({
    name: 'Süleyman Kengerli', email, role: 'superadmin',
    password: await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10),
    pin: await bcrypt.hash(process.env.SUPERADMIN_PIN || '123456', 10),
  });
  console.log('✅ Süper Admin yaradıldı:', email);
}
await Setting.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true });
console.log('✅ Seed hazırdır');
process.exit(0);
