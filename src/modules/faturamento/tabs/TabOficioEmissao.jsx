import { useState, useRef, useCallback, useMemo } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import {
  lerNota, gerarEusebio, gerarPiaui, formatarReais, periodoCurto, dataBr,
  TIPOS_PIAUI, tipoPadraoPiaui, faltaNoModelo,
} from '../oficioEmissao';

/* ═══════════════════════════════════════════════════════════════
   OFÍCIO DE EMISSÃO — a "Solicitação de Pagamento" do Uniko Detetive,
   agora no navegador. Arraste as notas fiscais (NFS-e em PDF) e cada uma
   vira um ofício pronto pra assinar, em um de dois modelos:
     • Eusébio            — o ofício atual (papel timbrado, contrato + objeto)
     • Juazeiro do Piauí  — Requerimento de Pagamento (secretaria, tipo, vencimento)
   A lógica de leitura/geração fica em ../oficioEmissao.js.
═══════════════════════════════════════════════════════════════ */

const LS = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const LSset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };

const OBJETO_PADRAO =
  'a prestação de serviços de operação de sistema informatizado e integrado com utilização de cartões magnéticos ' +
  'para gerenciamento de posto de abastecimento de combustível em veículos automotivos, destinado a atender às ' +
  'necessidades desta Secretaria';

const MODELOS = [
  { id: 'eusebio', titulo: 'Modelo Eusébio', sub: 'O ofício de sempre: papel timbrado 7SERV, rúbrica, contrato e objeto do contrato.' },
  { id: 'piaui', titulo: 'Modelo Juazeiro do Piauí', sub: 'Requerimento de Pagamento: secretaria, tipo de faturamento, período e vencimento.' },
];

const I = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{p.children}</svg>
);

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, fontSize: 13.5,
  border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontFamily: 'var(--font-body)', outline: 'none',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: T.textT, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8, display: 'block' };
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

const Toggle = ({ on, onChange, label, sub }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '10px 0' }}>
    <span onClick={(e) => { e.preventDefault(); onChange(!on); }} style={{
      width: 38, height: 22, borderRadius: 12, flexShrink: 0, marginTop: 2, position: 'relative', transition: 'background .15s',
      background: on ? T.gold : T.border,
    }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </span>
    <span>
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, display: 'block' }}>{label}</span>
      {sub && <span style={{ fontSize: 12.5, color: T.textT, display: 'block', marginTop: 2, lineHeight: 1.4 }}>{sub}</span>}
    </span>
  </label>
);

let seq = 0;

