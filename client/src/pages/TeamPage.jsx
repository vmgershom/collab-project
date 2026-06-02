import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, BASE_URL } from '../api.js';
import { getToken, getUser } from '../auth.js';
import CommentBox from '../components/CommentBox.jsx';
import { Button, Card, Input, Textarea, Field, Select, Modal, DateTime, toInputDT, fmtDateTime } from '../components/ui.jsx';

const statusLabel = { TODO: 'До виконання', IN_PROGRESS: 'В роботі', DONE: 'Виконано' };

function Stars({ rateeId, score, onRate }) {
  const [hover, setHover] = useState(0);
  return (
    <span>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i}
          onClick={() => onRate(rateeId, i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          style={{ cursor: 'pointer', fontSize: 26, color: i <= (hover || score) ? '#f59e0b' : '#d1d5db' }}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function TeamPage() {
  const { id } = useParams();
  const user = getUser();
  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [teamCode, setTeamCode] = useState('');
  const [ratings, setRatings] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [teamFiles, setTeamFiles] = useState([]);
  const teamFileRef = useRef(null);

  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [taskFiles, setTaskFiles] = useState({});
  const uploadTaskIdRef = useRef(null);
  const taskFileRef = useRef(null);

  const [taskFormMode, setTaskFormMode] = useState(null);
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tAssignee, setTAssignee] = useState('');
  const [tDeadline, setTDeadline] = useState('');

  const [linkModal, setLinkModal] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');

  const [project, setProject] = useState(null);
  const [projGrades, setProjGrades] = useState({});
  const [gradeDrafts, setGradeDrafts] = useState({});

  async function loadData() {
    try {
      const t = await api(`/teams/${id}`, { token: getToken() });
      setTeam(t);
      setTasks(await api(`/tasks?teamId=${id}`, { token: getToken() }));
      setTeamFiles(await api(`/submissions/team/${id}`, { token: getToken() }));
      if (user.role === 'STUDENT') {
        const mine = await api(`/ratings/mine?teamId=${id}`, { token: getToken() });
        const map = {};
        mine.forEach((r) => { map[r.rateeId] = r.score; });
        setRatings(map);
      } else if (user.role === 'TEACHER') {
        const proj = await api(`/projects/${t.project.id}`, { token: getToken() });
        setProject(proj);
        const gb = await api(`/grades/course/${proj.courseId}`, { token: getToken() });
        const pg = {};
        Object.entries(gb.grades).forEach(([k, score]) => {
          const [sid, pid] = k.split('-').map(Number);
          if (pid === proj.id) pg[sid] = score;
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

  const isMember = team?.members.some((m) => m.userId === user.id);
  const teamSubmitted = team?.status === 'SUBMITTED';
  const lateTeam = !!(team?.submittedAt && team?.project?.deadline && new Date(team.submittedAt) > new Date(team.project.deadline));
  const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  async function uploadFiles(url, fileList) {
    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append('files', f));
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Помилка завантаження');
    return data;
  }
  async function uploadUrl(url, link) {
    const fd = new FormData();
    fd.append('url', link);
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Помилка');
    return data;
  }

  async function submitLink(e) {
    e.preventDefault(); setError('');
    if (!linkUrl.trim()) return;
    try {
      if (linkModal.kind === 'team') {
        await uploadUrl(`/submissions/team/${id}`, linkUrl.trim());
        setTeamFiles(await api(`/submissions/team/${id}`, { token: getToken() }));
      } else {
        const tid = linkModal.taskId;
        await uploadUrl(`/submissions/task/${tid}`, linkUrl.trim());
        const files = await api(`/submissions/task/${tid}`, { token: getToken() });
        setTaskFiles((prev) => ({ ...prev, [tid]: files }));
      }
      setLinkModal(null); setLinkUrl('');
    } catch (err) { setError(err.message); }
  }

  async function handleTeamFiles(e) {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    e.target.value = ''; setError('');
    try {
      await uploadFiles(`/submissions/team/${id}`, selected);
      setTeamFiles(await api(`/submissions/team/${id}`, { token: getToken() }));
    } catch (err) { setError(err.message); }
  }

  async function deleteTeamFile(fileId) {
    if (!window.confirm('Відкріпити файл?')) return;
    try {
      await api(`/submissions/${fileId}`, { method: 'DELETE', token: getToken() });
      setTeamFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) { setError(err.message); }
  }

  async function toggleTask(taskId) {
    if (expandedTaskId === taskId) { setExpandedTaskId(null); return; }
    setExpandedTaskId(taskId);
    try {
      const files = await api(`/submissions/task/${taskId}`, { token: getToken() });
      setTaskFiles((prev) => ({ ...prev, [taskId]: files }));
    } catch (err) { setError(err.message); }
  }

  async function handleTaskFiles(e) {
    const selected = Array.from(e.target.files);
    const taskId = uploadTaskIdRef.current;
    if (!selected.length || !taskId) return;
    e.target.value = ''; setError('');
    try {
      await uploadFiles(`/submissions/task/${taskId}`, selected);
      const files = await api(`/submissions/task/${taskId}`, { token: getToken() });
      setTaskFiles((prev) => ({ ...prev, [taskId]: files }));
    } catch (err) { setError(err.message); }
  }

  async function deleteTaskFile(taskId, fileId) {
    if (!window.confirm('Відкріпити файл?')) return;
    try {
      await api(`/submissions/${fileId}`, { method: 'DELETE', token: getToken() });
      setTaskFiles((prev) => ({ ...prev, [taskId]: prev[taskId].filter((f) => f.id !== fileId) }));
    } catch (err) { setError(err.message); }
  }

  async function updateTaskStatus(task, status) {
    setError('');
    try {
      await api(`/tasks/${task.id}`, { method: 'PATCH', body: { status }, token: getToken() });
      loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleSetTeamStatus(status) {
    setError('');
    try {
      await api(`/teams/${id}`, { method: 'PATCH', body: { status }, token: getToken() });
      loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleRate(rateeId, score) {
    setError('');
    try {
      await api('/ratings', { method: 'POST', body: { teamId: Number(id), rateeId, score }, token: getToken() });
      setRatings((prev) => ({ ...prev, [rateeId]: score }));
    } catch (err) { setError(err.message); }
  }

  async function handleGenerateTeamCode() {
    setError('');
    try {
      const data = await api('/invitations', { method: 'POST', body: { type: 'TEAM', teamId: Number(id) }, token: getToken() });
      setTeamCode(data.code);
    } catch (err) { setError(err.message); }
  }

  async function toggleOpenJoin() {
    setError('');
    try {
      await api(`/teams/${id}`, { method: 'PATCH', body: { openJoin: !team.openJoin }, token: getToken() });
      loadData();
    } catch (err) { setError(err.message); }
  }

  async function loadAnalytics() {
    setError(''); setAnalyticsLoading(true);
    try {
      setAnalytics(await api(`/analytics/teams/${id}/contribution`, { token: getToken() }));
    } catch (err) { setError(err.message); }
    finally { setAnalyticsLoading(false); }
  }

  function openCreateTask() {
    setTaskFormMode('create');
    setTTitle(''); setTDesc(''); setTAssignee(''); setTDeadline('');
  }
  function openEditTask(task) {
    setTaskFormMode(task);
    setTTitle(task.title);
    setTDesc(task.description || '');
    setTAssignee(task.assigneeId ? String(task.assigneeId) : '');
    setTDeadline(toInputDT(task.deadline));
  }
  const isEditTask = taskFormMode && taskFormMode !== 'create';
  const taskDirty = isEditTask
    ? (tTitle !== taskFormMode.title ||
       tDesc !== (taskFormMode.description || '') ||
       tAssignee !== (taskFormMode.assigneeId ? String(taskFormMode.assigneeId) : '') ||
       tDeadline !== toInputDT(taskFormMode.deadline))
    : (tTitle.trim() || tDesc.trim() || tAssignee || tDeadline);
  function closeTaskForm() {
    if (taskDirty && !window.confirm('Ви точно хочете вийти? Всі зміни будуть відкинуті')) return;
    setTaskFormMode(null);
  }
  async function submitTaskForm(e) {
    e.preventDefault(); setError('');
    try {
      const body = {
        title: tTitle, description: tDesc,
        assigneeId: tAssignee ? Number(tAssignee) : null,
        deadline: tDeadline || null,
      };
      if (isEditTask) {
        await api(`/tasks/${taskFormMode.id}`, { method: 'PATCH', body, token: getToken() });
      } else {
        await api('/tasks', { method: 'POST', body: { ...body, teamId: Number(id) }, token: getToken() });
      }
      setTaskFormMode(null); loadData();
    } catch (err) { setError(err.message); }
  }
  async function deleteTask(task) {
    if (!window.confirm('Видалити завдання?')) return;
    setError('');
    try {
      await api(`/tasks/${task.id}`, { method: 'DELETE', token: getToken() });
      loadData();
    } catch (err) { setError(err.message); }
  }

  async function saveGrade(studentId) {
    if (!project) return;
    const max = project.maxScore ?? 100;
    const raw = gradeDrafts[studentId];
    if (raw === undefined || raw === '') return;
    const score = Number(raw);
    if (isNaN(score) || score < 0 || score > max) { setError(`Оцінка має бути від 0 до ${max}`); return; }
    if (projGrades[studentId] === score) return;
    setError('');
    try {
      await api('/grades', { method: 'PUT', body: { studentId, projectId: project.id, score }, token: getToken() });
      setProjGrades((g) => ({ ...g, [studentId]: score }));
    } catch (err) { setError(err.message); }
  }
  function gradeRow(studentId) {
    if (!project) return null;
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

  const isTeacher = user.role === 'TEACHER';

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      {team && <Link to={`/projects/${team.project.id}`}>← До проєкту</Link>}
      <h1 style={{ marginBottom: 4 }}>{team?.name}</h1>

      <p style={{ color: 'var(--color-muted)', marginBottom: 4 }}>Учасники:</p>
      <ul style={{ marginTop: 0, listStyle: isTeacher ? 'none' : 'disc', padding: isTeacher ? 0 : undefined }}>
        {[...(team?.members || [])]
          .sort((a, b) => a.user.name.localeCompare(b.user.name, 'uk'))
          .map((m) => (
            isTeacher ? (
              <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ overflowWrap: 'anywhere' }}>{m.user.name}</span>
                {gradeRow(m.userId)}
              </li>
            ) : (
              <li key={m.id}>{m.user.name}</li>
            )
          ))}
      </ul>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {isMember && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Button variant="secondary" style={{ flex: 1 }} onClick={handleGenerateTeamCode}>Згенерувати код запрошення</Button>
            <Button variant="secondary" style={{ flex: 1 }} onClick={toggleOpenJoin}>
              {team.openJoin ? 'Закрити пряме приєднання' : 'Відкрити пряме приєднання'}
            </Button>
          </div>
          <small style={{ color: 'var(--color-muted)' }}>
            Приєднання зі сторінки проєкту: {team.openJoin ? 'відкрите' : 'закрите (лише за кодом)'}
          </small>
          {teamCode && (<p style={{ margin: '8px 0 0' }}>Код: <strong style={{ fontSize: 18 }}>{teamCode}</strong></p>)}
        </Card>
      )}

      <input ref={teamFileRef} type="file" multiple onChange={handleTeamFiles} style={{ display: 'none' }} />
      {isMember && !teamSubmitted && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={() => teamFileRef.current.click()}>Завантажити файли</Button>
          <Button variant="secondary" style={{ flex: 1 }} onClick={() => { setLinkUrl(''); setLinkModal({ kind: 'team' }); }}>Додати посилання</Button>
        </div>
      )}
      {isMember && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {teamSubmitted ? (
            <Button variant="secondary" style={{ flex: 1 }} onClick={() => handleSetTeamStatus('ACTIVE')}>Відмінити здачу</Button>
          ) : (
            <Button style={{ flex: 1 }} onClick={() => handleSetTeamStatus('SUBMITTED')}>Відправити на перевірку</Button>
          )}
        </div>
      )}
      {teamSubmitted && (
        lateTeam
          ? <p style={{ color: '#d97706', marginTop: 0 }}>Проєкт здано на перевірку із запізненням</p>
          : <p style={{ color: 'var(--color-success)', marginTop: 0 }}>Проєкт здано на перевірку</p>
      )}

      {teamFiles.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <small style={{ color: 'var(--color-muted)' }}>Файли команди:</small>
          <ul style={{ marginTop: 4 }}>
            {teamFiles.map((f) => (
              <li key={f.id}>
                {f.filePath
                  ? <a href={`${BASE_URL}/submissions/files/${f.id}/download`}>{f.fileName}</a>
                  : <a href={f.url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{f.url}</a>}
                {f.student && <small style={{ color: '#94a3b8' }}> · {f.student.name}</small>}
                {isMember && !teamSubmitted && (
                  <button onClick={() => deleteTeamFile(f.id)}
                    style={{ marginLeft: 8, color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Завдання</h2>
        {isMember && !teamSubmitted && <Button onClick={openCreateTask}>Створити</Button>}
      </div>

      <input ref={taskFileRef} type="file" multiple onChange={handleTaskFiles} style={{ display: 'none' }} />

      {tasks.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Завдань ще немає.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {tasks.map((task) => {
          const isAssignee = task.assigneeId === user.id;
          const isCreator = task.createdById === user.id;
          const canEdit = isAssignee || (task.status === 'TODO' && isCreator);
          const expanded = expandedTaskId === task.id;
          const files = taskFiles[task.id] || [];
          return (
            <Card key={task.id} style={{ opacity: task.status === 'DONE' ? 0.7 : 1 }}>
              <div onClick={() => toggleTask(task.id)} style={{ cursor: 'pointer' }}>
                <strong style={{ fontSize: 18, textDecoration: task.status === 'DONE' ? 'line-through' : 'none' }}>{task.title}</strong>
                <div>
                  <small style={{ color: '#94a3b8' }}>
                    Статус: {statusLabel[task.status]}
                    {task.assignee && ` · Виконавець: ${task.assignee.name}`}
                    {task.deadline && ` · Дедлайн: ${fmtDateTime(task.deadline)}`}
                  </small>
                </div>
              </div>

              {expanded && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ color: 'var(--color-text)' }}>{task.description || 'Без опису'}</p>

                  {isAssignee && !teamSubmitted && (
                    <Field label="Статус">
                      <Select
                        value={task.status}
                        onChange={(v) => updateTaskStatus(task, v)}
                        options={[
                          { value: 'TODO', label: 'До виконання' },
                          { value: 'IN_PROGRESS', label: 'В роботі' },
                          { value: 'DONE', label: 'Виконано' },
                        ]}
                        style={{ maxWidth: 220 }}
                      />
                    </Field>
                  )}

                  {files.length > 0 && (
                    <ul>
                      {files.map((f) => (
                        <li key={f.id}>
                          {f.filePath
                            ? <a href={`${BASE_URL}/submissions/files/${f.id}/download`}>{f.fileName}</a>
                            : <a href={f.url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{f.url}</a>}
                          {f.student && <small style={{ color: '#94a3b8' }}> · {f.student.name}</small>}
                          {isMember && !teamSubmitted && (
                            <button onClick={() => deleteTaskFile(task.id, f.id)}
                              style={{ marginLeft: 8, color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {isAssignee && !teamSubmitted && (
                      <Button variant="secondary" onClick={() => { uploadTaskIdRef.current = task.id; taskFileRef.current.click(); }}>
                        Завантажити файли
                      </Button>
                    )}
                    {isAssignee && !teamSubmitted && (
                      <Button variant="secondary" onClick={() => { setLinkUrl(''); setLinkModal({ kind: 'task', taskId: task.id }); }}>
                        Додати посилання
                      </Button>
                    )}
                    {canEdit && !teamSubmitted && <Button variant="secondary" onClick={() => openEditTask(task)}>Редагувати</Button>}
                    {canEdit && !teamSubmitted && <Button variant="danger" onClick={() => deleteTask(task)}>Видалити</Button>}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <CommentBox scope="team" teamId={Number(id)} tasks={tasks} />
      </div>

      {user.role === 'STUDENT' && isMember && team.members.length > 1 && (
        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Оцінити співпрацю</h3>
          {team.members.filter((m) => m.user.id !== user.id)
            .sort((a, b) => a.user.name.localeCompare(b.user.name, 'uk'))
            .map((m) => (
            <div key={m.user.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ flex: 1 }}>{m.user.name}</span>
              <Stars rateeId={m.user.id} score={ratings[m.user.id] || 0} onRate={handleRate} />
            </div>
          ))}
        </Card>
      )}

      {isTeacher && (
        <>
          <h2>Аналітика внеску</h2>
          <Button onClick={loadAnalytics} disabled={analyticsLoading}>
            {analyticsLoading ? 'Розрахунок...' : 'Розрахувати внесок'}
          </Button>
          {analytics && (
            <Card style={{ marginTop: 16 }}>
              {analytics.members.map((m) => (
                <div key={m.userId} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{m.name}</strong>
                    <strong>{m.contributionPercent}%</strong>
                  </div>
                  <div style={{ background: '#e2e8e5', borderRadius: 6, height: 22, overflow: 'hidden' }}>
                    <div style={{ width: `${m.contributionPercent}%`, background: 'var(--color-primary)', height: '100%' }} />
                  </div>
                  <small style={{ color: '#94a3b8' }}>
                    Завдання: {m.metrics.N} · Своєчасність: {m.metrics.D} · Активність: {m.metrics.A} · Співпраця: {m.metrics.G}
                  </small>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {taskFormMode && (
        <Modal onClose={closeTaskForm} title={isEditTask ? 'Редагувати завдання' : 'Створити завдання'}>
          <form onSubmit={submitTaskForm}>
            <Field><Input placeholder="Назва завдання" value={tTitle} onChange={(e) => setTTitle(e.target.value)} maxLength={45} required /></Field>
            <Field><Textarea placeholder="Опис (необов'язково)" value={tDesc} onChange={(e) => setTDesc(e.target.value)} /></Field>
            <Field label="Виконавець">
              <Select
                value={tAssignee}
                onChange={(v) => setTAssignee(v)}
                options={[
                  { value: '', label: '— не призначено —' },
                  ...(team?.members || []).map((m) => ({ value: String(m.user.id), label: m.user.name })),
                ]}
              />
            </Field>
            <Field label="Дедлайн (необов'язково)">
              <DateTime value={tDeadline} min={minDate} onChange={setTDeadline} />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>{isEditTask ? 'Зберегти' : 'Створити'}</Button>
              <Button type="button" variant="secondary" block onClick={closeTaskForm}>Скасувати</Button>
            </div>
          </form>
        </Modal>
      )}

      {linkModal && (
        <Modal onClose={() => setLinkModal(null)} title="Додати посилання">
          <form onSubmit={submitLink}>
            <Field><Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>Додати</Button>
              <Button type="button" variant="secondary" block onClick={() => setLinkModal(null)}>Скасувати</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}