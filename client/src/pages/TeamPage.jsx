import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, BASE_URL } from '../api.js';
import { getToken, getUser } from '../auth.js';
import CommentBox from '../components/CommentBox.jsx';
import { Button, Card, Input, Textarea, Field, Select, Modal } from '../components/ui.jsx';

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
    setTDeadline(task.deadline ? task.deadline.split('T')[0] : '');
  }
  const isEditTask = taskFormMode && taskFormMode !== 'create';
  const taskDirty = isEditTask
    ? (tTitle !== taskFormMode.title ||
       tDesc !== (taskFormMode.description || '') ||
       tAssignee !== (taskFormMode.assigneeId ? String(taskFormMode.assigneeId) : '') ||
       tDeadline !== (taskFormMode.deadline ? taskFormMode.deadline.split('T')[0] : ''))
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

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      {team && <Link to={`/projects/${team.project.id}`}>← До проєкту</Link>}
      <h1 style={{ marginBottom: 4 }}>{team?.name}</h1>

      <p style={{ color: 'var(--color-muted)', marginBottom: 4 }}>Учасники:</p>
      <ul style={{ marginTop: 0 }}>
        {[...(team?.members || [])]
          .sort((a, b) => a.user.name.localeCompare(b.user.name, 'uk'))
          .map((m) => (<li key={m.id}>{m.user.name}</li>))}
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

      {isMember && (
        <>
          <input ref={teamFileRef} type="file" multiple onChange={handleTeamFiles} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Button variant="secondary" style={{ flex: 1 }} onClick={() => teamFileRef.current.click()}>Завантажити файли</Button>
            {teamSubmitted ? (
              <Button variant="secondary" style={{ flex: 1 }} onClick={() => handleSetTeamStatus('ACTIVE')}>Відмінити здачу</Button>
            ) : (
              <Button style={{ flex: 1 }} onClick={() => handleSetTeamStatus('SUBMITTED')}>Відправити на перевірку</Button>
            )}
          </div>
        </>
      )}
      {teamSubmitted && <p style={{ color: 'var(--color-success)', marginTop: 0 }}>Проєкт здано на перевірку</p>}

      {teamFiles.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <small style={{ color: 'var(--color-muted)' }}>Файли команди:</small>
          <ul style={{ marginTop: 4 }}>
            {teamFiles.map((f) => (
              <li key={f.id}>
                <a href={`${BASE_URL}/submissions/files/${f.id}/download`}>{f.fileName}</a>
                {f.student && <small style={{ color: '#94a3b8' }}> · {f.student.name}</small>}
                {isMember && (
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
        {isMember && <Button onClick={openCreateTask}>Створити</Button>}
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
                    {task.deadline && ` · Дедлайн: ${new Date(task.deadline).toLocaleDateString()}`}
                  </small>
                </div>
              </div>

              {expanded && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ color: 'var(--color-text)' }}>{task.description || 'Без опису'}</p>

                  {isAssignee && (
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
                          <a href={`${BASE_URL}/submissions/files/${f.id}/download`}>{f.fileName}</a>
                          {f.student && <small style={{ color: '#94a3b8' }}> · {f.student.name}</small>}
                          {isMember && (
                            <button onClick={() => deleteTaskFile(task.id, f.id)}
                              style={{ marginLeft: 8, color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {isMember && (
                      <Button variant="secondary" onClick={() => { uploadTaskIdRef.current = task.id; taskFileRef.current.click(); }}>
                        Завантажити файли
                      </Button>
                    )}
                    {canEdit && <Button variant="secondary" onClick={() => openEditTask(task)}>Редагувати</Button>}
                    {canEdit && <Button variant="danger" onClick={() => deleteTask(task)}>Видалити</Button>}
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

      {user.role === 'TEACHER' && (
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
              <Input type="date" value={tDeadline} min={minDate} onChange={(e) => setTDeadline(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" block>{isEditTask ? 'Зберегти' : 'Створити'}</Button>
              <Button type="button" variant="secondary" block onClick={closeTaskForm}>Скасувати</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}