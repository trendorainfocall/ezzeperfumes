import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

const ICON = { status: '📦', pdf: '📄', info: '🔔' };

export default function Notifications() {
  const { user, refreshNotif } = useApp();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('all');
  const load = () => api('/notifications').then((d) => { setItems(d.items); refreshNotif(); }).catch(() => setItems([]));
  useEffect(() => { if (user) load(); }, [user]);
  if (!user) return <p>Bildirişlər üçün <Link to="/login">daxil olun</Link>.</p>;
  if (!items) return <p className="muted">Yüklənir...</p>;

  const toggle = async (n) => { await api('/notifications/' + n._id, 'PUT', { read: !n.read }); load(); };
  const del = async (n) => { await api('/notifications/' + n._id, 'DELETE'); load(); };
  const readAll = async () => { await api('/notifications/read-all', 'PUT'); load(); };
  const shown = items.filter((n) => filter === 'all' || (filter === 'unread' ? !n.read : n.read));

  return (
    <div>
      <div className="row"><h2>Bildirişlər</h2><a onClick={readAll}>Hamısını oxunmuş et</a></div>
      <div className="tabs">
        {[['all', 'Hamısı'], ['unread', 'Oxunmamış'], ['read', 'Oxunmuş']].map(([k, l]) => (
          <a key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</a>))}
      </div>
      {!shown.length && <p className="muted">Bildiriş yoxdur.</p>}
      {shown.map((n) => (
        <div className={'card notif' + (n.read ? '' : ' unread')} key={n._id}>
          <div>
            <b>{ICON[n.type]} {n.title}</b>
            <p>{n.message}</p>
            <small className="muted">{new Date(n.createdAt).toLocaleString()}</small>
          </div>
          <div className="acts">
            {n.order && <Link to="/orders" onClick={() => !n.read && toggle(n)}>Sifarişə bax</Link>}
            <a onClick={() => toggle(n)}>{n.read ? 'Oxunmamış et' : 'Oxunmuş et'}</a>
            <a onClick={() => del(n)}>Sil</a>
          </div>
        </div>))}
    </div>
  );
}
