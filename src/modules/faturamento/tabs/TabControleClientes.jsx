import { useState, useRef, useMemo, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { StellarHero } from '../StellarHero';
import {
  MODELOS, METODOS, CATEGORIAS, PERIODOS, linhaVazia, linhasValidas,
  importarPlanilha, montarHtml, gerarXlsx,
} from '../controleClientes';

/* ═══════════════════════════════════════════════════════════════
   CONTROLE DE CLIENTES — a pessoa digita (ou importa) a carteira dela e
   baixa a planilha em 1 de 4 modelos, ou imprime na horizontal/vertical.
   Os dados ficam só neste navegador (localStorage); nada vai pro servidor.
═══════════════════════════════════════════════════════════════ */

const LS = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const LSset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, fontSize: 13,
  border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontFamily: 'var(--font-body)', outline: 'none',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: T.textT, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8, display: 'block' };
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 8, background: T.gold, color: '#fff', border: 'none',
  borderRadius: 10, padding: '12px 24px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-body)', boxShadow: `0 2px 10px ${T.gold}44`,
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: T.textS,
  border: `1px solid ${T.border}`, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-body)',
};
const secTitulo = (n, t) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '30px 0 14px' }}>
    <span style={{ fontSize: 12, fontWeight: 700, color: T.textD, letterSpacing: '.1em', textTransform: 'uppercase' }}>{n}. {t}</span>
    <div style={{ flex: 1 }}><StarDivider my={0} dim /></div>
  </div>
);

