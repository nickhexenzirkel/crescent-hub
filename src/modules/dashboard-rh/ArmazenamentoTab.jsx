// Dashboard RH → aba "Armazenamento Supabase" (só admin).
// Mostra quanto banco e Storage cada projeto Supabase está usando, quebrado por
// módulo: Uniko geral (projeto principal do Portal) e Uniko WhatsApp / Call /
// Safer (projeto dedicado). Dados vêm de /api/storage/report (função SQL
// uniko_storage_report, ver supabase_storage_report.sql).
import React, { useState, useEffect, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { SERVER_URL } from '../../contexts/user';
import ArquivoAnual from '../../shared/ArquivoAnual';

const MB = 1024 * 1024, GB = 1024 * MB;
const PLANOS = { free: { nome: 'Free', db: 500 * MB, storage: 1 * GB }, pro: { nome: 'Pro', db: 8 * GB, storage: 100 * GB } };
const fmtBytes = (b) => {
  if (b == null) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < GB) return `${(b / MB).toFixed(1)} MB`;
  return `${(b / GB).toFixed(2)} GB`;
};
const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');

// Qual módulo é dono de cada tabela/bucket do projeto Safer/Security/Call.
const donoTabela = (n) => n.startsWith('uniko_security_') ? 'whatsapp' : n.startsWith('uniko_call_') ? 'call' : n.startsWith('uniko_safer_') ? 'safer' : 'outros';
const donoBucket = (n) => n.startsWith('uniko-security') ? 'whatsapp' : n.startsWith('uniko-call') ? 'call' : n.startsWith('uniko-safer') ? 'safer' : 'outros';
const MODULOS = {
  whatsapp: { nome: 'Uniko WhatsApp', cor: '#25A56A' },
  call:     { nome: 'Uniko Call',     cor: '#22c55e' },
  safer:    { nome: 'Uniko Safer',    cor: '#3B82F6' },
  outros:   { nome: 'Outros',         cor: '#8B93A7' },
};

const Barra = ({ rotulo, usado, limite }) => {
  const pct = limite ? Math.min(100, (usado / limite) * 100) : 0;
  const cor = pct > 85 ? T.danger : pct > 60 ? '#E8A020' : '#28A870';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.textS, marginBottom: 5 }}>
        <span>{rotulo}</span>
        <span><b style={{ color: T.text }}>{fmtBytes(usado)}</b> de {fmtBytes(limite)} · {pct.toFixed(pct < 10 ? 1 : 0)}%</span>
      </div>
      <div style={{ height: 9, borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(pct, usado > 0 ? 0.8 : 0)}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .4s' }} />
      </div>
    </div>
  );
};

