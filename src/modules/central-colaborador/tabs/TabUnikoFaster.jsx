// src/modules/central-colaborador/tabs/TabUnikoFaster.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO FASTER (EM DESENVOLVIMENTO) — jogo de corrida em 1ª pessoa estilo
// Outrun/Asphalt, com a música tocando no fundo.
//
// COMO FUNCIONA O 3D: é pseudo-3D clássico (o mesmo truque do Outrun) — a pista
// é uma lista de SEGMENTOS com profundidade z; cada segmento é projetado na tela
// com perspectiva (quanto mais longe, menor). Curvas = deslocamento lateral
// acumulado por segmento; ladeiras = variação de altura. Sem WebGL, tudo em
// canvas 2D, roda liso em qualquer máquina.
//
// MÚSICA: iframe OCULTO do YouTube (autoplay+loop), mesma abordagem do Uniko
// Wave. O jogador escolhe da BIBLIOTECA (lista embutida + o que ele salvou no
// Uniko Wave, lido do localStorage dw_library_v2) ou cola um LINK do YouTube.
// A música é só trilha de fundo — não afeta a física (por enquanto).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo } from 'react';
import { T } from '../../../contexts/theme';

/* ── Música ──────────────────────────────────────────────────────────────── */
// Biblioteca embutida (mesmos IDs das músicas iniciais do Uniko Wave).
const TRILHAS = [
  { vid: 'Dst9gZkq1a8', title: 'Goosebumps — Travis Scott' },
  { vid: 'pzPElFdxMCM', title: 'Shinigami Eyes — Grimes' },
  { vid: 'r20zq0QfVM4', title: 'Desgraça — Anitta' },
  { vid: 'lIxQe1R5hs0', title: 'Stateside — PinkPantheress' },
  { vid: 'i0p1bmr0EmE', title: 'What Is Love? — TWICE' },
  { vid: 's49rOuVY3s0', title: 'Vira Lata — João Gomes, Pabllo Vittar' },
  { vid: '0-mKwNMXETo', title: 'Lud Session #2 — Ludmilla' },
  { vid: 'q0u47Nl7N7M', title: 'Lua Cheia — Marina Sena' },
];
const getYTId = (url) => {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|\/embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : (/^[a-zA-Z0-9_-]{11}$/.test((url || '').trim()) ? url.trim() : null);
};
// Músicas que o jogador salvou no Uniko Wave (mesmo navegador/conta).
const bibliotecaSalva = () => {
  try {
    const raw = JSON.parse(localStorage.getItem('dw_library_v2') || '[]');
    return (Array.isArray(raw) ? raw : []).filter(x => x?.vid).map(x => ({ vid: x.vid, title: x.title || 'Música salva' }));
  } catch { return []; }
};

/* ── Pista (pseudo-3D) ───────────────────────────────────────────────────── */
const SEG_LEN = 200;          // comprimento de um segmento no "mundo"
const RUMBLE = 3;             // segmentos por faixa de zebra
const ROAD_W = 2200;          // meia-largura da pista
const LANES = 3;
const CAM_H = 1000;           // altura da câmera
const CAM_D = 0.84;           // distância da câmera ao plano (fov)
const DRAW_N = 260;           // segmentos desenhados à frente
const MAX_SPEED = SEG_LEN * 60;
const ACCEL = MAX_SPEED / 4.5;
const BRAKE = -MAX_SPEED / 2.2;
const DECEL = -MAX_SPEED / 5.5;
const OFFROAD_DECEL = -MAX_SPEED / 2;
const OFFROAD_MAX = MAX_SPEED / 4.2;
const CENTRIFUGAL = 0.32;

