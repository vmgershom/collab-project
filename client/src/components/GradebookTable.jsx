import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getToken } from '../auth.js';

export default function GradebookTable({ courseId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [localGrades, setLocalGrades] = useState({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const d = await api(`/grades/course/${courseId}`, { token: getToken() });
        if (!active) return;
        setData(d); setLocalGrades(d.grades);
      } catch (err) { if (active) setError(err.message); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [courseId]);

  function handleChange(studentId, projectId, value) {
    setLocalGrades((prev) => ({ ...prev, [`${studentId}-${projectId}`]: value }));
  }
  
  async function saveGrade(studentId, projectId) {
    const key = `${studentId}-${projectId}`;
    const val = localGrades[key];
    if (val === undefined || val === '') return;
    const score = Number(val);
    const proj = data.projects.find((x) => x.id === projectId);
    const max = proj?.maxScore ?? 100;
    if (isNaN(score) || score < 0 || score > max) {
      setError(`Оцінка має бути від 0 до ${max}`);
      return;
    }
    setError('');
    try { await api('/grades', { method: 'PUT', body: { studentId, projectId, score }, token: getToken() }); }
    catch (err) { setError(err.message); }
  }

  if (loading) return <p style={{ color: 'var(--color-muted)' }}>Завантаження...</p>;
  if (!data) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;

  const cell = { border: '1px solid var(--color-border)', padding: '10px 12px' };
  const head = { ...cell, textAlign: 'left', background: 'var(--color-primary-light)', fontWeight: 600, overflowWrap: 'anywhere' };

  return (
    <>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {data.students.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>На курсі немає студентів.</p>
      ) : data.projects.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>У курсі немає проєктів.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ ...head, width: 160 }}>Студент</th>
                {data.projects.map((p) => (<th key={p.id} style={{ ...head, textAlign: 'center' }}>{p.name}<div style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-muted)' }}>макс. {p.maxScore ?? 100}</div></th>))}
              </tr>
            </thead>
            <tbody>
              {[...data.students].sort((a, b) => a.name.localeCompare(b.name, 'uk')).map((s) => (
                <tr key={s.id}>
                  <td style={cell}>{s.name}</td>
                  {data.projects.map((p) => {
                    const key = `${s.id}-${p.id}`;
                    return (
                      <td key={p.id} style={{ ...cell, padding: 4, textAlign: 'center' }}>
                        <input type="number" min={0} max={p.maxScore ?? 100} value={localGrades[key] ?? ''}
                          onChange={(e) => handleChange(s.id, p.id, e.target.value)}
                          onBlur={() => saveGrade(s.id, p.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveGrade(s.id, p.id); e.target.blur(); } }}
                          style={{ width: '100%', padding: 6, border: 'none', textAlign: 'center', boxSizing: 'border-box', background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: 'var(--color-text)' }}
                          placeholder="—" />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}