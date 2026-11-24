import PDFDocument from 'pdfkit';
import dns from 'dns/promises';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
const DARK = '#1a1a1a', GREY = '#666', GOLD = '#b8902c';
const fmt = (n) => Number(n || 0).toFixed(2) + ' AZN';
const p2 = (n) => String(n).padStart(2, '0');
const dt = (d) => { const x = new Date(d); return `${p2(x.getDate())}.${p2(x.getMonth() + 1)}.${x.getFullYear()} ${p2(x.getHours())}:${p2(x.getMinutes())}`; };

// Daxili şəbəkə ünvanlarına sorğunu blokla (SSRF qorunması)
const blocked = new net.BlockList();
[['10.0.0.0', 8], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['0.0.0.0', 8], ['100.64.0.0', 10]]
  .forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv4'));
blocked.addSubnet('::1', 128, 'ipv6'); blocked.addSubnet('fc00::', 7, 'ipv6'); blocked.addSubnet('fe80::', 10, 'ipv6');

async function loadImage(src) {
  try {
    if (!src) return null;
    const m = /^data:image\/(png|jpeg);base64,(.+)$/i.exec(src);
    if (m) return Buffer.from(m[2], 'base64');
    const u = new URL(src);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    const { address, family } = await dns.lookup(u.hostname);
    if (blocked.check(address, family === 6 ? 'ipv6' : 'ipv4')) return null;
    const r = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(4000) });
    if (!r.ok || !/image\/(png|jpeg)/.test(r.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length <= 2 * 1024 * 1024 ? buf : null;
  } catch { return null; }
}

function bottle(doc, x, y, h, color) {
  const w = h * 0.66;
  doc.save();
  doc.rect(x + w * 0.36, y, w * 0.28, h * 0.16).fill('#d4af37');
  doc.rect(x + w * 0.43, y + h * 0.16, w * 0.14, h * 0.1).fill('#b8902c');
  doc.roundedRect(x, y + h * 0.26, w, h * 0.74, 4).fillAndStroke(color || '#d9b45a', '#b8902c');
  doc.restore();
}

export async function streamInvoice(order, res) {
  const imgs = await Promise.all(order.items.map((i) => loadImage(i.image || i.product?.image)));
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.registerFont('r', path.join(FONTS, 'DejaVuSans.ttf'));
  doc.registerFont('b', path.join(FONTS, 'DejaVuSans-Bold.ttf'));
  doc.pipe(res);
  const no = '#' + String(order._id).slice(-6).toUpperCase();

  // Başlıq
  doc.rect(0, 0, 595, 90).fill('#0b0b0c');
  doc.fillColor('#d4af37').font('b').fontSize(26).text('EZZE', 40, 22, { characterSpacing: 3 });
  doc.font('r').fontSize(9).text('PARFUMES · Platinum Edition', 40, 56, { characterSpacing: 3 });
  doc.fillColor('#f1ead8').font('b').fontSize(14).text('Sifariş ' + no, 300, 24, { width: 255, align: 'right' });
  doc.font('r').fontSize(9).text('Tarix: ' + dt(order.createdAt), 300, 46, { width: 255, align: 'right' });
  doc.text('Status: ' + order.status, 300, 60, { width: 255, align: 'right' });

  // Müştəri
  let y = 112;
  doc.fillColor(GOLD).font('b').fontSize(11).text('MÜŞTƏRİ MƏLUMATLARI', 40, y); y += 22;
  const c = order.customer || {};
  const rows = [['Ad, soyad', `${c.firstName || ''} ${c.lastName || ''}`.trim()], ['Əlaqə nömrəsi', c.phone], ['Ünvan', c.address]];
  if (c.note) rows.push(['Qeyd', c.note]);
  for (const [k, v] of rows) {
    doc.font('r').fontSize(9).fillColor(GREY).text(k, 40, y, { width: 120 });
    doc.font('b').fontSize(10).fillColor(DARK).text(v || '—', 165, y, { width: 390 });
    y = Math.max(y + 18, doc.y + 6);
  }

  // Məhsullar
  y += 10;
  doc.fillColor(GOLD).font('b').fontSize(11).text('SİFARİŞ EDİLƏN MƏHSULLAR', 40, y); y += 20;
  const head = () => {
    doc.rect(40, y, 515, 22).fill('#efe3bf');
    doc.fillColor(DARK).font('b').fontSize(9);
    doc.text('Məhsul', 95, y + 7, { width: 235 });
    doc.text('Say', 335, y + 7, { width: 40, align: 'center' });
    doc.text('Qiymət', 380, y + 7, { width: 80, align: 'right' });
    doc.text('Cəmi', 465, y + 7, { width: 90, align: 'right' });
    y += 28;
  };
  head();
  order.items.forEach((it, idx) => {
    if (y + 64 > 780) { doc.addPage(); y = 40; head(); }
    let drawn = false;
    if (imgs[idx]) { try { doc.image(imgs[idx], 40, y, { fit: [44, 54], align: 'center', valign: 'center' }); drawn = true; } catch { /* dəstəklənməyən format */ } }
    if (!drawn) bottle(doc, 48, y, 52, it.color || it.product?.color);
    doc.fillColor(DARK).font('b').fontSize(10).text(it.name + (it.volume ? ` · ${it.volume} ml` : ''), 95, y + 6, { width: 235 });
    if (it.discount > 0) doc.font('r').fontSize(8).fillColor(GREY).text(`Köhnə qiymət: ${fmt(it.originalPrice)} · −${it.discount}%`, 95, doc.y + 2, { width: 235 });
    doc.fillColor(DARK).font('r').fontSize(10);
    doc.text(String(it.qty), 335, y + 6, { width: 40, align: 'center' });
    doc.text(fmt(it.price), 380, y + 6, { width: 80, align: 'right' });
    doc.font('b').text(fmt(it.price * it.qty), 465, y + 6, { width: 90, align: 'right' });
    y += 62;
    doc.moveTo(40, y - 4).lineTo(555, y - 4).lineWidth(0.5).strokeColor('#dddddd').stroke();
  });

  // Yekun
  if (y + 100 > 780) { doc.addPage(); y = 40; }
  y += 8;
  doc.font('r').fontSize(10).fillColor(GREY);
  doc.text('Aralıq cəm:', 300, y, { width: 150, align: 'right' }); doc.fillColor(DARK).text(fmt(order.subtotal ?? order.total), 455, y, { width: 100, align: 'right' }); y += 18;
  if (order.discount > 0) {
    doc.fillColor(GREY).text(`Promokod (${order.promoCode || ''}):`, 300, y, { width: 150, align: 'right' });
    doc.fillColor('#2e8b57').text('−' + fmt(order.discount), 455, y, { width: 100, align: 'right' }); y += 18;
  }
  doc.rect(300, y, 255, 30).fill('#0b0b0c');
  doc.fillColor('#d4af37').font('b').fontSize(12).text('ÜMUMİ MƏBLƏĞ', 308, y + 9, { width: 120 });
  doc.text(fmt(order.total), 430, y + 9, { width: 118, align: 'right' });
  y += 50;
  doc.fillColor(GREY).font('r').fontSize(9).text('Təşəkkür edirik! EZZE Parfumes – Platinum Edition', 40, y, { width: 515, align: 'center' });
  doc.end();
}
