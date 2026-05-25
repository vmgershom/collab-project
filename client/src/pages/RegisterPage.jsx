import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Button, Card, Input, Field, Select } from '../components/ui.jsx';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const pwOk = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
    if (!pwOk) {
      setError('Пароль має містити щонайменше 8 символів, хоча б одну латинську літеру та одну цифру');
      return;
    }
    setLoading(true);
    try {
      await api('/register', { method: 'POST', body: { name, email, password, role } });
      const data = await api('/login', { method: 'POST', body: { email, password } });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ textAlign: 'center' }}>Реєстрація</h1>
      <Card>
        <form onSubmit={handleSubmit}>
          <Field label="Ім'я">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Пароль">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            <small style={{ color: 'var(--color-muted)' }}>
              Мінімум 8 символів, хоча б 1 латинська літера та 1 цифра
            </small>
          </Field>
          <Field label="Роль">
            <Select
              value={role}
              onChange={(v) => setRole(v)}
              options={[
                { value: 'STUDENT', label: 'Студент' },
                { value: 'TEACHER', label: 'Викладач' },
              ]}
            />
          </Field>
          {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
          <Button type="submit" block disabled={loading}>
            {loading ? 'Реєстрація...' : 'Зареєструватися'}
          </Button>
        </form>
      </Card>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        Вже маєте акаунт? <Link to="/login">Увійти</Link>
      </p>
    </div>
  );
}