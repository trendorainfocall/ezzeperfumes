import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, azn, VOLUMES } from '../api.js';
import { useApp, Logo } from '../App.jsx';
import Orders from './AdminOrders.jsx';
import { PriceTag } from './Home.jsx';
import { AdminNews, AdminBranches, AdminSupport, ImageField } from './AdminExtra.jsx';

const empty = { name: '', brand: 'EZZE', price: '', discount: 0, volume: 50, season: 'Yay', gender: 'Unisex', stock: 20, top: '', middle: '', base: '', description: '', image: '' };
const emptyPromo = { code: '', type: 'percent', value: '', minOrder: 0, usageLimit: 0, expiresAt: '' };
const emptyAdmin = { name: '', email: '', password: '', pin: '' };

function Rank({ title, rows, icon }) {
  const max = Math.max(1, ...rows.map((r) => r.orders));
  return (
    <div className="card">
      <h3>{icon} {title}</h3>
      {rows.map((r, i) => (
        <div className="rank" key={r.id}>
          <div className="row"><b>{i + 1}. {r.name}</b><small className="muted">{r.orders} sifariş · {r.qty} ədəd</small></div>
          <div className="rbar"><i style={{ width: Math.max(4, (r.orders / max) * 100) + '%' }} /></div>
        </div>))}
      {!rows.length && <p className="muted">Hələ məlumat yoxdur.</p>}
    </div>
  );
}