const COR = {
  ceu1: '#2a1a55', ceu2: '#7c3aed', ceu3: '#ec4899',
  grama: ['#1f7a4d', '#1a6b43'], zebra: ['#ffffff', '#e63946'],
  pista: ['#4a4a5a', '#414150'], linha: '#f4f4f8',
};
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Constrói a pista: retas, curvas e ladeiras encadeadas (loopável).
function montarPista() {
  const segs = [];
  const add = (curve, y) => {
    const n = segs.length;
    segs.push({
      index: n, curve, p1y: lastY(), p2y: y,
      cor: Math.floor(n / RUMBLE) % 2 ? 'dark' : 'light',
      carros: [],
    });
  };
  function lastY() { return segs.length ? segs[segs.length - 1].p2y : 0; }
  const trecho = (n, curve, dy) => {
    const yBase = lastY();
    for (let i = 0; i < n; i++) {
      const y = yBase + dy * (Math.sin((i / n) * Math.PI - Math.PI / 2) / 2 + 0.5);
      add(curve * (Math.sin((i / n) * Math.PI)), y);   // curva sobe e desce suave
    }
  };
  // sequência: reta, curva dir, subida, curva esq, reta longa, descida...
  trecho(70, 0, 0);         // largada reta e limpa
  trecho(50, 4, 300);
  trecho(45, -3, 0);
  trecho(60, 0, -200);
  trecho(50, -5, 400);
  trecho(45, 3, 0);
  trecho(70, 2, -300);
  trecho(50, -4, 150);
  // FECHA O LOOP suave: traz a altura de volta a 0 (senão há um DEGRAU entre o
  // último segmento e o primeiro, e a pista "reseta"/salta ao dar a volta). As
  // curvas já voltam a 0 sozinhas (sin), só a altura acumulava.
  trecho(60, 0, -segs[segs.length - 1].p2y);
  // pequenos OBSTÁCULOS pra desviar (cones), espalhados e RAROS — antes eram 28
  // carros e a pista ficava intransitável. Poucos, e nunca dois seguidos.
  let ultimo = -99;
  for (let i = 50; i < segs.length - 8; i += Math.floor(rnd(14, 26))) {
    if (i - ultimo < 12) continue;
    segs[i].obstaculos = [{ x: rnd(-0.7, 0.7) }];
    ultimo = i;
  }
  return segs;
}

