// Uniko FIT — aba "Treinos" (biblioteca por grupo muscular, treino do dia/da semana) e
// "Progressão de carga" (evolução do peso levantado em cada máquina/exercício).
// Tabelas: uniko_fit_treinos_midia (conteúdo curado pelo Admin/Moderador) e
// uniko_fit_cargas (privada por pessoa) — ver supabase_uniko_fit_treinos.sql.
import { useState, useEffect, useMemo, useCallback } from 'react';

/* ═══════════════ Dados fixos: grupos, sugestões de exercícios e divisão da semana ═══════════════ */
export const GRUPOS = [
  { id: 'peito', label: 'Peito', exercicios: [['Supino reto', '4 x 8–10'], ['Supino inclinado com halteres', '3 x 10'], ['Crucifixo / Peck deck', '3 x 12'], ['Crossover na polia', '3 x 12'], ['Flexão de braço', '3 x até a falha']] },
  { id: 'costas', label: 'Costas', exercicios: [['Puxada na frente', '4 x 10'], ['Remada curvada', '4 x 10'], ['Remada baixa', '3 x 12'], ['Pulldown na polia', '3 x 12'], ['Barra fixa', '3 x até a falha']] },
  { id: 'posteriores', label: 'Posteriores', exercicios: [['Mesa flexora', '4 x 10'], ['Stiff', '4 x 10'], ['Cadeira flexora', '3 x 12'], ['Levantamento terra romeno', '3 x 10']] },
  { id: 'quadriceps', label: 'Quadríceps', exercicios: [['Agachamento livre', '4 x 8–10'], ['Leg press 45°', '4 x 12'], ['Cadeira extensora', '3 x 12'], ['Afundo / passada', '3 x 12 por perna'], ['Hack squat', '3 x 10']] },
  { id: 'gluteos', label: 'Glúteos', exercicios: [['Elevação pélvica', '4 x 10'], ['Agachamento sumô', '3 x 12'], ['Cadeira abdutora', '3 x 15'], ['Coice na polia', '3 x 12 por perna']] },
  { id: 'ombros', label: 'Ombros', exercicios: [['Desenvolvimento com halteres', '4 x 10'], ['Elevação lateral', '4 x 12'], ['Elevação frontal', '3 x 12'], ['Crucifixo inverso', '3 x 12'], ['Encolhimento', '3 x 12']] },
  { id: 'biceps', label: 'Bíceps', exercicios: [['Rosca direta', '4 x 10'], ['Rosca alternada', '3 x 12'], ['Rosca martelo', '3 x 12'], ['Rosca scott', '3 x 10']] },
  { id: 'triceps', label: 'Tríceps', exercicios: [['Tríceps na polia (pulley)', '4 x 12'], ['Tríceps testa', '3 x 10'], ['Tríceps francês', '3 x 12'], ['Mergulho no banco', '3 x 12']] },
  { id: 'abdomen', label: 'Abdômen', exercicios: [['Abdominal supra', '4 x 20'], ['Prancha', '3 x 45 s'], ['Elevação de pernas', '3 x 15'], ['Abdominal bicicleta', '3 x 20']] },
  { id: 'panturrilha', label: 'Panturrilha', exercicios: [['Panturrilha em pé', '4 x 15'], ['Panturrilha sentado', '4 x 15'], ['Panturrilha no leg press', '3 x 20']] },
  { id: 'cardio', label: 'Cardio', exercicios: [['Esteira', '20–30 min'], ['Bicicleta', '20–30 min'], ['Elíptico', '20 min'], ['HIIT (30 s forte / 30 s leve)', '15 min']] },
];
const GRUPO_POR_ID = Object.fromEntries(GRUPOS.map(g => [g.id, g]));

// Mais opções de máquina/exercício por grupo (além das sugestões fixas) pra montar o treino personalizado
const EXTRAS = {
  peito: ['Supino máquina', 'Supino declinado', 'Voador (peck deck)', 'Crucifixo com halteres', 'Pullover', 'Paralelas (mergulho)'],
  costas: ['Remada cavalinho', 'Serrote (remada unilateral)', 'Puxada com triângulo', 'Remada na máquina', 'Levantamento terra'],
  posteriores: ['Flexora em pé', 'Flexora deitada', 'Bom dia (good morning)', 'Elevação pélvica unilateral'],
  quadriceps: ['Agachamento no smith', 'Agachamento búlgaro', 'Leg press horizontal', 'Passada no smith'],
  gluteos: ['Glúteo na máquina', 'Elevação pélvica na máquina', 'Agachamento búlgaro', 'Passada longa'],
  ombros: ['Desenvolvimento na máquina', 'Arnold press', 'Elevação lateral na polia', 'Remada alta'],
  biceps: ['Rosca na polia', 'Rosca concentrada', 'Rosca inversa'],
  triceps: ['Tríceps corda', 'Tríceps coice', 'Supino fechado', 'Tríceps na máquina'],
  abdomen: ['Abdominal na máquina', 'Abdominal remador', 'Roda abdominal', 'Elevação de joelhos'],
  panturrilha: ['Panturrilha no smith', 'Panturrilha na máquina (burrinho)'],
  cardio: ['Remo ergométrico', 'Escada (stair)', 'Pular corda', 'Caminhada inclinada'],
};
const opcoesDoGrupo = (id) => [...new Set([...(GRUPO_POR_ID[id]?.exercicios || []).map(e => e[0]), ...(EXTRAS[id] || [])])];
const serieDe = (gid, nome) => (GRUPO_POR_ID[gid]?.exercicios.find(e => e[0] === nome) || [])[1] || '';
const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Coleção pronta (somente leitura) — a pessoa pode copiar pra "Meus treinos" ou aplicar num dia
export const PRESETS = [
  { id: 'p-fullbody', nome: 'Full body (corpo inteiro)', grupos: [{ grupo: 'peito', exercicios: ['Supino reto'] }, { grupo: 'costas', exercicios: ['Puxada na frente'] }, { grupo: 'quadriceps', exercicios: ['Leg press 45°'] }, { grupo: 'ombros', exercicios: ['Elevação lateral'] }, { grupo: 'abdomen', exercicios: ['Prancha'] }] },
  { id: 'p-push', nome: 'Empurrar (peito, ombro e tríceps)', grupos: [{ grupo: 'peito', exercicios: ['Supino reto', 'Supino inclinado com halteres', 'Crossover na polia'] }, { grupo: 'ombros', exercicios: ['Desenvolvimento com halteres', 'Elevação lateral'] }, { grupo: 'triceps', exercicios: ['Tríceps na polia (pulley)', 'Tríceps testa'] }] },
  { id: 'p-pull', nome: 'Puxar (costas e bíceps)', grupos: [{ grupo: 'costas', exercicios: ['Puxada na frente', 'Remada curvada', 'Remada baixa'] }, { grupo: 'biceps', exercicios: ['Rosca direta', 'Rosca martelo'] }, { grupo: 'ombros', exercicios: ['Crucifixo inverso'] }] },
  { id: 'p-pernas', nome: 'Pernas completo', grupos: [{ grupo: 'quadriceps', exercicios: ['Agachamento livre', 'Leg press 45°', 'Cadeira extensora'] }, { grupo: 'posteriores', exercicios: ['Mesa flexora', 'Stiff'] }, { grupo: 'gluteos', exercicios: ['Elevação pélvica'] }, { grupo: 'panturrilha', exercicios: ['Panturrilha em pé'] }] },
  { id: 'p-gluteos', nome: 'Glúteos e posteriores', grupos: [{ grupo: 'gluteos', exercicios: ['Elevação pélvica', 'Agachamento sumô', 'Cadeira abdutora', 'Coice na polia'] }, { grupo: 'posteriores', exercicios: ['Mesa flexora', 'Stiff'] }] },
  { id: 'p-superiores', nome: 'Superiores (peito, costas e braços)', grupos: [{ grupo: 'peito', exercicios: ['Supino reto', 'Crucifixo / Peck deck'] }, { grupo: 'costas', exercicios: ['Puxada na frente', 'Remada baixa'] }, { grupo: 'biceps', exercicios: ['Rosca direta'] }, { grupo: 'triceps', exercicios: ['Tríceps na polia (pulley)'] }] },
  { id: 'p-cardio-abd', nome: 'Cardio + abdômen', grupos: [{ grupo: 'cardio', exercicios: ['Esteira', 'Bicicleta'] }, { grupo: 'abdomen', exercicios: ['Abdominal supra', 'Prancha', 'Elevação de pernas'] }] },
];
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda → domingo
const NOMES_DIA = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

