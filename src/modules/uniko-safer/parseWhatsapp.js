// Portado de "uniko safer" (app desktop Electron) — parser dos .txt exportados
// pelo próprio WhatsApp. Formato varia por idioma/SO do telefone, então é
// best-effort: linha que não bate com nenhum padrão nunca derruba o import,
// só é tratada como continuação da mensagem anterior.
//
// Formatos aceitos:
//   12/03/2024, 14:05 - João: mensagem       (24h, sem AM/PM)
//   [12/03/24, 14:05:32] João: mensagem      (americano, com AM/PM)

function parseLineStart(line) {
  const dashMatch = line.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[-–]\s(.*)$/
  );
  if (dashMatch) {
    const [, d, m, y, h, min, s, rest] = dashMatch;
    return {
      day: Number(d), month: Number(m), year: y.length === 2 ? 2000 + Number(y) : Number(y),
      hour: Number(h), minute: Number(min), second: s ? Number(s) : 0, rest,
    };
  }

  const bracketMatch = line.match(
    /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s?([APap][Mm])?\]\s(.*)$/
  );
  if (bracketMatch) {
    const [, mo, d, y, h, min, s, ampm, rest] = bracketMatch;
    let hour = Number(h);
    if (ampm) {
      const isPm = ampm.toLowerCase() === 'pm';
      if (isPm && hour !== 12) hour += 12;
      if (!isPm && hour === 12) hour = 0;
    }
    return {
      day: Number(d), month: Number(mo), year: y.length === 2 ? 2000 + Number(y) : Number(y),
      hour, minute: Number(min), second: s ? Number(s) : 0, rest,
    };
  }

  return null;
}

function toIsoTimestamp(m) {
  return new Date(m.year, m.month - 1, m.day, m.hour, m.minute, m.second).toISOString();
}

export function parseWhatsappTxt(content) {
  const lines = content.split(/\r?\n/);
  let messageCount = 0;
  let firstDate = null;
  let lastDate = null;

  for (const line of lines) {
    const m = parseLineStart(line);
    if (m) {
      const token = `${m.month}/${m.day}/${m.year} ${m.hour}:${String(m.minute).padStart(2, '0')}`;
      messageCount += 1;
      if (!firstDate) firstDate = token;
      lastDate = token;
    }
  }

  return { messageCount, dateRangeStart: firstDate, dateRangeEnd: lastDate };
}

export function parseWhatsappMessages(content) {
  const lines = content.split(/\r?\n/);
  const messages = [];

  for (const rawLine of lines) {
    const m = parseLineStart(rawLine);
    if (m) {
      const timestamp = toIsoTimestamp(m);
      const colonIdx = m.rest.indexOf(': ');
      const sender = colonIdx === -1 ? null : m.rest.slice(0, colonIdx);
      const text = colonIdx === -1 ? m.rest : m.rest.slice(colonIdx + 2);
      messages.push({ timestamp, sender, text });
    } else if (messages.length > 0 && rawLine.trim() !== '') {
      messages[messages.length - 1].text += '\n' + rawLine;
    }
  }

  return messages;
}

// Identidade de uma mensagem, usada pra deduplicar entre exportações. Cada
// exportação do WhatsApp é sempre CUMULATIVA (o histórico inteiro de novo),
// então sem isso reimportar toda semana duplicaria a conversa inteira a cada
// vez. Em vez de mesclar em memória, o hash vira a chave única na tabela
// (uniko_safer_messages) — reimportar só grava o que é realmente novo.
export async function hashMessage(timestamp, sender, text) {
  const data = new TextEncoder().encode(`${timestamp}|${sender ?? ''}|${text}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

export async function sniffFileType(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt')) return 'txt';

  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = header.length === 4 && ZIP_MAGIC.every((b, i) => header[i] === b);
  if (isZip) return 'zip';
  return name.endsWith('.zip') ? 'zip' : 'other';
}

// Extrai o texto da conversa a partir de um File (.txt direto, ou chat.txt
// dentro do .zip exportado pelo WhatsApp) usando JSZip no navegador.
export async function readChatText(file, fileType) {
  if (fileType === 'txt') return file.text();
  if (fileType === 'zip') {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const entryName = Object.keys(zip.files).find((n) => n.toLowerCase() === 'chat.txt');
    if (!entryName) return null;
    return zip.files[entryName].async('text');
  }
  return null;
}

// WhatsApp nomeia o arquivo exportado manualmente como "WhatsApp Chat with
// <Nome>.zip" (inglês) ou "Conversa do WhatsApp com <Nome>.zip" (português) —
// usado no fluxo de arrastar-e-soltar, sem contato pré-selecionado.
const FILENAME_PREFIXES = [
  /^whatsapp chat with\s+/i,
  /^whatsapp chat -\s*/i,
  /^conversa do whatsapp com\s+/i,
  /^conversa do whatsapp -\s*/i,
];

export function deriveContactNameFromFilename(filename) {
  let base = filename.replace(/\.(zip|txt)$/i, '');
  for (const prefix of FILENAME_PREFIXES) {
    if (prefix.test(base)) { base = base.replace(prefix, ''); break; }
  }
  base = base.trim();
  return base || filename;
}

// Nome seguro pra usar como caminho no Storage (sem espaços/acentos/símbolos
// que dão problema em URL).
export function sanitizeStorageName(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'arquivo';
}
