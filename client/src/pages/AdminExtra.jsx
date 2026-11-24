import React, { useEffect, useRef, useState } from 'react';
import { api, uploadImage, fmtDate } from '../api.js';
import { Chat } from './Support.jsx';

// Şəkil yüklə (JPG/PNG/WEBP, maks. 5MB) və ya link yapışdır
export function ImageField({ value, onChange, label = 'Şəkil', onError }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadImage(file)); } catch (x) { onError?.(x.message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <div className="imgfield">
      <label className="muted">{label}</label>
      {value && <div className="imgprev"><img src={value} alt="" /><a onClick={() => onChange('')}>✕ Şəkli sil</a></div>}
      <input type="file" accept="image/jpeg,image/png,image/webp" ref={ref} onChange={pick} disabled={busy} />
      <input placeholder="və ya şəkil linki (https://...)" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      {busy && <small className="muted">Yüklənir...</small>}
    </div>
  );
}

const emptyPost = { title: '', summary: '', content: '', image: '', published: true };

export function AdminNews({ run }) {
  const [posts, setPosts] = useState([]);
  const [f, setF] = useState(emptyPost);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/admin/posts').then(setPosts).catch(() => {});
  useEffect(() => { load(); }, []);
  const go = (fn, ok) => run(async () => { await fn(); load(); }, ok);
  const save = (e) => {
    e.preventDefault();
    go(async () => { await api(editId ? '/admin/posts/' + editId : '/admin/posts', editId ? 'PUT' : 'POST', f); setF(emptyPost); setEditId(null); }, editId ? '✅ Xəbər yeniləndi' : '✅ Xəbər əlavə edildi');
  };
  const link = (p) => `${window.location.origin}/news/${p._id}`;
  const copy = async (p) => { try { await navigator.clipboard.writeText(link(p)); setErr('Link kopyalandı ✅'); } catch { setErr(link(p)); } };
  return (
    <div className="two">
      <div className="card"><h3>Xəbərlər</h3>
        {err && <p className="ok">{err}</p>}
        {posts.map((p) => (
          <div className="row" key={p._id}>
            <span><b>{p.title}</b> {!p.published && <em className="badge">Qaralama</em>}<br /><small className="muted">{fmtDate(p.createdAt)}</small></span>
            <span className="right">
              <a onClick={() => go(() => api('/admin/posts/' + p._id, 'PUT', { ...p, published: !p.published }))}>{p.published ? 'Gizlət' : 'Paylaş'}</a>
              {p.published && <> · <a onClick={() => copy(p)}>Link</a></>}
              <br /><a onClick={() => { setF({ title: p.title, summary: p.summary || '', content: p.content, image: p.image || '', published: p.published }); setEditId(p._id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Redaktə</a>
              {' · '}<a onClick={() => confirm(p.title + ' silinsin?') && go(() => api('/admin/posts/' + p._id, 'DELETE'), '✅ Xəbər silindi')}>Sil</a>
            </span>
          </div>))}
        {!posts.length && <p className="muted">Hələ xəbər yoxdur.</p>}
      </div>
      <form className="card" onSubmit={save}>
        <h3>{editId ? 'Xəbəri redaktə et' : 'Yeni Xəbər'}</h3>
        <input placeholder="Başlıq" value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        <input placeholder="Qısa təsvir (siyahıda görünür)" value={f.summary} maxLength={400} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        <textarea className="tall" placeholder="Xəbərin mətni" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} required />
        <ImageField value={f.image} onChange={(v) => setF({ ...f, image: v })} label="Şəkil" onError={setErr} />
        <label className="chk"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Saytda dərc et (paylaş)</label>
        <button className="gold">{editId ? 'Yadda saxla' : 'Xəbəri əlavə et'}</button>
        {editId && <button type="button" className="ghost" onClick={() => { setF(emptyPost); setEditId(null); }}>Ləğv et</button>}
      </form>
    </div>
  );
}

const emptyBranch = { name: '', image: '', hours: '', address: '', phone: '', mapUrl: '', lat: '', lng: '' };

export function AdminBranches({ run }) {
  const [list, setList] = useState([]);
  const [f, setF] = useState(emptyBranch);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/branches').then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  const go = (fn, ok) => run(async () => { await fn(); load(); }, ok);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = (e) => {
    e.preventDefault();
    go(async () => { await api(editId ? '/branches/' + editId : '/branches', editId ? 'PUT' : 'POST', f); setF(emptyBranch); setEditId(null); }, editId ? '✅ Filial yeniləndi' : '✅ Filial əlavə edildi');
  };
  return (
    <div className="two">
      <div className="card"><h3>Filiallar</h3>
        {list.map((b) => (
          <div className="row" key={b._id}>
            <span><b>{b.name}</b><br /><small className="muted">{b.address || '—'} · {b.hours || '—'}</small></span>
            <span className="right">
              <a onClick={() => { setF({ name: b.name, image: b.image || '', hours: b.hours || '', address: b.address || '', phone: b.phone || '', mapUrl: b.mapUrl || '', lat: b.lat ?? '', lng: b.lng ?? '' }); setEditId(b._id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Redaktə</a>
              {' · '}<a onClick={() => confirm(b.name + ' silinsin?') && go(() => api('/branches/' + b._id, 'DELETE'), '✅ Filial silindi')}>Sil</a>
            </span>
          </div>))}
        {!list.length && <p className="muted">Hələ filial yoxdur.</p>}
      </div>
      <form className="card" onSubmit={save}>
        <h3>{editId ? 'Filialı redaktə et' : 'Yeni Filial'}</h3>
        <input placeholder="Filialın adı" value={f.name} onChange={set('name')} required />
        <ImageField value={f.image} onChange={(v) => setF({ ...f, image: v })} label="Filial şəkli" onError={setErr} />
        <input placeholder="İş saatları (məs. Hər gün 10:00 – 22:00)" value={f.hours} onChange={set('hours')} />
        <input placeholder="Ünvan" value={f.address} onChange={set('address')} />
        <input placeholder="Telefon (istəyə bağlı)" value={f.phone} onChange={set('phone')} />
        <input placeholder="Xəritə linki (Google Maps və s.)" value={f.mapUrl} onChange={set('mapUrl')} />
        <div className="row2">
          <input placeholder="Enlik (lat), məs. 40.4093" inputMode="decimal" value={f.lat} onChange={set('lat')} />
          <input placeholder="Uzunluq (lng), məs. 49.8671" inputMode="decimal" value={f.lng} onChange={set('lng')} />
        </div>
        {err && <p className="err">{err}</p>}
        <button className="gold">{editId ? 'Yadda saxla' : 'Filial əlavə et'}</button>
        {editId && <button type="button" className="ghost" onClick={() => { setF(emptyBranch); setEditId(null); }}>Ləğv et</button>}
      </form>
    </div>
  );
}

export function AdminSupport({ onRead }) {
  const [convs, setConvs] = useState([]);
  const [sel, setSel] = useState(null);
  const load = () => document.hidden || api('/admin/support').then(setConvs).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);
  const seen = () => { load(); onRead?.(); };
  return (
    <div className="two support-admin">
      <div className="card"><h3>Müştəri yazışmaları</h3>
        {convs.map((c) => (
          <div className={'row conv' + (sel?.id === c.user.id ? ' on' : '')} key={c.user.id} onClick={() => setSel(c.user)}>
            <span><b>{c.user.name}</b> {c.unread > 0 && <span className="dot">{c.unread}</span>}<br />
              <small className="muted">{c.user.email}</small><br />
              <small className="muted">{c.lastFrom === 'admin' ? 'Siz: ' : ''}{c.lastText.slice(0, 60)}</small></span>
            <small className="muted">{fmtDate(c.lastAt)}</small>
          </div>))}
        {!convs.length && <p className="muted">Hələ yazışma yoxdur.</p>}
      </div>
      <div className="card">
        {sel ? (<><h3>{sel.name}</h3><Chat key={sel.id} base={'/admin/support/' + sel.id} mine="admin" onSeen={seen} /></>)
          : <p className="muted">Yazışmanı açmaq üçün soldan müştəri seçin.</p>}
      </div>
    </div>
  );
}
