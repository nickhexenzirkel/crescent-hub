// src/modules/central-colaborador/tabs/TabUnikoCamera.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO CAMERA — câmera com estética de MacBook/Photo Booth: bezel "space
// gray" com luzinhas de janela, filtros de cor, melhorador de qualidade
// (nitidez real aplicada só na captura, nunca no preview ao vivo — convolução
// pixel a pixel a cada frame do vídeo derrubaria o FPS) e papel de parede
// DECORATIVO atrás da janela da câmera (não recorta a pessoa — isso exigiria
// um modelo de segmentação rodando no navegador; decidido junto com o usuário
// manter só o visual "desktop do Mac" por trás, bem mais leve).
//
// GALERIA: cada foto vai pro bucket 'uniko-camera' (Storage) + uma linha em
// `uniko_camera_photos` (owner = nome de quem tirou). Liberado pra todo
// mundo, mas cada um só VÊ as próprias fotos — a "privacidade" é um filtro
// `.eq('owner', me)` no client (mesmo padrão de `reminders`/outras tabelas
// pessoais do Portal: chave anon, sem Supabase Auth de verdade).
//
// PRECISA rodar supabase_uniko_camera.sql antes de usar.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER } from '../../../contexts/user';
import { useIsMobile } from '../../../hooks/useIsMobile';

