// src/modules/central-alexa/UnikoMascot.jsx
import React, { useState, useEffect, useRef } from 'react';
import { getAssistantSkin } from '../../shared/assistantSkin';
import { getUniko } from '../../shared/captureUniko';
import { getContentOffset } from '../../shared/imageContentOffset';

const DEFAULT_IMG = '/UNIKO_ALEXACENTRAL.png';

const DJ_LINES = [
  'Bora colocar aquela música massa! 🎵',
  'Qualquer pedido, tô na área! 🎧',
  'Som no sistema, pode pedir! ⚡',
  'DJ da 7 Benefícios presenteando! 🎶',
  'Curtindo o som com vocês! 🎤',
  'Que batida incrível essa! 🔥',
];

const VAMPIRE_LINES = [
  'Séculos de existência... e essa batida ainda me impressiona 🦇',
  'O sangue ferve ao ritmo dessa melodia 🩸',
  'Eternidade é pouco para ouvir essa faixa na íntegra 🌑',
  'Os morcegos param de voar quando essa música toca 🦇',
  'Trezentos anos morto e ainda me arrepia 🌙',
  'Esta melodia seria perfeita para um banquete eterno 🩸',
  'Deixe o som te envolver... assim como a escuridão 🖤',
  'Quem disse que os mortos não apreciam boa música? 🎶',
  'A lua de sangue brilha mais forte ao som disso 🌕',
  'Minha coleção tem séculos... mas essa faixa é nova 🦇',
  'Todo bom vampiro tem sua trilha sonora secreta 🎵',
  'Os mortos-vivos têm gosto musical impecável 🩸',
];

const SEREIA_LINES = [
  'Até os peixinhos do recife pararam pra ouvir essa! 🐠',
  'Essa batida balança mais suave que a maré 🌊',
  'Canto pros corais e eles brilham mais colorido 🪸',
  'As água-vivas estão dançando com essa melodia 🎐',
  'Trago essa música lá do fundo do oceano pra vocês 🐚',
  'Minha voz e essa canção... combinação perfeita 🎶',
  'O recife inteiro vira uma festa com esse som 🐟',
  'Essa melodia é mais calma que as águas do recife 💙',
  'As pérolas do meu colar brilham ao ritmo disso ✨',
  'Todo bom canto de sereia merece uma trilha assim 🎵',
  'Deixa a maré te levar... assim como essa música 🌊',
  'Lá no fundo do mar, essa faixa também faz sucesso 🐬',
];

const DESTRUIDORA_LINES = [
  'Nem um planeta inteiro faz mais barulho que essa batida! 💥',
  'Eu destruo mundos, mas essa música eu preservo pra sempre 🌌',
  'Cada grave bate mais forte que um cometa colidindo ☄️',
  'Os buracos negros dançam quando essa faixa toca 🕳️',
  'Reduzi impérios inteiros a pó, mas essa melodia eu não apago 💫',
  'O universo treme... e olha que é só o grave dessa música 🎶',
  'Nem a força de mil supernovas supera esse refrão 🌟',
  'Destruí galáxias inteiras procurando um som assim 🔮',
  'As estrelas se realinham no ritmo dessa canção ✨',
  'Sou o fim dos mundos, mas o começo de uma boa festa 🪐',
  'Essa batida ecoa mais longe que a explosão de uma galáxia 💥',
  'Nem toda a minha fúria cósmica resiste a esse groove 🌠',
];

const BLINK_SEQ = [
  { key: 'open',   ms: 2600 },
  { key: 'mid',    ms: 80   },
  { key: 'closed', ms: 130  },
  { key: 'mid',    ms: 80   },
];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];
// Quanto o ícone deixa de subir em repouso, pra não ficar colado na borda de cima do card.
const REST_GAP = 40;

const MASCOT_CSS = `
@keyframes unikoFloat { 0%,100%{transform:translateY(0px);} 50%{transform:translateY(-8px);} }
@keyframes vampBubblePulse {
  0%,100% { border-color:#c41e3a55; box-shadow:0 2px 8px #c41e3a22; }
  50%      { border-color:#c41e3a99; box-shadow:0 2px 22px #c41e3a55; }
}
@keyframes seaBubblePulse {
  0%,100% { border-color:#2dd4bf55; box-shadow:0 2px 8px #2dd4bf22; }
  50%      { border-color:#7ee8fa99; box-shadow:0 2px 22px #2dd4bf55; }
}
@keyframes normalBubble {
  0%,100% { border-color:rgba(255,255,255,.16); }
  50%      { border-color:rgba(255,255,255,.38); }
}
.vamp-bubble  { animation: vampBubblePulse 2.5s ease-in-out infinite; }
.sea-bubble   { animation: seaBubblePulse 3s ease-in-out infinite; }
.normal-bubble{ animation: normalBubble 3s ease-in-out infinite; }
`;

