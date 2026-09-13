import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { T } from '../contexts/theme';
import { AvatarCircle } from './components';
import { NAV } from '../modules/central-colaborador/Sidebar';
import { novidadesAtivas } from './novidades';
import { useCheckinHoje, usePrismaResumo, usePontoResumo, useComunicadosResumo, useCaixaEntrada } from './menuWidgets';
import { setPendingJoin } from './gameInvites';

/* ══════════════════════════════════════════════════════════════════════════
   LAYOUT NOVO DO MENU DE MÓDULOS — módulos à esquerda, widgets à direita

   A ideia é a de uma tela inicial de verdade, no espírito da Apple: pouca
   cor, muito respiro, cantos generosos, e o movimento guardado pra onde ele
   diz alguma coisa (as novidades).

     Esquerda — os módulos (e os atalhos pra abas internas), em tiles.
     Direita  — widgets: perfil com relógio (substitui o card flutuante da
                órbita), caixa de entrada em tempo real, Check-in, Banco de Horas, Ponto, Comunicados e as
                novidades girando.

   TAMANHOS — como os widgets do iPhone, cada item tem uma versão pequena (um
   espaço) e uma grande (a largura de dois). A pessoa escolhe no modo
   "Tamanho": os itens tremem e ganham um seletor pequeno/grande. A grande
   não é a pequena esticada — ela mostra mais (a semana do check-in, o saldo
   do banco, as batidas do dia, o último comunicado). A escolha fica no
   ModuleSelector (`tamanhos`, por usuário); aqui só se lê.

   Quem manda no que aparece continua sendo o ModuleSelector: a lista de
   módulos chega ordenada, com os atalhos do Portal dentro e com a cor
   escolhida pela pessoa, e as ações do card de perfil chegam prontas. Aqui
   não se guarda preferência nenhuma. Os dados vivos dos widgets (check-in de
   hoje, catálogo da Prisma Store) vêm dos hooks de shared/menuWidgets.js.

   Desempenho: nada de filter/backdrop-filter — o lava lamp anima atrás desta
   tela e qualquer desfoque por cima dele seria refeito a cada frame (ver
   bolhas.js). As animações são só transform/opacity, e as das novidades só
   rodam no cartão que está à mostra.
══════════════════════════════════════════════════════════════════════════ */

const RAIO = 24;             // canto dos widgets e tiles
const ESPACO = 26;           // vão entre os tiles de módulo (as auras precisam de ar)
const LINHA = 64;            // altura de uma linha da grade de widgets
const LINHA_MAX = 88;        // ...e até onde ela pode esticar pra alinhar as bases
const LINHA_MOD = 132;       // altura de uma fileira de módulos
const LINHA_MOD_MAX = 180;   // ...e até onde ela pode esticar
/* Os tetos saíram de medida (set/2026): um admin com 10 módulos em 3 fileiras
   precisa de +45px por fileira pra alinhar com os widgets; 17 itens precisam
   de +23px por linha de widget. Com 7 módulos em 2 fileiras seriam +146px —
   aí não estica e os cards ficam no tamanho normal. */
const VAO_W = 10;            // vão entre widgets

/* Formato [colunas, linhas] de cada widget em cada tamanho, na grade de duas
   colunas da direita. Pequeno ocupa UM espaço; grande, a largura toda. */
const WIDGETS = {
  perfil:     { p:[1, 2], g:[2, 2], padrao:'g' },
  caixa:      { p:[1, 2], g:[2, 2], padrao:'g' },
  checkin:    { p:[1, 1], g:[2, 2], padrao:'p' },
  horas:      { p:[1, 1], g:[2, 2], padrao:'p' },
  ponto:      { p:[1, 1], g:[2, 2], padrao:'p' },
  avisos:     { p:[1, 1], g:[2, 2], padrao:'p' },
  novidades:  { p:[1, 2], g:[2, 2], padrao:'g' },
};
/* Prefixo das chaves de widget no mapa de tamanhos (o mesmo mapa guarda os
   módulos, pelo id deles) — pra um widget nunca colidir com um módulo. */
const chaveWidget = (id) => `w:${id}`;
/* Tamanho padrão de módulo: o principal (Portal do Colaborador, `fixo`) nasce
   grande; quem traz `tamPadrao` (ex.: atalho Seus Dados) usa o dele; o resto,
   pequeno. A pessoa muda depois no modo Tamanho. */
const tamModuloPadrao = (m) => m.tamPadrao || (m.fixo ? 'g' : 'p');

const CSS = `
@keyframes mlnEntra { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
@keyframes mlnSlide { from { opacity:0; transform:translateX(22px) } to { opacity:1; transform:none } }
@keyframes mlnPulso { 0%,100% { transform:scale(1); opacity:1 } 50% { transform:scale(1.9); opacity:0 } }
@keyframes mlnTampa { 0%,55%,100% { transform:translateY(0) rotate(0) } 65% { transform:translateY(-9px) rotate(-7deg) } 78% { transform:translateY(-3px) rotate(3deg) } }
@keyframes mlnBrilho { 0%,100% { transform:scale(.3); opacity:0 } 50% { transform:scale(1); opacity:1 } }
@keyframes mlnTraco { 0% { stroke-dashoffset:1 } 45%,80% { stroke-dashoffset:0 } 100% { stroke-dashoffset:-1 } }
@keyframes mlnPingo { 0%,40% { transform:scale(0) } 55% { transform:scale(1.15) } 65%,85% { transform:scale(1) } 100% { transform:scale(0) } }
@keyframes mlnBarra { 0%,100% { transform:scaleY(.3) } 50% { transform:scaleY(1) } }
@keyframes mlnNota { 0% { transform:translate(0,6px); opacity:0 } 30% { opacity:1 } 100% { transform:translate(10px,-26px); opacity:0 } }
@keyframes mlnTreme { from { transform:rotate(-.55deg) } to { transform:rotate(.55deg) } }
@keyframes mlnFade { from { opacity:0 } to { opacity:1 } }
@keyframes mlnJanela { from { opacity:0; transform:translateY(12px) scale(.97) } to { opacity:1; transform:none } }
.mln-cx-linha:hover, .mln-cx-linha:focus-visible { background:var(--mln-cx-hover); }
.mln-cx-acoes { opacity:0; pointer-events:none; transition:opacity .15s; }
.mln-cx-linha:hover .mln-cx-acoes, .mln-cx-linha:focus-within .mln-cx-acoes { opacity:1; pointer-events:auto; }
.mln-cx-linha:hover .mln-cx-hora, .mln-cx-linha:focus-within .mln-cx-hora { opacity:0; }
@media (hover: none) { .mln-cx-acoes { opacity:1; pointer-events:auto; } .mln-cx-hora { opacity:0; } }
@keyframes mlnMenu { from { opacity:0; transform:translateY(-4px) scale(.97) } to { opacity:1; transform:none } }
.mln-tile { transition: transform .28s cubic-bezier(.16,1,.3,1), box-shadow .28s, border-color .2s; }
.mln-tile:active { transform: scale(.97) !important; }
.mln-seta { opacity:0; transform:translateX(-4px); transition: opacity .2s, transform .2s; }
.mln-tile:hover .mln-seta { opacity:1; transform:none; }
.mln-rolagem { scrollbar-width: none; }
.mln-rolagem::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .mln-anim, .mln-anim * { animation: none !important; }
}
`;

/* Mistura um hex (#RRGGBB) com branco/preto — pra o degradê dos ícones sem
   precisar de uma segunda cor por módulo. Cor em outro formato passa direto. */
const clarear = (hex, k) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const canal = (s) => { const c = (n >> s) & 255; return Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)); };
  return `rgb(${canal(16)},${canal(8)},${canal(0)})`;
};

/* Um tom da cor com transparência: k mistura com branco (>0) ou preto (<0),
   a é o alfa. Serve pras camadas da aura dos tiles de módulo. */
const tom = (hex, k, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const canal = (sh) => { const c = (n >> sh) & 255; return Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)); };
  return `rgba(${canal(16)},${canal(8)},${canal(0)},${a})`;
};

/* O quadradinho de ícone no estilo "app": degradê suave da cor e ícone branco. */
const IconeApp = ({ cor, tam = 44, children }) => (
  <div style={{ width:tam, height:tam, borderRadius:tam * 0.3, flexShrink:0, color:'#fff',
    background:`linear-gradient(160deg, ${clarear(cor, 0.22)}, ${clarear(cor, -0.12)})`,
    boxShadow:`inset 0 1px 0 rgba(255,255,255,.28), 0 4px 12px ${cor}33`,
    display:'flex', alignItems:'center', justifyContent:'center' }}>
    {React.cloneElement(children, { width:tam * 0.5, height:tam * 0.5 })}
  </div>
);

const Seta = ({ tam = 14 }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
);

const Rotulo = ({ children, direita }) => (
  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10,
    padding:'0 4px', marginBottom:9 }}>
    <span style={{ fontSize:13, fontWeight:700, color:T.textS, letterSpacing:'-.005em' }}>{children}</span>
    {direita}
  </div>
);

/* ── Seletor pequeno/grande (aparece no modo Tamanho) ───────────────────────
   Pendurado no canto, metade pra fora — como o selo de apagar do iPhone —
   pra não tampar o título dos widgets de um espaço só. */
