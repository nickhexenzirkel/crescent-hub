import { useState, useRef, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import { baixarOrdensServico, detectarExtensao } from '../extensaoNotasEmail';

/* ═══════════════════════════════════════════════════════════════
   BAIXAR ORDENS DE SERVIÇO — só admin.
   Lê a planilha de manutenção da Wowlet (ID da Ordem de Serviço, Setor,
   Credenciado, Cliente) e pede à extensão "Uniko — Notas por e-mail" (v1.4.0+)
   que, no SEU Chrome (já logado na Wowlet — sem captcha), abra cada ordem e a
   imprima em PDF (Ctrl+P). Os PDFs são gravados direto na pasta escolhida:
   Secretaria / Setor / OS_<id>.pdf. Nada passa pelo servidor.
═══════════════════════════════════════════════════════════════ */

const VERSAO_MIN = [1, 4, 0];
const versaoOk = (v) => {
  const p = String(v || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((p[i] || 0) > VERSAO_MIN[i]) return true; if ((p[i] || 0) < VERSAO_MIN[i]) return false; }
  return true;
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 8, background: T.gold, color: '#fff', border: 'none',
  borderRadius: 10, padding: '12px 26px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-body)', boxShadow: `0 2px 10px ${T.gold}44`,
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: T.textS,
  border: `1px solid ${T.border}`, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-body)',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: T.textT, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8, display: 'block' };

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const pasta = (s) => String(s || 'Sem nome').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Sem nome';

/** Lê a planilha pelo NOME das colunas (a ordem delas muda de relatório pra relatório). */
async function lerPlanilha(file) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  const cab = {};
  ws.getRow(1).eachCell((c, i) => { cab[norm(c.value?.result ?? c.value)] = i; });
  const col = (...nomes) => { for (const n of nomes) { const k = Object.keys(cab).find((h) => h.startsWith(n)); if (k) return cab[k]; } return null; };
  const cOs = col('id da ordem'), cSetor = col('setor'), cCred = col('credenciado'), cCli = col('cliente');
  if (!cOs || !cCred) throw new Error('Não achei as colunas "ID da Ordem de Serviço" e "Credenciado" na primeira linha.');
  const txt = (r, c) => (c ? String(r.getCell(c).value?.result ?? r.getCell(c).value ?? '').trim() : '');
  const itens = []; const vistos = new Set();
  ws.eachRow((r, n) => {
    if (n === 1) return;
    const os = txt(r, cOs);
    if (!os || vistos.has(os)) return;
    vistos.add(os);
    itens.push({ os, credenciado: txt(r, cCred), setor: txt(r, cSetor), secretaria: txt(r, cCli) });
  });
  return itens;
}

const COR = { fila: '#8A8A8A', baixando: '#C98A1B', ok: '#1A9C70', erro: '#C04050' };
const TXT = { fila: 'Na fila', baixando: 'Baixando…', ok: '✓ Salva', erro: 'Falhou' };

