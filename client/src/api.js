export async function api(path, method = 'GET', body) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Xəta baş verdi');
  return data;
}
export const azn = (n) => Number(n || 0).toFixed(2) + ' ₼';
export const isAdmin = (u) => u && (u.role === 'admin' || u.role === 'superadmin');

export async function apiForm(path, formData) {
  const res = await fetch('/api' + path, { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Xəta baş verdi');
  return data;
}
// PDF-i token ilə yüklə: baxmaq (yeni tab) və ya endirmək
export async function openPdf(orderId, pdf, download = false) {
  const res = await fetch(`/api/orders/${orderId}/pdfs/${pdf._id}${download ? '?download=1' : ''}`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
  if (!res.ok) throw new Error('Fayl açıla bilmədi');
  const url = URL.createObjectURL(await res.blob());
  if (download) { const a = document.createElement('a'); a.href = url; a.download = pdf.originalName || 'sened.pdf'; a.click(); }
  else window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const orderNo = (o) => '#' + String(o._id).slice(-6).toUpperCase();

export const sale = (p) => p.salePrice ?? p.price;
export async function downloadInvoice(order) {
  const res = await fetch(`/api/orders/${order._id}/invoice`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
  if (!res.ok) throw new Error('PDF yaradıla bilmədi');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = `sifaris-${orderNo(order).slice(1)}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const VOLUMES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 150, 200];
export const fmtDate = (d) => new Date(d).toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' });
export async function uploadImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  return (await apiForm('/uploads/image', fd)).url;
}
export const mapLink = (b) => b.mapUrl || (b.lat != null && b.lng != null ? `https://www.google.com/maps?q=${b.lat},${b.lng}` : b.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}` : '');