const SeletorTamanho = ({ tam, onTam }) => (
  <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
    style={{ position:'absolute', top:-10, right:-8, zIndex:6, display:'flex', gap:2, padding:3, borderRadius:11,
      background:T.surface, border:`1px solid ${T.border}`, boxShadow:T.shM || T.sh }}>
    {[['p', 'Pequeno', <rect key="p" x="8" y="8" width="8" height="8" rx="2"/>],
      ['g', 'Grande',  <rect key="g" x="3" y="8" width="18" height="8" rx="2"/>]].map(([id, rot, forma]) => {
      const on = tam === id;
      return (
        <button key={id} onClick={() => onTam(id)} title={rot} aria-label={rot} aria-pressed={on}
          style={{ width:26, height:20, borderRadius:8, border:'none', padding:0, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            background: on ? T.text : 'transparent', color: on ? T.surface : T.textS, transition:'background .15s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">{forma}</svg>
        </button>
      );
    })}
  </div>
);

/* Moldura comum de widget e tile: tamanho na grade, hover, tremida no modo
   de edição e o seletor de tamanho. O conteúdo é de quem usa. */
/* `aura` (uma cor): em vez de borda, o card ganha três anéis finos em volta,
   em três tons dessa cor — do mais forte, colado no card, ao mais claro e
   transparente por fora. É a mesma ideia da aura das bolhas da órbita, só que
   fina. Os anéis são sombras com spread (nada de blur), então não custam nada
   por frame; no hover eles abrem um pouco. Sem `aura`: borda neutra (widgets). */
const Moldura = ({ tam, colunas, linhas, editando, onTam, onAbrir, cor, aura, i, onHover, style, children, ...resto }) => {
  const [aceso, setAceso] = useState(false);
  const levanta = aceso && !editando && onAbrir;
  const [a1, a2, a3] = levanta ? [2.5, 6, 10] : [2, 5, 8.5];
  const pintura = aura ? {
    background:T.surface,
    border:'none',
    // No tema escuro clarear a cor puxa pro cinza sobre o fundo escuro; lá os
    // três tons saem da própria cor, só perdendo opacidade.
    boxShadow: (T.dark
      ? `0 0 0 ${a1}px ${tom(aura, 0, .7)}, 0 0 0 ${a2}px ${tom(aura, 0, .32)}, 0 0 0 ${a3}px ${tom(aura, 0, .14)}, `
      : `0 0 0 ${a1}px ${tom(aura, -0.05, .62)}, 0 0 0 ${a2}px ${tom(aura, 0.3, .34)}, 0 0 0 ${a3}px ${tom(aura, 0.58, .2)}, `)
      + (levanta ? T.shL : T.sh),
  } : {
    background:T.surface,
    border:`1px solid ${levanta && cor ? cor + '55' : T.border}`,
    boxShadow: levanta ? T.shL : T.sh,
  };
  return (
    <div className="mln-tile" role={onAbrir ? 'button' : undefined} tabIndex={onAbrir ? 0 : undefined}
      onClick={editando || !onAbrir ? undefined : onAbrir}
      onKeyDown={(e) => { if (!editando && onAbrir && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onAbrir(); } }}
      onMouseEnter={() => { setAceso(true); onHover?.(true); }} onMouseLeave={() => { setAceso(false); onHover?.(false); }}
      {...resto}
      style={{ gridColumn:`span ${colunas}`, gridRow: linhas ? `span ${linhas}` : undefined, position:'relative',
        minWidth:0, boxSizing:'border-box', borderRadius:RAIO, outline:'none', userSelect:'none',
        ...pintura, cursor: editando ? 'default' : onAbrir ? 'pointer' : 'default',
        transform: levanta ? 'translateY(-2px)' : 'none',
        animation: editando
          ? `mlnTreme .3s ${i % 2 ? -0.15 : 0}s ease-in-out infinite alternate`
          : `mlnEntra .55s ${0.04 * i}s cubic-bezier(.16,1,.3,1) backwards`,
        ...style }}>
      {children}
      {editando && <SeletorTamanho tam={tam} onTam={onTam}/>}
    </div>
  );
};

/* ── Tile de módulo ───────────────────────────────────────────────────────── */
const TileModulo = ({ m, i, tam, cor, modo, onTam, onAbrir }) => {
  const { reorderMode, colorMode, sizeMode, dragModId, coloringId } = modo;
  const largo = tam === 'g';
  const arrastando = dragModId === m.id;
  // O principal fica fixo em 1º: no modo Ordem ele não arrasta (mas aceita que
  // soltem em cima — o solto vai pra logo depois dele).
  const arrastavel = reorderMode && !m.fixo;
  const borda = arrastavel ? `1.5px dashed ${arrastando ? cor : tom(cor, 0.2, .6)}` : undefined;
  // Selecionado no modo Cor: um contorno por fora da aura, pra não brigar com ela.
  const escolhido = coloringId === m.id ? { outline:`2px solid ${T.text}`, outlineOffset:12 } : null;

  return (
    <Moldura tam={tam} colunas={largo ? 2 : 1} editando={sizeMode} onTam={onTam} cor={cor} aura={cor} i={i}
      onAbrir={reorderMode ? null : onAbrir}
      draggable={arrastavel}
      onDragStart={arrastavel ? (e) => { modo.setDragModId(m.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      onDragOver={reorderMode ? (e) => e.preventDefault() : undefined}
      onDrop={reorderMode ? (e) => { e.preventDefault(); modo.onSoltar(m.id); } : undefined}
      onDragEnd={arrastavel ? () => modo.setDragModId(null) : undefined}
      style={{ display:'flex', flexDirection: largo ? 'row' : 'column',
        alignItems: largo ? 'center' : 'stretch', justifyContent:'space-between', gap: largo ? 18 : 12,
        padding: largo ? '20px 22px' : '16px 16px 15px', cursor: arrastavel ? 'grab' : undefined,
        opacity: arrastando ? .4 : 1, ...(borda ? { border:borda } : null), ...escolhido }}>

      {/* Ícone solto na cor do módulo — sem quadradinho nem borda em volta. */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', color:cor }}>
        {React.cloneElement(m.icon, { width: largo ? 52 : 34, height: largo ? 52 : 34, style:{ flexShrink:0, display:'block' } })}
        {!largo && !sizeMode && <span className="mln-seta" style={{ color:T.textT, marginTop:2 }}><Seta/></span>}
      </div>

      <div style={{ minWidth:0, flex: largo ? 1 : undefined }}>
        {largo && m.tag && (
          <div style={{ fontSize:11, fontWeight:700, color:cor, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:4 }}>{m.tag}</div>
        )}
        <div style={{ fontSize: largo ? 21 : 15, fontWeight:700, color:T.text, letterSpacing:'-.015em', lineHeight:1.2,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{m.label}</div>
        <div style={{ fontSize: largo ? 13 : 12, color:T.textT, marginTop:3, lineHeight:1.35,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.sub}</div>
      </div>

      {largo && !sizeMode && <span className="mln-seta" style={{ color:T.textT }}><Seta tam={18}/></span>}

      {reorderMode && m.fixo && (
        <span title="O módulo principal fica sempre em primeiro"
          style={{ position:'absolute', top:12, right:14, display:'flex', alignItems:'center', gap:5,
            fontSize:11, fontWeight:600, color:T.textT }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>
          </svg>
          Fixo em 1º
        </span>
      )}

      {colorMode && (
        <span style={{ position:'absolute', top:12, right:12, width:14, height:14, borderRadius:'50%',
          background:cor, border:`2px solid ${T.surface}`, boxShadow:`0 0 0 1px ${T.border}` }}/>
      )}
    </Moldura>
  );
};

/* ── Peças pequenas dos widgets ───────────────────────────────────────────── */
const navIcone = (id) => NAV.find(n => n.id === id)?.icon || <svg viewBox="0 0 24 24"/>;

const IcoCheckin = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="17" rx="2.5"/><line x1="16" y1="2.5" x2="16" y2="6"/><line x1="8" y1="2.5" x2="8" y2="6"/>
    <line x1="3" y1="9.5" x2="21" y2="9.5"/><path d="M8.5 15l2.4 2.4 4.6-4.8"/>
  </svg>
);

const Ponto = ({ cor, pulso }) => (
  <span className="mln-anim" style={{ position:'relative', width:7, height:7, flexShrink:0 }}>
    <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:cor }}/>
    {pulso && <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:cor,
      animation:'mlnPulso 2s ease-out infinite' }}/>}
  </span>
);

const umaLinha = { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' };

/* Cabeçalho que as duas versões dividem: ícone, título e a linha de status. */
const Cabeca = ({ cor, icone, titulo, sub, pontoCor, pulso, tamIcone = 36, direita }) => (
  <div style={{ display:'flex', alignItems:'center', gap:11, minWidth:0 }}>
    <IconeApp cor={cor} tam={tamIcone}>{icone}</IconeApp>
    <div style={{ minWidth:0, flex:1 }}>
      <div style={{ fontSize:13, fontWeight:700, color:T.text, letterSpacing:'-.01em', ...umaLinha }}>{titulo}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11.5, color:T.textT, marginTop:2 }}>
        {pontoCor && <Ponto cor={pontoCor} pulso={pulso}/>}
        <span style={umaLinha}>{sub}</span>
      </div>
    </div>
    {direita}
  </div>
);

const fmtMin = (m) => {
  const a = Math.abs(Math.round(m)), h = Math.floor(a / 60), mm = a % 60;
  return `${m < 0 ? '−' : '+'}${h}h${String(mm).padStart(2, '0')}`;
};
const fmtDia = (iso) => {
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' }).replace('.', '');
};

/* ── Widget: perfil + relógio ─────────────────────────────────────────────── */
const saudacao = (h) => (h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');

const useAgora = () => {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    // Acorda na virada do minuto, não a cada segundo: o relógio só mostra HH:MM.
    let id;
    const agenda = () => {
      const falta = 60000 - (Date.now() % 60000);
      id = setTimeout(() => { setAgora(new Date()); agenda(); }, falta + 50);
    };
    agenda();
    return () => clearTimeout(id);
  }, []);
  return agora;
};

const BotaoAcao = ({ b, emLinha }) => (
  <button onClick={b.onClick} title={b.dica}
    style={emLinha
      ? { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px', border:'none', borderRadius:10,
          background: b.ativo ? T.goldGl : 'transparent', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13,
          fontWeight:600, textAlign:'left', color: b.perigo ? T.danger : b.ativo ? T.gold : T.text }
      : { display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'7px 0 6px', minWidth:0,
          borderRadius:11, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:9.5, fontWeight:600, border:'none',
          background: b.ativo ? T.goldGl : (T.surfaceSub || 'rgba(0,0,0,.035)'),
          color: b.perigo ? T.danger : b.ativo ? T.gold : T.textS, transition:'background .15s', ...umaLinha }}>
    <svg width={emLinha ? 16 : 15} height={emLinha ? 16 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>{b.icone}</svg>
    {b.rot}
  </button>
);

const WidgetPerfil = ({ tam, authUser, userPhoto, acoes, ...moldura }) => {
  const agora = useAgora();
  const [menu, setMenu] = useState(false);
  const hora = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  const papel = authUser?.role === 'admin' ? 'Admin' : authUser?.role === 'moderador' ? 'Moderador' : 'Colaborador';
  const nome = authUser?.name?.split(' ')[0] || 'Olá';
  const [c, l] = WIDGETS.perfil[tam];

  if (tam === 'p') {
    /* Pequeno: avatar, relógio e o nome. As ações vão pro "⋯" — sem elas
       ninguém chegaria em Tema ou Sair com o widget pequeno. */
    return (
      <Moldura tam={tam} colunas={c} linhas={l} {...moldura}
        style={{ padding:'13px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between', zIndex: menu ? 20 : undefined }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {authUser && <AvatarCircle name={authUser.name} photo={userPhoto} size={32} fontSize={12} rounded="10px"/>}
          {!moldura.editando && (
            <button onClick={() => setMenu(v => !v)} title="Mais ações" aria-label="Mais ações"
              style={{ width:28, height:28, borderRadius:'50%', border:'none', cursor:'pointer', color:T.textS,
                background: menu ? T.goldGl : (T.surfaceSub || 'rgba(0,0,0,.04)'), display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
            </button>
          )}
        </div>
        <div>
          <div style={{ fontSize:34, fontWeight:300, color:T.text, letterSpacing:'-.035em', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{hora}</div>
          <div style={{ fontSize:12, color:T.textT, marginTop:5, ...umaLinha }}>{saudacao(agora.getHours())}, <b style={{ color:T.text, fontWeight:600 }}>{nome}</b></div>
        </div>
        {menu && (
          <>
            <div onClick={() => setMenu(false)} style={{ position:'fixed', inset:0, zIndex:1 }}/>
            <div style={{ position:'absolute', top:46, right:10, zIndex:2, minWidth:176, padding:5, borderRadius:14,
              background:T.surface, border:`1px solid ${T.border}`, boxShadow:T.shL, animation:'mlnMenu .18s ease-out' }}>
              {acoes.map(b => <BotaoAcao key={b.id} emLinha b={{ ...b, onClick:() => { setMenu(false); b.onClick(); } }}/>)}
            </div>
          </>
        )}
      </Moldura>
    );
  }

  return (
    <Moldura tam={tam} colunas={c} linhas={l} {...moldura}
      style={{ padding:'13px 14px 12px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {authUser && <AvatarCircle name={authUser.name} photo={userPhoto} size={42} fontSize={15} rounded="13px"/>}
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:12, color:T.textT }}>{saudacao(agora.getHours())},</div>
          <div style={{ fontSize:17, fontWeight:700, color:T.text, letterSpacing:'-.02em', lineHeight:1.15, ...umaLinha }}>{nome}</div>
          <div style={{ fontSize:11, fontWeight:600, color:T.gold }}>{papel}</div>
        </div>
        <div style={{ fontSize:36, fontWeight:300, color:T.text, letterSpacing:'-.035em', lineHeight:1,
          fontVariantNumeric:'tabular-nums', paddingRight: moldura.editando ? 64 : 0 }}>{hora}</div>
      </div>
      {/* Ações — as mesmas do card flutuante da órbita, cada uma com nome escrito. */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${acoes.length}, minmax(0, 1fr))`, gap:4 }}>
        {acoes.map(b => <BotaoAcao key={b.id} b={b}/>)}
      </div>
    </Moldura>
  );
};

/* ── Widget: check-in ─────────────────────────────────────────────────────── */
const CHECKIN_TEXTO = {
  carregando: { txt:'Verificando…',      cor:null },
  disponivel: { txt:'Disponível hoje',   cor:'#22C55E', pulso:true },
  feito:      { txt:'Feito hoje',        cor:'#22C55E' },
  folga:      { txt:'Sem check-in hoje', cor:null },
};
const COR_CHECKIN = '#FF9F0A';

const WidgetCheckin = ({ tam, authUser, ...moldura }) => {
  const { status, semana } = useCheckinHoje(authUser);
  const st = CHECKIN_TEXTO[status];
  const [c, l] = WIDGETS.checkin[tam];
  const feitos = semana.filter(d => d.feito).length;
  return (
    <Moldura tam={tam} colunas={c} linhas={l} cor={COR_CHECKIN} {...moldura}
      style={{ padding: tam === 'p' ? '11px 12px' : '13px 14px', display:'flex', flexDirection:'column', justifyContent: tam === 'p' ? 'center' : 'space-between' }}>
      <Cabeca cor={COR_CHECKIN} icone={IcoCheckin} titulo="Check-in" sub={st.txt} pontoCor={st.cor} pulso={st.pulso}
        direita={tam === 'g' && !moldura.editando && <span style={{ fontSize:11.5, fontWeight:600, color:T.textT }}>{feitos}/5 na semana</span>}/>
      {tam === 'g' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6 }}>
          {semana.map(d => {
            const pendenteHoje = d.hoje && !d.feito && !d.folga;
            return (
              <div key={d.iso} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                <span style={{ fontSize:10.5, fontWeight: d.hoje ? 700 : 600, color: d.hoje ? T.text : T.textT }}>{d.dia}</span>
                <span style={{ width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  boxSizing:'border-box', color:'#fff',
                  background: d.feito ? `linear-gradient(160deg, ${clarear(COR_CHECKIN, .2)}, ${COR_CHECKIN})` : 'transparent',
                  border: d.feito ? 'none' : pendenteHoje ? `2px solid ${COR_CHECKIN}` : `1.5px ${d.folga ? 'dashed' : 'solid'} ${T.border}` }}>
                  {d.feito && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>}
                  {pendenteHoje && <span className="mln-anim" style={{ width:7, height:7, borderRadius:'50%', background:COR_CHECKIN, animation:'mlnPulso 2s ease-out infinite' }}/>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Moldura>
  );
};

/* ── Widgets: banco de horas e ponto ──────────────────────────────────────── */
const COR_HORAS = '#0A84FF', COR_PONTO = '#30B0C7';

const WidgetHoras = ({ tam, ponto, ...moldura }) => {
  const [c, l] = WIDGETS.horas[tam];
  const pronto = ponto && !ponto.erro;
  const positivo = pronto && ponto.saldoMin >= 0;
  return (
    <Moldura tam={tam} colunas={c} linhas={l} cor={COR_HORAS} {...moldura}
      style={{ padding: tam === 'p' ? '11px 12px' : '13px 14px', display:'flex', flexDirection:'column', justifyContent: tam === 'p' ? 'center' : 'space-between' }}>
      <Cabeca cor={COR_HORAS} icone={navIcone('horas')} titulo="Banco de Horas"
        sub={tam === 'p' ? 'Extras e saldo' : 'Saldo líquido'}/>
      {tam === 'g' && (
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10 }}>
          <div style={{ fontSize:30, fontWeight:600, letterSpacing:'-.03em', lineHeight:1, fontVariantNumeric:'tabular-nums',
            color: !pronto ? T.textT : positivo ? '#1A9C70' : T.danger }}>
            {!ponto ? <span style={{ fontSize:14, fontWeight:500 }}>Calculando…</span>
              : ponto.erro ? <span style={{ fontSize:14, fontWeight:500 }}>Abra pra ver o saldo</span>
              : fmtMin(ponto.saldoMin)}
          </div>
          {pronto && (
            <div style={{ textAlign:'right', fontSize:11.5, color:T.textT, lineHeight:1.5, fontVariantNumeric:'tabular-nums' }}>
              <div>Extras <b style={{ color:T.textS, fontWeight:600 }}>{fmtMin(ponto.extraMin)}</b></div>
              <div>Ponto <b style={{ color:T.textS, fontWeight:600 }}>{fmtMin(ponto.pontoMin)}</b></div>
            </div>
          )}
        </div>
      )}
    </Moldura>
  );
};

const WidgetPonto = ({ tam, ponto, ...moldura }) => {
  const [c, l] = WIDGETS.ponto[tam];
  const dia = ponto && !ponto.erro ? ponto.ultimoDia : null;
  return (
    <Moldura tam={tam} colunas={c} linhas={l} cor={COR_PONTO} {...moldura}
      style={{ padding: tam === 'p' ? '11px 12px' : '13px 14px', display:'flex', flexDirection:'column', justifyContent: tam === 'p' ? 'center' : 'space-between' }}>
      <Cabeca cor={COR_PONTO} icone={navIcone('ponto')} titulo="Ponto Eletrônico"
        sub={tam === 'p' ? 'Suas marcações' : dia ? `Última batida · ${fmtDia(dia.data)}` : 'Suas marcações'}/>
      {tam === 'g' && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', maxHeight:30, overflow:'hidden' }}>
          {!ponto ? <span style={{ fontSize:13, color:T.textT }}>Carregando marcações…</span>
            : !dia ? <span style={{ fontSize:13, color:T.textT }}>Nenhuma marcação importada ainda</span>
            : dia.horas.map((h, k) => (
              <span key={k} style={{ padding:'6px 10px', borderRadius:9, fontSize:13.5, fontWeight:600, color:T.text,
                fontVariantNumeric:'tabular-nums', background:T.surfaceSub || 'rgba(0,0,0,.04)' }}>
                {h}
              </span>
            ))}
        </div>
      )}
    </Moldura>
  );
};

/* ── Widget: comunicados ──────────────────────────────────────────────────── */
const COR_AVISOS = '#FF375F';

const WidgetAvisos = ({ tam, ...moldura }) => {
  const resumo = useComunicadosResumo();
  const [c, l] = WIDGETS.avisos[tam];
  const n = resumo?.naoLidos || 0;
  const sub = n ? `${n} não ${n === 1 ? 'lido' : 'lidos'}` : 'Avisos do RH';
  return (
    <Moldura tam={tam} colunas={c} linhas={l} cor={COR_AVISOS} {...moldura}
      style={{ padding: tam === 'p' ? '11px 12px' : '13px 14px', display:'flex', flexDirection:'column', justifyContent: tam === 'p' ? 'center' : 'space-between' }}>
      <Cabeca cor={COR_AVISOS} icone={navIcone('comunicados')} titulo="Comunicados" sub={sub} pontoCor={n ? COR_AVISOS : null}/>
      {tam === 'g' && (
        resumo?.ultimo ? (
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14.5, fontWeight:600, color:T.text, letterSpacing:'-.01em', lineHeight:1.25, ...umaLinha }}>
              {resumo.ultimo.title}
            </div>
            <div style={{ fontSize:11.5, color:T.textT, marginTop:3 }}>
              {new Date(resumo.ultimo.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'long' })}
            </div>
          </div>
        ) : <div style={{ fontSize:13, color:T.textT }}>{resumo ? 'Nenhum comunicado no momento' : 'Carregando…'}</div>
      )}
    </Moldura>
  );
};

/* ── Widget: caixa de entrada ─────────────────────────────────────────────────
   Notificações em tempo real do que chegou pra pessoa (dados e regras em
   useCaixaEntrada, shared/menuWidgets.js). Cada linha leva pro lugar do aviso;
   abrir marca como lido. */
const COR_CAIXA = '#5E5CE6';
const TIPO_CAIXA = {
  banco:   { cor:'#0A84FF', icone:<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></> },
  prisma:  { cor:'#A855F7', icone:<><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/></> },
  convite: { cor:'#FF9F0A', icone:<><rect x="2.5" y="7" width="19" height="11" rx="5.5"/><line x1="7.5" y1="10.5" x2="7.5" y2="14.5"/><line x1="5.5" y1="12.5" x2="9.5" y2="12.5"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="13.5" r=".9" fill="currentColor"/></> },
  evento:  { cor:'#FF375F', icone:<><rect x="3" y="4" width="18" height="17" rx="2.5"/><line x1="16" y1="2.5" x2="16" y2="6"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="3" y1="9.5" x2="21" y2="9.5"/></> },
};
const IcoCaixa = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
  </svg>
);
const quandoTxt = (iso) => {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  if (min < 2880) return 'ontem';
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const conviteRecente = (it) => Date.now() - new Date(it.quando).getTime() < 30 * 60000;

/* Agrupa por "quando chegou", como a lista de notificações do iPhone. */
const grupoDia = (iso) => {
  const d = new Date(iso); if (!d.getTime()) return 'Mais antigas';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje - dia) / 864e5);
  return dias <= 0 ? 'Hoje' : dias === 1 ? 'Ontem' : dias < 7 ? 'Esta semana' : dias < 30 ? 'Este mês' : 'Mais antigas';
};
const dataHora = (iso) => {
  const d = new Date(iso); if (!d.getTime()) return '';
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }).replace('.', '') + ' · '
    + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
};

/* ── Filtros da caixa ─────────────────────────────────────────────────────────
   Combinam entre si: busca + status + categoria (com subcategoria) + período. */
const CATEGORIAS_CAIXA = [
  { id:'banco',   rot:'Banco de horas', subs:[{ id:'rh', rot:'Lançadas pelo RH' }, { id:'aprovada', rot:'Aprovadas' }, { id:'recusada', rot:'Recusadas' }] },
  { id:'prisma',  rot:'Prismas',        subs:[{ id:'colega', rot:'De colegas' }, { id:'presente', rot:'Presentes' }, { id:'rh', rot:'Crédito do RH' }] },
  { id:'convite', rot:'Convites',       subs:[{ id:'paint', rot:'Uniko Paint' }, { id:'stop', rot:'Uniko Stop!' }] },
  { id:'evento',  rot:'Agenda',         subs:null },   // subcategorias = os tipos de evento que existirem
];
const STATUS_CAIXA = [{ id:'todas', rot:'Todas' }, { id:'nao', rot:'Não lidas' }, { id:'lidas', rot:'Lidas' }];
const PERIODOS_CAIXA = [
  { id:'tudo', rot:'Tudo' }, { id:'hoje', rot:'Hoje' }, { id:'7', rot:'7 dias' }, { id:'30', rot:'30 dias' },
  { id:'mes', rot:'Este mês' }, { id:'mespassado', rot:'Mês passado' },
];
const MESES_NOME = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/* Período → [início, fim) em Date (fim null = até agora). */
const faixaDoPeriodo = (periodo, de, ate) => {
  const agora = new Date();
  const hoje0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  if (periodo === 'hoje') return [hoje0, null];
  if (periodo === '7')  return [new Date(hoje0.getTime() - 6 * 864e5), null];
  if (periodo === '30') return [new Date(hoje0.getTime() - 29 * 864e5), null];
  if (periodo === 'mes') return [new Date(agora.getFullYear(), agora.getMonth(), 1), null];
  if (periodo === 'mespassado') return [new Date(agora.getFullYear(), agora.getMonth() - 1, 1), new Date(agora.getFullYear(), agora.getMonth(), 1)];
  if (periodo.startsWith('mes:')) { const [y, m] = periodo.slice(4).split('-').map(Number); return [new Date(y, m - 1, 1), new Date(y, m, 1)]; }
  if (periodo === 'custom') {
    const ini = de ? dia(de) : null;
    const fim = ate ? new Date(dia(ate).getTime() + 864e5) : null;
    return [ini, fim];
  }
  return [null, null];
};
const ultimos12Meses = () => {
  const agora = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    return { id:`mes:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, rot:`${MESES_NOME[d.getMonth()]} de ${d.getFullYear()}` };
  });
};
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const IcoLixeira = <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>;
const IcoEnvelope = <><rect x="3" y="5" width="18" height="14" rx="2.5"/><polyline points="3 7 12 13 21 7"/></>;
const IcoEnvelopeAberto = <><path d="M3 10l9-6 9 6v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="3 10 12 15 21 10"/></>;

const BotaoIcone = ({ titulo, onClick, perigo, children }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={titulo} aria-label={titulo}
    style={{ width:30, height:30, borderRadius:9, border:'none', cursor:'pointer', display:'flex', alignItems:'center',
      justifyContent:'center', background:T.surfaceSub || 'rgba(0,0,0,.05)', color: perigo ? T.danger : T.textS }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  </button>
);

/* Pílula de filtro. `cor` pinta um pontinho (categorias); `pequena` pras subcategorias. */
const Pilula = ({ ativa, onClick, children, n, cor, pequena }) => (
  <button onClick={onClick} aria-pressed={ativa}
    style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontFamily:'var(--font-body)',
      padding: pequena ? '4px 10px' : '6px 12px', borderRadius:999, fontSize: pequena ? 11.5 : 12.5, fontWeight:600,
      border:`1px solid ${ativa ? 'transparent' : T.border}`, background: ativa ? T.text : 'transparent',
      color: ativa ? T.surface : T.textS, transition:'background .15s, color .15s' }}>
    {cor && <span style={{ width:7, height:7, borderRadius:'50%', background:cor }}/>}
    {children}
    {n !== undefined && <span style={{ fontSize:11, opacity:.65, fontVariantNumeric:'tabular-nums' }}>{n}</span>}
  </button>
);

const RotuloFiltro = ({ children }) => (
  <span style={{ flex:'0 0 74px', fontSize:11.5, fontWeight:700, color:T.textT, paddingTop:7 }}>{children}</span>
);

/* ── Janela da caixa de entrada ───────────────────────────────────────────────
   Abre ao clicar no widget: a lista inteira, filtros (busca, status,
   categoria/subcategoria e período), marcar como lida/não lida e excluir
   (com "Desfazer" por alguns segundos).
   Vai num portal no <body>: o widget fica dentro de uma moldura que ganha
   transform (hover, tremida do modo Tamanho), e position:fixed dentro de um
   ancestral com transform passa a se prender a ELE, não à tela.
   Sem backdrop-filter no fundo escuro de propósito: atrás está o lava lamp
   animado, e o desfoque seria refeito a cada frame enquanto a janela estiver
   aberta (ver shared/bolhas.js). */
const CaixaJanela = ({ caixa, onFechar, onAbrirItem }) => {
  const { itens, naoLidos, marcarLido, marcarNaoLido, marcarTodos, excluir, restaurar, desde, carregarDesde, carregandoAntigas } = caixa;
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('todas');
  const [cats, setCats] = useState([]);               // vazio = todas as categorias
  const [subs, setSubs] = useState([]);               // só vale com UMA categoria escolhida
  const [periodo, setPeriodo] = useState('tudo');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [saindo, setSaindo] = useState([]);           // ids animando a saída
  const [desfazer, setDesfazer] = useState(null);     // { ids, texto }

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);
  useEffect(() => {
    if (!desfazer) return;
    const id = setTimeout(() => setDesfazer(null), 6000);
    return () => clearTimeout(id);
  }, [desfazer]);

  const [ini, fim] = faixaDoPeriodo(periodo, de, ate);
  const iniISO = ini ? ini.toISOString() : '';
  // Período mais antigo do que já está carregado: busca aquele trecho.
  useEffect(() => { if (iniISO && iniISO < desde) carregarDesde(iniISO); }, [iniISO, desde, carregarDesde]);

  const tirar = (ids, texto) => {
    if (!ids.length) return;
    setSaindo(s => [...s, ...ids]);
    // Deixa a linha deslizar pra fora antes de sumir da lista.
    setTimeout(() => {
      excluir(ids);
      setSaindo(s => s.filter(x => !ids.includes(x)));
      setDesfazer({ ids, texto });
    }, 190);
  };

  // Cada filtro é aplicado em camadas, pra os contadores de uma dimensão
  // refletirem as OUTRAS já escolhidas (ex.: "Prismas 3" dentro de "Este mês").
  const q = semAcento(busca.trim());
  const passaBusca   = (it) => !q || semAcento(`${it.titulo} ${it.sub}`).includes(q);
  const passaStatus  = (it) => status === 'todas' || (status === 'nao' ? !it.lido : it.lido);
  const passaPeriodo = (it) => { const t = new Date(it.quando); return (!ini || t >= ini) && (!fim || t < fim); };
  const passaCat     = (it) => !cats.length || cats.includes(it.tipo);
  const passaSub     = (it) => cats.length !== 1 || !subs.length || subs.includes(it.subtipo);
  const base = itens.filter(it => passaBusca(it) && passaStatus(it) && passaPeriodo(it));
  const visiveis = base.filter(it => passaCat(it) && passaSub(it));

  const catUnica = cats.length === 1 ? CATEGORIAS_CAIXA.find(c => c.id === cats[0]) : null;
  const subsDaCat = catUnica
    ? (catUnica.subs || [...new Set(base.filter(i => i.tipo === catUnica.id).map(i => i.subtipo))].map(v => ({ id:v, rot:v })))
    : [];
  const alternarCat = (id) => { setSubs([]); setCats(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]); };
  const alternarSub = (id) => setSubs(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const filtrando = !!q || status !== 'todas' || cats.length > 0 || periodo !== 'tudo';
  const limpar = () => { setBusca(''); setStatus('todas'); setCats([]); setSubs([]); setPeriodo('tudo'); setDe(''); setAte(''); };

  const lidasVisiveis = visiveis.filter(i => i.lido).map(i => i.id);
  const grupos = [];
  for (const it of visiveis) {
    const g = grupoDia(it.quando);
    if (!grupos.length || grupos[grupos.length - 1].nome !== g) grupos.push({ nome:g, itens:[] });
    grupos[grupos.length - 1].itens.push(it);
  }
  const meses = ultimos12Meses();
  const mesEscolhido = periodo.startsWith('mes:') ? periodo : '';
  const carregadoAte = new Date(desde).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }).replace('.', '');

  const acaoTexto = { border:'none', background:'none', padding:'6px 4px', cursor:'pointer', fontSize:12.5,
    fontWeight:600, fontFamily:'var(--font-body)' };
  const campo = { height:32, boxSizing:'border-box', borderRadius:10, border:`1px solid ${T.border}`, background:T.surfaceInput || 'transparent',
    color:T.text, fontSize:12.5, fontFamily:'var(--font-body)', padding:'0 10px', outline:'none', colorScheme: T.dark ? 'dark' : 'light' };

  return createPortal(
    <div onClick={onFechar} role="presentation"
      style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(8,12,24,.45)', display:'flex',
        alignItems:'center', justifyContent:'center', padding:16, boxSizing:'border-box',
        fontFamily:'var(--font-body)', animation:'mlnFade .2s ease-out' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Caixa de entrada"
        style={{ width:'min(720px, 100%)', height:'min(780px, 92vh)', display:'flex', flexDirection:'column',
          background:T.surface, border:`1px solid ${T.border}`, borderRadius:26, boxShadow:'0 30px 80px rgba(0,0,0,.35)',
          overflow:'hidden', position:'relative', animation:'mlnJanela .32s cubic-bezier(.16,1,.3,1)',
          // Cor do hover das linhas via variável: o CSS da tela é montado uma vez só,
          // e o tema pode trocar com a janela aberta.
          '--mln-cx-hover': T.surfaceSub || 'rgba(0,0,0,.04)' }}>

        {/* Cabeçalho */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'20px 22px 12px' }}>
          <IconeApp cor={COR_CAIXA} tam={38}>{IcoCaixa}</IconeApp>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:19, fontWeight:700, color:T.text, letterSpacing:'-.02em' }}>Caixa de entrada</div>
            <div style={{ fontSize:12.5, color:T.textT, marginTop:1 }}>
              {itens.length === 0 ? 'Nenhuma mensagem' : naoLidos ? `${naoLidos} não ${naoLidos === 1 ? 'lida' : 'lidas'} de ${itens.length}` : `${itens.length} ${itens.length === 1 ? 'mensagem' : 'mensagens'}, todas lidas`}
            </div>
          </div>
          <button onClick={onFechar} title="Fechar (Esc)" aria-label="Fechar"
            style={{ width:34, height:34, borderRadius:'50%', border:'none', cursor:'pointer', background:T.surfaceSub || 'rgba(0,0,0,.05)',
              color:T.textS, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>

        {/* Filtros */}
        <div style={{ padding:'0 22px 8px', borderBottom:`1px solid ${T.divider || T.border}`, display:'flex', flexDirection:'column', gap:8 }}>
          {/* Busca + status */}
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ flex:'1 1 220px', position:'relative', display:'flex', alignItems:'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2" strokeLinecap="round"
                style={{ position:'absolute', left:11, pointerEvents:'none' }}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar mensagem, colega, sala…"
                aria-label="Buscar nas mensagens"
                style={{ ...campo, width:'100%', height:36, paddingLeft:34, borderRadius:12, fontSize:13 }}/>
            </label>
            <div role="group" aria-label="Status" style={{ display:'flex', padding:3, borderRadius:12, background:T.surfaceSub || 'rgba(0,0,0,.05)' }}>
              {STATUS_CAIXA.map(st => {
                const on = status === st.id;
                return (
                  <button key={st.id} onClick={() => setStatus(st.id)} aria-pressed={on}
                    style={{ border:'none', borderRadius:9, padding:'6px 12px', cursor:'pointer', fontSize:12.5, fontWeight:600,
                      fontFamily:'var(--font-body)', background: on ? T.surface : 'transparent', color: on ? T.text : T.textS,
                      boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none', transition:'background .15s' }}>{st.rot}</button>
                );
              })}
            </div>
          </div>

          {/* Categoria (+ subcategoria quando só uma está escolhida) */}
          <div style={{ display:'flex', gap:8 }}>
            <RotuloFiltro>Categoria</RotuloFiltro>
            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <Pilula ativa={!cats.length} onClick={() => { setCats([]); setSubs([]); }} n={base.length}>Todas</Pilula>
                {CATEGORIAS_CAIXA.map(c => (
                  <Pilula key={c.id} ativa={cats.includes(c.id)} onClick={() => alternarCat(c.id)}
                    cor={(TIPO_CAIXA[c.id] || TIPO_CAIXA.evento).cor} n={base.filter(i => i.tipo === c.id).length}>{c.rot}</Pilula>
                ))}
              </div>
              {catUnica && subsDaCat.length > 0 && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingLeft:2, animation:'mlnEntra .25s cubic-bezier(.16,1,.3,1) backwards' }}>
                  {subsDaCat.map(sc => (
                    <Pilula key={sc.id} pequena ativa={subs.includes(sc.id)} onClick={() => alternarSub(sc.id)}
                      n={base.filter(i => i.tipo === catUnica.id && i.subtipo === sc.id).length}>{sc.rot}</Pilula>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Período */}
          <div style={{ display:'flex', gap:8 }}>
            <RotuloFiltro>Período</RotuloFiltro>
            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                {PERIODOS_CAIXA.map(pd => (
                  <Pilula key={pd.id} ativa={periodo === pd.id} onClick={() => setPeriodo(pd.id)}>{pd.rot}</Pilula>
                ))}
                <select value={mesEscolhido} onChange={(e) => setPeriodo(e.target.value || 'tudo')} aria-label="Escolher mês"
                  style={{ ...campo, borderRadius:999, fontWeight:600, cursor:'pointer',
                    background: mesEscolhido ? T.text : 'transparent', color: mesEscolhido ? T.surface : T.textS,
                    border:`1px solid ${mesEscolhido ? 'transparent' : T.border}` }}>
                  <option value="">Mês…</option>
                  {meses.map(m => <option key={m.id} value={m.id}>{m.rot}</option>)}
                </select>
                <Pilula ativa={periodo === 'custom'} onClick={() => setPeriodo('custom')}>Personalizado</Pilula>
              </div>
              {periodo === 'custom' && (
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', fontSize:12.5, color:T.textT,
                  animation:'mlnEntra .25s cubic-bezier(.16,1,.3,1) backwards' }}>
                  de <input type="date" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} style={campo}/>
                  até <input type="date" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} style={campo}/>
                </div>
              )}
            </div>
          </div>

          {/* Resultado + ações em massa */}
          <div style={{ display:'flex', alignItems:'center', gap:14, minHeight:30 }}>
            <span style={{ fontSize:12, color:T.textT }}>
              {carregandoAntigas ? 'Buscando mensagens mais antigas…'
                : `${visiveis.length} ${visiveis.length === 1 ? 'mensagem' : 'mensagens'}`}
            </span>
            {filtrando && <button onClick={limpar} style={{ ...acaoTexto, color:T.textS }}>Limpar filtros</button>}
            <span style={{ flex:1 }}/>
            {naoLidos > 0 && <button onClick={marcarTodos} style={{ ...acaoTexto, color:T.gold }}>Marcar todas como lidas</button>}
            {lidasVisiveis.length > 0 && (
              <button onClick={() => tirar(lidasVisiveis, `${lidasVisiveis.length} ${lidasVisiveis.length === 1 ? 'mensagem lida excluída' : 'mensagens lidas excluídas'}`)}
                style={{ ...acaoTexto, color:T.danger }}>Excluir lidas</button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="mln-rolagem" style={{ flex:1, minHeight:0, overflowY:'auto', padding:'6px 12px 70px' }}>
          {visiveis.length === 0 ? (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, color:T.textT, textAlign:'center' }}>
              <div style={{ width:56, height:56, borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center',
                background:T.surfaceSub || 'rgba(0,0,0,.04)', color:T.textT }}>
                {React.cloneElement(IcoCaixa, { width:26, height:26 })}
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:T.text }}>
                {carregandoAntigas ? 'Buscando…' : filtrando ? 'Nenhuma mensagem com esses filtros' : 'Caixa vazia'}
              </div>
              {filtrando && !carregandoAntigas ? (
                <button onClick={limpar} style={{ ...acaoTexto, color:T.gold }}>Limpar filtros</button>
              ) : (
                <div style={{ fontSize:12.5, maxWidth:280, lineHeight:1.5 }}>
                  Horas lançadas, prismas recebidos, convites pra jogar e eventos novos aparecem aqui assim que chegam.
                </div>
              )}
            </div>
          ) : grupos.map(g => (
            <div key={g.nome} style={{ marginBottom:6 }}>
              <div style={{ position:'sticky', top:0, zIndex:1, background:T.surface, padding:'10px 10px 6px',
                fontSize:12, fontWeight:700, color:T.textT, letterSpacing:'.01em' }}>{g.nome}</div>
              {g.itens.map(it => {
                const tp = TIPO_CAIXA[it.tipo] || TIPO_CAIXA.evento;
                const cor = it.ruim ? T.danger : tp.cor;
                const sai = saindo.includes(it.id);
                return (
                  <div key={it.id} className="mln-cx-linha" role="button" tabIndex={0}
                    onClick={() => onAbrirItem(it)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onAbrirItem(it); if (e.key === 'Delete') tirar([it.id], 'Mensagem excluída'); }}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 10px', borderRadius:14, cursor:'pointer', outline:'none',
                      opacity: sai ? 0 : 1, transform: sai ? 'translateX(28px)' : 'none',
                      transition:'opacity .19s ease, transform .19s ease, background .15s' }}>
                    <span style={{ width:8, flexShrink:0, display:'flex', justifyContent:'center' }}>
                      {!it.lido && <span style={{ width:8, height:8, borderRadius:'50%', background:T.gold }}/>}
                    </span>
                    <span style={{ width:38, height:38, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                      color:cor, background:`${cor}1f` }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{tp.icone}</svg>
                    </span>
                    <span style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontSize:13.5, fontWeight: it.lido ? 500 : 700, color: it.lido ? T.textS : T.text,
                        lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{it.titulo}</span>
                      <span style={{ display:'block', fontSize:12, color:T.textT, marginTop:2, ...umaLinha }}>{it.sub}</span>
                    </span>
                    <span style={{ flexShrink:0, position:'relative', minWidth:78, display:'flex', justifyContent:'flex-end' }}>
                      <span className="mln-cx-hora" style={{ fontSize:11.5, color:T.textT, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                        {grupoDia(it.quando) === 'Hoje' ? quandoTxt(it.quando) : dataHora(it.quando)}
                      </span>
                      <span className="mln-cx-acoes" style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', display:'flex', gap:6 }}>
                        <BotaoIcone titulo={it.lido ? 'Marcar como não lida' : 'Marcar como lida'}
                          onClick={() => (it.lido ? marcarNaoLido(it.id) : marcarLido(it.id))}>
                          {it.lido ? IcoEnvelope : IcoEnvelopeAberto}
                        </BotaoIcone>
                        <BotaoIcone titulo="Excluir" perigo onClick={() => tirar([it.id], 'Mensagem excluída')}>{IcoLixeira}</BotaoIcone>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {/* Em "Tudo", a lista vai até onde está carregado — dá pra puxar mais 60 dias. */}
          {periodo === 'tudo' && visiveis.length > 0 && (
            <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px' }}>
              <button disabled={carregandoAntigas}
                onClick={() => carregarDesde(new Date(new Date(desde).getTime() - 60 * 864e5).toISOString())}
                style={{ ...acaoTexto, color:T.textS, opacity: carregandoAntigas ? .6 : 1 }}>
                {carregandoAntigas ? 'Buscando…' : `Mostrando desde ${carregadoAte} · carregar mais antigas`}
              </button>
            </div>
          )}
        </div>

        {/* Rodapé: aviso honesto sobre o que "excluir" faz + desfazer */}
        <div style={{ position:'absolute', left:0, right:0, bottom:0, padding:'10px 22px 14px', display:'flex', alignItems:'center',
          justifyContent:'center', background:`linear-gradient(to top, ${T.surface} 60%, transparent)`, pointerEvents:'none' }}>
          {desfazer ? (
            <div key={desfazer.ids.join()} style={{ pointerEvents:'auto', display:'flex', alignItems:'center', gap:14, padding:'9px 10px 9px 16px',
              borderRadius:14, background:T.text, color:T.surface, fontSize:13, fontWeight:600, boxShadow:T.shL,
              animation:'mlnEntra .3s cubic-bezier(.16,1,.3,1) backwards' }}>
              {desfazer.texto}
              <button onClick={() => { restaurar(desfazer.ids); setDesfazer(null); }}
                style={{ border:'none', borderRadius:9, padding:'5px 11px', cursor:'pointer', fontWeight:700, fontSize:12.5,
                  background:'rgba(255,255,255,.16)', color:'inherit', fontFamily:'var(--font-body)' }}>Desfazer</button>
            </div>
          ) : (
            <span style={{ fontSize:11.5, color:T.textT }}>Excluir tira a mensagem só da sua caixa — o registro original continua.</span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const WidgetCaixa = ({ tam, authUser, onSelect, ...moldura }) => {
  const caixa = useCaixaEntrada(authUser);
  const { itens, naoLidos, marcarLido, marcarTodos } = caixa;
  useAgora();                                   // re-render a cada minuto: "5 min" vira "6 min"
  const [aberta, setAberta] = useState(false);
  const [c, l] = WIDGETS.caixa[tam];
  const editando = moldura.editando;

  const abrirItem = (it) => {
    if (editando) return;
    marcarLido(it.id);
    // Convite recente: deixa a sala "pendente" pra o jogo entrar direto nela
    // (mesma ponte que o popup de convite do App usa). Convite velho só abre o jogo.
    if (it.tipo === 'convite' && conviteRecente(it)) setPendingJoin(it.jogo, it.sala);
    setAberta(false);
    onSelect(it.destino[0], it.destino[1]);
  };
  const janela = aberta && <CaixaJanela caixa={caixa} onFechar={() => setAberta(false)} onAbrirItem={abrirItem}/>;

  const selo = naoLidos > 0 && (
    <span key={naoLidos} style={{ minWidth:18, height:18, padding:'0 5px', borderRadius:9, boxSizing:'border-box',
      background:'#FF3B30', color:'#fff', fontSize:10.5, fontWeight:700, display:'inline-flex', alignItems:'center',
      justifyContent:'center', fontVariantNumeric:'tabular-nums', animation:'mlnEntra .35s cubic-bezier(.16,1,.3,1) backwards' }}>
      {naoLidos > 99 ? '99+' : naoLidos}
    </span>
  );

  if (tam === 'p') {
    const ult = itens.find(i => !i.lido) || itens[0];
    return (
      <Moldura tam={tam} colunas={c} linhas={l} cor={COR_CAIXA} {...moldura}
        onAbrir={() => setAberta(true)}
        style={{ padding:'12px 13px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
          <IconeApp cor={COR_CAIXA} tam={30}>{IcoCaixa}</IconeApp>
          {!editando && selo}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Caixa de entrada</div>
          <div style={{ fontSize:11.5, color:T.textT, marginTop:2, lineHeight:1.3,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {ult ? ult.titulo : 'Tudo em dia por aqui'}
          </div>
        </div>
        {janela}
      </Moldura>
    );
  }

  return (
    <Moldura tam={tam} colunas={c} linhas={l} cor={COR_CAIXA} {...moldura}
      style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* O cabeçalho inteiro abre a janela com a lista completa. */}
      <div role="button" tabIndex={0} title="Abrir a caixa de entrada"
        onClick={() => { if (!editando) setAberta(true); }}
        onKeyDown={(e) => { if (!editando && e.key === 'Enter') setAberta(true); }}
        style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 14px 7px', cursor: editando ? 'default' : 'pointer', outline:'none' }}>
        <IconeApp cor={COR_CAIXA} tam={26}>{IcoCaixa}</IconeApp>
        <span style={{ fontSize:13, fontWeight:700, color:T.text, letterSpacing:'-.01em' }}>Caixa de entrada</span>
        {selo}
        <span style={{ flex:1 }}/>
        {naoLidos > 0 && !editando && (
          <button onClick={(e) => { e.stopPropagation(); marcarTodos(); }} style={{ border:'none', background:'none', padding:0, cursor:'pointer',
            fontSize:11.5, fontWeight:600, color:T.gold, fontFamily:'var(--font-body)' }}>Marcar lidas</button>
        )}
        {!editando && (
          <span style={{ display:'flex', alignItems:'center', gap:2, fontSize:11.5, fontWeight:600, color:T.textT, marginLeft:4 }}>
            Ver tudo <Seta tam={12}/>
          </span>
        )}
      </div>

      {/* A lista rola DENTRO do card e não conta pra altura dele: fica
          absoluta num invólucro flex. Sem isso, com 60 dias de avisos a grade
          media o conteúdo inteiro, o widget crescia e — com as bases das
          colunas alinhadas — esticava a tela toda junto.
          O esmaecido embaixo avisa que a lista continua (não há barra visível). */}
      <div style={{ flex:1, minHeight:0, position:'relative' }}>
      <div className="mln-rolagem" style={{ position:'absolute', inset:0, overflowY:'auto', padding:'0 6px 6px',
        ...(itens.length > 2 ? { WebkitMaskImage:'linear-gradient(to bottom, #000 72%, transparent)', maskImage:'linear-gradient(to bottom, #000 72%, transparent)' } : null) }}>
        {itens.length === 0 ? (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontSize:12.5, color:T.textT }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
            Tudo em dia por aqui
          </div>
        ) : itens.map(it => {
          const tp = TIPO_CAIXA[it.tipo] || TIPO_CAIXA.evento;
          const cor = it.ruim ? T.danger : tp.cor;
          return (
            <button key={it.id} onClick={() => abrirItem(it)} title={it.titulo}
              style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'5px 8px', border:'none', borderRadius:11,
                background:'transparent', cursor: editando ? 'default' : 'pointer', textAlign:'left', fontFamily:'var(--font-body)',
                animation:'mlnSlide .4s cubic-bezier(.16,1,.3,1) backwards' }}
              onMouseEnter={e => { if (!editando) e.currentTarget.style.background = T.surfaceSub || 'rgba(0,0,0,.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ width:24, height:24, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                color:cor, background:`${cor}1f` }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tp.icone}</svg>
              </span>
              <span style={{ minWidth:0, flex:1 }}>
                <span style={{ display:'block', fontSize:12, fontWeight: it.lido ? 500 : 700, color: it.lido ? T.textS : T.text, ...umaLinha }}>{it.titulo}</span>
                <span style={{ display:'block', fontSize:10.5, color:T.textT, marginTop:1, ...umaLinha }}>{it.sub}</span>
              </span>
              <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                <span style={{ fontSize:10, color:T.textT, fontVariantNumeric:'tabular-nums' }}>{quandoTxt(it.quando)}</span>
                <span style={{ width:6, height:6, borderRadius:'50%', background: it.lido ? 'transparent' : T.gold }}/>
              </span>
            </button>
          );
        })}
      </div>
      </div>
      {janela}
    </Moldura>
  );
};

/* ── Artes animadas das novidades ─────────────────────────────────────────── */
const ArtePincel = ({ cor, larg = 112 }) => (
  <svg className="mln-anim" width={larg} height={larg * 96 / 112} viewBox="0 0 112 96" fill="none" aria-hidden="true">
    <rect x="6" y="8" width="100" height="80" rx="16" fill={cor} opacity=".08"/>
    {[
      { d:'M20 60 C 34 34, 48 34, 56 50 S 80 70, 92 38', c:cor,       w:7, atraso:0 },
      { d:'M22 74 C 40 64, 62 80, 88 66',                 c:'#8B5CF6', w:5, atraso:.5 },
      { d:'M26 30 C 36 24, 44 26, 50 30',                 c:'#F59E0B', w:5, atraso:1 },
    ].map((t, i) => (
      <path key={i} d={t.d} stroke={t.c} strokeWidth={t.w} strokeLinecap="round" pathLength="1"
        style={{ strokeDasharray:1, animation:`mlnTraco 3.6s ${t.atraso}s cubic-bezier(.65,0,.35,1) infinite` }}/>
    ))}
    {[[88, 24, 5, '#0EA5E9', 0.3], [70, 26, 3.5, cor, 0.9], [96, 76, 4, '#22C55E', 1.4]].map(([x, y, r, c, a], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill={c}
        style={{ transformOrigin:`${x}px ${y}px`, transformBox:'view-box', animation:`mlnPingo 3.6s ${a}s ease-out infinite` }}/>
    ))}
  </svg>
);

const ArtePresente = ({ cor, larg = 112 }) => (
  <svg className="mln-anim" width={larg} height={larg * 96 / 112} viewBox="0 0 112 96" fill="none" aria-hidden="true">
    <rect x="6" y="8" width="100" height="80" rx="16" fill={cor} opacity=".08"/>
    <rect x="34" y="46" width="44" height="32" rx="5" fill={cor}/>
    <rect x="53" y="46" width="6" height="32" fill="#fff" opacity=".85"/>
    <g style={{ transformOrigin:'56px 44px', transformBox:'view-box', animation:'mlnTampa 2.8s ease-in-out infinite' }}>
      <rect x="30" y="36" width="52" height="11" rx="4" fill={clarear(cor, 0.18)}/>
      <rect x="53" y="36" width="6" height="11" fill="#fff" opacity=".9"/>
      <path d="M56 36 C 48 24, 38 28, 46 36 M56 36 C 64 24, 74 28, 66 36" stroke={clarear(cor, -0.1)} strokeWidth="3" strokeLinecap="round"/>
    </g>
    {[[26, 26, 0], [86, 22, .7], [90, 60, 1.4], [22, 64, 2]].map(([x, y, a], i) => (
      <path key={i} d={`M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6} Z`}
        fill="#F59E0B" style={{ transformOrigin:`${x}px ${y}px`, transformBox:'view-box', animation:`mlnBrilho 2.8s ${a}s ease-in-out infinite` }}/>
    ))}
  </svg>
);

const ArteOndas = ({ cor, larg = 112 }) => (
  <svg className="mln-anim" width={larg} height={larg * 96 / 112} viewBox="0 0 112 96" fill="none" aria-hidden="true">
    <rect x="6" y="8" width="100" height="80" rx="16" fill={cor} opacity=".08"/>
    {[0, 1, 2, 3, 4, 5].map(i => (
      <rect key={i} x={26 + i * 11} y="30" width="6" height="44" rx="3" fill={i % 2 ? clarear(cor, 0.3) : cor}
        style={{ transformOrigin:`${29 + i * 11}px 74px`, transformBox:'view-box',
          animation:`mlnBarra ${0.9 + (i % 3) * 0.25}s ${i * 0.12}s ease-in-out infinite` }}/>
    ))}
    <g style={{ animation:'mlnNota 3s ease-out infinite' }}>
      <path d="M86 44 V30 l8 -2 v12" stroke={cor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="83" cy="44" r="3.5" fill={cor}/><circle cx="91" cy="41" r="3.5" fill={cor}/>
    </g>
  </svg>
);

const ARTES = { pincel:ArtePincel, presente:ArtePresente, ondas:ArteOndas };

/* ── Widget: novidades (cartões que giram) ────────────────────────────────── */
const GIRO_MS = 6000;

const WidgetNovidades = ({ tam, onSelect, ...moldura }) => {
  const prisma = usePrismaResumo();
  const [idx, setIdx] = useState(0);
  const [parado, setParado] = useState(false);

  /* A Prisma Store entra em segundo, entre as novidades escritas à mão — com
     os números reais do catálogo. Enquanto o catálogo não chega, fica de fora
     em vez de mostrar um cartão vazio. */
  const cartoes = [...novidadesAtivas()];
  if (prisma && prisma.total > 0) {
    const d = prisma.destaque;
    cartoes.splice(Math.min(1, cartoes.length), 0, {
      id:'prisma', titulo:'Prisma Store', arte:'presente', cor:'#A855F7', destino:['mercado-estelar'],
      texto: prisma.recente ? 'Loja atualizada com novos prêmios.' : `${prisma.total} prêmios esperando por você.`,
      detalhe: d ? `Destaque: ${d.emoji || '🎁'} ${d.name}` : null,
    });
  }
  const n = cartoes.length;
  const atual = n ? cartoes[idx % n] : null;

  useEffect(() => {
    if (parado || moldura.editando || n < 2) return;
    const id = setTimeout(() => setIdx(i => (i + 1) % n), GIRO_MS);
    return () => clearTimeout(id);
  }, [idx, parado, moldura.editando, n]);

  if (!atual) return null;
  const Arte = ARTES[atual.arte] || ArtePresente;
  const [c, l] = WIDGETS.novidades[tam];
  const pequeno = tam === 'p';

  const pontos = n > 1 && (
    <div onClick={(e) => e.stopPropagation()}
      style={{ position:'absolute', left: pequeno ? 14 : 20, bottom:12, display:'flex', gap:4, zIndex:2 }}>
      {cartoes.map((cc, i) => {
        const on = i === idx % n;
        return (
          <button key={cc.id} onClick={() => setIdx(i)} aria-label={cc.titulo}
            style={{ width: on ? 14 : 5, height:5, borderRadius:3, border:'none', padding:0, cursor:'pointer',
              background: on ? T.text : T.border, opacity: on ? .7 : 1,
              transition:'width .3s cubic-bezier(.16,1,.3,1), background .3s' }}/>
        );
      })}
    </div>
  );

  return (
    <Moldura tam={tam} colunas={c} linhas={l} {...moldura} onHover={setParado}
      onAbrir={() => onSelect(atual.destino[0], atual.destino[1])}>
      {/* O recorte fica num miolo, não na moldura: a moldura precisa deixar o
          seletor de tamanho sair pelo canto. */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:RAIO }}>
      {/* key no miolo: trocar de novidade remonta, e a entrada (e as animações
          da arte) começam do zero em vez de pegar no meio. */}
      {pequeno ? (
        <div key={atual.id} style={{ position:'absolute', inset:0, padding:'10px 14px 22px', display:'flex', flexDirection:'column',
          animation:'mlnSlide .55s cubic-bezier(.16,1,.3,1) backwards' }}>
          <div style={{ marginLeft:-4, marginTop:-2 }}><Arte cor={atual.cor} larg={64}/></div>
          <div style={{ fontSize:10, fontWeight:700, color:atual.cor, letterSpacing:'.04em', textTransform:'uppercase', marginTop:'auto' }}>
            {atual.titulo}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, letterSpacing:'-.01em', lineHeight:1.2, marginTop:2,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{atual.texto}</div>
        </div>
      ) : (
        <div key={atual.id} style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', gap:10,
          padding:'0 12px 8px 20px', animation:'mlnSlide .55s cubic-bezier(.16,1,.3,1) backwards' }}>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:11, fontWeight:700, color:atual.cor, letterSpacing:'.04em', textTransform:'uppercase' }}>
              {atual.titulo}
            </div>
            <div style={{ fontSize:15.5, fontWeight:700, color:T.text, letterSpacing:'-.015em', lineHeight:1.25, marginTop:4,
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
              {atual.texto}
            </div>
            {atual.detalhe && (
              <div style={{ fontSize:11.5, color:T.textT, marginTop:5, ...umaLinha }}>{atual.detalhe}</div>
            )}
          </div>
          <Arte cor={atual.cor}/>
        </div>
      )}
      {pontos}
      </div>
    </Moldura>
  );
};

/* A data em cima dos widgets, alinhada com o rótulo "Módulos" da esquerda. */
const DataHoje = () => {
  const agora = useAgora();
  const data = agora.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  return <Rotulo>{data.charAt(0).toUpperCase() + data.slice(1)}</Rotulo>;
};

/* ══ O palco ═══════════════════════════════════════════════════════════════ */
/* Uma rolagem só pra tela inteira, e o miolo centrado na vertical com margem
   automática — que, diferente de justify-content:center, vira zero quando o
   conteúdo não cabe, em vez de cortar o topo. Numa tela grande o conjunto
   fica no meio; num notebook baixo ele encosta no cabeçalho e rola. */
const MenuLayoutNovo = ({ mods, onSelect, getModuleColor, authUser, userPhoto, acoes, modo, tamanhos = {}, onTamanhos, sobreposicao }) => {
  const editando = !!modo.sizeMode;
  const tamWidget = (id) => tamanhos[chaveWidget(id)] || WIDGETS[id].padrao;
  const tamModulo = (m) => tamanhos[m.id] || tamModuloPadrao(m);

  /* Mexeu no tamanho de UM módulo? Grava o de todos como está na tela. Sem
     isso o padrão "o primeiro da ordem é grande" continuaria valendo pros
     outros, e reorganizar mudaria sozinho o tamanho de quem a pessoa nunca
     tocou. */
  const mudarModulo = (id, v) => {
    const todos = {};
    mods.forEach((m) => { todos[m.id] = tamModulo(m); });
    onTamanhos({ ...todos, [id]: v });
  };
  const mudarWidget = (id, v) => onTamanhos({ [chaveWidget(id)]: v });

  // Os dois widgets de ponto dividem a mesma leitura, e só se algum está grande.
  const ponto = usePontoResumo(authUser, tamWidget('horas') === 'g' || tamWidget('ponto') === 'g');

  /* BASES ALINHADAS, COM LIMITE.
     O ideal é as duas colunas terminarem na mesma linha, mas esticar sem
     limite deixava os cards gigantes pra quem tem poucos módulos (7 módulos =
     2 fileiras contra uma coluna de widgets bem mais alta). Então:
       1. mede as duas grades como se as linhas estivessem no tamanho normal;
       2. a mais curta ganha `folga` por linha pra fechar a diferença;
       3. mas só se der pra alinhar sem passar do teto (LINHA_MOD_MAX /
          LINHA_MAX). Diferença que cabe no teto fecha certinho; diferença
          grande não estica nada — a coluna mais curta termina antes, com os
          cards no tamanho normal.
     Feito em JS porque CSS não resolve: com minmax(normal, teto) o navegador
     calcula a altura "natural" da grade já com as linhas no teto e todo mundo
     crescia até o máximo. */
  const gradeModRef = useRef(null), gradeWidRef = useRef(null);
  const [folga, setFolga] = useState({ mod:0, wid:0 });
  useLayoutEffect(() => {
    const gm = gradeModRef.current, gw = gradeWidRef.current;
    if (!gm || !gw || typeof ResizeObserver === 'undefined') return;
    // Calcula a partir da folga ATUAL (vem no updater), e devolve o mesmo
    // objeto quando nada muda — aí o React nem re-renderiza e o observer sossega.
    const medir = () => setFolga(f => {
      // linhas = (altura + vão) / (linha + vão); altura natural = sem a folga.
      const natural = (el, linha, extra, vao) => {
        const h = el.getBoundingClientRect().height;
        const n = Math.max(1, Math.round((h + vao) / (linha + extra + vao)));
        return { n, h: h - n * extra };
      };
      const m = natural(gm, LINHA_MOD, f.mod, ESPACO);
      const w = natural(gw, LINHA, f.wid, VAO_W);
      const topo = (el) => el.getBoundingClientRect().top;   // as grades podem não começar na mesma altura
      const dif = (topo(gw) + w.h) - (topo(gm) + m.h);
      // Só estica se der pra ALINHAR dentro do teto. Esticar até o teto sem
      // alcançar a outra coluna só deixava os cards maiores e o vão continuava.
      const porLinhaMod = dif / m.n, porLinhaWid = -dif / w.n;
      const next = dif > 0
        ? { mod: porLinhaMod <= LINHA_MOD_MAX - LINHA_MOD ? Math.round(porLinhaMod) : 0, wid: 0 }
        : { mod: 0, wid: porLinhaWid <= LINHA_MAX - LINHA ? Math.round(porLinhaWid) : 0 };
      return next.mod === f.mod && next.wid === f.wid ? f : next;
    });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(gm); ro.observe(gw);
    return () => ro.disconnect();
  }, []);

  const widget = (id, i) => ({ tam:tamWidget(id), i, editando, onTam:(v) => mudarWidget(id, v) });
  const abrir = (mod, aba) => () => onSelect(mod, aba);

  return (
    <div className="mln-rolagem" style={{ flex:'1 1 0', minHeight:0, width:'100%', overflowY:'auto',
      display:'flex', flexDirection:'column', paddingTop:14, boxSizing:'border-box', fontFamily:'var(--font-body)' }}>
      <style>{CSS}</style>
      {/* BASES ALINHADAS, COM LIMITE — ver `folga` acima. */}
      <div style={{ margin:'auto', width:'100%', maxWidth:1380, display:'flex', alignItems:'flex-start', gap:28,
        paddingBottom:24, boxSizing:'border-box' }}>

        {/* Esquerda — módulos */}
        <div style={{ flex:'1 1 0', minWidth:0, padding:'4px 12px 14px' }}>
          <Rotulo direita={
            <span style={{ fontSize:12, color:T.textT }}>
              {modo.reorderMode ? 'Arraste pra reorganizar'
                : modo.colorMode ? 'Toque num módulo pra mudar a cor'
                : editando ? 'Escolha pequeno ou grande em cada um'
                : `${mods.length} disponíveis`}
            </span>
          }>Módulos</Rotulo>
          <div ref={gradeModRef} style={{ display:'grid', gap:ESPACO, gridAutoFlow:'row dense',
            gridAutoRows: LINHA_MOD + folga.mod,
            gridTemplateColumns:'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {mods.map((m, i) => (
              <TileModulo key={m.id} m={m} i={i} tam={tamModulo(m)} cor={getModuleColor(m).color} modo={modo}
                onTam={(v) => mudarModulo(m.id, v)}
                onAbrir={modo.colorMode ? () => modo.onEscolherCor(m.id) : () => onSelect(m.atalho ? m.modulo : m.id, m.tab)}/>
            ))}
          </div>
        </div>

        {/* Direita — widgets, numa grade de duas colunas. `dense` deixa um
            widget pequeno subir pro buraco que um grande deixou, como no iPhone. */}
        <div style={{ flex:'0 0 clamp(320px, 29vw, 400px)', minWidth:0, padding:'4px 4px 14px' }}>
          <DataHoje/>
          <div ref={gradeWidRef} style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gridAutoRows: LINHA + folga.wid,
            gap:VAO_W, gridAutoFlow:'row dense' }}>
            <WidgetPerfil {...widget('perfil', 0)} authUser={authUser} userPhoto={userPhoto} acoes={acoes}/>
            <WidgetCaixa {...widget('caixa', 1)} authUser={authUser} onSelect={onSelect}/>
            <WidgetCheckin {...widget('checkin', 2)} authUser={authUser} onAbrir={abrir('mercado-estelar', 'checkin')}/>
            <WidgetHoras {...widget('horas', 3)} ponto={ponto} onAbrir={abrir('colaborador', 'horas')}/>
            <WidgetPonto {...widget('ponto', 4)} ponto={ponto} onAbrir={abrir('colaborador', 'ponto')}/>
            <WidgetAvisos {...widget('avisos', 5)} onAbrir={abrir('colaborador', 'comunicados')}/>
            <WidgetNovidades {...widget('novidades', 6)} onSelect={onSelect}/>
          </div>
        </div>
      </div>

      {sobreposicao}
    </div>
  );
};

/* O ModuleSelector usa isto pro "todos pequenos / todos grandes" do banner. */
const WIDGETS_NOVO = Object.keys(WIDGETS).map(chaveWidget);

export { MenuLayoutNovo, WIDGETS_NOVO };
