import { useEffect, useRef, useState } from 'react';
import { api, BASE_URL } from '../api.js';
import { getToken, getUser } from '../auth.js';
import { Button, Input, Select } from './ui.jsx';

function Avatar({ src }) {
  if (src) {
    return <img src={BASE_URL + src} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#9ca3af"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
    </div>
  );
}

const timeOf = (iso) => new Date(iso).toLocaleString('uk-UA', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const roleLabel = (r) => (r === 'TEACHER' ? 'Викладач' : 'Студент');
const dot = { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)', flexShrink: 0 };

export default function CommentBox({ scope, projectId, teamId, tasks = [], initialThread = null, initialStudent = null }) {
  const me = getUser();
  const isTeacher = me.role === 'TEACHER';
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [thread, setThread] = useState('general');
  const [projThread, setProjThread] = useState('general');
  const [students, setStudents] = useState([]);
  const [selStudent, setSelStudent] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  async function loadStudents() {
    try { setStudents(await api(`/comments/project/students?projectId=${projectId}`, { token: getToken() })); }
    catch (err) { setError(err.message); }
  }

  async function load() {
    setError('');
    try {
      let url;
      if (scope === 'project') {
        if (projThread === 'general') {
          url = `/comments/project?projectId=${projectId}`;
        } else if (isTeacher) {
          if (!selStudent) { setComments([]); return; }
          url = `/comments/project?projectId=${projectId}&private=true&studentId=${selStudent}`;
        } else {
          url = `/comments/project?projectId=${projectId}&private=true`;
        }
      } else {
        url = thread === 'general' ? `/comments/team?teamId=${teamId}` : `/comments/team?teamId=${teamId}&taskId=${thread}`;
      }
      setComments(await api(url, { token: getToken() }));
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    if (scope !== 'project') return;
    if (initialThread === 'private') {
      setProjThread('private');
      if (initialStudent) setSelStudent(initialStudent);
    } else if (initialThread === 'general') {
      setProjThread('general');
    }
  }, [scope, initialThread, initialStudent]);
  useEffect(() => { load(); }, [scope, projectId, teamId, thread, projThread, selStudent]);
  useEffect(() => { if (scope === 'project' && isTeacher) loadStudents(); /* eslint-disable-next-line */ }, [scope, projectId]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [comments]);

  async function send() {
    const content = text.trim();
    if (!content) return;
    setError('');
    try {
      if (scope === 'project') {
        const body = { projectId, content };
        if (projThread === 'private') {
          body.isPrivate = true;
          if (isTeacher) { if (!selStudent) return; body.studentId = selStudent; }
        }
        await api('/comments/project', { method: 'POST', body, token: getToken() });
      } else {
        const body = { teamId, content };
        if (thread !== 'general') body.taskId = Number(thread);
        await api('/comments/team', { method: 'POST', body, token: getToken() });
      }
      setText('');
      load();
      if (scope === 'project' && isTeacher) loadStudents();
    } catch (err) { setError(err.message); }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const showThreadLabel = scope === 'team' && thread === 'general';
  const pickingStudent = scope === 'project' && projThread === 'private' && isTeacher && !selStudent;
  const pendingCount = students.filter((s) => s.lastFromStudent).length;
  const studentsFiltered = students.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selName = students.find((s) => s.id === selStudent)?.name || '';

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Коментарі
          {scope === 'project' && isTeacher && pendingCount > 0 && <span style={dot} title="Є нові приватні коментарі" />}
        </strong>
        {scope === 'team' && (
          <Select
            value={thread}
            onChange={(v) => setThread(v)}
            options={[
              { value: 'general', label: 'Усі коментарі (Загальна гілка)' },
              ...tasks.map((t) => ({ value: String(t.id), label: t.title })),
            ]}
            style={{ width: 'auto', minWidth: 220 }}
          />
        )}
        {scope === 'project' && (
          <Select
            value={projThread}
            onChange={(v) => { setProjThread(v); setSelStudent(null); }}
            options={[
              { value: 'general', label: 'Загальні' },
              { value: 'private', label: isTeacher ? 'Приватні' : 'Викладачу' },
            ]}
            style={{ width: 'auto', minWidth: 160 }}
          />
        )}
      </div>

      {pickingStudent ? (
        <div style={{ padding: 14 }}>
          <Input placeholder="Пошук студента..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {studentsFiltered.length === 0 && <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>Нікого не знайдено</p>}
            {studentsFiltered.map((s) => (
              <div key={s.id} onClick={() => setSelStudent(s.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: '#f8faf9', marginBottom: 6 }}>
                <span style={{ fontWeight: s.lastFromStudent ? 700 : 400, overflowWrap: 'anywhere' }}>{s.name}</span>
                {s.lastFromStudent
                  ? <span style={dot} title="Новий коментар від студента" />
                  : s.hasThread && <small style={{ color: 'var(--color-muted)', flexShrink: 0 }}>є листування</small>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {scope === 'project' && projThread === 'private' && isTeacher && selStudent && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--color-border)', background: '#f8faf9' }}>
              <span style={{ overflowWrap: 'anywhere' }}>Розмова з <strong>{selName}</strong></span>
              <Button variant="secondary" onClick={() => setSelStudent(null)} style={{ flexShrink: 0 }}>Інший студент</Button>
            </div>
          )}

          <div ref={scrollRef} style={{ height: 320, overflowY: 'auto', padding: 14 }}>
            {comments.length === 0 && <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>Поки немає коментарів</p>}
            {comments.map((c) => {
              const mine = c.author.id === me.id;
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  {!mine && <div style={{ marginRight: 8 }}><Avatar src={c.author.avatar} /></div>}
                  <div style={{ maxWidth: '70%' }}>
                    {!mine && (
                      <div style={{ fontSize: 13, marginBottom: 2 }}>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{c.author.name}</span>
                        <span style={{ color: 'var(--color-primary)' }}> — {roleLabel(c.author.role)}</span>
                      </div>
                    )}
                    <div style={{ background: mine ? 'var(--color-primary-light)' : '#f1f5f4', borderRadius: 10, padding: '8px 12px', display: 'inline-block', textAlign: 'left', overflowWrap: 'anywhere' }}>
                      {showThreadLabel && (
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>
                          {c.task ? c.task.title : 'Загальне'}
                        </div>
                      )}
                      <div>{c.content}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                      {timeOf(c.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p style={{ color: 'var(--color-danger)', padding: '0 14px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--color-border)', background: '#f8faf9', borderRadius: '0 0 var(--radius) var(--radius)' }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
              placeholder="Напишіть коментар..." style={{ flex: 1 }} />
            <Button onClick={send} aria-label="Надіслати">➤</Button>
          </div>
        </>
      )}
    </div>
  );
}