// Dashboard RH → Oficina Uniko Wave → aba Skins. Diferente da aba
// Personagens (cria personagem nova do zero): aqui é um visual ALTERNATIVO
// pra um personagem que JÁ EXISTE no jogo — uma imagem, um título e uma
// descrição, associados a um personagem do roster. O jogador compra com os
// GW (Ghost Waves) que ganha jogando partidas — sem gacha, preço fixo.
// Ver supabase_uniko_wave_skins.sql e public/unikowave/index.html
// (CUSTOM_WAVE_SKINS/getEffectiveChar/buySkin/equipSkin).
import { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { supabase } from '../../contexts/user';

// Roster FIXO do jogo (chaves de CHARACTERS em public/unikowave/index.html) —
// não dá pra ler isso do Supabase, é hardcoded no HTML do jogo. Se um
// personagem novo entrar no jogo por código, adiciona aqui também.
const PERSONAGENS_BASE = [
  { id: 'dodoco', name: 'Dodoco' },
  { id: 'icy', name: 'Icy Louboutin' },
  { id: 'columbina', name: 'Columbina' },
  { id: 'linnea', name: 'Mizuki' },
  { id: 'madoka', name: 'Madoka Kaname' },
  { id: 'homura', name: 'Homura Akemi' },
  { id: 'stella', name: 'Stella' },
  { id: 'natsumi', name: 'Natsumi' },
  { id: 'venebra', name: 'Lady Venebra' },
  { id: 'oceania', name: 'Oceania' },
  { id: 'ashen', name: 'Ashen' },
  { id: 'icydoll', name: 'Icy the Doll' },
];

const slugify = (s) => (s || '')
  .trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skin';

// `owLista`: personagens criadas na própria Oficina (aba Personagens) — também
// podem ganhar skin, além do roster fixo acima.
const OficinaWaveSkinsTab = ({ cardBg, adminName, owLista = [] }) => {
  const personagens = [
    ...PERSONAGENS_BASE,
    ...owLista.map(c => ({ id: c.id, name: `${c.name} (Oficina)` })),
  ];

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [charId, setCharId] = useState(personagens[0]?.id || '');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [gwPrice, setGwPrice] = useState('500');
  const [imagemUrl, setImagemUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('uniko_wave_skins').select('*').order('created_at', { ascending: false });
      setLista(data || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const nomeDoPersonagem = (id) => personagens.find(p => p.id === id)?.name || id;

  const upload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg('⚠️ Escolha um arquivo de imagem.'); return; }
    if (file.size > 12 * 1024 * 1024) { setMsg('⚠️ Imagem maior que 12MB.'); return; }
    setUploading(true); setMsg('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const rand = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `${Date.now()}-${rand}.${ext}`;
      const { error } = await supabase.storage.from('uniko-wave-skins').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('uniko-wave-skins').getPublicUrl(path);
      setImagemUrl(data.publicUrl);
    } catch (e) { setMsg('⚠️ ' + (e.message || 'Erro ao enviar imagem')); }
    setUploading(false);
  };

  const limpar = () => { setTitulo(''); setDescricao(''); setGwPrice('500'); setImagemUrl(''); };

  const salvar = async () => {
    const t = titulo.trim();
    if (!charId) { setMsg('⚠️ Escolha o personagem.'); return; }
    if (!t) { setMsg('⚠️ Dá um título pra skin.'); return; }
    if (!imagemUrl) { setMsg('⚠️ Falta a imagem da skin.'); return; }
    const preco = Math.max(0, parseInt(gwPrice, 10) || 0);
    setSalvando(true); setMsg('');
    try {
      const id = `${slugify(charId)}-${slugify(t)}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from('uniko_wave_skins').insert({
        id, char_id: charId, titulo: t, descricao: descricao.trim() || null,
        imagem_url: imagemUrl, gw_price: preco, created_by: adminName || null,
      });
      if (error) throw error;
      limpar();
      setMsg(`✅ Skin criada! Já aparece pra quem tem o(a) ${nomeDoPersonagem(charId)} desbloqueado(a).`);
      await carregar();
      setTimeout(() => setMsg(''), 5000);
    } catch (e) { setMsg('⚠️ ' + (e.message || 'Erro ao salvar')); }
    setSalvando(false);
  };

  const excluir = async (s) => {
    if (!window.confirm(`Excluir a skin "${s.titulo}"?`)) return;
    try { await supabase.from('uniko_wave_skins').delete().eq('id', s.id); await carregar(); }
    catch (e) { setMsg('⚠️ Erro ao excluir: ' + (e.message || '')); setTimeout(() => setMsg(''), 5000); }
  };

  const inputSt = {
    width: '100%', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`,
    fontFamily: 'var(--font-body)', fontSize: 13, color: T.text, background: T.surface || '#fff', outline: 'none', boxSizing: 'border-box',
  };
  const labelSt = { fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Formulário */}
      <div style={{ padding: 18, borderRadius: 13, background: cardBg, border: `1px solid ${T.border}`, boxShadow: T.shM, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
          <div>
            <label style={labelSt}>Personagem</label>
            <select value={charId} onChange={e => setCharId(e.target.value)} style={inputSt}>
              {personagens.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Preço (GW)</label>
            <input type="number" min="0" value={gwPrice} onChange={e => setGwPrice(e.target.value)} style={inputSt}/>
          </div>
        </div>
        <div>
          <label style={labelSt}>Título da skin</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Linnea de Gala" style={inputSt}/>
        </div>
        <div>
          <label style={labelSt}>Descrição (opcional)</label>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Conte a ideia da skin..."
            rows={3} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }}/>
        </div>
        <div>
          <label style={labelSt}>Imagem da skin (PNG com fundo transparente de preferência)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} id="ow-skin-file"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}/>
            <label htmlFor="ow-skin-file" style={{ padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 12.5, cursor: uploading ? 'wait' : 'pointer', fontFamily: 'var(--font-body)' }}>
              {uploading ? 'Enviando...' : imagemUrl ? 'Trocar imagem' : 'Escolher imagem'}
            </label>
            {imagemUrl && <img src={imagemUrl} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 9, border: `1px solid ${T.border}` }}/>}
          </div>
        </div>

        {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('✅') ? '#16a34a' : '#C04050', padding: '8px 12px', borderRadius: 9, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)' }}>{msg}</div>}

        <div>
          <button onClick={salvar} disabled={salvando || uploading}
            style={{ padding: '11px 26px', borderRadius: 10, border: 'none', cursor: (salvando || uploading) ? 'default' : 'pointer',
              background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)',
              opacity: (salvando || uploading) ? .6 : 1, boxShadow: `0 3px 12px ${T.goldLine}44` }}>
            {salvando ? 'Salvando…' : '🎨 Criar Skin'}
          </button>
        </div>
      </div>

      {/* Lista */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textT, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Skins criadas ({lista.length})
        </div>
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20, fontSize: 13, color: T.textT, textAlign: 'center' }}>Carregando...</div>
          ) : !lista.length ? (
            <div style={{ padding: 20, fontSize: 13, color: T.textT, textAlign: 'center' }}>Nenhuma skin criada ainda.</div>
          ) : lista.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
              <img src={s.imagem_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 9, border: `1px solid ${T.border}`, flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titulo}</div>
                <div style={{ fontSize: 11.5, color: T.textT, marginTop: 1 }}>
                  {nomeDoPersonagem(s.char_id)} · {Number(s.gw_price) || 0} GW{s.descricao ? ` · ${s.descricao}` : ''}
                </div>
              </div>
              <button onClick={() => excluir(s)} title="Excluir"
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(192,64,80,0.25)', background: 'rgba(192,64,80,0.05)', cursor: 'pointer', color: '#C04050', flexShrink: 0 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OficinaWaveSkinsTab;