export const TabOficioEmissao = () => {
  const [modelo, setModeloState] = useState(() => LS('ofem.modelo', 'eusebio'));
  const [contrato, setContratoState] = useState(() => LS('ofem.contrato', ''));
  const [objeto, setObjetoState] = useState(() => LS('ofem.objeto', OBJETO_PADRAO));
  const [comRubrica, setComRubricaState] = useState(() => LS('ofem.rubrica', false));
  const [vencGlobal, setVencGlobal] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const persistir = (setter, key) => (v) => { setter(v); LSset(key, v); };
  const setModelo = persistir(setModeloState, 'ofem.modelo');
  const setContrato = persistir(setContratoState, 'ofem.contrato');
  const setObjeto = persistir(setObjetoState, 'ofem.objeto');
  const setComRubrica = persistir(setComRubricaState, 'ofem.rubrica');

  const patch = (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const adicionar = useCallback(async (files) => {
    const pdfs = [...files].filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) return;
    const novos = pdfs.map((file) => ({ id: ++seq, file, nome: file.name, estado: 'lendo' }));
    setRows((rs) => [...rs, ...novos]);
    for (const r of novos) {
      try {
        const d = await lerNota(r.file);
        setRows((rs) => rs.map((x) => (x.id === r.id ? {
          ...x, ...d, estado: d.status, tipoSel: tipoPadraoPiaui(d.tipo), secretariaSel: d.secretaria || '', venc: '',
        } : x)));
      } catch (e) {
        patch(r.id, { estado: 'erro', problemas: [`Não consegui ler o PDF (${e?.message || 'arquivo inválido'}).`] });
      }
    }
  }, []);

  /* O que falta pra gerar cada nota, no modelo escolhido. */
  const pendencia = (r) => {
    if (r.estado !== 'ok') return null;
    const falta = faltaNoModelo(r, modelo);
    if (falta.length) return falta.join(' ');
    if (modelo === 'piaui') {
      if (!(r.secretariaSel || '').trim()) return 'Informe a secretaria/setor.';
      if (!(r.venc || vencGlobal)) return 'Informe o vencimento.';
    }
    return null;
  };
  const prontas = rows.filter((r) => r.estado === 'ok' && !pendencia(r));
  const textoOk = modelo === 'piaui' || (contrato.trim() && objeto.trim());
  const podeGerar = !busy && prontas.length > 0 && textoOk;

  const nomeArquivo = (r) => (modelo === 'piaui' ? `REQUERIMENTO DE PAGAMENTO - NF ${r.numero}.pdf` : `OFÍCIO - NF ${r.numero}.pdf`);

  const gerar = async () => {
    setBusy(true); setErro('');
    try {
      for (const r of prontas) {
        try {
          const bytes = modelo === 'piaui'
            ? await gerarPiaui({
              numeroNota: r.numero, secretaria: r.secretariaSel.trim(), valorBruto: r.valorBruto, valorLiquido: r.valorLiquido, tipo: r.tipoSel,
              periodo: r.periodo, vencimento: dataBr(r.venc || vencGlobal), comRubrica,
            })
            : await gerarEusebio({
              mesReferencia: r.mesReferencia, numeroNota: r.numero, valorBruto: r.valorBruto,
              contrato: contrato.trim(), objeto: objeto.trim().replace(/\s+/g, ' ').replace(/[.,;]+$/, ''),
            });
          patch(r.id, { gerado: { blob: new Blob([bytes], { type: 'application/pdf' }), nome: nomeArquivo(r), modelo } });
        } catch (e) {
          patch(r.id, { gerado: null, erroGerar: e?.message || 'falha ao gerar' });
        }
      }
    } catch (e) { setErro(e?.message || 'Não foi possível gerar os ofícios.'); }
    setBusy(false);
  };

  const salvar = (blob, nome) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const geradas = rows.filter((r) => r.gerado?.modelo === modelo); // só os do modelo selecionado
  const baixarTodos = async () => {
    if (geradas.length === 1) return salvar(geradas[0].gerado.blob, geradas[0].gerado.nome);
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const usados = new Set();
    for (const r of geradas) {
      let nome = r.gerado.nome, n = 2;
      while (usados.has(nome)) nome = r.gerado.nome.replace(/\.pdf$/, ` (${n++}).pdf`);
      usados.add(nome); zip.file(nome, r.gerado.blob);
    }
    salvar(await zip.generateAsync({ type: 'blob' }), modelo === 'piaui' ? 'Requerimentos de pagamento.zip' : 'Ofícios.zip');
  };

  const resumo = useMemo(() => {
    const ok = rows.filter((r) => r.estado === 'ok').length;
    const ruins = rows.filter((r) => r.estado === 'incompleto' || r.estado === 'erro' || r.estado === 'nao_e_nota').length;
    return { ok, ruins };
  }, [rows]);

  const statusCell = (r) => {
    if (r.estado === 'lendo') return <span style={{ color: T.textT }}>Lendo…</span>;
    if (r.estado !== 'ok') return <span style={{ color: r.estado === 'nao_e_nota' ? T.textT : '#C98A1B' }}>{(r.problemas || []).join(' ')}</span>;
    const pend = pendencia(r);
    if (pend) return <span style={{ color: '#C98A1B' }}>{pend}</span>;
    if (r.erroGerar) return <span style={{ color: T.danger }}>{r.erroGerar}</span>;
    if (r.gerado?.modelo === modelo) return <span style={{ color: '#1A9C70', fontWeight: 600 }}>✓ Gerado</span>;
    return <span style={{ color: T.textT }}>Pronta pra gerar</span>;
  };

  const cell = { padding: '10px 12px', fontSize: 13, color: T.text, verticalAlign: 'middle', borderTop: `1px solid ${T.border}` };
  const small = { ...inputStyle, padding: '7px 9px', fontSize: 12.5 };

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <StellarHero
        compact
        eyebrow="Documentos · PDF"
        title="Ofício de Emissão"
        subtitle="Arraste as notas fiscais e cada uma vira um ofício de solicitação de pagamento, pronto pra assinar, no modelo do município."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
          </svg>
        )}
      />

      <div style={{ maxWidth: 940 }}>
        {/* Modelo */}
        <span style={labelStyle}>Modelo do ofício</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {MODELOS.map((m) => {
            const on = modelo === m.id;
            return (
              <div key={m.id} onClick={() => setModelo(m.id)} style={{
                cursor: 'pointer', padding: '16px 18px', borderRadius: 14, transition: 'all .15s',
                border: `1.5px solid ${on ? T.gold : T.border}`, background: on ? T.goldGl : T.surface,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? T.gold : T.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.gold }} />}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: on ? T.gold : T.text }}>{m.titulo}</span>
                </div>
                <div style={{ fontSize: 12.5, color: T.textT, marginTop: 6, lineHeight: 1.45 }}>{m.sub}</div>
              </div>
            );
          })}
        </div>

        <StarDivider my={22} />

        {/* Notas */}
        <span style={labelStyle}>Notas fiscais (NFS-e em PDF)</span>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); adicionar(e.dataTransfer.files); }}
          style={{
            border: `2px dashed ${drag || rows.length ? T.gold : T.border}`, borderRadius: 14, padding: '30px 24px', textAlign: 'center',
            cursor: 'pointer', background: drag || rows.length ? T.goldGl : T.surface, transition: 'all .18s',
          }}>
          <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
            onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
            {rows.length ? `${rows.length} nota(s) na lista — arraste ou clique pra adicionar mais` : 'Arraste aqui os PDFs das notas fiscais'}
          </div>
          <div style={{ fontSize: 12.5, color: T.textT, marginTop: 5 }}>
            Pode ser uma nota ou a remessa inteira. Da nota saem o número da NFS-e, o período faturado e o valor (bruto no Eusébio; no Piauí, o bruto e o VALOR LÍQUIDO A RECEBER DO CLIENTE).
          </div>
        </div>

        {rows.length > 0 && (
          <div style={{ marginTop: 16, border: `1px solid ${T.border}`, borderRadius: 14, background: T.surface, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: modelo === 'piaui' ? 960 : 640 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {['Nota', modelo === 'piaui' ? 'Período' : 'Mês', modelo === 'piaui' ? 'Valor bruto' : 'Valor bruto',
                    ...(modelo === 'piaui' ? ['Valor líquido', 'Secretaria', 'Tipo', 'Vencimento'] : []), 'Situação', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: T.textT, letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const lida = r.estado === 'ok' || r.estado === 'incompleto';
                  return (
                    <tr key={r.id}>
                      <td style={cell} title={r.nome}><b>{r.numero || '—'}</b>
                        <div style={{ fontSize: 11, color: T.textT, maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</div></td>
                      <td style={{ ...cell, fontSize: 12.5 }}>{lida ? (modelo === 'piaui' ? periodoCurto(r.periodo) : r.mesReferencia) || '—' : '—'}</td>
                      <td style={{ ...cell, fontSize: 12.5, whiteSpace: 'nowrap' }}>{(() => { const v = r.valorBruto; return lida && v != null ? `R$ ${formatarReais(v)}` : '—'; })()}</td>
                      {modelo === 'piaui' && (
                        <>
                          <td style={{ ...cell, fontSize: 12.5, whiteSpace: 'nowrap' }}>{lida && r.valorLiquido != null ? `R$ ${formatarReais(r.valorLiquido)}` : '—'}</td>
                          <td style={{ ...cell, minWidth: 190 }}>
                            {r.estado === 'ok' ? <input style={small} value={r.secretariaSel} placeholder="Ex.: À SECRETARIA MUNICIPAL DE SAÚDE" onChange={(e) => patch(r.id, { secretariaSel: e.target.value, gerado: null })} /> : '—'}
                          </td>
                          <td style={{ ...cell, minWidth: 190 }}>
                            {r.estado === 'ok' ? (
                              <select style={small} value={r.tipoSel} onChange={(e) => patch(r.id, { tipoSel: e.target.value, gerado: null })}>
                                {TIPOS_PIAUI.map((t) => <option key={t}>{t}</option>)}
                              </select>
                            ) : '—'}
                          </td>
                          <td style={{ ...cell, minWidth: 140 }}>
                            {r.estado === 'ok' ? <input type="date" style={small} value={r.venc || vencGlobal} onChange={(e) => patch(r.id, { venc: e.target.value, gerado: null })} /> : '—'}
                          </td>
                        </>
                      )}
                      <td style={{ ...cell, fontSize: 12.5 }}>{statusCell(r)}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {r.gerado?.modelo === modelo && (
                          <button style={{ ...btnGhost, padding: '6px 11px' }} onClick={() => salvar(r.gerado.blob, r.gerado.nome)} title={r.gerado.nome}>
                            <I><path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 21h14" /></I> Baixar
                          </button>
                        )}
                        <button style={{ ...btnGhost, padding: '6px 9px', marginLeft: 6, border: 'none' }} title="Tirar da lista" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: T.textT, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{resumo.ok} nota(s) lida(s) com sucesso{resumo.ruins ? ` · ${resumo.ruins} com problema` : ''}</span>
            <button style={{ ...btnGhost, padding: '5px 11px', fontSize: 12 }} onClick={() => setRows([])}>Limpar lista</button>
          </div>
        )}

        <StarDivider my={22} />

        {/* Campos do modelo */}
        {modelo === 'eusebio' ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <label style={labelStyle}>Contrato nº</label>
              <input style={inputStyle} value={contrato} placeholder="015052022" onChange={(e) => setContrato(e.target.value)} />
              <div style={{ fontSize: 12.5, color: T.textT, marginTop: 6 }}>O contrato com este cliente. Entra na frase “contratada por meio do Contrato nº …”.</div>
            </div>
            <div>
              <label style={labelStyle}>Objeto do contrato</label>
              <textarea style={{ ...inputStyle, minHeight: 92, resize: 'vertical', lineHeight: 1.45 }} value={objeto} onChange={(e) => setObjeto(e.target.value)} />
              <div style={{ fontSize: 12.5, color: T.textT, marginTop: 6 }}>
                O que vem depois de “cujo objeto é”. O texto já preenchido é o dos contratos de abastecimento; troque quando o contrato for de manutenção.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ maxWidth: 260 }}>
              <label style={labelStyle}>Vencimento (para todas as notas)</label>
              <input type="date" style={inputStyle} value={vencGlobal} onChange={(e) => setVencGlobal(e.target.value)} />
              <div style={{ fontSize: 12.5, color: T.textT, marginTop: 6 }}>Cada nota pode ter o seu na tabela acima. A secretaria/setor vem da nota (sem o prefixo “Secretaria Municipal de”) e pode ser editada na tabela.</div>
            </div>
            <Toggle on={comRubrica} onChange={setComRubrica} label="Incluir a rúbrica do Cleanderson"
              sub="O modelo não traz assinatura. Ligue pra já sair com a rúbrica acima do nome; desligado, dá pra assinar depois na Assinatura Automática." />
          </div>
        )}

        {erro && (
          <div style={{ marginTop: 18, padding: '12px 16px', background: 'rgba(192,64,80,0.06)', border: '1px solid rgba(192,64,80,0.2)', borderRadius: 10, fontSize: 13.5, color: T.danger }}>{erro}</div>
        )}

        <StarDivider my={22} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={gerar} disabled={!podeGerar} style={{
            ...btnPrimary,
            background: podeGerar ? T.gold : 'transparent', color: podeGerar ? '#fff' : T.textD,
            boxShadow: podeGerar ? btnPrimary.boxShadow : 'none', border: podeGerar ? 'none' : `1px solid ${T.border}`,
            cursor: podeGerar ? 'pointer' : 'not-allowed',
          }}>
            {busy ? 'Gerando…' : <><I><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></I> {modelo === 'piaui' ? 'Gerar requerimentos' : 'Gerar ofícios'}</>}
          </button>
          {geradas.length > 0 && (
            <button onClick={baixarTodos} style={btnGhost}>
              <I><path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 21h14" /></I>
              {geradas.length > 1 ? `Baixar todos (${geradas.length}) em .zip` : 'Baixar PDF'}
            </button>
          )}
          {!podeGerar && !busy && (
            <span style={{ fontSize: 12.5, color: T.textT }}>
              {rows.length === 0 ? 'Arraste as notas fiscais para começar.'
                : !textoOk ? (!contrato.trim() ? 'Informe o número do contrato com o cliente.' : 'Informe o objeto do contrato.')
                  : prontas.length === 0 ? 'Nenhuma nota pronta — veja a coluna Situação.' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
