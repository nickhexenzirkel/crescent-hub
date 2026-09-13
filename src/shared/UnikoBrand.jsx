/* ══════════════════════════════════════════════════════════════════════════
   MARCA "UNIKO · <legenda>" — cabeçalho da barra lateral
   Nasceu dentro do Portal do Colaborador (set/2026) e virou compartilhada em
   13/09/2026, quando a Oficina Estelar passou a usar o MESMO cabeçalho. É um
   componente só, e não duas cópias parecidas, justamente pra não desandarem
   uma da outra depois — quem quiser outro módulo com esse cabeçalho passa a
   `legenda` e pronto.

   Tipografia LIMPA: nome e legenda em cor sólida do tema — sem degradê, sem
   brilho externo, sem desfoque nas bordas. Ficou de fora o que era enfeite
   caro: o cometa com blur, o laço tracejado animado e as sombras drop-shadow
   em cada letra e estrela (drop-shadow animado repinta a cada frame).

   O nome UNIKO é desenhado com as MESMAS letras do resto do app (o N é um U
   invertido — ver `UnikoName` em ModuleSelector.jsx), em traço sólido com
   currentColor. SVG só pro wordmark; o resto é HTML, que o navegador
   rasteriza nítido em qualquer zoom.
══════════════════════════════════════════════════════════════════════════ */
import { T } from '../contexts/theme';

const UB_LETTERS = [
  'M18,18 L18,80 Q18,112 50,112 Q82,112 82,80 L82,18',                          // U
  'M128,112 L128,50 Q128,18 160,18 Q192,18 192,50 L192,112',                    // N
  'M238,18 L238,112',                                                          // I
  'M284,18 L284,112 M341,18 L286,65 L345,112',                                 // K
  'M430,18 Q469,18 469,65 Q469,112 430,112 Q391,112 391,65 Q391,18 430,18 Z',  // O
];

const BRAND_CSS = `
@keyframes ubFlutua { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .ub-logo { animation: none !important; } }
`;

export const UnikoBrandArt = ({ legenda }) => (
  <div style={{ width:'100%', display:'flex', alignItems:'center', gap:12 }}>
    <style>{BRAND_CSS}</style>
    {/* Logo recortada rente (UNIKO_LOGO.png) — o mascote enche o quadrado. Só
        flutua de leve por transform; nada de sombra ou brilho em volta. */}
    <img src="/UNIKO_LOGO.png" alt="Uniko" className="ub-logo" draggable={false}
      style={{ width:62, height:62, flexShrink:0, objectFit:'contain', display:'block',
        animation:'ubFlutua 4.5s ease-in-out infinite' }}/>
    <div style={{ minWidth:0, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6 }}>
      {/* alignSelf/alignItems no início: esticado na coluna, o SVG centralizava o nome. */}
      <svg viewBox="7 7 473 116" role="img" aria-label="UNIKO"
        style={{ height:30, width:'auto', display:'block', overflow:'visible', color:T.text }}>
        <g fill="none" stroke="currentColor" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
          {UB_LETTERS.map((d, i) => <path key={i} d={d}/>)}
        </g>
      </svg>
      <div style={{ fontFamily:'var(--font-brand)', fontSize:10, fontWeight:800, letterSpacing:'.06em',
        textTransform:'uppercase', color:T.gold, lineHeight:1.2, whiteSpace:'nowrap' }}>
        {legenda}
      </div>
    </div>
  </div>
);
