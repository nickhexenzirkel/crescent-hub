import React, { useState, useEffect } from 'react';
import { T } from '../contexts/theme';
import { AvatarCircle } from './components';
import { NAV } from '../modules/central-colaborador/Sidebar';
import { novidadesAtivas } from './novidades';
import { useCheckinHoje, usePrismaResumo } from './menuWidgets';

/* ══════════════════════════════════════════════════════════════════════════
   LAYOUT NOVO DO MENU DE MÓDULOS — módulos à esquerda, widgets à direita

   A ideia é a de uma tela inicial de verdade, no espírito da Apple: pouca
   cor, muito respiro, cantos generosos, e o movimento guardado pra onde ele
   diz alguma coisa (as novidades).

     Esquerda — os módulos, em tiles. O primeiro da ordem ocupa duas colunas:
                dá ritmo à grade e deixa claro qual é o "principal" da pessoa.
     Direita  — widgets: perfil com relógio (substitui o card flutuante da
                órbita), acessos rápidos direto numa aba (Banco de Horas,
                Ponto, Check-in...) e as novidades girando em cartões deitados.

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
const ESPACO = 16;           // vão entre eles

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

const Cartao = ({ children, style, ...resto }) => (
  <div {...resto} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:RAIO,
    boxShadow:T.sh, ...style }}>{children}</div>
);

const Rotulo = ({ children, direita }) => (
  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10,
    padding:'0 4px', marginBottom:9 }}>
    <span style={{ fontSize:13, fontWeight:700, color:T.textS, letterSpacing:'-.005em' }}>{children}</span>
    {direita}
  </div>
);

/* ── Tile de módulo ───────────────────────────────────────────────────────── */
const TileModulo = ({ m, i, largo, cor, modo, onAbrir }) => {
  const [aceso, setAceso] = useState(false);
  const { reorderMode, colorMode, dragModId, coloringId } = modo;
  const arrastando = dragModId === m.id;
  const escolhido = coloringId === m.id;
  const borda = reorderMode ? `1.5px dashed ${arrastando ? T.gold : T.goldLine + '88'}`
    : escolhido ? `1.5px solid ${T.gold}`
    : `1px solid ${aceso ? cor + '55' : T.border}`;

  return (
    <div className="mln-tile"
      role="button" tabIndex={0}
      draggable={reorderMode}
      onDragStart={reorderMode ? (e) => { modo.setDragModId(m.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      onDragOver={reorderMode ? (e) => e.preventDefault() : undefined}
      onDrop={reorderMode ? (e) => { e.preventDefault(); modo.onSoltar(m.id); } : undefined}
      onDragEnd={reorderMode ? () => modo.setDragModId(null) : undefined}
      onClick={reorderMode ? undefined : onAbrir}
      onKeyDown={(e) => { if (!reorderMode && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAbrir(); } }}
      onMouseEnter={() => setAceso(true)} onMouseLeave={() => setAceso(false)}
      style={{ gridColumn: largo ? 'span 2' : undefined, position:'relative', minHeight:132,
        display:'flex', flexDirection: largo ? 'row' : 'column', alignItems: largo ? 'center' : 'stretch',
        justifyContent:'space-between', gap: largo ? 18 : 12, padding: largo ? '20px 22px' : '16px 16px 15px',
        background:T.surface, border:borda, borderRadius:RAIO, boxSizing:'border-box',
        boxShadow: aceso && !reorderMode ? T.shL : T.sh, cursor: reorderMode ? 'grab' : 'pointer',
        opacity: arrastando ? .4 : 1, outline:'none', userSelect:'none',
        transform: aceso && !reorderMode ? 'translateY(-3px)' : 'none',
        animation:`mlnEntra .55s ${0.04 * i}s cubic-bezier(.16,1,.3,1) backwards` }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <IconeApp cor={cor} tam={largo ? 58 : 44}>{m.icon}</IconeApp>
        {!largo && <span className="mln-seta" style={{ color:T.textT, marginTop:2 }}><Seta/></span>}
      </div>

      <div style={{ minWidth:0, flex: largo ? 1 : undefined }}>
        {largo && m.tag && (
          <div style={{ fontSize:11, fontWeight:700, color:cor, letterSpacing:'.02em', marginBottom:3 }}>{m.tag}</div>
        )}
        <div style={{ fontSize: largo ? 20 : 15, fontWeight:700, color:T.text, letterSpacing:'-.015em',
          lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace: largo ? 'nowrap' : 'normal' }}>{m.label}</div>
        <div style={{ fontSize: largo ? 13 : 12, color:T.textT, marginTop:3, lineHeight:1.35,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.sub}</div>
      </div>

      {largo && <span className="mln-seta" style={{ color:T.textT }}><Seta tam={18}/></span>}

      {colorMode && (
        <span style={{ position:'absolute', top:12, right:12, width:14, height:14, borderRadius:'50%',
          background:cor, border:`2px solid ${T.surface}`, boxShadow:`0 0 0 1px ${T.border}` }}/>
      )}
    </div>
  );
};

/* ── Widget: perfil + relógio ─────────────────────────────────────────────── */
const saudacao = (h) => (h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');

const WidgetPerfil = ({ authUser, userPhoto, acoes }) => {
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

  const hora = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  const data = agora.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  const papel = authUser?.role === 'admin' ? 'Admin' : authUser?.role === 'moderador' ? 'Moderador' : 'Colaborador';

  return (
    <div>
    <Rotulo>{data.charAt(0).toUpperCase() + data.slice(1)}</Rotulo>
    <Cartao style={{ padding:'18px 18px 14px', animation:'mlnEntra .55s .05s cubic-bezier(.16,1,.3,1) backwards' }}>
      <div style={{ display:'flex', alignItems:'center', gap:13 }}>
        {authUser && <AvatarCircle name={authUser.name} photo={userPhoto} size={48} fontSize={16} rounded="15px"/>}
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:12.5, color:T.textT }}>{saudacao(agora.getHours())},</div>
          <div style={{ fontSize:19, fontWeight:700, color:T.text, letterSpacing:'-.02em',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {authUser?.name?.split(' ')[0] || 'Olá'}
          </div>
          <div style={{ fontSize:11.5, fontWeight:600, color:T.gold, marginTop:1 }}>{papel}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:38, fontWeight:300, color:T.text, letterSpacing:'-.035em', lineHeight:1,
            fontVariantNumeric:'tabular-nums' }}>{hora}</div>
        </div>
      </div>

      {/* Ações — as mesmas do card flutuante da órbita, cada uma com nome escrito. */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${acoes.length}, 1fr)`, gap:4, marginTop:14,
        paddingTop:12, borderTop:`1px solid ${T.divider || T.border}` }}>
        {acoes.map(b => {
          const aceso = b.ativo;
          return (
            <button key={b.id} onClick={b.onClick} title={b.dica}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'8px 0 7px', minWidth:0,
                borderRadius:12, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:10, fontWeight:600,
                border:'none', background: aceso ? T.goldGl : (T.surfaceSub || 'rgba(0,0,0,.035)'),
                color: b.perigo ? T.danger : aceso ? T.gold : T.textS, transition:'background .15s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">{b.icone}</svg>
              {b.rot}
            </button>
          );
        })}
      </div>
    </Cartao>
    </div>
  );
};

/* ── Widget: acessos rápidos ──────────────────────────────────────────────── */
const navIcone = (id) => NAV.find(n => n.id === id)?.icon || <svg viewBox="0 0 24 24"/>;

const IcoCheckin = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="17" rx="2.5"/><line x1="16" y1="2.5" x2="16" y2="6"/><line x1="8" y1="2.5" x2="8" y2="6"/>
    <line x1="3" y1="9.5" x2="21" y2="9.5"/><path d="M8.5 15l2.4 2.4 4.6-4.8"/>
  </svg>
);

const CHECKIN_TEXTO = {
  carregando: { txt:'Verificando…',     cor:null },
  disponivel: { txt:'Disponível hoje',  cor:'#22C55E', pulso:true },
  feito:      { txt:'Feito hoje',       cor:'#22C55E' },
  folga:      { txt:'Sem check-in hoje', cor:null },
};

const TileRapido = ({ titulo, sub, cor, icone, pontoCor, pulso, onClick, i }) => {
  const [aceso, setAceso] = useState(false);
  return (
    <button className="mln-tile" onClick={onClick}
      onMouseEnter={() => setAceso(true)} onMouseLeave={() => setAceso(false)}
      style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', minWidth:0,
        textAlign:'left', cursor:'pointer', fontFamily:'var(--font-body)', borderRadius:18,
        background:T.surface, border:`1px solid ${aceso ? cor + '55' : T.border}`,
        boxShadow: aceso ? T.shL : T.sh, transform: aceso ? 'translateY(-2px)' : 'none',
        animation:`mlnEntra .55s ${0.12 + 0.05 * i}s cubic-bezier(.16,1,.3,1) backwards` }}>
      <IconeApp cor={cor} tam={36}>{icone}</IconeApp>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.text, letterSpacing:'-.01em',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{titulo}</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11.5, color:T.textT, marginTop:2 }}>
          {pontoCor && (
            <span className="mln-anim" style={{ position:'relative', width:7, height:7, flexShrink:0 }}>
              <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:pontoCor }}/>
              {pulso && <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:pontoCor,
                animation:'mlnPulso 2s ease-out infinite' }}/>}
            </span>
          )}
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub}</span>
        </div>
      </div>
    </button>
  );
};

const WidgetAcessos = ({ authUser, onSelect }) => {
  const checkin = CHECKIN_TEXTO[useCheckinHoje(authUser)];
  const itens = [
    { id:'horas',   titulo:'Banco de Horas',   sub:'Extras e saldo',  cor:'#0A84FF', icone:navIcone('horas'),  destino:['colaborador','horas'] },
    { id:'ponto',   titulo:'Ponto Eletrônico', sub:'Suas marcações',  cor:'#30B0C7', icone:navIcone('ponto'),  destino:['colaborador','ponto'] },
    { id:'checkin', titulo:'Check-in',         sub:checkin.txt,       cor:'#FF9F0A', icone:IcoCheckin,         destino:['mercado-estelar','checkin'],
      pontoCor:checkin.cor, pulso:checkin.pulso },
    { id:'avisos',  titulo:'Comunicados',      sub:'Avisos do RH',    cor:'#FF375F', icone:navIcone('comunicados'), destino:['colaborador','comunicados'] },
  ];
  return (
    <div>
      <Rotulo>Acesso rápido</Rotulo>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {itens.map((it, i) => (
          <TileRapido key={it.id} {...it} i={i} onClick={() => onSelect(it.destino[0], it.destino[1])}/>
        ))}
      </div>
    </div>
  );
};

/* ── Artes animadas das novidades ─────────────────────────────────────────── */
const ArtePincel = ({ cor }) => (
  <svg className="mln-anim" width="112" height="96" viewBox="0 0 112 96" fill="none" aria-hidden="true">
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

const ArtePresente = ({ cor }) => (
  <svg className="mln-anim" width="112" height="96" viewBox="0 0 112 96" fill="none" aria-hidden="true">
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

const ArteOndas = ({ cor }) => (
  <svg className="mln-anim" width="112" height="96" viewBox="0 0 112 96" fill="none" aria-hidden="true">
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

/* ── Widget: novidades (cartões deitados que giram) ───────────────────────── */
const GIRO_MS = 6000;

const WidgetNovidades = ({ onSelect }) => {
  const prisma = usePrismaResumo();
  const [idx, setIdx] = useState(0);
  const [parado, setParado] = useState(false);

  /* A Prisma Store entra em segundo, entre as novidades escritas à mão — com
     os números reais do catálogo. Enquanto o catálogo não chega, fica de fora
     em vez de mostrar um cartão vazio. */
  const fixas = novidadesAtivas();
  const cartoes = [...fixas];
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
    if (parado || n < 2) return;
    const id = setTimeout(() => setIdx(i => (i + 1) % n), GIRO_MS);
    return () => clearTimeout(id);
  }, [idx, parado, n]);

  if (!atual) return null;
  const Arte = ARTES[atual.arte] || ArtePresente;

  return (
    <div>
      <Rotulo direita={n > 1 && (
        <div style={{ display:'flex', gap:5 }}>
          {cartoes.map((c, i) => {
            const on = i === idx % n;
            return (
              <button key={c.id} onClick={() => setIdx(i)} aria-label={c.titulo}
                style={{ width: on ? 16 : 6, height:6, borderRadius:3, border:'none', padding:0, cursor:'pointer',
                  background: on ? T.text : T.border, opacity: on ? .75 : 1,
                  transition:'width .3s cubic-bezier(.16,1,.3,1), background .3s' }}/>
            );
          })}
        </div>
      )}>Novidades</Rotulo>

      <Cartao className="mln-tile" role="button" tabIndex={0}
        onMouseEnter={() => setParado(true)} onMouseLeave={() => setParado(false)}
        onClick={() => onSelect(atual.destino[0], atual.destino[1])}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect(atual.destino[0], atual.destino[1]); }}
        style={{ position:'relative', overflow:'hidden', cursor:'pointer', height:132, outline:'none',
          animation:'mlnEntra .55s .3s cubic-bezier(.16,1,.3,1) backwards' }}>
        {/* key no cartão: trocar de novidade remonta o miolo, e a entrada
            (e as animações da arte) começam do zero em vez de pegar no meio. */}
        <div key={atual.id} style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', gap:10,
          padding:'0 12px 0 20px', animation:'mlnSlide .55s cubic-bezier(.16,1,.3,1) backwards' }}>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:11, fontWeight:700, color:atual.cor, letterSpacing:'.04em', textTransform:'uppercase' }}>
              {atual.titulo}
            </div>
            <div style={{ fontSize:15.5, fontWeight:700, color:T.text, letterSpacing:'-.015em', lineHeight:1.25, marginTop:4,
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
              {atual.texto}
            </div>
            {atual.detalhe && (
              <div style={{ fontSize:11.5, color:T.textT, marginTop:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {atual.detalhe}
              </div>
            )}
          </div>
          <Arte cor={atual.cor}/>
        </div>
      </Cartao>
    </div>
  );
};

/* ══ O palco ═══════════════════════════════════════════════════════════════ */
/* Uma rolagem só pra tela inteira, e o miolo centrado na vertical com margem
   automática — que, diferente de justify-content:center, vira zero quando o
   conteúdo não cabe, em vez de cortar o topo. Numa tela grande o conjunto
   fica no meio; num notebook baixo ele encosta no cabeçalho e rola. */
const MenuLayoutNovo = ({ mods, onSelect, getModuleColor, authUser, userPhoto, acoes, modo, sobreposicao }) => (
  <div className="mln-rolagem" style={{ flex:'1 1 0', minHeight:0, width:'100%', overflowY:'auto',
    display:'flex', flexDirection:'column', paddingTop:14, boxSizing:'border-box', fontFamily:'var(--font-body)' }}>
    <style>{CSS}</style>
    <div style={{ margin:'auto', width:'100%', maxWidth:1380, display:'flex', alignItems:'flex-start', gap:28,
      paddingBottom:24, boxSizing:'border-box' }}>

    {/* Esquerda — módulos */}
    <div style={{ flex:'1 1 0', minWidth:0, padding:'4px 4px 12px' }}>
      <Rotulo direita={
        <span style={{ fontSize:12, color:T.textT }}>
          {modo.reorderMode ? 'Arraste pra reorganizar' : modo.colorMode ? 'Toque num módulo pra mudar a cor' : `${mods.length} disponíveis`}
        </span>
      }>Módulos</Rotulo>
      <div style={{ display:'grid', gap:ESPACO, gridTemplateColumns:'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {mods.map((m, i) => (
          <TileModulo key={m.id} m={m} i={i} largo={i === 0} cor={getModuleColor(m).color} modo={modo}
            onAbrir={modo.colorMode ? () => modo.onEscolherCor(m.id) : () => onSelect(m.atalho ? 'colaborador' : m.id, m.tab)}/>
        ))}
      </div>
    </div>

    {/* Direita — widgets */}
    <div style={{ flex:'0 0 clamp(320px, 29vw, 400px)', minWidth:0,
      display:'flex', flexDirection:'column', gap:20, padding:'4px 4px 12px' }}>
      <WidgetPerfil authUser={authUser} userPhoto={userPhoto} acoes={acoes}/>
      <WidgetAcessos authUser={authUser} onSelect={onSelect}/>
      <WidgetNovidades onSelect={onSelect}/>
    </div>
    </div>

    {sobreposicao}
  </div>
);

export { MenuLayoutNovo };
