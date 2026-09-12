import React, { useState, useEffect } from 'react';
import { T } from '../contexts/theme';
import { AvatarCircle } from './components';
import { NAV } from '../modules/central-colaborador/Sidebar';
import { novidadesAtivas } from './novidades';
import { useCheckinHoje, usePrismaResumo, usePontoResumo, useComunicadosResumo } from './menuWidgets';

/* ══════════════════════════════════════════════════════════════════════════
   LAYOUT NOVO DO MENU DE MÓDULOS — módulos à esquerda, widgets à direita

   A ideia é a de uma tela inicial de verdade, no espírito da Apple: pouca
   cor, muito respiro, cantos generosos, e o movimento guardado pra onde ele
   diz alguma coisa (as novidades).

     Esquerda — os módulos (e os atalhos pra abas internas), em tiles.
     Direita  — widgets: perfil com relógio (substitui o card flutuante da
                órbita), Check-in, Banco de Horas, Ponto, Comunicados e as
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
const ESPACO = 16;           // vão entre os tiles de módulo
const LINHA = 64;            // altura de uma linha da grade de widgets
const VAO_W = 10;            // vão entre widgets

/* Formato [colunas, linhas] de cada widget em cada tamanho, na grade de duas
   colunas da direita. Pequeno ocupa UM espaço; grande, a largura toda. */
const WIDGETS = {
  perfil:     { p:[1, 2], g:[2, 2], padrao:'g' },
  checkin:    { p:[1, 1], g:[2, 2], padrao:'p' },
  horas:      { p:[1, 1], g:[2, 2], padrao:'p' },
  ponto:      { p:[1, 1], g:[2, 2], padrao:'p' },
  avisos:     { p:[1, 1], g:[2, 2], padrao:'p' },
  novidades:  { p:[1, 2], g:[2, 2], padrao:'g' },
};
/* Prefixo das chaves de widget no mapa de tamanhos (o mesmo mapa guarda os
   módulos, pelo id deles) — pra um widget nunca colidir com um módulo. */
