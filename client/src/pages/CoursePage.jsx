import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getToken, getUser } from '../auth.js';
import MaterialsTab from '../components/MaterialsTab.jsx';
import { Button, Card, Input, Textarea, Field, Modal } from '../components/ui.jsx';

export default function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const [course, setCourse] = useState(null);
  const [projects, setProjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('projects');
  const [courseCode, setCourseCode] = useState('');

  const [creatingProject, setCreatingProject] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');

  const [editingCourse, setEditingCourse] = useState(false);
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');

  async function loadData() {
    try {
      const c = await api(`/courses/${id}`, { token: getToken() });
      setCourse(c);
      setProjects(await api(`/projects?courseId=${id}`, { token: getToken() }));
      if (user?.role === 'TEACHER') {
        setStudents(await api(`/courses/${id}/students`, { token: getToken() }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadData(); }, [id]);

  const projectDirty = name.trim() || description.trim() || deadline;
  function closeProject() {
    if (projectDirty && !window.confirm('Ви точно хочете вийти? Всі зміни будуть відкинуті')) return;
    setCreatingProject(false); setName(''); setDescription(''); setDeadline('');
  }
  async function handleCreateProject(e) {
    e.preventDefault(); setError('');
    try {
      await api('/projects', {
        method: 'POST',
        body: { name, description, deadline: deadline || null, courseId: Number(id) },
        token: getToken(),
      });
      setCreatingProject(false); setName(''); setDescription(''); setDeadline(''); loadData();
    } catch (err) { setError(err.message); }
  }

  function openEditCourse() {
    setEditingCourse(true); setCName(course.name); setCDesc(course.description || '');
  }
  const courseDirty = course && (cName !== course.name || cDesc !== (course.description || ''));
  function closeEditCourse() {
    if (courseDirty && !window.confirm('Ви точно хочете вийти? Всі зміни будуть відкинуті')) return;
    setEditingCourse(false);
  }
  async function handleSaveCourse(e) {
    e.preventDefault(); setError('');
    try {
      await api(`/courses/${id}`, { method: 'PATCH', body: { name: cName, description: cDesc }, token: getToken() });
      setEditingCourse(false); loadData();
    } catch (err) { setError(err.message); }
  }
  async function handleDeleteCourse() {
    if (!window.confirm('Ви впевнені? Будуть видалені всі проєкти, команди та завдання цього курсу.')) return;
    setError('');
    try { await api(`/courses/${id}`, { method: 'DELETE', token: getToken() }); navigate('/dashboard'); }
    catch (err) { setError(err.message); }
  }

  async function handleGenerateCourseCode() {
    setError('');
    try {
      const data = await api('/invitations', { method: 'POST', body: { type: 'COURSE', courseId: Number(id) }, token: getToken() });
      setCourseCode(data.code);
    } catch (err) { setError(err.message); }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;
  const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <Link to="/dashboard">← До курсів</Link>
      <h1 style={{ marginBottom: 4 }}>{course?.name}</h1>
      {course?.description && <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>{course.description}</p>}

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {user?.role === 'TEACHER' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <Button variant="secondary" onClick={handleGenerateCourseCode}>Згенерувати код запрошення</Button>
          <Link to={`/courses/${id}/gradebook`} className="btn btn-primary">Журнал оцінок</Link>
          <Button variant="secondary" onClick={openEditCourse}>Налаштувати курс</Button>
        </div>
      )}
      {courseCode && (
        <p style={{ marginBottom: 16 }}>
          Код: <strong style={{ fontSize: 18 }}>{courseCode}</strong>
          <small style={{ color: 'var(--color-muted)', marginLeft: 8 }}>(дайте студентам)</small>
        </p>
      )}

      {user?.role === 'TEACHER' && students.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 onClick={() => setStudentsOpen((v) => !v)} style={{ cursor: 'pointer' }}>
            {studentsOpen ? '▾' : '▸'} Записані студенти ({students.length})
          </h3>
          {studentsOpen && (
            <ul>
              {[...students].sort((a, b) => a.name.localeCompare(b.name, 'uk')).map((s) => (
                <li key={s.id}>{s.name} — {s.email}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: 'flex', marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => setTab('projects')} className={`tab${tab === 'projects' ? ' active' : ''}`}>Проєкти</button>
        <button onClick={() => setTab('materials')} className={`tab${tab === 'materials' ? ' active' : ''}`}>Навчальні матеріали</button>
      </div>

      {tab === 'projects' && (
        <>
          {user?.role === 'TEACHER' && (
            <Button onClick={() => setCreatingProject(true)} style={{ marginBottom: 16 }}>Створити проєкт</Button>
          )}
          {projects.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Проєктів ще немає.</p>}
          <div style={{ display: 'grid', gap: 12 }}>
            {sortedProjects.map((p) => (
              <Card key={p.id}>
                <Link to={`/projects/${p.id}`} style={{ fontWeight: 600, fontSize: 18 }}>{p.name}</Link>
                {p.description && <p style={{ margin: '4px 0', color: 'var(--color-muted)' }}>{p.description}</p>}
                {p.deadline && <small style={{ color: '#94a3b8' }}>Дедлайн: {new Date(p.deadline).toLocaleDateString()}</small>}
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === 'materials' && <MaterialsTab courseId={Number(id)} isTeacher={user?.role === 'TEACHER'} />}

      {creatingProject && (
        <Modal onClose={closeProject} title="Створити проєкт">
          <form onSubmit={handleCreateProject}>
            <Field><Input placeholder="Назва проєкту" value={name} onChange={(e) => setName(e.target.value)} maxLength={45} required /></Field>
            <Field><Textarea placeholder="Опис (необов'язково)" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <Field label="Дедлайн (необов'язково)">
              <Input type="date" value={deadline} min={minDate} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>Створити</Button>
              <Button type="button" variant="secondary" block onClick={closeProject}>Скасувати</Button>
            </div>
          </form>
        </Modal>
      )}

      {editingCourse && (
        <Modal onClose={closeEditCourse} title="Налаштувати курс">
          <form onSubmit={handleSaveCourse}>
            <Field><Input placeholder="Назва курсу" value={cName} onChange={(e) => setCName(e.target.value)} maxLength={45} required /></Field>
            <Field><Textarea placeholder="Опис (необов'язково)" value={cDesc} onChange={(e) => setCDesc(e.target.value)} /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>Зберегти</Button>
              <Button type="button" variant="secondary" block onClick={closeEditCourse}>Скасувати</Button>
            </div>
            <Button type="button" variant="danger" block onClick={handleDeleteCourse} style={{ marginTop: 8 }}>
              Видалити курс
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}