import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

function Form({ mode }) {
  const { login } = useApp();
  const [f, setF] = useState({ name: '', email: '', password: '', pin: '' });
  const [err, setErr] = useState('');
  const [show, setShow] = useState(false);
  const reg = mode === 'register';
  const submit = async (e) => {
    e.preventDefault();
    try { login(await api('/auth/' + mode, 'POST', f)); } catch (x) { setErr(x.message); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card auth" onSubmit={submit}>
      <h2>{reg ? 'Qeydiyyat' : 'Giriş'}</h2>
      {reg && <input placeholder="Ad Soyad" value={f.name} onChange={set('name')} />}
      <input type="email" placeholder="E-poçt" value={f.email} onChange={set('email')} />
      <input type={show ? 'text' : 'password'} placeholder="Şifrə" value={f.password} onChange={set('password')} autoComplete={reg ? 'new-password' : 'current-password'} />
      <label className="chk muted"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Şifrəni göstər</label>
      {reg && (<>
        <input inputMode="numeric" maxLength={6} placeholder="PIN kod (4-6 rəqəm)" value={f.pin} onChange={set('pin')} />
        <small className="muted">PIN kodu yadda saxlayın – şifrəni unutsanız onunla bərpa edəcəksiniz.</small>
      </>)}
      {err && <p className="err">{err}</p>}
      <button className="gold">{reg ? 'Qeydiyyatdan keç' : 'Daxil ol'}</button>
      {!reg && <p className="muted"><Link to="/forgot">Şifrəni unutmusan?</Link></p>}
      <p className="muted">{reg ? <>Hesabın var? <Link to="/login">Giriş</Link></> : <>Hesabın yoxdur? <Link to="/register">Qeydiyyat</Link></>}</p>
    </form>
  );
}
export const Login = () => <Form mode="login" />;
export const Register = () => <Form mode="register" />;

export function Forgot() {
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', pin: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/auth/reset-password', 'POST', f); setMsg('✅ Şifrə yeniləndi. Giriş səhifəsinə yönləndirilirsiniz...'); setTimeout(() => nav('/login'), 1500); }
    catch (x) { setErr(x.message); }
  };
  return (
    <form className="card auth" onSubmit={submit}>
      <h2>Şifrə bərpası</h2>
      <input type="email" placeholder="E-poçt" value={f.email} onChange={set('email')} />
      <input inputMode="numeric" maxLength={6} placeholder="PIN kod" value={f.pin} onChange={set('pin')} />
      <input type="password" placeholder="Yeni şifrə (min. 6)" value={f.newPassword} onChange={set('newPassword')} />
      {err && <p className="err">{err}</p>}{msg && <p>{msg}</p>}
      <button className="gold">Şifrəni yenilə</button>
      <p className="muted"><Link to="/login">← Girişə qayıt</Link></p>
    </form>
  );
}
