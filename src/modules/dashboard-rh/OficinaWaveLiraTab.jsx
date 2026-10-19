// Dashboard RH → Oficina Uniko Wave → aba Lira Estelar. Adiciona músicas
// novas ao modo Lira Estelar do Uniko Wave a partir da TABLATURA em texto
// (o mesmo formato da Columbina Lullaby / NodKrai / I Loved You): cada letra
// é uma tecla (Q W E R T Y U / A S D F G H J / Z X C V B N M), letras coladas
// = acorde (tocar juntas) e "-" ou "_" = pausa. Ver supabase_uniko_wave_lira.sql
// e public/unikowave/lira.js (parseTab).
import { useState, useEffect, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { supabase } from '../../contexts/user';
import { detectarBpm, msPorTraco } from './detectarBpm';

const TECLAS = 'QWERTYUASDFGHJZXCVBNM';
const NIVEIS = ['Fácil', 'Médio', 'Difícil'];

const slugify = (s) => (s || '')
  .trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'musica';

// Espaços (no fim ou no meio da linha) são ignorados — vêm de copiar/colar.
const limparLinhas = (texto) => (texto || '').split(/\r?\n/).map(l => l.replace(/\s+/g, '')).filter(Boolean);

// Mesma leitura do jogo, só pra mostrar o resumo antes de salvar.
function analisar(texto) {
  const linhas = limparLinhas(texto);
  let passos = 0, acordes = 0;
  const porLetra = {}; // letra inválida -> números das linhas
  linhas.forEach((l, i) => {
    for (const ch of l) if (!TECLAS.includes(ch) && ch !== '-' && ch !== '_') {
      const a = (porLetra[ch] = porLetra[ch] || []);
      if (!a.includes(i + 1)) a.push(i + 1);
    }
    const re = /([A-Z]+)([-_]*)/g; let m;
    while ((m = re.exec(l))) {
      const c = new Set([...m[1]].filter(ch => TECLAS.includes(ch)));
      if (c.size) { passos++; if (c.size > 1) acordes++; }
    }
  });
  const invalidos = Object.keys(porLetra).map(ch => `${ch} (linha ${porLetra[ch].slice(0, 6).join(', ')}${porLetra[ch].length > 6 ? '…' : ''})`);
  return { linhas: linhas.length, passos, acordes, invalidos };
}

// Músicas que já vêm no código do jogo (public/unikowave/lira.js). Se entrar uma nova por código, entra aqui também.
const MUSICAS_BASE = [
  { id: 'estrelinha', nome: 'Brilha, Brilha Estrelinha' }, { id: 'ode', nome: 'Ode à Alegria' },
  { id: 'jacques', nome: 'Frère Jacques' }, { id: 'jingle', nome: 'Jingle Bells' },
  { id: 'parabens', nome: 'Parabéns pra Você' }, { id: 'columbina', nome: 'Columbina Lullaby' },
  { id: 'nodkrai', nome: 'NodKrai' }, { id: 'iloveyou', nome: 'I Loved You' },
];

const CONFIG_PADRAO = {
  modos: { maestro: true, frenesi: true, livre: true },
  dificuldades: { facil: true, medio: true, dificil: true },
  notas: { todas: true, quatro: true },
  musicasOff: [],
};
const mesclar = (c) => ({
  modos: { ...CONFIG_PADRAO.modos, ...(c?.modos || {}) },
  dificuldades: { ...CONFIG_PADRAO.dificuldades, ...(c?.dificuldades || {}) },
  notas: { ...CONFIG_PADRAO.notas, ...(c?.notas || {}) },
  musicasOff: Array.isArray(c?.musicasOff) ? c.musicasOff : [],
});

const Interruptor = ({ on, onClick, label, sub, T }) => (
  <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, textAlign: 'left',
    border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
    <span style={{ width: 38, height: 22, borderRadius: 12, background: on ? '#22C55E' : '#9ca3af', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }}/>
    </span>
    <span style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.textT }}>{sub}</div>}
    </span>
  </button>
);

