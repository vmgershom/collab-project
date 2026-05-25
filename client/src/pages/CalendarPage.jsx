import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getToken } from '../auth.js';
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

export default function CalendarPage() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [items, setItems] = useState([]);
  const [courseFilter, setCourseFilter] = useState('all');
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

  const filtered = courseFilter === 'all' ? items : items.filter((it) => String(it.courseId) === String(courseFilter));
  const fmt = (d) => d.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' });
  function shiftWeek(delta) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="secondary" onClick={() => shiftWeek(-1)}>‹</Button>
          <strong>{fmt(days[0])} – {fmt(days[6])}, {days[6].getFullYear()}</strong>
          <Button variant="secondary" onClick={() => shiftWeek(1)}>›</Button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minWidth: 760, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-surface)' }}>
          {days.map((day, i) => {
            const dayItems = filtered.filter((it) => sameDay(new Date(it.deadline), day));
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
                  {dayItems.map((it, j) => (
                    <div key={j} style={{
                      background: it.type === 'PROJECT' ? '#e0f2f1' : '#dcfce7',
                      borderLeft: `3px solid ${it.type === 'PROJECT' ? 'var(--color-primary)' : '#16a34a'}`,
                      borderRadius: 4, padding: '4px 6px', marginBottom: 6, fontSize: 13, overflowWrap: 'anywhere',
                    }}>
                      <div style={{ fontWeight: 600 }}>{it.title}</div>
                      <small style={{ color: 'var(--color-muted)' }}>
                        {it.type === 'PROJECT' ? 'Проєкт' : 'Завдання'} · {it.courseName}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 12 }}>
        <span style={{ color: 'var(--color-primary)' }}>■</span> Проєкти &nbsp;
        <span style={{ color: '#16a34a' }}>■</span> Завдання
      </p>
    </div>
  );
}