import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, azn, orderNo, sale } from '../api.js';
import { useApp } from '../App.jsx';

const emptyC = { firstName: '', lastName: '', phone: '', address: '', note: '' };

export default function Cart() {
  const { cart, setCart, user, settings, refreshNotif } = useApp();
  const [c, setC] = useState(emptyC);
  const [code, setCode] = useState('');
  const [promo, setPromo] = useState(null);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(null);

  const subtotal = cart.reduce((s, i) => s + sale(i) * i.qty, 0);
  const total = Math.max(0, subtotal - (promo?.discount || 0));
  useEffect(() => { setPromo(null); }, [subtotal]);
  useEffect(() => { // qiymət/endirim/stok dəyişibsə səbəti yenilə
    if (!cart.length) return;
    api('/products?ids=' + cart.map((i) => i._id).join(',')).then((list) =>
      setCart((cs) => cs.filter((i) => list.some((p) => p._id === i._id)).map((i) => ({ ...list.find((p) => p._id === i._id), qty: i.qty }))))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (user) api('/profile').then((p) => setC((x) => ({ ...x, firstName: p.firstName, lastName: p.lastName, phone: p.phone, address: p.address }))).catch(() => {});
  }, [user]);

  const applyCode = async () => {
    try { setPromo(await api('/promos/validate', 'POST', { code, subtotal })); setMsg(''); }
    catch (e) { setPromo(null); setMsg('❌ ' + e.message); }
  };
  const order = async () => {
    try {
      const o = await api('/orders', 'POST', { items: cart.map((i) => ({ product: i._id, qty: i.qty })), customer: c, promoCode: promo?.code });
      setDone(o); setCart([]); setPromo(null); setCode(''); setMsg(''); refreshNotif();
    } catch (e) { setMsg('❌ ' + e.message); }
  };
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });

  const waLink = (o) => {
    const text = `Salam! EZZE Parfumes-dən ${orderNo(o)} nömrəli sifariş verdim. Ad: ${o.customer.firstName} ${o.customer.lastName}. Məbləğ: ${azn(o.total)}.`;
    return `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(text)}`;
  };

  if (done) return (
    <div className="card auth center-text">
      <h2>✅ Sifarişiniz qəbul olundu!</h2>
      <p>Sifariş nömrəsi: <b>{orderNo(done)}</b></p>
      <p>Cəmi: <b>{azn(done.total)}</b></p>
      {settings.whatsapp
        ? <a className="gold btn wa" href={waLink(done)} target="_blank" rel="noreferrer">💬 WhatsApp ilə əlaqə saxla</a>
        : <p className="muted">Tezliklə sizinlə əlaqə saxlanılacaq.</p>}
      <Link to="/orders" className="ghost btn">Sifarişlərimə bax</Link>
      <Link to="/" className="ghost btn">Alış-verişə davam et</Link>
    </div>
  );

  return (
    <div className="two">
      <div className="card">
        <h2>Səbət</h2>
        {!cart.length && <p className="muted">Səbət boşdur.</p>}
        {cart.map((i) => (
          <div className="row" key={i._id}>
            <span>{i.name}{i.volume ? <small className="muted"> · {i.volume}ml</small> : ''} × {i.qty}</span>
            <span>{azn(sale(i) * i.qty)} <a onClick={() => setCart(cart.filter((x) => x._id !== i._id))}>✕</a></span>
          </div>))}
        {!!cart.length && (<>
          <div className="row2 promo">
            <input placeholder="Promokod" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="ghost" onClick={applyCode}>Tətbiq et</button>
          </div>
          <div className="row"><span>Aralıq cəm</span><span>{azn(subtotal)}</span></div>
          {promo && <div className="row ok"><span>Promokod ({promo.code})</span><span>−{azn(promo.discount)}</span></div>}
          <h3>Cəmi: {azn(total)}</h3>
        </>)}
        {msg && <p>{msg}</p>}
      </div>

      <div className="card">
        {!user ? <p>Sifariş üçün <Link to="/login">daxil olun</Link>.</p> : (<>
          <h2>Çatdırılma məlumatları</h2>
          <div className="row2">
            <input placeholder="Ad *" value={c.firstName} onChange={set('firstName')} />
            <input placeholder="Soyad *" value={c.lastName} onChange={set('lastName')} />
          </div>
          <input placeholder="Əlaqə nömrəsi * (məs. +994501234567)" value={c.phone} onChange={set('phone')} />
          <input placeholder="Çatdırılma ünvanı *" value={c.address} onChange={set('address')} />
          <textarea placeholder="Qeyd (istəyə bağlı)" value={c.note} onChange={set('note')} />
          <button className="gold" disabled={!cart.length} onClick={order}>Sifariş ver</button>
        </>)}
      </div>
    </div>
  );
}
