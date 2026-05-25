import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Button, Card, Input, Field } from '../components/ui.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
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
      <h1 style={{ textAlign: 'center' }}>Вхід</h1>
      <Card>
        <form onSubmit={handleSubmit}>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Пароль">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
          <Button type="submit" block disabled={loading}>
            {loading ? 'Вхід...' : 'Увійти'}
          </Button>
        </form>
      </Card>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        Немає акаунта? <Link to="/register">Зареєструватися</Link>
      </p>
    </div>
  );
}