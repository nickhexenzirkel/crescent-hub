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

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

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
    </div>
  );
};

export default UnikoFitPosesTab;
