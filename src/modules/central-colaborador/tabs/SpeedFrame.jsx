import React from 'react';

/**
 * Moldura do Uniko Speed desenhada em vetor (SVG + CSS) — substitui os PNGs
 * borda-inicial.png / borda-nitro.png.
 *
 * A estrutura (banda metálica + neon) vive num SVG com preserveAspectRatio="none",
 * igual ao objectFit:'fill' que a imagem usava, então ela acompanha qualquer
 * proporção da área de jogo. Já os enfeites que não podem distorcer — textos,
 * emblema, mascote e bandeira — são HTML posicionado por cima, em escala real.
 *
 * `slot` abre um recorte em pílula no rodapé (onde o botão JOGAR aparece).
 */

const VB_W = 1680;
const VB_H = 950;

const PINK = '#ff3ea5';
const PINK_L = '#ff8ac9';
const CYAN = '#22d3ee';

// banda externa (octógono) e recorte interno — a diferença dos dois é a moldura
const OUTER = 'M 54,0 L 1626,0 L 1680,54 L 1680,896 L 1626,950 L 54,950 L 0,896 L 0,54 Z';
const INNER = 'M 98,62 L 1582,62 L 1622,102 L 1622,832 L 1582,872 L 98,872 L 58,832 L 58,102 Z';

/** barrinhas neon inclinadas que correm ao longo das bandas */
const Ticks = ({ x, y, n, w = 22, h = 26, gap = 30, color, skew = -22, opacity = 1 }) => (
  <g opacity={opacity}>
    {Array.from({ length: n }, (_, i) => (
      <rect key={i} x={x + i * gap} y={y} width={w} height={h} rx={4} fill={color}
        transform={`skewX(${skew})`} />
    ))}
  </g>
);

