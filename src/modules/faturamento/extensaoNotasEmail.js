/* ── Cliente da extensão "Uniko — Notas por e-mail" ──────────────────────
   Conversa com a extensão pela ponte (window.postMessage). A extensão abre o
   Gmail das contas escolhidas, acha os PDFs das notas que faltam e devolve os
   bytes; quem lê o PDF e confere número/CNPJ é o próprio Uniko. */

const ORIGEM = () => window.location.origin;
const enviar = (msg) => window.postMessage(msg, ORIGEM());

// Só aceita mensagens da própria página (a ponte reemite as da extensão aqui).
const daPagina = (e) => e.source === window && e.origin === ORIGEM();

const base64ParaBytes = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/** A extensão está instalada e ativa? Devolve { versao } ou null. */
export const detectarExtensao = (espera = 1500) =>
  new Promise((resolve) => {
    let feito = false;
    const ouvir = (e) => {
      if (!daPagina(e) || e.data?.type !== 'NOTASMAIL_PONG') return;
      feito = true;
      window.removeEventListener('message', ouvir);
      resolve({ versao: e.data.versao });
    };
    window.addEventListener('message', ouvir);
    enviar({ type: 'NOTASMAIL_PING' });
    setTimeout(() => {
      if (!feito) {
        window.removeEventListener('message', ouvir);
        resolve(null);
      }
    }, espera);
  });

/**
 * Manda a extensão procurar `numeros` nas contas do Gmail `contas` (índices de
 * mail.google.com/mail/u/N/). `onArquivo` recebe cada PDF ({ numeros, nome,
 * assunto, dataEmail, email, conta, bytes }) e pode ser assíncrono; os PDFs são
 * processados um de cada vez. Devolve { promessa, cancelar }.
 */
export const buscarNoEmail = ({ numeros, contas, onLog, onProgresso, onArquivo }) => {
  const jobId = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let ouvir;
  const promessa = new Promise((resolve, reject) => {
    let fila = Promise.resolve();
    ouvir = (e) => {
      if (!daPagina(e)) return;
      const m = e.data;
      if (!m?.type?.startsWith('NOTASMAIL_') || (m.jobId && m.jobId !== jobId)) return;
      if (m.type === 'NOTASMAIL_LOG') onLog?.(m.texto);
      else if (m.type === 'NOTASMAIL_PROGRESSO') onProgresso?.(m);
      else if (m.type === 'NOTASMAIL_ARQUIVO') {
        const { base64, ...resto } = m;
        fila = fila.then(() => onArquivo?.({ ...resto, bytes: base64ParaBytes(base64) })).catch(() => {});
      } else if (m.type === 'NOTASMAIL_ERROR') {
        window.removeEventListener('message', ouvir);
        reject(new Error(m.message || 'Falha na extensão.'));
      } else if (m.type === 'NOTASMAIL_DONE') {
        // só encerra depois de ler todos os PDFs que já chegaram
        fila.then(() => {
          window.removeEventListener('message', ouvir);
          resolve(m);
        });
      }
    };
    window.addEventListener('message', ouvir);
    enviar({ type: 'NOTASMAIL_START', jobId, numeros, contas });
  });
  const cancelar = () => enviar({ type: 'NOTASMAIL_CANCEL', jobId });
  return { promessa, cancelar };
};

/**
 * Baixa em lote os PDFs das NFS-e no ISS Fortaleza (consultarNota.seam). `notas` =
 * [{ numero, codigo }] (número da nota e código de verificação, lidos do XML); a
 * extensão completa a "chave" da 7Serv sozinha. `onArquivo({ numero, bytes })` é
 * chamado a cada PDF. Devolve { promessa, cancelar }; a promessa resolve com
 * { ok, falhas:[{numero, erro}], cancelado }.
 */
export const baixarNotasISS = ({ notas, onProgresso, onArquivo }) => {
  const jobId = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let ouvir;
  const promessa = new Promise((resolve, reject) => {
    let fila = Promise.resolve();
    ouvir = (e) => {
      if (!daPagina(e)) return;
      const m = e.data;
      if (!m?.type?.startsWith('NOTASMAIL_') || m.jobId !== jobId) return;
      if (m.type === 'NOTASMAIL_ISS_PROGRESSO') onProgresso?.(m);
      else if (m.type === 'NOTASMAIL_ISS_ARQUIVO')
        fila = fila.then(() => onArquivo?.({ numero: m.numero, bytes: base64ParaBytes(m.base64) })).catch(() => {});
      else if (m.type === 'NOTASMAIL_ERROR') {
        window.removeEventListener('message', ouvir);
        reject(new Error(m.message || 'Falha na extensão.'));
      } else if (m.type === 'NOTASMAIL_ISS_DONE') {
        fila.then(() => {
          window.removeEventListener('message', ouvir);
          resolve(m);
        });
      }
    };
    window.addEventListener('message', ouvir);
    enviar({ type: 'NOTASMAIL_ISS_START', jobId, notas });
  });
  const cancelar = () => enviar({ type: 'NOTASMAIL_ISS_CANCEL', jobId });
  return { promessa, cancelar };
};