const LINES_BY_SKIN = {
  'vampire-robot': VAMPIRE_LINES,
  'uniko-sereia':  SEREIA_LINES,
  'destruidora-de-mundos-dh0x': DESTRUIDORA_LINES,
};
const GLOW_BY_SKIN  = {
  'vampire-robot': 'drop-shadow(0 0 10px #c41e3a88) drop-shadow(0 4px 12px rgba(0,0,0,.5))',
  'uniko-sereia':  'drop-shadow(0 0 10px #2dd4bf88) drop-shadow(0 4px 12px rgba(0,0,0,.35))',
  'destruidora-de-mundos-dh0x': 'drop-shadow(0 0 10px #9d6bff88) drop-shadow(0 4px 12px rgba(0,0,0,.5))',
};

// songSkin: skin do DJ da música atual (vem do Supabase via index.jsx)
const UnikoMascot = ({ track, colors = null, size = 160, songSkin = 'default' }) => {
  const isSpecial = songSkin !== 'default';
  const isVamp = songSkin === 'vampire-robot', isSea = songSkin === 'uniko-sereia';
  const skin      = getAssistantSkin(songSkin);
  // Unikos da Oficina (ou 'uniko-comum') não têm balão/brilho artesanal — usa a cor que
  // o admin escolheu (getUniko cobre fixos E os criados na Oficina) como tema genérico.
  const uni       = (isSpecial && !isVamp && !isSea) ? getUniko(songSkin) : null;
  const customAccent = uni?.theme?.accent || null;
  const lines     = LINES_BY_SKIN[songSkin] || DJ_LINES;
  const bubbleClass = isVamp ? 'vamp-bubble' : isSea ? 'sea-bubble' : 'normal-bubble';

  const [line,          setLine]          = useState(() => rand(lines));
  const [showBubble,    setShowBubble]    = useState(true);
  const [blinkImg,      setBlinkImg]      = useState(null);
  const [contentOffset, setContentOffset] = useState(null);
  const [bubbleH,       setBubbleH]       = useState(46); // altura medida do balão — até medir, usa um chute razoável
  const bubbleRef = useRef(null);

  // Mede a altura real do balão (varia com o texto) — usada pra saber o quanto o
  // ícone precisa subir quando ele descansa (ver wrapper de reposicionamento abaixo).
  useEffect(() => {
    if (bubbleRef.current) setBubbleH(bubbleRef.current.offsetHeight);
  }, [line, songSkin]);

  // Unikos da Oficina às vezes têm o desenho fora do centro do PNG (padding transparente
  // assimétrico) — recalcula a correção de centro sempre que o Uniko personalizado muda.
  // Só se aplica a skins da Oficina (uni truthy); Vampire-Robot/Sereia/padrão já vêm centrados.
  useEffect(() => {
    if (!uni) { setContentOffset(null); return; }
    let alive = true;
    getContentOffset(skin.blink.open).then(off => { if (alive) setContentOffset(off); });
    return () => { alive = false; };
  }, [uni, skin.blink.open]); // eslint-disable-line

  // Blink loop — só quando skin especial
  useEffect(() => {
    if (!isSpecial) { setBlinkImg(null); return; }
    let i = 0, t;
    const tick = () => {
      i = (i + 1) % BLINK_SEQ.length;
      setBlinkImg(skin.blink[BLINK_SEQ[i].key]);
      t = setTimeout(tick, BLINK_SEQ[i].ms);
    };
    setBlinkImg(skin.blink.open);
    t = setTimeout(tick, BLINK_SEQ[0].ms);
    return () => clearTimeout(t);
  }, [isSpecial, songSkin]); // eslint-disable-line

  // Fala a cada 20s: mostra o balão por ~6,5s e some o resto do tempo
  useEffect(() => {
    const SHOW_MS = 6500, CYCLE_MS = 20000;
    let hideT;
    const speak = () => {
      setLine(rand(lines));
      setShowBubble(true);
      clearTimeout(hideT);
      hideT = setTimeout(() => setShowBubble(false), SHOW_MS);
    };
    speak(); // fala ao montar / trocar de modo ou música
    const id = setInterval(speak, CYCLE_MS);
    return () => { clearInterval(id); clearTimeout(hideT); };
  }, [songSkin, track?.name]); // eslint-disable-line

  // Cor do bubble via cores da capa quando não é uma skin especial
  const c0 = colors?.[0] ?? null;
  const c1 = colors?.[1] ?? colors?.[0] ?? null;
  const albumBubbleCss = (!isSpecial && c0)
    ? `@keyframes albumBubble{0%,100%{border-color:${c0}55;box-shadow:0 2px 14px ${c0}33;}50%{border-color:${c1}cc;box-shadow:0 2px 28px ${c1}66;}}.normal-bubble{animation:albumBubble 3s ease-in-out infinite;}`
    : '';

  const img = isSpecial ? (blinkImg || skin.blink.open) : DEFAULT_IMG;

  return (
    <>
      <style>{MASCOT_CSS}{albumBubbleCss}</style>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, userSelect:'none', position:'relative', zIndex:2 }}>

        {/* Balão de fala — SEMPRE reserva o próprio espaço (o card nunca muda de
            tamanho, só o opacity desliga o balão); quem se reposiciona é o ícone
            logo abaixo, subindo pro vão do balão quando ele está invisível. */}
        <div style={{
          opacity: showBubble ? 1 : 0,
          transition: 'opacity .35s ease',
          pointerEvents: 'none',
        }}>
        <div
          ref={bubbleRef}
          className={bubbleClass}
          style={songSkin === 'vampire-robot' ? {
            background:           'rgba(8,0,4,0.88)',
            backdropFilter:       'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border:               '1px solid #c41e3a55',
            borderRadius:         '14px 14px 14px 4px',
            padding:              '9px 14px',
            fontSize:             13,
            color:                '#eab8c4',
            maxWidth:             size + 48,
            textAlign:            'center',
            lineHeight:           1.45,
          } : songSkin === 'uniko-sereia' ? {
            background:           'rgba(3,20,26,0.85)',
            backdropFilter:       'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border:               '1px solid #2dd4bf55',
            borderRadius:         '14px 14px 14px 4px',
            padding:              '9px 14px',
            fontSize:             13,
            color:                '#c9fbff',
            maxWidth:             size + 48,
            textAlign:            'center',
            lineHeight:           1.45,
          } : customAccent ? {
            background:           'rgba(6,6,10,0.85)',
            backdropFilter:       'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border:               `1px solid ${customAccent}55`,
            borderRadius:         '14px 14px 14px 4px',
            padding:              '9px 14px',
            fontSize:             13,
            color:                '#fff',
            maxWidth:             size + 48,
            textAlign:            'center',
            lineHeight:           1.45,
          } : {
            background:           'rgba(255,255,255,0.09)',
            backdropFilter:       'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border:               '1px solid rgba(255,255,255,0.16)',
            borderRadius:         '14px 14px 14px 4px',
            padding:              '9px 14px',
            fontSize:             13,
            color:                'inherit',
            maxWidth:             size + 48,
            textAlign:            'center',
            lineHeight:           1.45,
          }}
        >
          {line}
        </div>
        </div>

        {/* Reposiciona o ícone: sobe pro vão do balão (invisível) quando quieto,
            desce de volta quando o balão aparece — o card não muda de tamanho,
            só o ícone se move. Não sobe até encostar no topo — sobra uma margem
            (REST_GAP) pra não ficar colado na borda do card. */}
        <div style={{
          transform:  showBubble ? 'translateY(0)' : `translateY(-${Math.max(0, bubbleH + 10 - REST_GAP)}px)`,
          transition: 'transform .45s ease',
        }}>
        {/* Correção de centro (Unikos da Oficina com o desenho fora do centro do PNG) */}
        <div style={contentOffset ? {
          transform: `translate(${contentOffset.dxFrac * size}px, ${contentOffset.dyFrac * size}px)`,
        } : undefined}>
          {/* Imagem flutuante — sem quadrado, sem borda */}
          <img
            src={img}
            alt="UNIKO"
            style={{
              width:      size,
              height:     size,
              objectFit:  'contain',
              flexShrink: 0,
              animation:  'unikoFloat 3s ease-in-out infinite',
              filter: GLOW_BY_SKIN[songSkin]
                || (customAccent ? `drop-shadow(0 0 10px ${customAccent}88) drop-shadow(0 4px 12px rgba(0,0,0,.3))` : 'drop-shadow(0 4px 12px rgba(0,0,0,.25))'),
              transition: 'filter .4s',
            }}
          />
        </div>
        </div>

      </div>
    </>
  );
};

export default UnikoMascot;
