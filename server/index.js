import express from 'express';
import cors from 'cors';
import { executarDownloadConsumo } from './automacao/consumo.js';
import { executarDownloadOrdens } from './automacao/ordens.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173', 'https://crescent-hub.vercel.app'] }));
app.use(express.json({ limit: '10mb' }));

/* ── Health check ── */
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

/* ── Helper: SSE stream sobre POST ── */
function sseStream(res, fn) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const emit = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  fn(emit).catch(err => {
    emit({ type: 'error', text: err.message });
  }).finally(() => {
    res.end();
  });
}

/* ── Relatório de Consumo ── */
app.post('/api/consumo/download', (req, res) => {
  const { username, password, startDate, endDate, category, downloadItems, orgName } = req.body;

  if (!username || !password || !downloadItems?.length) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: username, password, downloadItems' });
  }

  sseStream(res, (emit) =>
    executarDownloadConsumo({ username, password, startDate, endDate, category, downloadItems, orgName }, emit)
  );
});

/* ── Ordens de Serviço ── */
app.post('/api/ordens/download', (req, res) => {
  const { username, password, orgName, items } = req.body;

  if (!username || !password || !items?.length) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: username, password, items' });
  }

  sseStream(res, (emit) =>
    executarDownloadOrdens({ username, password, orgName, items }, emit)
  );
});

app.listen(PORT, () => {
  console.log(`\n✦ Uniko Server rodando em http://localhost:${PORT}\n`);
});
