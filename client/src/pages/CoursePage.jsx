import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, BASE_URL } from '../api.js';
import { getToken, getUser } from '../auth.js';
import { Button, Card, Input, Textarea, Field, Modal, Select, Badge, DateTime, toInputDT, fmtDateTime } from '../components/ui.jsx';
import { FiSettings } from 'react-icons/fi';
import { RichTextEditor, RichTextView, isEmptyRich } from '../components/RichText.jsx';

const MATERIAL_TYPES = [
  { value: 'INFO', label: 'Інформаційний блок' },
  { value: 'FILES', label: 'Файли' },
  { value: 'LINK', label: 'Посилання' },
];
const PROJECT_TYPES = [
  { value: 'TEAM', label: 'Командний' },
  { value: 'SOLO', label: 'Самостійний' },
];
const PROJECT_SORTS = [
  { value: 'structure', label: 'За розділами' },
  { value: 'deadline', label: 'За дедлайном' },
];
const MATERIAL_SORTS = [
  { value: 'structure', label: 'За розділами' },
  { value: 'type', label: 'За типом' },
];
const TYPE_ORDER = { INFO: 0, FILES: 1, LINK: 2 };
const typeLabel = (t) => ({ INFO: 'Текст', FILES: 'Файли', LINK: 'Посилання' }[t] || t);