const OficinaWaveLiraTab = ({ cardBg, adminName }) => {
  const [cfg, setCfg] = useState(CONFIG_PADRAO);
  const [cfgMsg, setCfgMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('uniko_wave_lira_config').select('config').eq('id', 'main').maybeSingle();
        if (data?.config) setCfg(mesclar(data.config));
      } catch {}
    })();
  }, []);

  const gravar = async (novo, bloqueio) => {
    if (bloqueio) { setCfgMsg('⚠️ ' + bloqueio); setTimeout(() => setCfgMsg(''), 4500); return; }
    const anterior = cfg;
    setCfg(novo); setCfgMsg('');
    try {
      const { error } = await supabase.from('uniko_wave_lira_config').upsert({
        id: 'main', config: novo, updated_by: adminName || null, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setCfgMsg('✅ Salvo. Vale na próxima vez que o jogo abrir.'); setTimeout(() => setCfgMsg(''), 3500);
    } catch (e) {
      setCfg(anterior);
      setCfgMsg('⚠️ ' + (e.message || 'Erro ao salvar') + ' (o SQL supabase_uniko_wave_lira.sql já foi rodado?)');
    }
  };

  // Alterna um item de grupo ({chave: bool}) exigindo ao menos um ligado.
  const alternarGrupo = (grupo, chave, rotulo) => {
    const novo = mesclar(cfg); novo[grupo][chave] = !novo[grupo][chave];
    const ligados = Object.values(novo[grupo]).filter(Boolean).length;
    gravar(novo, ligados ? null : `Deixe pelo menos uma opção ligada em "${rotulo}".`);
  };
  const [musicasTodas, setMusicasTodas] = useState([]);
  const alternarLivre = () => {
    const novo = mesclar(cfg); novo.modos.livre = !novo.modos.livre;
    const musicasLigadas = musicasTodas.filter(m => !novo.musicasOff.includes(m.id)).length;
    gravar(novo, (novo.modos.livre || musicasLigadas) ? null : 'Sem o Modo Livre, ao menos uma música precisa ficar ligada.');
  };
  const alternarMusica = (id) => {
    const novo = mesclar(cfg);
    novo.musicasOff = novo.musicasOff.includes(id) ? novo.musicasOff.filter(x => x !== id) : [...novo.musicasOff, id];
    const musicasLigadas = musicasTodas.filter(m => !novo.musicasOff.includes(m.id)).length;
    gravar(novo, (novo.modos.livre || musicasLigadas) ? null : 'Com o Modo Livre desligado, ao menos uma música precisa ficar ligada.');
  };
  const alternarModo = (chave) => {
    const novo = mesclar(cfg); novo.modos[chave] = !novo.modos[chave];
    gravar(novo, (novo.modos.maestro || novo.modos.frenesi) ? null : 'Deixe o Modo Maestro ou o Frenesi Estelar ligado.');
  };

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState('Médio');
  const [unit, setUnit] = useState('105');
  const [tab, setTab] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);   // música em edição (null = criando)
  const [bpm, setBpm] = useState(null);
  const [tracosTempo, setTracosTempo] = useState('4');
  const [detectando, setDetectando] = useState(false);

  // Lê o áudio, descobre o BPM e já preenche os ms por traço.
  const detectar = async (e) => {
    const arq = e.target.files?.[0]; e.target.value = '';
    if (!arq) return;
    setDetectando(true); setMsg('');
    try {
      const b = await detectarBpm(arq);
      setBpm(b); setUnit(String(Math.min(400, Math.max(40, msPorTraco(b, +tracosTempo)))));
    } catch (err) { setBpm(null); setMsg('⚠️ ' + (err.message || 'Erro ao detectar o andamento.')); }
    setDetectando(false);
  };
  const mudarTracos = (v) => {
    setTracosTempo(v);
    if (bpm) setUnit(String(Math.min(400, Math.max(40, msPorTraco(bpm, +v)))));
  };

  const editar = (s) => {
    setEditId(s.id); setNome(s.nome); setNivel(s.nivel || 'Médio'); setUnit(String(s.unit)); setTab(s.tab || '');
    setBpm(null); setMsg(''); window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };
  const cancelarEdicao = () => {
    setEditId(null); setNome(''); setTab(''); setUnit('105'); setNivel('Médio'); setBpm(null); setMsg('');
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('uniko_wave_lira_songs').select('*').order('created_at', { ascending: false });
      setLista(data || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);
  useEffect(() => { setMusicasTodas([...MUSICAS_BASE, ...lista.map(m => ({ id: m.id, nome: m.nome }))]); }, [lista]);

  const info = useMemo(() => analisar(tab), [tab]);

  const salvar = async () => {
    const n = nome.trim();
    if (!n) { setMsg('⚠️ Dá um nome pra música.'); return; }
    if (!info.passos) { setMsg('⚠️ Cole a tablatura (letras das teclas e traços).'); return; }
    if (info.invalidos.length) { setMsg('⚠️ Letras que não existem na lira: ' + info.invalidos.join(' · ') + '. Troque pela tecla certa (Q W E R T Y U / A S D F G H J / Z X C V B N M).'); return; }
    const u = Math.min(400, Math.max(40, parseInt(unit, 10) || 105));
    setSalvando(true); setMsg('');
    try {
      const linhas = limparLinhas(tab).join('\n');
      const editando = !!editId;
      const { error } = editando
        ? await supabase.from('uniko_wave_lira_songs').update({ nome: n, nivel, unit: u, tab: linhas }).eq('id', editId)
        : await supabase.from('uniko_wave_lira_songs').insert({
          id: `${slugify(n)}-${Math.random().toString(36).slice(2, 6)}`, nome: n, nivel, unit: u, tab: linhas, created_by: adminName || null,
        });
      if (error) throw error;
      cancelarEdicao();
      setMsg(editando ? '✅ Música atualizada! Vale na próxima vez que o jogo abrir.' : '✅ Música adicionada! Aparece na Lira Estelar na próxima vez que o jogo abrir.');
      await carregar();
      setTimeout(() => setMsg(''), 6000);
    } catch (e) { setMsg('⚠️ ' + (e.message || 'Erro ao salvar (o SQL supabase_uniko_wave_lira.sql já foi rodado?)')); }
    setSalvando(false);
  };

  const excluir = async (s) => {
    if (!window.confirm(`Excluir a música "${s.nome}" da Lira Estelar?`)) return;
    try { await supabase.from('uniko_wave_lira_songs').delete().eq('id', s.id); if (editId === s.id) cancelarEdicao(); await carregar(); }
    catch (e) { setMsg('⚠️ Erro ao excluir: ' + (e.message || '')); setTimeout(() => setMsg(''), 5000); }
  };

  const inputSt = {
    width: '100%', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`,
    fontFamily: 'var(--font-body)', fontSize: 13, color: T.text, background: T.surface || '#fff', outline: 'none', boxSizing: 'border-box',
  };
  const labelSt = { fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Interruptores */}
      <div style={{ padding: 18, borderRadius: 13, background: cardBg, border: `1px solid ${T.border}`, boxShadow: T.shM, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 800, color: T.text }}>🎚️ Interruptores da Lira Estelar</div>
        <div style={{ fontSize: 12, color: T.textS, lineHeight: 1.5 }}>Liga e desliga o que aparece pros jogadores. Vale na próxima vez que o jogo abrir. O que está desligado some do lobby.</div>
        {[
          { t: 'Modos', itens: [
            { l: '🎼 Modo Maestro', on: cfg.modos.maestro, f: () => alternarModo('maestro') },
            { l: '🌠 Frenesi Estelar', on: cfg.modos.frenesi, f: () => alternarModo('frenesi') },
            { l: '🎵 Modo Livre', on: cfg.modos.livre, f: alternarLivre },
          ] },
          { t: 'Dificuldades do Frenesi', itens: [
            { l: '🟢 Fácil', on: cfg.dificuldades.facil, f: () => alternarGrupo('dificuldades', 'facil', 'Dificuldades') },
            { l: '🟡 Médio', on: cfg.dificuldades.medio, f: () => alternarGrupo('dificuldades', 'medio', 'Dificuldades') },
            { l: '🔴 Difícil', on: cfg.dificuldades.dificil, f: () => alternarGrupo('dificuldades', 'dificil', 'Dificuldades') },
          ] },
          { t: 'Notas do Frenesi', itens: [
            { l: '🎹 21 notas', on: cfg.notas.todas, f: () => alternarGrupo('notas', 'todas', 'Notas') },
            { l: '4 botões (A S D F)', on: cfg.notas.quatro, f: () => alternarGrupo('notas', 'quatro', 'Notas') },
          ] },
        ].map(g => (
          <div key={g.t}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>{g.t}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8 }}>
              {g.itens.map(i => <Interruptor key={i.l} T={T} on={i.on} label={i.l} onClick={i.f}/>)}
            </div>
          </div>
        ))}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Músicas (ligada = aparece na biblioteca)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8 }}>
            {musicasTodas.map(m => (
              <Interruptor key={m.id} T={T} on={!cfg.musicasOff.includes(m.id)} label={m.nome} onClick={() => alternarMusica(m.id)}/>
            ))}
          </div>
        </div>
        {cfgMsg && <div style={{ fontSize: 12.5, color: cfgMsg.startsWith('✅') ? '#16a34a' : '#C04050', padding: '8px 12px', borderRadius: 9, background: cfgMsg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)' }}>{cfgMsg}</div>}
      </div>

      <div style={{ padding: 18, borderRadius: 13, background: cardBg, border: `1px solid ${editId ? T.gold : T.border}`, boxShadow: T.shM, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {editId && <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>✏️ Editando "{nome || 'música'}"</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: 12 }}>
          <div>
            <label style={labelSt}>Nome da música</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Columbina Lullaby" style={inputSt}/>
          </div>
          <div>
            <label style={labelSt}>Nível</label>
            <select value={nivel} onChange={e => setNivel(e.target.value)} style={inputSt}>
              {NIVEIS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt} title="Quantos milissegundos dura cada traço. Menor = música mais rápida.">Ms por traço</label>
            <input type="number" min="40" max="400" value={unit} onChange={e => setUnit(e.target.value)} style={inputSt}/>
          </div>
        </div>
        {/* Andamento automático: o áudio original da música diz o BPM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, border: `1px dashed ${T.border}` }}>
          <label style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${T.border}`, cursor: detectando ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, color: T.text, opacity: detectando ? .6 : 1 }}>
            {detectando ? 'Analisando…' : '🎧 Detectar pelo áudio da música'}
            <input type="file" accept="audio/*" onChange={detectar} disabled={detectando} style={{ display: 'none' }}/>
          </label>
          <span style={{ fontSize: 12, color: T.textS }}>traços por tempo:</span>
          <select value={tracosTempo} onChange={e => mudarTracos(e.target.value)} style={{ ...inputSt, width: 'auto', padding: '7px 9px' }}>
            {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span style={{ fontSize: 12, color: T.textT, flex: 1, minWidth: 180 }}>
            {bpm ? <>≈ <b>{bpm} BPM</b> → <b>{unit} ms</b> por traço. Se ficou rápido ou lento demais, mude os traços por tempo ou ajuste o campo acima.</>
              : 'Envie o MP3 da música: o andamento é descoberto sozinho e os ms por traço são preenchidos. O áudio não é guardado.'}
          </span>
        </div>
        <div>
          <label style={labelSt}>Tablatura (uma linha por trecho)</label>
          <textarea value={tab} onChange={e => setTab(e.target.value.toUpperCase())} rows={12} spellCheck={false}
            placeholder={'X---------C----V----A\nSH---------W---------W--------------Q\nAW---------Q----J----G'}
            style={{ ...inputSt, resize: 'vertical', fontFamily: 'Consolas, monospace', lineHeight: 1.5, whiteSpace: 'pre', overflowX: 'auto' }}/>
          <div style={{ fontSize: 11.5, color: T.textT, marginTop: 6, lineHeight: 1.6 }}>
            Cada letra é uma tecla da lira (<b>Q W E R T Y U</b> / <b>A S D F G H J</b> / <b>Z X C V B N M</b>). Letras coladas formam um <b>acorde</b> (ex.: <b>SH</b>).
            Cada <b>-</b> ou <b>_</b> é uma pausa. Linha que começa só com traços soma a pausa à linha de cima.
          </div>
          {tab.trim() && (
            <div style={{ fontSize: 12.5, marginTop: 8, padding: '8px 12px', borderRadius: 9,
              color: info.invalidos.length ? '#C04050' : T.text,
              background: info.invalidos.length ? 'rgba(192,64,80,0.06)' : 'rgba(34,197,94,0.08)' }}>
              {info.invalidos.length
                ? <>⚠️ Letras que não existem na lira: <b>{info.invalidos.join(' · ')}</b></>
                : <>✓ {info.linhas} linhas · <b>{info.passos}</b> passos · <b>{info.acordes}</b> acordes</>}
            </div>
          )}
        </div>

        {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('✅') ? '#16a34a' : '#C04050', padding: '8px 12px', borderRadius: 9, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)' }}>{msg}</div>}

        <div>
          <button onClick={salvar} disabled={salvando}
            style={{ padding: '11px 26px', borderRadius: 10, border: 'none', cursor: salvando ? 'default' : 'pointer',
              background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)',
              opacity: salvando ? .6 : 1, boxShadow: `0 3px 12px ${T.goldLine}44` }}>
            {salvando ? 'Salvando…' : editId ? '💾 Salvar alterações' : '🎵 Adicionar música'}
          </button>
          {editId && (
            <button onClick={cancelarEdicao} disabled={salvando}
              style={{ marginLeft: 10, padding: '11px 20px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-body)' }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textT, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Músicas adicionadas ({lista.length})
        </div>
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20, fontSize: 13, color: T.textT, textAlign: 'center' }}>Carregando...</div>
          ) : !lista.length ? (
            <div style={{ padding: 20, fontSize: 13, color: T.textT, textAlign: 'center' }}>Nenhuma música adicionada ainda. (As músicas que já vêm no jogo não aparecem aqui.)</div>
          ) : lista.map((s, i) => {
            const a = analisar(s.tab);
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>🎵</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</div>
                  <div style={{ fontSize: 11.5, color: T.textT, marginTop: 1 }}>
                    {s.nivel} · {a.passos} passos · {a.acordes} acordes · {s.unit} ms/traço
                  </div>
                </div>
                <button onClick={() => editar(s)} title="Editar"
                  style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', color: T.text, flexShrink: 0 }}>
                  ✏️
                </button>
                <button onClick={() => excluir(s)} title="Excluir"
                  style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(192,64,80,0.25)', background: 'rgba(192,64,80,0.05)', cursor: 'pointer', color: '#C04050', flexShrink: 0 }}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OficinaWaveLiraTab;
