import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { T } from '../../contexts/theme';
import { SERVER_URL, supabase as _supabase, USER, getAuthUser, fetchPhotoByName } from '../../contexts/user';
import { BrandLogo, StarDivider, UnikoIcon, Logo, Tag, AvatarCircle } from '../../shared/components';
import UnikoMascot from './UnikoMascot';
import OceanScene, { MushroomCoral, TubeCoral, BubbleCoral } from '../../shared/oceanScene';
import CosmosScene from '../../shared/cosmosScene';
import SakuraScene from '../../shared/sakuraScene';
import FairyScene from '../../shared/fairyScene';
import OliviaScene from '../../shared/oliviaScene';
import { getActiveAssistantSkinId, getAssistantSkin, onAssistantSkinChange, skinRemoteKey } from '../../shared/assistantSkin';
import { getUniko, loadUnikoBgVideos } from '../../shared/captureUniko';
import { loadMensagemEspecial, MSG_ESPECIAL_FALLBACK } from '../../shared/mensagemEspecial';
import { useIsMobile } from '../../hooks/useIsMobile';

/* ── Barra de progresso da música ───────────────────────────────────────────
   Só leitura pra todo mundo; pro ADMIN vira uma barra ARRASTÁVEL: recebe
   `onSeek(ms)` e dá pra puxar direto pro minuto que ele quiser (o Spotify
   aceita `seek`, então o Echo pula na hora).
   Enquanto o dedo/mouse está na barra, o preenchimento e o relógio da
   esquerda mostram o ALVO, não o progresso real — senão a barra brigaria com
   o dedo, voltando sozinha a cada tick do polling de progresso. */
const BarraProgresso = ({ progressMs, durationMs, cores, onSeek, escuro = false }) => {
  const trilhoRef = useRef(null);
  const [arrastando, setArrastando] = useState(null);   // ms do alvo enquanto arrasta (null = parado)
  const [hover, setHover] = useState(false);
  const podeArrastar = typeof onSeek === 'function' && durationMs > 0;

  const msDoEvento = (e) => {
    const r = trilhoRef.current?.getBoundingClientRect();
    if (!r?.width) return 0;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    return Math.round(frac * durationMs);
  };
  const aoDescer = (e) => {
    if (!podeArrastar) return;
    // `setPointerCapture` mantém os eventos vindo pra cá mesmo se o ponteiro
    // sair da barra no meio do arrasto (sair da barra e soltar longe é o
    // caminho normal de quem puxa rápido).
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* navegador sem capture */ }
    setArrastando(msDoEvento(e));
  };
  const aoMover  = (e) => { if (arrastando !== null) setArrastando(msDoEvento(e)); };
  const aoSoltar = (e) => {
    if (arrastando === null) return;
    const alvo = msDoEvento(e);
    setArrastando(null);
    onSeek(alvo);
  };

  const mostrado = arrastando ?? progressMs;
  const pct  = durationMs > 0 ? Math.min(100, Math.max(0, (mostrado / durationMs) * 100)) : 0;
  const fmt  = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const ativo = arrastando !== null || hover;
  const trilhoBg = escuro ? 'rgba(255,255,255,.2)' : T.border;
  const textoCor = escuro ? 'rgba(255,255,255,.6)' : T.textD;
  const preenche = `linear-gradient(90deg,${cores?.[0] || T.gold},${cores?.[1] || T.gold}cc)`;

  return (
    <div>
      <div
        onPointerDown={aoDescer} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        title={podeArrastar ? 'Arraste pra pular pro ponto da música' : undefined}
        style={{ position: 'relative', padding: '9px 0', cursor: podeArrastar ? 'pointer' : 'default',
          touchAction: podeArrastar ? 'none' : 'auto' }}>
        <div ref={trilhoRef} style={{ position: 'relative', height: podeArrastar && ativo ? 6 : 4,
          borderRadius: 99, background: trilhoBg, transition: 'height .12s ease' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: preenche,
            transition: arrastando === null ? 'width .9s linear' : 'none' }} />
          {podeArrastar && (
            <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%,-50%)',
              width: ativo ? 14 : 10, height: ativo ? 14 : 10, borderRadius: '50%', background: '#fff',
              border: `2px solid ${cores?.[0] || T.gold}`, boxShadow: '0 2px 6px rgba(0,0,0,.35)',
              transition: arrastando === null ? 'width .12s ease, height .12s ease, left .9s linear' : 'width .12s ease, height .12s ease',
              pointerEvents: 'none' }} />
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: escuro ? 11 : 10, color: textoCor }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: arrastando !== null ? 800 : 400 }}>{fmt(mostrado)}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(durationMs)}</span>
      </div>
    </div>
  );
};

// Adivinha o gênero pelo primeiro nome (heurística PT-BR) → 'f' | 'm'
const FEMALE_NAMES = new Set(['beatriz','isabel','isabela','raquel','rute','ruth','ester','esther','ines','lais','lays','iris','nicole','jaqueline','jacqueline','caroline','carol','rachel','denise','eloise','heloise','karen','karin','miriam','mirian','carmen','carmem','solange','mercedes','yasmin','yasmim','jasmin','liz','mabel','isis','cris','noemi','noemy','sarah','sara','hannah','deborah','debora','judith','lilian','marylin','sharon','estefani','estefany','gabrielly','emily','kimberly','ester','agnes','dulce','flor','pilar']);
const MALE_NAMES   = new Set(['joshua','josua','luca','juca','nicola','elias','matias','mathias','tobias','jonas','lucas','thomas','tomas','dimas','andre','andres','felipe','filipe','henrique','jorge','jaime','jose','isaque','isaac','levi','kawan','noah','dante','vicente','clemente','enrique','aristoteles','socrates']);
function guessGender(name) {
  const n = (name || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  if (!n) return 'm';
  if (MALE_NAMES.has(n))   return 'm';
  if (FEMALE_NAMES.has(n)) return 'f';
  if (n.endsWith('a'))     return 'f';
  if (n.endsWith('e'))     return /(ane|ene|ine|one|ele|ete|isse|esse)$/.test(n) ? 'f' : 'm';
  return 'm';
}

// Busca a foto do artista (música) pela API pública do Deezer via JSONP (sem backend/CORS).
// Cacheado em memória; resolve com a URL da imagem ou null.
//
// NÃO CONFIE NO PRIMEIRO RESULTADO. A busca do Deezer é aproximada e cheia de
// homônimos/perfis vazios; pegar o [0] às cegas dava dois estragos, ambos
// medidos no acervo da empresa:
//   "Adele"  → "Adèle & Zalem" (duo francês obscuro) — cara de outra pessoa
//   "Anitta" → um dos 5 "Anitta", com 151 fãs e SEM foto — pódio vazio, sendo
//              que a cantora (7,3 mi de fãs) estava na mesma lista
// Por isso a escolha passa por três filtros (ver _melhorArtista): nome igual,
// foto de verdade e o mais popular. Sem candidato, devolve null e a UI mostra as
// iniciais — melhor sem foto do que com a foto errada.
const _artistImgCache = {};
// Compara nomes ignorando acento, caixa e pontuação ("JAŸ-Z" = "JAY Z",
// "LUDMILLA" = "Ludmilla", "MAGIC!" = "Magic!").
const _normArtist = (s) => (s || '').toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
// O Deezer serve um placeholder quando o artista NÃO TEM foto, e o caminho dele
// é sempre o mesmo hash (md5 da string vazia). Sem descartar isso, um perfil
// homônimo vazio ganha do artista de verdade e o pódio fica com um buraco.
const _DZ_SEM_FOTO = 'd41d8cd98f00b204e9800998ecf8427e';
// Escolhe o artista certo entre os resultados: nome igual, foto de verdade e o
// MAIS POPULAR. Homônimo é comum — "Anitta" devolve 5 artistas, e a cantora
// (7,3 mi de fãs) não é a primeira da lista; a primeira é um perfil com 151 fãs
// e sem foto.
const _melhorArtista = (lista, nome) => (lista || [])
  .filter(a => _normArtist(a?.name) === _normArtist(nome))
  .filter(a => !String(a?.picture_big || a?.picture || '').includes(_DZ_SEM_FOTO))
  .sort((a, b) => (b?.nb_fan || 0) - (a?.nb_fan || 0))[0];
function fetchArtistImage(name) {
  return new Promise((resolve) => {
    const key = (name || '').trim();
    if (!key) return resolve(null);
    if (_artistImgCache[key] !== undefined) return resolve(_artistImgCache[key]);
    if (typeof document === 'undefined') return resolve(null);
    const cb = `dzCb_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const done = (url) => {
      _artistImgCache[key] = url || null;
      try { delete window[cb]; } catch { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timer);
      resolve(_artistImgCache[key]);
    };
    const timer = setTimeout(() => done(null), 6000);
    window[cb] = (data) => {
      // Nome igual + foto real + mais popular — não o primeiro da lista.
      const a = _melhorArtista(data?.data, key);
      // Prefere picture_big (500x500) — picture_medium (250) ficava borrado nas
      // fotos grandes do pódio (124px, ~248px em telas retina). 500 é nítido e leve;
      // o zoom sobe pra 1000 via hdArtistImage. Cai pra menores só se faltar.
      done(a?.picture_big || a?.picture_xl || a?.picture_medium || a?.picture || null);
    };
    script.onerror = () => done(null);
    // limit=8: o nome exato às vezes não é o 1º resultado (ex.: "Adele" vem depois
    // de "Adèle & Zalem"), então precisa de margem pra achar o certo na lista.
    script.src = `https://api.deezer.com/search/artist?q=${encodeURIComponent(key)}&limit=8&output=jsonp&callback=${cb}`;
    document.body.appendChild(script);
  });
}

// O Deezer serve a MESMA imagem em vários tamanhos no próprio caminho da URL
// (ex.: /500x500-000000-80-0-0.jpg). Troca a dimensão por 1000x1000 pra versão
// HD do zoom (lightbox); se o padrão não bater, devolve a original inalterada.
function hdArtistImage(url) {
  if (!url) return url;
  return url.replace(/\/\d+x\d+-/, '/1000x1000-');
}

// Modal do vídeo "Mensagem Especial". É um componente MEMOIZADO à parte de
// propósito: a Central Alexa re-renderiza a cada 200ms (timer da letra) e, se o
// modal ficasse dentro do render principal, o vídeo travava — o backdrop com
// blur tinha que re-borrar o fundo (que muda toda hora) a cada frame. Isolado
// aqui, com props estáveis (open/onClose/gold), o React pula esse subtree
// inteiro durante o "storm" de re-renders → vídeo liso. Também: SEM blur no
// backdrop (fundo opaco) pelo mesmo motivo, e quando o vídeo acaba mostra a
// capa ampliada em vez do último frame parado.
// Os arquivos têm sufixo de versão de propósito: ao trocar o vídeo mantendo o
// MESMO nome, o navegador (e qualquer proxy no caminho) continua servindo o
// arquivo antigo do cache — o vídeo novo chega misturado com bytes velhos e
// engasga. Trocou a mídia? Suba o -vN junto.
const MSG_COVER = MSG_ESPECIAL_FALLBACK.coverUrl;
const MSG_VIDEO = MSG_ESPECIAL_FALLBACK.videoUrl;
const MsgVideoModal = memo(function MsgVideoModal({ open, onClose, gold, cover, video }) {
  const [ended, setEnded] = useState(false);
  useEffect(() => { if (open) setEnded(false); }, [open]);
  if (!open) return null;
  const capa  = cover || MSG_COVER;
  const clipe = video || MSG_VIDEO;
  const frameStyle = {
    maxWidth: 'min(96vw,720px)', maxHeight: '88vh', borderRadius: 16,
    border: `3px solid ${gold}`, boxShadow: `0 20px 70px rgba(0,0,0,0.6), 0 0 40px ${gold}55`,
    cursor: 'default', background: '#000',
  };
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, background: 'rgba(6,4,16,0.92)', cursor: 'zoom-out', padding: 24 }}>
      {ended ? (
        <img src={capa} alt="Mensagem Especial" onClick={e => e.stopPropagation()} style={frameStyle} />
      ) : (
        <video src={clipe} controls autoPlay playsInline preload="auto"
          onEnded={() => setEnded(true)} onClick={e => e.stopPropagation()} style={frameStyle} />
      )}
      <button onClick={onClose}
        style={{ padding: '8px 20px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        {ended ? 'Fechar' : 'Fechar'}
      </button>
    </div>
  );
});

const VAMP_CARD_CSS = `
@keyframes vampMoonPulse{0%,100%{opacity:.65;transform:scale(1);}50%{opacity:1;transform:scale(1.08);}}
@keyframes vampCardGlow{0%,100%{box-shadow:0 0 18px 6px #c41e3a14,0 8px 40px rgba(0,0,0,.45);}50%{box-shadow:0 0 36px 14px #c41e3a28,0 8px 40px rgba(0,0,0,.45);}}
@keyframes vampHeartBeat{0%{border-color:#7a0c1a;box-shadow:0 0 10px 1px #7a001018,0 8px 40px rgba(0,0,0,.45);}14%{border-color:#d83a52;box-shadow:0 0 16px 3px #c41e3a3a,0 8px 40px rgba(0,0,0,.45);}28%{border-color:#8a1422;box-shadow:0 0 11px 2px #7a001022,0 8px 40px rgba(0,0,0,.45);}40%{border-color:#e24a60;box-shadow:0 0 20px 4px #c41e3a44,0 8px 40px rgba(0,0,0,.45);}58%{border-color:#7a0c1a;box-shadow:0 0 10px 1px #7a001018,0 8px 40px rgba(0,0,0,.45);}100%{border-color:#7a0c1a;box-shadow:0 0 10px 1px #7a001018,0 8px 40px rgba(0,0,0,.45);}}
@keyframes vampBatWander{0%,100%{transform:translate(0,0);}20%{transform:translate(var(--dx),calc(var(--dy) * -.6));}40%{transform:translate(calc(var(--dx) * 1.15),calc(var(--dy) * .5));}60%{transform:translate(calc(var(--dx) * .3),var(--dy));}80%{transform:translate(calc(var(--dx) * -.7),calc(var(--dy) * -.2));}}
@keyframes vampBatFlap{0%,100%{transform:scaleY(1);}50%{transform:scaleY(.84);}}
@keyframes vampCloudDrift{0%,100%{transform:translateX(0);}50%{transform:translateX(-16px);}}
@keyframes vampLightning{0%{opacity:0;}1%{opacity:1;}3%{opacity:.15;}5%{opacity:.95;}8%{opacity:0;}100%{opacity:0;}}
@keyframes vampLightningFlash{0%{opacity:0;}1.5%{opacity:.5;}4%{opacity:.12;}6%{opacity:.42;}9%{opacity:0;}100%{opacity:0;}}
@keyframes castleWinGlow{0%,100%{opacity:.12;}50%{opacity:.28;}}
`;

const SEA_CARD_CSS = `
@keyframes seaCardGlow{0%,100%{box-shadow:0 0 18px 6px #2dd4bf14,0 8px 40px rgba(0,0,0,.45);}50%{box-shadow:0 0 36px 14px #2dd4bf28,0 8px 40px rgba(0,0,0,.45);}}
@keyframes seaCardBreathe{0%,100%{border-color:#0e8f9e;box-shadow:0 0 10px 1px #0e8f9e18,0 8px 40px rgba(0,0,0,.45);}50%{border-color:#7ee8fa;box-shadow:0 0 22px 5px #2dd4bf3a,0 8px 40px rgba(0,0,0,.45);}100%{border-color:#0e8f9e;box-shadow:0 0 10px 1px #0e8f9e18,0 8px 40px rgba(0,0,0,.45);}}
`;

const rndN = (a, b) => a + Math.random() * (b - a);
const newBatPose = () => ({
  top:  rndN(0, 28),                                  // % só na faixa superior, longe do ícone
  left: rndN(2, 86),
  dx:   (Math.random() < 0.5 ? -1 : 1) * rndN(16, 58),
  dy:   (Math.random() < 0.5 ? -1 : 1) * rndN(10, 34),
  dur:  rndN(4.5, 8),
  sz:   Math.round(rndN(26, 46)),
  flip: Math.random() < 0.5,
  rot:  rndN(-12, 12),
});

// Morcego (imagem): voa só na faixa superior, some e reaparece em lugares diferentes
const VampBat = () => {
  const [pose, setPose] = useState(newBatPose);
  const [vis,  setVis]  = useState(false);
  useEffect(() => {
    let tShow, tHide, tNext;
    const cycle = () => {
      setPose(newBatPose());          // novo lugar/movimento a cada aparição
      setVis(false);
      tShow = setTimeout(() => setVis(true), 60);
      const showMs = rndN(4000, 8000);
      tHide = setTimeout(() => setVis(false), showMs);                 // some
      tNext = setTimeout(cycle, showMs + rndN(1400, 4000));            // reaparece noutro lugar
    };
    const start = setTimeout(cycle, rndN(0, 5000));
    return () => { clearTimeout(start); clearTimeout(tShow); clearTimeout(tHide); clearTimeout(tNext); };
  }, []);
  const p = pose;
  return (
  <div style={{
    position:'absolute', top:`${p.top}%`, left:`${p.left}%`,
    pointerEvents:'none',
    opacity: vis ? 0.95 : 0,
    transition:'opacity .8s ease',
    '--dx':`${p.dx}px`, '--dy':`${p.dy}px`,
    animation:`vampBatWander ${p.dur}s ease-in-out infinite`,
  }}>
    <div style={{ animation:'vampBatFlap .55s ease-in-out infinite' }}>
      <img src="/morcego.png" alt="" style={{
        width:p.sz, height:'auto', display:'block',
        transform:`scaleX(${p.flip ? -1 : 1}) rotate(${p.rot}deg)`,
        filter:'drop-shadow(0 3px 5px rgba(0,0,0,.55))',
      }}/>
    </div>
  </div>
  );
};

// Nuvem escura (cluster de elipses) que flutua perto da lua
const VampCloud = ({ top, left, scale=1, dur=26, delay=0, op=0.45 }) => (
  <svg width={92*scale} height={38*scale} viewBox="0 0 92 38" fill="none"
    style={{ position:'absolute', top, left, opacity:op, animation:`vampCloudDrift ${dur}s ease-in-out ${delay}s infinite` }}>
    <g fill="#180611">
      <ellipse cx="26" cy="26" rx="22" ry="11"/>
      <ellipse cx="46" cy="19" rx="21" ry="14"/>
      <ellipse cx="65" cy="25" rx="20" ry="11"/>
      <ellipse cx="46" cy="29" rx="32" ry="9"/>
    </g>
  </svg>
);

const VampClouds = () => (
  <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden', borderRadius:20 }}>
    <VampCloud top={2}   left="44%" scale={1}    dur={28} delay={0}   op={0.5} />
    <VampCloud top={24}  left="56%" scale={0.7}  dur={34} delay={3}   op={0.35} />
    <VampCloud top={-4}  left="66%" scale={0.85} dur={23} delay={1.5} op={0.55} />
    <VampCloud top={14}  left="30%" scale={0.6}  dur={30} delay={4.5} op={0.3} />
    <VampCloud top={6}   left="8%"  scale={0.8}  dur={26} delay={2.2} op={0.42} />
    <VampCloud top={20}  left="74%" scale={0.65} dur={31} delay={5}   op={0.35} />
    <VampCloud top={-2}  left="84%" scale={0.7}  dur={27} delay={3.5} op={0.48} />
    <VampCloud top={12}  left="-2%" scale={0.55} dur={33} delay={1}   op={0.3} />
    <VampCloud top={28}  left="40%" scale={0.6}  dur={29} delay={6}   op={0.28} />
    <VampCloud top={0}   left="22%" scale={0.75} dur={25} delay={3.8} op={0.4} />
  </div>
);

// Relâmpago vermelho (zig-zag) que pisca saindo das nuvens
const VampLightning = ({ left, top = 0, h = 52, delay = 0 }) => (
  <svg width={Math.round(h * 0.3)} height={h} viewBox="0 0 24 60" fill="none" preserveAspectRatio="none"
    style={{ position:'absolute', left, top, pointerEvents:'none', opacity:0,
             animation:`vampLightning 6s linear ${delay}s infinite`,
             filter:'drop-shadow(0 0 5px #ff2d40) drop-shadow(0 0 12px #c41e3a)' }}>
    <path d="M14 0 L5 26 L12 26 L3 60 L20 22 L12 22 L19 0 Z" fill="#ff3a4e" />
    <path d="M14 0 L5 26 L12 26 L3 60 L20 22 L12 22 L19 0 Z" fill="#fff" opacity=".3" />
  </svg>
);

// Tempestade do card: relâmpagos vermelhos em tamanhos e posições aleatórias,
// alguns longos descendo até perto do castelo
const VampStorm = () => {
  const bolts = useRef(null);
  if (!bolts.current) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    bolts.current = Array.from({ length: 7 }).map((_, i) => ({
      id: i,
      left: `${rnd(6, 88)}%`,
      top:  rnd(16, 36),
      h:    rnd(55, 185),                 // tamanhos bem diferentes
      delay: rnd(0, 0.7),
    }));
  }
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden', borderRadius:20 }}>
      <div style={{ position:'absolute', inset:0, opacity:0,
        background:'radial-gradient(ellipse at 55% 0%, #ff2d4055 0%, transparent 55%)',
        animation:'vampLightningFlash 6s linear infinite' }} />
      {bolts.current.map(b => (
        <VampLightning key={b.id} left={b.left} top={b.top} h={b.h} delay={b.delay} />
      ))}
    </div>
  );
};

// Mancha de tempestade: nuvens GRANDES e escuras, cada uma soltando um raio
// colado na ponta de baixo (meio) da nuvem.
const StormPatch = ({ pos, w = 320, h = 220, clouds = 4 }) => {
  const cfg = useRef(null);
  if (!cfg.current) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    cfg.current = Array.from({ length: clouds }).map(() => {
      const scale = rnd(1.4, 2.6);                       // nuvens grandes
      const cw = 92 * scale, ch = 38 * scale;
      const x = rnd(0, Math.max(8, w - cw));             // px dentro da caixa
      const y = rnd(0, 46);
      const cx = x + cw / 2;                             // centro horizontal da nuvem
      const cyBottom = y + ch * 0.84;                    // base da nuvem
      const boltH = rnd(85, 175);
      const boltW = Math.round(boltH * 0.3);
      return {
        cloud: { top: y, left: x, scale, op: rnd(0.72, 0.92), dur: rnd(24, 36), delay: rnd(0, 6) },
        bolt:  { left: Math.round(cx - boltW / 2), top: Math.round(cyBottom - 4), h: boltH, delay: rnd(0, 5.5) },
      };
    });
  }
  const items = cfg.current;
  return (
    <div style={{ position:'absolute', ...pos, width:w, height:h, pointerEvents:'none', overflow:'visible' }}>
      {items.map((it, i) => <VampCloud key={'c' + i} {...it.cloud} />)}
      {items.map((it, i) => <VampLightning key={'b' + i} {...it.bolt} />)}
    </div>
  );
};

// Tempestade da PÁGINA: nuvens e raios nos cantos/laterais da Central Alexa (fora do card)
const CentralStorm = () => (
  <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:1, overflow:'hidden' }}>
    <style>{`
      @keyframes vampCloudDrift{0%,100%{transform:translateX(0);}50%{transform:translateX(-16px);}}
      @keyframes vampLightning{0%{opacity:0;}1%{opacity:1;}3%{opacity:.15;}5%{opacity:.95;}8%{opacity:0;}100%{opacity:0;}}
    `}</style>
    <StormPatch pos={{ top:0,     left:0  }} w={420} h={260} clouds={4} />
    <StormPatch pos={{ top:0,     right:0 }} w={420} h={260} clouds={4} />
    <StormPatch pos={{ top:'32%', left:0  }} w={300} h={210} clouds={3} />
    <StormPatch pos={{ top:'32%', right:0 }} w={300} h={210} clouds={3} />
  </div>
);

/* ── Cenário oceânico de FUNDO da página (análogo ao CentralStorm, mas pro Uniko Sereia):
     água-vivas GIGANTES cruzando a tela em loop, cardume de peixinhos, areia + corais/anêmonas
     nos cantos inferiores e brilho de luz da água (caustics). Tudo suave/calmo. ── */
const SEA_PALETTE = ['#ff9ad5', '#7ee8fa', '#b28dff', '#ffd166', '#8affc1'];
const rndSea = (a, b) => a + Math.random() * (b - a);

// Água-viva gigante: atravessa a tela toda (esquerda→direita ou o contrário) em loop lento,
// bóia (sobe/desce) e o sino pulsa como se estivesse nadando.
const GiantJelly = ({ top, size, dur, delay, color, reverse }) => (
  <div style={{
    position: 'absolute', top: `${top}%`, left: reverse ? '110%' : '-16%', pointerEvents: 'none',
    animation: `seaJellyDrift${reverse ? 'Rev' : ''} ${dur}s linear ${delay}s infinite`,
  }}>
    <div style={{ animation: `seaJellyBob ${6 + delay % 4}s ease-in-out infinite` }}>
      <svg width={size} height={size * 1.55} viewBox="0 0 40 62" style={{ display: 'block', animation: 'seaJellyPulseBig 3s ease-in-out infinite', transformOrigin: '50% 22%', filter: `drop-shadow(0 6px 14px rgba(0,0,0,.25))` }}>
        <path d="M4 22 Q4 2 20 2 Q36 2 36 22 Q36 28 20 28 Q4 28 4 22 Z" fill={color} opacity=".7" />
        <path d="M8 20 Q20 26 32 20" stroke="rgba(255,255,255,.55)" strokeWidth="1.4" fill="none" />
        {[6, 13, 20, 27, 34].map((x, i) => (
          <path key={i} d={`M${x} 27 Q${x + (i % 2 ? 5 : -5)} 44 ${x} 60`} stroke={color} strokeWidth="2.2" fill="none" opacity=".5" strokeLinecap="round" />
        ))}
      </svg>
    </div>
  </div>
);

// Peixinho do cardume — nada devagar de um lado a outro da tela.
// O SVG (corpo em x=14, cauda em x=26-30, olho em x=6) fica de "cara" pra ESQUERDA por
// padrão — então só o peixe que nada pra DIREITA (não-reverso) precisa ser espelhado;
// o reverso (nada pra esquerda) já usa a orientação natural do desenho.
const DriftFish = ({ top, size, dur, delay, color, reverse }) => (
  <div style={{
    position: 'absolute', top: `${top}%`, left: reverse ? '108%' : '-8%', pointerEvents: 'none',
    animation: `seaFishDrift${reverse ? 'Rev' : ''} ${dur}s linear ${delay}s infinite`,
  }}>
    <svg width={size} height={size * .7} viewBox="0 0 30 20" style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.2))' }}>
      <g style={{ animation: 'seaFishTailBig .9s ease-in-out infinite', transformOrigin: '26px 10px' }}>
        <polygon points="26,10 30,3 30,17" fill={color} opacity=".85" />
      </g>
      <ellipse cx="14" cy="10" rx="12" ry="7" fill={color} />
      <circle cx="6" cy="8" r="1.6" fill="#0b1a20" />
    </svg>
  </div>
);

// Baleia — rara (1-2 por página), atravessa devagar. Pose HORIZONTAL/nivelada (a versão
// em "salto" ficava torta/diagonal na tela — corrigido). Corpo oval gordo, barriga
// pregueada clara, nadadeira peitoral, barbatana pequena e cauda em leque, sem torção.
const WHALE_BELLY = '#eaf7f8';
const DriftWhale = ({ top, size, dur, delay, color, reverse }) => (
  <div style={{
    position: 'absolute', top: `${top}%`, left: reverse ? '112%' : '-18%', pointerEvents: 'none',
    animation: `seaFishDrift${reverse ? 'Rev' : ''} ${dur}s linear ${delay}s infinite`,
  }}>
    <svg width={size} height={size * .4} viewBox="-2 -8 100 40" style={{ display: 'block', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.25))' }}>
      <ellipse cx="32" cy="16" rx="28" ry="13" fill={color} />
      <path d="M2 10 Q-2 16 2 22 Q5 25 10 23 Q5 19 5 15 Q4 12 2 10 Z" fill={color} />
      <ellipse cx="28" cy="25" rx="19" ry="5" fill={WHALE_BELLY} opacity=".8" />
      <path d="M20 24 Q16 34 10 38 Q20 34 24 26 Z" fill={color} />
      <path d="M56 4 Q60 -4 63 4 Q59 5 56 4 Z" fill={color} />
      <path d="M58 10 Q72 2 84 8 Q74 11 68 12 Q75 16 80 24 Q66 19 59 13 Z" fill={color} />
      <g opacity=".6">
        <circle cx="6" cy="-2" r="1.5" fill="#d8f2ff" />
        <circle cx="9" cy="-6" r="1" fill="#d8f2ff" />
      </g>
    </svg>
  </div>
);

// Golfinho — rara (1-2 por página), pose HORIZONTAL/nivelada: corpo oval, focinho com
// sorriso, olho grande estilo cartoon, barbatanas e cauda em leque — nível, sem torção.
const DOLPHIN_BELLY = '#eef4f7';
const DriftDolphin = ({ top, size, dur, delay, color, reverse }) => (
  <div style={{
    position: 'absolute', top: `${top}%`, left: reverse ? '108%' : '-8%', pointerEvents: 'none',
    animation: `seaFishDrift${reverse ? 'Rev' : ''} ${dur}s linear ${delay}s infinite`,
  }}>
    <svg width={size} height={size * .4} viewBox="-6 -14 84 34" style={{ display: 'block', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.22))' }}>
      <ellipse cx="24" cy="10" rx="20" ry="8" fill={color} />
      <path d="M2 8 Q-4 9 -2 13 Q0 16 6 14 Q2 12 2 8 Z" fill={color} />
      <ellipse cx="22" cy="15" rx="15" ry="3.5" fill={DOLPHIN_BELLY} opacity=".85" />
      <path d="M14 14 Q11 22 6 26 Q15 23 18 15 Z" fill={color} />
      <path d="M22 -1 Q24 -10 28 -1 Q25 0 22 -1 Z" fill={color} />
      <path d="M42 6 Q56 -2 66 5 Q58 8 53 9 Q59 13 63 20 Q50 15 43 9 Z" fill={color} />
      <path d="M-4 10 Q1 14 8 11.5" stroke="#33465a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  </div>
);

// Bolha subindo (poucas, igual ao card do mascote).
const SeaBubbleBig = ({ left, sz, dur, delay }) => (
  <div style={{
    position: 'absolute', bottom: 6, left: `${left}%`, width: sz, height: sz,
    borderRadius: '50%', pointerEvents: 'none',
    background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.85), rgba(180,240,255,.2) 60%, transparent 75%)',
    border: '1px solid rgba(220,250,255,.45)',
    animation: `seaBubbleRiseBig ${dur}s ease-in ${delay}s infinite`,
  }} />
);

