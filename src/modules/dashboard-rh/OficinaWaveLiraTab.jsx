// Dashboard RH → Oficina Uniko Wave → aba Lira Estelar. Adiciona músicas
// novas ao modo Lira Estelar do Uniko Wave a partir da TABLATURA em texto
// (o mesmo formato da Columbina Lullaby / NodKrai / I Loved You): cada letra
// é uma tecla (Q W E R T Y U / A S D F G H J / Z X C V B N M), letras coladas
// = acorde (tocar juntas) e "-" ou "_" = pausa. Ver supabase_uniko_wave_lira.sql
// e public/unikowave/lira.js (parseTab).
import { useState, useEffect, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { supabase } from '../../contexts/user';

const TECLAS = 'QWERTYUASDFGHJZXCVBNM';
const NIVEIS = ['Fácil', 'Médio', 'Difícil'];

const slugify = (s) => (s || '')
  .trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'musica';

// Mesma leitura do jogo, só pra mostrar o resumo antes de salvar.
function analisar(texto) {
  const linhas = (texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let passos = 0, acordes = 0;
  const invalidos = new Set();
  linhas.forEach(l => {
    for (const ch of l) if (!TECLAS.includes(ch) && ch !== '-' && ch !== '_') invalidos.add(ch);
    const re = /([A-Z]+)([-_]*)/g; let m;
    while ((m = re.exec(l))) {
      const c = new Set([...m[1]].filter(ch => TECLAS.includes(ch)));
      if (c.size) { passos++; if (c.size > 1) acordes++; }
    }
  });
  return { linhas: linhas.length, passos, acordes, invalidos: [...invalidos] };
}

const OficinaWaveLiraTab = ({ cardBg, adminName }) => {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState('Médio');
  const [unit, setUnit] = useState('105');
  const [tab, setTab] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('uniko_wave_lira_songs').select('*').order('created_at', { ascending: false });
      setLista(data || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const info = useMemo(() => analisar(tab), [tab]);

  const salvar = async () => {
    const n = nome.trim();
    if (!n) { setMsg('⚠️ Dá um nome pra música.'); return; }
    if (!info.passos) { setMsg('⚠️ Cole a tablatura (letras das teclas e traços).'); return; }
    if (info.invalidos.length) { setMsg('⚠️ Caracteres que não são teclas da lira: ' + info.invalidos.join(' ')); return; }
    const u = Math.min(400, Math.max(40, parseInt(unit, 10) || 105));
    setSalvando(true); setMsg('');
    try {
      const id = `${slugify(n)}-${Math.random().toString(36).slice(2, 6)}`;
      const linhas = tab.split(/\r?\n/).map(l => l.trim()).filter(Boolean).join('\n');
      const { error } = await supabase.from('uniko_wave_lira_songs').insert({
        id, nome: n, nivel, unit: u, tab: linhas, created_by: adminName || null,
      });
      if (error) throw error;
      setNome(''); setTab(''); setUnit('105'); setNivel('Médio');
      setMsg('✅ Música adicionada! Aparece na Lira Estelar na próxima vez que o jogo abrir.');
      await carregar();
      setTimeout(() => setMsg(''), 6000);
    } catch (e) { setMsg('⚠️ ' + (e.message || 'Erro ao salvar (o SQL supabase_uniko_wave_lira.sql já foi rodado?)')); }
    setSalvando(false);
  };

  const excluir = async (s) => {
    if (!window.confirm(`Excluir a música "${s.nome}" da Lira Estelar?`)) return;
    try { await supabase.from('uniko_wave_lira_songs').delete().eq('id', s.id); await carregar(); }
    catch (e) { setMsg('⚠️ Erro ao excluir: ' + (e.message || '')); setTimeout(() => setMsg(''), 5000); }
  };

  const inputSt = {
    width: '100%', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`,
    fontFamily: 'var(--font-body)', fontSize: 13, color: T.text, background: T.surface || '#fff', outline: 'none', boxSizing: 'border-box',
  };
  const labelSt = { fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: 18, borderRadius: 13, background: cardBg, border: `1px solid ${T.border}`, boxShadow: T.shM, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                ? <>⚠️ Caracteres inválidos: <b>{info.invalidos.join(' ')}</b></>
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
            {salvando ? 'Salvando…' : '🎵 Adicionar música'}
          </button>
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
