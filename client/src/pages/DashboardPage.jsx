import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { getToken, getUser } from '../auth.js';
import { Button, Card, Input, Textarea, Field, Modal } from '../components/ui.jsx';

export default function DashboardPage() {
  const user = getUser();
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  async function loadCourses() {
    try { setCourses(await api('/courses', { token: getToken() })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadCourses(); }, []);

  const formDirty = name.trim() || description.trim();
  function closeCreate() {
    if (formDirty && !window.confirm('Ви точно хочете вийти? Всі зміни будуть відкинуті')) return;
    setCreating(false); setName(''); setDescription('');
  }
  async function handleCreateCourse(e) {
    e.preventDefault(); setError('');
    try {
      await api('/courses', { method: 'POST', body: { name, description }, token: getToken() });
      setCreating(false); setName(''); setDescription(''); loadCourses();
    } catch (err) { setError(err.message); }
  }
  async function handleLeaveCourse(courseId) {
    if (!window.confirm('Ви впевнені? Вас буде видалено з усіх команд цього курсу.')) return;
    setError('');
    try { await api(`/courses/${courseId}/students`, { method: 'DELETE', token: getToken() }); loadCourses(); }
    catch (err) { setError(err.message); }
  }
  async function handleRedeem(e) {
    e.preventDefault(); setError(''); setInviteMessage('');
    try {
      const data = await api('/invitations/redeem', { method: 'POST', body: { code: inviteCode.trim() }, token: getToken() });
      setInviteMessage(data.message); setInviteCode(''); loadCourses();
    } catch (err) { setError(err.message); }
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 4 }}>Вітаємо, {user?.name}</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>
        Роль: {user?.role === 'TEACHER' ? 'Викладач' : 'Студент'}
      </p>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {user?.role === 'TEACHER' && (
        <Button onClick={() => setCreating(true)} style={{ marginBottom: 24 }}>Створити курс</Button>
      )}

      {user?.role === 'STUDENT' && (
        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Приєднатися за кодом</h3>
          <form onSubmit={handleRedeem} style={{ display: 'flex', gap: 8 }}>
            <Input placeholder="Вставте код запрошення" value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)} style={{ flex: 1 }} required />
            <Button type="submit">Приєднатися</Button>
          </form>
          {inviteMessage && <p style={{ color: 'var(--color-success)', marginBottom: 0 }}>{inviteMessage}</p>}
        </Card>
      )}

      <h2>Мої курси</h2>
      {courses.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Курсів ще немає.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {courses.map((c) => (
          <Card key={c.id}>
            <Link to={`/courses/${c.id}`} style={{ fontWeight: 600, fontSize: 18 }}>{c.name}</Link>
            {c.description && <p style={{ margin: '4px 0', color: 'var(--color-muted)' }}>{c.description}</p>}
            <small style={{ color: '#94a3b8' }}>Викладач: {c.teacher?.name}</small>
            {user?.role === 'STUDENT' && (
              <div style={{ marginTop: 12 }}>
                <Button variant="secondary" onClick={() => handleLeaveCourse(c.id)}>Покинути курс</Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {creating && (
        <Modal onClose={closeCreate} title="Створити курс">
          <form onSubmit={handleCreateCourse}>
            <Field><Input placeholder="Назва курсу" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field><Textarea placeholder="Опис (необов'язково)" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>Створити</Button>
              <Button type="button" variant="secondary" block onClick={closeCreate}>Скасувати</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}