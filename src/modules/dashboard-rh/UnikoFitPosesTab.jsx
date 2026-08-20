// Dashboard RH → aba "Uniko FIT".
// Mostra TODAS as poses da aba Desafios do Uniko FIT: as fixas (arte no sprite
// sheet /uniko-fit/poses-uniko.png, só leitura aqui) + as extras cadastradas
// por aqui (tabela uniko_fit_poses_custom, cada uma com a própria imagem).
// Cadastrar uma pose extra = ela entra na rotação de TODO MUNDO na hora,
// bucket 'uniko-fit-poses' — rodar supabase_uniko_fit_poses_custom.sql antes.
import React, { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase } from '../../contexts/user';
import { Card, Moon } from '../../shared/components';

// Mesma colagem/grade usada no app (ver src/modules/uniko-fit/index.jsx).
const POSES_FIXAS = [
  { id: 'biceps-duplo',      emoji: '💪💪', texto: 'Bíceps duplo',                                sprite: { row: 0, col: 0 } },
  { id: 'costas-v-ombro',    emoji: '👀',   texto: 'Costas em V, olhando por cima do ombro',       sprite: { row: 0, col: 1 } },
  { id: 'peito-cintura',     emoji: '🫡',   texto: 'Peito estufado, mãos na cintura',              sprite: { row: 0, col: 2 } },
  { id: 'perfil-definicao',  emoji: '💯',   texto: 'Perfil de lado mostrando a definição',         sprite: { row: 0, col: 3 } },
  { id: 'halteres-dois-braços', emoji: '🏋️', texto: 'Segurando halteres nos dois braços',         sprite: { row: 0, col: 4 } },
  { id: 'barra-frente',      emoji: '🏋️‍♂️', texto: 'Segurando a barra/peso na frente do corpo', sprite: { row: 0, col: 5 } },
  { id: 'abdomen-camiseta',  emoji: '🍫',   texto: 'Abdômen contraído, camiseta/moletom levantado', sprite: { row: 1, col: 0 } },
  { id: 'panturrilha-ponta', emoji: '🦵',   texto: 'Panturrilha na ponta dos pés',                 sprite: { row: 1, col: 1 } },
  { id: 'super-heroi',       emoji: '🦸',   texto: 'Pose de super-herói',                          sprite: { row: 1, col: 2 } },
  { id: 'modo-foco',         emoji: '🧘',   texto: 'Encarando o espelho, "modo foco"',             sprite: { row: 1, col: 3 } },
  { id: 'alongando-braco',   emoji: '🙆',   texto: 'Alongando o braço atrás da cabeça',            sprite: { row: 1, col: 4 } },
  { id: 'torcao-tronco',     emoji: '🌀',   texto: 'Torção de tronco',                             sprite: { row: 1, col: 5 } },
  { id: 'luva-treino',       emoji: '🧤',   texto: 'Colocando a luva de treino',                   sprite: { row: 2, col: 0 } },
  { id: 'ajustando-bone',    emoji: '🧢',   texto: 'Ajustando boné/touca',                         sprite: { row: 2, col: 1 } },
  { id: 'faixa-pulso',       emoji: '🎗️',   texto: 'Enrolando a faixa de pulso',                   sprite: { row: 2, col: 2 } },
  { id: 'quadriceps-perna',  emoji: '🦿',   texto: 'Flexionando a perna, mostrando o quadríceps',  sprite: { row: 2, col: 3 } },
  { id: 'selfie-paz',        emoji: '✌️',   texto: 'Selfie final com sinal de paz',                sprite: { row: 2, col: 4 } },
];
const SPRITE_COLS = 6, SPRITE_ROWS = 3;

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`,
  background: T.surface, fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)',
};

const PoseThumbFixa = ({ pose, size = 56 }) => (
  <div style={{ width: size, height: size, borderRadius: 11, overflow: 'hidden', flexShrink: 0, background: 'rgba(128,128,128,.12)',
    backgroundImage: 'url(/uniko-fit/poses-uniko.png)', backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`,
    backgroundPosition: `${pose.sprite.col / (SPRITE_COLS - 1) * 100}% ${pose.sprite.row / (SPRITE_ROWS - 1) * 100}%` }} />
);

const UnikoFitPosesTab = ({ cardBg, adminName }) => {
  const bg = cardBg || T.surface;
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

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
      const { data } = await _supabase.from('uniko_fit_poses_custom').select('*').order('created_at', { ascending: false });
      setExtras(data || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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

      {/* Poses fixas (só leitura — arte do sprite sheet do app) */}
      <Card style={{ padding: '18px 20px', background: bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} elevated>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Poses fixas ({POSES_FIXAS.length})</div>
        <div style={{ fontSize: 12, color: T.textT, marginBottom: 14 }}>Vêm prontas com o app (arte do próprio Uniko). Só leitura por aqui.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {POSES_FIXAS.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PoseThumbFixa pose={p} size={44} />
              <div style={{ fontSize: 12, color: T.textS, lineHeight: 1.3 }}>{p.emoji} {p.texto}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default UnikoFitPosesTab;