const IcoHalter = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="4" height="8" rx="1.3" /><rect x="18" y="8" width="4" height="8" rx="1.3" /><line x1="6" y1="12" x2="18" y2="12" /></svg>;
const IcoPlay = <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20" /></svg>;
const IcoVoltar = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
const IcoLixo = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>;

/* ═══════════════ Reconhecer o link colado (YouTube / TikTok / imagem / vídeo) ═══════════════ */
export const analisarLink = (urlBruta) => {
  const url = (urlBruta || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return { tipo: 'youtube', id: yt[1], vertical: /\/shorts\//i.test(url), url };
  const tk = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i);
  if (tk) return { tipo: 'tiktok', id: tk[1], vertical: true, url };
  if (/\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url)) return { tipo: 'imagem', url };
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) return { tipo: 'video', url };
  return { tipo: 'link', url };
};

/* Cada mídia só carrega o player quando a pessoa toca (nada de dezenas de iframes de uma vez). */
const MidiaCard = ({ m, T, ENERGIA, FOGO, podeCurar, onApagar }) => {
  const info = useMemo(() => analisarLink(m.url), [m.url]);
  const [tocando, setTocando] = useState(false);
  if (!info) return null;
  const caixa = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' };
  return (
    <div style={caixa}>
      {info.tipo === 'imagem' && <img src={info.url} alt={m.titulo || ''} loading="lazy" decoding="async" style={{ width: '100%', display: 'block', maxHeight: 460, objectFit: 'cover', background: '#111' }} />}
      {info.tipo === 'video' && <video src={info.url} controls preload="none" playsInline style={{ width: '100%', display: 'block', maxHeight: 460, background: '#000' }} />}
      {(info.tipo === 'youtube' || info.tipo === 'tiktok') && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: info.vertical ? '9 / 16' : '16 / 9', maxHeight: info.vertical ? 560 : 'none', margin: '0 auto', background: '#000' }}>
          {tocando ? (
            <iframe title={m.titulo || 'Vídeo'} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
              src={info.tipo === 'youtube' ? `https://www.youtube-nocookie.com/embed/${info.id}?autoplay=1&rel=0` : `https://www.tiktok.com/embed/v2/${info.id}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
          ) : (
            <button onClick={() => setTocando(true)} className="fit-btn" aria-label="Tocar vídeo"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', color: '#fff',
                background: info.tipo === 'youtube' ? `#000 url(https://img.youtube.com/vi/${info.id}/hqdefault.jpg) center/cover` : `linear-gradient(135deg, #111, ${ENERGIA})` }}>
              <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 60, height: 60, borderRadius: '50%', background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IcoPlay}</span>
              <span style={{ position: 'absolute', left: 10, top: 10, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,0,.6)' }}>{info.tipo === 'youtube' ? 'YouTube' : 'TikTok'}</span>
            </button>
          )}
        </div>
      )}
      {info.tipo === 'link' && (
        <a href={info.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '16px 14px', color: ENERGIA, fontWeight: 800, fontSize: 13, textDecoration: 'none', wordBreak: 'break-all' }}>Abrir link ↗</a>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{m.titulo || 'Sem título'}</div>
        {(info.tipo === 'youtube' || info.tipo === 'tiktok') && (
          <a href={info.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: T.textT, textDecoration: 'none', flexShrink: 0 }}>Abrir ↗</a>
        )}
        {podeCurar && (
          <button onClick={() => onApagar(m)} title="Remover" className="fit-btn" style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textD, display: 'flex', padding: 4 }}>{IcoLixo}</button>
        )}
      </div>
    </div>
  );
};

