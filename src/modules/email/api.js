import { SERVER_URL } from '../../contexts/user';

async function request(path, options = {}) {
  const token = localStorage.getItem('ch_token');
  if (!token) throw new Error('Sua sessão expirou. Entre novamente no Uniko.');
  const response = await fetch(`${SERVER_URL}/api/email${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Não foi possível consultar o Gmail.');
    error.retryAfter = Number(data.retryAfter) || Number(response.headers.get('Retry-After')) || 0;
    throw error;
  }
  return data;
}

export function getStatus() {
  return request('/status');
}

export function startOAuth() {
  return request('/oauth/start', { method: 'POST' });
}

export function disconnect() {
  return request('/disconnect', { method: 'DELETE' });
}

export function listMessages(query, pageToken) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (pageToken) params.set('pageToken', pageToken);
  return request(`/messages?${params.toString()}`);
}

export function getFaturamento(filtro, pageToken = '', { force = false } = {}) {
  const params = new URLSearchParams(
    typeof filtro === 'string' ? { month: filtro } : filtro,
  );
  if (pageToken) params.set('pageToken', pageToken);
  if (force) params.set('refresh', '1');
  return request(`/faturamento?${params.toString()}`);
}

export function getMessage(id) {
  return request(`/messages/${encodeURIComponent(id)}`);
}

export async function getAttachment(messageId, attachment) {
  const token = localStorage.getItem('ch_token');
  if (!token) throw new Error('Sua sessão expirou. Entre novamente no Uniko.');
  const params = new URLSearchParams({
    filename: attachment.filename || 'anexo',
    mimeType: attachment.mimeType || 'application/octet-stream',
  });
  const response = await fetch(
    `${SERVER_URL}/api/email/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Não foi possível baixar o anexo.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quoted = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let filename = quoted || 'anexo';
  if (encoded) {
    try { filename = decodeURIComponent(encoded); } catch { filename = quoted || 'anexo'; }
  }
  return { blob, filename };
}

export async function downloadAttachment(messageId, attachment) {
  const { blob, filename } = await getAttachment(messageId, attachment);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