// Lista de barras horizontais proporcionais ao maior item.
const Ranking = ({ itens, cor, vazio }) => {
  const max = Math.max(1, ...itens.map(i => i.bytes));
  if (!itens.length) return <div style={{ fontSize: 12, color: T.textT, padding: '6px 0' }}>{vazio}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {itens.map(i => (
        <div key={i.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: T.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{i.nome}
              {i.tag && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: i.tagCor, background: `${i.tagCor}1f`, padding: '1px 6px', borderRadius: 999 }}>{i.tag}</span>}
            </span>
            <span style={{ color: T.textS, flexShrink: 0 }}>{fmtBytes(i.bytes)}{i.sub ? <span style={{ color: T.textT }}> · {i.sub}</span> : null}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
            <div style={{ width: `${(i.bytes / max) * 100}%`, height: '100%', background: i.tagCor || cor, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const Cartao = ({ titulo, sub, children, acao }) => (
  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', marginBottom: 16, boxShadow: T.sh }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{titulo}</div>
        {sub && <div style={{ fontSize: 12, color: T.textT, marginTop: 2 }}>{sub}</div>}
      </div>
      {acao}
    </div>
    {children}
  </div>
);

const Subtitulo = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: T.textT, letterSpacing: '.07em', textTransform: 'uppercase', margin: '16px 0 8px' }}>{children}</div>
);

const ArmazenamentoTab = () => {
  const [rep, setRep] = useState(null);
  const [erro, setErro] = useState(null);
  const [busy, setBusy] = useState(true);
  const [plano, setPlano] = useState(() => { try { return localStorage.getItem('uniko_supabase_plano') || 'pro'; } catch { return 'pro'; } });
  const [arquivo, setArquivo] = useState(null); // 'security' | 'call'

  const load = useCallback(async () => {
    setBusy(true); setErro(null);
    try {
      const r = await fetch(`${SERVER_URL}/api/storage/report`, { headers: { Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setRep(d);
    } catch (e) { setErro(e.message === 'Failed to fetch' ? 'Sem conexão com o servidor.' : e.message); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const escolher = (p) => { setPlano(p); try { localStorage.setItem('uniko_supabase_plano', p); } catch { /* sem storage */ } };
  const lim = PLANOS[plano] || PLANOS.pro;

  const btn = (on) => ({ padding: '4px 12px', borderRadius: 8, border: `1px solid ${on ? T.gold : T.border}`, background: on ? T.goldGl : 'transparent',
    color: on ? T.gold : T.textS, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' });

  const SemFuncao = ({ msg }) => (
    <div style={{ fontSize: 12.5, color: T.textS, lineHeight: 1.6, padding: '4px 0' }}>
      Não consegui medir este projeto ({msg}).<br />
      Rode <code>supabase_storage_report.sql</code> no SQL Editor <b>deste</b> projeto e atualize.
    </div>
  );

  // ── Projeto principal (Uniko geral) ──
  const geral = rep?.geral;
  const geralOk = geral && !geral.error;
  // ── Projeto Safer/Security/Call ──
  const sec = rep?.security;
  const secOk = sec && !sec.error;
  const porModulo = {};
  if (secOk) {
    for (const t of sec.tables || []) { const k = donoTabela(t.name); (porModulo[k] ||= { db: 0, storage: 0 }).db += t.bytes; }
    for (const b of sec.buckets || []) { const k = donoBucket(b.name); (porModulo[k] ||= { db: 0, storage: 0 }).storage += b.bytes; }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Armazenamento Supabase</div>
          <div style={{ fontSize: 12.5, color: T.textT, marginTop: 2 }}>Quanto cada módulo do Uniko está ocupando no banco e no Storage.</div>
        </div>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: T.textT, marginRight: 4 }}>Plano:</span>
          {Object.entries(PLANOS).map(([id, p]) => <button key={id} onClick={() => escolher(id)} style={btn(plano === id)}>{p.nome}</button>)}
        </span>
        <button onClick={load} disabled={busy} style={{ ...btn(false), padding: '6px 12px', cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Medindo…' : '↻ Atualizar'}</button>
      </div>

      {erro && <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: T.danger, background: `${T.danger}18`, border: `1px solid ${T.danger}44` }}>{erro}</div>}
      {busy && !rep && <div style={{ fontSize: 13, color: T.textT, padding: 20, textAlign: 'center' }}>Medindo…</div>}

      {rep && (
        <>
          {/* Uniko geral */}
          <Cartao titulo="Uniko geral (Portal)" sub="Projeto principal do Supabase — colaboradores, ponto, lojas, jogos, etc.">
            {!geralOk ? <SemFuncao msg={geral?.error || 'sem resposta'} /> : (
              <>
                <Barra rotulo="Banco de dados" usado={geral.db_bytes} limite={lim.db} />
                <Barra rotulo="Armazenamento (arquivos)" usado={geral.storage_bytes} limite={lim.storage} />
                <Subtitulo>Maiores tabelas</Subtitulo>
                <Ranking cor={T.gold} vazio="Nenhuma tabela."
                  itens={(geral.tables || []).slice(0, 12).map(t => ({ key: t.name, nome: t.name, bytes: t.bytes, sub: `~${fmtN(t.rows)} linhas` }))} />
                <Subtitulo>Arquivos por bucket</Subtitulo>
                <Ranking cor="#8B5CF6" vazio="Nenhum arquivo guardado."
                  itens={(geral.buckets || []).map(b => ({ key: b.name, nome: b.name, bytes: b.bytes, sub: `${fmtN(b.files)} arquivos` }))} />
              </>
            )}
          </Cartao>

          {/* Safer / WhatsApp / Call */}
          <Cartao titulo="Uniko WhatsApp · Uniko Call · Uniko Safer" sub="Projeto dedicado do Supabase (compartilhado pelos três módulos)"
            acao={secOk && (
              <span style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setArquivo('security')} style={btn(false)}>Arquivo anual · WhatsApp</button>
                <button onClick={() => setArquivo('call')} style={btn(false)}>Arquivo anual · Call</button>
              </span>
            )}>
            {!secOk ? <SemFuncao msg={sec?.error || 'sem resposta'} /> : (
              <>
                <Barra rotulo="Banco de dados" usado={sec.db_bytes} limite={lim.db} />
                <Barra rotulo="Armazenamento (mídia, áudios, backups)" usado={sec.storage_bytes} limite={lim.storage} />

                <Subtitulo>Quem ocupa o quê</Subtitulo>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                  {Object.entries(porModulo).filter(([, v]) => v.db + v.storage > 0).sort((a, b) => (b[1].db + b[1].storage) - (a[1].db + a[1].storage)).map(([k, v]) => (
                    <div key={k} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.page, borderLeft: `4px solid ${MODULOS[k].cor}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.textS }}>{MODULOS[k].nome}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: T.text, margin: '2px 0' }}>{fmtBytes(v.db + v.storage)}</div>
                      <div style={{ fontSize: 11, color: T.textT }}>Banco {fmtBytes(v.db)} · Arquivos {fmtBytes(v.storage)}</div>
                    </div>
                  ))}
                </div>

                <Subtitulo>Maiores tabelas</Subtitulo>
                <Ranking vazio="Nenhuma tabela."
                  itens={(sec.tables || []).slice(0, 12).map(t => { const k = donoTabela(t.name); return { key: t.name, nome: t.name, bytes: t.bytes, sub: `~${fmtN(t.rows)} linhas`, tag: MODULOS[k].nome, tagCor: MODULOS[k].cor }; })} />
                <Subtitulo>Arquivos por bucket</Subtitulo>
                <Ranking vazio="Nenhum arquivo guardado."
                  itens={(sec.buckets || []).map(b => { const k = donoBucket(b.name); return { key: b.name, nome: b.name, bytes: b.bytes, sub: `${fmtN(b.files)} arquivos`, tag: MODULOS[k].nome, tagCor: MODULOS[k].cor }; })} />
              </>
            )}
          </Cartao>

          <div style={{ fontSize: 11.5, color: T.textT, lineHeight: 1.6 }}>
            Medido {rep.at ? new Date(rep.at).toLocaleString('pt-BR') : ''}. O "Banco de dados" é o tamanho total do projeto (inclui índices e tabelas do sistema do Supabase); o número de linhas é uma estimativa.
            Pra liberar espaço do WhatsApp e do Call, use o <b>Arquivo anual</b>.
          </div>
        </>
      )}

      {arquivo && <ArquivoAnual system={arquivo} onClose={() => setArquivo(null)} onChanged={load} />}
    </div>
  );
};

export default ArmazenamentoTab;
