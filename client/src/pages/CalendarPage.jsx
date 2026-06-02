import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getToken, getUser } from '../auth.js';
import { Button, Select } from '../components/ui.jsx';

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const DAY_NAMES = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

function itemColors(it) {
  if (it.type === 'TASK') return { bg: '#dcfce7', border: '#16a34a' };
  if (it.projectType === 'SOLO') return { bg: '#fef3c7', border: '#d97706' };
  return { bg: '#e0f2f1', border: 'var(--color-primary)' };
}
function itemLabel(it) {
  if (it.type === 'TASK') return `${it.projectName || 'Завдання'} · ${it.courseName}`;
  return it.courseName;
}
const fmtTime = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const user = getUser();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [items, setItems] = useState([]);
  const [courseFilter, setCourseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try { setItems(await api('/calendar', { token: getToken() })); }
      catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const courses = [];
  const seen = new Set();
  for (const it of items) {
    if (!seen.has(it.courseId)) { seen.add(it.courseId); courses.push({ id: it.courseId, name: it.courseName }); }
  }

  let filtered = courseFilter === 'all' ? items : items.filter((it) => String(it.courseId) === String(courseFilter));
  if (typeFilter !== 'all') filtered = filtered.filter((it) => it.type === typeFilter);

  const fmt = (d) => d.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' });
  function shiftWeek(delta) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  }

  function go(it) {
    if (it.type === 'TASK') navigate(`/teams/${it.teamId}`);
    else navigate(`/projects/${it.projectId}`);
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;
  const today = new Date();

  return (
    <div style={{ maxWidth: 1100, margin: '40px auto', padding: '0 16px' }}>
      <h1>Календар дедлайнів</h1>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          value={courseFilter}
          onChange={(v) => setCourseFilter(v)}
          options={[{ value: 'all', label: 'Усі курси' }, ...courses.map((c) => ({ value: String(c.id), label: c.name }))]}
          style={{ width: 240 }}
        />
        {user?.role === 'STUDENT' && (
          <Select
            value={typeFilter}
            onChange={(v) => setTypeFilter(v)}
            options={[{ value: 'all', label: 'Усі типи' }, { value: 'PROJECT', label: 'Проєкти' }, { value: 'TASK', label: 'Завдання' }]}
            style={{ width: 200 }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="secondary" onClick={() => shiftWeek(-1)}>‹</Button>
          <strong>{fmt(days[0])} – {fmt(days[6])}, {days[6].getFullYear()}</strong>
          <Button variant="secondary" onClick={() => shiftWeek(1)}>›</Button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minWidth: 760, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-surface)' }}>
          {days.map((day, i) => {
            const dayItems = filtered
              .filter((it) => sameDay(new Date(it.deadline), day))
              .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
            const isToday = sameDay(day, today);
            return (
              <div key={i} style={{ borderRight: i < 6 ? '1px solid var(--color-border)' : 'none', minHeight: 420 }}>
                <div style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{DAY_NAMES[i]}</div>
                  <div style={{ fontSize: 20, width: 32, height: 32, lineHeight: '32px', margin: '4px auto 0', borderRadius: '50%', background: isToday ? 'var(--color-primary)' : 'transparent', color: isToday ? '#fff' : 'var(--color-text)' }}>
                    {day.getDate()}
                  </div>
                </div>
                <div style={{ padding: 6 }}>
                  {dayItems.map((it, j) => {
                    const c = itemColors(it);
                    return (
                      <div key={j} onClick={() => go(it)} style={{
                        background: c.bg,
                        borderLeft: `3px solid ${c.border}`,
                        borderRadius: 4, padding: '4px 6px', marginBottom: 6, fontSize: 13, overflowWrap: 'anywhere',
                        cursor: 'pointer',
                      }}>
                        <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{it.title}</div>
                        <small style={{ color: 'var(--color-muted)' }}>{itemLabel(it)}</small>
                        <div style={{ fontWeight: 600, marginTop: 2 }}>{fmtTime(it.deadline)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 12 }}>
        <span style={{ color: 'var(--color-primary)' }}>■</span> Командні проєкти &nbsp;
        <span style={{ color: '#d97706' }}>■</span> Самостійні проєкти
        {user?.role !== 'TEACHER' && (<>&nbsp; <span style={{ color: '#16a34a' }}>■</span> Завдання</>)}
      </p>
    </div>
  );
}