// Coral + anêmona no rodapé (canto), parado (só balança de leve).
const SeaFloorDecor = ({ side }) => (
  <svg viewBox="0 0 120 70" width="150" height="88" fill="none"
    style={{ position: 'absolute', bottom: 0, [side]: 0, pointerEvents: 'none', transform: side === 'right' ? 'scaleX(-1)' : undefined }}>
    {/* anêmona (tentáculos ondulando) */}
    <g style={{ animation: 'seaAnemoneSway 4s ease-in-out infinite', transformOrigin: '30px 70px' }}>
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <path key={i} d={`M${16 + i * 5} 70 Q${13 + i * 5} 50 ${18 + i * 5} 30`} stroke={i % 2 ? '#ff8fd6' : '#ff6fb0'} strokeWidth="4" fill="none" strokeLinecap="round" opacity=".85" />
      ))}
    </g>
    {/* corais */}
    <g style={{ animation: 'seaCoralSwayBig 5s ease-in-out infinite', transformOrigin: '90px 70px' }}>
      <path d="M90 70 L90 40 M90 52 L80 38 M90 46 L100 34" stroke="#ff8a76" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="90" cy="40" r="4" fill="#ff8a76" /><circle cx="80" cy="38" r="3.4" fill="#ff8a76" /><circle cx="100" cy="34" r="3.4" fill="#ff8a76" />
    </g>
    <ellipse cx="60" cy="66" rx="26" ry="9" fill="#ffd76e" opacity=".9" />
  </svg>
);

// Coral solto, sem anêmona — pro meio do chão (os cantos já têm o SeaFloorDecor completo).
const SeaMidCoral = () => (
  <svg viewBox="0 0 60 40" width="76" height="50" fill="none"
    style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
    <g style={{ animation: 'seaCoralSwayBig 5.6s ease-in-out infinite', transformOrigin: '30px 40px' }}>
      <path d="M30 40 L30 12 M30 22 L20 10 M30 16 L40 6" stroke="#ff8a76" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="12" r="4" fill="#ff8a76" /><circle cx="20" cy="10" r="3.4" fill="#ff8a76" /><circle cx="40" cy="6" r="3.4" fill="#ff8a76" />
    </g>
    <ellipse cx="30" cy="37" rx="18" ry="6" fill="#ffd76e" opacity=".85" />
  </svg>
);

// Concha aberta com pérola dentro — nos dois cantos do chão.
// Leque rendilhado (vieira de verdade, não duas linhas finas — isso parecia "olho com
// pálpebra"), pérola branca no meio. Mesmo desenho do PearlShell em oceanScene.jsx.
const PearlShellBig = ({ side }) => (
  <svg viewBox="-2 24 64 42" width="78" height="51" fill="none"
    style={{ position: 'absolute', bottom: 4, [side]: '15%', pointerEvents: 'none', transform: side === 'right' ? 'scaleX(-1)' : undefined }}>
    <path d="M3 56 Q-0.4 51.2 4.3 47.7 Q2.6 42 8.2 40.1 Q8.2 34.2 14.1 34.2 Q16 28.6 21.7 30.3 Q25.2 25.6 30 29 Q34.8 25.6 38.3 30.3 Q44 28.6 45.9 34.2 Q51.8 34.2 51.8 40.1 Q57.4 42 55.7 47.7 Q60.4 51.2 57 56 Q30 63 3 56 Z"
      fill="#fdf3fb" stroke="#f3b6d8" strokeWidth="1.1" />
    <path d="M14.1 34.2 Q30 26 45.9 34.2 Q38.3 30.3 30 29 Q21.7 30.3 14.1 34.2 Z" fill="#ffcbe8" opacity=".6" />
    <path d="M3 56 Q30 63 57 56 Q30 59.5 3 56 Z" fill="#bfe0fb" opacity=".55" />
    <ellipse cx="30" cy="30" rx="3.2" ry="2.4" fill="#ffb0d6" opacity=".7" />
    <g strokeWidth="1" opacity=".65" strokeLinecap="round">
      <path d="M30 57 L4.3 47.7" stroke="#f5abd4" />
      <path d="M30 57 L8.2 40.1" stroke="#a9d4f0" />
      <path d="M30 57 L14.1 34.2" stroke="#f5abd4" />
      <path d="M30 57 L21.7 30.3" stroke="#a9d4f0" />
      <path d="M30 57 L30 29" stroke="#f5abd4" />
      <path d="M30 57 L38.3 30.3" stroke="#a9d4f0" />
      <path d="M30 57 L45.9 34.2" stroke="#f5abd4" />
      <path d="M30 57 L51.8 40.1" stroke="#a9d4f0" />
      <path d="M30 57 L55.7 47.7" stroke="#f5abd4" />
    </g>
    <circle cx="31.4" cy="48" r="7.2" fill="#cfe0f7" opacity=".4" />
    <circle cx="30" cy="46" r="7.2" fill="#fbf6ff" stroke="#e8d9f5" strokeWidth=".5" opacity=".97" />
    <circle cx="26.9" cy="42.8" r="2.2" fill="#fff" opacity=".95" />
  </svg>
);

// Alga marinha: folhas onduladas saindo da areia, balançando suavemente de um lado pro
// outro (sway maior que o coral, que é rígido). Só no cenário de FUNDO (tela cheia) —
// o card pequeno do mascote já tem elementos suficientes (pedido do usuário).
const SEAWEED_PALETTE = ['#1b7a5c', '#2f9e73', '#4cbf8f'];
const SeaweedBlade = ({ x, h, g, color, dur, delay }) => (
  <g style={{ animation: `seaweedSway ${dur}s ease-in-out ${delay}s infinite`, transformOrigin: `${x}px ${g}px` }}>
    <path d={`M${x} ${g} Q${x - 5} ${g - h * 0.4} ${x + 3} ${g - h * 0.72} Q${x + 7} ${g - h * 0.9} ${x} ${g - h}`}
      stroke={color} strokeWidth="4.5" strokeLinecap="round" fill="none" />
  </g>
);
const SeaweedCluster = ({ style }) => (
  <svg viewBox="0 0 70 96" width="86" height="118" style={{ position: 'absolute', bottom: -6, pointerEvents: 'none', zIndex: 1, ...style }}>
    <SeaweedBlade x={16} h={54} g={92} color={SEAWEED_PALETTE[0]} dur={4.4} delay={0} />
    <SeaweedBlade x={28} h={70} g={92} color={SEAWEED_PALETTE[1]} dur={5.2} delay={0.5} />
    <SeaweedBlade x={40} h={60} g={92} color={SEAWEED_PALETTE[2]} dur={4.8} delay={0.2} />
    <SeaweedBlade x={52} h={46} g={92} color={SEAWEED_PALETTE[0]} dur={3.9} delay={0.7} />
  </svg>
);

const CentralOcean = () => {
  const jellies = useRef(null);
  if (!jellies.current) {
    jellies.current = Array.from({ length: 4 }).map((_, i) => ({
      id: i, top: rndSea(2, 46), size: Math.round(rndSea(70, 150)), dur: rndSea(30, 52),
      delay: rndSea(0, 24), color: SEA_PALETTE[i % SEA_PALETTE.length], reverse: i % 2 === 1,
    }));
  }
  const fish = useRef(null);
  if (!fish.current) {
    fish.current = Array.from({ length: 9 }).map((_, i) => ({
      id: i, top: rndSea(55, 92), size: Math.round(rndSea(18, 32)), dur: rndSea(14, 26),
      delay: rndSea(0, 16), color: SEA_PALETTE[(i + 2) % SEA_PALETTE.length], reverse: i % 2 === 0,
    }));
  }
  const bubbles = useRef(null);
  if (!bubbles.current) {
    bubbles.current = Array.from({ length: 5 }).map((_, i) => ({
      id: i, left: rndSea(4, 96), sz: rndSea(5, 13), dur: rndSea(9, 16), delay: rndSea(0, 10),
    }));
  }
  // Baleia/golfinho são raros de propósito — no máximo 1 ou 2 de cada.
  const whales = useRef(null);
  if (!whales.current) {
    const n = 1 + Math.round(Math.random());
    whales.current = Array.from({ length: n }).map((_, i) => ({
      id: i, top: rndSea(10, 42), size: Math.round(rndSea(100, 140)), dur: rndSea(28, 42),
      delay: rndSea(0, 20), color: '#2f8f9e', reverse: i % 2 === 1,
    }));
  }
  const dolphins = useRef(null);
  if (!dolphins.current) {
    const n = 1 + Math.round(Math.random());
    dolphins.current = Array.from({ length: n }).map((_, i) => ({
      id: i, top: rndSea(20, 58), size: Math.round(rndSea(62, 88)), dur: rndSea(18, 28),
      delay: rndSea(0, 14), color: '#7fa0b8', reverse: i % 2 === 0,
    }));
  }
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
      <style>{`
        @keyframes seaJellyDrift{0%{transform:translateX(0);}100%{transform:translateX(132vw);}}
        @keyframes seaJellyDriftRev{0%{transform:translateX(0);}100%{transform:translateX(-132vw);}}
        @keyframes seaJellyBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-22px);}}
        @keyframes seaJellyPulseBig{0%,100%{transform:scaleY(1) scaleX(1);}50%{transform:scaleY(.8) scaleX(1.1);}}
        @keyframes seaFishDrift{0%{transform:translateX(0) scaleX(-1);}100%{transform:translateX(118vw) scaleX(-1);}}
        @keyframes seaFishDriftRev{0%{transform:translateX(0);}100%{transform:translateX(-118vw);}}
        @keyframes seaFishTailBig{0%,100%{transform:rotate(-14deg);}50%{transform:rotate(14deg);}}
        @keyframes seaAnemoneSway{0%,100%{transform:rotate(-3deg);}50%{transform:rotate(3deg);}}
        @keyframes seaCoralSwayBig{0%,100%{transform:rotate(-2deg);}50%{transform:rotate(2deg);}}
        @keyframes seaSandGlow{0%,100%{opacity:.7;}50%{opacity:1;}}
        @keyframes seaCausticDrift{0%,100%{opacity:.10;}50%{opacity:.2;}}
        @keyframes seaBubbleRiseBig{0%{transform:translateY(0) scale(.7);opacity:0;}8%{opacity:.8;}92%{opacity:.4;}100%{transform:translateY(-70vh) scale(1);opacity:0;}}
        @keyframes seaweedSway{0%,100%{transform:rotate(-7deg);}50%{transform:rotate(7deg);}}
      `}</style>

      {/* Areia no rodapé da tela — duas dunas sólidas (a versão antiga era só um gradiente
          quase invisível, o chão ficava sem areia de verdade aparecendo) */}
      <svg viewBox="0 0 400 90" preserveAspectRatio="none" width="100%" height="90"
        style={{ position: 'absolute', left: 0, right: 0, bottom: -2, pointerEvents: 'none' }}>
        <path d="M0 90 L0 46 Q50 26 110 36 Q180 48 240 32 Q300 16 360 38 Q385 48 400 36 L400 90 Z" fill="#e0be80" opacity=".88" />
        <path d="M0 90 L0 58 Q80 44 160 56 Q240 68 320 52 Q365 42 400 58 L400 90 Z" fill="#cfa863" opacity=".88" />
      </svg>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, pointerEvents: 'none',
        background: 'linear-gradient(180deg, transparent 45%, #fff2c422 70%, transparent 100%)',
        animation: 'seaSandGlow 5s ease-in-out infinite',
      }} />

      <SeaFloorDecor side="left" />
      <SeaFloorDecor side="right" />
      <SeaMidCoral />
      <PearlShellBig side="left" />
      <PearlShellBig side="right" />
      <SeaweedCluster style={{ left: '26%' }} />
      <SeaweedCluster style={{ left: '62%' }} />
      <TubeCoral style={{ left: '38%' }} scale={1.8} />
      <MushroomCoral style={{ left: '74%' }} scale={1.7} />

      {whales.current.map(w => <DriftWhale key={w.id} {...w} />)}
      {dolphins.current.map(d => <DriftDolphin key={d.id} {...d} />)}
      {jellies.current.map(j => <GiantJelly key={j.id} {...j} />)}
      {fish.current.map(f => <DriftFish key={f.id} {...f} />)}
      {bubbles.current.map(b => <SeaBubbleBig key={b.id} {...b} />)}

      {/* Brilho/reflexo de luz da água (caustics) — listras GROSSAS e poucas, igual ao card */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(120deg, rgba(255,255,255,.14) 0 34px, transparent 34px 180px)',
        animation: 'seaCausticDrift 4.5s ease-in-out infinite',
      }} />
    </div>
  );
};

// ── Cenário cósmico de FUNDO da página (Destruidora de Mundos) — canvas animado
//    (estrelas, nebulosa, mini-galáxias, planetas com anéis, planetas estilhaçados com
//    cacos orbitando, destroços e a espada cravada num planeta). Ver cosmosScene.jsx —
//    o MESMO componente serve pro card do encontro (CaptureUnikoWidget) via `fixed=false`
//    e pra tela cheia aqui via `fixed=true` (o canvas se redimensiona sozinho).
const CentralCosmos = () => <CosmosScene fixed />;

// ── Cenário de floresta de sakura de FUNDO da página (Uniko Kitsune) — o MESMO
//    componente canvas serve pro card (fixed=false) e pra tela cheia aqui (fixed=true):
//    árvores de cerejeira, pétalas caindo, grama rosa, cachoeira/rio, névoas e torii.
const CentralSakura = () => <SakuraScene fixed />;

// ── Jardim encantado de FUNDO da página (Uniko Rainha das Fadas) — mesmo componente
//    canvas do card (fixed=false) e da tela cheia (fixed=true): sol, árvores grandes,
//    rio, flores coloridas, fadinhas voando e brilhos.
const CentralFairy = () => <FairyScene fixed />;
const CentralOlivia = () => <OliviaScene fixed />;

// ── Vídeo de fundo da página (por Uniko, configurado no Dashboard RH) — mutado,
//    autoplay e loop, cobrindo a tela toda atrás do conteúdo. SUBSTITUI o
//    cenário animado codado quando o Uniko do DJ atual tem vídeo. O véu escuro
//    por cima mantém o texto/HUD legível sobre qualquer vídeo.
//    memo + props estáveis: a Central Alexa re-renderiza a cada 200ms (timer da
//    letra) — sem o memo o React ficaria reconciliando o <video> toda hora.
//    Este é o ÚNICO decode de vídeo na tela: o card do Uniko fica translúcido e
//    deixa ESTE vídeo aparecer atrás do mascote (antes eu decodificava o mesmo
//    vídeo 2x — tela cheia + card — e era o que travava).
const CentralBgVideo = memo(function CentralBgVideo({ url }) {
  // IMPORTANTE: NÃO forçar GPU no <video> (nada de translateZ/will-change nele).
  // Isso desliga o "video overlay" nativo do navegador e faz o vídeo virar uma
  // textura de camada com resolução limitada → fica borrado/baixa qualidade,
  // principalmente em tela grande/4K. Deixando o vídeo puro, ele toca na
  // resolução NATIVA (máxima). O travamento já foi resolvido tirando o peso de
  // CIMA do vídeo (backdrop-filter + blobs), não mexendo no vídeo em si.
  return (
    <div style={{ position:'fixed', inset:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
      <video src={url} muted autoPlay loop playsInline preload="auto"
        style={{ width:'100%', height:'100%', objectFit:'cover' }} />
    </div>
  );
});

// Animação rápida (~3s): enxame de morcegos surge do centro e voa em diagonal pra longe
const BatBurstOverlay = () => {
  const bats = useRef(null);
  if (!bats.current) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]; // TL, TR, BL, BR
    bats.current = Array.from({ length: 64 }).map((_, i) => {
      const [cx, cy] = CORNERS[Math.floor(Math.random() * 4)]; // mira num dos 4 cantos
      return {
        id: i,
        x:   rnd(36, 64),                          // % posição inicial (perto do centro)
        y:   rnd(36, 64),
        dx:  cx * rnd(80, 140),                    // vmax → ultrapassa o canto e sai da tela
        dy:  cy * rnd(80, 140),
        sz:  Math.round(rnd(26, 60)),
        dur: rnd(4.2, 5.0),                        // lento: dá pra ver as asas batendo
        delay: rnd(0, 0.25),                       // praticamente todos ao mesmo tempo
        rot: rnd(-30, 30),
        flap: rnd(0.45, 0.7),                      // velocidade do bater de asas
        flip: cx < 0 ? -1 : 1,                     // vira na direção do voo
      };
    });
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99998, pointerEvents:'none', overflow:'hidden' }}>
      <style>{`
        @keyframes batBurstFlash{0%{opacity:0;}20%{opacity:.4;}80%{opacity:.28;}100%{opacity:0;}}
        @keyframes batBurstFly{
          0%{transform:translate(-50%,-50%) scale(1) rotate(var(--brot));opacity:0;}
          7%{opacity:1;}
          90%{opacity:1;}
          100%{transform:translate(calc(-50% + var(--bdx)),calc(-50% + var(--bdy))) scale(.4) rotate(var(--brot));opacity:0;}
        }
        @keyframes batBurstFlap{0%,100%{transform:scaleY(1);}50%{transform:scaleY(.78);}}
      `}</style>
      {/* Escurecimento pra dar destaque */}
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(ellipse at 50% 45%, rgba(40,0,8,.0) 30%, rgba(8,0,4,.85) 100%)',
        animation:'batBurstFlash 5.25s ease-out forwards',
      }}/>
      {bats.current.map(b => (
        <div key={b.id} style={{
          position:'absolute', left:`${b.x}%`, top:`${b.y}%`,
          '--bdx':`${b.dx}vmax`, '--bdy':`${b.dy}vmax`, '--brot':`${b.rot}deg`,
          animation:`batBurstFly ${b.dur}s ease-in ${b.delay}s both`,
        }}>
          <div style={{ animation:`batBurstFlap ${b.flap}s ease-in-out infinite` }}>
            <img src="/morcego.png" alt="" style={{
              display:'block', width:b.sz, height:'auto',
              transform:`scaleX(${b.flip})`,
              filter:'drop-shadow(0 2px 7px rgba(0,0,0,.6))',
            }}/>
          </div>
        </div>
      ))}
    </div>
  );
};

// Animação rápida (~5s): explosão de bolhas surge do centro e sobe/voa em diagonal
// pra longe, em direção aos 4 cantos da tela, sumindo de vez — equivalente calmo
// (turquesa, sem susto) do burst de morcegos do Vampire-Robot, pra Uniko Sereia.
const BubbleBurstOverlay = () => {
  const bubbles = useRef(null);
  if (!bubbles.current) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]; // TL, TR, BL, BR
    bubbles.current = Array.from({ length: 100 }).map((_, i) => {
      const [cx, cy] = CORNERS[Math.floor(Math.random() * 4)]; // mira num dos 4 cantos
      return {
        id: i,
        x:   rnd(36, 64),                          // % posição inicial (perto do centro)
        y:   rnd(36, 64),
        dx:  cx * rnd(80, 140),                    // vmax → ultrapassa o canto e sai da tela
        dy:  cy * rnd(80, 140),
        sz:  Math.round(rnd(14, 46)),
        dur: rnd(4.2, 5.0),                        // lento: dá pra ver elas subindo/afastando
        delay: rnd(0, 0.3),                        // praticamente todas ao mesmo tempo
        wob: rnd(0.6, 1.1),                        // velocidade do bambolear
      };
    });
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99998, pointerEvents:'none', overflow:'hidden' }}>
      <style>{`
        @keyframes bubbleBurstFlash{0%{opacity:0;}20%{opacity:.4;}80%{opacity:.28;}100%{opacity:0;}}
        @keyframes bubbleBurstFly{
          0%{transform:translate(-50%,-50%) scale(.4);opacity:0;}
          7%{opacity:1;}
          90%{opacity:.85;}
          100%{transform:translate(calc(-50% + var(--bdx)),calc(-50% + var(--bdy))) scale(1.15);opacity:0;}
        }
        @keyframes bubbleBurstWobble{0%,100%{margin-left:0;}50%{margin-left:6px;}}
      `}</style>
      {/* Clareamento turquesa suave pra dar destaque (sem o susto do vermelho do vampiro) */}
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(ellipse at 50% 45%, rgba(126,232,250,.0) 30%, rgba(3,20,26,.55) 100%)',
        animation:'bubbleBurstFlash 5.25s ease-out forwards',
      }}/>
      {bubbles.current.map(b => (
        <div key={b.id} style={{
          position:'absolute', left:`${b.x}%`, top:`${b.y}%`,
          '--bdx':`${b.dx}vmax`, '--bdy':`${b.dy}vmax`,
          animation:`bubbleBurstFly ${b.dur}s ease-in ${b.delay}s both`,
        }}>
          <div style={{
            width:b.sz, height:b.sz, borderRadius:'50%',
            background:'radial-gradient(circle at 32% 28%, rgba(255,255,255,.92), rgba(180,240,255,.3) 60%, transparent 75%)',
            border:'1px solid rgba(220,250,255,.55)',
            boxShadow:'0 0 8px rgba(126,232,250,.4)',
            animation:`bubbleBurstWobble ${b.wob}s ease-in-out infinite`,
          }}/>
        </div>
      ))}
    </div>
  );
};