export const TabBaixarOS = () => {
  const [itens, setItens] = useState([]);
  const [arquivo, setArquivo] = useState('');
  const [estados, setEstados] = useState({});
  const [logs, setLogs] = useState([]);
  const [rodando, setRodando] = useState(false);
  const [fim, setFim] = useState(null);
  const [erro, setErro] = useState('');
  const [ext, setExt] = useState(undefined); // undefined = verificando, null = ausente
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const logRef = useRef();
  const jobRef = useRef(null);

  useEffect(() => { detectarExtensao(2000).then(setExt); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs.length]);

  const addLog = (msg) => setLogs((l) => [...l.slice(-400), { t: Date.now(), msg }]);

  const carregar = async (files) => {
    const f = [...files].find((x) => /\.xlsx$/i.test(x.name));
    if (!f) { setErro('Envie a planilha .xlsx.'); return; }
    setErro('');
    try { setItens(await lerPlanilha(f)); setArquivo(f.name); setEstados({}); setLogs([]); setFim(null); }
    catch (e) { setErro(e?.message || 'Não consegui ler a planilha.'); }
  };

  const iniciar = async () => {
    setErro(''); setFim(null); setLogs([]); setEstados({});
    setRodando(true);
    const job = baixarOrdensServico({
      itens: itens.map(({ os, credenciado, secretaria, setor }) => ({ os, credenciado, secretaria, setor })),
      onLog: addLog,
      onItem: (m) => setEstados((e) => ({ ...e, [m.os]: { estado: m.estado, msg: m.msg } })),
    });
    jobRef.current = job;
    try { setFim(await job.promessa); }
    catch (e) { setErro(e?.message || 'A extensão parou.'); }
    setRodando(false);
  };

  const cancelar = () => jobRef.current?.cancelar();

  const extOk = ext && versaoOk(ext.versao);
  const pronto = itens.length > 0 && extOk && !rodando;
  const ok = Object.values(estados).filter((s) => s.estado === 'ok').length;
  const falhas = Object.values(estados).filter((s) => s.estado === 'erro').length;
  const cell = { padding: '8px 12px', fontSize: 12.5, color: T.text, borderTop: `1px solid ${T.border}`, verticalAlign: 'top' };

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <StellarHero
        compact
        eyebrow="Automação · Wowlet · Admin"
        title="Baixar Ordens de Serviço"
        subtitle="Envie a planilha de manutenção e a extensão baixa, no seu Chrome, o PDF de cada ordem da Wowlet em pastas por secretaria e setor."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 21h14" />
          </svg>
        )}
      />

      <div style={{ maxWidth: 940 }}>
        {ext !== undefined && !extOk && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(201,138,27,0.08)', border: '1px solid rgba(201,138,27,0.3)', borderRadius: 10, fontSize: 13.5, color: T.text }}>
            {ext
              ? `A extensão "Uniko — Notas por e-mail" está na versão ${ext.versao}; é preciso a ${VERSAO_MIN.join('.')} ou mais nova. Atualize os arquivos, clique em Recarregar em chrome://extensions (ela pede a nova permissão de depuração) e dê F5 aqui.`
              : 'Não encontrei a extensão "Uniko — Notas por e-mail". Instale/recarregue em chrome://extensions e dê F5 nesta página.'}
          </div>
        )}

        <span style={labelStyle}>1 · Planilha de manutenção (.xlsx)</span>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); carregar(e.dataTransfer.files); }}
          style={{
            border: `2px dashed ${drag || itens.length ? T.gold : T.border}`, borderRadius: 14, padding: '26px 24px', textAlign: 'center',
            cursor: 'pointer', background: drag || itens.length ? T.goldGl : T.surface,
          }}>
          <input ref={inputRef} type="file" accept=".xlsx" style={{ display: 'none' }}
            onChange={(e) => { carregar(e.target.files); e.target.value = ''; }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
            {itens.length ? `${arquivo} — ${itens.length} ordem(ns)` : 'Arraste a planilha aqui ou clique'}
          </div>
          <div style={{ fontSize: 12.5, color: T.textT, marginTop: 5 }}>
            Usa as colunas ID da Ordem de Serviço, Credenciado, Setor e Cliente (a secretaria).
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: T.textT, marginTop: 8 }}>
          Antes de iniciar, esteja logado na Wowlet neste Chrome. Os PDFs são gravados sozinhos em Downloads\Ordens de Servico\Secretaria\Setor.
        </div>

        {itens.length > 0 && (
          <div style={{ marginTop: 18, border: `1px solid ${T.border}`, borderRadius: 14, background: T.surface, overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {['Ordem', 'Credenciado', 'Setor', 'Situação'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: T.textT, letterSpacing: '.06em', textTransform: 'uppercase', position: 'sticky', top: 0, background: T.surface }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => {
                  const s = estados[i.os] || { estado: 'fila' };
                  return (
                    <tr key={i.os}>
                      <td style={{ ...cell, fontWeight: 700 }}>{i.os}</td>
                      <td style={cell}>{i.credenciado}</td>
                      <td style={cell}>{i.setor || '—'}</td>
                      <td style={{ ...cell, color: COR[s.estado], fontWeight: 600 }}>
                        {TXT[s.estado]}{s.estado === 'erro' && s.msg ? <div style={{ fontWeight: 400, fontSize: 11.5 }}>{s.msg}</div> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {logs.length > 0 && (
          <div ref={logRef} style={{
            marginTop: 14, maxHeight: 260, overflowY: 'auto', background: '#0F1117', color: '#C9D1D9', borderRadius: 12,
            padding: '12px 14px', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5, lineHeight: 1.6,
          }}>
            {logs.map((l, i) => (
              <div key={i} style={{ color: /ERRO|FALHOU/.test(l.msg) ? '#FF7B72' : /salva|feito|Conclu/.test(l.msg) ? '#7EE787' : l.msg.startsWith('>>>') ? '#F2CC60' : undefined }}>
                <span style={{ opacity: .5 }}>{new Date(l.t).toLocaleTimeString('pt-BR')}</span>  {l.msg}
              </div>
            ))}
          </div>
        )}

        {(rodando || fim) && (
          <div style={{ marginTop: 10, fontSize: 13, color: T.textS }}>
            {rodando ? 'Baixando… ' : fim?.cancelado ? 'Cancelado. ' : 'Concluído. '}
            {ok} de {itens.length} salva(s){falhas ? ` · ${falhas} com falha` : ''}.
          </div>
        )}

        {erro && (
          <div style={{ marginTop: 18, padding: '12px 16px', background: 'rgba(192,64,80,0.06)', border: '1px solid rgba(192,64,80,0.2)', borderRadius: 10, fontSize: 13.5, color: T.danger }}>{erro}</div>
        )}

        <StarDivider my={22} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {!rodando && (
            <button onClick={iniciar} disabled={!pronto} style={{
              ...btnPrimary, background: pronto ? T.gold : 'transparent', color: pronto ? '#fff' : T.textD,
              boxShadow: pronto ? btnPrimary.boxShadow : 'none', border: pronto ? 'none' : `1px solid ${T.border}`,
              cursor: pronto ? 'pointer' : 'not-allowed',
            }}>Iniciar download</button>
          )}
          {rodando && <button style={btnGhost} onClick={cancelar}>Cancelar</button>}
        </div>
      </div>
    </div>
  );
};
