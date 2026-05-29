// src/modules/central-alexa/UnikoMascot.jsx
import React, { useState, useEffect, useRef } from 'react';
import { detectMascotVariant, getRandomLine, MASCOTS } from './genreUtils';

/**
 * UnikoMascot
 * Exibe automaticamente o mascote certo para o gênero da música tocando.
 *
 * Props:
 *   track  — objeto da música atual: { name, artist, genre }
 *   size   — tamanho em px do avatar circular (padrão: 160)
 */
const UnikoMascot = ({ track, size = 160 }) => {
  const variant    = detectMascotVariant(track);
  const mascot     = MASCOTS[variant];
  const prevVar    = useRef(variant);

  const [line,    setLine]    = useState(() => getRandomLine(variant));
  const [opacity, setOpacity] = useState(1);

  // Ao mudar de GÊNERO → fade out → troca mascote → fade in
  useEffect(() => {
    if (prevVar.current === variant) return;
    prevVar.current = variant;

    setOpacity(0);
    const t = setTimeout(() => {
      setLine(getRandomLine(variant));
      setOpacity(1);
    }, 280);
    return () => clearTimeout(t);
  }, [variant]);

  // Ao mudar só a MÚSICA (mesmo gênero) → sorteia nova fala sem fade
  useEffect(() => {
    if (!track?.name) return;
    setLine(getRandomLine(variant));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.name]);

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      gap:            10,
      opacity,
      transition:     'opacity .28s ease',
      userSelect:     'none',
    }}>

      {/* ── Balão de fala ── */}
      <div style={{
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
        boxShadow:            '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        {line}
      </div>

      {/* ── Avatar circular ── */}
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
          src={mascot.img}
          alt={mascot.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* ── Nome e título ── */}
      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{
          fontSize:      11,
          fontWeight:    700,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          opacity:       .62,
        }}>
          {mascot.name}
        </div>
        <div style={{ fontSize: 10, opacity: .40 }}>
          {mascot.title}
        </div>
      </div>

    </div>
  );
};

export default UnikoMascot;
