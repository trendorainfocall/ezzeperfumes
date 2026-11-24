import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, azn, VOLUMES } from '../api.js';
import { useApp } from '../App.jsx';

export const Bottle = ({ p, size = 120 }) =>
  p.image ? <img src={p.image} alt={p.name} style={{ height: size, maxWidth: '100%', objectFit: 'contain' }} /> : (
    <svg height={size} viewBox="0 0 60 90">
      <rect x="22" y="2" width="16" height="12" rx="2" fill="#d4af37" />
      <rect x="26" y="14" width="8" height="8" fill="#b8902c" />
      <rect x="6" y="22" width="48" height="64" rx="6" fill={p.color || '#d9b45a'} stroke="#e8cf8a" strokeWidth="1.5" />
      <rect x="16" y="46" width="28" height="16" fill="none" stroke="#e8cf8a" strokeWidth=".8" />
      <text x="30" y="58" fontSize="8" fill="#e8cf8a" textAnchor="middle" fontWeight="700">EZZE</text>
    </svg>
  );

export const Stars = ({ n }) => <span className="stars">{'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}</span>;

// Cins/Mövsüm kimi açılan siyahı; bir neçə həcm seçmək olar
function VolumePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away); document.removeEventListener('keydown', esc); };
  }, []);
  const toggle = (v) => onChange(value.includes(v) ? value.filter((i) => i !== v) : [...value, v].sort((a, b) => a - b));
  const label = !value.length ? 'Hamısı' : value.length <= 3 ? value.map((v) => v + 'ml').join(', ') : value.length + ' həcm seçildi';
  return (
    <div className="vpick" ref={ref}>
      <button type="button" className={'vpick-btn' + (open ? ' open' : '')} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span><i aria-hidden="true">▾</i>
      </button>
      {open && (
        <div className="vpick-pop" role="listbox" aria-multiselectable="true">
          <button type="button" className={'vopt' + (!value.length ? ' on' : '')} onClick={() => { onChange([]); setOpen(false); }}>Hamısı</button>
          <div className="vgrid">
            {VOLUMES.map((v) => (
              <button type="button" key={v} role="option" aria-selected={value.includes(v)} className={'vopt' + (value.includes(v) ? ' on' : '')} onClick={() => toggle(v)}>{v} ml</button>
            ))}
          </div>
          <div className="vfoot">
            <button type="button" className="vclear" onClick={() => onChange([])} disabled={!value.length}>Təmizlə</button>
            <button type="button" className="vdone" onClick={() => setOpen(false)}>Hazır</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { q } = useApp();
  const [products, setProducts] = useState([]);
  const [vol, setVol] = useState([]);
  const [season, setSeason] = useState('');
  const [gender, setGender] = useState('');

  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (vol.length) p.set('volume', vol.join(','));
    if (season) p.set('season', season);
    if (gender) p.set('gender', gender);
    api('/products?' + p).then(setProducts).catch(() => {});
  }, [q, vol, season, gender]);

  const best = [...products].sort((a, b) => b.sold - a.sold).slice(0, 4);

  return (
    <>
      <section className="hero">
        <h1>PLATINUM EDITION<br />KOLLEKSİYASINI KƏŞF ET</h1>
        <a className="gold btn" href="#all">İndi Al</a>
      </section>

      <section className="card filters">
        <div><h4>Cins</h4>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Hamısı</option>
            {['Kişi', 'Qadın', 'Unisex'].map((g) => <option key={g}>{g}</option>)}
          </select></div>
        <div><h4>Həcm</h4><VolumePicker value={vol} onChange={setVol} /></div>
        <div><h4>Mövsüm</h4>
          <select value={season} onChange={(e) => setSeason(e.target.value)}>
            <option value="">Hamısı</option>
            {['Yaz', 'Yay', 'Payız', 'Qış', 'Bütün fəsillər'].map((s) => <option key={s}>{s}</option>)}
          </select></div>
      </section>

      <h2 className="title">Ən Çox Satılanlar (Bestsellers)</h2>
      <div className="grid">{best.map((p) => <Card key={p._id} p={p} />)}</div>

      <h2 className="title" id="all">Bütün Məhsullar</h2>
      <div className="grid">{products.map((p) => <Card key={p._id} p={p} />)}</div>
      {!products.length && <p className="muted">Məhsul tapılmadı.</p>}
    </>
  );
}

export const PriceTag = ({ p, big }) => (
  <span className={'price' + (big ? ' big' : '')}>
    {p.discount > 0 ? (<>
      <b className="now">{azn(p.salePrice)}</b>
      <s className="old">{azn(p.price)}</s>
      <em className="off">−{p.discount}%</em>
    </>) : <b className="now">{azn(p.price)}</b>}
  </span>
);

export const BrandPulse = () => (
  <div className="brand-pulse" aria-hidden="true"><b>EZZE</b><span>PARFUMES</span></div>
);

function Card({ p }) {
  return (
    <Link to={'/product/' + p._id} className="pcard">
      <div className="frame">
        {p.discount > 0 && <span className="ribbon">−{p.discount}%</span>}
        <Bottle p={p} />
      </div>
      <div className="pname">{p.name}</div>
      <small className="muted">{p.gender} · {p.volume}ml</small>
      <Stars n={p.rating} />
      <PriceTag p={p} />
      <BrandPulse />
    </Link>
  );
}
