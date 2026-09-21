// src/modules/beneficios-7/index.jsx
// 7 Benefícios — a plataforma já existe hospedada separadamente
// (https://7beneficios.vercel.app/); aqui ela só é embutida como um iframe
// de tela inteira dentro do Uniko, com um botão discreto pra voltar aos
// módulos (o site em si não sabe que está dentro do Portal).
//
// `active` controla visibilidade, NÃO montagem: o App.jsx mantém este
// componente montado o tempo todo depois da 1ª visita (em vez de só
// enquanto screen==='7-beneficios'), porque desmontar destruía o <iframe> a
// cada troca de módulo — recarregando o site do zero e derrubando a sessão
// de login dele. Escondido com display:none, o iframe continua vivo (mesmo
// documento, mesma sessão) por baixo.
import { useState } from 'react';
import { T } from '../../contexts/theme';

const SITE_URL = 'https://7beneficios.vercel.app/';

const Beneficios7 = ({ onBack, active = true }) => {
  const [hover, setHover] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 100, display: active ? 'block' : 'none' }}>
      <iframe
        src={SITE_URL}
        title="Portal dos Credenciados"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        allow="clipboard-write"
      />

      {/* Área clicável FIXA (não muda de tamanho no hover — só a opacidade/fundo
          mudam). Antes, fora do hover, o botão encolhia pra ~32x32px só com o
          ícone; um clique impreciso nessa borda passava direto pro iframe por
          baixo, e se o site tiver algum elemento próprio nesse mesmo canto
          (comum: menu/voltar/sair), o clique acertava ELE — lido como "clicar
          em Módulos desloga do site embutido". Hit-box grande e estável evita
          esse vazamento de clique. */}
      <button
        onClick={onBack}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Voltar aos módulos"
        style={{
          position: 'fixed', top: 'calc(12px + env(safe-area-inset-top))', left: 12, zIndex: 101,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 14px', minHeight: 36,
          borderRadius: 999, border: `1px solid ${T.border}`,
          background: hover ? (T.surface || '#fff') : 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          color: T.textS || '#555', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600,
          boxShadow: '0 2px 10px rgba(0,0,0,0.12)', opacity: hover ? 1 : 0.8, transition: 'background .15s, opacity .15s',
        }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        Módulos
      </button>
    </div>
  );
};

export { Beneficios7 };
export default Beneficios7;
