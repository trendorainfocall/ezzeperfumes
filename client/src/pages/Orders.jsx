import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, azn, openPdf, orderNo, downloadInvoice } from '../api.js';
import { useApp } from '../App.jsx';
import { Bottle } from './Home.jsx';

export function PdfList({ order, onDelete }) {
  const [err, setErr] = useState('');
  const go = (f, d) => openPdf(order._id, f, d).catch((e) => setErr(e.message));
  if (!order.pdfs?.length) return null;
  return (
    <div className="pdfs">
      {order.pdfs.map((f) => (
        <div className="row" key={f._id}>
          <span>📄 {f.originalName}{f.note && <small className="muted"> — {f.note}</small>}</span>
          <span><a onClick={() => go(f, false)}>Bax</a> · <a onClick={() => go(f, true)}>Yüklə</a>{onDelete && <> · <a onClick={() => onDelete(f)}>Sil</a></>}</span>
        </div>))}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export const itemImg = (i) => ({ name: i.name, image: i.image || i.product?.image, color: i.color || i.product?.color });

// 5 dəqiqəlik ləğv düyməsi: qalan vaxt serverdən gəlir (cancelMs), burada yalnız geri sayım göstərilir.
// Son qərarı həmişə server verir.
function CancelBox({ order, loadedAt, onDone }) {
  const [, tick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, (order.cancelMs || 0) - (Date.now() - loadedAt));
  if (order.status !== 'Hazırlanır' || left <= 0) return null;
  const mm = String(Math.floor(left / 60000)).padStart(2, '0'), ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const cancel = async () => {
    if (!confirm('Sifariş ləğv edilsin?')) return;
    setBusy(true); setErr('');
    try { await api(`/orders/${order._id}/cancel`, 'POST'); onDone(); }
    catch (e) { setErr(e.message); onDone(); }
    finally { setBusy(false); }
  };
  return (
    <div className="cancel-box">
      <button className="danger sm" disabled={busy} onClick={cancel}>✕ Sifarişi ləğv et</button>
      <small className="muted">Qalan vaxt: <b className="timer">{mm}:{ss}</b></small>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function Orders() {
  const { user } = useApp();
  const [orders, setOrders] = useState(null);
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const load = () => api('/orders/mine').then((o) => { setLoadedAt(Date.now()); setOrders(o); }).catch(() => setOrders((x) => x || []));
  useEffect(() => { if (user) load(); }, [user]);
  if (!user) return <p>Sifarişlər üçün <Link to="/login">daxil olun</Link>.</p>;
  if (!orders) return <p className="muted">Yüklənir...</p>;

  return (
    <div>
      <h2>Sifarişlərim</h2>
      {!orders.length && <p className="muted">Hələ sifarişiniz yoxdur. <Link to="/">Mağazaya keç</Link></p>}
      {orders.map((o) => (
        <div className="card order-card" key={o._id}>
          <div className="row">
            <b>{orderNo(o)} · {new Date(o.createdAt).toLocaleString()}</b>
            <em className={'badge' + (o.status === 'Ləğv edilib' ? ' cancelled' : '')}>{o.status}</em>
          </div>
          <CancelBox order={o} loadedAt={loadedAt} onDone={load} />
          <button className="ghost sm" onClick={() => downloadInvoice(o).catch((e) => alert(e.message))}>📥 Sifariş PDF-i</button>
          {o.items.map((i, k) => (
            <div className="item" key={k}>
              <Bottle p={itemImg(i)} size={56} />
              <span>{i.name}{i.volume ? <small className="muted"> · {i.volume}ml</small> : ''} × {i.qty}</span><span>{azn(i.price * i.qty)}</span>
            </div>))}
          <div className="row"><span>{o.promoCode ? `Promokod ${o.promoCode}: −${azn(o.discount)}` : ''}</span><b>Cəmi: {azn(o.total)}</b></div>
          <PdfList order={o} />
        </div>))}
    </div>
  );
}