export default function Admin() {
  const { logout, user, setSettings } = useApp();
  const isSuper = user?.role === 'superadmin';
  const [tab, setTab] = useState('dashboard');
  const [menu, setMenu] = useState(false);
  const [stats, setStats] = useState({ chart: [], top: [], least: [] });
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [promos, setPromos] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [st, setSt] = useState({});
  const [f, setF] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [pf, setPf] = useState(emptyPromo);
  const [af, setAf] = useState(emptyAdmin);
  const [msg, setMsg] = useState('');
  const [supportUnread, setSupportUnread] = useState(0);
  useEffect(() => {
    const t = () => document.hidden || api('/admin/support/unread').then((d) => setSupportUnread(d.unread)).catch(() => {});
    t(); const id = setInterval(t, 15000); return () => clearInterval(id);
  }, []);

  const load = () => {
    api('/admin/stats').then(setStats);
    api('/orders').then(setOrders);
    api('/products').then(setProducts);
    api('/promos').then(setPromos);
    api('/settings').then(setSt);
    if (isSuper) api('/admins').then(setAdmins);
  };
  useEffect(load, []);
  const run = async (fn, ok) => { try { await fn(); setMsg(ok || '✅ Hazırdır'); load(); } catch (e) { setMsg('❌ ' + e.message); } };

  const saveProduct = (e) => {
    e.preventDefault();
    const body = {
      name: f.name, brand: f.brand, price: +f.price, discount: +f.discount || 0, volume: +f.volume, season: f.season,
      gender: f.gender, stock: +f.stock, description: f.description, image: f.image, notes: { top: f.top, middle: f.middle, base: f.base },
    };
    run(async () => {
      await api(editId ? '/products/' + editId : '/products', editId ? 'PUT' : 'POST', body);
      setF(empty); setEditId(null);
    }, editId ? '✅ Məhsul yeniləndi' : '✅ Məhsul əlavə edildi');
  };
  const startEdit = (p) => {
    setF({ ...empty, name: p.name, brand: p.brand, price: p.price, discount: p.discount || 0, volume: p.volume, season: p.season, gender: p.gender || 'Unisex',
      stock: p.stock, description: p.description || '', image: p.image || '', top: p.notes?.top || '', middle: p.notes?.middle || '', base: p.notes?.base || '' });
    setEditId(p._id); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const max = Math.max(1, ...stats.chart);
  const tabs = [['dashboard', 'Dashboard'], ['products', 'Məhsullar'], ['orders', 'Sifarişlər'], ['promos', 'Promokodlar'], ['news', 'Xəbərlər'], ['branches', 'Filiallar'], ['support', 'Dəstək' + (supportUnread ? ` (${supportUnread})` : '')], ['settings', 'Footer & WhatsApp'], ...(isSuper ? [['admins', 'Adminlər']] : [])];

  return (
    <div className="admin">
      <aside>
        <div className="aside-head">
          <Logo />
          <button className="burger" aria-label="Menyu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{menu ? '✕' : '☰'}</button>
        </div>
        <nav className={'admin-links' + (menu ? ' open' : '')}>
          {tabs.map(([k, l]) => <a key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setMsg(''); setMenu(false); }}>{l}</a>)}
          <Link to="/">← Mağaza</Link>
        </nav>
      </aside>
      <main>
        <div className="card top"><b>Admin Panel {isSuper && <em className="badge">Süper Admin</em>}</b><span>{user?.name} · <a onClick={logout}>Çıxış</a></span></div>
        {msg && <div className="card">{msg}</div>}

        {tab === 'dashboard' && (<>
          <div className="stats">
            <div className="card"><h4>Ümumi Satış (AZN)</h4><h1>{azn(stats.totalSales)}</h1>
              <div className="bars">{stats.chart.map((v, i) => <i key={i} style={{ height: (v / max) * 100 + '%' }} />)}</div></div>
            <div className="card"><h4>Aktiv Sifarişlər</h4><h1>{stats.activeOrders || 0}</h1></div>
            <div className="card"><h4>Müştərilər</h4><h1>{stats.customers || 0}</h1></div>
            <div className="card"><h4>Kritik Stok Xəbərdarlığı</h4><h1>{stats.lowStock || 0}</h1><p className="muted">Cəmi məhsul: {stats.totalProducts}</p></div>
          </div>
          <div className="two">
            <Rank icon="🏆" title="Ən çox satılan məhsullar" rows={stats.top || []} />
            <Rank icon="📉" title="Ən az satılan məhsullar" rows={stats.least || []} />
          </div>
          <Orders orders={orders.slice(0, 5)} run={run} />
        </>)}

        {tab === 'orders' && <Orders orders={orders} run={run} />}

        {tab === 'products' && (
          <div className="two">
            <div className="card"><h3>Məhsullar</h3>
              {products.map((p) => (
                <div className="row" key={p._id}>
                  <span>{p.name}<br /><small className="muted">{p.gender} · {p.volume}ml · stok {p.stock}</small></span>
                  <span className="right"><PriceTag p={p} /><br />
                    <a onClick={() => startEdit(p)}>Redaktə</a> · <a onClick={() => confirm(p.name + ' silinsin?') && run(() => api('/products/' + p._id, 'DELETE'))}>Sil</a></span>
                </div>))}
            </div>
            <form className="card" onSubmit={saveProduct}>
              <h3>{editId ? 'Məhsulu redaktə et' : 'Yeni Məhsul Əlavə Et'}</h3>
              <input placeholder="Məhsul adı" value={f.name} onChange={set('name')} required />
              <div className="row2">
                <input placeholder="Qiymət (₼)" type="number" step="0.01" min="0" value={f.price} onChange={set('price')} required />
                <input placeholder="Endirim (%)" type="number" min="0" max="90" value={f.discount} onChange={set('discount')} />
              </div>
              {+f.discount > 0 && +f.price > 0 && <p className="ok">Endirimli qiymət: <b>{azn((f.price * (100 - f.discount)) / 100)}</b> <s className="muted">{azn(f.price)}</s></p>}
              <div className="row2">
                <select value={f.gender} onChange={set('gender')}>{['Kişi', 'Qadın', 'Unisex'].map((g) => <option key={g}>{g}</option>)}</select>
                <select value={f.volume} onChange={set('volume')}>{VOLUMES.map((v) => <option key={v} value={v}>{v} ml</option>)}</select>
              </div>
              <div className="row2">
                <select value={f.season} onChange={set('season')}>{['Yaz', 'Yay', 'Payız', 'Qış', 'Bütün fəsillər'].map((s) => <option key={s}>{s}</option>)}</select>
                <input placeholder="Stok" type="number" value={f.stock} onChange={set('stock')} />
              </div>
              <input placeholder="Üst notlar" value={f.top} onChange={set('top')} />
              <input placeholder="Orta notlar" value={f.middle} onChange={set('middle')} />
              <input placeholder="Əsas notlar" value={f.base} onChange={set('base')} />
              <ImageField value={f.image} onChange={(v) => setF({ ...f, image: v })} label="Məhsul şəkli (istəyə bağlı)" onError={(m) => setMsg('❌ ' + m)} />
              <textarea placeholder="Təsvir" value={f.description} onChange={set('description')} />
              <button className="gold">{editId ? 'Yadda saxla' : 'Yeni Məhsul'}</button>
              {editId && <button type="button" className="ghost" onClick={() => { setF(empty); setEditId(null); }}>Ləğv et</button>}
            </form>
          </div>)}

        {tab === 'promos' && (
          <div className="two">
            <div className="card"><h3>Promokodlar</h3>
              {promos.map((p) => (
                <div className="row" key={p._id}>
                  <span><b>{p.code}</b> · {p.type === 'percent' ? p.value + '%' : azn(p.value)} · istifadə {p.used}{p.usageLimit ? '/' + p.usageLimit : ''}
                    {p.expiresAt && <small className="muted"> · {new Date(p.expiresAt).toLocaleDateString()}</small>}</span>
                  <span><a onClick={() => run(() => api('/promos/' + p._id, 'PUT', { active: !p.active }))}>{p.active ? 'Aktiv' : 'Deaktiv'}</a>{' · '}
                    <a onClick={() => run(() => api('/promos/' + p._id, 'DELETE'))}>Sil</a></span>
                </div>))}
              {!promos.length && <p className="muted">Promokod yoxdur.</p>}
            </div>
            <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/promos', 'POST', { ...pf, value: +pf.value, minOrder: +pf.minOrder, usageLimit: +pf.usageLimit }); setPf(emptyPromo); }); }}>
              <h3>Yeni Promokod</h3>
              <input placeholder="Kod (məs. YAZ20)" value={pf.code} onChange={(e) => setPf({ ...pf, code: e.target.value })} required />
              <div className="row2">
                <select value={pf.type} onChange={(e) => setPf({ ...pf, type: e.target.value })}><option value="percent">Faiz (%)</option><option value="fixed">Sabit (₼)</option></select>
                <input type="number" step="0.01" placeholder="Dəyər" value={pf.value} onChange={(e) => setPf({ ...pf, value: e.target.value })} required />
              </div>
              <input type="number" placeholder="Minimum sifariş məbləği (₼)" value={pf.minOrder} onChange={(e) => setPf({ ...pf, minOrder: e.target.value })} />
              <input type="number" placeholder="İstifadə limiti (0 = limitsiz)" value={pf.usageLimit} onChange={(e) => setPf({ ...pf, usageLimit: e.target.value })} />
              <label className="muted">Bitmə tarixi (istəyə bağlı)</label>
              <input type="date" value={pf.expiresAt} onChange={(e) => setPf({ ...pf, expiresAt: e.target.value })} />
              <button className="gold">Promokod yarat</button>
            </form>
          </div>)}

        {tab === 'news' && <AdminNews run={run} />}
        {tab === 'branches' && <AdminBranches run={run} />}
        {tab === 'support' && <AdminSupport onRead={() => api('/admin/support/unread').then((d) => setSupportUnread(d.unread)).catch(() => {})} />}

        {tab === 'settings' && (
          <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => setSettings(await api('/settings', 'PUT', st)), '✅ Yadda saxlanıldı'); }}>
            <h3>Footer və əlaqə ayarları</h3>
            <label className="muted">Footer mətni</label>
            <textarea value={st.footerText || ''} onChange={(e) => setSt({ ...st, footerText: e.target.value })} />
            {[['address', 'Ünvan'], ['phone', 'Telefon'], ['email', 'E-poçt'], ['instagram', 'Instagram linki']].map(([k, l]) => (
              <input key={k} placeholder={l} value={st[k] || ''} onChange={(e) => setSt({ ...st, [k]: e.target.value })} />))}
            <label className="muted">WhatsApp nömrəsi (ölkə kodu ilə, məs. 994501234567)</label>
            <input placeholder="994501234567" value={st.whatsapp || ''} onChange={(e) => setSt({ ...st, whatsapp: e.target.value })} />
            <button className="gold">Yadda saxla</button>
          </form>)}

        {tab === 'admins' && isSuper && (
          <div className="two">
            <div className="card"><h3>Adminlər</h3>
              {admins.map((a) => (
                <div className="row" key={a._id}>
                  <span>{a.name}<br /><small className="muted">{a.email}</small></span>
                  <span>{a.role === 'superadmin' ? <em className="badge">Süper Admin</em> :
                    <a onClick={() => confirm(a.name + ' silinsin?') && run(() => api('/admins/' + a._id, 'DELETE'))}>Sil</a>}</span>
                </div>))}
            </div>
            <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/admins', 'POST', af); setAf(emptyAdmin); }, '✅ Admin əlavə edildi'); }}>
              <h3>Yeni Admin</h3>
              <input placeholder="Ad Soyad" value={af.name} onChange={(e) => setAf({ ...af, name: e.target.value })} required />
              <input type="email" placeholder="E-poçt" value={af.email} onChange={(e) => setAf({ ...af, email: e.target.value })} required />
              <input type="password" placeholder="Şifrə (min. 6)" value={af.password} onChange={(e) => setAf({ ...af, password: e.target.value })} required />
              <input inputMode="numeric" maxLength={6} placeholder="PIN kod (4-6 rəqəm)" value={af.pin} onChange={(e) => setAf({ ...af, pin: e.target.value })} required />
              <button className="gold">Admin əlavə et</button>
            </form>
          </div>)}
      </main>
    </div>
  );
}
