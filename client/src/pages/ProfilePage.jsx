import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, apiUpload, BASE_URL } from '../api.js';
import { getToken, getUser, logout } from '../auth.js';
import { Button, Card, Input, Field } from '../components/ui.jsx';

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getUser();
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState({ name: user?.name, email: user?.email, role: user?.role, avatar: user?.avatar });
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleSave(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (password && !(password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password))) {
      setError('Пароль має містити щонайменше 8 символів, хоча б одну латинську літеру та одну цифру');
      return;
    }
    try {
      const body = { name, email };
      if (password) body.password = password;
      const updated = await api('/me', { method: 'PATCH', body, token: getToken() });
      localStorage.setItem('user', JSON.stringify(updated));
      setInfo({ name: updated.name, email: updated.email, role: updated.role, avatar: updated.avatar });
      setPassword(''); setEditing(false); setNotice('Дані оновлено');
    } catch (err) { setError(err.message); }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    try {
      const updated = await apiUpload('/me/avatar', file, getToken());
      localStorage.setItem('user', JSON.stringify(updated));
      setInfo({ name: updated.name, email: updated.email, role: updated.role, avatar: updated.avatar });
      setNotice('Аватар оновлено');
    } catch (err) { setError(err.message); }
  }

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 16px' }}>
      <h1>Профіль</h1>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {notice && <p style={{ color: 'var(--color-success)' }}>{notice}</p>}

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
          {info.avatar ? (
            <img src={BASE_URL + info.avatar} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#9ca3af"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
            </div>
          )}
          <label style={{ marginTop: 10 }}>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            <span className="btn btn-secondary" style={{ cursor: 'pointer' }}>Змінити фото</span>
          </label>
        </div>

        {!editing ? (
          <div>
            <p style={{ margin: '4px 0' }}><strong>Ім'я:</strong> {info.name}</p>
            <p style={{ margin: '4px 0' }}><strong>Email:</strong> {info.email}</p>
            <p style={{ margin: '4px 0' }}><strong>Роль:</strong> {info.role === 'TEACHER' ? 'Викладач' : 'Студент'}</p>
            {info.role === 'STUDENT' && (
              <Link to="/grades" style={{ display: 'inline-block', margin: '8px 0 12px' }}>Мої оцінки →</Link>
            )}
            <div><Button onClick={() => { setEditing(true); setNotice(''); }}>Змінити дані</Button></div>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <Field label="Ім'я"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required /></Field>
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Новий пароль (порожнє — не міняти)">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <small style={{ color: 'var(--color-muted)' }}>
                Мінімум 8 символів, хоча б 1 латинська літера та 1 цифра
              </small>
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>Зберегти</Button>
              <Button type="button" variant="secondary" block
                onClick={() => { setEditing(false); setName(info.name); setEmail(info.email); setPassword(''); setError(''); }}>
                Скасувати
              </Button>
            </div>
          </form>
        )}
      </Card>

      <div style={{ marginTop: 16 }}>
        <Button variant="danger" onClick={handleLogout}>Вийти</Button>
      </div>
    </div>
  );
}