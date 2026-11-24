import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';

export function NewsList() {
  const [posts, setPosts] = useState(null);
  useEffect(() => { api('/posts').then(setPosts).catch(() => setPosts([])); }, []);
  if (!posts) return <p className="muted">Yüklənir...</p>;
  return (
    <div>
      <h2>Xəbərlər</h2>
      {!posts.length && <p className="muted">Hələ xəbər yoxdur.</p>}
      <div className="news-grid">
        {posts.map((p) => (
          <Link to={'/news/' + p._id} className="card news-card" key={p._id}>
            {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="news-ph">EZZE</div>}
            <div><small className="muted">{fmtDate(p.createdAt)}</small><h3>{p.title}</h3><p className="muted">{p.summary}</p></div>
          </Link>))}
      </div>
    </div>
  );
}

export function NewsPost() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setP(null); api('/posts/' + id).then(setP).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="err">{err} <Link to="/news">← Xəbərlərə qayıt</Link></p>;
  if (!p) return <p className="muted">Yüklənir...</p>;
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, text: p.summary || p.title, url });
      else { await navigator.clipboard.writeText(url); setMsg('Link kopyalandı ✅'); }
    } catch { /* ləğv edildi */ }
  };
  return (
    <article className="card post">
      <Link to="/news" className="muted">← Xəbərlər</Link>
      <h1>{p.title}</h1>
      <small className="muted">{fmtDate(p.createdAt)}{p.author ? ' · ' + p.author : ''}</small>
      {p.image && <img className="post-img" src={p.image} alt="" />}
      <div className="post-body">{p.content}</div>
      <button className="ghost sm" onClick={share}>🔗 Paylaş</button>
      {msg && <p>{msg}</p>}
    </article>
  );
}