/* ═══════════════ Editor: montar o treino de um dia, em 3 passos ═══════════════ */
const EditorTreino = ({ T, ENERGIA, FOGO, EG, titulo, passoTexto, textoSalvar, textoDescanso, inicial, colecao, onSalvar, onSalvarNaColecao, onDescanso, onCancelar }) => {
  const [nome, setNome] = useState(inicial?.nome || '');
  const [sel, setSel] = useState(() => { const m = {}; (inicial?.grupos || []).forEach(g => { m[g.grupo] = [...g.exercicios]; }); return m; }); // grupoId -> [exercícios escolhidos]
  const [custom, setCustom] = useState({});
  const [erro, setErro] = useState('');
  const campo = { padding: '12px 13px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 14.5, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' };
  const caixa = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16 };
  const total = Object.values(sel).reduce((n, l) => n + l.length, 0);

  const alternarGrupo = (id) => setSel(s0 => { const n = { ...s0 }; if (n[id]) delete n[id]; else n[id] = []; return n; });
  const alternarEx = (gid, ex) => setSel(s0 => { const l = s0[gid] || []; return { ...s0, [gid]: l.includes(ex) ? l.filter(x => x !== ex) : [...l, ex] }; });
  const marcarTodas = (gid, opcoes) => setSel(s0 => ({ ...s0, [gid]: [...opcoes] }));
  const limpar = (gid) => setSel(s0 => ({ ...s0, [gid]: [] }));
  const adicionarCustom = (gid) => {
    const t = (custom[gid] || '').trim().replace(/\s+/g, ' ');
    if (!t) return;
    setSel(s0 => { const l = s0[gid] || []; return l.some(x => x.toLowerCase() === t.toLowerCase()) ? s0 : { ...s0, [gid]: [...l, t] }; });
    setCustom(c => ({ ...c, [gid]: '' }));
  };
  const carregarDe = (id) => {
    const t = [...colecao, ...PRESETS].find(x => x.id === id);
    if (!t) return;
    const m = {}; t.grupos.forEach(g => { m[g.grupo] = [...g.exercicios]; });
    setSel(m); if (!nome.trim()) setNome(t.nome || '');
  };
  const montar = () => ({ id: inicial?.id || novoId(), nome: nome.trim(), grupos: GRUPOS.filter(g => sel[g.id]).map(g => ({ grupo: g.id, exercicios: sel[g.id] })) });
  const validar = () => {
    if (!Object.keys(sel).length) { setErro('Escolha pelo menos um músculo no passo 1.'); return false; }
    if (!total) { setErro('Marque pelo menos uma máquina ou exercício no passo 2.'); return false; }
    setErro(''); return true;
  };
  const Passo = ({ n, children, sub }) => (
    <div style={{ margin: '20px 2px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: ENERGIA, color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
        <span style={{ fontFamily: 'var(--font-brand)', fontSize: 16.5, fontWeight: 800, color: T.text }}>{children}</span>
      </div>
      {sub && <div style={{ fontSize: 12.5, color: T.textT, margin: '4px 0 0 36px' }}>{sub}</div>}
    </div>
  );

  return (
    <div data-noswipe style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="fit-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onCancelar} className="fit-btn" aria-label="Voltar" style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IcoVoltar}</button>
          <div>
            {passoTexto && <div style={{ fontSize: 12, fontWeight: 800, color: ENERGIA, letterSpacing: .2 }}>{passoTexto}</div>}
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text }}>{titulo}</div>
          </div>
        </div>

        <div style={{ ...caixa, padding: '10px 12px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: T.textS, flex: '1 1 150px' }}>Quer ganhar tempo? Comece de um treino pronto:</span>
          <select value="" onChange={e => { if (e.target.value) carregarDe(e.target.value); }} style={{ ...campo, padding: '9px 10px', fontSize: 13, flex: '1 1 170px', minWidth: 0, cursor: 'pointer' }}>
            <option value="">Escolher treino…</option>
            {colecao.length > 0 && <optgroup label="Meus treinos">{colecao.map(t => <option key={t.id} value={t.id}>{t.nome || 'Sem nome'}</option>)}</optgroup>}
            <optgroup label="Sugestões prontas">{PRESETS.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</optgroup>
          </select>
        </div>

        <Passo n="1" sub="Toque para marcar. Pode escolher mais de um.">Quais músculos você vai treinar?</Passo>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 8 }}>
          {GRUPOS.map(g => {
            const on = !!sel[g.id];
            return (
              <button key={g.id} onClick={() => alternarGrupo(g.id)} className="fit-btn"
                style={{ minHeight: 46, padding: '8px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 13.5, fontWeight: 800, border: `2px solid ${on ? ENERGIA : T.border}`, background: on ? ENERGIA : T.surface, color: on ? '#fff' : T.text }}>
                {on ? '✓ ' : ''}{g.label}
              </button>
            );
          })}
        </div>

        {Object.keys(sel).length > 0 && <Passo n="2" sub="Toque na máquina para marcar. Não achou a sua? Escreva o nome no campo e toque em Adicionar.">Escolha as máquinas e exercícios</Passo>}
        {GRUPOS.filter(g => sel[g.id]).map(g => {
          const marcados = sel[g.id];
          const opcoes = [...new Set([...opcoesDoGrupo(g.id), ...marcados])];
          return (
            <div key={g.id} style={{ ...caixa, padding: '12px 12px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: ENERGIA }}>{g.label}</span>
                <span style={{ fontSize: 12, color: T.textT }}>{marcados.length} marcada{marcados.length !== 1 ? 's' : ''}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => marcarTodas(g.id, opcoes)} className="fit-btn" style={{ border: 'none', background: 'none', color: ENERGIA, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '4px 6px' }}>Marcar todas</button>
                <button onClick={() => limpar(g.id)} className="fit-btn" style={{ border: 'none', background: 'none', color: T.textT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '4px 6px' }}>Limpar</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {opcoes.map(ex => {
                  const on = marcados.includes(ex);
                  return (
                    <button key={ex} onClick={() => alternarEx(g.id, ex)} className="fit-btn"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 46, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                        border: `1.5px solid ${on ? ENERGIA : T.border}`, background: on ? `${ENERGIA}14` : T.page }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? ENERGIA : 'transparent', border: `2px solid ${on ? ENERGIA : T.textD}`, color: '#fff', fontSize: 14, fontWeight: 800 }}>{on ? '✓' : ''}</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: on ? 800 : 600, color: T.text }}>{ex}</span>
                      {serieDe(g.id, ex) && <span style={{ fontSize: 11.5, color: T.textT, whiteSpace: 'nowrap' }}>{serieDe(g.id, ex)}</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: `1.5px dashed ${ENERGIA}`, background: `${ENERGIA}0D` }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: ENERGIA, marginBottom: 7 }}>+ Minha máquina / exercício (escrever)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={custom[g.id] || ''} onChange={e => setCustom(c => ({ ...c, [g.id]: e.target.value }))} placeholder="Ex: Remada articulada" onKeyDown={e => { if (e.key === 'Enter') adicionarCustom(g.id); }} style={{ ...campo, flex: 1, minWidth: 0 }} />
                  <button onClick={() => adicionarCustom(g.id)} className="fit-btn" style={{ padding: '0 18px', borderRadius: 12, border: 'none', background: ENERGIA, color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Adicionar</button>
                </div>
              </div>
            </div>
          );
        })}

        <Passo n={Object.keys(sel).length > 0 ? '3' : '2'} sub="Só se quiser. Ajuda a achar o treino depois na coleção.">Dê um nome (opcional)</Passo>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Treino A — Peito e tríceps" style={{ ...campo, width: '100%' }} />
        {erro && <div style={{ color: '#DC3232', fontSize: 13, fontWeight: 700, margin: '12px 2px 0' }}>{erro}</div>}
      </div>

      {/* barra de ações sempre visível */}
      <div style={{ padding: '10px 14px 12px', borderTop: `1px solid ${T.border}`, background: T.surface }}>
        <button onClick={() => { if (validar()) onSalvar(montar()); }} className="fit-btn"
          style={{ width: '100%', minHeight: 50, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, color: '#fff', fontWeight: 800, fontSize: 15.5, cursor: 'pointer', boxShadow: `0 6px 18px ${EG}` }}>
          {textoSalvar || 'Salvar treino'}{total ? ` · ${total} exercício${total !== 1 ? 's' : ''}` : ''}
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {onSalvarNaColecao && (
            <button onClick={() => { if (!validar()) return; if (!nome.trim()) { setErro('Dê um nome ao treino (passo 3) para guardar na coleção.'); return; } onSalvarNaColecao(montar()); }} className="fit-btn"
              style={{ flex: 1, minHeight: 42, borderRadius: 12, border: `1.5px solid ${ENERGIA}`, background: 'transparent', color: ENERGIA, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Salvar e guardar na coleção</button>
          )}
          {onDescanso && (
            <button onClick={onDescanso} className="fit-btn" style={{ flex: 1, minHeight: 42, borderRadius: 12, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textS, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{textoDescanso || 'Marcar como descanso'}</button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════ Cartão de treino da coleção ═══════════════ */
const CartaoTreino = ({ t, pronto, T, ENERGIA, onEditar, onExcluir, onCopiar, onUsarNoDia }) => {
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState('');
  const total = t.grupos.reduce((n, g) => n + g.exercicios.length, 0);
  const btn = { minHeight: 40, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textS, fontWeight: 700, fontSize: 13, cursor: 'pointer' };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '14px' }}>
      <button onClick={() => setAberto(a => !a)} className="fit-btn" style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.text }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800 }}>{t.nome || 'Sem nome'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 4px' }}>
          {t.grupos.map(g => <span key={g.grupo} style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: `${ENERGIA}1F`, color: ENERGIA }}>{GRUPO_POR_ID[g.grupo]?.label || g.grupo}</span>)}
        </div>
        <div style={{ fontSize: 12.5, color: T.textT }}>{total} exercício{total !== 1 ? 's' : ''} · {aberto ? 'Toque para fechar' : 'Toque para ver os exercícios'}</div>
      </button>
      {aberto && (
        <div style={{ marginTop: 10 }}>
          {t.grupos.map(g => (
            <div key={g.grupo} style={{ padding: '8px 0', borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: ENERGIA, marginBottom: 4 }}>{GRUPO_POR_ID[g.grupo]?.label}</div>
              {g.exercicios.length ? g.exercicios.map(ex => (
                <div key={ex} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: T.text, padding: '3px 0' }}>
                  <span style={{ flex: 1 }}>{ex}</span><span style={{ fontSize: 12, color: T.textT }}>{serieDe(g.grupo, ex)}</span>
                </div>
              )) : <div style={{ fontSize: 12.5, color: T.textT }}>Nenhuma máquina escolhida.</div>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        <select value={dia} onChange={e => { if (e.target.value !== '') { onUsarNoDia(t, Number(e.target.value)); setDia(''); } }}
          style={{ ...btn, padding: '0 10px', background: ENERGIA, color: '#fff', border: 'none', fontWeight: 800 }}>
          <option value="">Usar em um dia…</option>
          {[1, 2, 3, 4, 5, 6, 0].map(i => <option key={i} value={i} style={{ color: '#111' }}>{NOMES_DIA[i]}</option>)}
        </select>
        {pronto
          ? <button onClick={() => onCopiar(t)} className="fit-btn" style={{ ...btn, color: ENERGIA, borderColor: ENERGIA }}>Copiar para meus treinos</button>
          : <>
              <button onClick={() => onEditar(t)} className="fit-btn" style={btn}>Editar</button>
              <button onClick={() => onExcluir(t)} className="fit-btn" style={{ ...btn, color: '#DC3232' }}>Excluir</button>
            </>}
      </div>
    </div>
  );
};

/* ═══════════════ Aba Treinos ═══════════════
   Quatro abas simples:  Hoje · Semana · Coleção · Exercícios                                   */
export const TreinosTab = ({ T, ENERGIA, FOGO, EG, supabase, podeCurar, onAbrirCargas, desk, name }) => {
  const [aba, setAba] = useState('hoje');          // hoje | semana | colecao | exercicios
  const [sub, setSub] = useState(null);            // null | { tipo:'grupo', id } | { tipo:'dia', dia }
  const [editando, setEditando] = useState(null);  // { tipo:'dia', dia } | { tipo:'colecao', id|null }
  const [fluxo, setFluxo] = useState(null);        // assistente "montar a semana inteira": { pos: 0..6 } ou null

  /* Meu plano: treino de cada dia da semana + coleção de treinos salvos (privado, 1 documento por pessoa) */
  const chavePlano = `uniko_fit_plano_${name}`;
  const [plano, setPlano] = useState(null); // { dias:{ '0'..'6': treino | {descanso:true} }, colecao:[treino] }
  const [planoLocal, setPlanoLocal] = useState(false);
  const planoVazio = { dias: {}, colecao: [] };
  const lerPlanoLocal = () => { try { return JSON.parse(localStorage.getItem(chavePlano) || 'null') || planoVazio; } catch { return planoVazio; } };
  const carregarPlano = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_fit_plano').select('dados').eq('player', name).maybeSingle();
    if (error) { setPlanoLocal(true); setPlano(lerPlanoLocal()); return; }
    const d = data?.dados && typeof data.dados === 'object' ? { dias: data.dados.dias || {}, colecao: data.dados.colecao || [] } : planoVazio;
    setPlanoLocal(false); setPlano(d);
    try { localStorage.setItem(chavePlano, JSON.stringify(d)); } catch { /* sem armazenamento */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, name]);
  useEffect(() => { carregarPlano(); }, [carregarPlano]);
  const P = plano || planoVazio;
  const colecao = P.colecao;
  const salvarPlano = async (novo) => {
    setPlano(novo);
    try { localStorage.setItem(chavePlano, JSON.stringify(novo)); } catch { /* sem armazenamento */ }
    if (!planoLocal) {
      const { error } = await supabase.from('uniko_fit_plano').upsert({ player: name, dados: novo, updated_at: new Date().toISOString() }, { onConflict: 'player' });
      if (error) setPlanoLocal(true);
    }
  };
  // treino de um dia: undefined = ainda sem treino · null = descanso marcado · objeto = treino montado pela pessoa
  const treinoDoDia = (i) => {
    const t = P.dias[i];
    if (!t) return undefined;
    return t.descanso ? null : { ...t, personalizado: true };
  };
  const resumoDoDia = (t) => t === undefined ? 'Sem treino ainda' : t ? (t.nome || t.grupos.map(g => GRUPO_POR_ID[g.grupo].label).join(' + ')) : 'Descanso';
  const semNenhumTreino = Object.keys(P.dias).length === 0;
  const idxHoje = new Date().getDay();

  /* Marcar exercícios feitos hoje (só neste aparelho) */
  const chaveFeitos = `uniko_fit_feitos_${name}_${new Date().toISOString().slice(0, 10)}`;
  const [feitos, setFeitos] = useState(() => { try { return JSON.parse(localStorage.getItem(chaveFeitos) || '[]'); } catch { return []; } });
  const alternarFeito = (k) => setFeitos(f => {
    const n = f.includes(k) ? f.filter(x => x !== k) : [...f, k];
    try { localStorage.setItem(chaveFeitos, JSON.stringify(n)); } catch { /* sem armazenamento */ }
    return n;
  });

  /* Biblioteca de vídeos/fotos por grupo (curada por Admin/Moderador) */
  const [midias, setMidias] = useState(null);
  const [semTabela, setSemTabela] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [link, setLink] = useState('');
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_fit_treinos_midia').select('id,grupo,titulo,url,created_at')
      .order('created_at', { ascending: false }).limit(500);
    if (error) { setSemTabela(true); setMidias([]); return; }
    setSemTabela(false); setMidias(data || []);
  }, [supabase]);
  useEffect(() => { carregar(); }, [carregar]);
  const adicionar = async (grupo) => {
    const info = analisarLink(link);
    if (!info) { setErro('Cole um link completo (começando com https://).'); return; }
    if (info.tipo === 'link' && /tiktok\.com|youtu/i.test(link)) { setErro('Não consegui reconhecer esse link. Use o link completo do vídeo (TikTok: tiktok.com/@usuario/video/123…; YouTube: youtube.com/watch?v=… ou youtu.be/…).'); return; }
    setErro('');
    const { error } = await supabase.from('uniko_fit_treinos_midia').insert({ grupo, titulo: titulo.trim() || null, url: link.trim(), tipo: info.tipo });
    if (error) { setErro('Não foi possível salvar (só Admin/Moderador, e o SQL precisa ter sido rodado).'); return; }
    setTitulo(''); setLink(''); carregar();
  };
  const apagar = async (m) => {
    if (!window.confirm('Remover esse conteúdo?')) return;
    await supabase.from('uniko_fit_treinos_midia').delete().eq('id', m.id);
    carregar();
  };

  const campo = { padding: '11px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box', width: '100%' };
  const caixa = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16 };
  const MOLDURA = { flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 14px 28px' };
  const avisoLocal = planoLocal && (
    <div style={{ fontSize: 12, color: T.textS, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 10, padding: '8px 11px', marginBottom: 12 }}>
      Salvando só neste aparelho por enquanto (o banco ainda não foi preparado).
    </div>
  );

  const iniciarSemana = () => { setFluxo({ pos: 0 }); setEditando({ tipo: 'dia', dia: ORDEM_SEMANA[0] }); };
  const cartaoCargas = (
    <button onClick={() => onAbrirCargas('')} className="fit-btn" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 16, cursor: 'pointer', border: `1.5px solid ${ENERGIA}`, background: `${ENERGIA}10`, color: T.text, marginTop: 14 }}>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15.5, fontWeight: 800, color: ENERGIA }}>Progressão de carga</div>
      <div style={{ fontSize: 13, color: T.textS, marginTop: 3 }}>Anote quanto de peso usou em cada máquina e veja sua evolução.</div>
    </button>
  );
  /* Quem ainda não montou nada vê isto (em Hoje e Semana) em vez de um treino pronto */
  const VazioCriar = () => (
    <div style={{ ...caixa, padding: '30px 18px 22px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: `0 8px 22px ${EG}` }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="4" height="8" rx="1.3" /><rect x="18" y="8" width="4" height="8" rx="1.3" /><line x1="6" y1="12" x2="18" y2="12" /></svg>
      </div>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 8 }}>Você ainda não tem nenhum treino</div>
      <div style={{ fontSize: 14, color: T.textS, lineHeight: 1.55, marginBottom: 20 }}>Crie um para hoje ou para a semana inteira. Eu te ajudo passo a passo: você escolhe o músculo e as máquinas, e o treino fica salvo aqui.</div>
      <button onClick={() => setEditando({ tipo: 'dia', dia: idxHoje })} className="fit-btn"
        style={{ width: '100%', minHeight: 52, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, color: '#fff', fontWeight: 800, fontSize: 15.5, cursor: 'pointer', boxShadow: `0 6px 18px ${EG}` }}>Criar treino de hoje ({NOMES_DIA[idxHoje]})</button>
      <button onClick={iniciarSemana} className="fit-btn"
        style={{ width: '100%', minHeight: 52, marginTop: 10, borderRadius: 14, border: `2px solid ${ENERGIA}`, background: 'transparent', color: ENERGIA, fontWeight: 800, fontSize: 15.5, cursor: 'pointer' }}>Montar a semana inteira</button>
      <button onClick={() => { setAba('colecao'); setSub(null); }} className="fit-btn"
        style={{ marginTop: 14, border: 'none', background: 'none', color: T.textS, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Prefiro começar de um treino pronto</button>
    </div>
  );

  /* ── pedaços de tela (chamados como função, não como componente, pra não remontar) ── */
  const Voltar = (rot, aoVoltar) => (
    <button onClick={aoVoltar} className="fit-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px 0 10px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', marginBottom: 14 }}>{IcoVoltar} {rot}</button>
  );

  const AbasTopo = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '12px 14px 0' }}>
      {[['hoje', 'Hoje'], ['semana', 'Semana'], ['colecao', 'Coleção'], ['exercicios', 'Exercícios']].map(([id, rot]) => {
        const on = aba === id;
        return (
          <button key={id} onClick={() => { setAba(id); setSub(null); setErro(''); }} className="fit-btn"
            style={{ minHeight: 44, borderRadius: 12, border: `1.5px solid ${on ? ENERGIA : T.border}`, background: on ? ENERGIA : T.surface, color: on ? '#fff' : T.text, fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>{rot}</button>
        );
      })}
    </div>
  );

  const Exercicios = ({ grupo, itens }) => (
    <div style={{ ...caixa, padding: '10px 14px', marginBottom: 12 }}>
      {(itens || grupo.exercicios).map(([nome, serie], i) => (
        <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `${ENERGIA}22`, color: ENERGIA, fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.text }}>{nome}</div>
          <div style={{ fontSize: 12.5, color: T.textT, whiteSpace: 'nowrap' }}>{serie}</div>
        </div>
      ))}
    </div>
  );

  const Buscas = (grupo) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      {[['YouTube', `https://www.youtube.com/results?search_query=${encodeURIComponent(`treino de ${grupo.label.toLowerCase()}`)}`], ['TikTok', `https://www.tiktok.com/search?q=${encodeURIComponent(`treino de ${grupo.label.toLowerCase()}`)}`]].map(([rot, href]) => (
        <a key={rot} href={href} target="_blank" rel="noopener noreferrer"
          style={{ padding: '10px 16px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.surface, color: T.textS, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Buscar no {rot} ↗</a>
      ))}
    </div>
  );

  const Midias = (grupo) => {
    const lista = (midias || []).filter(m => m.grupo === grupo.id);
    if (midias === null) return <div style={{ textAlign: 'center', padding: 24, color: T.textT, fontSize: 13 }}>Carregando...</div>;
    if (!lista.length) return (
      <div style={{ ...caixa, padding: '22px 16px', textAlign: 'center', color: T.textT, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
        {semTabela ? 'A biblioteca de vídeos ainda não foi preparada (falta rodar o SQL).' : `Ainda não há vídeos ou fotos de ${grupo.label.toLowerCase()} por aqui.${podeCurar ? ' Adicione o primeiro abaixo.' : ' Em breve!'}`}
      </div>
    );
    return <div style={{ display: 'grid', gridTemplateColumns: desk ? 'repeat(2, 1fr)' : '1fr', gap: 12, marginBottom: 14, alignItems: 'start' }}>
      {lista.map(m => <MidiaCard key={m.id} m={m} T={T} ENERGIA={ENERGIA} FOGO={FOGO} podeCurar={podeCurar} onApagar={apagar} />)}
    </div>;
  };

  const FormAdicionar = (grupo) => !podeCurar ? null : (
    <div style={{ ...caixa, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, marginBottom: 10 }}>Adicionar vídeo ou foto em {grupo.label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título (ex: Supino reto — execução correta)" style={campo} />
        <input value={link} onChange={e => setLink(e.target.value)} placeholder="Link do YouTube, TikTok, foto ou vídeo (https://…)" style={campo} />
        <button onClick={() => adicionar(grupo.id)} className="fit-btn" style={{ minHeight: 44, borderRadius: 10, border: 'none', background: ENERGIA, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Adicionar</button>
        {erro && <div style={{ color: '#DC3232', fontSize: 12.5 }}>{erro}</div>}
      </div>
    </div>
  );

  /* Detalhe de um dia (aba Hoje ou ao tocar num dia da Semana) */
  const DiaDetalhe = (dia) => {
    const t = treinoDoDia(dia);
    const ehHoje = dia === idxHoje;
    const chaves = t ? t.grupos.flatMap(g => g.exercicios.map(ex => `${g.grupo}|${ex}`)) : [];
    const feitosHoje = chaves.filter(k => feitos.includes(k)).length;
    const pct = chaves.length ? Math.round((feitosHoje / chaves.length) * 100) : 0;
    if (t === undefined) return (
      <div style={{ ...caixa, padding: '26px 18px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 6 }}>{ehHoje ? 'Hoje ainda não tem treino' : `${NOMES_DIA[dia]} ainda não tem treino`}</div>
        <div style={{ fontSize: 13.5, color: T.textS, lineHeight: 1.55, marginBottom: 16 }}>Escolha os músculos e as máquinas que você vai usar {ehHoje ? 'hoje' : `na ${NOMES_DIA[dia].toLowerCase()}`}.</div>
        <button onClick={() => setEditando({ tipo: 'dia', dia })} className="fit-btn"
          style={{ minHeight: 48, padding: '0 22px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 6px 18px ${EG}` }}>Criar treino de {ehHoje ? 'hoje' : NOMES_DIA[dia]}</button>
      </div>
    );
    return (
      <>
        <div style={{ borderRadius: 18, padding: '16px 16px 14px', marginBottom: 14, color: '#fff', background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: `0 8px 22px ${EG}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .9 }}>{ehHoje ? 'HOJE' : 'TREINO DE'} · {NOMES_DIA[dia].toUpperCase()}</div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, margin: '3px 0 2px' }}>{resumoDoDia(t)}</div>
          {t && <div style={{ fontSize: 13, opacity: .95 }}>{chaves.length} exercício{chaves.length !== 1 ? 's' : ''}{t.personalizado ? ' · montado por você' : ' · sugestão do Uniko'}</div>}
          {t && ehHoje && chaves.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}><span>{feitosHoje} de {chaves.length} feitos</span><span>{pct}%</span></div>
              <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.3)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#fff', transition: 'width .3s' }} /></div>
            </div>
          )}
          <button onClick={() => setEditando({ tipo: 'dia', dia })} className="fit-btn" style={{ marginTop: 14, minHeight: 42, padding: '0 18px', borderRadius: 12, border: '2px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.16)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>
            {t ? 'Mudar grupos e máquinas' : 'Montar um treino para este dia'}
          </button>
        </div>

        {!t ? (
          <div style={{ ...caixa, padding: '24px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 6 }}>Dia de descanso</div>
            <div style={{ fontSize: 13.5, color: T.textT, lineHeight: 1.55 }}>O músculo cresce enquanto você descansa. Hidrate-se e durma bem. Se quiser treinar mesmo assim, toque em “Montar um treino”.</div>
          </div>
        ) : t.grupos.map(gi => {
          const g = GRUPO_POR_ID[gi.grupo];
          return (
            <div key={gi.grupo} style={{ ...caixa, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-brand)', fontSize: 16.5, fontWeight: 800, color: ENERGIA, flex: 1 }}>{g.label}</span>
                <button onClick={() => { setAba('exercicios'); setSub({ tipo: 'grupo', id: g.id }); }} className="fit-btn" style={{ border: 'none', background: 'none', color: T.textS, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '6px 4px' }}>Vídeos e dicas ›</button>
              </div>
              {!gi.exercicios.length && <div style={{ fontSize: 13, color: T.textT, padding: '6px 0 4px' }}>Nenhuma máquina escolhida. Toque em “Mudar grupos e máquinas”.</div>}
              {gi.exercicios.map((ex, i) => {
                const k = `${gi.grupo}|${ex}`; const ok = feitos.includes(k);
                return (
                  <div key={ex} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, borderTop: `1px solid ${T.border}` }}>
                    {ehHoje ? (
                      <button onClick={() => alternarFeito(k)} className="fit-btn" aria-label={ok ? 'Desmarcar' : 'Marcar como feito'}
                        style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', border: `2px solid ${ok ? '#16a34a' : T.textD}`, background: ok ? '#16a34a' : 'transparent', color: '#fff', fontSize: 15, fontWeight: 800 }}>{ok ? '✓' : ''}</button>
                    ) : (
                      <span style={{ width: 26, height: 26, borderRadius: 8, background: `${ENERGIA}22`, color: ENERGIA, fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: ok ? T.textT : T.text, textDecoration: ok ? 'line-through' : 'none' }}>{ex}</div>
                      {serieDe(gi.grupo, ex) && <div style={{ fontSize: 12, color: T.textT }}>{serieDe(gi.grupo, ex)}</div>}
                    </div>
                    <button onClick={() => onAbrirCargas(ex)} className="fit-btn" style={{ flexShrink: 0, minHeight: 34, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.page, color: T.textS, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Anotar carga</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </>
    );
  };

  /* ═══════════ ROTEAMENTO ═══════════ */

  /* editor */
  if (editando) {
    const ehDia = editando.tipo === 'dia';
    const atual = ehDia ? P.dias[editando.dia] : colecao.find(t => t.id === editando.id);
    const inicial = atual && !atual.descanso ? atual : (ehDia ? treinoDoDia(editando.dia) : null);
    const fechar = () => { setEditando(null); setFluxo(null); };
    // depois de salvar: no assistente vai pro próximo dia da semana; fora dele só fecha
    const avancar = () => {
      if (fluxo && fluxo.pos < 6) { setFluxo({ pos: fluxo.pos + 1 }); setEditando({ tipo: 'dia', dia: ORDEM_SEMANA[fluxo.pos + 1] }); return; }
      if (fluxo) { setFluxo(null); setEditando(null); setAba('semana'); setSub(null); return; }
      setEditando(null);
    };
    return <EditorTreino key={`${editando.tipo}-${editando.dia ?? editando.id ?? 'novo'}`} T={T} ENERGIA={ENERGIA} FOGO={FOGO} EG={EG}
      titulo={ehDia ? `Treino de ${NOMES_DIA[editando.dia]}` : (editando.id ? 'Editar treino' : 'Novo treino')}
      inicial={inicial} colecao={colecao}
      passoTexto={fluxo ? `Montando a semana · dia ${fluxo.pos + 1} de 7` : null}
      textoSalvar={fluxo ? (fluxo.pos < 6 ? 'Salvar e ir para o próximo dia' : 'Salvar e concluir a semana') : null}
      textoDescanso={fluxo ? 'Descanso neste dia' : null}
      onSalvar={(t) => {
        let novo = P;
        if (ehDia) novo = { ...P, dias: { ...P.dias, [editando.dia]: t } };
        else novo = { ...P, colecao: editando.id ? colecao.map(x => x.id === editando.id ? { ...t, id: editando.id } : x) : [{ ...t, id: novoId() }, ...colecao] };
        salvarPlano(novo);
        avancar();
      }}
      onSalvarNaColecao={ehDia && !fluxo ? (t) => { salvarPlano({ ...P, dias: { ...P.dias, [editando.dia]: t }, colecao: [{ ...t, id: novoId() }, ...colecao] }); fechar(); } : null}
      onDescanso={ehDia ? () => { salvarPlano({ ...P, dias: { ...P.dias, [editando.dia]: { descanso: true } } }); avancar(); } : null}
      onCancelar={fechar} />;
  }

  const Moldura = (filhos) => (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {AbasTopo()}
      <div className="fit-scroll" style={MOLDURA}>{avisoLocal}{filhos}</div>
    </div>
  );

  /* sub-páginas: grupo muscular ou um dia específico */
  if (sub?.tipo === 'grupo' && GRUPO_POR_ID[sub.id]) {
    const g = GRUPO_POR_ID[sub.id];
    return Moldura(<>
      {Voltar('Voltar', () => setSub(null))}
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 12 }}>{g.label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.textS, margin: '0 2px 8px' }}>Exercícios sugeridos</div>
      {Exercicios({ grupo: g })}
      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.textS, margin: '14px 2px 8px' }}>Vídeos e fotos</div>
      {Midias(g)}{Buscas(g)}{FormAdicionar(g)}
    </>);
  }
  if (sub?.tipo === 'dia') {
    return Moldura(<>{Voltar('Semana', () => setSub(null))}{DiaDetalhe(sub.dia)}</>);
  }

  /* HOJE */
  if (aba === 'hoje') {
    if (plano === null) return Moldura(<div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando...</div>);
    return Moldura(<>
      {semNenhumTreino ? VazioCriar() : DiaDetalhe(idxHoje)}
      {cartaoCargas}
    </>);
  }

  /* SEMANA */
  if (aba === 'semana') {
    if (plano === null) return Moldura(<div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando...</div>);
    if (semNenhumTreino) return Moldura(VazioCriar());
    return Moldura(<>
      <div style={{ fontSize: 13.5, color: T.textS, margin: '0 2px 12px', lineHeight: 1.5 }}>Toque em um dia para ver o treino. Use <b style={{ color: T.text }}>Editar</b> ou <b style={{ color: T.text }}>Criar treino</b> para escolher os grupos e as máquinas de cada dia.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ORDEM_SEMANA.map(i => {
          const t = treinoDoDia(i); const ehHoje = i === idxHoje;
          const total = t ? t.grupos.reduce((n, g) => n + g.exercicios.length, 0) : 0;
          return (
            <div key={i} style={{ ...caixa, padding: '12px 12px 12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderColor: ehHoje ? ENERGIA : T.border, boxShadow: ehHoje ? `0 0 0 1px ${ENERGIA}` : 'none' }}>
              <button onClick={() => setSub({ tipo: 'dia', dia: i })} className="fit-btn" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.text }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{NOMES_DIA[i]}</span>
                  {ehHoje && <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: ENERGIA, color: '#fff' }}>HOJE</span>}
                </div>
                <div style={{ fontSize: 13.5, color: t ? T.textS : T.textT, fontStyle: t === undefined ? 'italic' : 'normal', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resumoDoDia(t)}</div>
                {t && <div style={{ fontSize: 12, color: T.textT, marginTop: 1 }}>{total} exercício{total !== 1 ? 's' : ''}{t.personalizado ? ' · seu treino' : ' · sugestão'}</div>}
              </button>
              <button onClick={() => setEditando({ tipo: 'dia', dia: i })} className="fit-btn" style={{ flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${ENERGIA}`, background: 'transparent', color: ENERGIA, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{P.dias[i] ? 'Editar' : 'Criar treino'}</button>
            </div>
          );
        })}
      </div>
      {Object.keys(P.dias).length > 0 && (
        <button onClick={() => { if (window.confirm('Apagar todos os treinos da semana? Os treinos da sua coleção continuam salvos.')) salvarPlano({ ...P, dias: {} }); }} className="fit-btn"
          style={{ marginTop: 14, border: 'none', background: 'none', color: T.textT, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>Apagar todos os treinos da semana</button>
      )}
    </>);
  }

  /* COLEÇÃO */
  if (aba === 'colecao') {
    const usarNoDia = (t, dia) => { salvarPlano({ ...P, dias: { ...P.dias, [dia]: { id: novoId(), nome: t.nome, grupos: t.grupos } } }); setAba('semana'); };
    return Moldura(<>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 2px 10px' }}>
        <div style={{ flex: 1, fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text }}>Meus treinos ({colecao.length})</div>
        <button onClick={() => setEditando({ tipo: 'colecao', id: null })} className="fit-btn" style={{ minHeight: 40, padding: '0 16px', borderRadius: 12, border: 'none', background: ENERGIA, color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>+ Novo treino</button>
      </div>
      {plano === null ? <div style={{ textAlign: 'center', padding: 24, color: T.textT, fontSize: 13 }}>Carregando...</div>
        : !colecao.length ? <div style={{ ...caixa, padding: '22px 16px', textAlign: 'center', color: T.textT, fontSize: 13.5, lineHeight: 1.5, marginBottom: 18 }}>Você ainda não guardou nenhum treino. Toque em “+ Novo treino” ou copie uma das sugestões abaixo.</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {colecao.map(t => <CartaoTreino key={t.id} t={t} T={T} ENERGIA={ENERGIA} onEditar={(x) => setEditando({ tipo: 'colecao', id: x.id })}
              onExcluir={(x) => { if (window.confirm('Excluir esse treino da coleção?')) salvarPlano({ ...P, colecao: colecao.filter(y => y.id !== x.id) }); }} onUsarNoDia={usarNoDia} />)}
          </div>}
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text, margin: '6px 2px 10px' }}>Sugestões prontas</div>
      <div style={{ display: 'grid', gridTemplateColumns: desk ? 'repeat(2, 1fr)' : '1fr', gap: 10, alignItems: 'start' }}>
        {PRESETS.map(t => <CartaoTreino key={t.id} t={t} pronto T={T} ENERGIA={ENERGIA} onUsarNoDia={usarNoDia}
          onCopiar={(x) => salvarPlano({ ...P, colecao: [{ id: novoId(), nome: x.nome, grupos: x.grupos }, ...colecao] })} />)}
      </div>
    </>);
  }

  /* EXERCÍCIOS (biblioteca por grupo muscular) */
  return Moldura(<>
    <div style={{ fontSize: 13.5, color: T.textS, margin: '0 2px 12px', lineHeight: 1.5 }}>Escolha um músculo para ver os exercícios, vídeos e fotos.</div>
    <div style={{ display: 'grid', gridTemplateColumns: desk ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 10 }}>
      {GRUPOS.map(g => {
        const n = (midias || []).filter(m => m.grupo === g.id).length;
        return (
          <button key={g.id} onClick={() => setSub({ tipo: 'grupo', id: g.id })} className="fit-btn"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minHeight: 92, padding: '14px', borderRadius: 16, cursor: 'pointer', border: `1px solid ${T.border}`, background: T.surface, color: T.text, textAlign: 'left' }}>
            <span style={{ color: ENERGIA, display: 'flex' }}>{IcoHalter}</span>
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: 15.5, fontWeight: 800 }}>{g.label}</span>
            <span style={{ fontSize: 12, color: T.textT }}>{n > 0 ? `${n} vídeo${n !== 1 ? 's' : ''}/foto${n !== 1 ? 's' : ''}` : `${g.exercicios.length} exercícios`}</span>
          </button>
        );
      })}
    </div>
  </>);
};

/* ═══════════════ Progressão de carga ═══════════════ */
const MAQUINAS_COMUNS = ['Supino reto', 'Supino inclinado', 'Leg press 45°', 'Agachamento livre', 'Cadeira extensora', 'Mesa flexora', 'Puxada na frente', 'Remada baixa', 'Remada curvada', 'Desenvolvimento', 'Elevação lateral', 'Rosca direta', 'Tríceps na polia', 'Panturrilha em pé', 'Peck deck', 'Stiff', 'Elevação pélvica'];
const fmtKg = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const diaHoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtData = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const GraficoCarga = ({ regs, T, ENERGIA }) => {
  const W = 340, H = 190, pl = 40, pr = 14, pt = 16, pb = 26;
  if (!regs.length) return null;
  const vals = regs.map(r => r.carga);
  let lo = Math.floor(Math.min(...vals) * 0.9), hi = Math.ceil(Math.max(...vals) * 1.08);
  if (hi - lo < 4) { hi += 2; lo = Math.max(0, lo - 2); }
  const tempo = (iso) => new Date(`${iso}T12:00:00`).getTime();
  const t0 = tempo(regs[0].data), t1 = tempo(regs[regs.length - 1].data);
  const x = (r, i) => regs.length === 1 ? pl + (W - pl - pr) / 2 : pl + (t1 === t0 ? i / (regs.length - 1) : (tempo(r.data) - t0) / (t1 - t0)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const pts = regs.map((r, i) => [x(r, i), y(r.carga)]);
  const linha = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
  const area = `${linha} L${pts[pts.length - 1][0].toFixed(1)},${H - pb} L${pts[0][0].toFixed(1)},${H - pb} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs><linearGradient id="fitCargaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ENERGIA} stopOpacity=".38" /><stop offset="100%" stopColor={ENERGIA} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(i => { const v = lo + ((hi - lo) * i) / 3; return (
        <g key={i}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke={T.border} strokeDasharray="3 4" /><text x={pl - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill={T.textT}>{Math.round(v)}</text></g>
      ); })}
      {regs.length > 1 && <path d={area} fill="url(#fitCargaGrad)" />}
      {regs.length > 1 && <path d={linha} fill="none" stroke={ENERGIA} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map(([a, b], i) => <circle key={i} cx={a} cy={b} r={i === pts.length - 1 ? 5.5 : 3.4} fill={i === pts.length - 1 ? ENERGIA : (T.surface || '#fff')} stroke={ENERGIA} strokeWidth="2" />)}
      <text x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1] - 11} textAnchor={pts.length > 1 ? 'end' : 'middle'} fontSize="11" fontWeight="800" fill={T.text}>{fmtKg(regs[regs.length - 1].carga)} kg</text>
      <text x={pl} y={H - 8} fontSize="10" fill={T.textT}>{regs[0].data.slice(8, 10)}/{regs[0].data.slice(5, 7)}</text>
      {regs.length > 1 && <text x={W - pr} y={H - 8} textAnchor="end" fontSize="10" fill={T.textT}>{regs[regs.length - 1].data.slice(8, 10)}/{regs[regs.length - 1].data.slice(5, 7)}</text>}
    </svg>
  );
};

export const CargasPainel = ({ T, ENERGIA, FOGO, EG, supabase, name, exercicioInicial }) => {
  const chaveLocal = `uniko_fit_cargas_${name}`;
  const [regs, setRegs] = useState(null);       // [{ exercicio, data, carga, reps }]
  const [soLocal, setSoLocal] = useState(false);
  const [sel, setSel] = useState(exercicioInicial || null); // exercício aberto
  const [exercicio, setExercicio] = useState(exercicioInicial || '');
  const [carga, setCarga] = useState('');
  const [reps, setReps] = useState('');
  const [dia, setDia] = useState(diaHoje());
  const [erro, setErro] = useState('');

  const salvarLocal = (lista) => { try { localStorage.setItem(chaveLocal, JSON.stringify(lista)); } catch { /* sem armazenamento */ } };
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_fit_cargas').select('exercicio,data,carga,reps').eq('player', name).order('data', { ascending: true }).limit(3000);
    if (error) {
      let l = []; try { l = JSON.parse(localStorage.getItem(chaveLocal) || '[]'); } catch { /* vazio */ }
      setSoLocal(true); setRegs(l); return;
    }
    const lista = (data || []).map(r => ({ exercicio: r.exercicio, data: r.data, carga: Number(r.carga), reps: r.reps }));
    setSoLocal(false); setRegs(lista); salvarLocal(lista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, name]);
  useEffect(() => { carregar(); }, [carregar]);

  const porExercicio = useMemo(() => {
    const m = {};
    (regs || []).forEach(r => { (m[r.exercicio] || (m[r.exercicio] = [])).push(r); });
    Object.values(m).forEach(l => l.sort((a, b) => a.data.localeCompare(b.data)));
    return m;
  }, [regs]);
  const nomes = Object.keys(porExercicio).sort((a, b) => porExercicio[b][porExercicio[b].length - 1].data.localeCompare(porExercicio[a][porExercicio[a].length - 1].data));

  const registrar = async () => {
    const nome = exercicio.trim().replace(/\s+/g, ' ');
    const kg = parseFloat(String(carga).replace(',', '.'));
    const rp = reps.trim() === '' ? null : parseInt(reps, 10);
    if (!nome) { setErro('Informe a máquina ou o exercício.'); return; }
    if (!Number.isFinite(kg) || kg <= 0 || kg > 1000) { setErro('Digite a carga em kg (ex: 40 ou 42,5).'); return; }
    if (rp != null && (!Number.isFinite(rp) || rp < 1 || rp > 200)) { setErro('Repetições inválidas.'); return; }
    if (!dia || dia > diaHoje()) { setErro('Escolha uma data de hoje ou anterior.'); return; }
    setErro('');
    const nova = { exercicio: nome, data: dia, carga: Math.round(kg * 10) / 10, reps: rp };
    const lista = [...(regs || []).filter(r => !(r.exercicio === nome && r.data === dia)), nova];
    setRegs(lista); salvarLocal(lista); setSel(nome); setCarga(''); setReps('');
    if (!soLocal) {
      const { error } = await supabase.from('uniko_fit_cargas').upsert({ player: name, exercicio: nome, data: dia, carga: nova.carga, reps: rp }, { onConflict: 'player,exercicio,data' });
      if (error) setSoLocal(true);
    }
  };
  const apagar = async (r) => {
    const lista = (regs || []).filter(x => !(x.exercicio === r.exercicio && x.data === r.data));
    setRegs(lista); salvarLocal(lista);
    if (!soLocal) await supabase.from('uniko_fit_cargas').delete().eq('player', name).eq('exercicio', r.exercicio).eq('data', r.data);
  };

  const campo = { padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.page || '#fff', color: T.text, fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' };
  const caixa = { background: T.surfaceSub || 'rgba(128,128,128,.08)', border: `1px solid ${T.border}`, borderRadius: 14 };

  if (regs === null) return <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando...</div>;

  const atual = sel && porExercicio[sel] ? sel : null;
  const lista = atual ? porExercicio[atual] : [];
  const ini = lista[0]?.carga, fim = lista[lista.length - 1]?.carga;
  const recorde = lista.length ? Math.max(...lista.map(r => r.carga)) : 0;
  const ganho = lista.length ? fim - ini : 0;
  const ant = lista.length > 1 ? lista[lista.length - 2].carga : null;
  const msg = !lista.length ? null
    : lista.length === 1 ? { t: 'Ponto de partida registrado', x: `Começou em ${fmtKg(fim)} kg. Aumente aos poucos quando a série ficar fácil — a evolução vem da constância.` }
    : fim > ant ? { t: 'Carga nova!', x: `Subiu ${fmtKg(fim - ant)} kg desde o último treino${ganho > 0 ? ` e ${fmtKg(ganho)} kg desde o início` : ''}. É assim que se fica mais forte.` }
    : fim === ant ? { t: 'Mantendo firme', x: 'Mesma carga do último treino. Que tal tentar uma repetição a mais antes de subir o peso?' }
    : { t: 'Faz parte', x: `Hoje a carga ficou ${fmtKg(ant - fim)} kg abaixo da anterior — dia de ajuste de técnica ou recuperação. Seu recorde é ${fmtKg(recorde)} kg, e ele continua seu.` };

  return (
    <div style={{ padding: '16px 16px 26px' }}>
      {soLocal && <div style={{ fontSize: 11.5, color: T.textT, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 10, padding: '8px 11px', marginBottom: 12, lineHeight: 1.45 }}>Salvando só neste aparelho por enquanto (o banco ainda não foi preparado).</div>}

      <div style={{ ...caixa, padding: 13, marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: .3, textTransform: 'uppercase', color: T.textT, marginBottom: 8 }}>Registrar carga</div>
        <input list="fit-maquinas" value={exercicio} onChange={e => setExercicio(e.target.value)} placeholder="Máquina / exercício (ex: Leg press 45°)" style={{ ...campo, width: '100%', marginBottom: 8 }} />
        <datalist id="fit-maquinas">{[...new Set([...nomes, ...MAQUINAS_COMUNS])].map(n => <option key={n} value={n} />)}</datalist>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={carga} onChange={e => setCarga(e.target.value)} inputMode="decimal" placeholder="Carga (kg)" style={{ ...campo, flex: '1 1 90px', minWidth: 0 }} />
          <input value={reps} onChange={e => setReps(e.target.value)} inputMode="numeric" placeholder="Reps (opc.)" style={{ ...campo, flex: '1 1 80px', minWidth: 0 }} />
          <input type="date" value={dia} max={diaHoje()} onChange={e => setDia(e.target.value)} style={{ ...campo, flex: '1 1 140px' }} />
          <button onClick={registrar} className="fit-btn" style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: ENERGIA, color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Salvar</button>
        </div>
        {erro && <div style={{ color: '#DC3232', fontSize: 12, marginTop: 8 }}>{erro}</div>}
        <div style={{ fontSize: 11, color: T.textT, marginTop: 8 }}>Só você vê. Um registro por máquina por dia — salvar de novo no mesmo dia substitui.</div>
      </div>

      {!nomes.length ? (
        <div style={{ textAlign: 'center', padding: '26px 12px', color: T.textT, fontSize: 13 }}>Registre a carga de uma máquina para começar a acompanhar a evolução.</div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: .3, textTransform: 'uppercase', color: T.textT, marginBottom: 8 }}>Minhas máquinas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {nomes.map(n => {
              const l = porExercicio[n]; const d = l[l.length - 1].carga - l[0].carga; const on = n === atual;
              return (
                <button key={n} onClick={() => setSel(on ? null : n)} className="fit-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '11px 13px', borderRadius: 12, cursor: 'pointer', color: T.text,
                    border: `1.5px solid ${on ? ENERGIA : T.border}`, background: on ? `${ENERGIA}14` : (T.surfaceSub || 'transparent') }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</div>
                    <div style={{ fontSize: 11.5, color: T.textT }}>{l.length} registro{l.length !== 1 ? 's' : ''} · última: {fmtData(l[l.length - 1].data)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{fmtKg(l[l.length - 1].carga)} kg</div>
                    {l.length > 1 && <div style={{ fontSize: 11.5, fontWeight: 800, color: d > 0 ? '#16a34a' : d < 0 ? '#DC3232' : T.textT }}>{d > 0 ? '↑ +' : d < 0 ? '↓ ' : ''}{fmtKg(d)} kg</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {atual && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 14px', borderRadius: 14, marginBottom: 14, color: '#fff', background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: `0 8px 22px ${EG}` }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15.5, fontWeight: 800, marginBottom: 3 }}>{msg.t}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, opacity: .96 }}>{msg.x}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {[['Início', `${fmtKg(ini)} kg`, T.text], ['Atual', `${fmtKg(fim)} kg`, T.text], ['Evolução', `${ganho > 0 ? '+' : ''}${fmtKg(ganho)} kg`, ganho > 0 ? '#16a34a' : T.text]].map(([r, v, c]) => (
                  <div key={r} style={{ ...caixa, padding: '11px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: c, fontFamily: 'var(--font-brand)' }}>{v}</div>
                    <div style={{ fontSize: 10.5, color: T.textT, marginTop: 2 }}>{r}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...caixa, padding: '12px 10px 6px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.textS, margin: '0 4px 6px', textTransform: 'uppercase', letterSpacing: .3 }}>{atual} — recorde {fmtKg(recorde)} kg</div>
                <GraficoCarga regs={lista} T={T} ENERGIA={ENERGIA} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...lista].reverse().slice(0, 15).map(r => (
                  <div key={r.data} style={{ ...caixa, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 11 }}>
                    <div style={{ fontSize: 12, color: T.textT, width: 78 }}>{fmtData(r.data)}</div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: T.text }}>{fmtKg(r.carga)} kg{r.reps ? <span style={{ fontSize: 12, fontWeight: 600, color: T.textT }}> × {r.reps}</span> : null}</div>
                    <button onClick={() => apagar(r)} title="Apagar registro" className="fit-btn" style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textD, display: 'flex', padding: 4 }}>{IcoLixo}</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