// Rivais que CORREM comigo (têm posição e velocidade próprias na pista).
function montarRivais(trackLen) {
  const cores = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#e879f9', '#06b6d4'];
  return Array.from({ length: 5 }, (_, i) => ({
    pos: (i + 1) * (trackLen * 0.012),          // largam logo à frente
    x: rnd(-0.6, 0.6),
    cor: cores[i % cores.length],
    speed: MAX_SPEED * rnd(0.72, 0.9),          // cada um num ritmo
    nome: `Rival ${i + 1}`,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE
   ═══════════════════════════════════════════════════════════════════════════ */
const TabUnikoFaster = () => {
  const [tela, setTela] = useState('menu');   // menu | correndo
  const [trilha, setTrilha] = useState(null); // {vid, title}
  const [link, setLink] = useState('');
  const [erroLink, setErroLink] = useState('');
  const [pausado, setPausado] = useState(false);
  const [hud, setHud] = useState({ vel: 0, dist: 0, best: 0 });
  const cardBg = T.surface || '#fff';

  const salvas = useMemo(() => bibliotecaSalva(), []);
  const biblioteca = useMemo(() => {
    const vistos = new Set();
    return [...TRILHAS, ...salvas].filter(m => (vistos.has(m.vid) ? false : (vistos.add(m.vid), true)));
  }, [salvas]);

  // recorde: state (mostrado no menu) + ref (atualizado no loop do jogo sem re-render)
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('uf_best') || 0); } catch { return 0; } });
  const bestRef = useRef(best);

  const jogarLink = () => {
    const vid = getYTId(link);
    if (!vid) { setErroLink('Link do YouTube inválido — cole a URL do vídeo.'); return; }
    setErroLink('');
    setTrilha({ vid, title: 'Sua música do YouTube' });
    setTela('correndo');
  };
  const jogar = (m) => { setTrilha(m); setTela('correndo'); };

  /* ── MENU ── */
  if (tela === 'menu') {
    return (
      // rola dentro do container (que é de altura fixa por causa da fase de corrida)
      <div style={{ height: '100%', overflowY: 'auto', padding: '2px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 20 }}>
        <style>{FASTER_CSS}</style>
        {/* Cabeçalho neon */}
        <div style={{ borderRadius: 18, padding: '22px 24px', position: 'relative', overflow: 'hidden',
          background: `linear-gradient(120deg, #1a0b3d 0%, #4c1d95 55%, #db2777 130%)`,
          boxShadow: '0 12px 34px rgba(120,40,200,.35)' }}>
          <div className="uf-grid" />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-block', padding: '3px 11px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
              letterSpacing: '.08em', background: 'rgba(0,0,0,.28)', color: '#ffd166', marginBottom: 8 }}>
              EM DESENVOLVIMENTO
            </div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 34, fontWeight: 800, color: '#fff',
              letterSpacing: '.02em', lineHeight: 1, textShadow: '0 3px 20px rgba(0,0,0,.5)' }}>
              UNIKO <span style={{ color: '#22d3ee' }}>FASTER</span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', marginTop: 8, maxWidth: 460, lineHeight: 1.5 }}>
              Corrida em 1ª pessoa com a sua música no volume máximo. Escolha a trilha e acelera! 🏎️💨
            </div>
          </div>
        </div>

        {/* Link do YouTube */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, boxShadow: T.sh }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 9 }}>🔗 Cole um link do YouTube</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={link} onChange={e => setLink(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && jogarLink()}
              placeholder="https://youtube.com/watch?v=..."
              style={{ flex: 1, padding: '11px 13px', borderRadius: 10, border: `1px solid ${T.border}`,
                background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 13.5,
                fontFamily: 'var(--font-body)', outline: 'none' }} />
            <button className="uf-btn" onClick={jogarLink}
              style={{ padding: '11px 22px', borderRadius: 10, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800,
                cursor: 'pointer', background: 'linear-gradient(135deg, #7c3aed, #db2777)', whiteSpace: 'nowrap' }}>
              Correr ▸
            </button>
          </div>
          {erroLink && <div style={{ fontSize: 12, color: '#E63946', marginTop: 7 }}>{erroLink}</div>}
        </div>

        {/* Biblioteca */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, boxShadow: T.sh }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 4 }}>🎵 Ou escolha da biblioteca</div>
          <div style={{ fontSize: 11.5, color: T.textT, marginBottom: 12 }}>
            Músicas iniciais + o que você salvou no Uniko Wave.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 9 }}>
            {biblioteca.map(m => (
              <button key={m.vid} className="uf-btn uf-song" onClick={() => jogar(m)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 9, borderRadius: 11, cursor: 'pointer',
                  border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.02)', textAlign: 'left' }}>
                <img src={`https://i.ytimg.com/vi/${m.vid}/mqdefault.jpg`} alt="" loading="lazy"
                  style={{ width: 54, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0, background: '#0002' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: US_ACCENT, fontWeight: 700, marginTop: 2 }}>▸ correr</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {best > 0 && (
          <div style={{ textAlign: 'center', fontSize: 12.5, color: T.textT }}>
            🏁 Seu recorde: <b style={{ color: T.text }}>{best.toLocaleString('pt-BR')} m</b>
          </div>
        )}
      </div>
      </div>
    );
  }

  /* ── CORRIDA ── */
  return (
    <Corrida trilha={trilha} bestRef={bestRef} setBest={setBest} hud={hud} setHud={setHud}
      pausado={pausado} setPausado={setPausado}
      onSair={() => { setTela('menu'); setPausado(false); }} />
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CORRIDA — canvas pseudo-3D + iframe de música
   ═══════════════════════════════════════════════════════════════════════════ */
const Corrida = ({ trilha, bestRef, setBest, hud, setHud, pausado, setPausado, onSair }) => {
  const canvasRef = useRef(null);
  const teclas = useRef({});
  const estado = useRef(null);
  const rafRef = useRef(0);
  const pausadoRef = useRef(pausado);
  useEffect(() => { pausadoRef.current = pausado; }, [pausado]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pista = montarPista();
    const trackLen = pista.length * SEG_LEN;
    const rivais = montarRivais(trackLen);
    const st = { pos: 0, playerX: 0, speed: 0, tempo: 0, batendo: 0 };
    estado.current = st;

    const dpr = () => Math.min(devicePixelRatio || 1, 2);
    const W = () => canvas.offsetWidth, H = () => canvas.offsetHeight;
    const resize = () => { canvas.width = W() * dpr(); canvas.height = H() * dpr(); };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Projeta um ponto do mundo (x,y,z relativo à câmera) → tela.
    const project = (p, camX, camY, camZ, w, h, roadW) => {
      const cz = p.z - camZ || 0.0001;
      const scale = CAM_D / cz;
      p.sx = Math.round(w / 2 + scale * (p.x - camX) * w / 2);
      p.sy = Math.round(h / 2 - scale * (p.y - camY) * h / 2);
      p.sw = Math.round(scale * roadW * w / 2);
      p.scale = scale;
    };

    const quad = (x1, y1, w1, x2, y2, w2, cor) => {
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2);
      ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1);
      ctx.closePath(); ctx.fill();
    };

    // Desenha um carro adversário (retângulo com cabine + rodas), escalado.
    const drawCarro = (cx, cy, larg, cor) => {
      const w = larg, h = w * 0.62;
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.05, w * 0.6, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cor;
      rr(ctx, cx - w / 2, cy - h, w, h, h * 0.22); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      rr(ctx, cx - w * 0.32, cy - h * 0.82, w * 0.64, h * 0.4, h * 0.12); ctx.fill();
      ctx.fillStyle = '#1a1a24';
      ctx.fillRect(cx - w * 0.52, cy - h * 0.28, w * 0.12, h * 0.3);
      ctx.fillRect(cx + w * 0.4, cy - h * 0.28, w * 0.12, h * 0.3);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(cx - w * 0.4, cy - h * 0.14, w * 0.12, h * 0.1);
      ctx.fillRect(cx + w * 0.28, cy - h * 0.14, w * 0.12, h * 0.1);
    };

    // Cone de obstáculo (pequeno, dá pra desviar).
    const drawCone = (cx, cy, larg) => {
      const w = larg * 0.5, h = w * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.7, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6a00';
      ctx.beginPath(); ctx.moveTo(cx, cy - h); ctx.lineTo(cx - w * 0.55, cy); ctx.lineTo(cx + w * 0.55, cy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - w * 0.42, cy - h * 0.55, w * 0.84, h * 0.16);
      ctx.fillRect(cx - w * 0.5, cy - h * 0.05, w, h * 0.06);
    };

    // Capô do jogador (1ª pessoa) — desenhado no rodapé, inclina na curva.
    const drawCapo = (w, h, steer, tremor) => {
      ctx.save();
      ctx.translate(w / 2 + steer * w * 0.04, h + tremor);
      const cw = w * 0.66, ch = h * 0.26;
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(0, -ch * 0.1, cw * 0.6, ch * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      // corpo do capô
      const g = ctx.createLinearGradient(0, -ch, 0, 0);
      g.addColorStop(0, '#e11d74'); g.addColorStop(1, '#7c1d52');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-cw / 2, 0); ctx.lineTo(-cw * 0.36, -ch);
      ctx.lineTo(cw * 0.36, -ch); ctx.lineTo(cw / 2, 0); ctx.closePath(); ctx.fill();
      // faixa central
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(-cw * 0.03, -ch, cw * 0.06, ch);
      // para-brisa reflexo
      ctx.fillStyle = 'rgba(90,220,255,.25)';
      ctx.beginPath();
      ctx.moveTo(-cw * 0.34, -ch); ctx.lineTo(cw * 0.34, -ch);
      ctx.lineTo(cw * 0.24, -ch * 1.5); ctx.lineTo(-cw * 0.24, -ch * 1.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    };

    const drawCeu = (w, h, curveAccum) => {
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.62);
      g.addColorStop(0, COR.ceu1); g.addColorStop(0.6, COR.ceu2); g.addColorStop(1, COR.ceu3);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.62);
      // sol
      const sx = w / 2 - curveAccum * 0.5, sy = h * 0.36;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * 0.3);
      sg.addColorStop(0, 'rgba(255,220,120,.95)'); sg.addColorStop(0.5, 'rgba(255,120,180,.5)'); sg.addColorStop(1, 'rgba(255,120,180,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, h * 0.3, 0, Math.PI * 2); ctx.fill();
      // listras do sol (retrowave)
      ctx.fillStyle = 'rgba(20,10,40,.5)';
      for (let i = 0; i < 6; i++) ctx.fillRect(sx - h * 0.2, sy - h * 0.02 + i * h * 0.03, h * 0.4, h * 0.012);
    };

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = W(), h = H(), d = dpr();
      ctx.setTransform(d, 0, 0, d, 0, 0);

      if (!pausadoRef.current) {
        st.tempo += dt;
        // aceleração / freio
        const acelerando = teclas.current.up || teclas.current.w || (!teclas.current.down && !teclas.current.s);
        if (teclas.current.down || teclas.current.s) st.speed += BRAKE * dt;
        else if (acelerando) st.speed += ACCEL * dt;
        else st.speed += DECEL * dt;
        // fora da pista freia
        const fora = Math.abs(st.playerX) > 1;
        if (fora && st.speed > OFFROAD_MAX) st.speed += OFFROAD_DECEL * dt;
        if (st.batendo > 0) { st.batendo -= dt; st.speed = Math.min(st.speed, MAX_SPEED * 0.35); }
        st.speed = clamp(st.speed, 0, MAX_SPEED);
        // direção
        const dx = dt * 2 * (st.speed / MAX_SPEED);
        if (teclas.current.left || teclas.current.a) st.playerX -= dx;
        if (teclas.current.right || teclas.current.d) st.playerX += dx;
        // centrífuga na curva
        const segAtual = pista[Math.floor(st.pos / SEG_LEN) % pista.length];
        st.playerX -= dx * CENTRIFUGAL * (st.speed / MAX_SPEED) * (segAtual.curve || 0);
        st.playerX = clamp(st.playerX, -2, 2);
        // anda
        st.pos = (st.pos + st.speed * dt) % trackLen;
        if (st.pos < 0) st.pos += trackLen;
        // RIVAIS correm: cada um avança na sua velocidade e vagueia de leve na
        // pista. Colisão traseira: se eu encostar num rival, os dois perdem ritmo.
        rivais.forEach(r => {
          r.pos = (r.pos + r.speed * dt) % trackLen;
          r.x = clamp(r.x + Math.sin(st.tempo * 0.6 + r.pos) * 0.004, -0.85, 0.85);
          let dz = r.pos - st.pos; if (dz < -trackLen / 2) dz += trackLen; if (dz > trackLen / 2) dz -= trackLen;
          if (Math.abs(dz) < SEG_LEN * 1.2 && Math.abs(r.x - st.playerX) < 0.45 && st.batendo <= 0) {
            st.batendo = 0.5; r.speed = Math.min(r.speed, MAX_SPEED * 0.6);
          }
        });
      }

      const baseSeg = Math.floor(st.pos / SEG_LEN);
      const camH = CAM_H + pista[baseSeg % pista.length].p1y;
      let x = 0, dx2 = 0;

      drawCeu(w, h, pista[baseSeg % pista.length].curve * 40);
      // base de grama cobrindo tudo abaixo do horizonte — evita cantos pretos onde
      // a pista (por causa de ladeira/curva) não chega até o rodapé.
      ctx.fillStyle = COR.grama[1];
      ctx.fillRect(0, h * 0.44, w, h * 0.56);

      let maxY = h;
      // desenha os segmentos de trás pra frente
      const pontos = [];
      for (let n = 0; n < DRAW_N; n++) {
        const seg = pista[(baseSeg + n) % pista.length];
        const loop = baseSeg + n >= pista.length;
        const camZbase = st.pos - (loop ? trackLen : 0);
        const p1 = { x: x, y: seg.p1y, z: (baseSeg + n) * SEG_LEN - camZbase };
        x += dx2; dx2 += seg.curve;
        const p2 = { x: x, y: seg.p2y, z: (baseSeg + n + 1) * SEG_LEN - camZbase };
        project(p1, st.playerX * ROAD_W, camH, 0, w, h, ROAD_W);
        project(p2, st.playerX * ROAD_W, camH, 0, w, h, ROAD_W);
        pontos.push({ seg, p1, p2 });
      }

      // Desenha de PERTO pra LONGE (n=0 é o mais próximo). O clip `maxY` faz cada
      // segmento mais distante pintar só ACIMA do anterior (nunca por cima), então
      // não há sobreposição e ladeiras escondem o que vem atrás. Iterar ao contrário
      // (o que eu tinha feito) desenhava só o horizonte e a pista sumia.
      for (let n = 0; n < pontos.length; n++) {
        const { seg, p1, p2 } = pontos[n];
        if (p1.z <= CAM_D || p2.sy >= maxY) continue;
        maxY = p2.sy;
        const escuro = seg.cor === 'dark';
        // grama
        ctx.fillStyle = COR.grama[escuro ? 0 : 1];
        ctx.fillRect(0, p2.sy, w, p1.sy - p2.sy + 1);
        // zebra lateral
        quad(p1.sx, p1.sy, p1.sw * 1.15, p2.sx, p2.sy, p2.sw * 1.15, COR.zebra[escuro ? 0 : 1]);
        // pista
        quad(p1.sx, p1.sy, p1.sw, p2.sx, p2.sy, p2.sw, COR.pista[escuro ? 0 : 1]);
        // faixas de divisão de pista
        if (!escuro) {
          for (let l = 1; l < LANES; l++) {
            const lx1 = p1.sx - p1.sw + (2 * p1.sw) * (l / LANES);
            const lx2 = p2.sx - p2.sw + (2 * p2.sw) * (l / LANES);
            quad(lx1, p1.sy, p1.sw * 0.012, lx2, p2.sy, p2.sw * 0.012, COR.linha);
          }
        }
      }

      // Distribui os RIVAIS nos segmentos visíveis (bucket por profundidade).
      const spritesPorSeg = {};
      rivais.forEach(r => {
        let dz = r.pos - st.pos; if (dz < 0) dz += trackLen;
        const nSeg = Math.round(dz / SEG_LEN);
        if (nSeg >= 0 && nSeg < pontos.length) (spritesPorSeg[nSeg] = spritesPorSeg[nSeg] || []).push(r);
      });

      // Obstáculos (cones) + rivais, de LONGE pra PERTO (perto por cima).
      for (let n = pontos.length - 1; n >= 0; n--) {
        const { seg, p1 } = pontos[n];
        if (p1.z <= CAM_D) continue;
        // cones
        (seg.obstaculos || []).forEach(o => {
          const cx = p1.sx + o.x * p1.sw, larg = p1.sw * 0.42;
          if (larg < 2) return;
          drawCone(cx, p1.sy, larg);
          if (n < 3 && Math.abs(o.x - st.playerX) < 0.28 && st.batendo <= 0 && !pausadoRef.current) st.batendo = 0.45;
        });
        // rivais
        (spritesPorSeg[n] || []).forEach(r => {
          const cx = p1.sx + r.x * p1.sw, larg = p1.sw * 0.5;
          if (larg < 2) return;
          drawCarro(cx, p1.sy, larg, r.cor);
        });
      }

      // capô do jogador
      const steer = (teclas.current.left || teclas.current.a ? -1 : 0) + (teclas.current.right || teclas.current.d ? 1 : 0);
      const tremor = st.speed > MAX_SPEED * 0.7 ? Math.sin(st.tempo * 40) * 1.5 : 0;
      drawCapo(w, h, steer + st.playerX * 0.3, tremor + (st.batendo > 0 ? Math.sin(st.tempo * 60) * 4 : 0));

      // flash de batida
      if (st.batendo > 0) {
        ctx.fillStyle = `rgba(255,40,40,${st.batendo * 0.4})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── MINIMAPA REDONDO (canto inf. dir.): o circuito é um loop, então vira um
      //    anel; cada carro é um ponto na sua volta (progresso → ângulo). Dá pra
      //    ver quem está na frente. ──
      const mmR = Math.min(w, h) * 0.11, mmX = w - mmR - 22, mmY = h - mmR - 22;
      const ang = (p) => (p / trackLen) * Math.PI * 2 - Math.PI / 2;   // 0 no topo
      const ponto = (p) => [mmX + Math.cos(ang(p)) * mmR, mmY + Math.sin(ang(p)) * mmR];
      ctx.save();
      ctx.beginPath(); ctx.arc(mmX, mmY, mmR + 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,6,22,.6)'; ctx.fill();
      ctx.beginPath(); ctx.arc(mmX, mmY, mmR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(3, mmR * 0.16); ctx.stroke();
      rivais.forEach(r => { const [px, py] = ponto(r.pos); ctx.fillStyle = r.cor; ctx.beginPath(); ctx.arc(px, py, mmR * 0.12, 0, Math.PI * 2); ctx.fill(); });
      const [ex, ey] = ponto(st.pos);   // você = ponto branco maior com anel ciano
      ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(ex, ey, mmR * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();

      // HUD (atualiza o React ~4x/s)
      if (!pausadoRef.current && Math.floor(st.tempo * 4) !== Math.floor((st.tempo - dt) * 4)) {
        const distM = Math.floor(st.pos / 100);   // "metros"
        const b = Math.max(bestRef.current, distM);
        if (b > bestRef.current) { bestRef.current = b; setBest(b); try { localStorage.setItem('uf_best', String(b)); } catch { /* sem storage */ } }
        setHud({ vel: Math.floor(st.speed / SEG_LEN * 4), dist: distM, best: b });
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    const kd = (e) => { setTecla(e, true); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault(); };
    const ku = (e) => setTecla(e, false);
    const setTecla = (e, v) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup') teclas.current.up = v;
      if (k === 'arrowdown') teclas.current.down = v;
      if (k === 'arrowleft') teclas.current.left = v;
      if (k === 'arrowright') teclas.current.right = v;
      if ('wasd'.includes(k)) teclas.current[k] = v;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      cancelAnimationFrame(rafRef.current); ro.disconnect();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    };
  }, [bestRef, setBest, setHud]);

  // botões de toque (celular) — setam as mesmas flags
  const touch = (dir, v) => { teclas.current[dir] = v; };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0,
      borderRadius: 16, overflow: 'hidden', background: '#0a0616' }}>
      <style>{FASTER_CSS}</style>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />

      {/* Música — iframe oculto (autoplay + loop) */}
      {trilha?.vid && (
        <iframe title="trilha" aria-hidden width="1" height="1" allow="autoplay"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0 }}
          src={`https://www.youtube.com/embed/${trilha.vid}?autoplay=1&controls=0&loop=1&playlist=${trilha.vid}&playsinline=1&modestbranding=1`} />
      )}

      {/* HUD */}
      <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', pointerEvents: 'none' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 40, fontWeight: 800, color: '#fff', lineHeight: 1,
            textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>
            {hud.vel}<span style={{ fontSize: 15, opacity: .8 }}> km/h</span>
          </div>
          <div style={{ fontSize: 13, color: '#22d3ee', fontWeight: 800, marginTop: 4, textShadow: '0 2px 8px rgba(0,0,0,.6)' }}>
            {hud.dist.toLocaleString('pt-BR')} m · 🏁 {hud.best.toLocaleString('pt-BR')} m
          </div>
        </div>
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: 8 }}>
          <button className="uf-btn" onClick={() => setPausado(p => !p)}
            style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.3)',
              background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {pausado ? '▸ Continuar' : '⏸ Pausar'}
          </button>
          <button className="uf-btn" onClick={onSair}
            style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.3)',
              background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            ✕ Sair
          </button>
        </div>
      </div>

      {/* faixa da música tocando */}
      {trilha?.title && (
        <div style={{ position: 'absolute', bottom: 12, left: 14, display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,.5)', pointerEvents: 'none',
          maxWidth: '70%' }}>
          <span className="uf-note">🎵</span>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>{trilha.title}</span>
        </div>
      )}

      {/* controles de toque (celular) */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 12, pointerEvents: 'none' }}>
        {[['left', '◀'], ['right', '▶']].map(([dir, ic]) => (
          <button key={dir} className="uf-touch"
            onPointerDown={() => touch(dir, true)} onPointerUp={() => touch(dir, false)}
            onPointerLeave={() => touch(dir, false)} onContextMenu={e => e.preventDefault()}
            style={{ pointerEvents: 'auto', width: 62, height: 62, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,.35)', background: 'rgba(124,58,237,.5)',
              color: '#fff', fontSize: 22, cursor: 'pointer', touchAction: 'none' }}>{ic}</button>
        ))}
      </div>

      {/* overlay de pausa */}
      {pausado && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 14, background: 'rgba(10,6,22,.72)', backdropFilter: 'blur(3px)' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 30, fontWeight: 800, color: '#fff' }}>Pausado</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>Setas ou A/D pra virar · ↑ acelera · ↓ freia</div>
          <button className="uf-btn" onClick={() => setPausado(false)}
            style={{ padding: '11px 28px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>▸ Continuar</button>
        </div>
      )}
    </div>
  );
};

// retângulo arredondado
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const US_ACCENT = '#7c3aed';
const FASTER_CSS = `
@keyframes ufGrid { 0% { background-position: 0 0; } 100% { background-position: 0 40px; } }
.uf-grid { position: absolute; inset: 0; opacity: .18; pointer-events: none;
  background-image: linear-gradient(rgba(34,211,238,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.5) 1px, transparent 1px);
  background-size: 40px 40px; animation: ufGrid 1.2s linear infinite; mask-image: linear-gradient(transparent, #000 80%); }
.uf-btn { transition: transform .12s, filter .12s; }
.uf-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
.uf-btn:active:not(:disabled) { transform: translateY(1px) scale(.98); }
.uf-song:hover { border-color: ${US_ACCENT}88 !important; }
.uf-touch:active { background: rgba(124,58,237,.85) !important; }
@keyframes ufNote { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-2px) rotate(6deg); } }
.uf-note { display: inline-block; animation: ufNote .6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .uf-grid, .uf-note { animation: none !important; } }
`;

export { TabUnikoFaster };
export default TabUnikoFaster;