export const SpeedFrame = ({ slot = true, glow = 1, style }) => (
  <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}>
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
      <defs>
        {/* metal branco escovado */}
        <linearGradient id="sfMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".34" stopColor="#eef1f8" />
          <stop offset=".52" stopColor="#ffffff" />
          <stop offset=".78" stopColor="#dfe5f1" />
          <stop offset="1" stopColor="#c9d2e4" />
        </linearGradient>
        <linearGradient id="sfNeon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={PINK} />
          <stop offset=".5" stopColor={CYAN} />
          <stop offset="1" stopColor={PINK} />
        </linearGradient>
        <filter id="sfGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sfGlowSoft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="18" />
        </filter>

        {/* recorte da pílula no rodapé (slot do botão JOGAR) */}
        <mask id="sfCut">
          <rect width={VB_W} height={VB_H} fill="#fff" />
          {slot && <rect x="558" y="874" width="564" height="72" rx="36" fill="#000" />}
        </mask>
      </defs>

      <g mask="url(#sfCut)">
        {/* halo neon por trás da banda */}
        <g filter="url(#sfGlowSoft)" opacity={0.55 * glow}>
          <path d={OUTER} fill="none" stroke={PINK} strokeWidth="16" />
          <path d={INNER} fill="none" stroke={PINK} strokeWidth="20" />
        </g>

        {/* banda metálica */}
        <path d={`${OUTER} ${INNER}`} fillRule="evenodd" fill="url(#sfMetal)" />

        {/* sulcos internos da banda (dá o relevo) */}
        <path d={OUTER} fill="none" stroke="rgba(120,140,180,.55)" strokeWidth="2" />
        <path d={INNER} fill="none" stroke="rgba(120,140,180,.45)" strokeWidth="2" />

        {/* filetes neon nas duas bordas */}
        <g filter="url(#sfGlow)">
          <path d={OUTER} fill="none" stroke={PINK} strokeWidth="5" opacity={0.95 * glow} />
          <path d={INNER} fill="none" stroke="url(#sfNeon)" strokeWidth="5" opacity={0.95 * glow} />
        </g>

        {/* trilhos neon longos — topo e rodapé */}
        <g opacity={0.9 * glow}>
          <rect x="250" y="18" width="380" height="12" rx="6" fill={PINK} />
          <rect x="1050" y="18" width="380" height="12" rx="6" fill={PINK} />
          <rect x="300" y="906" width="330" height="12" rx="6" fill={PINK} />
          <rect x="1050" y="906" width="330" height="12" rx="6" fill={CYAN} />
          {/* laterais */}
          <rect x="16" y="230" width="11" height="200" rx="6" fill={PINK} />
          <rect x="16" y="520" width="11" height="200" rx="6" fill={PINK} />
          <rect x={VB_W - 27} y="230" width="11" height="200" rx="6" fill={PINK} />
          <rect x={VB_W - 27} y="520" width="11" height="200" rx="6" fill={CYAN} />
        </g>

        {/* barrinhas inclinadas */}
        <Ticks x={700} y={72} n={5} color={PINK_L} opacity={0.95 * glow} />
        <Ticks x={990} y={72} n={5} color={CYAN} opacity={0.9 * glow} />
        <Ticks x={430} y={884} n={5} color={PINK_L} opacity={0.9 * glow} />
        <Ticks x={1180} y={884} n={5} color={CYAN} opacity={0.9 * glow} />
        <Ticks x={92} y={196} n={3} w={16} h={20} gap={0} skew={0} color={PINK_L} opacity={0.8 * glow} />

        {/* placas de canto (chanfro) */}
        <g fill="none" stroke="rgba(120,140,180,.5)" strokeWidth="2">
          <path d="M 54,0 L 210,0 L 240,32 L 118,32 L 90,62" />
          <path d={`M ${VB_W - 54},0 L ${VB_W - 210},0 L ${VB_W - 240},32 L ${VB_W - 118},32 L ${VB_W - 90},62`} />
        </g>
      </g>
    </svg>

    {/* ══ enfeites em escala real (não distorcem) ══ */}
    <style>{SF_CSS}</style>

    {/* selo UNIKO NITRO */}
    <div className="sf-mark sf-mark-l">
      <div className="sf-uniko">UNIKO</div>
      <div className="sf-nitro">
        NITRO
        <span className="sf-slash" /><span className="sf-slash" /><span className="sf-slash" />
      </div>
    </div>

    {/* número 55 */}
    <div className="sf-mark sf-mark-r">
      <div className="sf-55">55</div>
      <div className="sf-dashes"><i /><i /><i /></div>
    </div>

    {/* emblema central do topo */}
    <div className="sf-emblem">
      <svg viewBox="0 0 120 84" width="100%" height="100%">
        <path d="M 8,4 L 112,4 L 96,44 L 60,80 L 24,44 Z"
          fill="url(#sfMetal)" stroke="rgba(120,140,180,.6)" strokeWidth="2" />
        <path d="M 34,24 L 86,24 L 60,60 Z" fill="none" stroke={PINK} strokeWidth="6"
          strokeLinejoin="round" filter="url(#sfGlow)" />
      </svg>
    </div>

    {/* mascote no canto inferior esquerdo */}
    <div className="sf-cat">
      <span className="sf-ear sf-ear-l" /><span className="sf-ear sf-ear-r" />
      <span className="sf-head">
        <span className="sf-face">
          <span className="sf-eye sf-eye-l" /><span className="sf-eye sf-eye-r" />
          <span className="sf-smile" />
        </span>
      </span>
    </div>

    {/* bandeira quadriculada no canto inferior direito */}
    <div className="sf-flag">
      <span className="sf-pole" /><span className="sf-cloth" />
    </div>
  </div>
);

