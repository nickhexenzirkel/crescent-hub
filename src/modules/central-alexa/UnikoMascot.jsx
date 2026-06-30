// src/modules/central-alexa/UnikoMascot.jsx
import React, { useState, useEffect } from 'react';
import { getActiveAssistantSkinId, getAssistantSkin, onAssistantSkinChange } from '../../shared/assistantSkin';

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

// Sequência de blink: open longo → meio-olho → fechado → meio-olho → ...
const BLINK_SEQ = [
  { key: 'open',   ms: 2600 },
  { key: 'mid',    ms: 80   },
  { key: 'closed', ms: 130  },
  { key: 'mid',    ms: 80   },
];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

const VAMP_CSS = `
@keyframes vampBubblePulse {
  0%,100% { border-color:#c41e3a55; box-shadow:0 2px 8px #c41e3a22; }
  50%      { border-color:#c41e3a99; box-shadow:0 2px 22px #c41e3a55; }
}
.vamp-bubble { animation: vampBubblePulse 2.5s ease-in-out infinite; }
@keyframes vampImgGlow {
  0%,100% { box-shadow: 0 0 0 0 #c41e3a00, 0 4px 20px rgba(0,0,0,.4); }
  50%      { box-shadow: 0 0 18px 5px #c41e3a55, 0 4px 20px rgba(0,0,0,.4); }
}
`;

const NORMAL_CSS = (c0, c1) => c0
  ? `@keyframes bubbleBorder{0%,100%{border-color:${c0}55;box-shadow:0 2px 14px ${c0}33;}50%{border-color:${c1}cc;box-shadow:0 2px 28px ${c1}66;}}.uniko-bubble{animation:bubbleBorder 3s ease-in-out infinite;}`
  : `@keyframes bubbleBorder{0%,100%{border-color:rgba(255,255,255,.16);}50%{border-color:rgba(255,255,255,.38);}}.uniko-bubble{animation:bubbleBorder 3s ease-in-out infinite;}`;

const UnikoMascot = ({ track, colors = null, size = 160, requestedBy, myName }) => {
  const [skinId,   setSkinId]   = useState(() => getActiveAssistantSkinId());
  const [line,     setLine]     = useState(() => rand(DJ_LINES));
  const [blinkImg, setBlinkImg] = useState(null);

  const isMyMusic = !!(requestedBy && myName && requestedBy === myName);
  const isVampire = isMyMusic && skinId !== 'default';
  const skin      = getAssistantSkin(skinId);

  // Sincroniza skin ativa
  useEffect(() => onAssistantSkinChange(id => setSkinId(id)), []);

  // Blink loop — só quando vampiro está ativo
  useEffect(() => {
    if (!isVampire) { setBlinkImg(null); return; }
    let i = 0, t;
    const tick = () => {
      i = (i + 1) % BLINK_SEQ.length;
      setBlinkImg(skin.blink[BLINK_SEQ[i].key]);
      t = setTimeout(tick, BLINK_SEQ[i].ms);
    };
    setBlinkImg(skin.blink.open);
    t = setTimeout(tick, BLINK_SEQ[0].ms);
    return () => clearTimeout(t);
  }, [isVampire, skinId]); // eslint-disable-line

  // Troca de linha ao mudar modo ou música
  useEffect(() => { setLine(rand(isVampire ? VAMPIRE_LINES : DJ_LINES)); }, [isVampire]);
  useEffect(() => { if (!track?.name) return; setLine(rand(isVampire ? VAMPIRE_LINES : DJ_LINES)); }, [track?.name]); // eslint-disable-line
  useEffect(() => {
    const id = setInterval(() => setLine(rand(isVampire ? VAMPIRE_LINES : DJ_LINES)), 7000);
    return () => clearInterval(id);
  }, [isVampire]);

  const img = isVampire ? (blinkImg || skin.blink.open) : DEFAULT_IMG;
  const c0  = colors?.[0] ?? null;
  const c1  = colors?.[1] ?? colors?.[0] ?? null;

  return (
    <>
      <style>{isVampire ? VAMP_CSS : NORMAL_CSS(c0, c1)}</style>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, userSelect:'none', position:'relative', zIndex:2 }}>

        {/* Balão de fala */}
        <div
          className={isVampire ? 'vamp-bubble' : 'uniko-bubble'}
          style={isVampire ? {
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

        {/* Avatar — sem borda branca; glow vermelho no modo vampiro */}
        <div style={{
          width:        size,
          height:       size,
          borderRadius: isVampire ? '18px' : '50%',
          overflow:     'hidden',
          flexShrink:   0,
          animation:    isVampire ? 'vampImgGlow 2.5s ease-in-out infinite' : undefined,
          transition:   'border-radius .35s',
        }}>
          <img
            src={img}
            alt="UNIKO"
            style={{
              width:     '100%',
              height:    '100%',
              objectFit: isVampire ? 'contain' : 'cover',
              background: isVampire ? 'transparent' : undefined,
            }}
          />
        </div>

      </div>
    </>
  );
};

export default UnikoMascot;
