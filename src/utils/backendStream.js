export const BACKEND = 'http://localhost:3001';

export const checkBackend = () =>
  fetch(`${BACKEND}/api/ping`, { signal: AbortSignal.timeout(2000) })
    .then(r => r.ok)
    .catch(() => false);

/**
 * Abre um POST com resposta SSE e yielda os eventos JSON.
 * Eventos: { type: 'log'|'pdf'|'done'|'error', ... }
 */
export async function* streamBackend(endpoint, body) {
  const res = await fetch(`${BACKEND}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Servidor retornou ${res.status}: ${txt}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop(); // fragmento incompleto
    for (const part of parts) {
      if (!part.startsWith('data: ')) continue;
      try { yield JSON.parse(part.slice(6)); } catch { /* ignora linha malformada */ }
    }
  }
}
