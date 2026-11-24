import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, azn } from '../api.js';
import { useApp } from '../App.jsx';
import { Bottle, Stars, PriceTag, BrandPulse } from './Home.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const { addToCart } = useApp();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { setP(null); api('/products/' + id).then(setP).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="err">{err} <Link to="/">← Mağazaya qayıt</Link></p>;
  if (!p) return <p className="muted">Yüklənir...</p>;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, text: `${p.name} – EZZE Parfumes`, url });
      else { await navigator.clipboard.writeText(url); setMsg('Link kopyalandı ✅'); }
    } catch { /* istifadəçi ləğv etdi */ }
  };

  return (
    <div className="card detail page">
      <div className="center"><Bottle p={p} size={320} /></div>
      <div>
        <Link to="/" className="muted">← Mağaza</Link>
        <h1>{p.name}</h1>
        <Stars n={p.rating} />
        <p className="muted">{p.description}</p>
        <p className="muted">{p.brand} · {p.gender} · {p.volume}ml · {p.season}</p>
        <div className="pyramid">
          <div><b>Üst</b><span>{p.notes?.top}</span></div>
          <div><b>Orta</b><span>{p.notes?.middle}</span></div>
          <div><b>Əsas</b><span>{p.notes?.base}</span></div>
        </div>
        <h2><PriceTag p={p} big /></h2>
        <button className="gold" disabled={p.stock < 1} onClick={() => { addToCart(p); setMsg('Səbətə əlavə olundu ✅'); }}>
          {p.stock < 1 ? 'Stokda yoxdur' : 'Səbətə at'}
        </button>
        <button className="ghost" onClick={share}>🔗 Paylaş</button>
        {msg && <p>{msg}</p>}
        <BrandPulse />
      </div>
    </div>
  );
}
