// src/modules/beneficios-7/index.jsx
// Portal dos Credenciados (7 Benefícios) — a plataforma já existe hospedada
// separadamente (https://7beneficios.vercel.app/); aqui ela só é embutida
// como iframe dentro do Uniko (o site em si não sabe que está embutido).
//
// `active` controla visibilidade, NÃO montagem: o App.jsx mantém este
// componente montado o tempo todo depois da 1ª visita (em vez de só
// enquanto screen==='7-beneficios'), porque desmontar destruía o <iframe> a
// cada troca de módulo — recarregando o site do zero e derrubando a sessão
// de login dele. Escondido com display:none, o iframe continua vivo (mesmo
// documento, mesma sessão) por baixo — sobrevive a navegar por outros
// módulos e voltar. NÃO sobrevive a um F5 de verdade (isso reinicia o app
// inteiro, React e tudo) — aí o iframe nasce de novo e pede login de novo;
// é uma limitação de embutir um site de terceiro, não tem como contornar
// só do lado do Uniko sem soltar mão do iframe (ver conversa com o usuário).
//
// O botão "Módulos" NÃO fica flutuando por cima do iframe: antes ficava
// (canto superior esquerdo), e depois de logar como Administrador o clique
// nele estava vazando pro site por baixo — alguma coisa própria do 7
// Benefícios nesse mesmo canto (menu/sair) capturava o clique antes,
// deslogando o site em vez de voltar pro Uniko. Uma faixa de topo PRÓPRIA,
// fora da área do iframe, elimina esse risco de vez: não há como um clique
// nela nunca alcançar o conteúdo do site.
//
// Iframe ESCONDIDO (display:none) tem os timers desacelerados pelo
// navegador, inclusive o de renovação automática do token de login do site
// embutido — se o token vence enquanto escondido, a sessão cai sem aviso.
// O documento do iframe não tem como perceber sozinho que um ancestral o
// escondeu via CSS (a Page Visibility API dele só reflete a ABA inteira,
// não isso) — por isso avisamos explicitamente por postMessage sempre que
// o módulo volta a ficar visível, pra ele revalidar/renovar a sessão na
// hora (ver o listener em 7beneficios: src/lib/auth.tsx).
import { useEffect, useRef } from 'react';
import { T } from '../../contexts/theme';

const SITE_URL = 'https://7beneficios.vercel.app/';
const SITE_ORIGIN = 'https://7beneficios.vercel.app';
const BAR_HEIGHT = 44;

const Beneficios7 = ({ onBack, active = true }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'uniko-hub', type: 'module-visible' }, SITE_ORIGIN);
  }, [active]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 100, display: active ? 'flex' : 'none', flexDirection: 'column' }}>
      <div style={{
        height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-top))`, paddingTop: 'env(safe-area-inset-top)', flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.94)'),
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.border}`,
      }}>
        <button onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: T.surfaceSub || 'rgba(0,0,0,0.04)',
            border: `1px solid ${T.border}`, borderRadius: 9, cursor: 'pointer', color: T.textS, outline: 'none', fontFamily: 'var(--font-body)', fontSize: 13 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          Módulos
        </button>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 14, fontWeight: 700, color: T.text }}>Portal dos Credenciados</div>
      </div>

      <iframe
        ref={iframeRef}
        src={SITE_URL}
        title="Portal dos Credenciados"
        style={{ flex: 1, minHeight: 0, width: '100%', border: 'none' }}
        allow="clipboard-write"
      />
    </div>
  );
};

export { Beneficios7 };
export default Beneficios7;