export const TabControleClientes = () => {
  const isMobile = useIsMobile();
  const [titulo, setTituloS] = useState(() => LS('ctrlcli.titulo', 'CONTROLE DE CLIENTES'));
  const [rows, setRowsS] = useState(() => { const r = LS('ctrlcli.rows', null); return Array.isArray(r) && r.length ? r : [linhaVazia()]; });
  const [modelo, setModeloS] = useState(() => LS('ctrlcli.modelo', 'classico'));
  const [orientacao, setOrientacaoS] = useState(() => LS('ctrlcli.orient', 'landscape'));
  const [cores, setCoresS] = useState(() => LS('ctrlcli.cores', {}));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const frameRef = useRef();

  const setTitulo = (v) => { setTituloS(v); LSset('ctrlcli.titulo', v); };
  const setRows = (fn) => setRowsS((rs) => { const n = typeof fn === 'function' ? fn(rs) : fn; LSset('ctrlcli.rows', n); return n; });
  const setCor = (nome, hex) => setCoresS((c) => { const n = { ...c }; if (hex) n[nome] = hex; else delete n[nome]; LSset('ctrlcli.cores', n); return n; });
  const setModelo = (v) => { setModeloS(v); LSset('ctrlcli.modelo', v); };
  const setOrientacao = (v) => { setOrientacaoS(v); LSset('ctrlcli.orient', v); };

  const patch = (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remover = (id) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [linhaVazia()]));
  const adicionar = () => setRows((rs) => {
    const ult = rs[rs.length - 1];
    // a linha nova herda o comercial da anterior: o normal é lançar vários clientes do mesmo comercial em sequência
    return [...rs, { ...linhaVazia(), comercial: ult?.comercial || '' }];
  });

  const validas = linhasValidas(rows);
  const comerciais = useMemo(() => [...new Set(rows.map((r) => (r.comercial || '').trim().toUpperCase()).filter(Boolean))], [rows]);
  const html = useMemo(() => montarHtml({ modelo, rows, titulo, orientacao, cores }), [modelo, rows, titulo, orientacao, cores]);

  useEffect(() => { if (!msg) return undefined; const t = setTimeout(() => setMsg(''), 5000); return () => clearTimeout(t); }, [msg]);

  const importar = async (file) => {
    if (!file) return;
    try {
      const { rows: novas, titulo: t } = await importarPlanilha(file);
      if (!novas.length) { setMsg('Não encontrei clientes nessa planilha.'); return; }
      setRows((rs) => [...linhasValidas(rs), ...novas]);
      if (t && (titulo === 'CONTROLE DE CLIENTES' || !titulo)) setTitulo(t);
      setMsg(`${novas.length} clientes importados.`);
    } catch (e) {
      setMsg(`Não consegui ler a planilha (${e?.message || 'arquivo inválido'}).`);
    }
  };

  const baixar = async () => {
    setBusy(true);
    try {
      const buf = await gerarXlsx({ modelo, rows, titulo, orientacao, cores });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `${(titulo || 'Controle de Clientes').replace(/[\\/:*?"<>|]+/g, ' ').trim()}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      setMsg(`Falha ao gerar a planilha: ${e?.message || 'erro desconhecido'}`);
    }
    setBusy(false);
  };

  const imprimir = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  const limpar = () => {
    if (!window.confirm('Apagar todos os clientes desta lista?')) return;
    setRows([linhaVazia()]);
  };

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textT, letterSpacing: '.06em', textTransform: 'uppercase', padding: '8px 6px', whiteSpace: 'nowrap' };
  const td = { padding: '4px 4px', verticalAlign: 'middle' };

  return (
    <div style={{ fontFamily: 'var(--font-body)', maxWidth: 1180, margin: '0 auto' }}>
      <StellarHero
        compact
        eyebrow="Carteira de clientes"
        title="Controle de Clientes"
        subtitle="Monte a sua lista com comercial, categoria, período, setor e método — e baixe a planilha pronta ou imprima."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        )}
      />

      {secTitulo(1, 'Seus clientes')}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div style={{ flex: '1 1 320px' }}>
          <label style={labelStyle}>Título da planilha</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: DIVISÃO DE MUNICÍPIOS - SEU NOME" style={{ ...inputStyle, padding: '10px 12px', fontSize: 14 }} />
        </div>
        <button style={btnGhost} onClick={() => fileRef.current?.click()}>Importar planilha existente</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { importar(e.target.files?.[0]); e.target.value = ''; }} />
        <button style={{ ...btnGhost, color: T.danger }} onClick={limpar}>Limpar lista</button>
      </div>

      <datalist id="cc-comerciais">{comerciais.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="cc-periodos">{PERIODOS.map((c) => <option key={c} value={c} />)}</datalist>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 14, background: T.surface, padding: '4px 8px 10px' }}>
        <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 120 }}>Comercial</th>
              <th style={th}>Cliente</th>
              <th style={{ ...th, width: 130 }}>Categoria</th>
              <th style={{ ...th, width: 150 }}>Período</th>
              <th style={{ ...th, width: 80 }}>Setor</th>
              <th style={{ ...th, width: 120 }}>Método</th>
              <th style={th}>Observação</th>
              <th style={{ ...th, width: 34 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}><input list="cc-comerciais" value={r.comercial} onChange={(e) => patch(r.id, { comercial: e.target.value.toUpperCase() })} style={inputStyle} /></td>
                <td style={td}><input value={r.cliente} onChange={(e) => patch(r.id, { cliente: e.target.value.toUpperCase() })} placeholder="45 - EUSÉBIO" style={inputStyle} /></td>
                <td style={td}>
                  <input list="cc-categorias" value={r.categoria} onChange={(e) => patch(r.id, { categoria: e.target.value.toUpperCase() })} style={inputStyle} />
                </td>
                <td style={td}><input list="cc-periodos" value={r.periodo} onChange={(e) => patch(r.id, { periodo: e.target.value.toUpperCase() })} style={inputStyle} /></td>
                <td style={td}>
                  <select value={r.setor} onChange={(e) => patch(r.id, { setor: e.target.value })} style={inputStyle}>
                    <option>SIM</option><option>NÃO</option>
                  </select>
                </td>
                <td style={td}>
                  <select value={r.metodo} onChange={(e) => patch(r.id, { metodo: e.target.value })} style={inputStyle}>
                    {[...new Set([...METODOS, r.metodo].filter(Boolean))].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </td>
                <td style={td}><input value={r.obs} onChange={(e) => patch(r.id, { obs: e.target.value.toUpperCase() })} placeholder="Algo importante sobre este cliente" style={inputStyle} /></td>
                <td style={td}>
                  <button onClick={() => remover(r.id)} title="Remover" style={{ background: 'none', border: 'none', color: T.textD, cursor: 'pointer', fontSize: 17, padding: 4 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="cc-categorias">{CATEGORIAS.map((c) => <option key={c} value={c} />)}</datalist>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px 0' }}>
          <button style={btnGhost} onClick={adicionar}>+ Adicionar cliente</button>
          <span style={{ fontSize: 12.5, color: T.textT }}>{validas.length} {validas.length === 1 ? 'cliente' : 'clientes'} · salvo automaticamente neste navegador</span>
        </div>
      </div>

      {comerciais.length > 0 && (
        <div style={{ marginTop: 16, padding: '14px 16px', border: `1px solid ${T.border}`, borderRadius: 14, background: T.surface }}>
          <label style={labelStyle}>Cor de cada comercial (destaca a célula do nome)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {comerciais.map((nome) => (
              <div key={nome} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <input type="color" value={cores[nome] || '#cccccc'} onChange={(e) => setCor(nome, e.target.value)}
                  style={{ width: 30, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{nome}</span>
                {cores[nome] && <button onClick={() => setCor(nome, null)} title="Tirar a cor" style={{ background: 'none', border: 'none', color: T.textD, cursor: 'pointer', fontSize: 14 }}>✕</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {secTitulo(2, 'Escolha o modelo')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14 }}>
        {MODELOS.map((m) => {
          const a = modelo === m.id;
          return (
            <div key={m.id} onClick={() => setModelo(m.id)} style={{
              cursor: 'pointer', padding: '16px 18px', borderRadius: 14, background: T.surface,
              border: `2px solid ${a ? m.cor : T.border}`, boxShadow: a ? `0 4px 18px ${m.cor}33` : 'none', transition: 'all .14s',
            }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                <span style={{ flex: 1, height: 10, borderRadius: 4, background: m.cor }} />
                <span style={{ flex: 2, height: 10, borderRadius: 4, background: m.cor, opacity: 0.45 }} />
                <span style={{ flex: 1, height: 10, borderRadius: 4, background: m.cor, opacity: 0.2 }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: a ? m.cor : T.text }}>{m.titulo}</div>
              <div style={{ fontSize: 12.5, color: T.textT, marginTop: 4, lineHeight: 1.45 }}>{m.sub}</div>
            </div>
          );
        })}
      </div>

      {secTitulo(3, 'Orientação, planilha e impressão')}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {[['landscape', 'Horizontal'], ['portrait', 'Vertical']].map(([id, nome]) => (
            <button key={id} onClick={() => setOrientacao(id)} style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
              background: orientacao === id ? T.gold : T.surface, color: orientacao === id ? '#fff' : T.textS,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: id === 'landscape' ? 16 : 11, height: id === 'landscape' ? 11 : 16, border: '2px solid currentColor', borderRadius: 2 }} />
              {nome}
            </button>
          ))}
        </div>
        <button style={{ ...btnPrimary, opacity: validas.length && !busy ? 1 : 0.5 }} disabled={!validas.length || busy} onClick={baixar}>
          {busy ? 'Gerando…' : 'Baixar planilha (.xlsx)'}
        </button>
        <button style={{ ...btnGhost, padding: '12px 22px', fontSize: 14.5, opacity: validas.length ? 1 : 0.5 }} disabled={!validas.length} onClick={imprimir}>
          Imprimir
        </button>
        {msg && <span style={{ fontSize: 13, color: T.textS }}>{msg}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: T.textT, marginTop: 10, lineHeight: 1.5 }}>
        A orientação vale para a planilha (já vem configurada para imprimir em A4 {orientacao === 'landscape' ? 'deitada' : 'em pé'}) e para o botão Imprimir. O controle sempre sai em UMA página só: se tiver muitos clientes, a letra diminui automaticamente para caber. Na janela de impressão, deixe a escala em 100%.
      </div>

      {secTitulo(4, 'Pré-visualização')}
      <iframe
        ref={frameRef}
        title="Pré-visualização do controle de clientes"
        srcDoc={html}
        style={{ width: '100%', height: isMobile ? 420 : orientacao === 'landscape' ? 620 : 860, border: `1px solid ${T.border}`, borderRadius: 14, background: '#e5e7eb' }}
      />
    </div>
  );
};
