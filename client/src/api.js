export const BASE_URL = 'http://localhost:3000';

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Помилка запиту');
  }
  return data;
}

export async function apiUpload(path, file, token) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Помилка завантаження');
  return data;
}