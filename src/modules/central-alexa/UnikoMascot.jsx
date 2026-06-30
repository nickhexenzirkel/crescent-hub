// src/modules/central-alexa/UnikoMascot.jsx
import React, { useState, useEffect } from 'react';
import { getAssistantSkin } from '../../shared/assistantSkin';

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

const BLINK_SEQ = [
  { key: 'open',   ms: 2600 },
  { key: 'mid',    ms: 80   },
  { key: 'closed', ms: 130  },
  { key: 'mid',    ms: 80   },
];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

const MASCOT_CSS = `
@keyframes unikoFloat { 0%,100%{transform:translateY(0px);} 50%{transform:translateY(-8px);} }
@keyframes vampBubblePulse {
  0%,100% { border-color:#c41e3a55; box-shadow:0 2px 8px #c41e3a22; }
  50%      { border-color:#c41e3a99; box-shadow:0 2px 22px #c41e3a55; }
}
@keyframes normalBubble {
  0%,100% { border-color:rgba(255,255,255,.16); }
  50%      { border-color:rgba(255,255,255,.38); }
}
.vamp-bubble  { animation: vampBubblePulse 2.5s ease-in-out infinite; }
.normal-bubble{ animation: normalBubble 3s ease-in-out infinite; }
`;

// songSkin: skin do DJ da música atual (vem do Supabase via index.jsx)
const UnikoMascot = ({ track, colors = null, size = 160, songSkin = 'default' }) => {
  const isVampire = songSkin !== 'default';
  const skin      = getAssistantSkin(songSkin);

  const [line,     setLine]     = useState(() => rand(DJ_LINES));
  const [blinkImg, setBlinkImg] = useState(null);

  // Blink loop — só quando skin especial
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
  }, [isVampire, songSkin]); // eslint-disable-line

  // Troca de linha ao mudar modo ou música
  useEffect(() => { setLine(rand(isVampire ? VAMPIRE_LINES : DJ_LINES)); }, [isVampire]);
  useEffect(() => { if (!track?.name) return; setLine(rand(isVampire ? VAMPIRE_LINES : DJ_LINES)); }, [track?.name]); // eslint-disable-line
  useEffect(() => {
    const id = setInterval(() => setLine(rand(isVampire ? VAMPIRE_LINES : DJ_LINES)), 7000);
    return () => clearInterval(id);
  }, [isVampire]);

  // Cor do bubble via cores da capa quando não é vampire
  const c0 = colors?.[0] ?? null;
  const c1 = colors?.[1] ?? colors?.[0] ?? null;
  const albumBubbleCss = (!isVampire && c0)
    ? `@keyframes albumBubble{0%,100%{border-color:${c0}55;box-shadow:0 2px 14px ${c0}33;}50%{border-color:${c1}cc;box-shadow:0 2px 28px ${c1}66;}}.normal-bubble{animation:albumBubble 3s ease-in-out infinite;}`
    : '';

  const img = isVampire ? (blinkImg || skin.blink.open) : DEFAULT_IMG;

  return (
    <>
      <style>{MASCOT_CSS}{albumBubbleCss}</style>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, userSelect:'none', position:'relative', zIndex:2 }}>

        {/* Balão de fala */}
        <div
          className={isVampire ? 'vamp-bubble' : 'normal-bubble'}
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
            filter: isVampire
              ? 'drop-shadow(0 0 10px #c41e3a88) drop-shadow(0 4px 12px rgba(0,0,0,.5))'
              : 'drop-shadow(0 4px 12px rgba(0,0,0,.25))',
            transition: 'filter .4s',
          }}
        />

      </div>
    </>
  );
};

export default UnikoMascot;
