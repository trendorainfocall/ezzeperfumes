import React, { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { api, isAdmin } from './api.js';
import Home from './pages/Home.jsx';
import ProductPage from './pages/ProductPage.jsx';
import { Login, Register, Forgot } from './pages/Auth.jsx';
import Cart from './pages/Cart.jsx';
import Admin from './pages/Admin.jsx';
import Profile from './pages/Profile.jsx';
import Orders from './pages/Orders.jsx';
import Notifications from './pages/Notifications.jsx';
import Support from './pages/Support.jsx';
import { NewsList, NewsPost } from './pages/News.jsx';
import Branches from './pages/Branches.jsx';

const Ctx = createContext();

// localStorage-dakı səbət zədələnibsə və ya köhnə formatdadırsa səhifə çökməsin
const loadCart = () => {
  try {
    const c = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(c) ? c.filter((i) => i && i._id && Number(i.qty) > 0) : [];
  } catch { return []; }
};
export const useApp = () => useContext(Ctx);

export const Logo = ({ small }) => (
  <Link to="/" className="logo"><b>EZZE</b>{!small && <span>PARFUMES</span>}</Link>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(loadCart);
  const [q, setQ] = useState('');
  const [settings, setSettings] = useState({});
  const [unread, setUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);
  const nav = useNavigate();

  useEffect(() => { try { localStorage.setItem('cart', JSON.stringify(cart)); } catch { /* yaddaş doludur / bloklanıb */ } }, [cart]);
  useEffect(() => {
    if (localStorage.getItem('token')) api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token'));
    api('/settings').then(setSettings).catch(() => {});
  }, []);

  const refreshNotif = () => {
    if (!localStorage.getItem('token')) { setUnread(0); setSupportUnread(0); return; }
    api('/notifications').then((d) => setUnread(d.unread)).catch(() => {});
    api('/support/unread').then((d) => setSupportUnread(d.unread)).catch(() => {});
  };
  useEffect(() => { refreshNotif(); const t = setInterval(refreshNotif, 30000); return () => clearInterval(t); }, [user]);

  const login = ({ token, user }) => { localStorage.setItem('token', token); setUser(user); nav(isAdmin(user) ? '/admin' : '/'); };
  const logout = () => { localStorage.removeItem('token'); setUser(null); nav('/'); };
  const addToCart = (p) => setCart((c) => {
    const f = c.find((x) => x._id === p._id);
    return f ? c.map((x) => (x._id === p._id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { ...p, qty: 1 }];
  });

  return (
    <Ctx.Provider value={{ user, login, logout, cart, setCart, addToCart, q, setQ, settings, setSettings, unread, setUnread, supportUnread, refreshNotif, setUser }}>
      <Routes>
        <Route path="/admin" element={isAdmin(user) ? <Admin /> : <Navigate to="/login" />} />
        <Route path="*" element={<Shop />} />
      </Routes>
    </Ctx.Provider>
  );
}

function Footer() {
  const { settings: s } = useApp();
  return (
    <footer className="footer">
      <div><Logo /><p className="muted">{s.footerText}</p></div>
      <div className="muted">
        {s.address && <div>📍 {s.address}</div>}
        {s.phone && <div>📞 {s.phone}</div>}
        {s.email && <div>✉️ {s.email}</div>}
        {s.instagram && <div>📷 <a href={s.instagram} target="_blank" rel="noreferrer">Instagram</a></div>}
      </div>
      <div className="muted small">© {new Date().getFullYear()} EZZE Parfumes</div>
    </footer>
  );
}

function Shop() {
  const { user, logout, cart, q, setQ, settings, unread, supportUnread } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="shell">
      <header className="nav">
        <Logo />
        <div className="nav-right">
          <Link to="/cart" className="cartlink">🛒 <span className="cart-text">Səbət </span>({cart.reduce((s, i) => s + i.qty, 0)})</Link>
          <button className="burger" aria-label="Menyu" aria-expanded={open} aria-controls="main-links" onClick={() => setOpen((o) => !o)}>{open ? '✕' : '☰'}</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); nav('/'); setOpen(false); }} className="search">
          <input placeholder="Axtarış" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <nav id="main-links" className={'links' + (open ? ' open' : '')} onClick={() => setOpen(false)}>
          <Link to="/" className="shoplink" onClick={() => window.scrollTo({ top: 0 })}>🏬 Mağaza</Link>
          <Link to="/news">Xəbərlər</Link>
          <Link to="/branches">Filiallar</Link>
          {user ? (<>
            {isAdmin(user) && <Link to="/admin">Admin</Link>}
            <Link to="/profile">Profil</Link>
            <Link to="/orders">Sifarişlərim</Link>
            <Link to="/support">💬 Dəstək{supportUnread > 0 && <span className="dot">{supportUnread}</span>}</Link>
            <Link to="/notifications">🔔 <span className="bell-text">Bildirişlər</span>{unread > 0 && <span className="dot">{unread}</span>}</Link>
            <a onClick={logout}>Çıxış</a>
          </>) : (<><Link to="/login">Giriş</Link><Link to="/register">Qeydiyyat</Link></>)}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/support" element={<Support />} />
        <Route path="/news" element={<NewsList />} />
        <Route path="/news/:id" element={<NewsPost />} />
        <Route path="/branches" element={<Branches />} />
      </Routes>
      <Footer />
      {settings.whatsapp && (
        <a className="wa-float" href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer" title="WhatsApp">💬</a>
      )}
    </div>
  );
}