export default function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const isTeacher = user?.role === 'TEACHER';

  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [students, setStudents] = useState([]);
  const [showStudents, setShowStudents] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('feed');
  const [courseCode, setCourseCode] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [closedMaterials, setClosedMaterials] = useState({});
  const [navClosed, setNavClosed] = useState({});
  const [showSidebar, setShowSidebar] = useState(true);
  const [pSort, setPSort] = useState('structure');
  const [mSort, setMSort] = useState('structure');
  const [myGrades, setMyGrades] = useState({});

  const [editingCourse, setEditingCourse] = useState(false);
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');

  const [sectionModal, setSectionModal] = useState(null);
  const [secName, setSecName] = useState('');
  const [secHidden, setSecHidden] = useState(false);
  const [secOpenAt, setSecOpenAt] = useState('');

  const [projectModal, setProjectModal] = useState(null);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pDeadline, setPDeadline] = useState('');
  const [pType, setPType] = useState('TEAM');
  const [pMax, setPMax] = useState('100');
  const [pOpenAt, setPOpenAt] = useState('');

  const [materialModal, setMaterialModal] = useState(null);
  const [mTitle, setMTitle] = useState('');
  const [mType, setMType] = useState('INFO');
  const [mDesc, setMDesc] = useState('');
  const [mUrl, setMUrl] = useState('');
  const [mFiles, setMFiles] = useState([]);
  const [mExistingFiles, setMExistingFiles] = useState([]);
  const [mRemoveFileIds, setMRemoveFileIds] = useState([]);

  async function loadData() {
    try {
      const c = await api(`/courses/${id}`, { token: getToken() });
      setCourse(c);
      const s = await api(`/sections/course/${id}`, { token: getToken() });
      setSections(s.sections);
      setProjects(await api(`/projects?courseId=${id}`, { token: getToken() }));
      setMaterials(await api(`/materials?courseId=${id}`, { token: getToken() }));
      if (isTeacher) setStudents(await api(`/courses/${id}/students`, { token: getToken() }));
      if (!isTeacher) {
        const g = await api('/grades/my', { token: getToken() });
        const map = {};
        g.forEach((row) => { if (row.projectId != null) map[row.projectId] = row.score; });
        setMyGrades(map);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadData(); }, [id]);

  const minDate = (() => {
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  })();

  function itemsOf(sectionId) {
    const ms = materials.filter((m) => m.sectionId === sectionId).map((m) => ({ kind: 'material', order: m.order, data: m }));
    const ps = projects.filter((p) => p.sectionId === sectionId).map((p) => ({ kind: 'project', order: p.order, data: p }));
    return [...ms, ...ps].sort((a, b) => a.order - b.order);
  }
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  const projectList = pSort === 'deadline'
    ? [...projects].sort((a, b) => { if (!a.deadline && !b.deadline) return 0; if (!a.deadline) return 1; if (!b.deadline) return -1; return new Date(a.deadline) - new Date(b.deadline); })
    : projects;
  const materialList = mSort === 'type'
    ? [...materials].sort((a, b) => (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) || a.title.localeCompare(b.title, 'uk'))
    : materials;

  function goTo(anchorId) {
    setTab('feed');
    setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function openCreateSection() { setSectionModal('create'); setSecName(''); setSecHidden(false); setSecOpenAt(''); }
  function openEditSection(s) {
    setSectionModal(s); setSecName(s.name); setSecHidden(s.hidden);
    setSecOpenAt(toInputDT(s.openAt));
  }
  async function saveSection(e) {
    e.preventDefault(); setError('');
    try {
      if (sectionModal === 'create') {
        await api('/sections', { method: 'POST', body: { courseId: Number(id), name: secName, hidden: secHidden, openAt: secOpenAt || null }, token: getToken() });
      } else {
        await api(`/sections/${sectionModal.id}`, { method: 'PATCH', body: { name: secName, hidden: secHidden, openAt: secOpenAt || null }, token: getToken() });
      }
      setSectionModal(null); loadData();
    } catch (err) { setError(err.message); }
  }
  async function deleteSection() {
    if (!window.confirm('Видалити розділ разом з усіма його проєктами й матеріалами?')) return;
    setError('');
    try { await api(`/sections/${sectionModal.id}`, { method: 'DELETE', token: getToken() }); setSectionModal(null); loadData(); }
    catch (err) { setError(err.message); }
  }
  async function moveSection(sid, dir) {
    const ids = sortedSections.map((s) => s.id);
    const i = ids.indexOf(sid); const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api('/sections/reorder', { method: 'PUT', body: { courseId: Number(id), orderedIds: ids }, token: getToken() }); loadData(); }
    catch (err) { setError(err.message); }
  }
  async function moveItem(sectionId, item, dir) {
    const items = itemsOf(sectionId);
    const idx = items.findIndex((it) => it.kind === item.kind && it.data.id === item.data.id);
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    try {
      await api(`/sections/${sectionId}/reorder-items`, { method: 'PUT', body: { items: items.map((it) => ({ kind: it.kind, id: it.data.id })) }, token: getToken() });
      loadData();
    } catch (err) { setError(err.message); }
  }

  function openCreateProject(sectionId) { setProjectModal({ sectionId }); setPName(''); setPDesc(''); setPDeadline(''); setPType('TEAM'); setPMax('100'); setPOpenAt('');}
  function openEditProject(p) {
    setProjectModal({ editId: p.id });
    setPName(p.name); setPDesc(p.description || '');
    setPDeadline(toInputDT(p.deadline));
    setPType(p.type); setPMax(String(p.maxScore));
    setPOpenAt(toInputDT(p.openAt));
  }
  async function submitProject(e) {
    e.preventDefault(); setError('');
    try {
      if (projectModal.editId) {
        await api(`/projects/${projectModal.editId}`, { method: 'PATCH', body: { name: pName, description: pDesc, deadline: pDeadline || null, maxScore: pMax, openAt: pOpenAt || null }, token: getToken() });
      } else {
        await api('/projects', { method: 'POST', body: { name: pName, description: pDesc, deadline: pDeadline || null, sectionId: projectModal.sectionId, type: pType, maxScore: pMax, openAt: pOpenAt || null }, token: getToken() });
      }
      setProjectModal(null); loadData();
    } catch (err) { setError(err.message); }
  }
  async function deleteProject() {
    if (!window.confirm('Видалити проєкт разом з командами, завданнями й оцінками?')) return;
    try { await api(`/projects/${projectModal.editId}`, { method: 'DELETE', token: getToken() }); setProjectModal(null); loadData(); }
    catch (err) { setError(err.message); }
  }

  function openCreateMaterial(sectionId) { setMaterialModal({ sectionId }); setMTitle(''); setMType('INFO'); setMDesc(''); setMUrl(''); setMFiles([]); setMExistingFiles([]); setMRemoveFileIds([]); }
  function openEditMaterial(m) {
    setMaterialModal({ editId: m.id });
    setMTitle(m.title); setMType(m.type); setMDesc(m.description || ''); setMUrl(m.url || '');
    setMFiles([]); setMExistingFiles(m.files || []); setMRemoveFileIds([]);
  }
  function addMFiles(e) { const sel = Array.from(e.target.files); setMFiles((p) => [...p, ...sel]); e.target.value = ''; }
  function removeNewFile(i) { setMFiles((p) => p.filter((_, idx) => idx !== i)); }
  function removeExistingFile(fid) { setMExistingFiles((p) => p.filter((f) => f.id !== fid)); setMRemoveFileIds((p) => [...p, fid]); }
  async function submitMaterial(e) {
    e.preventDefault(); setError('');
    try {
      const fd = new FormData();
      fd.append('title', mTitle);
      fd.append('type', mType);
      fd.append('description', mDesc);
      fd.append('url', mType === 'LINK' ? mUrl : '');
      if (mType === 'FILES') mFiles.forEach((f) => fd.append('files', f));
      let url, method;
      if (materialModal.editId) {
        fd.append('removeFileIds', JSON.stringify(mRemoveFileIds));
        url = `${BASE_URL}/materials/${materialModal.editId}`; method = 'PATCH';
      } else {
        fd.append('sectionId', materialModal.sectionId);
        url = `${BASE_URL}/materials`; method = 'POST';
      }
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Помилка');
      setMaterialModal(null); loadData();
    } catch (err) { setError(err.message); }
  }
  async function deleteMaterial() {
    if (!window.confirm('Видалити матеріал разом з файлами?')) return;
    try { await api(`/materials/${materialModal.editId}`, { method: 'DELETE', token: getToken() }); setMaterialModal(null); loadData(); }
    catch (err) { setError(err.message); }
  }

  function openEditCourse() { setEditingCourse(true); setCName(course.name); setCDesc(course.description || ''); }
  async function saveCourse(e) {
    e.preventDefault(); setError('');
    try { await api(`/courses/${id}`, { method: 'PATCH', body: { name: cName, description: cDesc }, token: getToken() }); setEditingCourse(false); loadData(); }
    catch (err) { setError(err.message); }
  }
  async function deleteCourse() {
    if (!window.confirm('Видалити курс з усіма розділами, проєктами й матеріалами?')) return;
    try { await api(`/courses/${id}`, { method: 'DELETE', token: getToken() }); navigate('/dashboard'); }
    catch (err) { setError(err.message); }
  }
  async function generateCode() {
    setError('');
    try { const d = await api('/invitations', { method: 'POST', body: { type: 'COURSE', courseId: Number(id) }, token: getToken() }); setCourseCode(d.code); }
    catch (err) { setError(err.message); }
  }

  async function removeStudent(studentId, name) {
    if (!window.confirm(`Видалити студента «${name}» з курсу? Його буде прибрано з команд цього курсу.`)) return;
    setError('');
    try { await api(`/courses/${id}/students/${studentId}`, { method: 'DELETE', token: getToken() }); loadData(); }
    catch (err) { setError(err.message); }
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Завантаження...</p>;

  const muted = { color: 'var(--color-muted)' };
  const statusPill = (bg, color) => ({ background: bg, color, borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' });
  const gearBtn = { padding: '2px 8px' };

  function MaterialBody({ m }) {
    return (
      <div style={{ marginTop: 8 }}>
        {!isEmptyRich(m.description) && <RichTextView html={m.description} style={{ margin: '4px 0', color: 'var(--color-muted)' }} />}
        {m.type === 'LINK' && m.url && <a href={m.url} target="_blank" rel="noreferrer">{m.url}</a>}
        {m.type === 'FILES' && (m.files.length ? (
          <ul>{m.files.map((f) => (<li key={f.id}><a href={`${BASE_URL}/materials/files/${f.id}/download`}>{f.fileName}</a></li>))}</ul>
        ) : <small style={muted}>Без файлів</small>)}
      </div>
    );
  }

  function MaterialRow({ m }) {
    const open = !closedMaterials[m.id];
    return (
      <Card>
        <div onClick={() => setClosedMaterials((c) => ({ ...c, [m.id]: !c[m.id] }))} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{open ? '▾' : '▸'} {m.title}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <Badge>{typeLabel(m.type)}</Badge>
            {isTeacher && (
              <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); openEditMaterial(m); }} aria-label="Редагувати матеріал"
                style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', color: 'var(--color-primary)' }}>
                <FiSettings size={18} />
              </button>
            )}
          </div>
        </div>
        {open && <MaterialBody m={m} />}
      </Card>
    );
  }

  function StatusDot({ p }) {
    if (isTeacher) return null;
    const base = { display: 'inline-block', width: 10, height: 10, borderRadius: '50%', flexShrink: 0 };
    if (!p.submitted) {
      return <span style={{ ...base, border: '1.5px solid var(--color-muted)' }} title="Не здано" />;
    }
    if (p.submittedLate) {
      return <span style={{ ...base, background: '#facc15' }} title="Здано із запізненням" />;
    }
    return <span style={{ ...base, background: 'var(--color-success)' }} title="Здано" />;
  }

  function ProjectRow({ p }) {
    if (!isTeacher && p.locked) {
      return (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 18, flex: 1, minWidth: 0, overflowWrap: 'anywhere', color: 'var(--color-muted)' }}>{p.name}</span>
            <Badge>Відкриється {fmtDateTime(p.openAt)}</Badge>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <Link to={`/projects/${p.id}`} style={{ fontWeight: 600, fontSize: 18, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{p.name}</Link>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {!isTeacher && myGrades[p.id] != null && (
              <span style={statusPill('#dcfce7', 'var(--color-success)')}>✓ Оцінено</span>
            )}
            {!isTeacher && myGrades[p.id] == null && p.submitted && (
              p.submittedLate
                ? <span style={statusPill('#fef3c7', '#d97706')}>Здано із запізненням</span>
                : <span style={statusPill('var(--color-primary-light)', 'var(--color-primary)')}>Здано</span>
            )}
            <Badge>{p.type === 'SOLO' ? 'Самостійний' : 'Командний'}</Badge>
            {isTeacher && (
              <button className="btn btn-ghost" onClick={() => openEditProject(p)} aria-label="Редагувати проєкт"
                style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', color: 'var(--color-primary)' }}>
                <FiSettings size={18} />
              </button>
            )}
          </div>
        </div>
        {!isEmptyRich(p.description) && <RichTextView html={p.description} style={{ margin: '4px 0', color: 'var(--color-muted)' }} />}
        {p.deadline && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Дедлайн: {fmtDateTime(p.deadline)}</div>}
        {isTeacher && p.openAt && new Date(p.openAt) > new Date() && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Відкриється: {fmtDateTime(p.openAt)}</div>}
      </Card>
    );
  }

  function ItemRow({ sectionId, item, idx, total }) {
    return (
      <div id={`item-${item.kind}-${item.data.id}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', scrollMarginTop: 70 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {item.kind === 'project' ? <ProjectRow p={item.data} /> : <MaterialRow m={item.data} />}
        </div>
        {isTeacher && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button className="btn btn-ghost" disabled={idx === 0} onClick={() => moveItem(sectionId, item, 'up')} style={{ padding: '2px 8px' }}>↑</button>
            <button className="btn btn-ghost" disabled={idx === total - 1} onClick={() => moveItem(sectionId, item, 'down')} style={{ padding: '2px 8px' }}>↓</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="course-nav">
        <Button variant="secondary" onClick={() => setShowSidebar((v) => !v)}>☰ Навігація</Button>
        {showSidebar && (
          <aside className="course-sidebar">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Навігація</div>
            {sortedSections.length === 0 && <small style={muted}>Розділів ще немає</small>}
            {sortedSections.map((s) => {
              const nc = navClosed[s.id];
              const items = itemsOf(s.id);
              return (
                <div key={s.id} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="btn btn-ghost" onClick={() => setNavClosed((c) => ({ ...c, [s.id]: !c[s.id] }))} style={{ padding: '0 4px' }}>{nc ? '▸' : '▾'}</button>
                    <span onClick={() => goTo(`section-${s.id}`)} style={{ cursor: 'pointer', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </div>
                  {!nc && items.length > 0 && (
                    <div style={{ paddingLeft: 18 }}>
                      {items.map((it) => {
                        const isProject = it.kind === 'project';
                        return (
                          <div key={it.kind + it.data.id} onClick={() => goTo(`item-${it.kind}-${it.data.id}`)}
                            style={{ cursor: 'pointer', fontSize: 14, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isProject ? it.data.name : it.data.title}
                            </span>
                            {isProject && <StatusDot p={it.data} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </aside>
        )}
      </div>

      <div className="course-page">
        <Link to="/dashboard">← До курсів</Link>
        <h1 style={{ marginBottom: 4 }}>{course?.name}</h1>
        {course?.description && <p style={{ ...muted, marginTop: 0 }}>{course.description}</p>}
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

        {isTeacher && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <Button variant="secondary" onClick={generateCode}>Згенерувати код запрошення</Button>
            <Link to={`/courses/${id}/gradebook`} className="btn btn-primary">Журнал оцінок</Link>
                        <Button variant="secondary" onClick={() => setShowStudents(true)}>Студенти ({students.length})</Button>
            <Button variant="secondary" onClick={openEditCourse}>Налаштувати курс</Button>
          </div>
        )}
        {courseCode && (
          <p style={{ marginBottom: 16 }}>
            Код: <strong style={{ fontSize: 18 }}>{courseCode}</strong>
            <small style={{ ...muted, marginLeft: 8 }}>(дайте студентам)</small>
          </p>
        )}

        <div style={{ display: 'flex', marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
          <button onClick={() => setTab('feed')} className={`tab${tab === 'feed' ? ' active' : ''}`}>Стрічка</button>
          <button onClick={() => setTab('projects')} className={`tab${tab === 'projects' ? ' active' : ''}`}>Проєкти</button>
          <button onClick={() => setTab('materials')} className={`tab${tab === 'materials' ? ' active' : ''}`}>Матеріали</button>
        </div>

        {tab === 'feed' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {sortedSections.length === 0 && <p style={muted}>Розділів ще немає.</p>}
            {sortedSections.map((s, si) => {
              const isCollapsed = collapsed[s.id];
              const items = itemsOf(s.id);
              return (
                <div key={s.id} id={`section-${s.id}`} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', overflow: 'hidden', scrollMarginTop: 70 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--color-primary-light)' }}>
                    <button className="btn btn-ghost" onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))} style={{ padding: '2px 8px' }}>{isCollapsed ? '▸' : '▾'}</button>
                    <strong style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{s.name}</strong>
                    {s.hidden && <Badge>Прихований</Badge>}
                    {s.locked && <Badge>Відкриється {fmtDateTime(s.openAt)}</Badge>}
                    {isTeacher && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost" disabled={si === 0} onClick={() => moveSection(s.id, 'up')} style={{ padding: '2px 8px' }}>↑</button>
                        <button className="btn btn-ghost" disabled={si === sortedSections.length - 1} onClick={() => moveSection(s.id, 'down')} style={{ padding: '2px 8px' }}>↓</button>
                        <Button variant="secondary" onClick={() => openEditSection(s)}>Налаштування</Button>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div style={{ padding: 14, display: 'grid', gap: 10 }}>
                      {s.locked && !isTeacher ? (
                        <small style={muted}>Розділ стане доступним {fmtDateTime(s.openAt)}</small>
                      ) : (
                        <>
                          {items.length === 0 && <small style={muted}>Порожній розділ</small>}
                          {items.map((it, idx) => (<ItemRow key={it.kind + it.data.id} sectionId={s.id} item={it} idx={idx} total={items.length} />))}
                          {isTeacher && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <Button variant="secondary" onClick={() => openCreateProject(s.id)}>+ Проєкт</Button>
                              <Button variant="secondary" onClick={() => openCreateMaterial(s.id)}>+ Матеріал</Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {isTeacher && <Button onClick={openCreateSection}>+ Додати розділ</Button>}
          </div>
        )}

        {tab === 'projects' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ maxWidth: 240 }}><Select value={pSort} onChange={setPSort} options={PROJECT_SORTS} /></div>
            {projects.length === 0 && <p style={muted}>Проєктів ще немає.</p>}
            {projectList.map((p) => <ProjectRow key={p.id} p={p} />)}
          </div>
        )}

        {tab === 'materials' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ maxWidth: 240 }}><Select value={mSort} onChange={setMSort} options={MATERIAL_SORTS} /></div>
            {materials.length === 0 && <p style={muted}>Матеріалів ще немає.</p>}
            {materialList.map((m) => <MaterialRow key={m.id} m={m} />)}
          </div>
        )}

        {sectionModal && (
          <Modal onClose={() => setSectionModal(null)} title={sectionModal === 'create' ? 'Новий розділ' : 'Налаштування розділу'}>
            <form onSubmit={saveSection}>
              <Field label="Назва"><Input value={secName} onChange={(e) => setSecName(e.target.value)} maxLength={45} required /></Field>
              <Field label="Дата відкриття для студентів (необов'язково)">
                <DateTime value={secOpenAt} min={minDate} onChange={setSecOpenAt} />
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input type="checkbox" checked={secHidden} onChange={(e) => setSecHidden(e.target.checked)} />
                Сховати розділ від студентів
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" block>{sectionModal === 'create' ? 'Створити' : 'Зберегти'}</Button>
                <Button type="button" variant="secondary" block onClick={() => setSectionModal(null)}>Скасувати</Button>
              </div>
              {sectionModal !== 'create' && (
                <Button type="button" variant="danger" block onClick={deleteSection} style={{ marginTop: 8 }}>Видалити розділ</Button>
              )}
            </form>
          </Modal>
        )}

        {projectModal && (
          <Modal onClose={() => setProjectModal(null)} title={projectModal.editId ? 'Редагувати проєкт' : 'Створити проєкт'}>
            <form onSubmit={submitProject}>
              <Field><Input placeholder="Назва проєкту" value={pName} onChange={(e) => setPName(e.target.value)} maxLength={45} required /></Field>
              <Field label="Опис (необов'язково)"><RichTextEditor value={pDesc} onChange={setPDesc} placeholder="Опис проєкту..." /></Field>
              {!projectModal.editId && <Field label="Тип"><Select value={pType} onChange={setPType} options={PROJECT_TYPES} /></Field>}
              <Field label="Максимальна оцінка"><Input type="number" min={1} max={100} value={pMax} onChange={(e) => setPMax(e.target.value)} /></Field>
              <Field label="Дедлайн (необов'язково)"><DateTime value={pDeadline} min={minDate} onChange={setPDeadline} /></Field>
              <Field label="Відкрити для студентів (необов'язково)"><DateTime value={pOpenAt} min={minDate} onChange={setPOpenAt} /></Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" block>{projectModal.editId ? 'Зберегти' : 'Створити'}</Button>
                <Button type="button" variant="secondary" block onClick={() => setProjectModal(null)}>Скасувати</Button>
              </div>
              {projectModal.editId && <Button type="button" variant="danger" block onClick={deleteProject} style={{ marginTop: 8 }}>Видалити проєкт</Button>}
            </form>
          </Modal>
        )}

        {materialModal && (
          <Modal onClose={() => setMaterialModal(null)} title={materialModal.editId ? 'Редагувати матеріал' : 'Новий матеріал'}>
            <form onSubmit={submitMaterial}>
              <Field label="Тип"><Select value={mType} onChange={setMType} options={MATERIAL_TYPES} /></Field>
              <Field><Input placeholder="Назва" value={mTitle} onChange={(e) => setMTitle(e.target.value)} maxLength={45} required /></Field>
              <Field label="Опис (необов'язково)"><RichTextEditor value={mDesc} onChange={setMDesc} placeholder="Опис матеріалу..." /></Field>
              {mType === 'LINK' && <Field label="Посилання"><Input placeholder="https://..." value={mUrl} onChange={(e) => setMUrl(e.target.value)} required /></Field>}
              {mType === 'FILES' && (
                <Field label="Файли">
                  {mExistingFiles.length > 0 && (
                    <ul style={{ fontSize: 14, listStyle: 'none', padding: 0, marginTop: 0 }}>
                      {mExistingFiles.map((f) => (
                        <li key={f.id} style={{ marginBottom: 4 }}>
                          {f.fileName}
                          <button type="button" onClick={() => removeExistingFile(f.id)} style={{ marginLeft: 8, color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input type="file" multiple onChange={addMFiles} />
                  {mFiles.length > 0 && (
                    <ul style={{ fontSize: 14, listStyle: 'none', padding: 0 }}>
                      {mFiles.map((f, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {f.name}
                          <button type="button" onClick={() => removeNewFile(i)} style={{ marginLeft: 8, color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Field>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" block>{materialModal.editId ? 'Зберегти' : 'Створити'}</Button>
                <Button type="button" variant="secondary" block onClick={() => setMaterialModal(null)}>Скасувати</Button>
              </div>
              {materialModal.editId && <Button type="button" variant="danger" block onClick={deleteMaterial} style={{ marginTop: 8 }}>Видалити матеріал</Button>}
            </form>
          </Modal>
        )}

        {showStudents && (
          <Modal onClose={() => setShowStudents(false)} title={`Студенти (${students.length})`}>
            {students.length === 0 ? (
              <p style={muted}>На курсі ще немає студентів.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {[...students].sort((a, b) => a.name.localeCompare(b.name, 'uk')).map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{s.name}</div>
                      <small style={muted}>{s.email}</small>
                    </div>
                    <Button variant="danger" onClick={() => removeStudent(s.id, s.name)} style={{ flexShrink: 0 }}>Видалити</Button>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}

        {editingCourse && (
          <Modal onClose={() => setEditingCourse(false)} title="Налаштувати курс">
            <form onSubmit={saveCourse}>
              <Field><Input placeholder="Назва курсу" value={cName} onChange={(e) => setCName(e.target.value)} maxLength={45} required /></Field>
              <Field><Textarea placeholder="Опис (необов'язково)" value={cDesc} onChange={(e) => setCDesc(e.target.value)} /></Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" block>Зберегти</Button>
                <Button type="button" variant="secondary" block onClick={() => setEditingCourse(false)}>Скасувати</Button>
              </div>
              <Button type="button" variant="danger" block onClick={deleteCourse} style={{ marginTop: 8 }}>Видалити курс</Button>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
}