const chaveWidget = (id) => `w:${id}`;
/* Tamanho padrão de módulo: o primeiro da ordem nasce grande. */
const tamModuloPadrao = (i) => (i === 0 ? 'g' : 'p');

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
const Moldura = ({ tam, colunas, linhas, editando, onTam, onAbrir, cor, i, onHover, style, children, ...resto }) => {
  const [aceso, setAceso] = useState(false);
  const levanta = aceso && !editando && onAbrir;
  return (
    <div className="mln-tile" role={onAbrir ? 'button' : undefined} tabIndex={onAbrir ? 0 : undefined}
      onClick={editando || !onAbrir ? undefined : onAbrir}
      onKeyDown={(e) => { if (!editando && onAbrir && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onAbrir(); } }}
      onMouseEnter={() => { setAceso(true); onHover?.(true); }} onMouseLeave={() => { setAceso(false); onHover?.(false); }}
      {...resto}
      style={{ gridColumn:`span ${colunas}`, gridRow: linhas ? `span ${linhas}` : undefined, position:'relative',
        minWidth:0, boxSizing:'border-box', background:T.surface, borderRadius:RAIO, outline:'none', userSelect:'none',
        border:`1px solid ${levanta && cor ? cor + '55' : T.border}`,
        boxShadow: levanta ? T.shL : T.sh, cursor: editando ? 'default' : onAbrir ? 'pointer' : 'default',
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
  const borda = reorderMode ? `1.5px dashed ${arrastando ? T.gold : T.goldLine + '88'}`
    : coloringId === m.id ? `1.5px solid ${T.gold}` : undefined;

  return (
    <Moldura tam={tam} colunas={largo ? 2 : 1} editando={sizeMode} onTam={onTam} cor={cor} i={i}
      onAbrir={reorderMode ? null : onAbrir}
      draggable={reorderMode}
      onDragStart={reorderMode ? (e) => { modo.setDragModId(m.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      onDragOver={reorderMode ? (e) => e.preventDefault() : undefined}
      onDrop={reorderMode ? (e) => { e.preventDefault(); modo.onSoltar(m.id); } : undefined}
      onDragEnd={reorderMode ? () => modo.setDragModId(null) : undefined}
      style={{ minHeight:132, display:'flex', flexDirection: largo ? 'row' : 'column',
        alignItems: largo ? 'center' : 'stretch', justifyContent:'space-between', gap: largo ? 18 : 12,
        padding: largo ? '20px 22px' : '16px 16px 15px', cursor: reorderMode ? 'grab' : undefined,
        opacity: arrastando ? .4 : 1, ...(borda ? { border:borda } : null) }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <IconeApp cor={cor} tam={largo ? 58 : 44}>{m.icon}</IconeApp>
        {!largo && !sizeMode && <span className="mln-seta" style={{ color:T.textT, marginTop:2 }}><Seta/></span>}
      </div>

      <div style={{ minWidth:0, flex: largo ? 1 : undefined }}>
        {largo && m.tag && (
          <div style={{ fontSize:11, fontWeight:700, color:cor, letterSpacing:'.02em', marginBottom:3 }}>{m.tag}</div>
        )}
        <div style={{ fontSize: largo ? 20 : 15, fontWeight:700, color:T.text, letterSpacing:'-.015em', lineHeight:1.2,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{m.label}</div>
        <div style={{ fontSize: largo ? 13 : 12, color:T.textT, marginTop:3, lineHeight:1.35,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.sub}</div>
      </div>

      {largo && !sizeMode && <span className="mln-seta" style={{ color:T.textT }}><Seta tam={18}/></span>}

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
      style={{ padding: tam === 'p' ? '11px 12px' : '13px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
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
      style={{ padding: tam === 'p' ? '11px 12px' : '13px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
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
      style={{ padding: tam === 'p' ? '11px 12px' : '13px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
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
      style={{ padding: tam === 'p' ? '11px 12px' : '13px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
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
  const tamModulo = (m, i) => tamanhos[m.id] || tamModuloPadrao(i);

  /* Mexeu no tamanho de UM módulo? Grava o de todos como está na tela. Sem
     isso o padrão "o primeiro da ordem é grande" continuaria valendo pros
     outros, e reorganizar mudaria sozinho o tamanho de quem a pessoa nunca
     tocou. */
  const mudarModulo = (id, v) => {
    const todos = {};
    mods.forEach((m, i) => { todos[m.id] = tamModulo(m, i); });
    onTamanhos({ ...todos, [id]: v });
  };
  const mudarWidget = (id, v) => onTamanhos({ [chaveWidget(id)]: v });

  // Os dois widgets de ponto dividem a mesma leitura, e só se algum está grande.
  const ponto = usePontoResumo(authUser, tamWidget('horas') === 'g' || tamWidget('ponto') === 'g');

  const widget = (id, i) => ({ tam:tamWidget(id), i, editando, onTam:(v) => mudarWidget(id, v) });
  const abrir = (mod, aba) => () => onSelect(mod, aba);

  return (
    <div className="mln-rolagem" style={{ flex:'1 1 0', minHeight:0, width:'100%', overflowY:'auto',
      display:'flex', flexDirection:'column', paddingTop:14, boxSizing:'border-box', fontFamily:'var(--font-body)' }}>
      <style>{CSS}</style>
      <div style={{ margin:'auto', width:'100%', maxWidth:1380, display:'flex', alignItems:'flex-start', gap:28,
        paddingBottom:24, boxSizing:'border-box' }}>

        {/* Esquerda — módulos */}
        <div style={{ flex:'1 1 0', minWidth:0, padding:'4px 4px 12px' }}>
          <Rotulo direita={
            <span style={{ fontSize:12, color:T.textT }}>
              {modo.reorderMode ? 'Arraste pra reorganizar'
                : modo.colorMode ? 'Toque num módulo pra mudar a cor'
                : editando ? 'Escolha pequeno ou grande em cada um'
                : `${mods.length} disponíveis`}
            </span>
          }>Módulos</Rotulo>
          <div style={{ display:'grid', gap:ESPACO, gridAutoFlow:'row dense',
            gridTemplateColumns:'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {mods.map((m, i) => (
              <TileModulo key={m.id} m={m} i={i} tam={tamModulo(m, i)} cor={getModuleColor(m).color} modo={modo}
                onTam={(v) => mudarModulo(m.id, v)}
                onAbrir={modo.colorMode ? () => modo.onEscolherCor(m.id) : () => onSelect(m.atalho ? m.modulo : m.id, m.tab)}/>
            ))}
          </div>
        </div>

        {/* Direita — widgets, numa grade de duas colunas. `dense` deixa um
            widget pequeno subir pro buraco que um grande deixou, como no iPhone. */}
        <div style={{ flex:'0 0 clamp(320px, 29vw, 400px)', minWidth:0, padding:'4px 4px 12px' }}>
          <DataHoje/>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gridAutoRows:LINHA,
            gap:VAO_W, gridAutoFlow:'row dense' }}>
            <WidgetPerfil {...widget('perfil', 0)} authUser={authUser} userPhoto={userPhoto} acoes={acoes}/>
            <WidgetCheckin {...widget('checkin', 1)} authUser={authUser} onAbrir={abrir('mercado-estelar', 'checkin')}/>
            <WidgetHoras {...widget('horas', 2)} ponto={ponto} onAbrir={abrir('colaborador', 'horas')}/>
            <WidgetPonto {...widget('ponto', 3)} ponto={ponto} onAbrir={abrir('colaborador', 'ponto')}/>
            <WidgetAvisos {...widget('avisos', 4)} onAbrir={abrir('colaborador', 'comunicados')}/>
            <WidgetNovidades {...widget('novidades', 5)} onSelect={onSelect}/>
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
