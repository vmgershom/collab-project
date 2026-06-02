import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, BASE_URL } from '../api.js';
import { getToken, getUser } from '../auth.js';
import CommentBox from '../components/CommentBox.jsx';
import { Button, Card, Input, Textarea, Field, Modal, Select, DateTime, toInputDT, fmtDateTime } from '../components/ui.jsx';
import { RichTextEditor, RichTextView, isEmptyRich } from '../components/RichText.jsx';

const TEAM_SORTS = [{ value: 'name', label: 'За назвою' }, { value: 'status', label: 'За статусом' }];
const SOLO_SORTS = [{ value: 'name', label: 'За іменем' }, { value: 'status', label: 'За статусом' }];

export default function ProjectPage() {
  const { id } = useParams();
  const user = getUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initThread = searchParams.get('thread');
  const initStudent = searchParams.get('student') ? Number(searchParams.get('student')) : null;
  const [project, setProject] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [editingProject, setEditingProject] = useState(false);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pDeadline, setPDeadline] = useState('');
  const [pOpenAt, setPOpenAt] = useState('');
  const [pMax, setPMax] = useState('100');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [myGrade, setMyGrade] = useState(null);
  const attachRef = useRef(null);
  const [attachLinkModal, setAttachLinkModal] = useState(false);
  const [attachUrl, setAttachUrl] = useState('');

  const [mySub, setMySub] = useState({ files: [], links: [], submitted: false });
  const [soloStudents, setSoloStudents] = useState([]);
  const [soloFiles, setSoloFiles] = useState([]);
  const [soloUrl, setSoloUrl] = useState('');
  const [projGrades, setProjGrades] = useState({});
  const [gradeDrafts, setGradeDrafts] = useState({});

  const [sortBy, setSortBy] = useState('name');

  async function loadData() {
    try {
      const p = await api(`/projects/${id}`, { token: getToken() });
      setProject(p);
      if (p.type === 'SOLO') {
        if (user.role === 'TEACHER') {
          const d = await api(`/submissions/project/${id}`, { token: getToken() });
          setSoloStudents(d.students);
        } else {
          const d = await api(`/submissions/project/${id}/my`, { token: getToken() });
          setMySub(d);
        }
      } else {
        const t = await api(`/teams?projectId=${id}`, { token: getToken() });
        setTeams(t);
      }
      if (user.role === 'STUDENT') {
        const g = await api('/grades/my', { token: getToken() });
        const row = g.find((r) => r.projectId === Number(id));
        setMyGrade(row ? row.score : null);
      }
      if (user.role === 'TEACHER') {
        const gb = await api(`/grades/course/${p.course.id}`, { token: getToken() });
        const pg = {};
        Object.entries(gb.grades).forEach(([key, score]) => {
          const [sid, pid] = key.split('-').map(Number);
          if (pid === Number(id)) pg[sid] = score;
        });
        setProjGrades(pg);
        setGradeDrafts(Object.fromEntries(Object.entries(pg).map(([k, v]) => [k, String(v)])));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    const handler = (e) => {
      if (user.role === 'STUDENT' && project?.type === 'SOLO' && !mySub.submitted && (mySub.files.length > 0 || mySub.links.length > 0)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [user.role, project, mySub.submitted, mySub.files.length, mySub.links.length]);

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

  async function uploadAttachFiles(e) {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    e.target.value = ''; setError('');
    try {
      const fd = new FormData();
      selected.forEach((f) => fd.append('files', f));
      const res = await fetch(`${BASE_URL}/projects/${id}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Помилка');
      loadData();
    } catch (err) { setError(err.message); }
  }
  async function submitAttachLink(e) {
    e.preventDefault(); setError('');
    if (!attachUrl.trim()) return;
    try {
      const fd = new FormData();
      fd.append('url', attachUrl.trim());
      const res = await fetch(`${BASE_URL}/projects/${id}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Помилка');
      setAttachLinkModal(false); setAttachUrl(''); loadData();
    } catch (err) { setError(err.message); }
  }
  async function deleteAttachment(attId) {
    if (!window.confirm('Видалити вкладення?')) return;
    setError('');
    try {
      await api(`/projects/attachments/${attId}`, { method: 'DELETE', token: getToken() });
      loadData();
    } catch (err) { setError(err.message); }
  }

  function openEditProject() {
    setEditingProject(true);
    setPName(project.name);
    setPDesc(project.description || '');
    setPDeadline(toInputDT(project.deadline));
    setPMax(String(project.maxScore));
    setPOpenAt(toInputDT(project.openAt));
  }

  const projectDirty = project && (
    pName !== project.name ||
    pDesc !== (project.description || '') ||
    pDeadline !== toInputDT(project.deadline) ||
    pMax !== String(project.maxScore) ||
    pOpenAt !== toInputDT(project.openAt)
  );
  function closeEditProject() {
    if (projectDirty && !window.confirm('Ви точно хочете вийти? Всі зміни будуть відкинуті')) return;
    setEditingProject(false);
  }
  async function handleSaveProject(e) {
    e.preventDefault(); setError('');
    try {
      await api(`/projects/${id}`, { method: 'PATCH', body: { name: pName, description: pDesc, deadline: pDeadline || null, maxScore: pMax, openAt: pOpenAt || null }, token: getToken() });
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

  function addSoloFiles(e) { const sel = Array.from(e.target.files); setSoloFiles((p) => [...p, ...sel]); e.target.value = ''; }
  function removeSoloFile(i) { setSoloFiles((p) => p.filter((_, idx) => idx !== i)); }
  async function submitSolo(e) {
    e.preventDefault(); setError('');
    if (soloFiles.length === 0 && !soloUrl.trim() && mySub.files.length === 0 && mySub.links.length === 0) { setError('Додайте файл або посилання'); return; }
    try {
      const fd = new FormData();
      soloFiles.forEach((f) => fd.append('files', f));
      if (soloUrl.trim()) fd.append('url', soloUrl.trim());
      const res = await fetch(`${BASE_URL}/submissions/project/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Помилка');
      setMySub(data); setSoloFiles([]); setSoloUrl('');
    } catch (err) { setError(err.message); }
  }

  async function cancelSubmission() {
    setError('');
    try {
      const data = await api(`/submissions/project/${id}/cancel`, { method: 'PUT', token: getToken() });
      setMySub(data);
    } catch (err) { setError(err.message); }
  }
  async function deleteSoloItem(itemId) {
    setError('');
    try { await api(`/submissions/${itemId}`, { method: 'DELETE', token: getToken() }); loadData(); }
    catch (err) { setError(err.message); }
  }

  async function saveGrade(studentId) {
    const max = project.maxScore ?? 100;
    const raw = gradeDrafts[studentId];
    if (raw === undefined || raw === '') return;
    const score = Number(raw);
    if (isNaN(score) || score < 0 || score > max) { setError(`Оцінка має бути від 0 до ${max}`); return; }
    if (projGrades[studentId] === score) return;
    setError('');
    try {
      await api('/grades', { method: 'PUT', body: { studentId, projectId: Number(id), score }, token: getToken() });
      setProjGrades((g) => ({ ...g, [studentId]: score }));
    } catch (err) { setError(err.message); }
  }
  function gradeRow(studentId) {
    const max = project.maxScore ?? 100;
    const saved = projGrades[studentId];
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <input className="input" type="number" min={0} max={max}
          value={gradeDrafts[studentId] ?? ''}
          onChange={(e) => setGradeDrafts((d) => ({ ...d, [studentId]: e.target.value }))}
          onBlur={() => saveGrade(studentId)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
          style={{ width: 70, padding: '4px 8px' }} />
        <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/ {max}</span>
        {saved != null && <span style={{ color: 'var(--color-success)', fontSize: 13 }}>✓</span>}
      </div>
    );
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;

  if (!project) return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <p style={{ color: 'var(--color-danger)' }}>{error || 'Не вдалося завантажити проєкт.'}</p>
    </div>
  );
  if (project.locked) return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <Link to={`/courses/${project.course.id}`}>← До курсу</Link>
      <h1 style={{ marginBottom: 4 }}>{project.name}</h1>
      <Card style={{ marginTop: 16 }}>
        <p style={{ margin: 0, color: 'var(--color-muted)' }}>Цей проєкт ще не відкрито. Відкриється {fmtDateTime(project.openAt)}.</p>
      </Card>
    </div>
  );

  const minDate = (() => {
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  })();

  const isSolo = project.type === 'SOLO';
  const inATeam = user.role === 'STUDENT' && teams.some((t) => t.members.some((m) => m.userId === user.id));
  const myTeam = !isSolo ? teams.find((t) => t.members.some((m) => m.userId === user.id)) : null;
  const submitted = user.role === 'STUDENT' && (isSolo ? (mySub.files.length > 0 || mySub.links.length > 0) : myTeam?.status === 'SUBMITTED');
  const canCreateTeam = user.role === 'TEACHER' || (user.role === 'STUDENT' && !inATeam);
  const isTeacherOwner = user.role === 'TEACHER' && project?.teacherId === user.id;
  const lateOf = (when) => !!(project?.deadline && when && new Date(when) > new Date(project.deadline));
  const studentLate = isSolo ? lateOf(mySub.lastAt) : lateOf(myTeam?.submittedAt);
  const byName = (a, b) => a.name.localeCompare(b.name, 'uk');
  const teamSubmitted = (t) => (t.status === 'SUBMITTED' ? 0 : 1);
  const soloSubmitted = (s) => (s.lastAt ? 0 : 1);
  const sortedTeams = [...teams].sort((a, b) =>
    sortBy === 'status' ? (teamSubmitted(a) - teamSubmitted(b)) || byName(a, b) : byName(a, b)
  );
  const sortedSolo = [...soloStudents].sort((a, b) =>
    sortBy === 'status' ? (soloSubmitted(a) - soloSubmitted(b)) || byName(a, b) : byName(a, b)
  );
  const soloHasItems = mySub.files.length > 0 || mySub.links.length > 0;
  const soloEditing = !mySub.submitted;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      {project && (
        <Link to={`/courses/${project.course.id}`} onClick={(e) => {
          if (project?.type === 'SOLO' && user.role === 'STUDENT' && !mySub.submitted && (mySub.files.length > 0 || mySub.links.length > 0)) {
            if (!window.confirm('У вас є чернетка здачі, яку ви не подали. Покинути сторінку?')) {
              e.preventDefault();
            }
          }
        }}>← До курсу</Link>
      )}
      <h1 style={{ marginBottom: 4 }}>{project?.name}</h1>
      {!isEmptyRich(project?.description) && <RichTextView html={project.description} style={{ color: 'var(--color-muted)', marginTop: 0 }} />}
      {project.deadline && (
        <p style={{ color: 'var(--color-muted)', margin: '4px 0' }}>
          <small style={{ color: '#94a3b8', display: 'block' }}>Дедлайн: {fmtDateTime(project.deadline)}</small>
        </p>
      )}
      {project.openAt && new Date(project.openAt) > new Date() && (
        <p style={{ color: 'var(--color-muted)', margin: '4px 0' }}>
          Відкриється: <strong>{fmtDateTime(project.openAt)}</strong>
        </p>
      )}

      {user?.role === 'TEACHER' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Button variant="secondary" onClick={openEditProject}>Налаштувати проєкт</Button>
          <Button variant="danger" onClick={handleDeleteProject}>Видалити проєкт</Button>
        </div>
      )}

      {user.role === 'STUDENT' && myGrade != null && (
        <Card style={{ marginBottom: 16 }}>
          <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Оцінено</span>
          <div style={{ marginTop: 4 }}><strong>Ваша оцінка: {myGrade}{project?.maxScore != null ? ` / ${project.maxScore}` : ''}</strong></div>
        </Card>
      )}
      {user.role === 'STUDENT' && myGrade == null && submitted && (
        <Card style={{ marginBottom: 16 }}>
          {studentLate
            ? <span style={{ color: '#d97706', fontWeight: 600 }}>Здано із запізненням. Очікуйте на оцінювання</span>
            : <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Здано. Очікуйте на оцінювання</span>}
        </Card>
      )}

      {(project.attachments?.length > 0 || user.role === 'TEACHER') && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Матеріали проєкту</h3>
          {(!project.attachments || project.attachments.length === 0) && user.role === 'TEACHER' && (
            <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>Поки нічого не додано</p>
          )}
          {project.attachments?.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
              {project.attachments.map((a) => (
                <li key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  {a.filePath
                    ? <a href={`${BASE_URL}/projects/attachments/${a.id}/download`} style={{ overflowWrap: 'anywhere' }}>{a.fileName}</a>
                    : <a href={a.url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{a.url}</a>}
                  {user.role === 'TEACHER' && (
                    <button type="button" onClick={() => deleteAttachment(a.id)} aria-label="Видалити"
                      style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✖</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {user.role === 'TEACHER' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input ref={attachRef} type="file" multiple onChange={uploadAttachFiles} style={{ display: 'none' }} />
              <Button variant="secondary" onClick={() => attachRef.current.click()}>Додати файли</Button>
              <Button variant="secondary" onClick={() => { setAttachUrl(''); setAttachLinkModal(true); }}>Додати посилання</Button>
            </div>
          )}
        </Card>
      )}

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {isSolo && user.role === 'STUDENT' && (
        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Моя робота</h3>
          {soloHasItems && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
              {mySub.files.map((f) => (
                <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <a href={`${BASE_URL}/submissions/files/${f.id}/download`} style={{ overflowWrap: 'anywhere' }}>{f.fileName}</a>
                  {soloEditing && (
                    <button type="button" onClick={() => deleteSoloItem(f.id)} aria-label="Відкріпити"
                      style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', flexShrink: 0, fontSize: 16 }}>✖</button>
                  )}
                </li>
              ))}
              {mySub.links.map((l) => (
                <li key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <a href={l.url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{l.url}</a>
                  {soloEditing && (
                    <button type="button" onClick={() => deleteSoloItem(l.id)} aria-label="Відкріпити"
                      style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', flexShrink: 0, fontSize: 16 }}>✖</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {soloEditing ? (
            <form onSubmit={submitSolo}>
              {!soloHasItems && <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>Ви ще нічого не здали.</p>}
              <Field label="Додати файли"><input type="file" multiple onChange={addSoloFiles} /></Field>
              {soloFiles.length > 0 && (
                <ul style={{ fontSize: 14, listStyle: 'none', padding: 0 }}>
                  {soloFiles.map((f, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{f.name}
                      <button type="button" onClick={() => removeSoloFile(i)} style={{ marginLeft: 8, border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}>✖</button>
                    </li>
                  ))}
                </ul>
              )}
              <Field label="Додати посилання"><Input placeholder="https://..." value={soloUrl} onChange={(e) => setSoloUrl(e.target.value)} /></Field>
              <Button type="submit">Здати</Button>
            </form>
          ) : (
            <Button variant="secondary" onClick={cancelSubmission}>Відмінити здачу</Button>
          )}
        </Card>
      )}

      {isSolo && user.role === 'TEACHER' && (
        <div style={{ marginBottom: 24 }}>
          <h2>Роботи студентів</h2>
          {soloStudents.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>На курсі немає студентів.</p>
          ) : (
            <div style={{ maxWidth: 240, marginBottom: 12 }}><Select value={sortBy} onChange={setSortBy} options={SOLO_SORTS} /></div>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            {sortedSolo.map((s) => (
              <Card key={s.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ overflowWrap: 'anywhere' }}>{s.name}</strong>
                  {s.lastAt && (
                    lateOf(s.lastAt)
                      ? <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Здано із запізненням</span>
                      : <span style={{ background: '#dcfce7', color: 'var(--color-success)', borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Здано</span>
                  )}
                </div>
                {(s.files.length > 0 || s.links.length > 0) && (
                  <ul style={{ margin: '8px 0 0' }}>
                    {s.files.map((f) => (<li key={f.id}><a href={`${BASE_URL}/submissions/files/${f.id}/download`} style={{ overflowWrap: 'anywhere' }}>{f.fileName}</a></li>))}
                    {s.links.map((l) => (<li key={l.id}><a href={l.url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{l.url}</a></li>))}
                  </ul>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>Оцінка:</span>
                  {gradeRow(s.id)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isSolo && (
        <>
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
          {isTeacherOwner && teams.length > 0 && (
            <div style={{ maxWidth: 240, marginBottom: 12 }}><Select value={sortBy} onChange={setSortBy} options={TEAM_SORTS} /></div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {sortedTeams.map((team) => {
              const isMember = team.members.some((m) => m.userId === user.id);
              return (
                <Card key={team.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {isMember || isTeacherOwner ? (
                        <Link to={`/teams/${team.id}`} style={{ fontSize: 18, fontWeight: 600, overflowWrap: 'anywhere' }}>{team.name}</Link>
                      ) : (
                        <strong style={{ fontSize: 18, overflowWrap: 'anywhere' }}>{team.name}</strong>
                      )}
                      {team.status === 'SUBMITTED' && (
                        lateOf(team.submittedAt)
                          ? <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Здано із запізненням</span>
                          : <span style={{ background: '#dcfce7', color: 'var(--color-success)', borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Здано</span>
                      )}
                    </div>
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
                    <ul style={{ margin: 0, listStyle: isTeacherOwner ? 'none' : 'disc', padding: isTeacherOwner ? 0 : undefined }}>
                      {[...team.members]
                        .sort((a, b) => a.user.name.localeCompare(b.user.name, 'uk'))
                        .map((m) => (
                          isTeacherOwner ? (
                            <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ overflowWrap: 'anywhere' }}>{m.user.name}</span>
                              {gradeRow(m.userId)}
                            </li>
                          ) : (
                            <li key={m.id}>{m.user.name}</li>
                          )
                        ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <div style={{ marginTop: 24 }}>
        <CommentBox scope="project" projectId={Number(id)} initialThread={initThread} initialStudent={initStudent} />
      </div>

      {editingProject && (
        <Modal onClose={closeEditProject} title="Налаштувати проєкт">
          <form onSubmit={handleSaveProject}>
            <Field><Input placeholder="Назва проєкту" value={pName} onChange={(e) => setPName(e.target.value)} maxLength={45} required /></Field>
            <Field label="Опис (необов'язково)"><RichTextEditor value={pDesc} onChange={setPDesc} placeholder="Опис проєкту..." /></Field>
            <Field label="Максимальна оцінка"><Input type="number" min={1} max={100} value={pMax} onChange={(e) => setPMax(e.target.value)} /></Field>
            <Field label="Дедлайн (необов'язково)"><DateTime value={pDeadline} min={minDate} onChange={setPDeadline} /></Field>
            <Field label="Відкрити для студентів (необов'язково)"><DateTime value={pOpenAt} min={minDate} onChange={setPOpenAt} /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>Зберегти</Button>
              <Button type="button" variant="secondary" block onClick={closeEditProject}>Скасувати</Button>
            </div>
          </form>
        </Modal>
      )}

      {attachLinkModal && (
        <Modal onClose={() => setAttachLinkModal(false)} title="Додати посилання">
          <form onSubmit={submitAttachLink}>
            <Field><Input placeholder="https://..." value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} required /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>Додати</Button>
              <Button type="button" variant="secondary" block onClick={() => setAttachLinkModal(false)}>Скасувати</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}