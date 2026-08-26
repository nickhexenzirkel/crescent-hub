// Dashboard RH → aba "Uniko FIT".
// Mostra TODAS as poses da aba Desafios do Uniko FIT: as fixas (arte das
// colagens do app, com upload pra sobrescrever a foto de uma específica —
// tabela uniko_fit_poses_overrides) + as extras cadastradas por aqui
// (tabela uniko_fit_poses_custom, cada uma com a própria imagem). As duas
// tabelas usam o mesmo bucket 'uniko-fit-poses' — rodar
// supabase_uniko_fit_poses_custom.sql e supabase_uniko_fit_poses_overrides.sql
// antes (idempotentes, pode rodar de novo sem medo).
import React, { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase } from '../../contexts/user';
import { Card, Moon } from '../../shared/components';
import { POSES as POSES_FIXAS, POSE_SHEETS, POSES_SPRITE_COLS as SPRITE_COLS, POSES_SPRITE_ROWS as SPRITE_ROWS } from '../uniko-fit/index';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`,
  background: T.surface, fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)',
};

// `override` (url) tem prioridade sobre o recorte do sprite sheet — mesma
// regra do `PoseThumb` do app (ver src/modules/uniko-fit/index.jsx).
const PoseThumbFixa = ({ pose, override, size = 56 }) => {
  if (override) return <div style={{ width: size, height: size, borderRadius: 11, overflow: 'hidden', flexShrink: 0, background: 'rgba(128,128,128,.12)' }}><img src={override} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
  return (
    <div style={{ width: size, height: size, borderRadius: 11, overflow: 'hidden', flexShrink: 0, background: 'rgba(128,128,128,.12)',
      backgroundImage: `url(${POSE_SHEETS[pose.sheet] || POSE_SHEETS.novas})`, backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`,
      backgroundPosition: `${pose.sprite.col / (SPRITE_COLS - 1) * 100}% ${pose.sprite.row / (SPRITE_ROWS - 1) * 100}%` }} />
  );
};

