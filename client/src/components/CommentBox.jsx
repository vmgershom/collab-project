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

export default function CommentBox({ scope, projectId, teamId, tasks = [] }) {
  const me = getUser();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [thread, setThread] = useState('general');
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  async function load() {
    setError('');
    try {
      let url;
      if (scope === 'project') url = `/comments/project?projectId=${projectId}`;
      else url = thread === 'general' ? `/comments/team?teamId=${teamId}` : `/comments/team?teamId=${teamId}&taskId=${thread}`;
      setComments(await api(url, { token: getToken() }));
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, [scope, projectId, teamId, thread]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [comments]);

  async function send() {
    const content = text.trim();
    if (!content) return;
    setError('');
    try {
      if (scope === 'project') {
        await api('/comments/project', { method: 'POST', body: { projectId, content }, token: getToken() });
      } else {
        const body = { teamId, content };
        if (thread !== 'general') body.taskId = Number(thread);
        await api('/comments/team', { method: 'POST', body, token: getToken() });
      }
      setText('');
      load();
    } catch (err) { setError(err.message); }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const showThreadLabel = scope === 'team' && thread === 'general';

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <strong>Коментарі</strong>
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
      </div>

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
    </div>
  );
}