const SF_CSS = `
.sf-mark { position:absolute; top:2.2%; font-family: var(--font-brand), sans-serif; line-height:1;
  font-style:italic; font-weight:900; text-align:left; }
.sf-mark-l { left:3.2%; }
.sf-mark-r { right:3.4%; text-align:right; }
.sf-uniko { font-size: clamp(13px, 1.95vh, 26px); color:${PINK};
  text-shadow: 0 0 10px rgba(255,62,165,.85), 0 0 24px rgba(255,62,165,.45); }
.sf-nitro { display:flex; align-items:center; gap:3px; margin-top:2px;
  font-size: clamp(9px, 1.25vh, 17px); color:${CYAN};
  text-shadow: 0 0 8px rgba(34,211,238,.8); }
.sf-slash { width:3px; height: clamp(8px, 1.1vh, 14px); background:${CYAN}; transform:skewX(-22deg);
  border-radius:1px; box-shadow:0 0 7px rgba(34,211,238,.9); }
.sf-slash:first-of-type { margin-left:4px; }
.sf-55 { font-size: clamp(17px, 2.5vh, 34px); color:${PINK};
  text-shadow: 0 0 10px rgba(255,62,165,.85), 0 0 24px rgba(255,62,165,.45); }
.sf-dashes { display:flex; gap:3px; justify-content:flex-end; margin-top:3px; }
.sf-dashes i { width:3px; height: clamp(6px, .95vh, 12px); background:${PINK}; transform:skewX(-22deg);
  border-radius:1px; box-shadow:0 0 7px rgba(255,62,165,.9); }

.sf-emblem { position:absolute; top:-0.5%; left:50%; transform:translateX(-50%);
  width: clamp(52px, 7.2vh, 104px); aspect-ratio: 120/84; }

/* mascote */
.sf-cat { position:absolute; left:1.1%; bottom:1%; width: clamp(56px, 8.6vh, 116px); aspect-ratio:1;
  filter: drop-shadow(0 6px 16px rgba(255,62,165,.45)); }
.sf-cat .sf-ear { position:absolute; top:-14%; width:30%; height:34%;
  background:linear-gradient(160deg,#fff,#dfe5f1); clip-path:polygon(50% 0,100% 100%,0 100%);
  border-radius:3px; }
.sf-cat .sf-ear::after { content:''; position:absolute; inset:26% 22% 8%;
  background:${CYAN}; clip-path:polygon(50% 0,100% 100%,0 100%); opacity:.85;
  box-shadow:0 0 10px rgba(34,211,238,.9); }
.sf-ear-l { left:9%; transform:rotate(-13deg); }
.sf-ear-r { right:9%; transform:rotate(13deg); }
.sf-head { position:absolute; inset:0; border-radius:50%;
  background: radial-gradient(circle at 32% 26%, #fff 0 38%, #e6ebf5 62%, #c3cde0 100%);
  box-shadow: inset 0 -6px 14px rgba(120,140,180,.35), 0 0 0 2px rgba(255,255,255,.85); }
.sf-face { position:absolute; inset:16%; border-radius:50%;
  background: radial-gradient(circle at 50% 45%, #1a1024 0 60%, #0a0610 100%);
  box-shadow: inset 0 0 12px rgba(255,62,165,.35), 0 0 0 2px rgba(255,255,255,.9);
  display:block; }
.sf-eye { position:absolute; top:33%; width:26%; height:15%; background:${PINK}; border-radius:2px;
  box-shadow:0 0 10px ${PINK}, 0 0 20px rgba(255,62,165,.75); }
.sf-eye-l { left:14%; transform:skewX(20deg) rotate(9deg); }
.sf-eye-r { right:14%; transform:skewX(-20deg) rotate(-9deg); }
.sf-smile { position:absolute; left:29%; right:29%; top:56%; height:22%;
  border:3px solid ${PINK}; border-top:0; border-radius:0 0 999px 999px;
  box-shadow:0 0 10px rgba(255,62,165,.8); }

/* bandeira quadriculada */
.sf-flag { position:absolute; right:2.4%; bottom:2%; width: clamp(46px, 7vh, 96px); aspect-ratio: 1/1.15; }
.sf-pole { position:absolute; left:6%; bottom:0; width:7%; height:100%; border-radius:999px;
  background:linear-gradient(90deg,#f2f5fb,#aab4c8); }
.sf-pole::before { content:''; position:absolute; top:-9%; left:-90%; width:280%; aspect-ratio:1;
  border-radius:50%; background:radial-gradient(circle at 34% 30%, #6b7484, #171a22); }
.sf-cloth { position:absolute; left:13%; top:6%; width:87%; height:62%;
  background: repeating-conic-gradient(#12141a 0 25%, #ffffff 0 50%) 0 0 / 22% 33%;
  clip-path: polygon(0 0, 100% 6%, 100% 100%, 0 88%);
  box-shadow: 0 4px 14px rgba(0,0,0,.35); }

@media (prefers-reduced-motion: reduce) { .sf-cat, .sf-flag { filter:none; } }
`;

export default SpeedFrame;