const UnikoFitPosesTab = ({ cardBg, adminName }) => {
  const bg = cardBg || T.surface;
  const [extras, setExtras] = useState([]);
  const [overrides, setOverrides] = useState({}); // pose_id -> image_url
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [trocandoId, setTrocandoId] = useState(null); // id da pose fixa com upload em andamento

  const [texto, setTexto] = useState('');
  const [emoji, setEmoji] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Limpezas do Uniko FIT, uma por vez (mesmas tabelas do
  // supabase_uniko_fit_reset.sql, só que picadas): dá pra zerar SÓ os
  // check-ins (o que reseta o ranking), SÓ os posts do feed ou SÓ o
  // Bate-Papo. `resetAlvo` guarda qual está sendo confirmado no modal.
  const [resumo, setResumo] = useState(null); // { checkins, posts, chat }
  const [resetAlvo, setResetAlvo] = useState(null); // id do alvo em confirmação, null = fechado
  const [resetTexto, setResetTexto] = useState('');
  const [resetando, setResetando] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // Check-in e post moram na MESMA tabela (`uniko_fit_checkins`), separados
  // pela coluna `kind` — por isso os dois primeiros alvos são a mesma tabela
  // com filtros opostos. Apagar uma foto leva as curtidas e comentários dela
  // junto (`on delete cascade` no banco).
  const ALVOS = [
    {
      id: 'checkins', titulo: 'Check-ins', chave: 'checkins',
      desc: 'Zera o ranking e a frequência de treino de todo mundo. As curtidas e comentários dessas fotos vão junto; os posts do feed continuam.',
      apagar: () => _supabase.from('uniko_fit_checkins').delete().eq('kind', 'checkin'),
      ok: '✅ Check-ins apagados — o ranking está zerado.',
    },
    {
      id: 'posts', titulo: 'Posts do feed', chave: 'posts',
      desc: 'Apaga só o que foi postado em "Postar no Feed" (com as curtidas e comentários). O ranking e os check-ins não são tocados.',
      apagar: () => _supabase.from('uniko_fit_checkins').delete().neq('kind', 'checkin'),
      ok: '✅ Posts do feed apagados.',
    },
    {
      id: 'chat', titulo: 'Mensagens do Bate-Papo', chave: 'chat',
      desc: 'Limpa a conversa do grupo, incluindo os avisos automáticos de check-in. Não mexe em foto nenhuma.',
      apagar: () => _supabase.from('uniko_fit_chat').delete().gt('id', 0),
      ok: '✅ Bate-Papo limpo.',
    },
  ];
  const alvoAtual = ALVOS.find(a => a.id === resetAlvo) || null;

  // Quanto tem hoje no Uniko FIT (só pra pessoa ver o tamanho do estrago antes
  // de zerar). `head: true` traz só a contagem, não as linhas.
  const carregarResumo = async () => {
    try {
      const [ci, po, ch] = await Promise.all([
        _supabase.from('uniko_fit_checkins').select('id', { count: 'exact', head: true }).eq('kind', 'checkin'),
        _supabase.from('uniko_fit_checkins').select('id', { count: 'exact', head: true }).neq('kind', 'checkin'),
        _supabase.from('uniko_fit_chat').select('id', { count: 'exact', head: true }),
      ]);
      setResumo({ checkins: ci.count || 0, posts: po.count || 0, chat: ch.count || 0 });
    } catch { setResumo(null); }
  };

  const abrirReset = (alvo) => { setResetAlvo(alvo.id); setResetTexto(''); setResetMsg(''); carregarResumo(); };

  const resetar = async () => {
    if (!alvoAtual) return;
    if (resetTexto.trim().toUpperCase() !== 'RESETAR') { setResetMsg('Digite RESETAR pra confirmar.'); return; }
    setResetando(true); setResetMsg('');
    try {
      const { error } = await alvoAtual.apagar();
      if (error) throw new Error(error.message);
      setResetAlvo(null); setResetTexto('');
      await carregarResumo();
      flash(`${alvoAtual.ok} Quem estiver com o Uniko FIT aberto precisa recarregar.`);
    } catch (e) {
      setResetMsg('Erro ao apagar: ' + (e.message || ''));
    }
    setResetando(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: extrasData }, { data: overridesData }] = await Promise.all([
        _supabase.from('uniko_fit_poses_custom').select('*').order('created_at', { ascending: false }),
        _supabase.from('uniko_fit_poses_overrides').select('*'),
      ]);
      setExtras(extrasData || []);
      const map = {}; (overridesData || []).forEach(o => { map[o.pose_id] = o.image_url; });
      setOverrides(map);
    } catch {}
    carregarResumo();
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const trocarFotoFixa = async (pose, f) => {
    if (!f) return;
    setTrocandoId(pose.id); setMsg('');
    try {
      const ext = (f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const rand = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `override-${pose.id}-${Date.now()}-${rand}.${ext}`;
      const { error: upErr } = await _supabase.storage.from('uniko-fit-poses').upload(path, f, { contentType: f.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = _supabase.storage.from('uniko-fit-poses').getPublicUrl(path);
      const { error } = await _supabase.from('uniko_fit_poses_overrides').upsert(
        { pose_id: pose.id, image_url: pub.publicUrl, updated_by: adminName || null, updated_at: new Date().toISOString() },
        { onConflict: 'pose_id' });
      if (error) throw error;
      flash(`✅ Foto de "${pose.texto}" atualizada!`);
      await load();
    } catch (e) { flash('Erro ao trocar a foto: ' + (e.message || '')); }
    setTrocandoId(null);
  };

  const restaurarFotoFixa = async (pose) => {
    if (!window.confirm(`Voltar "${pose.texto}" pra arte original?`)) return;
    try { await _supabase.from('uniko_fit_poses_overrides').delete().eq('pose_id', pose.id); await load(); }
    catch (e) { flash('Erro ao restaurar: ' + (e.message || '')); }
  };

  const escolherImagem = (f) => {
    setFile(f || null);
    if (!f) { setPreview(null); return; }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const limparForm = () => { setTexto(''); setEmoji(''); setFile(null); setPreview(null); };

  const adicionar = async () => {
    if (!texto.trim()) { flash('Descreve a pose antes de adicionar.'); return; }
    if (!file) { flash('Anexa uma imagem da pose.'); return; }
    setUploading(true); setSaving(true); setMsg('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const rand = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `${Date.now()}-${rand}.${ext}`;
      const { error: upErr } = await _supabase.storage.from('uniko-fit-poses').upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = _supabase.storage.from('uniko-fit-poses').getPublicUrl(path);
      const { error } = await _supabase.from('uniko_fit_poses_custom').insert({
        texto: texto.trim(), emoji: emoji.trim() || null, image_url: pub.publicUrl, created_by: adminName || null,
      });
      if (error) throw error;
      limparForm();
      flash('✅ Pose adicionada! Já entra na rotação dos Desafios pra todo mundo.');
      await load();
    } catch (e) { flash('Erro ao salvar: ' + (e.message || '')); }
    setUploading(false); setSaving(false);
  };

  const toggleAtiva = async (pose) => {
    try { await _supabase.from('uniko_fit_poses_custom').update({ ativo: !pose.ativo }).eq('id', pose.id); load(); } catch {}
  };

  const excluir = async (pose) => {
    if (!window.confirm(`Excluir a pose "${pose.texto}" dos Desafios?`)) return;
    try { await _supabase.from('uniko_fit_poses_custom').delete().eq('id', pose.id); load(); }
    catch (e) { flash('Erro ao excluir: ' + (e.message || '')); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Cabeçalho */}
      <div style={{ padding: '14px 20px', borderRadius: 13, background: bg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${T.border}`, boxShadow: T.shM, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: '.04em' }}>Uniko FIT — Poses dos Desafios</div>
          <div style={{ fontSize: 13, color: T.textS, marginTop: 2 }}>Poses fixas ({POSES_FIXAS.length}) + as que você cadastrar aqui entram na rotação diária de todo mundo.</div>
        </div>
        <Moon size={24} color={T.goldL} opacity={0.35} float />
      </div>

      {/* Adicionar pose nova */}
      <Card style={{ padding: '22px 26px', background: bg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }} elevated>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>Adicionar pose nova</div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Imagem da pose</div>
            <label style={{ width: 110, height: 110, borderRadius: 12, border: `1.5px dashed ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: 'rgba(128,128,128,.08)' }}>
              {preview
                ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 26, color: T.textT }}>+</span>}
              <input type="file" accept="image/*" onChange={e => escolherImagem(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Descrição da pose</div>
              <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex: Prancha isométrica, olhando pra câmera" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14, maxWidth: 160 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Emoji (opcional)</div>
              <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="💪" style={inputStyle} />
            </div>
            {msg && <div style={{ fontSize: 12, color: msg.startsWith('✅') ? '#16a34a' : '#C04050', marginBottom: 10, padding: '7px 12px', borderRadius: 7, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)' }}>{msg}</div>}
            <button onClick={adicionar} disabled={saving || !texto.trim() || !file}
              style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)', opacity: (texto.trim() && file) ? 1 : 0.5 }}>
              {uploading ? 'Enviando...' : 'Adicionar aos Desafios'}
            </button>
          </div>
        </div>
      </Card>

      {/* Poses extras cadastradas */}
      <Card style={{ padding: 0, overflow: 'hidden', background: bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} elevated>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap' }}>Poses extras ({extras.length})</div>
          <div style={{ flex: 1 }} />
          <button onClick={load} title="Recarregar" style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T.textS, fontFamily: 'var(--font-body)', outline: 'none' }}>↻</button>
        </div>
        {loading
          ? <div style={{ padding: 32, textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando...</div>
          : extras.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: T.textT, fontSize: 13 }}>Nenhuma pose extra ainda — as fixas continuam valendo normalmente.</div>
            : extras.map(p => (
              <div key={p.id} style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12, opacity: p.ativo ? 1 : 0.5 }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(128,128,128,.12)' }}>
                  <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{p.emoji ? `${p.emoji} ` : ''}{p.texto}</div>
                  <div style={{ fontSize: 11, color: T.textT, marginTop: 2 }}>{p.ativo ? 'ativa na rotação' : 'desativada'} {p.created_by ? `· por ${p.created_by}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => toggleAtiva(p)} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${p.ativo ? T.border : 'rgba(34,197,94,0.4)'}`, background: p.ativo ? 'transparent' : 'rgba(34,197,94,0.07)', color: p.ativo ? T.textS : '#16a34a', cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-body)' }}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => excluir(p)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(192,64,80,0.25)', background: 'rgba(192,64,80,0.05)', color: '#C04050', cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-body)' }}>Excluir</button>
                </div>
              </div>
            ))
        }
      </Card>

      {/* Poses fixas (vêm com o app — dá pra trocar a foto de qualquer uma) */}
      <Card style={{ padding: '18px 20px', background: bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} elevated>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Poses fixas ({POSES_FIXAS.length})</div>
        <div style={{ fontSize: 12, color: T.textT, marginBottom: 14 }}>Vêm prontas com o app (arte do próprio Uniko). Passe o mouse numa foto pra trocar por uma sua.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {POSES_FIXAS.map(p => {
            const override = overrides[p.id];
            const trocando = trocandoId === p.id;
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label title="Clique pra trocar a foto dessa pose" style={{ position: 'relative', cursor: trocando ? 'wait' : 'pointer', flexShrink: 0, display: 'block' }}>
                  <PoseThumbFixa pose={p} override={override} size={44} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 16, opacity: trocando ? 1 : 0, transition: 'opacity .12s' }}
                    onMouseEnter={e => { if (!trocando) e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={e => { if (!trocando) e.currentTarget.style.opacity = 0; }}>
                    {trocando ? '⏳' : '✏️'}
                  </div>
                  <input type="file" accept="image/*" disabled={trocando} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; trocarFotoFixa(p, f); }} style={{ display: 'none' }} />
                </label>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.textS, lineHeight: 1.3 }}>{p.emoji} {p.texto}</div>
                  {override && <button onClick={() => restaurarFotoFixa(p)} style={{ marginTop: 3, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: T.gold, fontSize: 10.5, fontFamily: 'var(--font-body)', textDecoration: 'underline' }}>restaurar original</button>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Zona de perigo — cada coisa se apaga por conta própria */}
      <Card style={{ padding: 0, overflow: 'hidden', background: bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(192,64,80,0.28)' }} elevated>
        <div style={{ padding: '16px 22px 12px' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: '#C04050' }}>Zona de perigo</div>
          <div style={{ fontSize: 12.5, color: T.textS, marginTop: 3 }}>
            Cada limpeza vale por si só e é irreversível. As poses dos Desafios nunca são afetadas, e as fotos já enviadas continuam no Storage (só somem do app).
          </div>
        </div>
        {ALVOS.map(a => (
          <div key={a.id} style={{ padding: '13px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
                {a.titulo} <span style={{ fontWeight: 500, color: T.textT, fontSize: 12 }}>· {resumo ? `${resumo[a.chave]} registro${resumo[a.chave] !== 1 ? 's' : ''}` : '—'}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textS, marginTop: 2, lineHeight: 1.45 }}>{a.desc}</div>
            </div>
            <button onClick={() => abrirReset(a)} disabled={!!resumo && resumo[a.chave] === 0}
              style={{ padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(192,64,80,0.35)', background: 'rgba(192,64,80,0.07)', color: '#C04050',
                cursor: (!!resumo && resumo[a.chave] === 0) ? 'default' : 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)', flexShrink: 0,
                opacity: (!!resumo && resumo[a.chave] === 0) ? 0.45 : 1 }}>
              Zerar
            </button>
          </div>
        ))}
        <div style={{ padding: '10px 22px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={carregarResumo}
            style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T.textS, fontFamily: 'var(--font-body)' }}>↻ Atualizar contagem</button>
        </div>
      </Card>

      {/* Confirmação (irreversível — pede a palavra digitada) */}
      {alvoAtual && (
        <div onClick={() => !resetando && setResetAlvo(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,6,10,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, boxShadow: '0 20px 60px rgba(0,0,0,.28)', padding: '22px 24px' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 700, color: '#C04050', marginBottom: 8 }}>Apagar {alvoAtual.titulo.toLowerCase()}?</div>
            <div style={{ fontSize: 13, color: T.textS, lineHeight: 1.55, marginBottom: 14 }}>
              {resumo ? <><b>{resumo[alvoAtual.chave]}</b> registro{resumo[alvoAtual.chave] !== 1 ? 's' : ''} sairão de vez. </> : null}{alvoAtual.desc} <b>Não tem como desfazer.</b>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Digite <b>RESETAR</b> pra confirmar</div>
            <input value={resetTexto} onChange={e => setResetTexto(e.target.value)} placeholder="RESETAR" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && !resetando) resetar(); }} style={inputStyle} />
            {resetMsg && <div style={{ fontSize: 12, color: '#C04050', marginTop: 10, padding: '7px 12px', borderRadius: 7, background: 'rgba(192,64,80,0.06)' }}>{resetMsg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setResetAlvo(null)} disabled={resetando}
                style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)' }}>Cancelar</button>
              <button onClick={resetar} disabled={resetando || resetTexto.trim().toUpperCase() !== 'RESETAR'}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: '#C04050', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)',
                  cursor: resetando ? 'wait' : 'pointer', opacity: resetTexto.trim().toUpperCase() === 'RESETAR' ? 1 : 0.5 }}>
                {resetando ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnikoFitPosesTab;
