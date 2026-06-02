import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getToken, getUser } from '../auth.js';
import { Select } from '../components/ui.jsx';
import GradebookTable from '../components/GradebookTable.jsx';

export default function GradesPage() {
  const user = getUser();
  return user?.role === 'TEACHER' ? <TeacherGrades /> : <StudentGrades />;
}

function TeacherGrades() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cs = await api('/courses', { token: getToken() });
        setCourses(cs);
        if (cs.length > 0) setCourseId(String(cs[0].id));
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', padding: '0 16px' }}>
      <h1>Журнал оцінок</h1>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {courses.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>У вас ще немає курсів</p>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Select value={courseId} onChange={(v) => setCourseId(v)}
              options={courses.map((c) => ({ value: String(c.id), label: c.name }))}
              style={{ width: 'auto', minWidth: 240 }} />
          </div>
          {courseId && <GradebookTable courseId={courseId} />}
        </>
      )}
    </div>
  );
}

function StudentGrades() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await api('/grades/my/summary', { token: getToken() })); }
      catch (err) { setError(err.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;

  const filtered = filter === 'all' ? data : data.filter((c) => String(c.courseId) === String(filter));

  const cell = { border: '1px solid var(--color-border)', padding: '10px 12px' };
  const head = { ...cell, textAlign: 'left', background: 'var(--color-primary-light)', fontWeight: 600 };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <h1>Мої оцінки</h1>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <div style={{ marginBottom: 16 }}>
        <Select value={filter} onChange={(v) => setFilter(v)}
          options={[{ value: 'all', label: 'Усі' }, ...data.map((c) => ({ value: String(c.courseId), label: c.courseName }))]}
          style={{ width: 'auto', minWidth: 240 }} />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>Курсів ще немає.</p>
      ) : (
        filtered.map((c) => (
          <div key={c.courseId} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, overflowWrap: 'anywhere' }}>{c.courseName}</h2>
              <strong style={{ color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>Всього: {c.totalEarned} / {c.totalMax}</strong>
            </div>
            {c.projects.length === 0 ? (
              <p style={{ color: 'var(--color-muted)', margin: 0 }}>Проєктів немає.</p>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={head}>Проєкт</th>
                      <th style={{ ...head, textAlign: 'center' }}>Оцінка</th>
                      <th style={{ ...head, textAlign: 'center' }}>Макс.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.projects.map((p) => (
                      <tr key={p.projectId}>
                        <td style={cell}>{p.projectName}</td>
                        <td style={{ ...cell, textAlign: 'center', fontWeight: 600 }}>{p.score == null ? '—' : p.score}</td>
                        <td style={{ ...cell, textAlign: 'center', color: 'var(--color-muted)' }}>{p.maxScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}