// Animação rápida (~5s): explosão de estrelas brancas/roxas e meteoros/rochas surge do
// centro e voa em diagonal pra longe, em direção aos 4 cantos da tela — equivalente
// cósmico do burst de morcegos (Vampire-Robot) e de bolhas (Sereia), pra Destruidora
// de Mundos. Mistura estrelas (sparkle branco/roxo) e pequenas rochas com rastro.
const MeteorBurstOverlay = () => {
  const items = useRef(null);
  if (!items.current) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]; // TL, TR, BL, BR
    items.current = Array.from({ length: 90 }).map((_, i) => {
      const [cx, cy] = CORNERS[Math.floor(Math.random() * 4)]; // mira num dos 4 cantos
      const dx = cx * rnd(80, 140), dy = cy * rnd(80, 140);    // vmax → ultrapassa o canto
      const isRock = i % 3 === 0;                              // ~1/3 rochas/meteoros, resto estrelas
      return {
        id: i, kind: isRock ? 'rock' : 'star',
        x: rnd(36, 64), y: rnd(36, 64),                        // % posição inicial (perto do centro)
        dx, dy,
        sz: isRock ? Math.round(rnd(10, 22)) : Math.round(rnd(10, 26)),
        dur: rnd(4.2, 5.0), delay: rnd(0, 0.3),                // praticamente todos ao mesmo tempo
        twinkle: rnd(0.6, 1.1), spin: rnd(1.5, 3),
        angle: Math.atan2(dy, dx) * 180 / Math.PI,             // direção do voo (pro rastro da rocha)
        color: Math.random() < 0.55 ? '#ffffff' : '#c9a3ff',   // branco ou roxo
      };
    });
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99998, pointerEvents:'none', overflow:'hidden' }}>
      <style>{`
        @keyframes meteorBurstFlash{0%{opacity:0;}20%{opacity:.4;}80%{opacity:.28;}100%{opacity:0;}}
        @keyframes meteorBurstFly{
          0%{transform:translate(-50%,-50%) scale(.5);opacity:0;}
          7%{opacity:1;}
          90%{opacity:.9;}
          100%{transform:translate(calc(-50% + var(--bdx)),calc(-50% + var(--bdy))) scale(1.1);opacity:0;}
        }
        @keyframes meteorBurstSpin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}
        @keyframes meteorBurstTwinkle{0%,100%{opacity:.5;}50%{opacity:1;}}
      `}</style>
      {/* Escurecimento roxo pra dar destaque (sem o susto do vermelho do vampiro) */}
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(ellipse at 50% 45%, rgba(157,107,255,.0) 30%, rgba(10,3,20,.72) 100%)',
        animation:'meteorBurstFlash 5.25s ease-out forwards',
      }}/>
      {items.current.map(b => (
        <div key={b.id} style={{
          position:'absolute', left:`${b.x}%`, top:`${b.y}%`,
          '--bdx':`${b.dx}vmax`, '--bdy':`${b.dy}vmax`,
          animation:`meteorBurstFly ${b.dur}s ease-in ${b.delay}s both`,
        }}>
          {b.kind === 'star' ? (
            <svg width={b.sz} height={b.sz} viewBox="0 0 24 24" style={{
              display:'block', animation:`meteorBurstTwinkle ${b.twinkle}s ease-in-out infinite`,
              filter:`drop-shadow(0 0 4px ${b.color})`,
            }}>
              <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill={b.color}/>
            </svg>
          ) : (
            <div style={{ position:'relative', width:b.sz, height:b.sz }}>
              {/* rastro da rocha, alinhado com a direção do voo */}
              <div style={{
                position:'absolute', left:'50%', top:'50%', width:b.sz * 3.2, height:2,
                background:`linear-gradient(90deg, transparent, ${b.color}99)`,
                transform:`translate(-100%,-50%) rotate(${b.angle + 180}deg)`, transformOrigin:'100% 50%',
              }}/>
              <div style={{
                width:'100%', height:'100%', borderRadius:'50%',
                background:'radial-gradient(circle at 35% 30%, #2b1d3f, #120a1e 70%)',
                border:`1px solid ${b.color}aa`,
                animation:`meteorBurstSpin ${b.spin}s linear infinite`,
                boxShadow:`0 0 6px ${b.color}88`,
              }}/>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Árvore pequena e seca (sem folhas) — silhueta de galhos (g = linha do chão)
const BareTree = ({ x, h = 30, s = 1, g = 105 }) => (
  <g stroke="#34161f" strokeWidth={1.5 * s} fill="none" strokeLinecap="round">
    <path d={`M${x} ${g} L${x} ${g - h}`} />
    <path d={`M${x} ${g - h * 0.5} L${x - 5 * s} ${g - h * 0.72}`} />
    <path d={`M${x} ${g - h * 0.45} L${x + 5 * s} ${g - h * 0.66}`} />
    <path d={`M${x - 5 * s} ${g - h * 0.72} L${x - 8 * s} ${g - h * 0.84}`} />
    <path d={`M${x + 5 * s} ${g - h * 0.66} L${x + 8 * s} ${g - h * 0.78}`} />
    <path d={`M${x} ${g - h * 0.78} L${x - 4 * s} ${g - h * 0.95}`} />
    <path d={`M${x} ${g - h * 0.82} L${x + 4 * s} ${g - h * 0.98}`} />
  </g>
);

// Cluster de árvores secas para os cantos inferiores do card (fora do castelo)
const SideTreeCluster = ({ side }) => (
  <svg viewBox="0 0 58 48" width="58" height="48" fill="none"
    style={{ position:'absolute', bottom:0, [side]:0, pointerEvents:'none', zIndex:1,
             transform: side === 'right' ? 'scaleX(-1)' : undefined }}>
    <BareTree x={13} h={34} s={1}    g={48} />
    <BareTree x={31} h={21} s={0.7}  g={48} />
    <BareTree x={46} h={27} s={0.85} g={48} />
  </svg>
);

const VampCastle = () => (
  <svg viewBox="0 0 220 105" width="220" height="105" fill="none"
    style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', pointerEvents:'none', zIndex:1 }}>
    {/* Far left turret */}
    <rect x="2" y="62" width="22" height="43" fill="#180610"/>
    <rect x="2"  y="56" width="4" height="7" fill="#180610"/>
    <rect x="8"  y="56" width="4" height="7" fill="#180610"/>
    <rect x="14" y="56" width="4" height="7" fill="#180610"/>
    <rect x="20" y="56" width="4" height="7" fill="#180610"/>
    {/* Left tower */}
    <rect x="22" y="48" width="36" height="57" fill="#140410"/>
    <rect x="22" y="42" width="5" height="8" fill="#140410"/>
    <rect x="29" y="42" width="5" height="8" fill="#140410"/>
    <rect x="36" y="42" width="5" height="8" fill="#140410"/>
    <rect x="43" y="42" width="5" height="8" fill="#140410"/>
    <rect x="50" y="42" width="7" height="8" fill="#140410"/>
    {/* Left tower window */}
    <rect x="31" y="60" width="16" height="22" fill="#0c0008"/>
    <rect x="33" y="62" width="12" height="18" fill="#c41e3a" opacity=".1" style={{ animation:'castleWinGlow 3s ease-in-out infinite' }}/>
    {/* Centre tower (tallest) */}
    <rect x="64" y="22" width="92" height="83" fill="#100308"/>
    <rect x="62"  y="14" width="8"  height="10" fill="#100308"/>
    <rect x="72"  y="14" width="8"  height="10" fill="#100308"/>
    <rect x="82"  y="14" width="8"  height="10" fill="#100308"/>
    <rect x="92"  y="14" width="8"  height="10" fill="#100308"/>
    <rect x="102" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="112" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="122" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="132" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="142" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="152" y="14" width="10" height="10" fill="#100308"/>
    {/* Centre large window */}
    <rect x="82" y="36" width="56" height="50" fill="#0a0006"/>
    <rect x="84" y="38" width="52" height="46" fill="#c41e3a" opacity=".12" style={{ animation:'castleWinGlow 3.5s ease-in-out 1s infinite' }}/>
    {/* Centre gate arch */}
    <path d="M96 105 L96 72 Q110 56 124 72 L124 105" fill="#0a0006"/>
    {/* Right tower */}
    <rect x="162" y="48" width="36" height="57" fill="#140410"/>
    <rect x="162" y="42" width="5" height="8" fill="#140410"/>
    <rect x="169" y="42" width="5" height="8" fill="#140410"/>
    <rect x="176" y="42" width="5" height="8" fill="#140410"/>
    <rect x="183" y="42" width="5" height="8" fill="#140410"/>
    <rect x="190" y="42" width="7" height="8" fill="#140410"/>
    {/* Right tower window */}
    <rect x="173" y="60" width="16" height="22" fill="#0c0008"/>
    <rect x="175" y="62" width="12" height="18" fill="#c41e3a" opacity=".1" style={{ animation:'castleWinGlow 2.8s ease-in-out .5s infinite' }}/>
    {/* Far right turret */}
    <rect x="196" y="62" width="22" height="43" fill="#180610"/>
    <rect x="196" y="56" width="4" height="7" fill="#180610"/>
    <rect x="202" y="56" width="4" height="7" fill="#180610"/>
    <rect x="208" y="56" width="4" height="7" fill="#180610"/>
    <rect x="214" y="56" width="4" height="7" fill="#180610"/>
    {/* Árvores secas ao lado do castelo */}
    <BareTree x={11}  h={32} s={1} />
    <BareTree x={28}  h={20} s={0.65} />
    <BareTree x={209} h={34} s={1.05} />
    <BareTree x={192} h={21} s={0.7} />
  </svg>
);

// Avatar da fila: zoom leve no hover; se tiver foto, clica para expandir
const QueueAvatar = ({ name, photo, onExpand }) => {
  const [hover, setHover] = useState(false);
  const clickable = !!photo;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={clickable ? (e) => { e.stopPropagation(); onExpand({ photo, name }); } : undefined}
      title={clickable ? `Ver foto de ${name}` : undefined}
      style={{
        flexShrink: 0, lineHeight: 0, borderRadius: '8px',
        cursor: clickable ? 'zoom-in' : 'default',
        transition: 'transform .18s ease, box-shadow .18s ease',
        transform: hover && clickable ? 'scale(1.22)' : 'scale(1)',
        boxShadow: hover && clickable ? '0 4px 16px rgba(0,0,0,.45)' : 'none',
        position: 'relative', zIndex: hover && clickable ? 5 : 1,
      }}
    >
      <AvatarCircle name={name} photo={photo} size={30} fontSize={12} rounded="8px" />
    </div>
  );
};

// Extrai cores dominantes da capa do álbum via Canvas
// Usa proxy do servidor para contornar CORS da CDN do Spotify
async function extractAlbumColors(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl) { resolve(null); return; }
    // Capa da Biblioteca Local já é um data-URL (base64 inline) — não tem CORS
    // pra contornar (não é uma requisição de rede) e o proxy do servidor não
    // sabe buscar um "data:" (só serve pra URL remota tipo CDN do Spotify).
    // Mandar pro proxy dava um ERR_FAILED no console e nunca extraía a cor.
    const isDataUrl = imageUrl.startsWith('data:');
    const proxied = isDataUrl ? imageUrl : `${SERVER_URL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    const img = new Image();
    if (!isDataUrl) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const W = 80, H = 80;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H).data;

        const region = (x1, y1, x2, y2) => {
          let r=0,g=0,b=0,n=0;
          for(let y=y1;y<y2;y++) for(let x=x1;x<x2;x++){
            const i=(y*W+x)*4; r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++;
          }
          return [Math.round(r/n), Math.round(g/n), Math.round(b/n)];
        };

        const boost = ([r,g,b], s=1.6) => {
          const avg=(r+g+b)/3;
          const clamp=v=>Math.min(255,Math.max(0,Math.round(v)));
          const R=clamp(avg+(r-avg)*s), G=clamp(avg+(g-avg)*s), B=clamp(avg+(b-avg)*s);
          return '#'+[R,G,B].map(v=>v.toString(16).padStart(2,'0')).join('');
        };

        resolve([
          boost(region(0,0,40,40)),       // canto sup esq
          boost(region(40,0,80,40)),      // canto sup dir
          boost(region(0,40,40,80)),      // canto inf esq
          boost(region(40,40,80,80)),     // canto inf dir
          boost(region(15,15,65,65)),     // centro
          boost(region(0,0,80,25)),       // topo total
          boost(region(0,55,80,80)),      // base total
          boost(region(30,0,50,80)),      // faixa central vertical
          boost(region(0,25,80,55),1.9),  // meio com saturação extra
          boost(region(10,10,40,40),2.2), // sup esq super-saturado
        ]);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = proxied;
  });
}

// Carrega a IFrame API do YouTube uma única vez (compartilhada na página)
function loadYouTubeApi() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
}

/* ══════════════════════════════════════════════════
   Mini janela flutuante com o videoclipe (visual).
   O vídeo toca SEMPRE mudo — o áudio vem do Spotify/Echo.
   Se o vídeo bloquear embed (erro 101/150) ou falhar, chama
   onUnavailable() para o pai esconder a janela.
══════════════════════════════════════════════════ */
function FestivalVideoWindow({ videoId, title, getSeekSec, theme, onClose, onUnavailable }) {
  const holderRef = useRef(null);
  const playerRef = useRef(null);
  // Ref sempre com a posição AO VIVO da música (progressMs/1000), pra sincronizar
  const seekRef = useRef(getSeekSec);
  seekRef.current = getSeekSec;
  const liveSec = () => { try { return Math.max(0, seekRef.current ? seekRef.current() : 0); } catch { return 0; } };

  // ── Arrastar (pela barra) + redimensionar (alça) — posição/tamanho salvos ──
  const HEADER_H = 34, MIN_W = 240;
  const [box, setBox] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('ch_fest_video_box') || 'null');
      if (s && typeof s.w === 'number' && typeof s.x === 'number') return s;
    } catch {}
    const w = 440;
    return {
      w,
      x: Math.max(8, window.innerWidth  - w - 18),
      y: Math.max(8, window.innerHeight - (w * 9 / 16 + HEADER_H) - 18),
    };
  });
  const [dragging, setDragging] = useState(null); // 'move' | 'resize' | null
  const gestureRef = useRef(null);
  // Janela fixada: trava o arrastar/redimensionar pra dar scroll sem mover sem querer
  const [locked, setLocked] = useState(() => {
    try { return localStorage.getItem('ch_fest_video_locked') === '1'; } catch { return false; }
  });
  const toggleLock = () => setLocked(v => {
    const nv = !v;
    try { localStorage.setItem('ch_fest_video_locked', nv ? '1' : '0'); } catch {}
    return nv;
  });

  useEffect(() => {
    const onMove = (e) => {
      const g = gestureRef.current; if (!g) return;
      if (g.mode === 'move') {
        const h = g.w * 9 / 16 + HEADER_H;
        const x = Math.min(Math.max(4, g.ox + (e.clientX - g.sx)), window.innerWidth  - g.w - 4);
        const y = Math.min(Math.max(4, g.oy + (e.clientY - g.sy)), window.innerHeight - h  - 4);
        setBox(b => ({ ...b, x, y }));
      } else {
        const maxW = Math.min(window.innerWidth * 0.96, 1000);
        const w = Math.min(Math.max(MIN_W, g.ow + (e.clientX - g.sx)), maxW);
        setBox(b => ({ ...b, w }));
      }
    };
    const onUp = () => {
      gestureRef.current = null;
      setDragging(null);
      setBox(b => { try { localStorage.setItem('ch_fest_video_box', JSON.stringify(b)); } catch {} return b; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);

  const startMove = (e) => {
    if (locked) return;                            // janela fixada: não move
    if (e.target.closest('button')) return;       // não arrasta ao clicar no X / fixar
    e.preventDefault();
    gestureRef.current = { mode:'move', sx:e.clientX, sy:e.clientY, ox:box.x, oy:box.y, w:box.w };
    setDragging('move');
  };
  const startResize = (e) => {
    if (locked) return;                            // janela fixada: não redimensiona
    e.preventDefault(); e.stopPropagation();
    gestureRef.current = { mode:'resize', sx:e.clientX, sy:e.clientY, ow:box.w };
    setDragging('resize');
  };

  // Cria o player uma vez (no mount); troca de vídeo sem recriar o iframe
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !holderRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(holderRef.current, {
        width: '100%', height: '100%', videoId,
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1,
          disablekb: 1, fs: 0, iv_load_policy: 3,
          start: Math.floor(liveSec()),
        },
        events: {
          onReady: (e) => { try { e.target.mute(); e.target.seekTo(liveSec(), true); e.target.playVideo(); } catch {} },
          onError: () => { if (onUnavailable) onUnavailable(); },
        },
      });
    });
    return () => {
      cancelled = true;
      try { playerRef.current && playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Troca o clipe quando a música muda (mantém a janela) — já alinhado ao tempo atual
  useEffect(() => {
    const p = playerRef.current;
    if (p && p.loadVideoById) {
      try { p.loadVideoById({ videoId, startSeconds: Math.floor(liveSec()) }); p.mute(); } catch {}
    }
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sincroniza o vídeo com o relógio da música: corrige quando desvia >2s
  useEffect(() => {
    const iv = setInterval(() => {
      const p = playerRef.current;
      if (!p || !p.getCurrentTime) return;
      try {
        const target = liveSec();
        if (target > 0 && Math.abs(p.getCurrentTime() - target) > 2) p.seekTo(target, true);
      } catch {}
    }, 3000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Overlay durante o gesto: impede o iframe de "engolir" o pointermove */}
      {dragging && (
        <div style={{ position:'fixed', inset:0, zIndex:1300,
          cursor: dragging === 'resize' ? 'nwse-resize' : 'grabbing' }}/>
      )}
      <div style={{ position:'fixed', left:box.x, top:box.y, width:box.w, zIndex:1200,
        borderRadius:14, overflow:'hidden', background:'#000',
        boxShadow:'0 14px 44px rgba(0,0,0,0.5)', border:`1px solid ${theme.border}` }}>
        <div onPointerDown={startMove}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', height:HEADER_H,
            boxSizing:'border-box', background: theme.cardBg, cursor: locked ? 'default' : 'grab',
            backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', touchAction:'none' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={theme.textS} strokeWidth="2" strokeLinecap="round" style={{flexShrink:0,opacity: locked ? .25 : .6}}><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
          <span style={{ fontSize:11, fontWeight:700, color:theme.text, flex:1,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>🎬 {title}</span>
          <button onClick={toggleLock} title={locked ? "Soltar janela (permitir mover)" : "Fixar janela (travar posição)"}
            style={{ border:'none', background:'transparent', cursor:'pointer', color: locked ? theme.gold : theme.textS, display:'flex', padding:2 }}>
            {locked
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>}
          </button>
          <button onClick={onClose} title="Fechar clipe"
            style={{ border:'none', background:'transparent', cursor:'pointer', color:theme.textS, display:'flex', padding:2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ position:'relative', width:'100%', aspectRatio:'16 / 9', background:'#000' }}>
          <div ref={holderRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}/>
          {/* Camada transparente: bloqueia clique/pause/maximizar dentro do vídeo */}
          <div style={{ position:'absolute', inset:0, zIndex:1, cursor:'default' }}/>
          {/* Alça de redimensionamento (canto inferior direito) — some quando fixada */}
          {!locked && (
            <div onPointerDown={startResize} title="Redimensionar"
              style={{ position:'absolute', right:0, bottom:0, width:22, height:22, zIndex:2,
                cursor:'nwse-resize', touchAction:'none', display:'flex', alignItems:'flex-end', justifyContent:'flex-end', padding:3 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" style={{opacity:.85,filter:'drop-shadow(0 1px 2px rgba(0,0,0,.8))'}}><path d="M22 22L22 14M22 22L14 22M22 22L11 11"/></svg>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════
   CENTRAL ALEXA — Festival · Mural · Recados
══════════════════════════════════════════════════ */
const MOCK_QUEUE = [
  {id:1,title:'Blinding Lights',artist:'The Weeknd',addedBy:'Ander',addedColor:'#1E70B5',votes:0,cover:'🎵',duration:'3:20'},
  {id:2,title:'As It Was',artist:'Harry Styles',addedBy:'Victor',addedColor:'#9B59B6',votes:1,cover:'🎶',duration:'2:47'},
  {id:3,title:'Flowers',artist:'Miley Cyrus',addedBy:'Maria',addedColor:'#E91E8C',votes:0,cover:'🎵',duration:'3:21'},
  {id:4,title:'Anti-Hero',artist:'Taylor Swift',addedBy:'Fernanda',addedColor:'#E67E22',votes:2,cover:'🎶',duration:'3:20'},
  {id:5,title:'Levitating',artist:'Dua Lipa',addedBy:'João',addedColor:'#1A9C70',votes:0,cover:'🎵',duration:'3:23'},
];
const MOCK_MSGS = [
  {id:1,from:'Mariana Costa',fromColor:'#E91E8C',to:'Você',msg:'Oi! Você viu o e-mail sobre a reunião de amanhã? Confirma presença!',time:'09:32',ouvido:false},
  {id:2,from:'Carlos TI',fromColor:'#1E70B5',to:'Você',msg:'Valeu pela ajuda com o sistema ontem! 👏',time:'08:15',ouvido:true},
  {id:3,from:'Você',fromColor:'#1A9C70',to:'Fernanda',msg:'Bom dia! Os relatórios já estão prontos.',time:'Ontem',ouvido:true},
];
const MOCK_BDAYS = [
  {name:'Carlos Mendes',dept:'TI',date:'Hoje',emoji:'🎂'},
  {name:'Ana Souza',dept:'Comercial',date:'Amanhã',emoji:'🎁'},
  {name:'Rafael Lima',dept:'Operações',date:'28/05',emoji:'🎉'},
];


const DOKO_WAVE_IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAQABAADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/AMcCigUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUd6KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooo/GgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAo70UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAkHfNFFFAwoxiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigANGaKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoxRRQACiiigAooooAKKKKACiiigAooxRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFJ3paTHNAC0UUUAFFFFABRRRQAUUUUAFFFFABwO1FFFABRRRQAUfSiigAooooAKKMCigAooooAKKKKACiiigAooooAKOfWiigTCiiigYUUUd6ACiiigAooooAKKKKACiiigAooooAKKKKACkBNLRigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooNIKAFooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACigZooAKKKKACiiigAo70fjSd+tAhaKKKACij2oJxQMKKQMG6GloAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKBxRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRR+FABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUDPeigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACkFLRjnNABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABijFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUmKWjFAB0ooooAKKKKACiikLUAIWOcA9O9IWK9+/pTWbAwOtNLE9TQA4yYPWk8w+pptFADvNb1/SgSsO9NooAkVjjjFPDZFQhiOhNG5v7xoAnyPWioQ5HQml8xh3/SgCXNAqISt6ClE3tQBJRTFlBOKcHU/xCgQtFFFABRRRQMKKKKBBRRRQCCiiigYUc0UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAB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b3mVn/8AQjXd0VDrVpbyf3sOWPY57T/hR8NNKAGn+AtHhx0KadHn9RWva6Ppljn7Fp1vDntFCq4/IVaoqG5PdjskIF4xmjbj7vFLRSGIFAOaAAKWigAooooAKKKKACiiigAooooAKKKKACjHpRRQAUmMjmlooEJjHTik2nsfwxTvrRigY3bg8E0mwjv+dPxjpRigCPYeu6jaeDnpT8UAUANCnP8AKlCEHNLigDtQAgQDoD+dAjAAFO6dKMelACUtFFAgo/GiigYUUUUAFFFFABRRRQAUUUUAFFH1ooAKKKKACiiigAo70YoxQIKKKKBhRRRQAUUUUAFFFFAkFFFFAwooooAKKKKACiiigAooooAKKKO9ACCloooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKO9FABRRRQAUUUUAFFAooAKKKKACiiigAoooAxQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFHNFFABRRRQAUUUUAFFFFABRRRQAY5zRRRQAUUUUAFFFFABRiiigA5ooooAKKKKACiiigAooooAKKKKAYUUUUAFFFFAgooooGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAJ15NLmjrRigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACijNAzQAUZopMUALRQBiigAoooxQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQDCiiigAooooAKMc0UUAA4ooooAKKKKACiiigAooooAKKKKACiiigAoFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAH4UCiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooxRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAYxRRR3oEFFFFAwooooAKKKKACg0UUAFHeiigAooooAKKKKACiiigAooooAKKKKACiig0AFFFHSgBOlKKTmlxjpQAUUUUAFFFFABRRRQAUUUUAFFFFAAc0fjRSZoAWiiigAooBo70AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUgCiiimAUUUUAFFFGPagAooooABxRRRQAUUUUAFFFFABRmijHNACDNLSAUuKACiiigAooooAKKKKACiiigAooxRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRjFFFABRRRQAUUUUAFFFFAB9aTrS0YoAKB0oooAKKKKACiiigAooooAKKKKACiiigAooooAKM0UYoADRRRQAdOlFA6UfjQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAB9KAOKKKACiiigAooowKACiiigAooooAKKKDQAUUUUAFIetLRQAUUUUAGKKKKBBRRRQMKKKKACiiigAooooAKM80UYoAQigUtGKACiiigAooooAKKKKACiiigAooooAKKKBQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABQKKKACiiigAooooAKKBRQAUUUUAFFFFABRRRQAUUUUAFFFFAB3ooFFAgooooGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABjFFBpMUALRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFHaigAooooAKKKKACiiigAooooAKKKKADvRSL0paAD6UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUZoAKKQHtS0AFFFFABgelAGKKKACiiigAooo70AFFHeigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACijmigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAMUUUUCCiiigYUUUUAFFFFABRRRQAUUUUAFFFFABRR3ooAKKKKACiiigAooooAKKKKACijmigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z";

const DOKO_MSGS_IDLE = [
  "Bora colocar aquela música massa! 🎵",
  "Fila tá quente hoje! 🔥",
  "Qual vai ser a próxima? 👀",
  "A vibe tá boa! Continua assim 🎶",
  "Que tal um bossanova? 😎",
];
const DOKO_MSGS_ADD = (name, song) => [
  `${name} adicionou "${song}" na fila! 🎵`,
  `Boa escolha, ${name}! "${song}" chegando! 🔥`,
  `Preparem os ouvidos: "${song}" em breve! 🎧`,
];
const DOKO_MSGS_SKIP = (name) => [
  `${name} pulou a música! Coragem! ⏭`,
  `Skip! ${name} não tava curtindo 😅`,
  `${name}: "Próxima!" ⏭🎵`,
];
const DOKO_MSGS_VETO = (song, v, lim) => v >= lim
  ? [`Fora! "${song}" foi vetada democraticamente! 🗳️`]
  : [`${v} voto(s) contra "${song}". Mais ${lim - v} e ela sai! 🗳️`];

const ALEXA_RESPONSES = [
  { pat: /(tempo|previsão|clima|chuva|sol)/i, resp: "🌤 Em Fortaleza agora são 29°C com céu parcialmente nublado. Máxima de 32°C e mínima de 26°C hoje. Não precisa de guarda-chuva!" },
  { pat: /(hora|horas|que horas)/i, resp: () => `🕐 São ${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} agora.` },
  { pat: /(ponto|bater ponto|marcar ponto)/i, resp: "📍 Lembrete de ponto enviado para todos os colaboradores! Eles vão receber uma notificação." },
  { pat: /(aniversário|aniversariante)/i, resp: "🎂 Hoje Carlos Mendes do TI faz aniversário! Já anunciei para toda a equipe de manhã." },
  { pat: /(música|tocando|fila|festival)/i, resp: "🎵 Estou com Festival mode ligado! A fila tem várias músicas incríveis esperando. Vai rolar muito bom!" },
  { pat: /(reunião|meeting|agenda)/i, resp: "📅 Você tem reunião de planejamento hoje às 14h. Vou lembrar você 15 minutos antes!" },
  { pat: /(piada|conta uma|engraçado)/i, resp: "😄 Por que o programador saiu do bar? Porque ele não encontrou nenhum bug na cerveja!" },
  { pat: /(oi|olá|hello|ei alexa)/i, resp: "👋 Olá! Estou aqui e pronta pra ajudar. O que você precisa?" },
  { pat: /(obrigad)/i, resp: "😊 Por nada! Sempre aqui pra ajudar a equipe da 7SERV!" },
];

const CentralAlexa = ({onBack, userPhoto}) => {
  const isMobile = useIsMobile();
  const isDark   = !!T.page;
  const cardBg   = isDark ? T.surface : (T.surfaceW||"rgba(255,255,255,0.78)");
  const headerBg = isDark ? `${T.surface}ee` : (T.surfaceW||"rgba(255,255,255,0.82)");

  // ── UI state ─────────────────────────────────────────────
  const [tab, setTab]             = useState("festival");
  // As sub-abas (Festival/Máquina/Alexa) NÃO viram link próprio na URL — a
  // Central Alexa inteira é uma tela só (`#alexa`). Trocar de aba só muda o
  // estado local; a URL fica sempre `#alexa` e o "voltar" sai direto pra tela
  // anterior (módulos), em vez de percorrer as sub-abas.
  const changeTab = (id) => setTab(id);
  // Normaliza a URL pra `#alexa` (navPush já criou esse entry; aqui só garante
  // que nenhum `#alexa/xxx` antigo sobre no histórico ao entrar).
  useEffect(() => {
    window.history.replaceState({ screen: 'alexa' }, '', '#alexa');
  }, []);
  const [dokoMsg, setDokoMsg]     = useState(DOKO_MSGS_IDLE[0]);
  const [voiceVal, setVoiceVal]   = useState("");
  const [voiceFocus, setVoiceFocus] = useState(false);
  const [alexaConvo, setAlexaConvo] = useState([]);
  const [alexaInput, setAlexaInput]   = useState("");
  const [alexaTyping, setAlexaTyping] = useState(false);
  const [typedChars, setTypedChars]   = useState({}); // {msgId: charCount} para animação de digitação
  const [myName, setMyName] = useState(() => {
    const auth = getAuthUser();
    return auth?.name || USER.name || 'Colaborador';
  });
  const [mascotSkinId, setMascotSkinId] = useState(() => getActiveAssistantSkinId());
  useEffect(() => onAssistantSkinChange(id => setMascotSkinId(id)), []);
  // songSkin = skin do DJ da música atual; salva/lê do Supabase para TODOS verem igual
  const [songSkin, setSongSkin] = useState('default');
  // BUG (corrigido ago/2026): `getUniko(id)` cai pro vampire-robot quando `id` não é uma
  // chave conhecida (fallback pensado pra Uniko capturado desconhecido/ainda não
  // carregado) — mas 'default' (o UNIKO padrão, sem nenhuma skin especial) TAMBÉM cai
  // nesse fallback, porque não é uma entrada de CAPTURE_UNIKOS. Resultado: quem usa o
  // UNIKO padrão via `songSkin` (DJ sem skin nenhuma) via o vídeo/cenário do
  // vampire-robot na Central Alexa. Esta função devolve null pra 'default' ANTES de
  // chamar getUniko, cortando o fallback errado — use no lugar de getUniko(songSkin).
  const unikoDaSkin = (id) => (!id || id === 'default') ? null : getUniko(id);

  // Sincroniza a skin do usuário atual para o Supabase (fire-and-forget)
  useEffect(() => {
    if (!myName || myName === 'Colaborador') return;
    _supabase.from('settings')
      .upsert({ key: skinRemoteKey(myName), value: mascotSkinId }, { onConflict: 'key' })
      .then(() => {}).catch(() => {});
  }, [mascotSkinId, myName]); // eslint-disable-line
  const [photoCache, setPhotoCache] = useState({});
  const [expandedPhoto, setExpandedPhoto] = useState(null); // {photo, name} ao clicar numa foto da fila
  // Foto do próprio usuário — usa a prop quando disponível, senão busca diretamente
  const [myPhoto, setMyPhoto] = useState(userPhoto);
  useEffect(() => { if (userPhoto) setMyPhoto(userPhoto); }, [userPhoto]);
  useEffect(() => {
    if (!myPhoto && myName && myName !== 'Colaborador') {
      fetchPhotoByName(myName).then(p => { if (p) setMyPhoto(p); });
    }
  }, [myName]); // eslint-disable-line

  // ── Festival: estado real (Spotify + Supabase) ───────────
  const [queue, setQueue]               = useState([]);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [movingId, setMovingId]         = useState(null);

  // Carrega fotos de outros usuários que aparecem na fila e no chat
  useEffect(() => {
    const names = [...new Set([
      ...queue.map(s => s.requested_by),
      ...alexaConvo.filter(m => m.role === 'user' && m.name).map(m => m.name),
    ])].filter(n => n && n !== myName && !photoCache[n]);
    names.forEach(async name => {
      const photo = await fetchPhotoByName(name);
      if (photo) setPhotoCache(p => ({ ...p, [name]: photo }));
    });
  }, [queue, alexaConvo]); // eslint-disable-line
  const [currentSong, setCurrentSong]   = useState(null);
  // Mini-player fixo (estilo Spotify) — só no celular, some/aparece sozinho
  // conforme tem música tocando; toque nele abre a tela cheia "Tocando Agora".
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);

  // Lê a skin do DJ da música atual do Supabase para todos os clientes
  useEffect(() => {
    if (!currentSong?.requested_by) { setSongSkin('default'); return; }
    if (currentSong.requested_by === myName) { setSongSkin(mascotSkinId); return; }
    _supabase.from('settings')
      .select('value').eq('key', skinRemoteKey(currentSong.requested_by)).maybeSingle()
      .then(({ data }) => setSongSkin(data?.value || 'default'))
      .catch(() => setSongSkin('default'));
  }, [currentSong?.requested_by, myName, mascotSkinId]); // eslint-disable-line

  // Burst em tela cheia ao trocar de skin especial: morcegos pro Vampire-Robot (assustador),
  // explosão de bolhas turquesa pra Uniko Sereia (calma) e explosão de estrelas/meteoros
  // roxos+brancos pra Destruidora de Mundos — mesmo gatilho (troca de songSkin), cada um
  // com seu overlay. Dispara tanto quando a música da pessoa toca quanto ao entrar na
  // Central Alexa já com a skin dela ativa (songSkin sai de 'default' pra ela).
  const [batBurst, setBatBurst] = useState(false);
  const [bubbleBurst, setBubbleBurst] = useState(false);
  const [meteorBurst, setMeteorBurst] = useState(false);
  const prevSongSkin = useRef(songSkin);
  useEffect(() => {
    const prev = prevSongSkin.current;
    prevSongSkin.current = songSkin;
    if (songSkin === prev) return;
    if (songSkin === 'vampire-robot') {
      setBatBurst(true);
      const t = setTimeout(() => setBatBurst(false), 5250);
      return () => clearTimeout(t);
    }
    if (songSkin === 'uniko-sereia') {
      setBubbleBurst(true);
      const t = setTimeout(() => setBubbleBurst(false), 5250);
      return () => clearTimeout(t);
    }
    if (songSkin === 'destruidora-de-mundos-dh0x') {
      setMeteorBurst(true);
      const t = setTimeout(() => setMeteorBurst(false), 5250);
      return () => clearTimeout(t);
    }
  }, [songSkin]);

  // ── Letra sincronizada (LRCLIB) ──────────────────────────
  const [showLyrics, setShowLyrics]     = useState(false);
  const [lyrics, setLyrics]             = useState([]);       // [{time, text}]
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError]   = useState(false);
  const [activeLine, setActiveLine]     = useState(0);
  const [progressMs, setProgressMs]     = useState(0);
  const lyricsRef = useRef(null);
  const lyricsPreviewRef = useRef(null);
  const progressTimer = useRef(null);
  const lastSongId  = useRef(null);
  const genreCache  = useRef({});  // mantido por compatibilidade, não mais utilizado
  // ── Mini janela de videoclipe (visual; áudio segue no Spotify/Echo) ──
  const [videoEnabled, setVideoEnabled] = useState(() => {
    try { return localStorage.getItem('ch_fest_video') === '1'; } catch { return false; }
  });
  const [clipVideoId, setClipVideoId]   = useState(null);  // videoId do clipe da música atual
  const clipCache   = useRef({});  // spotify_id → videoId | '' (''=sem clipe)
  const toggleVideo = () => setVideoEnabled(v => {
    const next = !v;
    try { localStorage.setItem('ch_fest_video', next ? '1' : '0'); } catch {}
    return next;
  });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching]   = useState(false);
  const [isAdding, setIsAdding]         = useState(null); // track.id sendo adicionado
  // ── Aba Playlist: biblioteca compartilhada (todo mundo vê tudo que foi
  // adicionado), com busca. Abrir um card carrega as faixas sob demanda. ──
  const [plLibrary, setPlLibrary]       = useState([]);
  const [plLibLoading, setPlLibLoading] = useState(false);
  const [plSearch, setPlSearch]         = useState("");
  const [plLinkVal, setPlLinkVal]       = useState("");
  const [plAdding, setPlAdding]         = useState(false);
  const [plError, setPlError]           = useState("");
  const [plOpenId, setPlOpenId]         = useState(null);   // spotify_id aberto no momento
  const [plLoading, setPlLoading]       = useState(false);  // carregando faixas do aberto
  const [plData, setPlData]             = useState(null);   // { name, image, owner, tracks } do aberto

  const loadPlaylistLibrary = async () => {
    setPlLibLoading(true);
    const r = await api('get', '/api/playlist/library');
    setPlLibrary(r.playlists || []);
    setPlLibLoading(false);
  };
  useEffect(()=>{ if(tab==='playlist') loadPlaylistLibrary(); }, [tab]);

  // Busca a foto de quem adicionou cada playlist da biblioteca (mesmo cache
  // usado na fila/chat — evita rebuscar quem já apareceu antes).
  useEffect(() => {
    const names = [...new Set(plLibrary.map(p => p.added_by))]
      .filter(n => n && n !== myName && !photoCache[n]);
    names.forEach(async name => {
      const photo = await fetchPhotoByName(name);
      if (photo) setPhotoCache(p => ({ ...p, [name]: photo }));
    });
  }, [plLibrary]); // eslint-disable-line

  const addPlaylistToLibrary = async () => {
    if (!plLinkVal.trim() || plAdding) return;
    setPlAdding(true); setPlError("");
    const r = await api('post', '/api/playlist/library', { url: plLinkVal.trim() });
    if (r.error) setPlError(r.error);
    else { setPlLinkVal(""); await loadPlaylistLibrary(); }
    setPlAdding(false);
  };

  const openLibraryPlaylist = async (spotifyId) => {
    setPlOpenId(spotifyId); setPlLoading(true); setPlError(""); setPlData(null);
    const r = await api('get', `/api/playlist/link?url=spotify:playlist:${spotifyId}`);
    if (r.error) setPlError(r.error);
    else setPlData(r);
    setPlLoading(false);
  };

  const removeFromLibrary = async (spotifyId) => {
    if (!window.confirm('Remover essa playlist da biblioteca?')) return;
    await api('delete', `/api/playlist/library/${spotifyId}`);
    await loadPlaylistLibrary();
  };

  const filteredLibrary = plLibrary.filter(p =>
    !plSearch.trim() || p.name?.toLowerCase().includes(plSearch.trim().toLowerCase())
  );
  const [confirmTrack, setConfirmTrack] = useState(null); // track aguardando confirmação de longa duração
  const [replaceTarget, setReplaceTarget]     = useState(null); // música da fila sendo substituída
  const [replaceVal, setReplaceVal]           = useState("");
  const [replaceResults, setReplaceResults]   = useState([]);
  const [replaceSearching, setReplaceSearching] = useState(false);
  const [isReplacing, setIsReplacing]         = useState(null); // track.id sendo aplicado
  const replaceTimer  = useRef(null);
  const [skipVotes, setSkipVotes]       = useState({});   // song_id → contagem
  const [myVotedSongs, setMyVotedSongs] = useState(new Set());
  const [spotifyOk, setSpotifyOk]       = useState(false);
  const [spotifyChecked, setSpotifyChecked] = useState(false);
  const [devices, setDevices]           = useState([]);
  const [showDevices, setShowDevices]   = useState(false);
  const [volume, setVolume]             = useState(50);   // 0-100
  const [volumeSaving, setVolumeSaving] = useState(false);
  const [festLoading, setFestLoading]   = useState(true);
  const [serverMsg, setServerMsg]       = useState("");
  const searchTimer   = useRef(null);
  const chatScrollRef = useRef(null);

  // ID único por sessão (para sistema de votos)
  const [userId] = useState(() => {
    let id = sessionStorage.getItem('ch_festival_uid');
    if (!id) {
      const auth = getAuthUser();
      const base = (auth?.name || USER.name || 'user').replace(/\s+/g,'_');
      id = `${base}_${Math.random().toString(36).substr(2,6)}`;
      sessionStorage.setItem('ch_festival_uid', id);
    }
    return id;
  });

  // ── Helpers de API ───────────────────────────────────────
  const api = async (method, path, body) => {
    try {
      const token = localStorage.getItem('ch_token');
      const opts = { method, headers: {'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})} };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(`${SERVER_URL}${path}`, opts);
      return r.json();
    } catch (e) {
      return { error: 'Servidor offline. Inicie o servidor Node.' };
    }
  };

  // ── Carrega dados do Supabase ────────────────────────────
  const loadQueue = async () => {
    const { data } = await _supabase
      .from('queue').select('*')
      .in('status', ['pending','playing'])
      .order('position', { ascending: true });
    setQueue(data || []);
    setFestLoading(false);
  };

  const loadAutoplayState = async () => {
    const r = await api('get', '/api/player/autoplay').catch(() => null);
    if (r?.enabled !== undefined) setAutoplayEnabled(r.enabled);
  };

  const handleToggleAutoplay = async () => {
    const next = !autoplayEnabled;
    setAutoplayEnabled(next);
    const r = await api('post', '/api/player/autoplay', { enabled: next });
    if (r?.enabled !== undefined) setAutoplayEnabled(r.enabled);
  };

  const loadPlayerState = async () => {
    const { data } = await _supabase
      .from('player_state').select('*')
      .eq('id', 1).single();
    if (!data) return;
    setIsPlaying(!!data.is_playing);
    if (data.current_song_id) {
      const { data: song } = await _supabase
        .from('queue').select('*').eq('id', data.current_song_id).single();
      setCurrentSong(song || null);
    } else {
      setCurrentSong(null);
    }
  };

  // Volume atual (persistido em settings.alexa_volume) — sem isso a UI voltava
  // sempre pro default 50% ao trocar de aba/atualizar, mesmo com a Alexa em 34%.
  const loadVolume = async () => {
    const { data } = await _supabase.from('settings').select('value').eq('key', 'alexa_volume').maybeSingle();
    const v = parseInt(data?.value, 10);
    if (Number.isFinite(v)) setVolume(Math.max(0, Math.min(100, v)));
  };

  const loadSkipVotes = async () => {
    // Busca todos os votos de skip ativos — sem depender do estado `queue`
    // para evitar closure stale no listener de realtime
    const { data } = await _supabase.from('skip_votes').select('song_id');
    const counts = {};
    (data||[]).forEach(v => { counts[v.song_id] = (counts[v.song_id]||0) + 1; });
    setSkipVotes(counts);
  };

  const checkSpotify = async () => {
    const r = await api('get', '/api/status').catch(()=>({ok:false}));
    setSpotifyOk(!!r?.ok);
    setSpotifyChecked(true);
  };

  // ── LRCLIB: busca letra sincronizada ─────────────────────
  const parseLRC = (syncedLyrics) => {
    if (!syncedLyrics) return [];
    return syncedLyrics
      .split('\n')
      .map(line => {
        const m = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (!m) return null;
        const time = parseInt(m[1])*60000 + parseFloat(`${m[2]}.${m[3]}`)*1000;
        return { time: Math.round(time), text: m[4].trim() };
      })
      .filter(l => l && l.text);
  };

  const fetchLyrics = async (song) => {
    if (!song) { setLyrics([]); return; }
    setLyricsLoading(true);
    setLyricsError(false);
    setActiveLine(0);
    try {
      const artist = encodeURIComponent(song.artist||'');
      const title  = encodeURIComponent(song.title||'');
      const dur    = song.duration_ms ? Math.round(song.duration_ms/1000) : '';
      const url    = `https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}${dur?`&duration=${dur}`:''}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('not found');
      const d = await r.json();
      if (d.syncedLyrics) {
        setLyrics(parseLRC(d.syncedLyrics));
      } else if (d.plainLyrics) {
        // Sem sync — mostra letra simples sem timestamps
        setLyrics(d.plainLyrics.split('\n').map((text,i)=>({time:i*3000,text})).filter(l=>l.text));
      } else {
        setLyrics([]);
        setLyricsError(true);
      }
    } catch {
      setLyrics([]);
      setLyricsError(true);
    }
    setLyricsLoading(false);
  };

  // ── Polling de progresso para sync da letra ───────────────
  // A base do relógio local (progresso conhecido + instante em que ele valia)
  // mora num REF, não numa variável de closure: assim o seek do admin (ver
  // seekTo) consegue reposicionar a barra na hora, sem esperar o próximo
  // sync com o servidor — senão a barra voltava pro ponto antigo por até 8s.
  const progressBase = useRef({ ms: 0, at: Date.now() });
  const startProgressPolling = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);

    let syncing = false;

    const syncWithServer = async () => {
      if (syncing) return;
      syncing = true;
      const tSent = Date.now();
      const r = await api('get', '/api/progress').catch(() => null);
      if (r?.progress_ms !== undefined) {
        const tReceived = Date.now();
        // Estima que o progresso retornado era válido no meio do RTT
        const halfRtt = (tReceived - tSent) / 2;
        progressBase.current = { ms: r.progress_ms + halfRtt, at: tReceived }; // compensa latência
      }
      syncing = false;
    };

    // Primeira sync imediata
    syncWithServer();

    // Tick a cada 200ms — clock local preciso entre syncs
    progressTimer.current = setInterval(() => {
      const now = Date.now();
      const { ms, at } = progressBase.current;
      setProgressMs(ms + (now - at));
      // Re-sync com servidor a cada 8s para corrigir desvio
      if (now - at > 8000) syncWithServer();
    }, 200);
  };

  const stopProgressPolling = () => {
    if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
  };

  const [festColors, setFestColors]     = useState(null);
  const [blobsVisible, setBlobsVisible] = useState(true);

  // ── Máquina do Tempo ─────────────────────────────────────
  const [maquinaData, setMaquinaData]   = useState(null);
  const [artistPhotos, setArtistPhotos] = useState({}); // {nomeArtista: urlFoto} via Deezer
  const [maquinaLoading, setMaquinaLoading] = useState(false);
  const [maquinaView, setMaquinaView]   = useState('geral'); // geral | mensal | djs | semaninha
  const [zoomArtist, setZoomArtist]     = useState(null); // {name, img} — foto do artista ampliada (lightbox)
  const [msgVideoOpen, setMsgVideoOpen] = useState(false); // modal do video "Mensagem Especial"
  // Capa + vídeo da Mensagem Especial vêm da config do RH (Dashboard → Máquina do
  // Tempo); enquanto não carrega, usa o fallback fixo.
  const [msgEspecial, setMsgEspecial] = useState(MSG_ESPECIAL_FALLBACK);
  useEffect(() => { loadMensagemEspecial().then(setMsgEspecial); }, []);
  // Vídeos de fundo por Uniko: mutam os objetos do roster em memória (getUniko),
  // então força um re-render quando terminam de carregar pra a cena aparecer.
  // Recarrega em REALTIME (+ poll de segurança) — sem isso, um cliente que já
  // estava com a Central Alexa aberta quando o admin configura/troca o vídeo
  // NÃO enxerga a mudança (o vídeo só aparecia pra quem carregou a página
  // DEPOIS de configurado). O `songSkin` já é sincronizado pra todos; o que
  // faltava era todo mundo ter o `bgVideoUrl` em memória atualizado.
  const [, setBgVideoTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => loadUnikoBgVideos().then(() => { if (alive) setBgVideoTick(t => t + 1); });
    refresh();
    const ch = _supabase.channel('uniko-bg-videos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_bg_videos' }, refresh)
      .subscribe();
    const poll = setInterval(refresh, 30000); // rede de segurança caso o realtime não esteja habilitado
    return () => { alive = false; clearInterval(poll); try { _supabase.removeChannel(ch); } catch {} };
  }, []);
  const closeMsgVideo = useCallback(() => setMsgVideoOpen(false), []); // estável p/ o memo do modal
  const [selMonthIdx, setSelMonthIdx]   = useState(0);
  const [collageSize, setCollageSize]   = useState(5);
  const [collageBusy, setCollageBusy]   = useState(false);
  const [collagePeriod, setCollagePeriod] = useState('semana'); // semana | mes | ano | tudo
  const [collageData, setCollageData]   = useState(null); // {covers, total, period}
  const [collageLoading, setCollageLoading] = useState(false);
  const [collageExpanded, setCollageExpanded] = useState(false);

  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  // ── Alexa rate limit ─────────────────────────────────────
  const auth = getAuthUser();
  const isAdmin = auth?.role === 'admin';
  // Moderador também controla o player (volume + pular) — mas não o resto (autoplay,
  // dispositivo, reordenar/excluir fila, zerar contador etc., que seguem só admin).
  const canControl = isAdmin || auth?.role === 'moderador';
  const ALEXA_LIMIT  = 2;
  const ALEXA_WINDOW = 60 * 60 * 1000; // 1 hora
  const getAlexaRequests = () => {
    try {
      const d = JSON.parse(localStorage.getItem('alexa_reqs')||'[]');
      const now = Date.now();
      return d.filter(t => now - t < ALEXA_WINDOW);
    } catch { return []; }
  };
  const getCooldown = () => {
    const reqs = getAlexaRequests();
    if (reqs.length < ALEXA_LIMIT) return null;
    const oldest = Math.min(...reqs);
    const remaining = (oldest + ALEXA_WINDOW) - Date.now();
    if (remaining <= 0) return null;
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  const [alexaReqCount, setAlexaReqCount] = useState(() => getAlexaRequests().length);
  const [alexaCooldown, setAlexaCooldown] = useState(() => getCooldown());
  const canAskAlexa = isAdmin || alexaReqCount < ALEXA_LIMIT;

  const consumeAlexaRequest = () => {
    if (isAdmin) return;
    const reqs = getAlexaRequests();
    reqs.push(Date.now());
    localStorage.setItem('alexa_reqs', JSON.stringify(reqs));
    setAlexaReqCount(reqs.length);
    setAlexaCooldown(getCooldown());
  };

  useEffect(() => {
    if (isAdmin) return;
    const id = setInterval(() => {
      const fresh = getAlexaRequests();
      setAlexaReqCount(fresh.length);
      setAlexaCooldown(fresh.length >= ALEXA_LIMIT ? getCooldown() : null);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const isSystemDj = (n) => {
    const rb = (n||'').trim().toLowerCase();
    return !rb || rb.includes('autoplay') || rb.includes('sistema') || rb.includes('uniko') || rb.includes('alexa');
  };

  // Visão Geral só mostra ranking depois de N dias acumulando plays no período atual
  const MAQUINA_MIN_DAYS = 2;

  // Períodos do collage da Semaninha
  const COLLAGE_PERIODS = [
    { id:'semana', label:'7 dias',  days:7,   sub:'últimos 7 dias' },
    { id:'mes',    label:'30 dias', days:30,  sub:'últimos 30 dias' },
    { id:'ano',    label:'1 ano',   days:365, sub:'último ano' },
    { id:'tudo',   label:'Tudo',    days:null, sub:'desde sempre' },
  ];

  // Apaga de verdade o histórico de UM mês (ou de tudo) — diferente de "Zerar contador",
  // que só move o marco d'água da Visão Geral sem tocar nas linhas da fila. Isso faz um
  // DELETE permanente em `queue` (só status played/skipped — nunca mexe na fila ativa).
  // Admin-only (checado no botão, ver JSX).
  const deleteMaquinaMonth = async (key, label) => {
    if (!window.confirm(`Excluir PERMANENTEMENTE o histórico de "${label}" da Máquina do Tempo?\n\nIsso apaga as músicas tocadas/puladas registradas nesse mês (não mexe na fila atual). Não tem como desfazer.`)) return;
    const [y, m] = key.split('-').map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end   = new Date(y, m, 1).toISOString();
    const { error } = await _supabase.from('queue').delete()
      .in('status', ['played', 'skipped']).gte('created_at', start).lt('created_at', end);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    await loadMaquinaData();
  };
  const deleteMaquinaAll = async () => {
    if (!window.confirm('Excluir PERMANENTEMENTE TODO o histórico da Máquina do Tempo (todos os meses)?\n\nIsso apaga todas as músicas tocadas/puladas registradas até agora (não mexe na fila atual). Não tem como desfazer.')) return;
    if (!window.confirm('Confirma de novo — isso não pode ser desfeito. Excluir tudo mesmo?')) return;
    const { error } = await _supabase.from('queue').delete().in('status', ['played', 'skipped']);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    await loadMaquinaData();
  };

  const loadMaquinaData = async () => {
    setMaquinaLoading(true);

    // Data de reset (se existir) — define o "período atual" da Visão Geral / DJs
    const { data: resetSetting } = await _supabase
      .from('settings').select('value').eq('key','maquina_reset_at').maybeSingle();
    const resetAt = resetSetting?.value || null;

    // Início do mês corrente (pra saber se o mês "ATUAL" da aba Por Mês já tem
    // MAQUINA_MIN_DAYS de dados — sem isso dava pra ver o ranking do mês na hora,
    // sem esperar, mesmo com a Visão Geral segurando o resultado).
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Busca TODAS as linhas de uma view (o Supabase corta em 1000 por request).
    // Sem isso, a view mensal (2000+ linhas) devolvia só as ~1000 primeiras — que,
    // sem ordenação, eram todas do mês mais cheio (julho), e o mês ATUAL (agosto)
    // ficava de fora do "Por Mês". Pagina de 1000 em 1000 até acabar.
    const fetchAllRows = async (table, cols) => {
      const PAGE = 1000; let from = 0; const out = [];
      for (;;) {
        const { data, error } = await _supabase.from(table).select(cols).range(from, from + PAGE - 1);
        if (error) return { data: out, error };
        if (!data?.length) break;
        out.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return { data: out, error: null };
    };

    // A VISÃO GERAL é GERAL (todos os meses) — p_since null. O mês atual e os
    // passados ficam por conta da aba "Por Mês". (Antes usava resetAt e por isso
    // a Visão Geral ficava presa ao "período atual" = só o mês corrente.)
    const [songsRes, artistsRes, djRes, monthlyRes, monthlyDjRes, countRes, monthPeriodStartRes] = await Promise.all([
      _supabase.rpc('maquina_song_stats',   { p_since: null, p_limit: 10 }),
      _supabase.rpc('maquina_artist_stats', { p_since: null, p_limit: 10 }),
      _supabase.rpc('maquina_dj_stats',     { p_since: null }),
      fetchAllRows('maquina_monthly_songs', 'month,spotify_id,title,artist,album_art,plays'),
      fetchAllRows('maquina_monthly_djs', 'month,requested_by,plays'),
      _supabase.rpc('maquina_play_count',   { p_since: null }),
      _supabase.rpc('maquina_period_start', { p_since: monthStartIso }),
    ]);

    if (songsRes.error) {
      console.error('Máquina do Tempo: rode supabase_central_alexa_maquina.sql no Supabase.', songsRes.error);
      setMaquinaData({ topSongs:[], topArtists:[], total:0, resetAt, djs:[], djTotal:0, months:[], sqlMissing:true });
      setMaquinaLoading(false);
      return;
    }

    // Visão Geral agora é all-time (sempre tem dados de sobra) → sem a trava dos
    // MAQUINA_MIN_DAYS. A checagem de acumulação segue valendo só pro MÊS ATUAL
    // da aba "Por Mês" (via monthPeriodStart, mais abaixo).
    const periodStart = null;

    // Visão Geral (período atual)
    const topSongs = (songsRes.data||[]).map(s => ({
      spotify_id:s.spotify_id, title:s.title, artist:s.artist, album_art:s.album_art, count:s.plays,
    }));
    const topArtists = (artistsRes.data||[]).map(a => [a.artist, a.plays]);
    const total = countRes.data || 0;

    // Ranking de DJs (filtra nomes do sistema no cliente)
    const djRows = (djRes.data||[]).filter(d => !isSystemDj(d.requested_by));
    const djs = djRows.slice(0,10).map(d => ({ name:d.requested_by.trim(), count:d.plays }));
    const djTotal = djRows.reduce((a,d)=>a+d.plays,0);

    // DJs por mês (filtra nomes do sistema no cliente)
    const monthDjMap = {};
    (monthlyDjRes.data||[]).forEach(r => {
      if (isSystemDj(r.requested_by)) return;
      (monthDjMap[r.month] = monthDjMap[r.month] || []).push({ name:r.requested_by.trim(), count:r.plays });
    });

    // Por mês / retrospectiva (a partir das views agregadas)
    const monthMap = {};
    (monthlyRes.data||[]).forEach(r => { (monthMap[r.month] = monthMap[r.month] || []).push(r); });
    const months = Object.keys(monthMap).sort().reverse().map(key => {
      const rows = monthMap[key];
      const [y,m] = key.split('-').map(Number);
      const label = new Date(y, m-1, 1).toLocaleDateString('pt-BR',{ month:'long', year:'numeric' });
      const artists = {};
      rows.forEach(r => (r.artist||'').split(', ').forEach(a => { if (a) artists[a] = (artists[a]||0) + r.plays; }));
      const mDjs = (monthDjMap[key]||[]).sort((a,b)=>b.count-a.count);
      return {
        key,
        label: label.charAt(0).toUpperCase()+label.slice(1),
        topSongs: rows.slice().sort((a,b)=>b.plays-a.plays).slice(0,10)
          .map(r => ({ spotify_id:r.spotify_id, title:r.title, artist:r.artist, album_art:r.album_art, count:r.plays })),
        topArtists: Object.entries(artists).sort((a,b)=>b[1]-a[1]).slice(0,10),
        djs: mDjs.slice(0,10),
        djTotal: mDjs.reduce((a,d)=>a+d.count,0),
        total: rows.reduce((a,r)=>a+r.plays,0),
        // Só o mês CORRENTE (em andamento) precisa da checagem dos 3 dias — meses
        // passados já estão fechados, sempre têm dado de sobra.
        periodStart: key === curMonthKey ? (monthPeriodStartRes.data || null) : null,
      };
    });

    setSelMonthIdx(0);
    setMaquinaData({ topSongs, topArtists, total, resetAt, periodStart, djs, djTotal, months });
    setMaquinaLoading(false);

    // Carrega fotos dos DJs (ranking geral + de todos os meses)
    const allDjNames = new Set([ ...djs.map(d=>d.name), ...Object.values(monthDjMap).flat().map(d=>d.name) ]);
    allDjNames.forEach(async (name) => {
      if (name === myName || photoCache[name]) return;
      const photo = await fetchPhotoByName(name);
      if (photo) setPhotoCache(p => ({ ...p, [name]: photo }));
    });
  };

  // Carrega as capas mais ouvidas do período escolhido (collage da Semaninha)
  const loadCollage = async (period) => {
    setCollageLoading(true);
    const cfg = COLLAGE_PERIODS.find(p => p.id===period) || COLLAGE_PERIODS[0];
    const since = cfg.days ? new Date(Date.now() - cfg.days*86400000).toISOString() : null;
    const [coversRes, countRes] = await Promise.all([
      _supabase.rpc('maquina_song_stats', { p_since: since, p_limit: 120 }),
      _supabase.rpc('maquina_play_count', { p_since: since }),
    ]);
    const covers = (coversRes.data||[]).filter(c => c.album_art).map(c => ({
      spotify_id:c.spotify_id, title:c.title, artist:c.artist, album_art:c.album_art, count:c.plays,
    }));
    setCollageData({ covers, total: countRes.data || 0, period });
    setCollageLoading(false);
  };

  // Gera e baixa o collage da Semaninha (NxN) das capas mais ouvidas
  const downloadCollage = async () => {
    const covers = collageData?.covers || [];
    if (!covers.length || collageBusy) return;
    setCollageBusy(true);
    const n = collageSize, tile = 240;
    const canvas = document.createElement('canvas');
    canvas.width = n*tile; canvas.height = n*tile;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0c0c14'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const load = (src) => new Promise(res => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => res(img); img.onerror = () => res(null); img.src = src;
    });
    for (let i=0; i<n*n; i++) {
      const c = covers[i % covers.length];
      const img = await load(c.album_art);
      const x = (i%n)*tile, y = Math.floor(i/n)*tile;
      if (img) ctx.drawImage(img, x, y, tile, tile);
    }
    try {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `semaninha-${n}x${n}.png`;
      a.click();
    } catch { alert('Não foi possível baixar o collage (imagens externas bloqueadas).'); }
    setCollageBusy(false);
  };

  // Renderiza o mosaico NxN de capas (usado inline e no lightbox)
  const renderCollageGrid = (covers, { maxWidth, onClick } = {}) => (
    <div onClick={onClick}
      style={{maxWidth,margin:"0 auto",borderRadius:14,overflow:"hidden",border:`1px solid ${T.border}`,boxShadow:T.sh,background:'#0c0c14',cursor:onClick?'zoom-in':'default'}}>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${collageSize},1fr)`,gap:0}}>
        {Array.from({length:collageSize*collageSize}).map((_,i)=>{
          const c = covers[i % covers.length];
          return (
            <div key={i} style={{position:"relative",aspectRatio:"1/1",background:T.goldGl}}>
              {c?.album_art && <img src={c.album_art} alt="" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Enquanto o período atual tem menos de MAQUINA_MIN_DAYS de plays, mostra
  // um aviso de "acumulando dados" no lugar do ranking da Visão Geral.
  const renderMaquinaAccumulating = (periodStart) => {
    const elapsedDays = (Date.now() - new Date(periodStart).getTime()) / 86400000;
    const daysLeft = Math.max(1, Math.ceil(MAQUINA_MIN_DAYS - elapsedDays));
    return (
      <div style={{textAlign:"center",padding:60,color:T.textT}}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.2" strokeLinecap="round" style={{margin:"0 auto 12px",display:"block"}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div style={{fontSize:14,color:T.text}}>Acumulando dados pro ranking...</div>
        <div style={{fontSize:12,marginTop:4,opacity:.7}}>
          O ranking aparece depois de {MAQUINA_MIN_DAYS} dias de músicas tocadas
          {daysLeft>0 && ` · falta${daysLeft>1?'m':''} ${daysLeft} dia${daysLeft>1?'s':''}`}
        </div>
      </div>
    );
  };

  // Renderiza os cards (músicas + artistas + DJs) de um conjunto agregado
  // Pódio grande com foto grande dos top 3 artistas (1º no centro/mais alto,
  // 2º à esquerda, 3º à direita) — fica à esquerda dos 3 cards no renderTopCards.
  const renderArtistPodium = (d) => {
    const top3 = (d.topArtists || []).slice(0,3);
    if (!top3.length) return null;
    const places = [
      { i:1, medal:'🥈', ring:'#C9D2DC', pedH:82,  photo:104 }, // 2º à esquerda
      { i:0, medal:'🥇', ring:T.gold,    pedH:118, photo:124 }, // 1º no centro (mais alto)
      { i:2, medal:'🥉', ring:'#CD9B6A', pedH:52,  photo:98 },  // 3º à direita
    ];
    return (
      <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${T.border}`,padding:"20px 18px 22px",boxShadow:T.sh,width:"100%",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>
          <span style={{fontSize:15,fontWeight:700,color:T.text}}>Pódio dos Artistas</span>
        </div>
        <div style={{flex:1,display:"flex",alignItems:"flex-end",justifyContent:"center",gap:isMobile?10:16}}>
          {places.map(p => {
            const entry = top3[p.i];
            if (!entry) return <div key={p.i} style={{flex:1}}/>;
            const [artist,count] = entry;
            const photo = artistPhotos[artist];
            const initials = artist.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
            return (
              <div key={p.i} style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{fontSize:p.i===0?32:24,lineHeight:1,marginBottom:7}}>{p.medal}</div>
                <div onClick={photo?()=>setZoomArtist({name:artist,img:photo}):undefined}
                  title={photo?"Ver foto ampliada":undefined}
                  style={{width:p.photo,height:p.photo,maxWidth:"100%",marginBottom:9,aspectRatio:"1",cursor:photo?"zoom-in":"default"}}>
                  {photo
                    ? <img src={photo} alt={artist} style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover",border:`3px solid ${p.ring}`,boxShadow:`0 5px 22px ${p.ring}66`}}/>
                    : <div style={{width:"100%",height:"100%",borderRadius:"50%",border:`3px solid ${p.ring}`,background:`linear-gradient(135deg,${p.ring}55,${p.ring}22)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(p.photo*0.32),fontWeight:800,color:p.ring}}>{initials}</div>}
                </div>
                <div style={{fontSize:p.i===0?14.5:13,fontWeight:800,color:T.text,textAlign:"center",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{artist}</div>
                <div style={{fontSize:11.5,color:T.gold,fontWeight:700,marginTop:2}}>{count} plays</div>
                <div style={{marginTop:11,width:"100%",height:p.pedH,borderRadius:"9px 9px 0 0",
                  background:`linear-gradient(180deg,${p.ring}dd,${p.ring}44)`,
                  boxShadow:`inset 0 2px 0 ${p.ring}, 0 -3px 14px ${p.ring}44`,
                  display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:8}}>
                  <span style={{fontSize:p.i===0?24:18,fontWeight:900,color:"#fff",textShadow:"0 1px 5px rgba(0,0,0,0.4)"}}>{p.i+1}º</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTopCards = (d, showSpecialMsg) => {
    const podium = renderArtistPodium(d);
    return (
    <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?14:18,alignItems:"flex-start"}}>
      {podium && (
        <div style={{flex:isMobile?"none":"2.7 1 0",minWidth:0,display:"flex",flexDirection:"column",gap:16}}>
          {podium}
          {showSpecialMsg && (
            <div onClick={()=>setMsgVideoOpen(true)} title="Clique para ver a mensagem especial"
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 12px 32px ${T.gold}44`;}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 6px 20px ${T.gold}22`;}}
              style={{borderRadius:16,background:cardBg,border:`1px solid ${T.gold}66`,boxShadow:`0 6px 20px ${T.gold}22`,cursor:"pointer",overflow:"hidden",transition:"transform .18s,box-shadow .18s"}}>
              {/* Capa grande do vídeo */}
              <div style={{position:"relative",width:"100%",height:200}}>
                <img src={MSG_COVER} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 20%",display:"block"}}/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.6),rgba(0,0,0,.05) 55%,rgba(0,0,0,.22))"}}/>
                <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:60,height:60,borderRadius:"50%",background:"rgba(0,0,0,.45)",border:"2px solid rgba(255,255,255,.9)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 18px rgba(0,0,0,.5)"}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="none" style={{marginLeft:3}}><polygon points="6 4 20 12 6 20 6 4"/></svg>
                </div>
                <div style={{position:"absolute",top:10,left:10,padding:"3px 10px",borderRadius:999,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:"#fff",fontSize:10.5,fontWeight:800,letterSpacing:".04em",boxShadow:"0 2px 8px rgba(0,0,0,.35)"}}>✨ NOVO</div>
              </div>
              <div style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:800,color:T.text}}>Mensagem Especial!</div>
                  <div style={{fontSize:11.5,color:T.textT,marginTop:2}}>Clique aqui para ver</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{flex:isMobile?"none":"7 1 0",minWidth:0,display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:isMobile?14:16}}>
      {/* Top Músicas */}
      <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${T.border}`,padding:"20px",boxShadow:T.sh}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          <span style={{fontSize:15,fontWeight:700,color:T.text}}>Músicas Mais Tocadas</span>
          <span style={{fontSize:11,color:T.textT,marginLeft:"auto"}}>{d.total} plays no total</span>
        </div>
        {d.topSongs.length===0
          ? <div style={{fontSize:12,color:T.textT,padding:"8px 0"}}>Sem dados nesse período.</div>
          : d.topSongs.map((s,i)=>(
          <div key={s.spotify_id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
            <div style={{width:22,textAlign:"center",fontSize:12,fontWeight:700,color:i<3?T.gold:T.textD}}>#{i+1}</div>
            {s.album_art
              ? <img src={s.album_art} alt="" style={{width:36,height:36,borderRadius:7,objectFit:"cover",flexShrink:0}}/>
              : <div style={{width:36,height:36,borderRadius:7,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/></svg>
                </div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title?.length>28 ? s.title.slice(0,28)+'…' : s.title}</div>
              <div style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.artist}</div>
            </div>
            <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:6,background:T.goldGl}}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill={T.gold} stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span style={{fontSize:11,fontWeight:700,color:T.gold}}>{s.count} plays</span>
            </div>
          </div>
        ))}
      </div>
      {/* Top Artistas */}
      <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${T.border}`,padding:"20px",boxShadow:T.sh}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          <span style={{fontSize:15,fontWeight:700,color:T.text}}>Artistas Mais Pedidos</span>
        </div>
        {d.topArtists.length===0
          ? <div style={{fontSize:12,color:T.textT,padding:"8px 0"}}>Sem dados nesse período.</div>
          : d.topArtists.map(([artist,count],i)=>(
          <div key={artist} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
            <div style={{width:22,textAlign:"center",fontSize:12,fontWeight:700,color:i<3?T.gold:T.textD}}>#{i+1}</div>
            {artistPhotos[artist]
              ? <img src={artistPhotos[artist]} alt={artist} onClick={()=>setZoomArtist({name:artist,img:artistPhotos[artist]})} title="Ver foto ampliada" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",flexShrink:0,cursor:"zoom-in"}}/>
              : <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${T.gold}44,${T.gold}22)`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:T.gold}}>
                  {artist.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                </div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{artist}</div>
            </div>
            <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:6,background:T.goldGl}}>
              <span style={{fontSize:11,fontWeight:700,color:T.gold}}>{count} plays</span>
            </div>
          </div>
        ))}
      </div>
      {/* Quem Mais Coloca Música (DJs) */}
      <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${T.border}`,padding:"20px",boxShadow:T.sh}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>
          <span style={{fontSize:15,fontWeight:700,color:T.text}}>Quem Mais Coloca Música</span>
        </div>
        {(!d.djs || d.djs.length===0)
          ? <div style={{fontSize:12,color:T.textT,padding:"8px 0"}}>Ninguém pediu música nesse período.</div>
          : d.djs.map((dj,i)=>{
            const medal = ['🥇','🥈','🥉'][i];
            return (
              <div key={dj.name} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
                <div style={{width:22,textAlign:"center",fontSize:i<3?15:12,fontWeight:700,color:i<3?T.gold:T.textD}}>{medal||`#${i+1}`}</div>
                <AvatarCircle name={dj.name} photo={dj.name===myName?myPhoto:photoCache[dj.name]} size={36} fontSize={13} rounded="9px"/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dj.name}</div>
                </div>
                <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:6,background:T.goldGl}}>
                  <span style={{fontSize:11,fontWeight:700,color:T.gold}}>{dj.count} {dj.count===1?'música':'músicas'}</span>
                </div>
              </div>
            );
          })}
      </div>
      </div>
    </div>
    );
  };

  useEffect(() => { if (tab==='maquina')    loadMaquinaData(); }, [tab]);
  useEffect(() => {
    if (tab==='maquina' && maquinaView==='semaninha' && collageData?.period!==collagePeriod) loadCollage(collagePeriod);
  }, [tab, maquinaView, collagePeriod]); // eslint-disable-line

  // Busca fotos dos artistas (Deezer) — geral + todos os meses; só os que faltam
  useEffect(() => {
    if (!maquinaData) return;
    const names = new Set();
    (maquinaData.topArtists || []).forEach(([a]) => a && names.add(a));
    (maquinaData.months || []).forEach(m => (m.topArtists || []).forEach(([a]) => a && names.add(a)));
    const missing = [...names].filter(n => artistPhotos[n] === undefined);
    if (!missing.length) return;
    let alive = true;
    (async () => {
      for (const name of missing) {
        const url = await fetchArtistImage(name);
        if (!alive) return;
        setArtistPhotos(prev => ({ ...prev, [name]: url || null }));
      }
    })();
    return () => { alive = false; };
  }, [maquinaData]); // eslint-disable-line

  // ── Supabase realtime ────────────────────────────────────
  useEffect(() => {
    checkSpotify();
    loadQueue();
    loadPlayerState();
    loadVolume();
    if (isAdmin) loadAutoplayState();

    const qSub = _supabase.channel('ch_queue_rt')
      .on('postgres_changes', {event:'*',schema:'public',table:'queue'}, () => loadQueue())
      .subscribe();

    const pSub = _supabase.channel('ch_player_rt')
      .on('postgres_changes', {event:'*',schema:'public',table:'player_state'}, () => loadPlayerState())
      .subscribe();

    // Volume sincronizado entre todos (settings.alexa_volume via realtime)
    const volSub = _supabase.channel('ch_vol_rt')
      .on('postgres_changes', {event:'*',schema:'public',table:'settings',filter:'key=eq.alexa_volume'}, () => loadVolume())
      .subscribe();

    const vSub = _supabase.channel('ch_votes_rt')
      .on('postgres_changes', {event:'*',schema:'public',table:'skip_votes'}, () => loadSkipVotes())
      .subscribe();

    const idleTimer = setInterval(() => {
      setDokoMsg(m => {
        const opts = DOKO_MSGS_IDLE.filter(x=>x!==m);
        return opts[Math.floor(Math.random()*opts.length)];
      });
    }, 14000);

    return () => {
      _supabase.removeChannel(qSub);
      _supabase.removeChannel(pSub);
      _supabase.removeChannel(vSub);
      _supabase.removeChannel(volSub);
      clearInterval(idleTimer);
    };
  }, []);

  useEffect(() => { loadSkipVotes(); }, [queue]);

  // ── Chat Alexa compartilhado ─────────────────────────────
  const toMsg = (m) => ({
    id: m.id, role: m.role, text: m.text, name: m.name, spoke: m.spoke,
    ts: new Date(m.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
  });
  useEffect(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    _supabase.from('alexa_chat').delete().lt('created_at', cutoff).then(() => {
      _supabase.from('alexa_chat').select('*').order('created_at', {ascending:true}).limit(150)
        .then(({data}) => { if (data) setAlexaConvo(data.map(toMsg)); });
    });
    const chatSub = _supabase.channel('alexa_chat_rt')
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'alexa_chat'}, ({new:m}) => {
        setAlexaConvo(c => [...c, toMsg(m)]);
        // Inicia animação de digitação apenas para mensagens da Alexa novas
        if (m.role === 'alexa') setTypedChars(p => ({...p, [m.id]: 0}));
      })
      .subscribe();
    return () => _supabase.removeChannel(chatSub);
  }, []);
  // Avança a animação de digitação: 4 caracteres a cada 14ms (~280 chars/s — bem rápido)
  useEffect(() => {
    const pending = Object.entries(typedChars).filter(([id, n]) => {
      const msg = alexaConvo.find(m => m.id === id);
      return msg && n < msg.text.length;
    });
    if (!pending.length) return;
    const timer = setTimeout(() => {
      setTypedChars(prev => {
        const next = {...prev};
        pending.forEach(([id, n]) => {
          const msg = alexaConvo.find(m => m.id === id);
          if (msg) next[id] = Math.min(n + 4, msg.text.length);
        });
        return next;
      });
    }, 14);
    return () => clearTimeout(timer);
  }, [typedChars, alexaConvo]);
  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [alexaConvo]);

  // Busca o videoclipe da música atual quando ela muda (e a janela está ligada)
  useEffect(() => {
    if (!videoEnabled) { setClipVideoId(null); return; }
    const id = currentSong?.spotify_id;
    if (!id || !currentSong?.title) { setClipVideoId(null); return; }
    if (clipCache.current[id] !== undefined) {
      setClipVideoId(clipCache.current[id] || null);
      return;
    }
    const q = `${currentSong.title} ${currentSong.artist || ''}`.trim();
    fetch(`${SERVER_URL}/api/youtube/clip?track_id=${encodeURIComponent(id)}&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => {
        clipCache.current[id] = d.videoId || '';
        setClipVideoId(d.videoId || null);
      })
      .catch(() => { clipCache.current[id] = ''; setClipVideoId(null); });
  }, [currentSong?.spotify_id, videoEnabled]);

  // Extrai cores da capa quando a música muda
  useEffect(() => {
    if (!currentSong?.album_art) return;
    setBlobsVisible(false);
    const t = setTimeout(() => {
      extractAlbumColors(currentSong.album_art).then(colors => {
        if (colors) setFestColors(colors);
        setBlobsVisible(true);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [currentSong?.album_art]);

  // Busca letra quando muda a música
  useEffect(() => {
    const songId = currentSong?.spotify_id || currentSong?.id;
    if (!songId || songId === lastSongId.current) return;
    lastSongId.current = songId;
    fetchLyrics(currentSong);
  }, [currentSong?.spotify_id, currentSong?.id]);

  // Reinicia polling e zera progresso quando muda a música
  useEffect(() => {
    setProgressMs(0);
    if (isPlaying) { stopProgressPolling(); startProgressPolling(); }
  }, [currentSong?.id]); // eslint-disable-line

  // Inicia/para polling de progresso conforme isPlaying
  useEffect(() => {
    if (isPlaying) startProgressPolling();
    else stopProgressPolling();
    return stopProgressPolling;
  }, [isPlaying]);

  // Atualiza linha ativa baseado no progresso
  useEffect(() => {
    if (!lyrics.length) return;
    let idx = 0;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= progressMs) idx = i;
      else break;
    }
    setActiveLine(idx);
  }, [progressMs, lyrics]);

  // Auto-scroll para linha ativa na letra
  useEffect(() => {
    if (!showLyrics || !lyricsRef.current) return;
    const el = lyricsRef.current.querySelector(`[data-line="${activeLine}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeLine, showLyrics]);

  // Auto-scroll suave da PRÉVIA da letra (mini-karaokê sempre visível) — mesmo
  // efeito de troca suave da letra inteira: cada linha transiciona pelo CSS
  // (tamanho/cor/brilho) e o container desliza pra manter a linha ativa
  // centralizada. Usa scrollTo NO CONTAINER (não scrollIntoView) pra não
  // arrastar a página junto.
  useEffect(() => {
    const cont = lyricsPreviewRef.current;
    if (!cont) return;
    const el = cont.querySelector(`[data-pline="${activeLine}"]`);
    if (!el) return;
    cont.scrollTo({ top: el.offsetTop - cont.clientHeight / 2 + el.offsetHeight / 2, behavior: 'smooth' });
  }, [activeLine, lyrics, lyricsLoading, lyricsError]);

  // ── Ações do Festival ────────────────────────────────────
  const handleSearch = (val) => {
    setVoiceVal(val);
    clearTimeout(searchTimer.current);
    // Ignora buscas curtas (1 char) — poluem a cota do Spotify sem retorno útil
    if (val.trim().length < 2) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      const r = await api('get', `/api/search?q=${encodeURIComponent(val)}`);
      setSearchResults(r.tracks || []);
      setIsSearching(false);
    }, 650);
  };

  const LONG_MS = 15 * 60 * 1000;

  const addToQueue = async (track, confirmed = false) => {
    if (isAdding) return;

    // Bloqueia adicionar nos últimos 10s da música atual (quase acabando) E nos
    // primeiros 10s da música seguinte (acabou de começar) — só libera adicionar
    // entre 0:10 e (duração-0:10) do que estiver tocando no momento.
    const EDGE_MS = 10000;
    const playingNow = currentSong || queue.find(s => s.status === 'playing') || queue[0];
    if (playingNow?.duration_ms > 0) {
      const remaining = playingNow.duration_ms - progressMs;
      if (remaining > 0 && remaining <= EDGE_MS) {
        setServerMsg('A música está quase acabando! Espere a próxima começar pra adicionar uma nova. ⏭️');
        setTimeout(() => setServerMsg(''), 5000);
        setSearchResults([]);
        setVoiceVal('');
        return;
      }
      if (progressMs >= 0 && progressMs < EDGE_MS) {
        setServerMsg('A música acabou de começar! Espere os primeiros 10 segundos pra adicionar uma nova. ⏭️');
        setTimeout(() => setServerMsg(''), 5000);
        setSearchResults([]);
        setVoiceVal('');
        return;
      }
    }

    // Verificação local antecipada (evita round-trip desnecessário)
    if (!isAdmin) {
      const myActive = queue.filter(s =>
        s.requested_by === myName && ['pending','playing'].includes(s.status)
      );
      const slotsUsed   = myActive.reduce((acc, s) => acc + ((s.duration_ms||0) >= LONG_MS ? 2 : 1), 0);
      const slotsNeeded = (track.duration_ms||0) >= LONG_MS ? 2 : 1;

      if (slotsUsed + slotsNeeded > 2) {
        const msg = slotsNeeded === 2
          ? 'Essa música tem mais de 15 minutos e ocupa as 2 vagas. Você não tem vagas disponíveis.'
          : 'Limite atingido! Você já não tem vagas. Aguarde uma música tocar para adicionar mais.';
        setServerMsg(msg);
        setTimeout(()=>setServerMsg(''), 5000);
        setSearchResults([]);
        setVoiceVal('');
        return;
      }

      // Música longa: pede confirmação antes de continuar
      if (slotsNeeded === 2 && !confirmed) {
        setConfirmTrack(track);
        setSearchResults([]);
        setVoiceVal('');
        return;
      }
    }

    setIsAdding(track.id);
    setSearchResults([]);
    setVoiceVal('');
    const corpo = { uri: track.uri, spotify_id: track.id,
          title: track.title, artist: track.artist,
          album_art: track.album_art, requested_by: myName,
          duration_ms: track.duration_ms, duration_str: track.duration_str,
          is_admin: isAdmin };
    const r = await api('post', '/api/queue', corpo);
    if (!r.error) {
      const msgs = DOKO_MSGS_ADD(myName, track.title);
      setDokoMsg(msgs[Math.floor(Math.random()*msgs.length)]);
      setServerMsg('');
      if (!isPlaying && !currentSong) api('post', '/api/player/play');
    } else {
      setServerMsg(r.error);
      setTimeout(()=>setServerMsg(''), 5000);
    }
    setIsAdding(null);
  };

  // Reordena a fila (admin): troca a posição de duas músicas pending adjacentes.
  // direction: -1 = sobe, +1 = desce
  const moveSong = async (song, direction) => {
    if (movingId) return;
    const pending = queue
      .filter(s => s.status === 'pending')
      .sort((a,b) => (a.position||0) - (b.position||0));
    const idx = pending.findIndex(s => s.id === song.id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= pending.length) return;
    const other = pending[targetIdx];

    setMovingId(song.id);
    // Otimista: troca local imediatamente
    setQueue(prev => prev.map(s =>
      s.id === song.id  ? { ...s, position: other.position } :
      s.id === other.id ? { ...s, position: song.position }  : s
    ));
    // Troca as posições no Supabase (a realtime sub atualiza os outros clientes)
    await Promise.all([
      _supabase.from('queue').update({ position: other.position }).eq('id', song.id),
      _supabase.from('queue').update({ position: song.position }).eq('id', other.id),
    ]);
    await loadQueue();
    setMovingId(null);
  };

  // ── Substituir música da fila ────────────────────────────
  const openReplace = (song) => {
    setReplaceTarget(song);
    setReplaceVal("");
    setReplaceResults([]);
  };
  const closeReplace = () => {
    clearTimeout(replaceTimer.current);
    setReplaceTarget(null);
    setReplaceVal("");
    setReplaceResults([]);
    setIsReplacing(null);
  };

  const handleReplaceSearch = (val) => {
    setReplaceVal(val);
    clearTimeout(replaceTimer.current);
    // Ignora buscas curtas (1 char) — poluem a cota do Spotify sem retorno útil
    if (val.trim().length < 2) { setReplaceResults([]); setReplaceSearching(false); return; }
    setReplaceSearching(true);
    replaceTimer.current = setTimeout(async () => {
      const r = await api('get', `/api/search?q=${encodeURIComponent(val)}`);
      setReplaceResults(r.tracks || []);
      setReplaceSearching(false);
    }, 650);
  };

  // Troca os dados da linha da fila pela nova música, mantendo posição,
  // status e quem pediu — espelha o padrão de `moveSong` (escreve direto no Supabase).
  const replaceSong = async (track) => {
    const target = replaceTarget;
    if (!target || isReplacing) return;

    // Respeita o limite de vagas para colaboradores ao trocar por uma música longa.
    if (!isAdmin) {
      const myActive = queue.filter(s =>
        s.requested_by === myName && ['pending','playing'].includes(s.status)
      );
      const slotsUsed   = myActive.reduce((acc, s) => acc + ((s.duration_ms||0) >= LONG_MS ? 2 : 1), 0);
      const oldSlots    = (target.duration_ms||0) >= LONG_MS ? 2 : 1;
      const newSlots    = (track.duration_ms||0)  >= LONG_MS ? 2 : 1;
      if (slotsUsed - oldSlots + newSlots > 2) {
        setServerMsg('Essa música é longa demais e ultrapassa seu limite de vagas.');
        setTimeout(()=>setServerMsg(''), 5000);
        return;
      }
    }

    setIsReplacing(track.id);
    // Otimista: atualiza a linha localmente
    setQueue(prev => prev.map(s => s.id === target.id ? {
      ...s, spotify_uri: track.uri, spotify_id: track.id, title: track.title, artist: track.artist,
      album_art: track.album_art, duration_ms: track.duration_ms, duration_str: track.duration_str,
    } : s));
    const { error } = await _supabase.from('queue').update({
      spotify_uri: track.uri, spotify_id: track.id, title: track.title, artist: track.artist,
      album_art: track.album_art, duration_ms: track.duration_ms, duration_str: track.duration_str,
    }).eq('id', target.id);
    if (error) { setServerMsg('Não foi possível substituir a música.'); setTimeout(()=>setServerMsg(''), 5000); }
    await loadQueue();
    closeReplace();
  };

  const handleVote = async (song) => {
    if (myVotedSongs.has(song.id)) {
      setServerMsg('Você já votou para pular essa música');
      setTimeout(()=>setServerMsg(''), 3000);
      return;
    }
    const r = await api('post', '/api/vote/skip', { user_id: userId, song_id: song.id });
    if (r.error === 'Você já votou') { setMyVotedSongs(s=>new Set([...s,song.id])); return; }
    if (!r.error) {
      setMyVotedSongs(s=>new Set([...s,song.id]));
      const msgs = DOKO_MSGS_VETO(song.title, r.votes, r.needed||VETO);
      setDokoMsg(msgs[0]);
      if (r.skipped) {
        const skipMsgs = DOKO_MSGS_SKIP(myName);
        setTimeout(()=>setDokoMsg(skipMsgs[Math.floor(Math.random()*skipMsgs.length)]),600);
      }
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      const r = await api('post', '/api/player/pause');
      if (!r.error) setIsPlaying(false);
    } else if (currentSong || queue.length) {
      const r = await api('post', currentSong ? '/api/player/resume' : '/api/player/play');
      if (!r.error) setIsPlaying(true);
    }
  };

  const handleNext = async () => {
    const r = await api('post', '/api/player/next');
    if (!r.error) {
      const msgs = DOKO_MSGS_SKIP(myName);
      setDokoMsg(msgs[Math.floor(Math.random()*msgs.length)]);
    }
  };

  const handleLoadDevices = async () => {
    const r = await api('get', '/api/devices');
    setDevices(r.devices || []);
    setShowDevices(true);
  };

  const selectDevice = async (deviceId) => {
    await api('post', '/api/devices/select', { device_id: deviceId });
    setDevices(ds => ds.map(d => ({ ...d, is_active: d.id === deviceId })));
  };

  // Volume — debounce para não spam o Spotify
  const volumeTimer = useRef(null);
  const handleVolume = (newVol) => {
    setVolume(newVol);
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(async () => {
      setVolumeSaving(true);
      // Query builder do Supabase não tem .catch() de verdade (só .then thenable) —
      // encadear .catch() direto quebrava em produção ("...upsert(...).catch is not
      // a function"). try/catch cobre os dois awaits sem esse risco.
      try {
        await api('put', `/api/player/volume?volume_percent=${newVol}`);
        // Persiste pra sobreviver a refresh/troca de aba e sincronizar entre todos.
        await _supabase.from('settings').upsert({ key: 'alexa_volume', value: String(newVol) }, { onConflict: 'key' });
      } catch {}
      setVolumeSaving(false);
    }, 300);
  };

  /* ── Arrastar pro minuto da música (admin) ───────────────────────────────
     Só admin: a barra de progresso vira arrastável e manda o Spotify pular
     pro ponto escolhido (o Echo acompanha na hora). A base do relógio local
     é atualizada ANTES da chamada pra a barra não voltar sozinha enquanto a
     rede responde; se o Spotify recusar, o próximo sync (≤8s) corrige. */
  const [seekMsg, setSeekMsg] = useState('');
  const seekTo = async (ms) => {
    const total = cur?.duration_ms || 0;
    if (!isAdmin || !total) return;
    // Trava 1s antes do fim: soltar exatamente no 100% faz o Spotify encerrar
    // a faixa e a fila avançar, o que não é o que quem arrastou quis fazer.
    const alvo = Math.max(0, Math.min(total - 1000, Math.round(ms)));
    progressBase.current = { ms: alvo, at: Date.now() };
    setProgressMs(alvo);
    const r = await api('put', `/api/player/seek?position_ms=${alvo}`).catch(() => null);
    if (!r?.ok) {
      setSeekMsg('Não deu pra pular pro ponto da música.');
      setTimeout(() => setSeekMsg(''), 3000);
    }
  };

  const sendAlexa = async () => {
    if (!alexaInput.trim()) return;
    if (!canAskAlexa) return;
    consumeAlexaRequest();
    const question = alexaInput;
    setAlexaInput("");
    setAlexaTyping(true);
    // Salva mensagem do usuário
    await _supabase.from('alexa_chat').insert({ role:'user', text:question, name:USER.short||myName });
    // Gera e salva resposta da Alexa imediatamente (animação de digitação via realtime)
    const firstName = (USER.short || myName || 'pessoal').split(' ')[0];
    const cleanQ    = question.replace(/^alexa[,.\s]*/i, '').trim();
    const summary   = cleanQ.length > 38 ? cleanQ.slice(0, 38).trim() + '...' : cleanQ;
    await _supabase.from('alexa_chat').insert({
      role:'alexa', spoke:true,
      text:`Olá, ${firstName}! Vou pesquisar sobre "${summary}"`,
    });
    // Dispara o comando para a Alexa em paralelo
    api('post', '/api/alexa/ask', { question, userName: myName }).then(r => {
      if (r?.ok && r.playlist) {
        _supabase.from('alexa_chat').insert({
          role:'alexa', spoke:false,
          text:`🎵 Iniciando playlist "${r.playlist}" no UnikoWave!`,
        });
        setPlayingPl(null);
      } else if (r?.ok && r.not_found) {
        _supabase.from('alexa_chat').insert({
          role:'alexa', spoke:false,
          text:`Playlist "${r.not_found}" não encontrada na biblioteca.`,
        });
      }
    }).catch(() => {});
    setAlexaTyping(false);
  };

  const VETO    = 4;
  const cur     = currentSong || queue.find(s=>s.status==='playing') || queue[0];
  const curIdx  = queue.findIndex(s=>s.id===cur?.id);

  // Vídeo de fundo ativo no Festival? Quando sim, desligamos o que mais pesa em
  // cima de um vídeo tocando: (1) os `backdrop-filter: blur()` dos painéis de
  // vidro (re-borram o vídeo QUADRO A QUADRO — é o que travava; o sintoma "fica
  // liso quando abro o F12" é clássico disso: a área a re-borrar encolhe) e
  // (2) as 8 blobs animadas `filter: blur(95px)` que ficavam por cima do vídeo.
  const festBgVideo = tab==="festival" ? (unikoDaSkin(songSkin)?.bgVideoUrl || '') : '';

  return (
    <div className={festBgVideo ? 'ca-bgvid-on' : undefined} style={{minHeight:"100vh",background:"transparent",fontFamily:"var(--font-body)",position:"relative",overflowX:"hidden"}}>
      {festBgVideo && <style>{`.ca-bgvid-on [style*="blur"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`}</style>}

      {/* ── Bloqueio FIXO: Spotify indisponível (rate limit / ban / desconectado) ──
          Trava a Central inteira — nenhuma ação é possível além de voltar aos módulos.
          Não é dispensável de propósito: enquanto o Spotify estiver bloqueado, não há o
          que fazer aqui, então evitamos que as pessoas tentem (e falhem em) pedir música. */}
      {spotifyChecked && !spotifyOk && (
        <div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.72)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",padding:16}}>
          <div style={{background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,borderRadius:22,padding:"32px 30px 26px",maxWidth:420,width:"100%",boxShadow:T.shL,textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:14,animation:"caPulse 1.6s ease-in-out infinite"}}>🎧</div>
            <div style={{fontWeight:800,fontSize:19,color:T.text,marginBottom:12}}>
              Spotify temporariamente bloqueado
            </div>
            <div style={{fontSize:14,color:T.textT,lineHeight:1.7,marginBottom:10}}>
              Em instantes a <strong style={{color:T.gold}}>Central Alexa</strong> volta a funcionar e vocês vão poder colocar música normalmente e se divertir 🎶
            </div>
            <div style={{fontSize:14,color:T.textT,lineHeight:1.7,marginBottom:22}}>
              O <strong style={{color:T.text}}>desenvolvedor já foi acionado</strong> e o bloqueio já está sendo resolvido. É só aguardar um pouquinho 💜
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:20,fontSize:12,color:T.textD,fontWeight:600}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#F0A030",display:"inline-block",animation:"caPulse 1.2s ease-in-out infinite"}}/>
              Reconectando automaticamente…
            </div>
            <button
              onClick={onBack}
              style={{border:"none",background:T.gold,color:"#fff",fontWeight:800,fontSize:14,padding:"11px 26px",borderRadius:11,cursor:"pointer",outline:"none",boxShadow:`0 4px 16px ${T.goldLine}55`}}>
              ← Voltar aos módulos
            </button>
          </div>
          <style>{`@keyframes caPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.9)}}`}</style>
        </div>
      )}

      {/* ── Modal: confirmação de música longa (≥15 min) ── */}
      {confirmTrack&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.55)",backdropFilter:"blur(6px)"}}>
          <div style={{background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,borderRadius:20,padding:"28px 28px 24px",maxWidth:360,width:"90%",boxShadow:T.shL}}>
            <div style={{fontSize:28,textAlign:"center",marginBottom:12}}>⏱️</div>
            <div style={{fontWeight:700,fontSize:15,color:T.text,textAlign:"center",marginBottom:8}}>
              Música longa detectada
            </div>
            <div style={{fontSize:13,color:T.textT,textAlign:"center",lineHeight:1.6,marginBottom:6}}>
              <strong style={{color:T.text}}>{confirmTrack.title}</strong> tem {confirmTrack.duration_str} de duração.
            </div>
            <div style={{fontSize:13,color:T.textT,textAlign:"center",lineHeight:1.6,marginBottom:22}}>
              Tem certeza que quer adicionar essa música? Você usará seu <strong style={{color:T.gold}}>limite de 2 vagas</strong> de uma vez.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button
                onClick={()=>setConfirmTrack(null)}
                style={{flex:1,padding:"11px 0",borderRadius:10,border:`1px solid ${T.border}`,background:"transparent",color:T.textT,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                Cancelar
              </button>
              <button
                onClick={()=>{ const t=confirmTrack; setConfirmTrack(null); addToQueue(t, true); }}
                style={{flex:1,padding:"11px 0",borderRadius:10,border:"none",background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: substituir música da fila ── */}
      {replaceTarget&&(
        <div onClick={closeReplace} style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.55)",backdropFilter:"blur(6px)",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 22px 20px",maxWidth:440,width:"100%",boxShadow:T.shL}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{fontWeight:700,fontSize:15,color:T.text}}>Substituir música</div>
              <button onClick={closeReplace} style={{background:"rgba(0,0,0,0.06)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:14,color:T.textS,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            {/* Música atual */}
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",borderRadius:11,background:T.goldGl,border:`1px solid ${T.goldLine}33`,marginBottom:14}}>
              {replaceTarget.album_art
                ? <img src={replaceTarget.album_art} alt="" style={{width:38,height:38,borderRadius:7,objectFit:"cover",flexShrink:0}}/>
                : <div style={{width:38,height:38,borderRadius:7,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎵</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:T.textD,textTransform:"uppercase",letterSpacing:".06em",fontWeight:600,marginBottom:1}}>Trocando</div>
                <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{replaceTarget.title}</div>
                <div style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{replaceTarget.artist}</div>
              </div>
            </div>
            {/* Busca */}
            <div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 13px",borderRadius:11,border:`1.5px solid ${T.border}`,background:isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.02)",marginBottom:10}}>
              {replaceSearching
                ? <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
              <input autoFocus value={replaceVal} onChange={e=>handleReplaceSearch(e.target.value)}
                placeholder="Buscar a música certa..."
                style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:14,color:T.text,fontFamily:"var(--font-body)",caretColor:T.gold}}/>
            </div>
            {/* Resultados */}
            <div style={{maxHeight:"42vh",overflowY:"auto",borderRadius:12,border:replaceResults.length?`1px solid ${T.border}`:"none"}}>
              {replaceResults.map(t=>(
                <div key={t.id} onClick={()=>replaceSong(t)}
                  style={{display:"flex",alignItems:"center",gap:11,padding:"9px 12px",cursor:isReplacing?"wait":"pointer",borderBottom:`1px solid ${T.divider}`,transition:"background .12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {t.album_art
                    ? <img src={t.album_art} alt="" style={{width:38,height:38,borderRadius:7,objectFit:"cover",flexShrink:0}}/>
                    : <div style={{width:38,height:38,borderRadius:7,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎵</div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                    <div style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.artist}</div>
                  </div>
                  <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontSize:10,color:T.textD}}>{t.duration_str}</span>
                    {isReplacing===t.id
                      ? <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                      : <div style={{width:24,height:24,borderRadius:6,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:"flex",alignItems:"center",justifyContent:"center"}} title="Substituir por esta">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>}
                  </div>
                </div>
              ))}
              {!replaceResults.length && replaceVal.trim() && !replaceSearching && (
                <div style={{padding:"20px",textAlign:"center",color:T.textT,fontSize:12}}>Nenhuma música encontrada.</div>
              )}
              {!replaceVal.trim() && (
                <div style={{padding:"20px",textAlign:"center",color:T.textT,fontSize:12}}>Digite para buscar a música que você realmente queria.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Festival ambient background — Apple Music style (some quando há vídeo de fundo) ── */}
      {tab==="festival"&&festColors&&!festBgVideo&&(
        <div style={{position:"fixed",inset:0,zIndex:1,pointerEvents:"none",opacity:blobsVisible?1:0,transition:"opacity 0.9s ease"}}>
          {/* Base gradient wash usando todas as cores */}
          <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${festColors[0]}55,${festColors[5]}40,${festColors[1]}45,${festColors[6]}35,${festColors[2]}40)`,transition:"background 2s ease"}}/>

          {/* Blob 1 — top-left, grande, lento */}
          <div style={{position:"absolute",width:"58vw",height:"58vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[0]}99 0%,transparent 65%)`,top:"-18vw",left:"-12vw",filter:"blur(88px)",animation:"festBlob1 14s ease-in-out infinite"}}/>
          {/* Blob 2 — top-right */}
          <div style={{position:"absolute",width:"50vw",height:"50vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[1]}90 0%,transparent 65%)`,top:"-12vw",right:"-8vw",filter:"blur(82px)",animation:"festBlob2 17s ease-in-out infinite"}}/>
          {/* Blob 3 — bottom-left */}
          <div style={{position:"absolute",width:"48vw",height:"48vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[2]}88 0%,transparent 62%)`,bottom:"-12vw",left:"-8vw",filter:"blur(78px)",animation:"festBlob3 12s ease-in-out infinite"}}/>
          {/* Blob 4 — bottom-right */}
          <div style={{position:"absolute",width:"44vw",height:"44vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[3]}88 0%,transparent 65%)`,bottom:"-8vw",right:"-6vw",filter:"blur(75px)",animation:"festBlob4 15s ease-in-out infinite"}}/>
          {/* Blob 5 — centro */}
          <div style={{position:"absolute",width:"38vw",height:"38vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[4]}77 0%,transparent 65%)`,top:"30%",left:"31%",filter:"blur(72px)",animation:"festBlob5 11s ease-in-out infinite"}}/>
          {/* Blob 6 — topo faixa larga */}
          <div style={{position:"absolute",width:"70vw",height:"30vw",borderRadius:"50%",background:`radial-gradient(ellipse,${festColors[5]}60 0%,transparent 65%)`,top:"-5vw",left:"10%",filter:"blur(95px)",animation:"festBlob6 19s ease-in-out infinite"}}/>
          {/* Blob 7 — base faixa larga */}
          <div style={{position:"absolute",width:"70vw",height:"30vw",borderRadius:"50%",background:`radial-gradient(ellipse,${festColors[6]}60 0%,transparent 65%)`,bottom:"-5vw",left:"5%",filter:"blur(95px)",animation:"festBlob7 16s ease-in-out infinite"}}/>
          {/* Blob 8 — faixa vertical centro */}
          <div style={{position:"absolute",width:"28vw",height:"80vh",borderRadius:"50%",background:`radial-gradient(ellipse,${festColors[7]}55 0%,transparent 65%)`,top:"5%",left:"38%",filter:"blur(80px)",animation:"festBlob8 22s ease-in-out infinite"}}/>
          {/* Blob 9 — médio direita */}
          <div style={{position:"absolute",width:"36vw",height:"36vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[8]}70 0%,transparent 60%)`,top:"20%",right:"5%",filter:"blur(70px)",animation:"festBlob2 13s ease-in-out infinite reverse"}}/>
          {/* Blob 10 — médio esquerda */}
          <div style={{position:"absolute",width:"32vw",height:"32vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[9]}75 0%,transparent 60%)`,top:"40%",left:"2%",filter:"blur(65px)",animation:"festBlob5 18s ease-in-out infinite reverse"}}/>
        </div>
      )}

      {/* ── Tempestade vampírica de fundo nos cantos da tela ──
           só no modo escuro (Nebula), no festival e com vampire robot ativo ── */}
      {T.dark && tab==="festival" && songSkin === 'vampire-robot' && <CentralStorm />}

      {/* ── Recife de fundo da página (Uniko Sereia): água-vivas gigantes cruzando a tela,
           cardume de peixinhos, areia e corais/anêmonas nos cantos. Sem gate de tema —
           diferente da tempestade do vampiro, o recife é suave/colorido e fica bem em
           qualquer tema (claro ou escuro). ── */}
      {tab==="festival" && songSkin === 'uniko-sereia' && <CentralOcean />}

      {/* ── Cenário cósmico de fundo (Destruidora de Mundos): asteroides, planetas,
           buracos negros, estrelas e a espada cravada num planeta. SEM gate de tema
           (igual o recife da Sereia) — precisa aparecer pra TODO MUNDO vendo a Central
           Alexa quando a música de quem tem essa skin está tocando, não só pra quem
           estiver no tema escuro (antes tinha o mesmo gate T.dark do vampiro, por
           engano — o vampiro é sombrio de propósito, mas o pedido aqui é aparecer
           sempre). ── */}
      {/* ── Vídeo de fundo por Uniko (configurado no Dashboard RH): quando o Uniko
           do DJ atual tem vídeo, ele SUBSTITUI qualquer cenário animado codado. ── */}
      {tab==="festival" && unikoDaSkin(songSkin)?.bgVideoUrl && <CentralBgVideo url={unikoDaSkin(songSkin).bgVideoUrl} />}

      {tab==="festival" && !unikoDaSkin(songSkin)?.bgVideoUrl && songSkin === 'destruidora-de-mundos-dh0x' && <CentralCosmos />}

      {/* ── Floresta de sakura de fundo da página (Uniko Kitsune) — pétalas caindo,
           cachoeira, rio, névoas e torii. Gate pelo sceneType do Uniko (id da Oficina
           tem sufixo aleatório), sem gate de tema: suave e bonito em claro ou escuro. ── */}
      {tab==="festival" && !unikoDaSkin(songSkin)?.bgVideoUrl && unikoDaSkin(songSkin)?.theme?.sceneType === 'sakura' && <CentralSakura />}

      {/* ── Jardim encantado de fundo da página (Uniko Rainha das Fadas) — flores,
           fadinhas, rio, árvores e sol. Gate pelo sceneType, sem gate de tema. ── */}
      {tab==="festival" && !unikoDaSkin(songSkin)?.bgVideoUrl && unikoDaSkin(songSkin)?.theme?.sceneType === 'fairy' && <CentralFairy />}

      {/* ── Colagem SOUR de fundo (Uniko Olivia Rodrigo) — fundo roxo, borboletas,
           flores que sorriem, arco-íris, corações, estrelas e joias. Gate pelo
           sceneType, sem gate de tema (bonito em claro ou escuro). ── */}
      {tab==="festival" && !unikoDaSkin(songSkin)?.bgVideoUrl && unikoDaSkin(songSkin)?.theme?.sceneType === 'olivia' && <CentralOlivia />}

      <style>{`
        @keyframes alexaEq1{0%{height:5px}100%{height:18px}}
        @keyframes alexaEq2{0%{height:14px}100%{height:6px}}
        @keyframes alexaEq3{0%{height:4px}100%{height:20px}}
        @keyframes alexaEq4{0%{height:18px}100%{height:8px}}
        @keyframes alexaEq5{0%{height:9px}100%{height:16px}}
        @keyframes voiceGlow{0%,100%{box-shadow:0 0 0 2px ${T.gold}44,0 0 12px ${T.gold}22}50%{box-shadow:0 0 0 3px ${T.gold}88,0 0 32px ${T.gold}44}}
        @keyframes voicePulse{0%,100%{border-color:${T.goldLine}55}50%{border-color:${T.gold}}}
        @keyframes dokoFloat{0%,100%{transform:translateY(0px)}50%{transform:translateY(-8px)}}
        @keyframes bubblePop{0%{opacity:0;transform:scale(0.7) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes alexaOrb{0%,100%{box-shadow:0 0 20px ${T.gold}44,0 0 40px ${T.gold}22}50%{box-shadow:0 0 40px ${T.gold}88,0 0 80px ${T.gold}33}}
        @keyframes alexaFloat{0%,100%{transform:translateY(0px)}50%{transform:translateY(-8px)}}
        @keyframes hdrBlob1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(28px,-8px) scale(1.15)}66%{transform:translate(-12px,10px) scale(0.92)}}
        @keyframes hdrBlob2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-18px,14px) scale(1.08)}}
        @keyframes typingDot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
        @keyframes festBlob1{0%,100%{transform:translate(0,0) scale(1) rotate(0deg)}33%{transform:translate(60px,-40px) scale(1.2) rotate(120deg)}66%{transform:translate(-30px,50px) scale(0.85) rotate(240deg)}}
        @keyframes festBlob2{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-70px,30px) scale(1.15)}80%{transform:translate(40px,-20px) scale(0.9)}}
        @keyframes festBlob3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(50px,60px) scale(1.1)}}
        @keyframes festBlob4{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(-40px,-50px) scale(1.18)}70%{transform:translate(30px,20px) scale(0.88)}}
        @keyframes festBlob5{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(80px,20px) scale(1.25)}75%{transform:translate(-60px,-30px) scale(0.8)}}
        @keyframes festBlob6{0%,100%{transform:translate(0,0) scale(1) rotate(0deg)}50%{transform:translate(-50px,70px) scale(1.2) rotate(180deg)}}
        @keyframes festBlob7{0%,100%{transform:translate(0,0) scale(1)}20%{transform:translate(40px,-60px) scale(0.9)}60%{transform:translate(-30px,40px) scale(1.3)}90%{transform:translate(60px,10px) scale(0.95)}}
        @keyframes festBlob8{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-80px,-20px) scale(1.1)}66%{transform:translate(50px,60px) scale(0.85)}}
      `}</style>

      {/* Topbar — `paddingTop` com a safe-area evita nascer embaixo do
          relógio/notch quando o Portal roda "instalado" (mesmo fix já feito
          no Uniko FIT). */}
      <div style={{height:56,boxSizing:"content-box",background:T.topbarBg||headerBg,backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 24px",paddingTop:"env(safe-area-inset-top, 0px)",gap:12,position:"sticky",top:0,zIndex:200,boxShadow:`0 1px 20px ${T.goldLine}22`}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:T.textS,fontSize:13,fontFamily:"var(--font-body)",padding:"4px 8px",borderRadius:7}}
          onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||"rgba(0,0,0,0.04)"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Módulos
        </button>
        <div style={{width:1,height:20,background:T.border}}/>
        <UnikoIcon size={32}/>
        <span style={{fontSize:14,fontWeight:700,color:T.text,fontFamily:"var(--font-brand)",letterSpacing:".04em"}}>Central Alexa</span>
        <Tag color={T.gold}>Novo</Tag>
        <div style={{flex:1}}/>
        {isPlaying&&cur&&!isMobile&&(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 14px",borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
            <div style={{display:"flex",alignItems:"flex-end",gap:2,height:20}}>
              {[1,2,3,4,5].map(i=><div key={i} style={{width:3,borderRadius:2,background:T.gold,animation:`alexaEq${(i%5)+1} ${0.5+i*0.07}s ease-in-out infinite alternate`,minHeight:4,maxHeight:22}}/>)}
            </div>
            <span style={{fontSize:12,fontWeight:600,color:T.gold,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur.title} — {cur.artist}</span>
          </div>
        )}
        <Logo size={28}/>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:isMobile?"12px":"24px",paddingBottom:isMobile&&cur?86:(isMobile?12:24),position:"relative",zIndex:2}}>
        <div style={{display:"flex",gap:isMobile?4:6,marginBottom:isMobile?14:20,padding:4,
          width:isMobile?"100%":"fit-content",overflowX:isMobile?"auto":"visible",
          background:isDark?`${T.surface}cc`:(T.surfaceW||"rgba(255,255,255,0.70)"),
          backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",
          border:`1px solid ${T.border}`,borderRadius:13,boxShadow:T.sh,
          scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
          {[
            {id:"festival",  label:"Festival",          adminOnly:false, icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>},
            {id:"playlist",  label:"Playlist",          adminOnly:false, icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/></svg>},
            {id:"maquina",   label:"Máquina do Tempo",  adminOnly:false, icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>},
            {id:"alexa",     label:"Alexa",             adminOnly:false, icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>},
          ].filter(t => !t.adminOnly || isAdmin).map(({id,label,icon})=>(
            <button key={id} onClick={()=>changeTab(id)} style={{
              display:"flex",alignItems:"center",gap:6,flexShrink:0,
              padding:isMobile?"8px 14px":"9px 18px",borderRadius:9,cursor:"pointer",outline:"none",
              fontFamily:"var(--font-body)",fontSize:isMobile?12:13,fontWeight:tab===id?700:400,
              background:tab===id?T.goldGl:"transparent",color:tab===id?T.gold:T.textS,
              border:`1.5px solid ${tab===id?T.goldLine+"55":T.border}`,transition:"all .15s"
            }}>{icon}{label}</button>
          ))}
        </div>

        {/* ══════════ FESTIVAL TAB ══════════ */}
        {tab==="festival"&&(
          <div style={{position:"relative",zIndex:1}}>
          {/* Mini janela do videoclipe — só aparece se houver clipe pra música atual */}
          {videoEnabled && clipVideoId && currentSong && (
            <FestivalVideoWindow
              videoId={clipVideoId}
              title={currentSong.title}
              getSeekSec={() => progressMs / 1000}
              theme={{ border:T.border, text:T.text, textS:T.textS, gold:T.gold, cardBg }}
              onClose={toggleVideo}
              onUnavailable={() => {
                if (currentSong?.spotify_id) clipCache.current[currentSong.spotify_id] = '';
                setClipVideoId(null);
              }}
            />
          )}
          <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?14:20,alignItems:"flex-start",position:"relative",zIndex:1}}>

            {/* Left: UnikoWave + Player */}
            <div style={{width:isMobile?"100%":360,flexShrink:0,display:"flex",flexDirection:isMobile?"row":"column",flexWrap:isMobile?"wrap":"nowrap",gap:isMobile?12:16}}>
              {(() => {
                const isVampCard = songSkin === 'vampire-robot';
                const isSeaCard  = songSkin === 'uniko-sereia';
                // Qualquer outra skin não-padrão (UNIKO Comum ou um Uniko da Oficina) ganha
                // borda/glow na cor que o admin escolheu ao criar (getUniko cobre os dois).
                const isCustomCard = songSkin !== 'default' && !isVampCard && !isSeaCard;
                const isThemedCard = isVampCard || isSeaCard || isCustomCard;
                const skin = isThemedCard ? getAssistantSkin(songSkin) : null;
                const uni  = isCustomCard ? unikoDaSkin(songSkin) : null;
                const customAccent = uni?.theme?.accent || T.gold;
                // Vídeo de fundo do card (por Uniko, config do RH) — vale pra
                // qualquer skin não-padrão (vamp/sereia/Oficina). Quando existe,
                // SUBSTITUI o cenário animado codado do card (só o `!cardBgVideo`
                // dos blocos de cena abaixo cuida disso).
                const cardBgVideo = unikoDaSkin(songSkin)?.bgVideoUrl || '';
                return (
                <div style={{ position:'relative' }}>
                  {isVampCard && <style>{VAMP_CARD_CSS}</style>}
                  {isSeaCard && <style>{SEA_CARD_CSS}</style>}

                  <div style={{borderRadius:20,
                    background: cardBgVideo ? 'transparent' : isVampCard ? '#090004' : isSeaCard ? '#03141a' : isCustomCard ? (uni?.theme?.deep || '#0a0a12') : cardBg,
                    backdropFilter: cardBgVideo ? 'none' : "blur(20px)",WebkitBackdropFilter: cardBgVideo ? 'none' : "blur(20px)",
                    border: isVampCard ? '2px solid #c41e3a' : isSeaCard ? '2px solid #2dd4bf' : isCustomCard ? `2px solid ${customAccent}` : `1px solid ${T.border}`,
                    padding:"14px 16px 22px",
                    boxShadow: isThemedCard ? undefined : T.shM,
                    animation: isVampCard ? 'vampHeartBeat 3s ease-in-out infinite' : isSeaCard ? 'seaCardBreathe 4s ease-in-out infinite' : undefined,
                    position:"relative",
                    // Destruidora de Mundos é ENORME de propósito (SIZE_MULT_BY_SKIN em
                    // UnikoMascot.jsx) e deve estourar pra fora do card — as outras skins
                    // continuam contidas (a CosmosScene de fundo tem seu PRÓPRIO
                    // overflow:hidden logo abaixo, então ela não vaza mesmo com isso).
                    overflow: songSkin === 'destruidora-de-mundos-dh0x' ? 'visible' : 'hidden',
                    width:isMobile?"auto":undefined,flex:isMobile?"0 0 auto":undefined,
                    transition:"background .5s, border .5s",
                  }}>

                    {/* Quando há vídeo do Uniko o card fica transparente (background
                        já é 'transparent' acima) pra deixar o vídeo de tela cheia —
                        um decode só — aparecer LIMPO atrás do mascote. Sem véu. */}

                    {/* Lua de sangue */}
                    {isVampCard && !cardBgVideo && (
                      <div style={{
                        position:'absolute', top:10, right:14, width:40, height:40,
                        borderRadius:'50%', pointerEvents:'none',
                        background:'radial-gradient(circle, #e02848 0%, #7a0010 100%)',
                        boxShadow:'0 0 16px 6px #c41e3a66, 0 0 40px 12px #c41e3a22',
                        animation:'vampMoonPulse 3.5s ease-in-out infinite', zIndex:0,
                      }}/>
                    )}

                    {/* Nuvens perto da lua */}
                    {isVampCard && !cardBgVideo && <VampClouds />}

                    {/* Relâmpagos vermelhos saindo das nuvens (a cada 6s) */}
                    {isVampCard && !cardBgVideo && <VampStorm />}

                    {/* Morcegos — só na faixa superior, atrás do ícone (zIndex 1) */}
                    {isVampCard && !cardBgVideo && (
                      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1, borderRadius:20 }}>
                        {Array.from({ length: 5 }).map((_, i) => <VampBat key={i} />)}
                      </div>
                    )}

                    {/* Castelo de vampiro */}
                    {isVampCard && !cardBgVideo && <VampCastle />}

                    {/* Árvores secas nos cantos inferiores (laterais do castelo) */}
                    {isVampCard && !cardBgVideo && <SideTreeCluster side="left" />}
                    {isVampCard && !cardBgVideo && <SideTreeCluster side="right" />}

                    {/* Atmospheric glow */}
                    {isVampCard && !cardBgVideo && (
                      <div style={{
                        position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
                        background:'radial-gradient(ellipse at 65% 5%, #c41e3a1c 0%, transparent 60%)',
                      }}/>
                    )}

                    {/* Recife de corais — raios de luz, bolhas, água-vivas, peixinhos e corais */}
                    {isSeaCard && !cardBgVideo && (
                      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1, borderRadius:20 }}>
                        <OceanScene jellies={3} fish={4} bubbles={7} whales={false} dolphins={false} />
                      </div>
                    )}

                    {/* Normal blob */}
                    {!isThemedCard && (
                      <div style={{position:"absolute",width:80,height:80,borderRadius:"50%",background:festColors?.[0]||T.gold,filter:"blur(30px)",opacity:0.12,top:0,left:"20%",transition:"background 1.5s ease"}}/>
                    )}

                    {/* Glow na cor do Uniko personalizado (Oficina/Comum) — sem cenário artesanal próprio */}
                    {isCustomCard && (
                      <div style={{position:"absolute",width:110,height:110,borderRadius:"50%",background:customAccent,filter:"blur(40px)",opacity:0.18,top:-10,left:"18%"}}/>
                    )}

                    {/* Cenário cósmico artesanal — Unikos da Oficina com theme.sceneType='cosmos' (ex.: Destruidora de Mundos) */}
                    {isCustomCard && !cardBgVideo && uni?.theme?.sceneType === 'cosmos' && (
                      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1, borderRadius:20 }}>
                        <CosmosScene />
                      </div>
                    )}

                    {/* Cenário de floresta de sakura artesanal — Unikos da Oficina com theme.sceneType='sakura' (ex.: Kitsune) */}
                    {isCustomCard && !cardBgVideo && uni?.theme?.sceneType === 'sakura' && (
                      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1, borderRadius:20 }}>
                        <SakuraScene />
                      </div>
                    )}

                    {/* Jardim encantado artesanal — Unikos da Oficina com theme.sceneType='fairy' (ex.: Rainha das Fadas) */}
                    {isCustomCard && !cardBgVideo && uni?.theme?.sceneType === 'fairy' && (
                      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1, borderRadius:20 }}>
                        <FairyScene />
                      </div>
                    )}

                    {/* Colagem SOUR artesanal — Uniko Olivia Rodrigo. `dark` deixa o
                        fundo do card ROXO ESCURO (não preto), com flores/borboletas/
                        arco-íris por cima. */}
                    {isCustomCard && !cardBgVideo && uni?.theme?.sceneType === 'olivia' && (
                      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1, borderRadius:20 }}>
                        <OliviaScene dark />
                      </div>
                    )}

                    <div style={{ position:'relative', zIndex:2 }}>
                      <UnikoMascot
                        track={currentSong ? { name: currentSong.title, artist: currentSong.artist } : null}
                        colors={festColors}
                        size={isMobile?110:160}
                        songSkin={songSkin}
                      />
                    </div>
                  </div>

                  {/* Descrição do Uniko especial abaixo do card */}
                  {isVampCard && currentSong?.requested_by && (() => {
                    const firstName = (currentSong.requested_by || '').trim().split(/\s+/)[0];
                    const fem = guessGender(firstName) === 'f';
                    const title = fem ? 'da poderosa Condessa' : 'do poderoso Conde';
                    return (
                    <div style={{ display:'flex', justifyContent:'center', marginTop:10, width:'100%' }}>
                      <div style={{
                        display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center', gap:'2px 7px',
                        padding:'7px 14px', borderRadius:14,
                        background:'linear-gradient(135deg,#1c0309,#3a0a14 70%,#1c0309)',
                        border:'1px solid #c41e3a66',
                        boxShadow:'0 0 16px #c41e3a30, inset 0 0 10px #c41e3a18',
                        maxWidth:'100%', textAlign:'center', lineHeight:1.35,
                      }}>
                        <span style={{fontSize:13, filter:'drop-shadow(0 0 4px #c41e3a)'}}>🦇</span>
                        <span style={{fontSize:11.5, fontWeight:800, letterSpacing:'.04em', color:'#fff', textShadow:'0 0 8px #c41e3aaa'}}>
                          {(skin?.name || '').replace(/^Uniko\s*/i, '').replace(/-/g, ' ')}
                        </span>
                        <span style={{fontSize:10.5, fontWeight:500, color:'#e0a8b6'}}>
                          {title}{' '}
                          <b style={{color:'#ff6b86', fontWeight:800}}>{firstName}</b>!
                        </span>
                      </div>
                    </div>
                    );
                  })()}

                  {isSeaCard && currentSong?.requested_by && (() => {
                    const firstName = (currentSong.requested_by || '').trim().split(/\s+/)[0];
                    const fem = guessGender(firstName) === 'f';
                    const title = fem ? 'da encantadora Sereia' : 'do encantador Tritão';
                    return (
                    <div style={{ display:'flex', justifyContent:'center', marginTop:10, width:'100%' }}>
                      <div style={{
                        display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center', gap:'2px 7px',
                        padding:'7px 14px', borderRadius:14,
                        background:'linear-gradient(135deg,#031c22,#0a3742 70%,#031c22)',
                        border:'1px solid #2dd4bf66',
                        boxShadow:'0 0 16px #2dd4bf30, inset 0 0 10px #2dd4bf18',
                        maxWidth:'100%', textAlign:'center', lineHeight:1.35,
                      }}>
                        <span style={{fontSize:13, filter:'drop-shadow(0 0 4px #2dd4bf)'}}>🧜‍♀️</span>
                        <span style={{fontSize:11.5, fontWeight:800, letterSpacing:'.04em', color:'#fff', textShadow:'0 0 8px #2dd4bfaa'}}>
                          {(skin?.name || '').replace(/^Uniko\s*/i, '').replace(/-/g, ' ')}
                        </span>
                        <span style={{fontSize:10.5, fontWeight:500, color:'#a8e6e0'}}>
                          {title}{' '}
                          <b style={{color:'#7ee8fa', fontWeight:800}}>{firstName}</b>!
                        </span>
                      </div>
                    </div>
                    );
                  })()}
                </div>);
              })()}

              {/* Ver Letra */}
              <div style={{width:"100%",display:"flex",flexDirection:"column",gap:10}}>
              {/* Prévia da letra — linha sincronizada, sempre visível */}
              <div style={{
                borderRadius:16, overflow:"hidden", position:"relative", height:150,
                boxShadow:`0 6px 24px ${festColors?.[0]||T.gold}33, 0 0 0 1px ${festColors?.[0]||T.gold}33`,
                border:`1px solid ${festColors?.[0]||T.gold}44`,
              }}>
                <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden"}}>
                  <div style={{position:"absolute",inset:0,background:isDark
                    ? `linear-gradient(160deg,${festColors?.[0]||"#1a0533"}cc,${festColors?.[1]||"#0a1a40"}cc,${festColors?.[2]||"#001a20"}cc)`
                    : `linear-gradient(160deg,${festColors?.[0]||"#6600cc"}33,${festColors?.[1]||"#003399"}22,${festColors?.[2]||"#003322"}22)`}}/>
                  <div style={{position:"absolute",width:160,height:160,borderRadius:"50%",
                    background:festColors?.[0]||"#ff6b6b",filter:"blur(50px)",opacity:0.6,
                    top:"-40px",left:"-30px",animation:"lyricsBlob1 7s ease-in-out infinite alternate"}}/>
                  <div style={{position:"absolute",width:140,height:140,borderRadius:"50%",
                    background:festColors?.[1]||"#4ecdc4",filter:"blur(45px)",opacity:0.55,
                    bottom:"-30px",right:"-20px",animation:"lyricsBlob2 9s ease-in-out infinite alternate"}}/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.3) 0%,transparent 40%,transparent 60%,rgba(0,0,0,0.35) 100%)"}}/>
                </div>
                <div style={{position:"relative",zIndex:1,height:"100%",display:"flex",flexDirection:"column",padding:"10px 14px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    <span style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.85)",textTransform:"uppercase",letterSpacing:".1em"}}>Letra</span>
                  </div>
                  <div style={{flex:1,position:"relative",width:"100%",overflow:"hidden",
                    WebkitMaskImage:"linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent)",
                    maskImage:"linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent)"}}>
                    {lyricsLoading ? (
                      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:11.5,color:"rgba(255,255,255,0.6)"}}>Buscando letra...</span>
                      </div>
                    ) : lyricsError || !lyrics.length ? (
                      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>Letra não encontrada</span>
                      </div>
                    ) : (
                      // Mini-karaokê: TODAS as linhas no DOM (não só 3 que trocam de
                      // texto) — assim cada uma transiciona de estilo pelo CSS e o
                      // container desliza suave, igualzinho à letra inteira. Os
                      // espaçadores de 50% deixam a 1ª/última linha centralizarem.
                      <div ref={lyricsPreviewRef} style={{position:"absolute",inset:0,overflow:"hidden"}}>
                        <div style={{height:"50%"}}/>
                        {lyrics.map((line,i)=>(
                          <div key={i} data-pline={i} style={{
                            padding:"3px 12px",textAlign:"center",
                            fontSize:i===activeLine?16:11,
                            fontWeight:i===activeLine?800:400,
                            color:i===activeLine?"#fff":(i<activeLine?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.5)"),
                            lineHeight:1.3,
                            textShadow:i===activeLine?`0 0 24px rgba(255,255,255,0.85), 0 0 10px ${festColors?.[0]||"#fff"}cc`:"none",
                            transition:"all .35s ease",
                          }}>{line.text||"♪"}</div>
                        ))}
                        <div style={{height:"50%"}}/>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ver letra inteira — expande o painel completo */}
              <button onClick={()=>setShowLyrics(v=>!v)}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px 0",borderRadius:12,
                  border:`1.5px solid ${showLyrics ? T.gold : (isDark?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.18)")}`,
                  background:showLyrics
                    ? `linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`
                    : (isDark?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.07)"),
                  color:showLyrics?"#fff":(isDark?"rgba(255,255,255,0.85)":"rgba(0,0,0,0.75)"),
                  cursor:"pointer",fontSize:12,fontWeight:700,outline:"none",transition:"all .2s",width:"100%",
                  boxShadow:showLyrics?`0 4px 16px ${T.goldLine}55`:"none",
                  letterSpacing:".02em"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">{showLyrics
                  ? <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>
                  : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>}</svg>
                {showLyrics ? "Fechar letra inteira" : "Ver letra inteira"}
              </button>

              {/* Painel de Letra completo */}
              {showLyrics && (
                <div style={{
                  borderRadius:20,
                  overflow:"hidden",
                  position:"relative",
                  height:620,
                  boxShadow:`0 8px 40px ${festColors?.[0]||T.gold}44, 0 0 0 1px ${festColors?.[0]||T.gold}33`,
                  border:`1px solid ${festColors?.[0]||T.gold}44`,
                }}>
                  {/* ── Fundo animado com blobs das cores do álbum ── */}
                  <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden",borderRadius:20}}>
                    {/* Base escura */}
                    <div style={{position:"absolute",inset:0,background:isDark
                      ? `linear-gradient(160deg,${festColors?.[0]||"#1a0533"}cc,${festColors?.[1]||"#0a1a40"}cc,${festColors?.[2]||"#001a20"}cc)`
                      : `linear-gradient(160deg,${festColors?.[0]||"#6600cc"}33,${festColors?.[1]||"#003399"}22,${festColors?.[2]||"#003322"}22)`,
                      backdropFilter:"blur(0px)"}}/>
                    {/* Blob 1 */}
                    <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",
                      background:festColors?.[0]||"#ff6b6b",filter:"blur(60px)",opacity:0.7,
                      top:"-30px",left:"-40px",animation:"lyricsBlob1 7s ease-in-out infinite alternate"}}/>
                    {/* Blob 2 */}
                    <div style={{position:"absolute",width:180,height:180,borderRadius:"50%",
                      background:festColors?.[1]||"#4ecdc4",filter:"blur(55px)",opacity:0.65,
                      bottom:"10%",right:"-20px",animation:"lyricsBlob2 9s ease-in-out infinite alternate"}}/>
                    {/* Blob 3 */}
                    <div style={{position:"absolute",width:150,height:150,borderRadius:"50%",
                      background:festColors?.[2]||"#45b7d1",filter:"blur(50px)",opacity:0.6,
                      top:"40%",left:"30%",animation:"lyricsBlob3 11s ease-in-out infinite alternate"}}/>
                    {/* Blob 4 — extra intensidade */}
                    <div style={{position:"absolute",width:120,height:120,borderRadius:"50%",
                      background:festColors?.[0]||"#f093fb",filter:"blur(45px)",opacity:0.5,
                      bottom:"30%",left:"-10px",animation:"lyricsBlob1 8s ease-in-out infinite alternate-reverse"}}/>
                    {/* Overlay escuro no topo e base para legibilidade */}
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,transparent 20%,transparent 80%,rgba(0,0,0,0.35) 100%)"}}/>
                  </div>

                  {/* Header da letra */}
                  <div style={{position:"relative",zIndex:1,padding:"16px 18px 10px",borderBottom:"1px solid rgba(255,255,255,0.12)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.9)",textTransform:"uppercase",letterSpacing:".1em"}}>Letra</span>
                    </div>
                    {currentSong && (
                      <div style={{marginTop:4,fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {currentSong.title} — {currentSong.artist}
                      </div>
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div ref={lyricsRef}
                    style={{position:"relative",zIndex:1,height:"calc(100% - 68px)",overflowY:"auto",padding:"0 20px",
                      msOverflowStyle:"none",scrollbarWidth:"none"}}>
                    {lyricsLoading ? (
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12}}>
                        <div style={{width:28,height:28,borderRadius:"50%",border:"2.5px solid rgba(255,255,255,0.8)",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                        <span style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>Buscando letra...</span>
                      </div>
                    ) : lyricsError || !lyrics.length ? (
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:8}}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Letra não encontrada</span>
                      </div>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",gap:2,paddingBottom:80}}>
                        <div style={{height:100}}/>
                        {lyrics.map((line, i) => (
                          <div key={i} data-line={i}
                            style={{
                              padding:"4px 0",
                              fontSize: i===activeLine ? 19 : 15,
                              fontWeight: i===activeLine ? 800 : 400,
                              color: i===activeLine
                                ? "#fff"
                                : i < activeLine
                                  ? "rgba(255,255,255,0.28)"
                                  : "rgba(255,255,255,0.55)",
                              lineHeight: 1.45,
                              transition:"all .35s ease",
                              letterSpacing: i===activeLine ? ".01em" : "normal",
                              textShadow: i===activeLine
                                ? `0 0 30px rgba(255,255,255,0.9), 0 0 12px ${festColors?.[0]||"#fff"}cc`
                                : "none",
                            }}>
                            {line.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Right: Search bar + Queue */}
            <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:16}}>

              {/* Server error message */}
              {serverMsg&&(
                <div style={{padding:"10px 14px",borderRadius:10,background:"rgba(192,64,80,0.07)",border:"1px solid rgba(192,64,80,0.25)",fontSize:12,color:"#C04050"}}>
                  ⚠️ {serverMsg}
                </div>
              )}

              {/* Search Bar */}
              <div style={{borderRadius:18,background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,padding:"20px 24px",boxShadow:T.shM,position:"relative",overflow:"visible",zIndex:10}}>
                <div style={{position:"absolute",width:100,height:100,borderRadius:"50%",background:T.gold,filter:"blur(35px)",opacity:0.07,top:"-20px",right:"10%",animation:"hdrBlob1 5s ease-in-out infinite"}}/>
                <div style={{fontSize:11,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:".10em",marginBottom:12,position:"relative",zIndex:1}}>Pesquisar música</div>
                <div style={{position:"relative",zIndex:2}}>
                  <div style={{
                    display:"flex",alignItems:"center",gap:12,
                    padding:"14px 18px",borderRadius:14,
                    border:`2px solid ${voiceFocus?T.gold:T.border}`,
                    background:isDark?T.surfaceSub||"rgba(255,255,255,0.04)":T.surface||"white",
                    boxShadow:voiceFocus?`0 0 0 4px ${T.goldLine}33,0 0 24px ${T.gold}22`:"0 2px 8px rgba(0,0,0,0.04)",
                    transition:"all .2s ease",
                  }}>
                    <div style={{width:32,height:32,borderRadius:9,flexShrink:0,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 3px 10px ${T.goldLine}44`}}>
                      {isSearching
                        ? <div style={{width:14,height:14,borderRadius:"50%",border:"2px solid white",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      }
                    </div>
                    <input
                      value={voiceVal}
                      onChange={e=>handleSearch(e.target.value)}
                      onFocus={()=>setVoiceFocus(true)}
                      onBlur={()=>setTimeout(()=>setVoiceFocus(false),200)}
                      placeholder="Shape of You, Waka Waka, Anti-Hero..."
                      style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:15,color:T.text,fontFamily:"var(--font-body)",caretColor:T.gold,fontWeight:voiceVal?500:400}}/>
                    {voiceVal&&(
                      <button onClick={()=>{setVoiceVal('');setSearchResults([]);}}
                        style={{padding:"4px 8px",borderRadius:6,border:"none",cursor:"pointer",color:T.textD,background:"transparent",fontSize:16,lineHeight:1,outline:"none"}}>×</button>
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {searchResults.length>0&&(
                    <div style={{position:isMobile?"fixed":"absolute",
                      top:isMobile?"auto":"calc(100% + 6px)",
                      bottom:isMobile?"70px":undefined,
                      left:isMobile?12:"0",right:isMobile?12:"0",
                      borderRadius:14,background:isDark?T.surface:"white",
                      border:`1px solid ${T.border}`,boxShadow:T.shL,
                      overflow:"hidden",zIndex:500,
                      maxHeight:isMobile?"55vh":"auto",overflowY:isMobile?"auto":"hidden"}}>
                      {searchResults.map(t=>(
                        <div key={t.id} onClick={()=>addToQueue(t)}
                          style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${T.divider}`,transition:"background .12s"}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          {t.album_art
                            ? <img src={t.album_art} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                            : <div style={{width:40,height:40,borderRadius:8,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎵</div>
                          }
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                            <div style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.artist}</div>
                          </div>
                          <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:10,color:T.textD}}>{t.duration_str}</span>
                            {isAdding===t.id
                              ? <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                              : <div style={{width:24,height:24,borderRadius:6,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                </div>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Name display — usa nome real do usuário logado */}
                <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8,position:"relative",zIndex:1}}>
                  <span style={{fontSize:11,color:T.textD}}>Pedindo como:</span>
                  <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:6,background:T.goldGl,border:`1px solid ${T.goldLine}33`}}>
                    <span style={{fontSize:11,fontWeight:600,color:T.gold}}>{myName}</span>
                  </div>
                </div>
              </div>

              {/* Queue */}
              <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:T.sh}}>
                <div style={{padding:"13px 20px",borderBottom:`1px solid ${T.border}`,background:`linear-gradient(135deg,${T.goldGl},transparent)`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                  <div style={{fontFamily:"var(--font-brand)",fontSize:14,fontWeight:700,color:T.text,flexShrink:0}}>Fila Democrática</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    {/* Contador de limite para colaboradores */}
                    {!isAdmin && (() => {
                      const myActive = queue.filter(s => s.requested_by === myName && ['pending','playing'].includes(s.status)).length;
                      const remaining = 2 - myActive;
                      return (
                        <span style={{
                          fontSize:10, fontWeight:600,
                          color: remaining===0 ? "#C04050" : remaining===1 ? "#E08030" : T.gold,
                          background: remaining===0 ? "rgba(192,64,80,0.08)" : remaining===1 ? "rgba(224,128,48,0.08)" : T.goldGl,
                          border: `1px solid ${remaining===0 ? "rgba(192,64,80,0.3)" : remaining===1 ? "rgba(224,128,48,0.3)" : T.goldLine+"44"}`,
                          padding:"2px 7px", borderRadius:5,
                        }}>
                          {remaining===0 ? "⛔ Limite atingido" : `🎵 ${remaining} vaga${remaining===1?"":"s"}`}
                        </span>
                      );
                    })()}
                    <span style={{fontSize:11,color:T.textT}}>
                      {queue.length} {queue.length===1?"música":"músicas"}
                      {queue.length > 0 && (() => {
                        const totalMs = queue.reduce((acc, s) => acc + (s.duration_ms || 0), 0);
                        const totalMin = Math.round(totalMs / 60000);
                        const h = Math.floor(totalMin / 60);
                        const m = totalMin % 60;
                        const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
                        return ` · ${dur}`;
                      })()}
                    </span>
                    {/* Botão Limpar Fila — somente admin */}
                    {isAdmin && queue.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!window.confirm('Limpar toda a fila? Esta ação não pode ser desfeita.')) return;
                          // Tenta via servidor; independente do resultado, limpa direto no Supabase
                          api('delete', '/api/queue').catch(() => {});
                          await _supabase.from('queue').update({ status: 'removed' }).in('status', ['pending', 'playing']);
                          await _supabase.from('player_state').upsert({ id: 1, is_playing: false, current_song_id: null, current_spotify_id: null, updated_at: new Date().toISOString() });
                          loadQueue();
                          loadPlayerState();
                        }}
                        title="Limpar fila (Admin)"
                        style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,
                          border:"1.5px solid rgba(192,64,80,0.4)",background:"rgba(192,64,80,0.06)",
                          color:"#C04050",cursor:"pointer",fontSize:10,fontWeight:700,outline:"none",
                          transition:"all .15s",flexShrink:0}}
                        onMouseEnter={e=>{e.currentTarget.style.background="rgba(192,64,80,0.14)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="rgba(192,64,80,0.06)";}}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        Limpar Fila
                      </button>
                    )}
                  </div>
                </div>
                {festLoading
                  ? <div style={{padding:"32px",textAlign:"center",color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite",margin:"0 auto 8px"}}/>
                      Carregando fila...
                    </div>
                  : queue.length===0
                    ? <div style={{padding:"32px",textAlign:"center",color:T.textT,fontSize:13}}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.5" strokeLinecap="round" style={{margin:"0 auto 8px",display:"block"}}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        Fila vazia! Pesquise uma música acima.
                      </div>
                    : (() => {
                      const sorted = [...queue].sort((a,b)=>{
                        if (a.status==='playing' && b.status!=='playing') return -1;
                        if (a.status!=='playing' && b.status==='playing') return 1;
                        return (a.position||0) - (b.position||0);
                      });
                      const playingSong = sorted.find(s => s.status==='playing');
                      const pending     = sorted.filter(s => s.status!=='playing');

                      const renderRow = (s, idx, isNowPlaying) => {
                        const votes     = skipVotes[s.id]||0;
                        const iAmPlaying = isNowPlaying;
                        const voted     = myVotedSongs.has(s.id);
                        const isMyOwn   = s.requested_by === myName;
                        const canDelete = (isMyOwn || isAdmin) && !iAmPlaying;
                        // Admin pode reordenar músicas pending (não a que está tocando)
                        const canReorder = isAdmin && !iAmPlaying && pending.length > 1;
                        const isFirst    = idx === 0;
                        const isLast     = idx === pending.length - 1;
                        return (
                          <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderTop:idx===0?"none":`1px solid ${T.border}`,background:iAmPlaying?T.goldGl:"transparent",transition:"background .15s"}}>
                            {/* EQ / número */}
                            <div style={{width:22,textAlign:"center",flexShrink:0}}>
                              {iAmPlaying
                                ? <div style={{display:"flex",alignItems:"flex-end",gap:1,height:14,justifyContent:"center"}}>
                                    {[1,2,3].map(j=><div key={j} style={{width:2,borderRadius:1,background:T.gold,animation:`alexaEq${j} ${0.4+j*0.1}s ease-in-out infinite alternate`,minHeight:3}}/>)}
                                  </div>
                                : <span style={{fontSize:11,color:T.textD}}>{idx+1}</span>
                              }
                            </div>
                            {/* Capa */}
                            {s.album_art
                              ? <img src={s.album_art} alt="" style={{width:iAmPlaying?44:36,height:iAmPlaying?44:36,borderRadius:iAmPlaying?9:7,objectFit:"cover",flexShrink:0,boxShadow:iAmPlaying?`0 4px 16px ${T.goldLine}44`:"none",transition:"all .2s"}}/>
                              : <div style={{width:iAmPlaying?44:36,height:iAmPlaying?44:36,borderRadius:iAmPlaying?9:7,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎵</div>
                            }
                            {/* Título + artista */}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:iAmPlaying?14:13,fontWeight:iAmPlaying?700:500,color:iAmPlaying?T.gold:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</div>
                              <div style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.artist}</div>
                            </div>
                            {/* Pedido por */}
                            {(()=>{
                              const rb = (s.requested_by||'').trim().toLowerCase();
                              const isSystem = !rb || rb.includes('autoplay') || rb.includes('sistema') || rb.includes('uniko') || rb.includes('alexa');
                              return (
                                <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
                                  {isSystem
                                    ? <img src="/UNIKO_FRENTE_FRONTAL.png" alt="Uniko" style={{width:30,height:30,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                                    : <QueueAvatar
                                        name={s.requested_by}
                                        photo={s.requested_by===myName ? myPhoto : photoCache[s.requested_by]}
                                        onExpand={setExpandedPhoto}
                                      />
                                  }
                                  <span style={{fontSize:11,color:T.textT,maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                    {isSystem ? 'Uniko' : s.requested_by}
                                  </span>
                                </div>
                              );
                            })()}
                            {/* Skip — temporariamente apenas admin */}
                            {iAmPlaying && isAdmin && (
                              <button onClick={()=>handleVote(s)} title="Pular (Admin)"
                                style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:6,border:`1.5px solid ${T.gold}55`,background:T.goldGl,color:T.gold,cursor:"pointer",fontSize:11,fontWeight:700,outline:"none",transition:"all .15s"}}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                                Pular
                              </button>
                            )}
                            {/* Reordenar fila (Admin) */}
                            {canReorder && (
                              <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
                                <button onClick={()=>moveSong(s,-1)} disabled={isFirst||!!movingId}
                                  title="Subir na fila (Admin)"
                                  style={{display:"flex",alignItems:"center",justifyContent:"center",width:22,height:13,borderRadius:5,border:`1px solid ${T.border}`,background:"transparent",color:T.textD,cursor:(isFirst||movingId)?"default":"pointer",outline:"none",padding:0,opacity:(isFirst||movingId)?0.25:0.7,transition:"opacity .15s"}}
                                  onMouseEnter={e=>{ if(!isFirst&&!movingId){e.currentTarget.style.opacity="1";e.currentTarget.style.borderColor=`${T.gold}66`;e.currentTarget.style.color=T.gold;} }}
                                  onMouseLeave={e=>{ if(!isFirst&&!movingId){e.currentTarget.style.opacity="0.7";e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textD;} }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                                </button>
                                <button onClick={()=>moveSong(s,1)} disabled={isLast||!!movingId}
                                  title="Descer na fila (Admin)"
                                  style={{display:"flex",alignItems:"center",justifyContent:"center",width:22,height:13,borderRadius:5,border:`1px solid ${T.border}`,background:"transparent",color:T.textD,cursor:(isLast||movingId)?"default":"pointer",outline:"none",padding:0,opacity:(isLast||movingId)?0.25:0.7,transition:"opacity .15s"}}
                                  onMouseEnter={e=>{ if(!isLast&&!movingId){e.currentTarget.style.opacity="1";e.currentTarget.style.borderColor=`${T.gold}66`;e.currentTarget.style.color=T.gold;} }}
                                  onMouseLeave={e=>{ if(!isLast&&!movingId){e.currentTarget.style.opacity="0.7";e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textD;} }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                              </div>
                            )}
                            {/* Substituir música — própria, ou de qualquer uma se Admin */}
                            {canDelete && (
                              <button onClick={()=>openReplace(s)}
                                title={isMyOwn ? "Substituir minha música" : "Substituir música (Admin)"}
                                style={{display:"flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:6,border:`1.5px solid ${T.border}`,background:"transparent",color:T.textD,cursor:"pointer",outline:"none",flexShrink:0,opacity:0.7,transition:"opacity .15s"}}
                                onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.borderColor=`${T.gold}66`;e.currentTarget.style.color=T.gold;}}
                                onMouseLeave={e=>{e.currentTarget.style.opacity="0.7";e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textD;}}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                              </button>
                            )}
                            {/* Deletar música — própria, ou de qualquer um se Admin */}
                            {canDelete && (
                              <button onClick={async()=>{ await api('delete',`/api/queue/${s.id}`); loadQueue(); }}
                                title={isMyOwn ? "Remover minha música" : "Remover música (Admin)"}
                                style={{display:"flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:6,border:`1.5px solid ${T.border}`,background:"transparent",color:T.textD,cursor:"pointer",outline:"none",flexShrink:0,opacity:0.7,transition:"opacity .15s"}}
                                onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.borderColor="rgba(192,64,80,0.4)";e.currentTarget.style.color="#C04050";}}
                                onMouseLeave={e=>{e.currentTarget.style.opacity="0.7";e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textD;}}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              </button>
                            )}
                            <span style={{fontSize:10,color:T.textD,minWidth:28,textAlign:"right"}}>{s.duration_str||"—"}</span>
                          </div>
                        );
                      };

                      return (
                        <>
                          {/* ── Tocando Agora ── */}
                          {playingSong && (
                            <>
                              <div style={{padding:"8px 16px 6px",display:"flex",alignItems:"center",gap:6,borderBottom:`1px solid ${T.border}`}}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill={T.gold} stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                <span style={{fontSize:10,fontWeight:700,color:T.gold,textTransform:"uppercase",letterSpacing:".08em"}}>Tocando Agora</span>
                              </div>
                              {renderRow(playingSong, 0, true)}
                            </>
                          )}

                          {/* ── A Seguir ── */}
                          {pending.length > 0 && (
                            <>
                              <div style={{padding:"8px 16px 6px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,background:isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)"}}>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                                  <span style={{fontSize:10,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:".08em"}}>A Seguir — {pending.length} {pending.length===1?"música":"músicas"}</span>
                                </div>
                                <span style={{fontSize:10,color:T.textT}}>{VETO} votos = skip automático</span>
                              </div>
                              {pending.map((s,i)=>renderRow(s, i, false))}
                            </>
                          )}

                          {/* Fila sem nenhuma música a seguir */}
                          {!playingSong && pending.length===0 && (
                            <div style={{padding:"32px",textAlign:"center",color:T.textT,fontSize:13}}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.5" strokeLinecap="round" style={{margin:"0 auto 8px",display:"block"}}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                              Fila vazia! Pesquise uma música acima.
                            </div>
                          )}
                        </>
                      );
                    })()
                }
              </div>
            </div>

            {/* Right: Tocando Agora */}
            <div style={{width:isMobile?"100%":300,flexShrink:0}}>
              {/* Player controls */}
              <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1px solid ${T.border}`,padding:"16px 20px",boxShadow:T.sh,
                flex:isMobile?"1 1 0":undefined,minWidth:isMobile?0:undefined}}>
                {/* Spotify connect banner — só mostra após verificar */}
                {spotifyChecked&&!spotifyOk&&(
                  <div style={{marginBottom:12,padding:"10px 14px",borderRadius:10,background:`rgba(192,64,80,0.06)`,border:`1px solid rgba(192,64,80,0.2)`,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11}}>⚠️</span>
                    <span style={{fontSize:11,color:"#C04050",flex:1}}>Spotify desconectado</span>
                    <a href={`${SERVER_URL}/login`} target="_blank" rel="noreferrer"
                      style={{fontSize:11,fontWeight:700,color:"#1DB954",textDecoration:"none",padding:"3px 9px",borderRadius:6,background:"rgba(29,185,84,0.1)",border:"1px solid rgba(29,185,84,0.3)"}}>
                      Conectar ↗
                    </a>
                  </div>
                )}
                <div style={{fontSize:11,color:T.textD,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>▶ Tocando Agora</div>
                {cur
                  ? <>
                      {cur.album_art&&(
                        <div style={{width:"100%",aspectRatio:"1/1",borderRadius:12,overflow:"hidden",marginBottom:12,boxShadow:`0 8px 24px rgba(0,0,0,0.2)`}}>
                          <img src={cur.album_art} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                        </div>
                      )}
                      <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur.title}</div>
                      <div style={{fontSize:13,color:T.textS,marginBottom:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur.artist}</div>
                      {/* ── Barra de progresso — arrastável só pro admin ── */}
                      {cur.duration_ms > 0 && (
                        <div style={{marginBottom:10}}>
                          <BarraProgresso progressMs={progressMs} durationMs={cur.duration_ms}
                            cores={festColors} onSeek={isAdmin ? seekTo : undefined} />
                          {isAdmin && seekMsg && (
                            <div style={{fontSize:10.5,color:"#E63946",fontWeight:700,marginTop:4}}>{seekMsg}</div>
                          )}
                        </div>
                      )}
                    </>
                  : <div style={{fontSize:13,color:T.textT,marginBottom:12,textAlign:"center",padding:"24px 0"}}>
                      <div style={{fontSize:32,marginBottom:8}}>🎵</div>
                      Nenhuma música tocando
                    </div>
                }
                {/* Controls — play/pause somente admin */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:10}}>
                  {isAdmin
                    ? <button onClick={handlePlayPause} disabled={!spotifyOk}
                        style={{width:46,height:46,borderRadius:12,border:"none",
                          background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
                          cursor:spotifyOk?"pointer":"not-allowed",color:"white",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          outline:"none",boxShadow:`0 4px 16px ${T.goldLine}55`,opacity:spotifyOk?1:0.5}}>
                        {isPlaying
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                      </button>
                    : /* Colaborador: exibe indicador de status sem botão */
                      <div style={{width:46,height:46,borderRadius:12,background:isPlaying?`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`:`${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",opacity:0.5}}>
                        {isPlaying
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill={T.textD} stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                      </div>
                  }
                  {/* Toggle do videoclipe — visível a todos (preferência local) */}
                  <button onClick={toggleVideo}
                    title={videoEnabled
                      ? (currentSong && clipVideoId ? "Ocultar videoclipe"
                          : (currentSong ? "Sem clipe pra esta música" : "Mostrar videoclipe"))
                      : "Mostrar videoclipe"}
                    style={{width:36,height:36,borderRadius:9,
                      border:`1px solid ${videoEnabled ? T.gold+'66' : T.border}`,
                      background:videoEnabled ? T.goldGl : "transparent",
                      cursor:"pointer",color:videoEnabled ? T.gold : T.textS,
                      display:"flex",alignItems:"center",justifyContent:"center",outline:"none",
                      transition:"all .15s"}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  </button>
                  {canControl && (
                  <button onClick={handleNext} disabled={!spotifyOk||queue.length<2}
                    title="Pular música"
                    style={{width:36,height:36,borderRadius:9,border:`1px solid ${T.border}`,background:"transparent",cursor:(spotifyOk&&queue.length>=2)?"pointer":"not-allowed",color:T.textS,display:"flex",alignItems:"center",justifyContent:"center",outline:"none",opacity:(spotifyOk&&queue.length>=2)?1:0.4}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                  </button>
                  )}
                  {isAdmin && (
                  <button onClick={handleToggleAutoplay}
                    title={autoplayEnabled
                      ? "Desativar autoplay (Admin) — hoje ele puxa as mais tocadas da Máquina do Tempo"
                      : "Ativar autoplay (Admin) — toca as mais tocadas da Máquina do Tempo quando a fila esvazia"}
                    style={{width:36,height:36,borderRadius:9,
                      border:`1px solid ${autoplayEnabled ? T.gold+'66' : T.border}`,
                      background:autoplayEnabled ? T.goldGl : "transparent",
                      cursor:"pointer",color:autoplayEnabled ? T.gold : T.textS,
                      display:"flex",alignItems:"center",justifyContent:"center",outline:"none",
                      transition:"all .15s"}}>
                    {autoplayEnabled
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/><polyline points="19 3 19 21"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v6m0-6L5 3m4 6l10 6m0 0l4 3M19 3v5"/></svg>
                    }
                  </button>
                  )}
                  {isAdmin && (
                  <button onClick={handleLoadDevices} disabled={!spotifyOk} title="Selecionar dispositivo (Admin)"
                    style={{width:36,height:36,borderRadius:9,border:`1px solid ${T.border}`,background:"transparent",cursor:spotifyOk?"pointer":"not-allowed",color:T.textS,display:"flex",alignItems:"center",justifyContent:"center",outline:"none",opacity:spotifyOk?1:0.4}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  </button>
                  )}
                </div>
                {/* Volume — admin e moderador */}
                {canControl && (
                  <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:8,borderTop:`1px solid ${T.border}22`}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={volume===0?"#C04050":T.textD} strokeWidth="2" strokeLinecap="round"
                      onClick={()=>handleVolume(volume===0?50:0)} style={{cursor:"pointer",flexShrink:0}}>
                      {volume===0
                        ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                        : volume<50
                          ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                          : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                      }
                    </svg>
                    <input type="range" min="0" max="100" value={volume}
                      onChange={e=>handleVolume(Number(e.target.value))}
                      disabled={!spotifyOk}
                      style={{flex:1,accentColor:T.gold,height:3,cursor:spotifyOk?"pointer":"not-allowed",opacity:spotifyOk?1:0.4}}
                    />
                    <span style={{fontSize:10,color:T.textD,minWidth:24,textAlign:"right",opacity:volumeSaving?0.5:1}}>
                      {volume}%
                    </span>
                  </div>
                )}
                {/* Device selector */}
                {showDevices&&(
                  <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:4}}>
                    <div style={{fontSize:10,fontWeight:600,color:T.textD,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Dispositivos</div>
                    {devices.length===0
                      ? <div style={{fontSize:11,color:T.textT}}>Nenhum dispositivo ativo no Spotify</div>
                      : devices.map(d=>(
                          <div key={d.id} onClick={()=>selectDevice(d.id)}
                            style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,cursor:"pointer",background:d.is_active?T.goldGl:"transparent",border:`1px solid ${d.is_active?T.goldLine+"44":T.border}`,marginBottom:4}}>
                            <span style={{fontSize:13}}>{d.type==='Speaker'?'🔊':d.type==='Computer'?'💻':'📱'}</span>
                            <span style={{fontSize:12,fontWeight:d.is_active?700:400,color:d.is_active?T.gold:T.text,flex:1}}>{d.name}</span>
                            {d.is_active&&<span style={{fontSize:9,color:T.gold,fontWeight:700}}>ATIVO</span>}
                          </div>
                        ))
                    }
                    <button onClick={()=>setShowDevices(false)} style={{width:"100%",marginTop:4,padding:"5px",borderRadius:7,border:`1px solid ${T.border}`,background:"transparent",cursor:"pointer",color:T.textD,fontSize:11,outline:"none"}}>Fechar</button>
                  </div>
                )}
              </div>
            </div>

          </div>
          </div>
        )}

        {/* ══════════ PLAYLIST TAB ══════════ */}
        {tab==="playlist"&&(
          <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",gap:16}}>
            {serverMsg&&(
              <div style={{padding:"10px 14px",borderRadius:10,background:"rgba(192,64,80,0.07)",border:"1px solid rgba(192,64,80,0.25)",fontSize:12,color:"#C04050"}}>
                ⚠️ {serverMsg}
              </div>
            )}

            {/* ── Visão de biblioteca (lista de cards + busca) ── */}
            {!plOpenId&&(<>
              <div style={{borderRadius:18,background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,padding:"20px 24px",boxShadow:T.shM}}>
                <div style={{fontSize:11,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:".10em",marginBottom:12}}>Adicionar à biblioteca</div>
                <div style={{display:"flex",gap:10,flexWrap:isMobile?"wrap":"nowrap"}}>
                  <input
                    value={plLinkVal}
                    onChange={e=>setPlLinkVal(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') addPlaylistToLibrary(); }}
                    placeholder="Cole o link da playlist do Spotify..."
                    style={{flex:1,minWidth:0,padding:"12px 16px",borderRadius:12,border:`2px solid ${T.border}`,background:isDark?T.surfaceSub||"rgba(255,255,255,0.04)":T.surface||"white",color:T.text,fontSize:14,fontFamily:"var(--font-body)",outline:"none"}}/>
                  <button onClick={addPlaylistToLibrary} disabled={plAdding||!plLinkVal.trim()}
                    style={{padding:"0 20px",borderRadius:12,border:"none",cursor:plAdding?"default":"pointer",
                      background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:"white",fontWeight:700,fontSize:13,
                      fontFamily:"var(--font-body)",opacity:plLinkVal.trim()?1:0.5,flexShrink:0,outline:"none"}}>
                    {plAdding?"Adicionando...":"Adicionar"}
                  </button>
                </div>
                {plError&&(
                  <div style={{marginTop:12,padding:"10px 14px",borderRadius:10,background:"rgba(192,64,80,0.07)",border:"1px solid rgba(192,64,80,0.25)",fontSize:12,color:"#C04050"}}>
                    ⚠️ {plError}
                  </div>
                )}
              </div>

              <div style={{borderRadius:18,background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,padding:"20px 24px",boxShadow:T.shM}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:".10em",flex:1}}>Biblioteca de Playlists ({plLibrary.length})</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:10,border:`1.5px solid ${T.border}`,background:isDark?T.surfaceSub||"rgba(255,255,255,0.04)":T.surface||"white",minWidth:isMobile?"100%":240}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input value={plSearch} onChange={e=>setPlSearch(e.target.value)} placeholder="Buscar playlist..."
                      style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:13,color:T.text,fontFamily:"var(--font-body)"}}/>
                  </div>
                </div>

                {plLibLoading
                  ? <div style={{textAlign:"center",padding:"30px 0",color:T.textD,fontSize:13}}>Carregando biblioteca...</div>
                  : filteredLibrary.length===0
                    ? <div style={{textAlign:"center",padding:"30px 0",color:T.textD,fontSize:13}}>{plLibrary.length===0?"Nenhuma playlist adicionada ainda.":"Nenhuma playlist encontrada."}</div>
                    : (
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
                        {filteredLibrary.map(p=>{
                          const addedIsMe = p.added_by===myName;
                          return (
                            <div key={p.spotify_id} onClick={()=>openLibraryPlaylist(p.spotify_id)}
                              style={{position:"relative",borderRadius:14,border:`1px solid ${T.border}`,padding:14,cursor:"pointer",transition:"all .15s",background:isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)"}}
                              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.goldLine+"88";e.currentTarget.style.background=T.goldGl;}}
                              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)";}}>
                              {(isAdmin||auth?.role==='moderador')&&(
                                <button onClick={e=>{e.stopPropagation();removeFromLibrary(p.spotify_id);}}
                                  title="Remover da biblioteca"
                                  style={{position:"absolute",top:8,right:8,width:22,height:22,borderRadius:6,border:"none",cursor:"pointer",background:"rgba(0,0,0,0.35)",color:"#fff",fontSize:13,lineHeight:1,outline:"none",zIndex:2}}>×</button>
                              )}
                              {p.image
                                ? <img src={p.image} alt="" style={{width:"100%",aspectRatio:"1",borderRadius:10,objectFit:"cover",marginBottom:10}}/>
                                : <div style={{width:"100%",aspectRatio:"1",borderRadius:10,background:T.goldGl,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>🎵</div>
                              }
                              <div style={{fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{p.name}</div>
                              <div style={{fontSize:11,color:T.textD,marginBottom:10}}>{p.track_count||0} faixas</div>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <AvatarCircle name={p.added_by||'?'} photo={addedIsMe?myPhoto:photoCache[p.added_by]} size={20} fontSize={9} rounded="50%"/>
                                <span style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{addedIsMe?'Você':(p.added_by||'Colaborador')}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                }
              </div>
            </>)}

            {/* ── Visão de faixas de uma playlist aberta ── */}
            {plOpenId&&(
              <div style={{borderRadius:18,background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,padding:"20px 24px",boxShadow:T.shM}}>
                <button onClick={()=>{setPlOpenId(null);setPlData(null);setPlError("");}}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",cursor:"pointer",color:T.textS,fontSize:12,fontFamily:"var(--font-body)",marginBottom:16,outline:"none"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Voltar pra biblioteca
                </button>

                {plLoading
                  ? <div style={{textAlign:"center",padding:"30px 0",color:T.textD,fontSize:13}}>Carregando faixas...</div>
                  : plError
                    ? <div style={{padding:"10px 14px",borderRadius:10,background:"rgba(192,64,80,0.07)",border:"1px solid rgba(192,64,80,0.25)",fontSize:12,color:"#C04050"}}>⚠️ {plError}</div>
                    : plData&&(<>
                      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
                        {plData.image
                          ? <img src={plData.image} alt="" style={{width:56,height:56,borderRadius:10,objectFit:"cover",flexShrink:0}}/>
                          : <div style={{width:56,height:56,borderRadius:10,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🎵</div>
                        }
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:16,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{plData.name}</div>
                          <div style={{fontSize:12,color:T.textD}}>{plData.owner?`por ${plData.owner} · `:""}{plData.tracks.length} faixas</div>
                        </div>
                      </div>

                      <div style={{maxHeight:"60vh",overflowY:"auto"}}>
                        {plData.tracks.map(t=>(
                          <div key={t.id} onClick={()=>addToQueue(t)}
                            style={{display:"flex",alignItems:"center",gap:12,padding:"10px 8px",cursor:"pointer",borderBottom:`1px solid ${T.divider}`,transition:"background .12s"}}
                            onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            {t.album_art
                              ? <img src={t.album_art} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                              : <div style={{width:40,height:40,borderRadius:8,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎵</div>
                            }
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                              <div style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.artist}</div>
                            </div>
                            <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontSize:10,color:T.textD}}>{t.duration_str}</span>
                              {isAdding===t.id
                                ? <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                                : <div style={{width:24,height:24,borderRadius:6,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                  </div>
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    </>)
                }
              </div>
            )}
          </div>
        )}

        {/* ══════════ MÁQUINA DO TEMPO TAB ══════════ */}
        {tab==="maquina"&&(
          <div style={{position:"relative",zIndex:1}}>
            {/* Lightbox: foto do artista ampliada (HD) ao clicar na foto no pódio/lista */}
            {zoomArtist && (
              <div onClick={()=>setZoomArtist(null)}
                style={{position:"fixed",inset:0,zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,
                  background:"rgba(6,4,16,0.82)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",cursor:"zoom-out",padding:24}}>
                <img src={hdArtistImage(zoomArtist.img)} alt={zoomArtist.name} onClick={e=>e.stopPropagation()}
                  onError={e=>{ if(e.target.src!==zoomArtist.img) e.target.src=zoomArtist.img; }}
                  style={{maxWidth:"min(90vw,520px)",maxHeight:"78vh",width:"auto",height:"auto",borderRadius:20,objectFit:"contain",
                    border:`3px solid ${T.gold}`,boxShadow:`0 20px 70px rgba(0,0,0,0.6), 0 0 40px ${T.gold}55`,cursor:"default"}}/>
                <div style={{fontSize:18,fontWeight:800,color:"#fff",textShadow:"0 2px 10px rgba(0,0,0,0.6)"}}>{zoomArtist.name}</div>
                <button onClick={()=>setZoomArtist(null)}
                  style={{padding:"8px 20px",borderRadius:999,border:"1.5px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.1)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Fechar</button>
              </div>
            )}
            {/* Modal do vídeo "Mensagem Especial" (abre pelo card abaixo do pódio) —
                componente memoizado à parte pra não travar com os re-renders de 200ms */}
            <MsgVideoModal open={msgVideoOpen} onClose={closeMsgVideo} gold={T.gold} cover={msgEspecial.coverUrl} video={msgEspecial.videoUrl} />
            <div style={{marginBottom:20,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{fontFamily:"var(--font-brand)",fontSize:20,fontWeight:700,color:T.text,letterSpacing:".04em"}}>Máquina do Tempo</div>
                <div style={{fontSize:13,color:T.textT,marginTop:3}}>
                  As estatísticas musicais da galera no UnikoWave
                </div>
              </div>
              {isAdmin && (
                <div style={{display:'flex',gap:8,flexShrink:0}}>
                  <button
                    onClick={deleteMaquinaAll}
                    title="Apaga PERMANENTEMENTE o histórico de todos os meses"
                    style={{padding:'7px 14px',borderRadius:9,border:`1.5px solid ${T.danger||'#C04050'}55`,
                      background:'transparent',cursor:'pointer',fontFamily:'var(--font-body)',
                      fontSize:12,fontWeight:600,color:T.danger||'#C04050',display:'flex',alignItems:'center',gap:6,
                      transition:'all .15s'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                    Excluir tudo
                  </button>
                </div>
              )}
            </div>
            {/* Seletor de visões */}
            {!maquinaLoading && maquinaData && !maquinaData.sqlMissing && (maquinaData.total>0 || maquinaData.months?.length>0) && (
              <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
                {[
                  {id:'geral',     label:'Visão Geral'},
                  {id:'mensal',    label:'Por Mês'},
                  {id:'semaninha', label:'Semaninha'},
                ].map(v=>{
                  const on = maquinaView===v.id;
                  return (
                    <button key={v.id} onClick={()=>setMaquinaView(v.id)}
                      style={{padding:'7px 15px',borderRadius:999,cursor:'pointer',fontFamily:'var(--font-body)',
                        fontSize:12.5,fontWeight:700,letterSpacing:'.01em',transition:'all .15s',
                        border:`1.5px solid ${on?T.gold:T.border}`,
                        background:on?T.goldGl:'transparent',color:on?T.gold:T.textS}}>
                      {v.label}
                    </button>
                  );
                })}
              </div>
            )}

            {maquinaLoading
              ? <div style={{textAlign:"center",padding:60,color:T.textT}}>
                  <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin .7s linear infinite",margin:"0 auto 10px"}}/>
                  Carregando histórico...
                </div>
              : maquinaData?.sqlMissing
                ? <div style={{textAlign:"center",padding:60,color:T.textT}}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:"0 auto 12px",display:"block"}}><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
                    <div style={{fontSize:14}}>Estatísticas indisponíveis.</div>
                    <div style={{fontSize:12,marginTop:4,opacity:.7}}>Rode <code style={{color:T.gold}}>supabase_central_alexa_maquina.sql</code> no Supabase pra ativar a Máquina do Tempo.</div>
                  </div>
              : !maquinaData || (maquinaData.total===0 && (maquinaData.months?.length||0)===0)
                ? <div style={{textAlign:"center",padding:60,color:T.textT}}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:"0 auto 12px",display:"block"}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <div style={{fontSize:14}}>Nenhuma música tocada ainda.</div>
                    <div style={{fontSize:12,marginTop:4,opacity:.7}}>Volte depois que o UnikoWave tocar algumas músicas!</div>
                  </div>
                : (
                  <>
                    {/* ── VISÃO GERAL ── */}
                    {maquinaView==='geral' && (
                      maquinaData.periodStart && (Date.now() - new Date(maquinaData.periodStart).getTime()) < MAQUINA_MIN_DAYS*86400000
                        ? renderMaquinaAccumulating(maquinaData.periodStart)
                        : renderTopCards(maquinaData, true)
                    )}

                    {/* ── POR MÊS / RETROSPECTIVA ── */}
                    {maquinaView==='mensal' && (
                      maquinaData.months.length===0
                        ? <div style={{textAlign:"center",padding:40,color:T.textT,fontSize:13}}>Sem histórico mensal ainda.</div>
                        : <>
                            <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,marginBottom:16}}>
                              {maquinaData.months.map((m,i)=>{
                                const on = i===selMonthIdx;
                                return (
                                  <div key={m.key} style={{position:'relative',flexShrink:0}}>
                                    <button onClick={()=>setSelMonthIdx(i)}
                                      style={{padding:isAdmin?'8px 24px 8px 14px':'8px 14px',borderRadius:11,cursor:'pointer',fontFamily:'var(--font-body)',
                                        fontSize:12.5,fontWeight:700,transition:'all .15s',textAlign:'left',
                                        border:`1.5px solid ${on?T.gold:T.border}`,
                                        background:on?T.goldGl:cardBg,color:on?T.gold:T.textS}}>
                                      <div>{m.label}{i===0 && <span style={{marginLeft:6,fontSize:9,opacity:.85,fontWeight:800,letterSpacing:'.06em'}}>· ATUAL</span>}</div>
                                      <div style={{fontSize:10,fontWeight:600,opacity:.7,marginTop:1}}>{m.total} plays</div>
                                    </button>
                                    {isAdmin && (
                                      <button onClick={(e)=>{e.stopPropagation();deleteMaquinaMonth(m.key,m.label);}}
                                        title={`Excluir "${m.label}" permanentemente`}
                                        style={{position:'absolute',top:5,right:5,width:16,height:16,padding:0,border:'none',background:'transparent',
                                          cursor:'pointer',color:T.danger||'#C04050',opacity:.6,display:'flex',alignItems:'center',justifyContent:'center'}}
                                        onMouseEnter={e=>{e.currentTarget.style.opacity=1;}}
                                        onMouseLeave={e=>{e.currentTarget.style.opacity=.6;}}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {(() => {
                              const selMonth = maquinaData.months[selMonthIdx];
                              return selMonth.periodStart && (Date.now() - new Date(selMonth.periodStart).getTime()) < MAQUINA_MIN_DAYS*86400000
                                ? renderMaquinaAccumulating(selMonth.periodStart)
                                : renderTopCards(selMonth);
                            })()}
                          </>
                    )}

                    {/* ── SEMANINHA (collage) ── */}
                    {maquinaView==='semaninha' && (()=>{
                      const covers = collageData?.covers || [];
                      const periodCfg = COLLAGE_PERIODS.find(p=>p.id===collagePeriod) || COLLAGE_PERIODS[0];
                      const ready = collageData && collageData.period===collagePeriod && !collageLoading;
                      return (
                      <div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
                          <div>
                            <div style={{fontSize:15,fontWeight:700,color:T.text}}>Sua Semaninha 🎶</div>
                            <div style={{fontSize:12,color:T.textT,marginTop:2}}>
                              Capas mais ouvidas · {periodCfg.sub}{ready && ` · ${collageData.total} plays`}
                            </div>
                          </div>
                          <button onClick={downloadCollage} disabled={collageBusy || !ready || covers.length===0}
                            style={{padding:'6px 14px',borderRadius:9,cursor:(!ready||covers.length===0)?'not-allowed':'pointer',fontFamily:'var(--font-body)',
                              fontSize:12,fontWeight:700,transition:'all .15s',display:'flex',alignItems:'center',gap:6,
                              border:`1.5px solid ${T.gold}`,background:T.gold,color:'#1a1320',opacity:(collageBusy||!ready||covers.length===0)?.55:1}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            {collageBusy?'Gerando…':'Baixar'}
                          </button>
                        </div>
                        {/* Seletor de período + tamanho */}
                        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",marginBottom:18}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {COLLAGE_PERIODS.map(p=>{
                              const on = collagePeriod===p.id;
                              return (
                                <button key={p.id} onClick={()=>setCollagePeriod(p.id)}
                                  style={{padding:'6px 13px',borderRadius:999,cursor:'pointer',fontFamily:'var(--font-body)',
                                    fontSize:12,fontWeight:700,transition:'all .15s',
                                    border:`1.5px solid ${on?T.gold:T.border}`,
                                    background:on?T.goldGl:'transparent',color:on?T.gold:T.textS}}>
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{width:1,height:20,background:T.border}}/>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {[3,5,8,10].map(n=>{
                              const on = collageSize===n;
                              return (
                                <button key={n} onClick={()=>setCollageSize(n)}
                                  style={{padding:'6px 12px',borderRadius:9,cursor:'pointer',fontFamily:'var(--font-body)',
                                    fontSize:12,fontWeight:700,transition:'all .15s',
                                    border:`1.5px solid ${on?T.gold:T.border}`,
                                    background:on?T.goldGl:'transparent',color:on?T.gold:T.textS}}>
                                  {n}×{n}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {!ready
                          ? <div style={{textAlign:"center",padding:60,color:T.textT}}>
                              <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin .7s linear infinite",margin:"0 auto 10px"}}/>
                              Montando o collage...
                            </div>
                          : covers.length===0
                            ? <div style={{textAlign:"center",padding:50,color:T.textT}}>
                                <div style={{fontSize:14}}>Nenhuma música tocada nesse período.</div>
                                <div style={{fontSize:12,marginTop:4,opacity:.7}}>Coloque umas músicas no UnikoWave!</div>
                              </div>
                            : <>
                                {renderCollageGrid(covers, { maxWidth:Math.min(560, collageSize*70+40), onClick:()=>setCollageExpanded(true) })}
                                <div style={{textAlign:"center",fontSize:11,color:T.textD,marginTop:10}}>
                                  {covers.length < collageSize*collageSize
                                    ? <>Só {covers.length} música{covers.length>1?'s':''} distinta{covers.length>1?'s':''} nesse período — as capas se repetem pra preencher o {collageSize}×{collageSize}. Toque pra ampliar.</>
                                    : <>Toque no collage pra ampliar.</>}
                                </div>

                                {/* Lightbox — collage ampliado com fundo desfocado */}
                                {collageExpanded && (
                                  <div onClick={()=>setCollageExpanded(false)}
                                    style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",
                                      padding:isMobile?16:32,background:"rgba(8,8,14,0.72)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",
                                      animation:"fadeIn .18s ease"}}>
                                    <button onClick={()=>setCollageExpanded(false)} aria-label="Fechar"
                                      style={{position:"absolute",top:isMobile?16:24,right:isMobile?16:24,width:40,height:40,borderRadius:"50%",
                                        border:`1.5px solid ${T.border}`,background:"rgba(255,255,255,0.08)",color:"#fff",cursor:"pointer",
                                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                    <div onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,maxWidth:"100%"}}>
                                      {renderCollageGrid(covers, { maxWidth:`min(86vw, 86vh, 720px)` })}
                                      <button onClick={downloadCollage} disabled={collageBusy}
                                        style={{padding:'8px 18px',borderRadius:10,cursor:collageBusy?'default':'pointer',fontFamily:'var(--font-body)',
                                          fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:7,
                                          border:`1.5px solid ${T.gold}`,background:T.gold,color:'#1a1320',opacity:collageBusy?.6:1}}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        {collageBusy?'Gerando…':`Baixar ${collageSize}×${collageSize}`}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                        }
                      </div>
                      );
                    })()}
                  </>
                )
            }
          </div>
        )}

        {/* ══════════ ALEXA TAB ══════════ */}
        {tab==="alexa"&&(
          <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?14:20,alignItems:"flex-start",maxWidth:900,margin:"0 auto"}}>
            {/* Chat interface */}
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:16}}>
              {/* Alexa orb header */}
              <div style={{borderRadius:20,background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,padding:"28px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:16,position:"relative",overflow:"hidden",boxShadow:T.shM}}>
                <div style={{position:"absolute",width:140,height:140,borderRadius:"50%",background:T.gold,filter:"blur(40px)",opacity:0.08,top:"-30px",left:"20%",animation:"hdrBlob1 5s ease-in-out infinite"}}/>
                <div style={{position:"absolute",width:100,height:100,borderRadius:"50%",background:T.goldL||T.gold,filter:"blur(30px)",opacity:0.06,bottom:"-10px",right:"15%",animation:"hdrBlob2 7s ease-in-out infinite"}}/>
                {/* Orb */}
                <img src={T.unikoSrc || '/UNIKO_NEW.png'} alt="Uniko" onError={e=>{e.target.onerror=null;e.target.src='/UNIKO_NEW.png';}} style={{width:90,height:90,objectFit:"contain",position:"relative",zIndex:1,animation:"alexaFloat 6s ease-in-out infinite"}}/>
                <div style={{textAlign:"center",position:"relative",zIndex:1}}>
                  <div style={{fontFamily:"var(--font-brand)",fontSize:20,fontWeight:700,color:T.text,letterSpacing:".04em"}}>Uniko x Alexa</div>
                  <div style={{fontSize:12,color:T.textS,marginTop:2}}>Pergunte sobre tempo, eventos, músicas, lembretes...</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:8,background:T.goldGl,border:`1px solid ${T.goldLine}44`,position:"relative",zIndex:1}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:"#1A9C70"}}/>
                  <span style={{fontSize:11,fontWeight:600,color:"#1A9C70"}}>Alexa Online</span>
                </div>
              </div>

              {/* Conversation — estilo grupo WhatsApp */}
              <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:T.sh}}>
                <div ref={chatScrollRef} style={{height:520,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8,scrollbarWidth:"thin"}}>
                  {alexaConvo.map((m,i)=>{
                    // Gera cor única por nome (estilo WhatsApp grupo)
                    const nameColors = ["#E53935","#8E24AA","#1976D2","#00897B","#F4511E","#6D4C41","#039BE5","#7CB342"];
                    const nameColor = m.role==="user"
                      ? nameColors[(m.name||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0) % nameColors.length]
                      : T.gold;

                    return (
                      <div key={i} style={{display:"flex",gap:8,alignItems:"flex-end",justifyContent:m.role==="user"?"flex-end":"flex-start",animation:"bubblePop .2s ease-out"}}>
                        {/* Avatar Alexa */}
                        {m.role==="alexa"&&(
                          <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,overflow:"hidden",marginBottom:2,flexShrink:0}}>
                            <img src="/UNIKO_FRENTE_FRONTAL.png" alt="Alexa" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          </div>
                        )}

                        <div style={{maxWidth:"72%",display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
                          {/* Bolha */}
                          <div style={{
                            padding:"8px 12px",
                            borderRadius:m.role==="alexa"?"2px 14px 14px 14px":"14px 2px 14px 14px",
                            background:m.role==="alexa"
                              ? (isDark?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.95)")
                              : `linear-gradient(135deg,${T.blue||"#1A6FB5"},${T.blue||"#1A6FB5"}cc)`,
                            border:`1px solid ${m.role==="alexa"?T.border:"transparent"}`,
                            boxShadow:"0 1px 2px rgba(0,0,0,0.08)",
                          }}>
                            {/* Nome do remetente (estilo grupo WhatsApp) */}
                            {m.role==="user"&&(
                              <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.85)",marginBottom:3,letterSpacing:".02em"}}>
                                {m.name||myName} solicitou para a Alexa:
                              </div>
                            )}
                            {m.role==="alexa"&&(
                              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                                <img src="/UNIKO_FRENTE_FRONTAL.png" alt="Uniko" style={{width:14,height:14,borderRadius:3,objectFit:"cover"}}/>
                                <span style={{fontSize:11,fontWeight:700,color:T.gold}}>Uniko</span>
                              </div>
                            )}
                            <div style={{fontSize:13,color:m.role==="user"?"white":T.text,lineHeight:1.5}}>
                              {m.role==="user"
                                ? <span style={{fontStyle:"italic"}}>"{m.text}"</span>
                                : (() => {
                                    const count = typedChars[m.id];
                                    const isTypingNow = count !== undefined && count < m.text.length;
                                    const shown = count !== undefined ? m.text.slice(0, count) : m.text;
                                    return <>
                                      {shown}
                                      {isTypingNow && <span style={{
                                        display:'inline-block',width:2,height:'1em',
                                        background:'currentColor',marginLeft:1,verticalAlign:'text-bottom',
                                        animation:'blink .5s step-end infinite'
                                      }}/>}
                                    </>;
                                  })()
                              }
                            </div>
                          </div>
                          {/* Timestamp */}
                          <div style={{fontSize:10,color:T.textD,marginTop:2,display:"flex",alignItems:"center",gap:3}}>
                            {m.role==="alexa"&&m.spoke&&<span style={{color:"#1A9C70",fontSize:11}}>🔊</span>}
                            {m.ts}
                            {m.role==="user"&&<span style={{color:T.blue||"#1A6FB5",fontSize:11}}>✓✓</span>}
                          </div>
                        </div>

                        {/* Avatar usuário */}
                        {m.role==="user"&&(
                          <AvatarCircle
                            name={m.name||myName}
                            photo={(m.name===myName||!m.name) ? myPhoto : photoCache[m.name]}
                            size={32} fontSize={11}
                            style={{marginBottom:2, background:`linear-gradient(135deg,${nameColor},${nameColor}bb)`}}
                          />
                        )}
                      </div>
                    );
                  })}
                  {alexaTyping&&(
                    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,overflow:"hidden"}}>
                        <img src="/UNIKO_FRENTE_FRONTAL.png" alt="Uniko" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      </div>
                      <div style={{padding:"12px 16px",borderRadius:"4px 14px 14px 14px",background:T.goldGl,border:`1px solid ${T.goldLine}44`,display:"flex",gap:4,alignItems:"center"}}>
                        {[0,0.15,0.3].map((d,i)=>(
                          <div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.gold,animation:`typingDot 1.4s ${d}s ease-in-out infinite`}}/>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Input */}
                <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 16px"}}>
                  {!isAdmin&&(
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,fontSize:11,
                      color:alexaReqCount>=ALEXA_LIMIT?"#C04050":T.textD}}>
                      {alexaReqCount>=ALEXA_LIMIT
                        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            Limite atingido — liberado em{" "}
                            <span style={{fontVariantNumeric:"tabular-nums",fontWeight:700,fontSize:12}}>
                              {alexaCooldown||"--:--"}
                            </span>
                          </>
                        : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {ALEXA_LIMIT - alexaReqCount} de {ALEXA_LIMIT} pedidos restantes · renova em 1h
                          </>
                      }
                    </div>
                  )}
                  <div style={{display:"flex",gap:10}}>
                    <input value={alexaInput} onChange={e=>setAlexaInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&sendAlexa()}
                      disabled={!canAskAlexa}
                      placeholder={canAskAlexa?"Alexa, qual a previsão do tempo hoje?":"Limite de requisições atingido"}
                      style={{flex:1,padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:10,fontFamily:"var(--font-body)",fontSize:13,color:T.text,background:T.surface,outline:"none",transition:"border-color .15s",cursor:canAskAlexa?"text":"not-allowed",opacity:canAskAlexa?1:0.5}}
                      onFocus={e=>e.target.style.borderColor=T.gold}
                      onBlur={e=>e.target.style.borderColor=T.border}/>
                    <button onClick={sendAlexa} disabled={!alexaInput.trim()||!canAskAlexa}
                      style={{padding:"10px 18px",borderRadius:10,border:"none",cursor:(alexaInput.trim()&&canAskAlexa)?"pointer":"not-allowed",fontFamily:"var(--font-body)",fontSize:13,fontWeight:700,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:"white",opacity:(alexaInput.trim()&&canAskAlexa)?1:0.5}}>
                      Perguntar
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["Previsão do tempo","Que horas são?","Lembrar de bater ponto","Contar uma piada","Próxima reunião"].map(q=>(
                  <button key={q} onClick={()=>{setAlexaInput(q);setTimeout(()=>{document.querySelector("input[placeholder*=previsão]")?.focus()},50);}}
                    style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:T.goldGl,color:T.gold,cursor:"pointer",fontSize:12,fontWeight:500,outline:"none"}}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Rodapé Criado por Nicolas Andrade ── */}
      <div style={{textAlign:"center",padding:"24px 0 20px",borderTop:`1px solid ${T.border}`,marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:.38,position:"relative",zIndex:2}}>
        <Logo size={20}/>
        <span style={{fontFamily:"var(--font-body)",fontSize:11,color:T.textT}}>
          Criado por <span style={{fontFamily:"var(--font-brand)",fontSize:11,fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
        </span>
      </div>

      {/* ── Modal de foto expandida (clique numa foto da fila) ── */}
      {expandedPhoto && (
        <div onClick={() => setExpandedPhoto(null)}
          style={{
            position:'fixed', inset:0, zIndex:99999,
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            background:'rgba(0,0,0,.55)', cursor:'zoom-out',
            backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
            animation:'fadeIn .2s ease',
          }}>
          {/* Fundo borrado com a própria foto */}
          <img src={expandedPhoto.photo} alt="" aria-hidden
            style={{
              position:'absolute', inset:0, width:'100%', height:'100%',
              objectFit:'cover', filter:'blur(48px) brightness(.45)', opacity:.6,
              pointerEvents:'none', transform:'scale(1.2)',
            }}/>
          {/* Foto inteira */}
          <img src={expandedPhoto.photo} alt={expandedPhoto.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              position:'relative', maxWidth:'90vw', maxHeight:'80vh',
              objectFit:'contain', borderRadius:18,
              border:'2px solid rgba(255,255,255,.18)',
              boxShadow:'0 24px 90px rgba(0,0,0,.75)',
              animation:'bubblePop .25s ease',
            }}/>
          <div style={{
            position:'relative', marginTop:16, fontSize:17, fontWeight:700, color:'#fff',
            textShadow:'0 2px 14px rgba(0,0,0,.85)', textAlign:'center', maxWidth:'90vw',
          }}>
            {expandedPhoto.name}
          </div>
          <div style={{ position:'relative', marginTop:6, fontSize:12, color:'rgba(255,255,255,.6)' }}>
            Toque para fechar
          </div>
        </div>
      )}

      {/* ── Burst de morcegos (3s) ao trocar para um vampire robot ── */}
      {batBurst && <BatBurstOverlay />}
      {/* ── Explosão de bolhas (3s) ao trocar para a Uniko Sereia ── */}
      {bubbleBurst && <BubbleBurstOverlay />}
      {/* ── Explosão de estrelas/meteoros (3s) ao trocar para a Destruidora de Mundos ── */}
      {meteorBurst && <MeteorBurstOverlay />}

      {/* ── Mini-player fixo (estilo Spotify/app de música) — só no celular ── */}
      {isMobile && cur && !nowPlayingOpen && (
        <div onClick={() => setNowPlayingOpen(true)} role="button" aria-label="Abrir tela do que está tocando"
          style={{ position:"fixed", left:0, right:0, bottom:0, zIndex:500, display:"flex", alignItems:"center", gap:10,
            padding:"8px 12px", paddingBottom:"calc(8px + env(safe-area-inset-bottom, 0px))",
            background: isDark ? "rgba(18,14,10,.94)" : "rgba(255,255,255,.96)", backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)",
            borderTop:`1px solid ${T.border}`, boxShadow:"0 -6px 24px rgba(0,0,0,.12)", cursor:"pointer" }}>
          {cur.album_art
            ? <img src={cur.album_art} alt="" style={{ width:44, height:44, borderRadius:8, objectFit:"cover", flexShrink:0 }} />
            : <div style={{ width:44, height:44, borderRadius:8, background:T.goldGl, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🎵</div>}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cur.title}</div>
            <div style={{ fontSize:11.5, color:T.textS, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cur.artist}</div>
          </div>
          {isAdmin ? (
            <button onClick={e => { e.stopPropagation(); handlePlayPause(); }} disabled={!spotifyOk}
              style={{ width:38, height:38, borderRadius:"50%", border:"none", background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`, color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:spotifyOk?"pointer":"not-allowed", opacity:spotifyOk?1:.5 }}>
              {isPlaying
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
            </button>
          ) : (
            <div style={{ width:38, height:38, borderRadius:"50%", background: isPlaying ? `linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)` : T.border, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity:.6 }}>
              {isPlaying
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill={T.textD} stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
            </div>
          )}
        </div>
      )}

      {/* ── Tela cheia "Tocando Agora" (estilo Spotify) — abre ao tocar no mini-player ── */}
      {isMobile && nowPlayingOpen && cur && (
        <div style={{ position:"fixed", inset:0, zIndex:2000, background: isDark ? "#0b0b12" : "#181022", display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {cur.album_art && (
            <div style={{ position:"absolute", inset:0, backgroundImage:`url(${cur.album_art})`, backgroundSize:"cover", backgroundPosition:"center", filter:"blur(44px) brightness(.45)", transform:"scale(1.2)" }} />
          )}
          <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", height:"100%", padding:"0 22px", paddingTop:"max(20px, env(safe-area-inset-top, 20px))", paddingBottom:"calc(20px + env(safe-area-inset-bottom, 0px))" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0 12px" }}>
              <button onClick={() => setNowPlayingOpen(false)} aria-label="Fechar" style={{ border:"none", background:"none", cursor:"pointer", color:"#fff", display:"flex", padding:8 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <span style={{ fontSize:11.5, fontWeight:700, color:"rgba(255,255,255,.75)", letterSpacing:".06em", textTransform:"uppercase" }}>Uniko Music</span>
              <div style={{ width:38 }} />
            </div>

            <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", minHeight:0 }}>
              {cur.album_art
                ? <img src={cur.album_art} alt="" style={{ width:"min(78vw, 320px)", aspectRatio:"1/1", borderRadius:16, objectFit:"cover", boxShadow:"0 24px 60px rgba(0,0,0,.5)" }} />
                : <div style={{ width:"min(78vw, 320px)", aspectRatio:"1/1", borderRadius:16, background:"rgba(255,255,255,.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:60 }}>🎵</div>}

              <div style={{ marginTop:26, textAlign:"center", width:"100%", maxWidth:340 }}>
                <div style={{ fontSize:19, fontWeight:800, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cur.title}</div>
                <div style={{ fontSize:13.5, color:"rgba(255,255,255,.7)", marginTop:4 }}>{cur.artist}</div>
              </div>

              {cur.duration_ms > 0 && (
                <div style={{ width:"100%", maxWidth:340, marginTop:16 }}>
                  <BarraProgresso progressMs={progressMs} durationMs={cur.duration_ms}
                    cores={festColors} onSeek={isAdmin ? seekTo : undefined} escuro />
                </div>
              )}

              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20, marginTop:30 }}>
                {canControl && (
                  <button onClick={handleNext} disabled={!spotifyOk||queue.length<2} title="Pular música"
                    style={{ width:44, height:44, borderRadius:"50%", border:"none", background:"rgba(255,255,255,.12)", color:"#fff",
                      display:"flex", alignItems:"center", justifyContent:"center", cursor:(spotifyOk&&queue.length>=2)?"pointer":"not-allowed", opacity:(spotifyOk&&queue.length>=2)?1:.4 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                  </button>
                )}
                {isAdmin ? (
                  <button onClick={handlePlayPause} disabled={!spotifyOk}
                    style={{ width:68, height:68, borderRadius:"50%", border:"none", background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`, color:"#fff",
                      display:"flex", alignItems:"center", justifyContent:"center", cursor:spotifyOk?"pointer":"not-allowed", opacity:spotifyOk?1:.5, boxShadow:"0 8px 24px rgba(0,0,0,.4)" }}>
                    {isPlaying
                      ? <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                  </button>
                ) : (
                  <div style={{ width:68, height:68, borderRadius:"50%", background: isPlaying ? `linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)` : "rgba(255,255,255,.12)", display:"flex", alignItems:"center", justifyContent:"center", opacity:.65 }}>
                    {isPlaying
                      ? <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,.6)" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                  </div>
                )}
                <button onClick={toggleVideo} title="Videoclipe"
                  style={{ width:44, height:44, borderRadius:"50%", border:"none", background: videoEnabled ? T.goldGl : "rgba(255,255,255,.12)", color: videoEnabled ? T.gold : "#fff",
                    display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                </button>
              </div>

              {canControl && (
                <div style={{ display:"flex", alignItems:"center", gap:10, width:"100%", maxWidth:340, marginTop:24 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round"
                    onClick={() => handleVolume(volume===0?50:0)} style={{ cursor:"pointer", flexShrink:0 }}>
                    {volume===0
                      ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                      : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>}
                  </svg>
                  <input type="range" min="0" max="100" value={volume} onChange={e=>handleVolume(Number(e.target.value))} disabled={!spotifyOk}
                    style={{ flex:1, accentColor:T.gold, height:3, cursor:spotifyOk?"pointer":"not-allowed", opacity:spotifyOk?1:.4 }}/>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export default CentralAlexa;
