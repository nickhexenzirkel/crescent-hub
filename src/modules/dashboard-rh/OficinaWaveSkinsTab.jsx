// Dashboard RH → Oficina Uniko Wave → aba Skins. Diferente da aba
// Personagens (cria personagem nova do zero): aqui é um visual ALTERNATIVO
// pra um personagem que JÁ EXISTE no jogo — mesmas poses/frames que uma
// personagem da Oficina tem (splash, passo1-5, atacar, pular, segurar),
// associadas a um personagem do roster, com título/descrição/preço. O
// jogador compra com os GW (Ghost Waves) que ganha jogando partidas — sem
// gacha, preço fixo. Ver supabase_uniko_wave_skins.sql e
// public/unikowave/index.html (CUSTOM_WAVE_SKINS/getEffectiveChar/
// getEffectiveWgFrames/buySkin/equipSkin).
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

// Mesmos slots da aba Personagens — pra skin ficar com a MESMA cobertura de
// poses/frames (ritmo + Guerra Estelar), não só uma imagem solta.
const SKIN_SLOTS = [
  { k: 'splash', label: 'Splash art', req: true },
  { k: 'passo1', label: 'Passo 1', req: true }, { k: 'passo2', label: 'Passo 2' },
  { k: 'passo3', label: 'Passo 3' }, { k: 'passo4', label: 'Passo 4' }, { k: 'passo5', label: 'Passo 5 (opcional)' },
  { k: 'atacar', label: 'Atacar', req: true }, { k: 'pular', label: 'Pular', req: true }, { k: 'segurar', label: 'Segurar', req: true },
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
  const [imgs, setImgs] = useState({}); // slot -> url
  const [uploadingSlot, setUploadingSlot] = useState(null);
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

  const upload = async (slot, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg('⚠️ Escolha um arquivo de imagem.'); return; }
    if (file.size > 12 * 1024 * 1024) { setMsg('⚠️ Imagem maior que 12MB.'); return; }
    setUploadingSlot(slot); setMsg('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const rand = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `${slot}-${Date.now()}-${rand}.${ext}`;
      const { error } = await supabase.storage.from('uniko-wave-skins').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('uniko-wave-skins').getPublicUrl(path);
      setImgs(m => ({ ...m, [slot]: data.publicUrl }));
    } catch (e) { setMsg('⚠️ ' + (e.message || 'Erro ao enviar imagem')); }
    setUploadingSlot(null);
  };

  const limpar = () => { setTitulo(''); setDescricao(''); setGwPrice('500'); setImgs({}); };

  const salvar = async () => {
    const t = titulo.trim();
    if (!charId) { setMsg('⚠️ Escolha o personagem.'); return; }
    if (!t) { setMsg('⚠️ Dá um título pra skin.'); return; }
    const faltando = SKIN_SLOTS.filter(s => s.req && !imgs[s.k]);
    if (faltando.length) { setMsg('⚠️ Faltam imagens: ' + faltando.map(s => s.label).join(', ')); return; }
    const preco = Math.max(0, parseInt(gwPrice, 10) || 0);
    setSalvando(true); setMsg('');
    try {
      const id = `${slugify(charId)}-${slugify(t)}-${Math.random().toString(36).slice(2, 6)}`;
      const run_urls = ['passo1', 'passo2', 'passo3', 'passo4', 'passo5'].map(k => imgs[k]).filter(Boolean);
      const { error } = await supabase.from('uniko_wave_skins').insert({
        id, char_id: charId, titulo: t, descricao: descricao.trim() || null,
        splash_url: imgs.splash, run_urls,
        atk_url: imgs.atacar, jump_url: imgs.pular, hold_url: imgs.segurar,
        gw_price: preco, created_by: adminName || null,
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
          <label style={labelSt}>Imagens (mesmas poses de uma personagem da Oficina — PNG com fundo transparente)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10 }}>
            {SKIN_SLOTS.map(s => {
              const url = imgs[s.k]; const carregando = uploadingSlot === s.k;
              return (
                <div key={s.k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.req ? T.text : T.textT }}>{s.label}{s.req && <span style={{ color: '#C04050' }}> *</span>}</div>
                  <label style={{ display: 'block', aspectRatio: '1', borderRadius: 10, cursor: carregando ? 'wait' : 'pointer', overflow: 'hidden',
                    border: `1.5px ${url ? 'solid' : 'dashed'} ${url ? '#22C55E' : T.border}`, background: 'rgba(127,127,127,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                         : <span style={{ fontSize: 11, color: T.textT }}>{carregando ? 'Enviando…' : '+ imagem'}</span>}
                    <input type="file" accept="image/*" disabled={!!uploadingSlot} style={{ display: 'none' }}
                      onChange={e => { upload(s.k, e.target.files?.[0]); e.target.value = ''; }}/>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('✅') ? '#16a34a' : '#C04050', padding: '8px 12px', borderRadius: 9, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)' }}>{msg}</div>}

        <div>
          <button onClick={salvar} disabled={salvando || !!uploadingSlot}
            style={{ padding: '11px 26px', borderRadius: 10, border: 'none', cursor: (salvando || uploadingSlot) ? 'default' : 'pointer',
              background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)',
              opacity: (salvando || uploadingSlot) ? .6 : 1, boxShadow: `0 3px 12px ${T.goldLine}44` }}>
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
              <img src={s.splash_url || s.imagem_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 9, border: `1px solid ${T.border}`, flexShrink: 0 }}/>
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
