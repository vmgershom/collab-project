import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getToken, getUser } from '../auth.js';
import CommentBox from '../components/CommentBox.jsx';
import { Button, Card, Input, Textarea, Field, Modal } from '../components/ui.jsx';

export default function ProjectPage() {
  const { id } = useParams();
  const user = getUser();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [editingProject, setEditingProject] = useState(false);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pDeadline, setPDeadline] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  async function loadData() {
    try {
      const p = await api(`/projects/${id}`, { token: getToken() });
      setProject(p);
      const t = await api(`/teams?projectId=${id}`, { token: getToken() });
      setTeams(t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [id]);

  async function handleRedeem(e) {
    e.preventDefault(); setError(''); setInviteMessage('');
    try {
      const data = await api('/invitations/redeem', { method: 'POST', body: { code: inviteCode.trim() }, token: getToken() });
      setInviteMessage(data.message); setInviteCode(''); loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleCreateTeam(e) {
    e.preventDefault(); setError('');
    try {
      await api('/teams', { method: 'POST', body: { name: teamName, projectId: Number(id) }, token: getToken() });
      setTeamName(''); loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleDeleteProject() {
    if (!window.confirm('Ви впевнені? Будуть видалені всі команди та завдання цього проєкту.')) return;
    setError('');
    try {
      await api(`/projects/${id}`, { method: 'DELETE', token: getToken() });
      navigate(`/courses/${project.course.id}`);
    } catch (err) { setError(err.message); }
  }

  function openEditProject() {
    setEditingProject(true);
    setPName(project.name);
    setPDesc(project.description || '');
    setPDeadline(project.deadline ? project.deadline.split('T')[0] : '');
  }
  const projectDirty = project && (
    pName !== project.name ||
    pDesc !== (project.description || '') ||
    pDeadline !== (project.deadline ? project.deadline.split('T')[0] : '')
  );
  function closeEditProject() {
    if (projectDirty && !window.confirm('Ви точно хочете вийти? Всі зміни будуть відкинуті')) return;
    setEditingProject(false);
  }
  async function handleSaveProject(e) {
    e.preventDefault(); setError('');
    try {
      await api(`/projects/${id}`, { method: 'PATCH', body: { name: pName, description: pDesc, deadline: pDeadline || null }, token: getToken() });
      setEditingProject(false); loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleJoin(teamId) {
    setError('');
    try {
      await api(`/teams/${teamId}/members`, { method: 'POST', body: { userId: user.id }, token: getToken() });
      loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleLeave(teamId) {
    if (!window.confirm('Ви впевнені, що хочете покинути команду?')) return;
    setError('');
    try {
      await api(`/teams/${teamId}/members/${user.id}`, { method: 'DELETE', token: getToken() });
      loadData();
    } catch (err) { setError(err.message); }
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;

  const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const inATeam =
    user.role === 'STUDENT' && teams.some((t) => t.members.some((m) => m.userId === user.id));
  const canCreateTeam = user.role === 'TEACHER' || (user.role === 'STUDENT' && !inATeam);
  const isTeacherOwner = user.role === 'TEACHER' && project?.teacherId === user.id;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      {project && <Link to={`/courses/${project.course.id}`}>← До курсу</Link>}
      <h1 style={{ marginBottom: 4 }}>{project?.name}</h1>
      {project?.description && <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>{project.description}</p>}

      {user?.role === 'TEACHER' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Button variant="secondary" onClick={openEditProject}>Налаштувати проєкт</Button>
          <Button variant="danger" onClick={handleDeleteProject}>Видалити проєкт</Button>
        </div>
      )}

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {canCreateTeam && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Створити команду</h3>
          <form onSubmit={handleCreateTeam} style={{ display: 'flex', gap: 8 }}>
            <Input placeholder="Назва команди" value={teamName}
              onChange={(e) => setTeamName(e.target.value)} style={{ flex: 1 }} maxLength={45} required />
            <Button type="submit" style={{ flex: '0 0 25%' }}>Створити</Button>
          </form>
        </Card>
      )}

      {user.role === 'STUDENT' && !inATeam && (
        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Приєднатися за кодом</h3>
          <form onSubmit={handleRedeem} style={{ display: 'flex', gap: 8 }}>
            <Input placeholder="Вставте код запрошення" value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)} style={{ flex: 1 }} required />
            <Button type="submit" style={{ flex: '0 0 25%' }}>Приєднатися</Button>
          </form>
          {inviteMessage && <p style={{ color: 'var(--color-success)', marginBottom: 0 }}>{inviteMessage}</p>}
        </Card>
      )}

      <h2>Команди</h2>
      {teams.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Команд ще немає.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {teams.map((team) => {
          const isMember = team.members.some((m) => m.userId === user.id);
          return (
            <Card key={team.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                {isMember || isTeacherOwner ? (
                  <Link to={`/teams/${team.id}`} style={{ fontSize: 18, fontWeight: 600 }}>{team.name}</Link>
                ) : (
                  <strong style={{ fontSize: 18 }}>{team.name}</strong>
                )}
                {user.role === 'STUDENT' && isMember && team.status !== 'SUBMITTED' && (
                  <Button variant="secondary" onClick={() => handleLeave(team.id)}>Покинути команду</Button>
                )}
                {user.role === 'STUDENT' && !isMember && !inATeam && team.openJoin && (
                  <Button onClick={() => handleJoin(team.id)}>Приєднатися</Button>
                )}
                {user.role === 'STUDENT' && !isMember && !inATeam && !team.openJoin && (
                  <small style={{ color: '#94a3b8' }}>Лише за кодом</small>
                )}
              </div>
              <p style={{ margin: '8px 0 4px', color: 'var(--color-muted)' }}>Учасники:</p>
              {team.members.length === 0 ? (
                <small style={{ color: '#94a3b8' }}>Поки нікого</small>
              ) : (
                <ul style={{ margin: 0 }}>
                  {[...team.members]
                    .sort((a, b) => a.user.name.localeCompare(b.user.name, 'uk'))
                    .map((m) => (<li key={m.id}>{m.user.name}</li>))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <CommentBox scope="project" projectId={Number(id)} />
      </div>

      {editingProject && (
        <Modal onClose={closeEditProject} title="Налаштувати проєкт">
          <form onSubmit={handleSaveProject}>
            <Field><Input placeholder="Назва проєкту" value={pName} onChange={(e) => setPName(e.target.value)} maxLength={45} required /></Field>
            <Field><Textarea placeholder="Опис (необов'язково)" value={pDesc} onChange={(e) => setPDesc(e.target.value)} /></Field>
            <Field label="Дедлайн (необов'язково)">
              <Input type="date" value={pDeadline} min={minDate} onChange={(e) => setPDeadline(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>Зберегти</Button>
              <Button type="button" variant="secondary" block onClick={closeEditProject}>Скасувати</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}