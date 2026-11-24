import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { useApp } from '../App.jsx';

// Ümumi çat komponenti: həm müştəri, həm admin tərəfi üçün (polling ilə yenilənir)
export function Chat({ base, mine, empty = 'Hələ mesaj yoxdur.', onSeen }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const last = useRef(null);
  const box = useRef();
  const stick = useRef(true);

  const merge = (list) => setMsgs((cur) => {
    const ids = new Set(cur.map((m) => m._id));
    const add = list.filter((m) => !ids.has(m._id));
    return add.length ? [...cur, ...add] : cur;
  });
  const poll = async () => {
    if (document.hidden) return;
    try {
      const list = await api(base + (last.current ? '?after=' + encodeURIComponent(last.current) : ''));
      if (list.length) { last.current = list[list.length - 1].createdAt; merge(list); onSeen?.(); }
    } catch { /* növbəti cəhddə yenilənəcək */ }
  };
  useEffect(() => {
    setMsgs([]); last.current = null;
    poll();
    const t = setInterval(poll, 4000);
    const vis = () => !document.hidden && poll();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [base]);
  useEffect(() => { if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setErr('');
    try { const m = await api(base, 'POST', { text: t }); last.current = m.createdAt; merge([m]); setText(''); stick.current = true; }
    catch (x) { setErr(x.message); }
    finally { setSending(false); }
  };

  return (
    <div className="chat">
      <div className="chat-box" ref={box} onScroll={(e) => { const b = e.target; stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 60; }}>
        {!msgs.length && <p className="muted center-text">{empty}</p>}
        {msgs.map((m) => (
          <div key={m._id} className={'bubble ' + (m.from === mine ? 'me' : 'them')}>
            {m.from !== mine && m.adminName && <small className="who">{m.adminName}</small>}
            <span>{m.text}</span>
            <small className="when">{fmtDate(m.createdAt)}</small>
          </div>))}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input value={text} maxLength={2000} placeholder="Mesajınızı yazın..." onChange={(e) => setText(e.target.value)} />
        <button className="gold" disabled={sending || !text.trim()}>Göndər</button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function Support() {
  const { user, refreshNotif } = useApp();
  if (!user) return <p>Dəstək üçün <Link to="/login">daxil olun</Link>.</p>;
  return (
    <div>
      <h2>Dəstək</h2>
      <p className="muted">Sualınızı yazın — komandamız tezliklə cavab verəcək. Yazışma tarixçəsi burada saxlanılır.</p>
      <div className="card">
        <Chat base="/support/messages" mine="user" empty="Salam! Necə kömək edə bilərik?" onSeen={refreshNotif} />
      </div>
    </div>
  );
}
