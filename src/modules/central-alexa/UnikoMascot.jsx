// src/modules/central-alexa/UnikoMascot.jsx
import React, { useState, useEffect } from 'react';
import { getActiveAssistantSkinId, getAssistantSkin, onAssistantSkinChange } from '../../shared/assistantSkin';

const DEFAULT_IMG = '/UNIKO_ALEXACENTRAL.png';

const LINES = [
  'Bora colocar aquela música massa! 🎵',
  'Qualquer pedido, tô na área! 🎧',
  'Som no sistema, pode pedir! ⚡',
  'DJ da 7 Benefícios presenteando! 🎶',
  'Curtindo o som com vocês! 🎤',
  'Que batida incrível essa! 🔥',
];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

const UnikoMascot = ({ track, colors = null, size = 160, requestedBy, myName }) => {
  const [skinId, setSkinId] = useState(() => getActiveAssistantSkinId());
  const [line, setLine]     = useState(() => rand(LINES));

  // Sincroniza skin quando muda via assistente
  useEffect(() => onAssistantSkinChange(id => setSkinId(id)), []);

  // Troca fala ao mudar música
  useEffect(() => {
    if (!track?.name) return;
    setLine(rand(LINES));
  }, [track?.name]);

  // Rotação automática de fala a cada 7s
  useEffect(() => {
    const id = setInterval(() => setLine(rand(LINES)), 7000);
    return () => clearInterval(id);
  }, []);

  // Imagem: skin especial do usuário quando a música é dele
  const isMyMusic = requestedBy && myName && requestedBy === myName;
  const skin = getAssistantSkin(skinId);
  const img = (isMyMusic && skinId !== 'default')
    ? (skin.sprites?.ALEXA || DEFAULT_IMG)
    : DEFAULT_IMG;

  // Pulso animado com as cores da capa
  const c0 = colors?.[0] ?? null;
  const c1 = colors?.[1] ?? colors?.[0] ?? null;
  const bubbleCss = c0
    ? `@keyframes bubbleBorder{0%,100%{border-color:${c0}55;box-shadow:0 2px 14px ${c0}33;}50%{border-color:${c1}cc;box-shadow:0 2px 28px ${c1}66;}}.uniko-bubble{animation:bubbleBorder 3s ease-in-out infinite;}`
    : `@keyframes bubbleBorder{0%,100%{border-color:rgba(255,255,255,0.16);}50%{border-color:rgba(255,255,255,0.38);}}.uniko-bubble{animation:bubbleBorder 3s ease-in-out infinite;}`;

  return (
    <>
      <style>{bubbleCss}</style>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, userSelect:'none' }}>

        {/* Balão de fala */}
        <div className="uniko-bubble" style={{
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
        }}>
          {line}
        </div>

        {/* Avatar circular */}
        <div style={{
          width:        size,
          height:       size,
          borderRadius: '50%',
          overflow:     'hidden',
          border:       '2.5px solid rgba(255,255,255,0.14)',
          boxShadow:    '0 8px 32px rgba(0,0,0,0.20)',
          flexShrink:   0,
        }}>
          <img
            src={img}
            alt="UNIKO"
            style={{ width:'100%', height:'100%', objectFit:'cover' }}
          />
        </div>

      </div>
    </>
  );
};

export default UnikoMascot;
