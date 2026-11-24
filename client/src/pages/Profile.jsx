import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

export default function Profile() {
  const { user, setUser } = useApp();
  const [p, setP] = useState(null);
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [msg2, setMsg2] = useState('');

  useEffect(() => { if (user) api('/profile').then(setP).catch(() => {}); }, [user]);
  if (!user) return <p>Profil üçün <Link to="/login">daxil olun</Link>.</p>;
  if (!p) return <p className="muted">Yüklənir...</p>;
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try { const r = await api('/profile', 'PUT', p); setP(r); setUser((u) => ({ ...u, name: r.name })); setMsg('✅ Məlumatlar yeniləndi'); }
    catch (x) { setMsg('❌ ' + x.message); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try { await api('/profile/password', 'PUT', pw); setPw({ oldPassword: '', newPassword: '' }); setMsg2('✅ Şifrə dəyişdirildi'); }
    catch (x) { setMsg2('❌ ' + x.message); }
  };

  return (
    <div className="two">
      <form className="card" onSubmit={save}>
        <h2>Profilim</h2>
        <div className="row2">
          <div><label className="muted">Ad</label><input value={p.firstName} onChange={set('firstName')} /></div>
          <div><label className="muted">Soyad</label><input value={p.lastName} onChange={set('lastName')} /></div>
        </div>
        <label className="muted">E-poçt</label>
        <input value={p.email} disabled />
        <label className="muted">Əlaqə nömrəsi</label>
        <input placeholder="+994501234567" value={p.phone} onChange={set('phone')} />
        <label className="muted">Ünvan</label>
        <input placeholder="Çatdırılma ünvanı" value={p.address} onChange={set('address')} />
        <p className="muted small">Qeydiyyat tarixi: {new Date(p.createdAt).toLocaleDateString()}</p>
        <button className="gold">Yadda saxla</button>
        {msg && <p>{msg}</p>}
        <div className="row2"><Link to="/orders" className="ghost btn">Sifarişlərim</Link><Link to="/notifications" className="ghost btn">Bildirişlər</Link></div>
      </form>
      <form className="card" onSubmit={changePw}>
        <h3>Şifrəni dəyiş</h3>
        <input type="password" placeholder="Köhnə şifrə" value={pw.oldPassword} onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })} />
        <input type="password" placeholder="Yeni şifrə (min. 6)" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        <button className="gold">Şifrəni yenilə</button>
        {msg2 && <p>{msg2}</p>}
      </form>
    </div>
  );
}
