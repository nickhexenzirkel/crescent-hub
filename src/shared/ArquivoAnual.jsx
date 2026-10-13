// Arquivo anual do Uniko WhatsApp (Security) e do Uniko Call.
// Por ano: baixar um .ukarq criptografado (só o Uniko lê), excluir os dados
// do ano do Supabase e, se precisar, importar o arquivo de volta. Também
// mostra o quanto o banco/Storage estão pesando. Lógica no servidor:
// crescent-hub-server/unikoArchive.js.
import { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../contexts/theme';
import { SERVER_URL } from '../contexts/user';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` });
const jsonHeaders = () => ({ ...authHeaders(), 'Content-Type': 'application/json' });
const fmtBytes = (b) => {
  if (b == null) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};
const MB = 1024 * 1024, GB = 1024 * MB;
// Limites de cada plano do Supabase (banco / Storage).
const PLANOS = { free: { nome: 'Free', db: 500 * MB, storage: 1 * GB }, pro: { nome: 'Pro', db: 8 * GB, storage: 100 * GB } };
const SISTEMAS = { security: 'Uniko WhatsApp', call: 'Uniko Call' };

const btn = (variant) => {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', border: '1px solid transparent', whiteSpace: 'nowrap' };
  if (variant === 'primary') return { ...base, background: T.gold, color: '#fff' };
  if (variant === 'danger') return { ...base, background: 'transparent', color: T.danger, border: `1px solid ${T.danger}55` };
  return { ...base, background: T.surfaceSub || 'rgba(0,0,0,0.04)', color: T.textS, border: `1px solid ${T.border}` };
};

const Barra = ({ rotulo, usado, limite }) => {
  const pct = limite ? Math.min(100, (usado / limite) * 100) : 0;
  const cor = pct > 85 ? T.danger : pct > 60 ? '#E8A020' : '#28A870';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textS, marginBottom: 4 }}>
        <span>{rotulo}</span><span><b style={{ color: T.text }}>{fmtBytes(usado)}</b> de {fmtBytes(limite)}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .4s' }} />
      </div>
    </div>
  );
};

// Faz POST de arquivo com progresso de envio (fetch não expõe isso).
const uploadComProgresso = (url, form, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.setRequestHeader('Authorization', authHeaders().Authorization);
  xhr.upload.onprogress = (e) => onProgress(e.lengthComputable ? e.loaded / e.total : null);
  xhr.onload = () => {
    let data; try { data = JSON.parse(xhr.responseText); } catch { return reject(new Error('Resposta inválida do servidor')); }
    xhr.status >= 200 && xhr.status < 300 ? resolve(data) : reject(new Error(data.error || `HTTP ${xhr.status}`));
  };
  xhr.onerror = () => reject(new Error('Falha de rede'));
  xhr.send(form);
});

const ArquivoAnual = ({ system, onClose, onChanged }) => {
  const [years, setYears] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plano, setPlano] = useState(() => { try { return localStorage.getItem('uniko_supabase_plano') || 'free'; } catch { return 'free'; } });
  const [busy, setBusy] = useState(null);          // { titulo, pct, sub }
  const [msg, setMsg] = useState(null);            // { ok, texto }
  const [delYear, setDelYear] = useState(null);    // ano aguardando confirmação
  const [typed, setTyped] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/archive/${system}/years`, { headers: authHeaders() });
      const d = await r.json();
      setYears(r.ok ? d.years : []);
      if (!r.ok) setMsg({ ok: false, texto: d.error || 'Falha ao listar os anos.' });
    } catch { setYears([]); setMsg({ ok: false, texto: 'Sem conexão com o servidor.' }); }
    try {
      const r = await fetch(`${SERVER_URL}/api/archive/usage`, { headers: authHeaders() });
      const d = await r.json();
      setUsage(d && !d.error ? d : { erro: d?.error || 'indisponível' });
    } catch { setUsage({ erro: 'indisponível' }); }
  }, [system]);
  useEffect(() => { load(); }, [load]);

  const escolherPlano = (p) => { setPlano(p); try { localStorage.setItem('uniko_supabase_plano', p); } catch { /* sem storage */ } };

  // Acompanha um job do servidor até terminar.
  const aguardarJob = async (jobId, titulo, sufixo) => {
    for (;;) {
      await new Promise(r => setTimeout(r, 1000));
      const r = await fetch(`${SERVER_URL}/api/archive/job/${jobId}`, { headers: authHeaders() });
      const j = await r.json();
      if (!r.ok || j.status === 'error') throw new Error(j.error || 'falhou');
      const p = j.progress;
      setBusy({ titulo, pct: p?.total ? (p.done / p.total) * 100 : null, sub: p?.total ? `${p.done} de ${p.total} ${sufixo}` : (p?.restored ? `${p.restored} ${sufixo} restaurados` : 'Trabalhando…') });
      if (j.status === 'done') return j;
    }
  };

  const baixar = async (year) => {
    setMsg(null); setBusy({ titulo: `Gerando o arquivo de ${year}…`, pct: null, sub: 'Preparando…' });
    try {
      const r = await fetch(`${SERVER_URL}/api/archive/${system}/export`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ year }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'falha ao iniciar');
      await aguardarJob(d.jobId, `Gerando o arquivo de ${year}…`, system === 'call' ? 'ligações' : 'mensagens');
      setBusy({ titulo: 'Baixando…', pct: null, sub: '' });
      const dl = await fetch(`${SERVER_URL}/api/archive/job/${d.jobId}/download`, { headers: authHeaders() });
      if (!dl.ok) throw new Error('falha ao baixar o arquivo pronto');
      const blob = await dl.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `uniko-${system}-${year}.ukarq`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      setMsg({ ok: true, texto: `Arquivo de ${year} baixado (${fmtBytes(blob.size)}). Guarde em lugar seguro — só o Uniko consegue abrir. Agora você pode excluir ${year} do Supabase.` });
      load();
    } catch (e) { setMsg({ ok: false, texto: 'Erro ao gerar o arquivo: ' + e.message }); }
    setBusy(null);
  };

  const excluir = async (year) => {
    setBusy({ titulo: `Excluindo ${year} do Supabase…`, pct: null, sub: 'Pode levar alguns minutos.' });
    try {
      const r = await fetch(`${SERVER_URL}/api/archive/${system}/delete-year`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ year, confirm: typed }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'falha');
      setMsg({ ok: true, texto: `${year} excluído: ${d.apagadas} ${system === 'call' ? 'ligações' : 'mensagens'}, ${d.midias} ${system === 'call' ? 'áudios' : 'mídias'}${d.brutos ? ` e ${d.brutos} registros técnicos` : ''} liberados.` });
      setDelYear(null); setTyped('');
      onChanged?.(); load();
    } catch (e) { setMsg({ ok: false, texto: e.message }); }
    setBusy(null);
  };

  const importar = async (file) => {
    if (!file) return;
    setMsg(null); setBusy({ titulo: 'Enviando arquivo…', pct: 0, sub: fmtBytes(file.size) });
    try {
      const form = new FormData(); form.append('file', file);
      const d = await uploadComProgresso(`${SERVER_URL}/api/archive/import`, form, (f) => setBusy({ titulo: f != null && f >= 1 ? 'Decifrando…' : 'Enviando arquivo…', pct: f != null && f < 1 ? f * 100 : null, sub: fmtBytes(file.size) }));
      if (d.system !== system) throw new Error(`Esse arquivo é do ${SISTEMAS[d.system] || d.system}, não do ${SISTEMAS[system]}. Importe pelo módulo certo.`);
      const j = await aguardarJob(d.jobId, `Restaurando ${d.year}…`, system === 'call' ? 'ligações' : 'mensagens');
      const r = j.result;
      setMsg({ ok: true, texto: `${d.year} restaurado: ${r.restored} ${system === 'call' ? 'ligações' : 'mensagens'} voltaram${r.skipped ? ` (${r.skipped} já estavam no sistema)` : ''}${r.media ? `, ${r.media} ${system === 'call' ? 'áudios' : 'mídias'}` : ''}${r.contactsCreated ? `, ${r.contactsCreated} contatos recriados` : ''}.` });
      onChanged?.(); load();
    } catch (e) { setMsg({ ok: false, texto: 'Erro ao importar: ' + e.message }); }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const lim = PLANOS[plano] || PLANOS.free;
  const unid = system === 'call' ? 'ligações' : 'mensagens';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(640px,100%)', maxHeight: '90vh', overflowY: 'auto', background: T.surface, borderRadius: 18, border: `1px solid ${T.border}`, boxShadow: '0 24px 70px rgba(0,0,0,.35)', padding: 22, fontFamily: 'var(--font-body)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>Arquivo anual · {SISTEMAS[system]}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textT, fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: T.textT, lineHeight: 1.5, marginBottom: 16 }}>
          Baixe o ano num arquivo criptografado (<b>.ukarq</b> — só o Uniko consegue ler), exclua-o do Supabase pra liberar espaço e, quando precisar, importe de volta.
        </div>

        {/* Uso do Supabase */}
        <div style={{ padding: 14, borderRadius: 14, border: `1px solid ${T.border}`, background: T.page, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textS, letterSpacing: '.05em', textTransform: 'uppercase' }}>Uso do Supabase</span>
            <span style={{ display: 'flex', gap: 4 }}>
              {Object.entries(PLANOS).map(([id, p]) => (
                <button key={id} onClick={() => escolherPlano(id)} style={{ ...btn(plano === id ? 'primary' : 'secondary'), padding: '3px 10px', fontSize: 11 }}>{p.nome}</button>
              ))}
            </span>
          </div>
          {!usage ? <div style={{ fontSize: 12, color: T.textT }}>Medindo…</div>
            : usage.erro ? <div style={{ fontSize: 12, color: T.textT }}>Medidor indisponível ({usage.erro}). Rode <code>supabase_uniko_archive.sql</code> no Supabase.</div>
            : <>
              <Barra rotulo="Banco de dados" usado={usage.db_bytes} limite={lim.db} />
              <Barra rotulo="Armazenamento (mídia e áudio)" usado={usage.storage_bytes} limite={lim.storage} />
              <div style={{ fontSize: 11.5, color: T.textT, lineHeight: 1.6, marginTop: 6 }}>
                Mensagens: <b>{fmtBytes(usage.security_msgs_bytes)}</b> · Dados técnicos do webhook: <b>{fmtBytes(usage.security_raw_bytes)}</b> · Ligações: <b>{fmtBytes(usage.call_bytes)}</b><br />
                Mídias do WhatsApp: <b>{fmtBytes(usage.media_bytes)}</b> · Áudios das ligações: <b>{fmtBytes(usage.audio_bytes)}</b>
              </div>
            </>}
        </div>

        {msg && (
          <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5, lineHeight: 1.5,
            background: msg.ok ? 'rgba(40,168,112,.12)' : `${T.danger}18`, color: msg.ok ? '#1d7a52' : T.danger, border: `1px solid ${msg.ok ? 'rgba(40,168,112,.35)' : T.danger + '44'}` }}>{msg.texto}</div>
        )}

        {/* Anos */}
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textS, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>Anos com dados</div>
        {years === null ? <div style={{ fontSize: 12.5, color: T.textT, padding: '10px 0' }}>Carregando…</div>
          : years.length === 0 ? <div style={{ fontSize: 12.5, color: T.textT, padding: '10px 0' }}>Nenhum dado no Supabase.</div>
          : years.map(y => (
            <div key={y.year} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.border}`, marginBottom: 8, background: T.page }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{y.year}</div>
                  <div style={{ fontSize: 11.5, color: T.textT }}>{y.count.toLocaleString('pt-BR')} {unid}{y.exportedAt ? ' · arquivo baixado ✓' : ''}</div>
                </div>
                <button disabled={!!busy} onClick={() => baixar(y.year)} style={btn('primary')}>Baixar arquivo</button>
                <button disabled={!!busy || !y.exportedAt} onClick={() => { setDelYear(y.year); setTyped(''); }}
                  title={y.exportedAt ? '' : 'Baixe o arquivo primeiro'} style={{ ...btn('danger'), opacity: y.exportedAt ? 1 : .45, cursor: y.exportedAt ? 'pointer' : 'not-allowed' }}>Excluir do Supabase</button>
              </div>
              {delYear === y.year && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
                  <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5, marginBottom: 8 }}>
                    Isso apaga <b>todas as {unid} de {y.year}</b> (e as mídias) do Supabase. Elas só poderão voltar importando o arquivo que você baixou. Digite <b>{y.year}</b> pra confirmar.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={String(y.year)} inputMode="numeric"
                      style={{ width: 110, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, outline: 'none' }} />
                    <button disabled={typed !== String(y.year) || !!busy} onClick={() => excluir(y.year)} style={{ ...btn('primary'), background: T.danger, opacity: typed === String(y.year) ? 1 : .45 }}>Excluir {y.year}</button>
                    <button onClick={() => setDelYear(null)} style={btn('secondary')}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ))}

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button disabled={!!busy} onClick={() => fileRef.current?.click()} style={btn('secondary')}>⬆ Importar arquivo (.ukarq)</button>
          <span style={{ fontSize: 11.5, color: T.textT, flex: 1, minWidth: 160 }}>Restaura um ano baixado antes, sem duplicar o que já estiver no sistema.</span>
          <input ref={fileRef} type="file" accept=".ukarq" style={{ display: 'none' }} onChange={e => importar(e.target.files?.[0])} />
        </div>

        {busy && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700 }}>
            <div style={{ width: 'min(380px,90vw)', background: T.surface, borderRadius: 16, padding: 22, textAlign: 'center', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, marginBottom: 12 }}>{busy.titulo}</div>
              <div style={{ height: 8, borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: busy.pct == null ? '40%' : `${busy.pct}%`, background: T.gold, borderRadius: 999, transition: 'width .3s',
                  animation: busy.pct == null ? 'arqAnda 1.2s ease-in-out infinite alternate' : 'none' }} />
              </div>
              <div style={{ fontSize: 12, color: T.textT, marginTop: 10, minHeight: 16 }}>{busy.sub}</div>
              <style>{'@keyframes arqAnda{from{margin-left:0}to{margin-left:60%}}'}</style>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArquivoAnual;
