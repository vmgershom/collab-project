import { useEffect, useRef, useState } from 'react';
import { api, BASE_URL } from '../api.js';
import { getToken } from '../auth.js';
import { Button, Card, Input, Textarea, Field, Modal } from './ui.jsx';

export default function MaterialsTab({ courseId, isTeacher }) {
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [formMode, setFormMode] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [removeFileIds, setRemoveFileIds] = useState([]);
  const fileInputRef = useRef(null);

  async function load() {
    setError('');
    try { setMaterials(await api(`/materials?courseId=${courseId}`, { token: getToken() })); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [courseId]);

  function openCreate() {
    setFormMode('create'); setTitle(''); setDescription(''); setFiles([]); setExistingFiles([]); setRemoveFileIds([]);
  }
  function openEdit(m) {
    setFormMode(m); setTitle(m.title); setDescription(m.description || '');
    setFiles([]); setExistingFiles(m.files); setRemoveFileIds([]);
  }

  const isEdit = formMode && formMode !== 'create';
  const formDirty = isEdit
    ? (title !== formMode.title || description !== (formMode.description || '') || files.length > 0 || removeFileIds.length > 0)
    : (title.trim() || description.trim() || files.length > 0);

  function closeForm() {
    if (formDirty && !window.confirm('Ви точно хочете вийти? Всі зміни будуть відкинуті')) return;
    setFormMode(null);
    setTitle(''); setDescription(''); setFiles([]); setExistingFiles([]); setRemoveFileIds([]);
  }

  function addFiles(e) {
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  }
  function removeNewFile(i) { setFiles((prev) => prev.filter((_, idx) => idx !== i)); }
  function removeExistingFile(id) {
    setExistingFiles((prev) => prev.filter((f) => f.id !== id));
    setRemoveFileIds((prev) => [...prev, id]);
  }

  async function submitForm(e) {
    e.preventDefault(); setError('');
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      files.forEach((f) => formData.append('files', f));
      let url, method;
      if (isEdit) {
        formData.append('removeFileIds', JSON.stringify(removeFileIds));
        url = `${BASE_URL}/materials/${formMode.id}`; method = 'PATCH';
      } else {
        formData.append('courseId', courseId);
        url = `${BASE_URL}/materials`; method = 'POST';
      }
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Помилка');
      setFormMode(null);
      setTitle(''); setDescription(''); setFiles([]); setExistingFiles([]); setRemoveFileIds([]);
      load();
    } catch (err) { setError(err.message); }
  }

  async function handleDelete() {
    if (!window.confirm('Видалити матеріал разом з усіма файлами?')) return;
    setError('');
    try { await api(`/materials/${formMode.id}`, { method: 'DELETE', token: getToken() }); setFormMode(null); load(); }
    catch (err) { setError(err.message); }
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {isTeacher && <Button onClick={openCreate} style={{ marginBottom: 16 }}>Створити</Button>}

      {materials.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Матеріалів ще немає.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {materials.map((m) => (
          <Card key={m.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                style={{ cursor: 'pointer', fontWeight: 600, fontSize: 18, flex: 1 }}>
                {m.title}
              </div>
              {isTeacher && <Button variant="secondary" onClick={() => openEdit(m)}>Редагувати</Button>}
            </div>
            {expandedId === m.id && (
              <div style={{ marginTop: 8 }}>
                {m.description && <p style={{ color: 'var(--color-text)' }}>{m.description}</p>}
                {m.files.length > 0 ? (
                  <ul>
                    {m.files.map((f) => (
                      <li key={f.id}><a href={`${BASE_URL}/materials/files/${f.id}/download`}>{f.fileName}</a></li>
                    ))}
                  </ul>
                ) : (
                  <small style={{ color: '#94a3b8' }}>Без прикріплених файлів</small>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {formMode && (
        <Modal onClose={closeForm} title={isEdit ? 'Редагувати матеріал' : 'Новий навчальний матеріал'}>
          <form onSubmit={submitForm}>
            <Field><Input placeholder="Назва" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={45} required /></Field>
            <Field><Textarea placeholder="Опис" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

            {existingFiles.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <small style={{ color: 'var(--color-muted)' }}>Прикріплені файли:</small>
                <ul style={{ fontSize: 14, listStyle: 'none', padding: 0, marginTop: 4 }}>
                  {existingFiles.map((f) => (
                    <li key={f.id} style={{ marginBottom: 4 }}>
                      {f.fileName}
                      <button type="button" onClick={() => removeExistingFile(f.id)}
                        style={{ marginLeft: 8, color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <input ref={fileInputRef} type="file" multiple onChange={addFiles} style={{ display: 'none' }} />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current.click()} style={{ marginBottom: 8 }}>
              Додати файли
            </Button>

            {files.length > 0 && (
              <ul style={{ fontSize: 14, listStyle: 'none', padding: 0 }}>
                {files.map((f, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {f.name}
                    <button type="button" onClick={() => removeNewFile(i)}
                      style={{ marginLeft: 8, color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button type="submit" block>{isEdit ? 'Зберегти' : 'Створити'}</Button>
              <Button type="button" variant="secondary" block onClick={closeForm}>Скасувати</Button>
            </div>
            {isEdit && (
              <Button type="button" variant="danger" block onClick={handleDelete} style={{ marginTop: 8 }}>
                Видалити матеріал
              </Button>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}