/* ── ícone svg genérico (mesmo padrão usado nas outras abas) ────────────── */
const Sic = ({ children, size = 16, stroke = 'currentColor', sw = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block', ...style }}>{children}</svg>
);

const ACCENT = '#0A84FF'; // azul macOS — identidade própria desta aba, igual o Uniko Paint tem a dele

/* ── Filtros de cor ───────────────────────────────────────────────────────
   `css` vira o `filter` do <video> (preview) E do canvas (captura, via
   ctx.filter — suportado nos navegadores modernos). `swatch` é só o
   gradiente do botão, não precisa refletir o filtro pixel a pixel. */
const FILTERS = [
  { id: 'original', nome: 'Original',  css: 'none', swatch: 'linear-gradient(135deg,#eee,#aaa)' },
  { id: 'pb',       nome: 'P&B',       css: 'grayscale(1) contrast(1.1)', swatch: 'linear-gradient(135deg,#fff,#111)' },
  { id: 'noir',     nome: 'Noir',      css: 'grayscale(1) contrast(1.45) brightness(.88)', swatch: 'linear-gradient(135deg,#555,#000)' },
  { id: 'sepia',    nome: 'Sépia',     css: 'sepia(.75) contrast(1.05) brightness(1.02) saturate(1.1)', swatch: 'linear-gradient(135deg,#e2bb8c,#5c3a1e)' },
  { id: 'vivido',   nome: 'Vívido',    css: 'saturate(1.8) contrast(1.15)', swatch: 'linear-gradient(135deg,#ff5da2,#5b8dff)' },
  { id: 'frio',     nome: 'Frio',      css: 'saturate(1.2) hue-rotate(-12deg) brightness(1.03) contrast(1.05)', swatch: 'linear-gradient(135deg,#9fdcff,#3a5bdc)' },
  { id: 'quente',   nome: 'Quente',    css: 'saturate(1.25) hue-rotate(8deg) sepia(.18) brightness(1.04) contrast(1.05)', swatch: 'linear-gradient(135deg,#ffd28f,#ff7a3a)' },
  { id: 'vintage',  nome: 'Vintage',   css: 'sepia(.4) saturate(.7) contrast(.95) brightness(1.06)', swatch: 'linear-gradient(135deg,#ecd9b4,#8a6b45)' },
  { id: 'dramatico',nome: 'Dramático', css: 'contrast(1.5) saturate(.55) brightness(.94)', swatch: 'linear-gradient(135deg,#777,#111)' },
  { id: 'pastel',   nome: 'Pastel',    css: 'saturate(.85) brightness(1.1) contrast(.9)', swatch: 'linear-gradient(135deg,#ffd6e8,#c9e8ff)' },
  { id: 'indie',    nome: 'Indie',     css: 'contrast(.92) saturate(.82) brightness(1.1) sepia(.15) hue-rotate(-8deg)', swatch: 'linear-gradient(135deg,#e4e0c8,#8a9a6b)' },
];
const ENHANCE_CSS = 'contrast(1.08) saturate(1.12) brightness(1.04)';

/* ── Papéis de parede decorativos (gradientes só em CSS, sem baixar imagem) ── */
const WALLPAPERS = [
  { id: 'grafite', nome: 'Grafite',    css: 'radial-gradient(120% 120% at 20% 0%, #4b4f57 0%, #2b2d33 45%, #16171a 100%)' },
  { id: 'aurora',  nome: 'Aurora',     css: 'radial-gradient(120% 120% at 15% 10%,#3ee6c4 0%, transparent 55%), radial-gradient(120% 120% at 85% 15%,#7b5cff 0%, transparent 55%), radial-gradient(140% 140% at 50% 100%,#1a1c3a 0%, #0c0d1f 60%)' },
  { id: 'poente',  nome: 'Pôr do Sol', css: 'radial-gradient(120% 120% at 20% 0%,#ffb46b 0%, transparent 55%), radial-gradient(120% 120% at 90% 20%,#ff6f91 0%, transparent 55%), radial-gradient(140% 140% at 50% 100%,#3a1c4a 0%, #170b23 65%)' },
  { id: 'oceano',  nome: 'Oceano',     css: 'radial-gradient(120% 120% at 10% 0%,#4fd8ff 0%, transparent 55%), radial-gradient(120% 120% at 90% 30%,#2a6df0 0%, transparent 55%), radial-gradient(140% 140% at 50% 100%,#031633 0%, #01060f 65%)' },
];
const PAPEL_KEY = 'ucam_papel_id';
const PAPEL_CUSTOM_KEY = 'ucam_papel_custom';
const FILTRO_KEY = 'ucam_filtro_id';
const MELHORAR_KEY = 'ucam_melhorar';

/* Redimensiona uma imagem (dataURL) antes de guardar no localStorage — do
   contrário um papel de parede enviado cru (celular moderno tira foto de
   4000px+) estoura a cota de ~5MB do navegador numa tacada só. */
const encolherImagem = (dataUrl, maxW = 1100, quality = 0.82) => new Promise((resolve) => {
  try {
    const img = new Image();
    img.onload = () => {
      try {
        const escala = Math.min(1, maxW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * escala), h = Math.round(img.naturalHeight * escala);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  } catch { resolve(dataUrl); }
});

/* Nitidez real (kernel de sharpen 3x3) — só roda UMA vez, na foto já
   congelada no canvas. Rodar isso por frame no vídeo ao vivo (30x/seg)
   travaria a prévia; por isso o "melhorar qualidade" no preview é só o
   filtro CSS acima, e este convolução entra só no clique do obturador. */
const aplicarNitidez = (ctx, w, h) => {
  const src = ctx.getImageData(0, 0, w, h);
  const s = src.data;
  const out = ctx.createImageData(w, h);
  const o = out.data;
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; o[i + 3] = s[i + 3];
        continue;
      }
      for (let c = 0; c < 3; c++) {
        let soma = 0, ki = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          soma += s[((y + dy) * w + (x + dx)) * 4 + c] * k[ki++];
        }
        o[i + c] = Math.min(255, Math.max(0, soma));
      }
      o[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
};

const ALVO_RATIO = 16 / 10; // mesma proporção do bezel — bem mais "tela de notebook" que quadrado

const slugOwner = (s) => String(s || 'colaborador').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'colaborador';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const dot = (cor) => ({ width: 9, height: 9, borderRadius: '50%', background: cor, display: 'inline-block', opacity: .9 });
const pillBtn = { padding: '9px 18px', borderRadius: 20, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 };
/* Botão redondo minimalista (vibe iOS control center) — usado nos ícones de
   utilidade da câmera (galeria, papel de parede, qualidade, efeitos, tela
   cheia, on/off). `corIcone` força a cor do ícone (ex: liga/desliga, sempre
   colorido); `corAtiva` é o tom do "ligado" (azul por padrão, mas corações e
   estrelas ganham a cor deles próprios). Lê `T.dark` direto (T é importado
   no topo do arquivo e reflete o tema atual do Portal) pra virar claro/
   escuro junto com o resto do app — só o bezel da câmera em si (alumínio +
   luzes de janela) fica sempre "space gray", igual um MacBook de verdade não
   muda de cor com o tema do sistema. */
const roundBtn = (active, corIcone, corAtiva = ACCENT) => ({
  position: 'relative', width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center',
  background: active ? `${corAtiva}33` : (T.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.055)'),
  border: `1px solid ${active ? `${corAtiva}88` : (T.dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.10)')}`,
  color: corIcone || (active ? corAtiva : (T.dark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.62)')),
  cursor: 'pointer', flexShrink: 0, backdropFilter: 'blur(10px)', transition: 'all .15s',
});
/* Botão "aba" do dock (Filtros/Efeitos/Fundo) — pílula com ícone+rótulo,
   fica destacada (azul) enquanto o painel dela está aberto. `bgNeutro`/
   `borderNeutro`/`textoNeutro` vêm de fora (dockBg/dockBorder etc., que já
   seguem T.dark) pra não duplicar essa conta aqui. */
const tabBtn = (ativo, borderNeutro, bgNeutro, textoNeutro) => ({
  position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 20,
  background: ativo ? `${ACCENT}22` : bgNeutro,
  border: `1px solid ${ativo ? `${ACCENT}70` : borderNeutro}`,
  color: ativo ? ACCENT : textoNeutro,
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
});

/* ── Efeitos decorativos ─────────────────────────────────────────────────
   CORAÇÕES: acompanham a cabeça de VERDADE via detecção de rosto (MediaPipe
   Face Detector — BlazeFace "short range", ~200KB, bem mais leve que um
   modelo de segmentação de corpo inteiro), carregada SOB DEMANDA só quando
   o efeito é ligado (import dinâmico — quem nunca usa não baixa nada).
   Enquanto não detecta nenhum rosto (ligou agora, ou o modelo não carregou),
   caem numa posição padrão central/superior — o efeito nunca "some".
   ESTRELAS: SVG amarelo sólido de 5 pontas (não emoji — sem brilho/glint
   extra), grande, em pontos fixos da cena enviesados pras bordas (pra não
   cobrir o rosto) — aqui não tem rastreio, é "cenário", não segue ninguém. */
const HEART_OFFSETS = [
  { dx: -.18, dy: -.66, s: 22 }, { dx: 0, dy: -.86, s: 27 }, { dx: .18, dy: -.66, s: 20 },
  { dx: -.38, dy: -.34, s: 17 }, { dx: .38, dy: -.34, s: 18 }, { dx: -.14, dy: -.20, s: 15 }, { dx: .14, dy: -.20, s: 14 },
];
const HEAD_PADRAO = { x: .5, y: .15, w: .32 }; // suposição de rosto centrado, até a detecção de verdade assumir
const CORACAO_PATH = 'M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.8 6.6 4.9 5.3 7 4.4 9.2 5.1 12 7.8 14.8 5.1 17 4.4 19.1 5.3c3.1 1.3 3.9 4.8 2.2 7.5C18.7 16.65 12 21 12 21z';
const ESTRELA_PATH = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z';
const STAR_SPOTS = [
  { x: .10, y: .14, s: 40 }, { x: .90, y: .18, s: 34 }, { x: .14, y: .60, s: 32 },
  { x: .87, y: .64, s: 40 }, { x: .08, y: .84, s: 30 }, { x: .92, y: .40, s: 32 }, { x: .50, y: .06, s: 28 },
];
const EFEITO_CORACOES_KEY = 'ucam_efeito_coracoes';
const EFEITO_ESTRELAS_KEY = 'ucam_efeito_estrelas';

const desenharCoracao = (ctx, cx, cy, s, cor) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 20, s / 20);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(0, 2, -2, 0, -5, 0);
  ctx.bezierCurveTo(-9, 0, -9, 5, -9, 5);
  ctx.bezierCurveTo(-9, 8, -6, 11, 0, 15);
  ctx.bezierCurveTo(6, 11, 9, 8, 9, 5);
  ctx.bezierCurveTo(9, 5, 9, 0, 5, 0);
  ctx.bezierCurveTo(2, 0, 0, 2, 0, 4);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.restore();
};
/* Estrela de 5 pontas de verdade (10 vértices, raio externo/interno
   alternados) — não é emoji, então a cor/tamanho ficam 100% sob controle. */
const desenharEstrela5 = (ctx, cx, cy, r, cor) => {
  const rInterno = r * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : rInterno;
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.restore();
};
const desenharEfeitos = (ctx, w, h, { coracoes, estrelas, cabeca }) => {
  ctx.filter = 'none'; // efeito nunca herda o filtro de cor escolhido (senão vira cinza no P&B etc.)
  if (estrelas) STAR_SPOTS.forEach(p => desenharEstrela5(ctx, p.x * w, p.y * h, p.s * (w / 900), '#FFD60A'));
  if (coracoes) {
    const cab = cabeca || HEAD_PADRAO;
    const escala = Math.max(.6, Math.min(1.8, cab.w / .32));
    HEART_OFFSETS.forEach(o => desenharCoracao(ctx, (cab.x + o.dx * cab.w) * w, (cab.y + o.dy * cab.w) * h, o.s * escala * 1.4, '#FF4D8D'));
  }
};
/* Overlay ao vivo (DOM/CSS) — camada irmã do <video>, então não herda o
   espelhamento (scaleX(-1)) dele; as posições ficam certas do jeito que
   estão. Os corações têm `transition` no left/top pra suavizar entre uma
   atualização de posição e outra (a detecção roda em loop próprio, não a
   cada render do React). */
const EfeitosOverlay = ({ coracoes, estrelas, headPos }) => {
  const cab = headPos || HEAD_PADRAO;
  const escala = Math.max(.6, Math.min(1.8, cab.w / .32));
  return (
    <>
      {estrelas && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {STAR_SPOTS.map((p, i) => (
            <span key={i} style={{ position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`,
              transform: 'translate(-50%,-50%)', animation: `ucamTwinkle ${1.8 + (i % 3) * .4}s ease-in-out ${i * .18}s infinite` }}>
              <Sic size={p.s} stroke="none"><path d={ESTRELA_PATH} style={{ fill: '#FFD60A' }} /></Sic>
            </span>
          ))}
        </div>
      )}
      {coracoes && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {HEART_OFFSETS.map((o, i) => (
            <span key={i} style={{ position: 'absolute',
              left: `${(cab.x + o.dx * cab.w) * 100}%`, top: `${(cab.y + o.dy * cab.w) * 100}%`,
              transform: 'translate(-50%,-50%)', transition: 'left .12s linear, top .12s linear',
              animation: `ucamHeartFloat 2.4s ease-in-out ${i * .2}s infinite` }}>
              <Sic size={o.s * escala * 1.7} stroke="none"><path d={CORACAO_PATH} style={{ fill: '#FF4D8D' }} /></Sic>
            </span>
          ))}
        </div>
      )}
    </>
  );
};

/* Linha de toggle do painel "Efeitos" (corações/estrelas/qualidade) — lê
   `T.dark` direto, igual `roundBtn`, pra acompanhar o tema do Portal. */
const LinhaToggle = ({ ativo, onClick, cor, label, children }) => {
  const bg = T.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
  const border = T.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)';
  const texto = T.dark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.75)';
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12,
      background: ativo ? `${cor}22` : bg, border: `1px solid ${ativo ? `${cor}70` : border}`, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, color: ativo ? cor : texto }}>{children}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: ativo ? cor : texto }}>{label}</span>
      <span style={{ width: 34, height: 19, borderRadius: 10, background: ativo ? cor : border, position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: ativo ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
      </span>
    </button>
  );
};

/* ── status dentro da tela da câmera enquanto não está ligada ── */
const STATUS_MSG = {
  idle:      { texto: 'A câmera está desligada.', botao: 'Ativar câmera' },
  pedindo:   { texto: 'Pedindo permissão da câmera…', botao: null },
  negada:    { texto: 'Permissão negada. Libere o acesso à câmera nas configurações do navegador e tente de novo.', botao: 'Tentar de novo' },
  semcamera: { texto: 'Nenhuma câmera encontrada neste aparelho.', botao: null },
  erro:      { texto: 'Não foi possível abrir a câmera.', botao: 'Tentar de novo' },
};
const StatusTela = ({ camState, onRetry }) => {
  const MSG = STATUS_MSG[camState];
  if (!MSG) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 14, color: 'rgba(255,255,255,.85)', textAlign: 'center', padding: 24 }}>
      {camState === 'pedindo'
        ? <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(255,255,255,.25)', borderTopColor: '#fff', animation: 'ucamSpin .7s linear infinite' }} />
        : <Sic size={34} stroke="rgba(255,255,255,.55)"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></Sic>}
      <div style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: 260 }}>{MSG.texto}</div>
      {MSG.botao && (
        <button onClick={onRetry} style={{ ...pillBtn, background: ACCENT, borderColor: ACCENT }}>{MSG.botao}</button>
      )}
    </div>
  );
};

const TabUnikoCamera = () => {
  const isMobile = useIsMobile();
  const [me] = useState(() => {
    try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
    catch { return 'Colaborador'; }
  });

  const [camState, setCamState] = useState('idle'); // idle|pedindo|ativa|negada|semcamera|erro
  const [filtroId, setFiltroId] = useState(() => { try { return localStorage.getItem(FILTRO_KEY) || 'original'; } catch { return 'original'; } });
  const [melhorar, setMelhorar] = useState(() => { try { return localStorage.getItem(MELHORAR_KEY) === '1'; } catch { return false; } });
  const [efeitoCoracoes, setEfeitoCoracoes] = useState(() => { try { return localStorage.getItem(EFEITO_CORACOES_KEY) === '1'; } catch { return false; } });
  const [efeitoEstrelas, setEfeitoEstrelas] = useState(() => { try { return localStorage.getItem(EFEITO_ESTRELAS_KEY) === '1'; } catch { return false; } });
  const [papelId, setPapelId] = useState(() => { try { return localStorage.getItem(PAPEL_KEY) || WALLPAPERS[0].id; } catch { return WALLPAPERS[0].id; } });
  const [papelCustom, setPapelCustom] = useState(() => { try { return localStorage.getItem(PAPEL_CUSTOM_KEY) || null; } catch { return null; } });
  // Painel aberto no dock: null | 'filtros' | 'efeitos' | 'fundo' — só um por vez, tipo abas.
  const [painelAberto, setPainelAberto] = useState(null);
  const abrirPainel = (nome) => setPainelAberto(p => (p === nome ? null : nome));

  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [galeriaOpen, setGaleriaOpen] = useState(false);
  const [lightboxFoto, setLightboxFoto] = useState(null);

  const [flash, setFlash] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const toastTimer = useRef(null);
  const stageRef = useRef(null);
  const [stageH, setStageH] = useState(null);

  /* Mede a altura de verdade do palco (depois de resolvido flex/zoom/tela
     cheia) pra dimensionar o bezel — nada de calc(vh) chutado, que erra toda
     vez que o zoom:0.8 do Portal entra na conta (ver bug da tela cheia). */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height;
      if (h) setStageH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { try { localStorage.setItem(FILTRO_KEY, filtroId); } catch { /* sem localStorage */ } }, [filtroId]);
  useEffect(() => { try { localStorage.setItem(MELHORAR_KEY, melhorar ? '1' : '0'); } catch { /* sem localStorage */ } }, [melhorar]);
  useEffect(() => { try { localStorage.setItem(EFEITO_CORACOES_KEY, efeitoCoracoes ? '1' : '0'); } catch { /* sem localStorage */ } }, [efeitoCoracoes]);
  useEffect(() => { try { localStorage.setItem(EFEITO_ESTRELAS_KEY, efeitoEstrelas ? '1' : '0'); } catch { /* sem localStorage */ } }, [efeitoEstrelas]);

  const mostrarToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ── câmera ── */
  const ligarCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCamState('semcamera'); return; }
    setCamState('pedindo');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCamState('ativa');
    } catch (e) {
      setCamState(e?.name === 'NotAllowedError' ? 'negada' : (e?.name === 'NotFoundError' ? 'semcamera' : 'erro'));
    }
  };
  const desligarCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamState('idle');
  };
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  /* ── corações seguindo a cabeça: detecção de rosto de verdade ───────────
     Só carrega o modelo (import dinâmico) quando o efeito está ligado E a
     câmera está ativa. Suaviza a posição (lerp) pra não tremer a cada frame;
     se o modelo não carregar (rede bloqueada, sem WASM etc.) os corações
     ficam na posição padrão fixa — nunca quebra o efeito, só perde o
     rastreio. */
  const headSmoothRef = useRef({ ...HEAD_PADRAO });
  const [headPos, setHeadPos] = useState(HEAD_PADRAO);
  useEffect(() => {
    if (!efeitoCoracoes || camState !== 'ativa') return undefined;
    let cancelado = false;
    let raf = null;
    let detector = null;
    (async () => {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
        if (cancelado) return;
        detector = await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
          runningMode: 'VIDEO',
        });
        if (cancelado) { detector.close(); return; }
        const loop = () => {
          const v = videoRef.current;
          if (v && v.readyState >= 2 && v.videoWidth) {
            try {
              const res = detector.detectForVideo(v, performance.now());
              const box = res?.detections?.[0]?.boundingBox;
              if (box) {
                const cxRaw = (box.originX + box.width / 2) / v.videoWidth;
                const cx = 1 - cxRaw; // compensa o espelhamento do preview
                const cy = (box.originY + box.height * .12) / v.videoHeight;
                const w = box.width / v.videoWidth;
                const s = headSmoothRef.current;
                s.x += (cx - s.x) * .3; s.y += (cy - s.y) * .3; s.w += (w - s.w) * .3;
                setHeadPos({ x: s.x, y: s.y, w: s.w });
              }
            } catch { /* frame ocasional falho — mantém a última posição conhecida */ }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        mostrarToast('Não deu pra carregar o rastreio de rosto — corações numa posição fixa.');
      }
    })();
    return () => {
      cancelado = true;
      if (raf) cancelAnimationFrame(raf);
      try { detector?.close?.(); } catch { /* já fechou */ }
      headSmoothRef.current = { ...HEAD_PADRAO };
      setHeadPos(HEAD_PADRAO);
    };
  }, [efeitoCoracoes, camState]);

  /* ── tela cheia: some com barra lateral/cabeçalho (mesmo truque do Uniko
     Detetive ao entrar numa sala — ver `sus-na-sala` em TabUnikoSuspect.jsx):
     a classe no <body> esconde tudo por CSS, e a Fullscreen API de verdade
     só é pedida dentro do próprio clique (exigência do navegador). Se ela for
     recusada (permissão/iframe), o CSS já resolve o essencial. Também escuta
     o ESC nativo pra voltar o estado caso a pessoa saia da tela cheia real
     sem clicar no botão. */
  useEffect(() => {
    document.body.classList.toggle('ucam-fullscreen', fullscreen);
    return () => document.body.classList.remove('ucam-fullscreen');
  }, [fullscreen]);
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => { document.removeEventListener('fullscreenchange', onFsChange); document.removeEventListener('webkitfullscreenchange', onFsChange); };
  }, []);
  const entrarTelaCheia = () => {
    setFullscreen(true);
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
        pedir?.call(el)?.catch?.(() => { /* navegador recusou — o CSS já cobre */ });
      }
    } catch { /* Fullscreen API indisponível */ }
  };
  const sairTelaCheia = () => {
    setFullscreen(false);
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      }
    } catch { /* já saiu */ }
  };

  /* ── galeria (privada — filtra pelo nome de quem está logado) ── */
  const carregarFotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const { data, error } = await supabase.from('uniko_camera_photos').select('*').eq('owner', me).order('created_at', { ascending: false });
      if (!error) setPhotos(data || []);
    } catch { /* tabela pode não existir ainda (SQL não rodado) — galeria fica vazia */ }
    setLoadingPhotos(false);
  }, [me]);
  useEffect(() => { carregarFotos(); }, [carregarFotos]);

  const filtroAtual = FILTERS.find(f => f.id === filtroId) || FILTERS[0];
  const filtroCombinadoCSS = filtroAtual.css === 'none'
    ? (melhorar ? ENHANCE_CSS : 'none')
    : `${filtroAtual.css}${melhorar ? ' ' + ENHANCE_CSS : ''}`;

  const papelAtualCSS = (papelId === 'custom' && papelCustom)
    ? `url(${papelCustom}) center/cover no-repeat`
    : (WALLPAPERS.find(w => w.id === papelId)?.css || WALLPAPERS[0].css);

  const escolherPapel = (id) => { setPapelId(id); try { localStorage.setItem(PAPEL_KEY, id); } catch { /* sem localStorage */ } setPainelAberto(null); };
  const onUploadWallpaper = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const pequena = await encolherImagem(String(reader.result));
      setPapelCustom(pequena);
      try { localStorage.setItem(PAPEL_CUSTOM_KEY, pequena); } catch { mostrarToast('Papel de parede aplicado (não deu pra salvar pra próxima visita).'); }
      escolherPapel('custom');
    };
    reader.readAsDataURL(file);
  };

  /* ── tirar e salvar a foto ── */
  const salvarFoto = async (blob) => {
    setSalvando(true);
    try {
      const path = `${slugOwner(me)}/${uid()}.jpg`;
      const { error: upErr } = await supabase.storage.from('uniko-camera').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('uniko-camera').getPublicUrl(path);
      const linha = { owner: me, url: pub.publicUrl, path, filtro: filtroId };
      const { data: inserida, error: insErr } = await supabase.from('uniko_camera_photos').insert(linha).select().single();
      if (!insErr && inserida) setPhotos(p => [inserida, ...p]);
      mostrarToast('Foto salva na galeria! 📸');
    } catch {
      mostrarToast('Não deu pra salvar a foto — tenta de novo.');
    }
    setSalvando(false);
  };

  const tirarFoto = () => {
    const v = videoRef.current, canvas = canvasRef.current;
    if (camState !== 'ativa' || !v || !canvas || salvando) return;
    setFlash(true); setTimeout(() => setFlash(false), 350);

    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return;
    // recorta do centro na mesma proporção do bezel (16:10) em vez de forçar quadrado
    let cw = vw, ch = vh;
    if (vw / vh > ALVO_RATIO) cw = vh * ALVO_RATIO; else ch = vw / ALVO_RATIO;
    const sx = (vw - cw) / 2, sy = (vh - ch) / 2;
    const outW = Math.min(cw, 1100), outH = Math.round(outW / ALVO_RATIO);
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.filter = filtroCombinadoCSS;
    ctx.save();
    ctx.translate(outW, 0);
    ctx.scale(-1, 1); // espelha igual ao preview (senão a foto sai invertida em relação ao que a pessoa viu)
    ctx.drawImage(v, sx, sy, cw, ch, 0, 0, outW, outH);
    ctx.restore();
    if (melhorar) { ctx.filter = 'none'; aplicarNitidez(ctx, outW, outH); }
    if (efeitoCoracoes || efeitoEstrelas) desenharEfeitos(ctx, outW, outH, { coracoes: efeitoCoracoes, estrelas: efeitoEstrelas, cabeca: headSmoothRef.current });

    canvas.toBlob(blob => { if (blob) salvarFoto(blob); }, 'image/jpeg', 0.92);
  };

  const excluirFoto = async (foto) => {
    if (!window.confirm('Excluir esta foto da galeria? Não dá pra desfazer.')) return;
    setPhotos(p => p.filter(x => x.id !== foto.id));
    if (lightboxFoto?.id === foto.id) setLightboxFoto(null);
    try {
      await supabase.storage.from('uniko-camera').remove([foto.path]);
      await supabase.from('uniko_camera_photos').delete().eq('id', foto.id);
    } catch { /* já saiu da lista local; se falhar no banco, reaparece no próximo carregarFotos */ }
  };

  // Cores dos "cards" (dock, popover de papel de parede, galeria) — seguem o
  // tema claro/escuro do Portal, igual pedido explícito do usuário.
  const dockBg = T.dark ? 'rgba(28,28,30,.6)' : 'rgba(255,255,255,.72)';
  const dockBorder = T.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
  const cardBg = T.dark ? '#1c1d22' : '#ffffff';
  const cardBorder = T.dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)';
  const cardText = T.dark ? '#fff' : '#1c1c1e';
  const cardTextMuted = T.dark ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.5)';
  const chipBg = T.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  const chipText = T.dark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.72)';

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {!fullscreen && (
        <div style={{ marginBottom: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: '-.01em' }}>Uniko Camera</div>
          <div style={{ fontSize: 13.5, color: T.textT, marginTop: 5 }}>Tire fotos direto do Portal — filtros, melhorador de qualidade e papel de parede.</div>
        </div>
      )}

      {/* ── palco: papel de parede + janela da câmera ── */}
      <div ref={stageRef} style={{ position: 'relative', borderRadius: fullscreen ? 0 : 24, background: papelAtualCSS,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '16px 14px' : '20px 32px', flex: 1, minHeight: 0 }}>

        {/* bezel estilo MacBook — bem maior e horizontal (16:10). O tamanho vem
            da altura MEDIDA do palco (ref + ResizeObserver), não de vh/zoom
            calculados — assim funciona igual em tela normal e em tela cheia,
            sempre cabendo inteiro sem sobrar espaço nem precisar de scroll. */}
        <div style={{ position: 'relative', width: 'min(94%, 1400px)',
          maxHeight: stageH ? Math.max(200, stageH - (isMobile ? 32 : 48)) : undefined, aspectRatio: '16/10', borderRadius: 22,
          background: 'linear-gradient(160deg,#3d4046,#1b1d21)', padding: isMobile ? 10 : 14,
          boxShadow: '0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08)' }}>
          <div style={{ position: 'absolute', top: 13, left: 18, display: 'flex', gap: 6, zIndex: 2 }}>
            <span style={dot('#FF5F57')} /><span style={dot('#FEBC2E')} /><span style={dot('#28C840')} />
          </div>
          {/* título da janela, tipo app de verdade — o LED de "câmera ativa" vem
              junto, igual antes, só que agora ao lado do nome em vez de sozinho. */}
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex',
            alignItems: 'center', gap: 6, zIndex: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: camState === 'ativa' ? '#28C840' : '#555',
              boxShadow: camState === 'ativa' ? '0 0 6px 2px rgba(40,200,64,.7)' : 'none', flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>UNIKO CAMERA</span>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', background: '#000', marginTop: 22 }}>
            <video ref={videoRef} muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
                filter: filtroCombinadoCSS, display: camState === 'ativa' ? 'block' : 'none' }} />
            {camState === 'ativa' && <EfeitosOverlay coracoes={efeitoCoracoes} estrelas={efeitoEstrelas} headPos={headPos} />}
            <StatusTela camState={camState} onRetry={ligarCamera} />
            {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff', animation: 'ucamFlash .35s ease-out' }} />}
          </div>
        </div>
      </div>

      {/* ── dock de controles: minimalista, vibe iOS, com abas (Filtros/Efeitos/
           Fundo abrem um painel; Tela cheia é botão fixo, ação direta) ── */}
      <div style={{ position: 'relative', margin: fullscreen ? '0' : '12px 0 0', flexShrink: 0, borderRadius: fullscreen ? 0 : 26,
        background: dockBg, backdropFilter: 'blur(24px) saturate(180%)',
        borderTop: fullscreen ? `1px solid ${dockBorder}` : 'none',
        border: fullscreen ? 'none' : `1px solid ${dockBorder}`,
        padding: isMobile ? '10px 10px' : '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>

        {/* painel flutuante acima do dock — conteúdo conforme a aba escolhida */}
        {painelAberto && (
          <>
            <div onClick={() => setPainelAberto(null)} style={{ position: 'fixed', inset: 0, zIndex: 190 }} />
            <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
              zIndex: 191, width: 'min(94vw, 460px)', maxHeight: '48vh', overflowY: 'auto', background: cardBg,
              border: `1px solid ${cardBorder}`, borderRadius: 18, padding: 14, boxShadow: '0 20px 50px rgba(0,0,0,.35)' }}>

              {painelAberto === 'filtros' && (
                <>
                  <div style={{ color: cardText, fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Filtros</div>
                  <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '2px 2px 4px' }}>
                    {FILTERS.map(f => (
                      <button key={f.id} onClick={() => setFiltroId(f.id)} title={f.nome}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent',
                          border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2 }}>
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: f.swatch, transition: 'transform .15s, box-shadow .15s',
                          boxShadow: filtroId === f.id ? `0 0 0 2px ${cardBg}, 0 0 0 4px ${ACCENT}` : `0 0 0 2px ${dockBorder}`,
                          transform: filtroId === f.id ? 'scale(1.06)' : 'none' }} />
                        <span style={{ fontSize: 10, fontWeight: 500, color: filtroId === f.id ? ACCENT : cardTextMuted, whiteSpace: 'nowrap' }}>{f.nome}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {painelAberto === 'efeitos' && (
                <>
                  <div style={{ color: cardText, fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Efeitos</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <LinhaToggle ativo={efeitoCoracoes} onClick={() => setEfeitoCoracoes(c => !c)} cor="#FF4D8D" label="Corações ao redor do rosto">
                      <Sic size={15} stroke="none"><path d={CORACAO_PATH} style={{ fill: 'currentColor' }} /></Sic>
                    </LinhaToggle>
                    <LinhaToggle ativo={efeitoEstrelas} onClick={() => setEfeitoEstrelas(s => !s)} cor="#FFD60A" label="Estrelas no cenário">
                      <Sic size={15} stroke="none"><path d={ESTRELA_PATH} style={{ fill: 'currentColor' }} /></Sic>
                    </LinhaToggle>
                    <LinhaToggle ativo={melhorar} onClick={() => setMelhorar(m => !m)} cor={ACCENT} label="Melhorar qualidade">
                      <Sic size={15}><path d="M3 21l9-9" /><path d="M15 4V2" /><path d="M17.8 6.2L19 5" /><path d="M20 9h2" /><path d="M12.2 6.2L11 5" /></Sic>
                    </LinhaToggle>
                  </div>
                </>
              )}

              {painelAberto === 'fundo' && (
                <>
                  <div style={{ color: cardText, fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Papel de parede</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
                    {WALLPAPERS.map(w => (
                      <button key={w.id} onClick={() => escolherPapel(w.id)} title={w.nome}
                        style={{ aspectRatio: '1', borderRadius: '50%', background: w.css, cursor: 'pointer', padding: 0,
                          border: papelId === w.id ? `2px solid ${ACCENT}` : '2px solid transparent' }} />
                    ))}
                    {papelCustom && (
                      <button onClick={() => escolherPapel('custom')} title="Personalizado"
                        style={{ aspectRatio: '1', borderRadius: '50%', backgroundImage: `url(${papelCustom})`, backgroundSize: 'cover',
                          backgroundPosition: 'center', cursor: 'pointer', padding: 0,
                          border: papelId === 'custom' ? `2px solid ${ACCENT}` : '2px solid transparent' }} />
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 10px',
                    borderRadius: 30, background: chipBg, color: chipText, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Sic size={14}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M17 8l-5-5-5 5" /><line x1="12" y1="3" x2="12" y2="15" /></Sic>
                    Enviar imagem
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onUploadWallpaper} />
                  </label>
                </>
              )}
            </div>
          </>
        )}

        <button onClick={() => setGaleriaOpen(true)} title="Galeria" style={{ ...roundBtn(false), flexShrink: 0 }}>
          <Sic size={16}><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M7 21h11a2 2 0 002-2V8" /></Sic>
          {photos.length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: ACCENT, color: '#fff', borderRadius: 9,
              minWidth: 17, height: 17, fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 3px' }}>{photos.length}</span>
          )}
        </button>

        <div style={{ width: 1, alignSelf: 'stretch', background: dockBorder, flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={() => abrirPainel('filtros')} title="Filtros" style={tabBtn(painelAberto === 'filtros', dockBorder, chipBg, chipText)}>
            <Sic size={14}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /></Sic>
            {!isMobile && 'Filtros'}
            {filtroId !== 'original' && <span style={{ ...dot(ACCENT), opacity: 1 }} />}
          </button>
          <button onClick={() => abrirPainel('efeitos')} title="Efeitos" style={tabBtn(painelAberto === 'efeitos', dockBorder, chipBg, chipText)}>
            <Sic size={14}><path d="M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.8 6.6 4.9 5.3 7 4.4 9.2 5.1 12 7.8 14.8 5.1 17 4.4 19.1 5.3c3.1 1.3 3.9 4.8 2.2 7.5C18.7 16.65 12 21 12 21z" /></Sic>
            {!isMobile && 'Efeitos'}
            {(efeitoCoracoes || efeitoEstrelas || melhorar) && <span style={{ ...dot('#FF4D8D'), opacity: 1 }} />}
          </button>
          <button onClick={() => abrirPainel('fundo')} title="Papel de parede" style={tabBtn(painelAberto === 'fundo', dockBorder, chipBg, chipText)}>
            <Sic size={14}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></Sic>
            {!isMobile && 'Fundo'}
          </button>
          <button onClick={fullscreen ? sairTelaCheia : entrarTelaCheia} title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} style={roundBtn(fullscreen)}>
            {fullscreen
              ? <Sic size={15}><path d="M8 3v3a2 2 0 01-2 2H3" /><path d="M21 8h-3a2 2 0 01-2-2V3" /><path d="M3 16h3a2 2 0 012 2v3" /><path d="M16 21v-3a2 2 0 012-2h3" /></Sic>
              : <Sic size={15}><path d="M8 3H5a2 2 0 00-2 2v3" /><path d="M16 3h3a2 2 0 012 2v3" /><path d="M8 21H5a2 2 0 01-2-2v-3" /><path d="M16 21h3a2 2 0 002-2v-3" /></Sic>}
          </button>
        </div>

        <div style={{ flex: 1, minWidth: isMobile ? '100%' : 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, margin: isMobile ? '0 auto' : 0 }}>
          <button onClick={tirarFoto} disabled={camState !== 'ativa' || salvando} title="Tirar foto"
            style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0, background: '#fff',
              border: '3px solid rgba(255,255,255,.4)', cursor: (camState !== 'ativa' || salvando) ? 'not-allowed' : 'pointer',
              opacity: camState !== 'ativa' ? .35 : 1, display: 'grid', placeItems: 'center', transition: 'opacity .15s' }}>
            {salvando && <div style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid #ddd', borderTopColor: ACCENT, animation: 'ucamSpin .7s linear infinite' }} />}
          </button>

          <button onClick={camState === 'ativa' ? desligarCamera : ligarCamera} title={camState === 'ativa' ? 'Desligar câmera' : 'Ligar câmera'}
            style={roundBtn(false, camState === 'ativa' ? '#FF6B6B' : '#4FA8FF')}>
            <Sic size={15} stroke={camState === 'ativa' ? '#FF6B6B' : '#4FA8FF'}><path d="M18.36 6.64a9 9 0 11-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></Sic>
          </button>
        </div>
      </div>

      {/* ── galeria ── */}
      {galeriaOpen && (
        <div onClick={() => setGaleriaOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,10,14,.6)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 720, maxWidth: '100%', maxHeight: '85vh', display: 'flex',
            flexDirection: 'column', background: cardBg, borderRadius: 20, border: `1px solid ${cardBorder}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${cardBorder}` }}>
              <div style={{ color: cardText, fontWeight: 800, fontSize: 15 }}>Galeria — {photos.length} foto{photos.length === 1 ? '' : 's'}</div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setGaleriaOpen(false)} style={{ background: chipBg, border: 'none', color: cardText,
                width: 30, height: 30, borderRadius: 9, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <Sic size={15}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Sic>
              </button>
            </div>
            <div className="fi" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
              {loadingPhotos ? (
                <div style={{ color: cardTextMuted, textAlign: 'center', padding: 40, fontSize: 13.5 }}>Carregando…</div>
              ) : photos.length === 0 ? (
                <div style={{ color: cardTextMuted, textAlign: 'center', padding: 40, fontSize: 13.5 }}>Nenhuma foto ainda — tire a primeira!</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
                  {photos.map(p => (
                    <div key={p.id} onClick={() => setLightboxFoto(p)} style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden',
                      cursor: 'zoom-in', border: `1px solid ${cardBorder}` }}>
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── lightbox de uma foto ── */}
      {lightboxFoto && (
        <div onClick={() => setLightboxFoto(null)} style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(6,6,10,.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <img src={lightboxFoto.url} alt="" style={{ maxWidth: '86vw', maxHeight: '68vh', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.6)' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <a href={lightboxFoto.url} target="_blank" rel="noreferrer" download style={pillBtn}>
                <Sic size={14}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><line x1="12" y1="15" x2="12" y2="3" /></Sic>
                Baixar
              </a>
              <button onClick={() => excluirFoto(lightboxFoto)} style={{ ...pillBtn, background: 'rgba(224,52,90,.18)', borderColor: 'rgba(224,52,90,.4)', color: '#FF8FA3' }}>
                <Sic size={14}><path d="M3 6h18" /><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></Sic>
                Excluir
              </button>
              <button onClick={() => setLightboxFoto(null)} style={pillBtn}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 300,
          background: 'rgba(20,20,24,.92)', color: '#fff', padding: '10px 18px', borderRadius: 30, fontSize: 13, fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,.4)', animation: 'ucamToastIn .25s ease' }}>
          {toast}
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <style>{`
        @keyframes ucamFlash { from{opacity:1} to{opacity:0} }
        @keyframes ucamSpin { to{transform:rotate(360deg)} }
        @keyframes ucamToastIn { from{opacity:0; transform:translate(-50%,10px)} to{opacity:1; transform:translate(-50%,0)} }
        @keyframes ucamHeartFloat {
          0%,100% { transform:translate(-50%,-50%) translateY(0) rotate(-6deg); opacity:.85; }
          50% { transform:translate(-50%,-50%) translateY(-6px) rotate(6deg); opacity:1; }
        }
        @keyframes ucamTwinkle {
          0%,100% { opacity:.25; transform:translate(-50%,-50%) scale(.7); }
          50% { opacity:1; transform:translate(-50%,-50%) scale(1.15); }
        }
        /* Tela cheia (mesmo padrão do Uniko Detetive ao entrar numa sala): some
           com a barra lateral, o cabeçalho e o menu do celular por CSS. */
        body.ucam-fullscreen .portal-sidebar,
        body.ucam-fullscreen .portal-topbar,
        body.ucam-fullscreen .portal-mobilenav { display: none !important; }
        body.ucam-fullscreen .portal-conteudo { margin-left: 0 !important; }
        /* compensa o zoom:0.8 do Portal (ver central-colaborador/index.jsx) —
           sem isso a área ficava 20% mais baixa que a tela de verdade e sobrava
           uma faixa em branco embaixo do dock. */
        body.ucam-fullscreen .portal-area { height: calc(100vh / 0.8) !important; padding: 0 !important; overflow: hidden; }
      `}</style>
    </div>
  );
};

export { TabUnikoCamera };
