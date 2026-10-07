import { useState, useRef, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { SERVER_URL } from '../../../contexts/user';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';

/* ═══════════════════════════════════════════════════════════════
   BAIXAR ORDENS DE SERVIÇO — só admin.
   Lê a planilha de manutenção da Wowlet (ID da Ordem de Serviço, Setor,
   Credenciado, Cliente), pede ao servidor que um robô entre na Wowlet e baixe
   o PDF de cada ordem, e devolve um .zip: Secretaria / Setor / OS_<id>.pdf.
   Usuário e senha da Wowlet só trafegam pro servidor; não ficam guardados.
═══════════════════════════════════════════════════════════════ */

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
const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14, color: T.text, background: T.surface,
  border: `1px solid ${T.border}`, borderRadius: 9, fontFamily: 'var(--font-body)',
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const pasta = (s) => String(s || 'Sem nome').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Sem nome';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` });

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
const TXT = { fila: 'Na fila', baixando: 'Baixando…', ok: '✓ Baixada', erro: 'Falhou' };

export const TabBaixarOS = () => {
  const [itens, setItens] = useState([]);
  const [arquivo, setArquivo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [job, setJob] = useState(null);
  const [erro, setErro] = useState('');
  const [zipando, setZipando] = useState(false);
  const inputRef = useRef();
  const logRef = useRef();
  const [drag, setDrag] = useState(false);

  const rodando = job && ['fila', 'rodando'].includes(job.status);
  const ok = job ? job.itens.filter((i) => i.estado === 'ok').length : 0;
  const falhas = job ? job.itens.filter((i) => i.estado === 'erro').length : 0;

  // acompanha o job no servidor
  useEffect(() => {
    if (!job?.id || !rodando) return undefined;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${SERVER_URL}/api/wowlet-os/${job.id}`, { headers: authHeaders() });
        if (r.ok) setJob(await r.json());
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 2500);
    return () => clearInterval(t);
  }, [job?.id, rodando]);

  const carregar = async (files) => {
    const f = [...files].find((x) => /\.xlsx$/i.test(x.name));
    if (!f) { setErro('Envie a planilha .xlsx.'); return; }
    setErro('');
    try { setItens(await lerPlanilha(f)); setArquivo(f.name); setJob(null); }
    catch (e) { setErro(e?.message || 'Não consegui ler a planilha.'); }
  };

  const iniciar = async () => {
    setErro('');
    try {
      const r = await fetch(`${SERVER_URL}/api/wowlet-os/start`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha, itens }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Erro ${r.status}`);
      setJob(d);
    } catch (e) { setErro(e?.message || 'Não foi possível iniciar.'); }
  };

  const cancelar = () => fetch(`${SERVER_URL}/api/wowlet-os/${job.id}/cancel`, { method: 'POST', headers: authHeaders() }).catch(() => {});

  const baixarZip = async () => {
    setZipando(true); setErro('');
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const falhou = [];
      for (const it of job.itens) {
        if (it.estado !== 'ok') { falhou.push(`${it.os} | ${it.credenciado} | ${it.setor} → ${it.msg || 'não baixada'}`); continue; }
        const r = await fetch(`${SERVER_URL}/api/wowlet-os/${job.id}/file/${it.idx}`, { headers: authHeaders() });
        if (!r.ok) { falhou.push(`${it.os} → arquivo indisponível no servidor`); continue; }
        zip.file(`${pasta(it.secretaria)}/${pasta(it.setor)}/OS_${it.os}.pdf`, await r.arrayBuffer());
      }
      if (falhou.length) zip.file('ORDENS_NAO_BAIXADAS.txt', falhou.join('\n'));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'Ordens_de_Servico.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { setErro(e?.message || 'Não foi possível montar o zip.'); }
    setZipando(false);
  };

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [job?.logs?.length]);

  const pronto = itens.length > 0 && usuario.trim() && senha && !rodando;
  const lista = job ? job.itens : itens.map((i) => ({ ...i, estado: 'fila' }));
  const cell = { padding: '8px 12px', fontSize: 12.5, color: T.text, borderTop: `1px solid ${T.border}`, verticalAlign: 'top' };

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <StellarHero
        compact
        eyebrow="Automação · Wowlet · Admin"
        title="Baixar Ordens de Serviço"
        subtitle="Envie a planilha de manutenção e o robô entra na Wowlet, baixa o PDF de cada ordem e devolve um zip com uma pasta por secretaria e setor."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 21h14" />
          </svg>
        )}
      />

      <div style={{ maxWidth: 940 }}>
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

        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          <div>
            <span style={labelStyle}>2 · Usuário da Wowlet</span>
            <input style={inputStyle} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="off" disabled={rodando} />
          </div>
          <div>
            <span style={labelStyle}>Senha da Wowlet</span>
            <input style={inputStyle} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" disabled={rodando} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: T.textT, marginTop: 6 }}>A senha só vai pro servidor durante o download e não é guardada.</div>

        {lista.length > 0 && (
          <div style={{ marginTop: 18, border: `1px solid ${T.border}`, borderRadius: 14, background: T.surface, overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {['Ordem', 'Credenciado', 'Setor', 'Situação'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: T.textT, letterSpacing: '.06em', textTransform: 'uppercase', position: 'sticky', top: 0, background: T.surface }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.os}>
                    <td style={{ ...cell, fontWeight: 700 }}>{i.os}</td>
                    <td style={cell}>{i.credenciado}</td>
                    <td style={cell}>{i.setor || '—'}</td>
                    <td style={{ ...cell, color: COR[i.estado], fontWeight: 600 }}>
                      {TXT[i.estado]}{i.estado === 'erro' && i.msg ? <div style={{ fontWeight: 400, fontSize: 11.5 }}>{i.msg}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {job?.logs?.length > 0 && (
          <div ref={logRef} style={{
            marginTop: 14, maxHeight: 260, overflowY: 'auto', background: '#0F1117', color: '#C9D1D9', borderRadius: 12,
            padding: '12px 14px', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5, lineHeight: 1.6,
          }}>
            {job.logs.map((l, i) => (
              <div key={i} style={{ color: /ERRO|falhou/.test(l.msg) ? '#FF7B72' : /salvo|feito|Conclu/.test(l.msg) ? '#7EE787' : undefined }}>
                <span style={{ opacity: .5 }}>{new Date(l.t).toLocaleTimeString('pt-BR')}</span>  {l.msg}
              </div>
            ))}
          </div>
        )}

        {job && (
          <div style={{ marginTop: 10, fontSize: 13, color: T.textS }}>
            {rodando ? 'Baixando… ' : job.status === 'cancelado' ? 'Cancelado. ' : 'Concluído. '}
            {ok} de {job.itens.length} baixada(s){falhas ? ` · ${falhas} com falha` : ''}.
            {job.erro && <span style={{ color: T.danger }}> {job.erro}</span>}
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
          {job && !rodando && ok > 0 && (
            <button style={btnPrimary} onClick={baixarZip} disabled={zipando}>{zipando ? 'Montando zip…' : `Baixar zip (${ok} PDF)`}</button>
          )}
        </div>
      </div>
    </div>
  );
};
