import React, { useRef, useState } from 'react';
import { api, apiForm, azn, orderNo, downloadInvoice } from '../api.js';
import { Bottle } from './Home.jsx';
import { PdfList, itemImg } from './Orders.jsx';

const STATUS = ['Hazırlanır', 'Çatdırılmaya verilib', 'Çatdırılıb'];

function PdfUpload({ order, run }) {
  const ref = useRef();
  const [note, setNote] = useState('');
  const upload = () => {
    const file = ref.current.files[0];
    if (!file) return run(async () => { throw new Error('PDF fayl seçin'); });
    const fd = new FormData();
    fd.append('file', file); fd.append('note', note);
    run(async () => { await apiForm(`/orders/${order._id}/pdfs`, fd); ref.current.value = ''; setNote(''); }, '✅ PDF yükləndi, müştəriyə bildiriş göndərildi');
  };
  return (
    <div className="upload">
      <input type="file" accept="application/pdf,.pdf" ref={ref} />
      <input placeholder="Qeyd (istəyə bağlı, müştəri görəcək)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="ghost" type="button" onClick={upload}>📎 Müştəriyə fayl göndər</button>
    </div>
  );
}

export default function Orders({ orders, run }) {
  return (
    <div className="card"><h3>Sifarişlər</h3>
      {orders.map((o) => (
        <div className="order" key={o._id}>
          <div className="row">
            <b>{orderNo(o)} · {new Date(o.createdAt).toLocaleString()}</b>
            {o.status === 'Ləğv edilib' ? <em className="badge">Ləğv edilib{o.cancelledAt ? ' · ' + new Date(o.cancelledAt).toLocaleString() : ''}</em> :
            <select value={o.status} onChange={(e) => run(() => api('/orders/' + o._id, 'PUT', { status: e.target.value }), '✅ Status yeniləndi, müştəriyə bildiriş göndərildi')}>
              {STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>}
          </div>

          <button className="ghost sm" onClick={() => run(() => downloadInvoice(o), '✅ Sifariş PDF-i yükləndi')}>📥 PDF yüklə</button>

          <div className="cust">
            <div><small className="muted">Müştəri</small><b>{o.customer?.firstName} {o.customer?.lastName}</b></div>
            <div><small className="muted">Əlaqə nömrəsi</small><b><a href={'tel:' + o.customer?.phone}>{o.customer?.phone}</a></b></div>
            <div><small className="muted">Ünvan</small><span>{o.customer?.address}</span></div>
            {o.customer?.note && <div><small className="muted">Qeyd</small><span>{o.customer.note}</span></div>}
          </div>

          {o.items.map((i, k) => (
            <div className="item" key={k}>
              <Bottle p={itemImg(i)} size={64} />
              <b>{i.name}{i.volume ? <small className="muted"> · {i.volume}ml</small> : ''} <span className="muted">× {i.qty}</span>{i.discount > 0 && <small className="muted"> · −{i.discount}% (köhnə {azn(i.originalPrice)})</small>}</b>
              <span>{azn(i.price * i.qty)}</span>
            </div>))}

          <div className="row small muted">
            <span>{o.promoCode ? `🏷 ${o.promoCode} (−${azn(o.discount)})` : ''}{o.user ? ` · hesab: ${o.user.email}` : ''}</span>
            <b>Cəmi: {azn(o.total)}</b>
          </div>

          <PdfList order={o} onDelete={(f) => run(() => api(`/orders/${o._id}/pdfs/${f._id}`, 'DELETE'), '✅ PDF silindi')} />
          <PdfUpload order={o} run={run} />
        </div>))}
      {!orders.length && <p className="muted">Hələ sifariş yoxdur.</p>}
    </div>
  );
}
