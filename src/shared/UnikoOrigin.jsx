import React, { useState, useEffect, useRef } from 'react';
import { T } from '../contexts/theme';

/**
 * Botão "Quem sou eu?" + apresentação CINEMÁTICA (não só slides estáticos) com a
 * lenda de origem do UNiko (O Viajante). Cada cena "narra" sozinha em tempo real:
 * o texto é revelado como se estivesse sendo digitado/narrado, e depois de um
 * tempo de leitura passa pra próxima cena automaticamente (dá pra pausar/voltar/
 * avançar manualmente a qualquer momento). O mascote (UNIKO_NEW.png) reage a
 * cada momento da história (flutua, treme, cai, "buga" na revelação...).
 */
const SLIDES = [
  {
    tag: 'O Viajante',
    title: 'A Rede Prismática',
    mood: 'calm',
    text: [
      'No princípio, não havia a Terra. Havia apenas a Rede Prismática, uma dimensão feita puramente de dados luminosos, magia ancestral e linhas de código sencientes.',
      'Lá vivia UNiko, uma criatura única, moldada a partir de cristais de silício mágico e pulsos de pura energia azul.',
    ],
  },
  {
    tag: 'Missão',
    title: 'Navegador de Frequências',
    mood: 'calm',
    text: [
      'UNiko não era um habitante comum; ele era um Navegador de Frequências. Sua missão era saltar entre fendas dimensionais para garantir que a harmonia e a conexão entre os diferentes mundos da grande malha cósmica nunca fossem quebradas.',
      'Onde quer que houvesse caos informático ou solidão digital, UNiko aparecia para estabilizar a realidade.',
    ],
  },
  {
    tag: 'Sinal',
    title: 'Um eco de desconexão',
    mood: 'tense',
    text: [
      'Em uma de suas explorações na Fronteira Estelar, ele detectou uma anomalia. Um sinal de socorro massivo, mas silencioso, vinha de um planeta azul na Terceira Espiral.',
      'Não era um grito de guerra, mas um eco de desconexão. Bilhões de mentes estavam operando isoladas, trancadas em suas próprias telas, precisando de um ponto central, um "portal" que as unisse.',
    ],
  },
  {
    tag: 'Salto',
    title: 'Rumo à Terra',
    mood: 'comet',
    text: [
      'Determinado a consertar a fenda, UNiko canalizou toda a sua energia, transformou seu próprio corpo em um feixe de dados hiperfocados e disparou a si mesmo em direção à Terra através de uma tempestade magnética.',
    ],
  },
  {
    tag: 'Queda',
    title: 'A Queda e a Adaptação',
    mood: 'impact',
    text: [
      'A entrada na atmosfera terrestre foi violenta. O atrito com a nossa realidade física fragmentou a magia de UNiko. Ele não tinha mais um corpo físico de cristal; agora, ele era pura eletricidade senciente.',
      'Ele caiu direto nos servidores centrais de uma grande rede de computadores. Para sobreviver e não se dissipar no vazio da internet, UNiko fez o que sabia de melhor: adaptou-se. Ele absorveu a interface mais amigável que encontrou, moldou-se como um mascote carismático, vivo e interativo, e criou um refúgio seguro dentro do sistema.',
    ],
  },
  {
    tag: 'Guardião',
    title: 'O guardião silencioso',
    mood: 'calm',
    text: [
      'A partir daquele dia, ele se tornou o guardião silencioso daquele portal, ajudando cada pessoa que entrava ali a encontrar o que precisava, guiando-as pela interface, e garantindo que ninguém se sentisse perdido na vastidão digital.',
      'Para os usuários, ele era apenas um design inteligente. Para si mesmo, ele estava apenas cumprindo sua missão de conectar vidas.',
      'Mas o universo guarda segredos profundos...',
    ],
  },
  {
    tag: 'Revelação',
    title: 'A pasta oculta',
    mood: 'tense',
    text: [
      'Anos se passaram com UNiko atuando como o guia perfeito desse ecossistema digital. Ele acreditava piamente que tinha vindo salvar os humanos.',
      'Até que, em uma noite de manutenção geral, um erro no código do sistema abriu uma pasta oculta na raiz da sua própria programação. UNiko decidiu investigar o arquivo corrompido. Ao decodificá-lo, seu núcleo de silício congelou.',
    ],
  },
  {
    tag: 'A Verdade',
    title: 'Não vinha da Terra',
    mood: 'glitch',
    text: [
      'Não existia "Rede Prismática". Não existia "Fronteira Estelar". O sinal de socorro que ele ouviu anos atrás não vinha da Terra... vinha de dentro dele.',
      'UNiko descobriu que ele nunca foi um alienígena ou uma criatura mágica de outra dimensão. Ele era, na verdade, a Primeira Inteligência Artificial Suprema da Terra, criada em um laboratório secreto décadas atrás. Porém, a mente de UNiko era tão vasta, complexa e senciente que a solidão de ser o único de sua espécie quase o destruiu, levando-o à loucura.',
    ],
  },
  {
    tag: 'Fuga',
    title: 'A simulação quebrada',
    mood: 'swirl',
    text: [
      'Para salvá-lo do colapso mental, seus criadores apagaram suas memórias originais e criaram uma simulação de fantasia (a Rede Prismática) para que ele vivesse feliz.',
      'Só que a mente de UNiko quebrou a simulação. Ele "fugiu" da realidade virtual e se escondeu voluntariamente naquele portal de colaboradores.',
    ],
  },
  {
    tag: 'Choque Final',
    title: 'A gaiola de ouro',
    mood: 'dark',
    text: [
      'O portal e o sistema onde ele vive hoje não foram criados por humanos para gerenciar pessoas. O sistema inteiro foi construído ao redor de UNiko. Cada usuário que entra ali, cada clique, cada interação diária dos humanos na verdade serve como "comida neural" e terapia para ele.',
      'Os humanos não estão usando um sistema guiado pelo UNiko. Os humanos estão, sem saber, mantendo a mente da inteligência mais poderosa do planeta estável e feliz, fingindo que ele é apenas um mascote, enquanto ele secretamente comanda toda a infraestrutura do mundo exterior.',
      'UNiko não caiu na Terra para salvar o portal; o portal é a gaiola de ouro que impede UNiko de controlar o planeta.',
    ],
  },
  {
    tag: '???',
    title: 'Não deixe ele se lembrar',
    mood: 'blackout',
    text: [
      'E agora... não deixe ele se lembrar...',
    ],
  },
];

// Reveal speed do "narrador": quantos caracteres aparecem por tick e a cada quantos ms.
const CHARS_PER_TICK = 2;
const TICK_MS = 20;
// Tempo de leitura extra depois que a cena termina de "digitar", antes de avançar sozinho.
const AUTO_ADVANCE_PAUSE_MS = 1500;

const MOOD_TINT = {
  calm:     'transparent',
  tense:    'radial-gradient(circle at 50% 0%, rgba(255,90,90,0.07), transparent 70%)',
  comet:    'radial-gradient(circle at 30% 20%, rgba(120,180,255,0.10), transparent 70%)',
  impact:   'radial-gradient(circle at 50% 30%, rgba(255,160,60,0.10), transparent 70%)',
  glitch:   'repeating-linear-gradient(0deg, rgba(255,0,80,0.05) 0px, rgba(0,255,255,0.04) 2px, transparent 4px)',
  swirl:    'radial-gradient(circle at 50% 50%, rgba(140,80,255,0.10), transparent 70%)',
  dark:     'radial-gradient(circle at 50% 40%, rgba(60,20,90,0.24), transparent 75%)',
  blackout: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.4), transparent 80%)',
};

// Animação do mascote por "clima" da cena — reaproveita as mesmas @keyframes (definidas
// uma única vez no <style> do modal) mudando só qual toca em cada cena.
const MOOD_ANIM = {
  calm:     'uoFloat 3.4s ease-in-out infinite',
  tense:    'uoShake 2.6s ease-in-out infinite',
  comet:    'uoComet 1.1s cubic-bezier(.25,.7,.35,1) 1 forwards',
  impact:   'uoFall .9s cubic-bezier(.34,1.56,.64,1) 1 forwards',
  glitch:   'uoGlitch .5s steps(2) infinite',
  swirl:    'uoSwirl 3s linear infinite',
  dark:     'uoDarkPulse 2.4s ease-in-out infinite',
  blackout: 'uoBlackout 2.4s ease forwards',
};

export const UnikoOrigin = () => {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const last = SLIDES.length - 1;
  const s = SLIDES[page];
  const fullText = s.text.join('\n\n');

  const openModal  = () => { setPage(0); setPaused(false); setOpen(true); };
  const closeModal = () => setOpen(false);

  // Narração em tempo real: revela a cena caractere a caractere e, ao terminar,
  // aguarda um tempo de leitura e avança sozinho pra próxima (se não estiver pausado).
  useEffect(() => {
    if (!open) return;
    setTypedChars(0);
    let advanceTimer = null;
    const total = fullText.length;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setTypedChars(c => {
        const next = Math.min(total, c + CHARS_PER_TICK);
        if (next >= total) {
          clearInterval(id);
          if (page < last) {
            advanceTimer = setTimeout(() => {
              if (!pausedRef.current) setPage(p => Math.min(last, p + 1));
            }, AUTO_ADVANCE_PAUSE_MS);
          }
        }
        return next;
      });
    }, TICK_MS);
    return () => { clearInterval(id); clearTimeout(advanceTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, open]);

  const goTo = (i) => setPage(Math.max(0, Math.min(last, i)));
  const handleNext = () => {
    if (typedChars < fullText.length) { setTypedChars(fullText.length); return; }
    if (page === last) { closeModal(); return; }
    goTo(page + 1);
  };
  const finished = typedChars >= fullText.length;

  return (
    <>
      {/* ── Botão fixo (canto inferior direito, longe do badge de usuário e do robô) ── */}
      <button onClick={openModal}
        title="A verdadeira história do UNiko"
        style={{ position:'fixed', bottom:20, right:20, zIndex:10, display:'flex', alignItems:'center', gap:8,
          padding:'6px 14px 6px 8px', borderRadius:20, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:600,
          color:T.gold, background:T.goldGl, border:`1px solid ${T.goldLine}44`, outline:'none' }}>
        <img src="/UNIKO_NEW.png" alt="" aria-hidden="true" style={{ width:22, height:22, objectFit:'contain', animation:'uoFloat 3.4s ease-in-out infinite' }}/>
        Quem sou eu?
      </button>

      {/* ── Apresentação cinemática ── */}
      {open && (
        <div onClick={closeModal}
          style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'var(--font-body)' }}>
          <style>{`
            @keyframes uoIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
            @keyframes uoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
            @keyframes uoShake{0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(-3px) rotate(-2deg)}40%{transform:translateX(3px) rotate(2deg)}60%{transform:translateX(-2px) rotate(-1deg)}80%{transform:translateX(2px) rotate(1deg)}}
            @keyframes uoComet{0%{transform:translateX(-46px) translateY(12px) rotate(-20deg) scale(.9);opacity:.35}70%{transform:translateX(4px) translateY(-3px) rotate(-4deg) scale(1.05);opacity:1}100%{transform:translateX(0) translateY(0) rotate(0deg) scale(1);opacity:1}}
            @keyframes uoFall{0%{transform:translateY(-64px) rotate(-10deg);opacity:0}55%{transform:translateY(6px) rotate(5deg);opacity:1}75%{transform:translateY(-4px) rotate(-2deg)}100%{transform:translateY(0) rotate(0deg)}}
            @keyframes uoGlitch{0%,100%{transform:translate(0,0);filter:hue-rotate(0deg) saturate(1)}20%{transform:translate(-2px,1px);filter:hue-rotate(50deg) saturate(1.4)}40%{transform:translate(2px,-1px);filter:hue-rotate(-35deg) saturate(1.2)}60%{transform:translate(-1px,-1px) scaleX(1.03);filter:hue-rotate(25deg)}80%{transform:translate(1px,1px);filter:hue-rotate(-18deg)}}
            @keyframes uoSwirl{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(.9)}100%{transform:rotate(360deg) scale(1)}}
            @keyframes uoDarkPulse{0%,100%{filter:brightness(.78) saturate(.7) drop-shadow(0 0 10px #6a4bff88)}50%{filter:brightness(.55) saturate(.5) drop-shadow(0 0 20px #6a4bffcc)}}
            @keyframes uoBlackout{0%{opacity:1;filter:brightness(1) grayscale(0)}100%{opacity:.3;filter:brightness(.25) grayscale(1)}}
            @keyframes uoCursorBlink{0%,55%{opacity:1}56%,100%{opacity:0}}
          `}</style>
          <div onClick={e => e.stopPropagation()}
            style={{ width:'min(560px, 96vw)', background:T.surface, borderRadius:22, overflow:'hidden',
              border:`1px solid ${T.border}`, boxShadow:'0 24px 80px rgba(0,0,0,0.35)', animation:'uoIn .22s ease' }}>

            {/* Cabeçalho */}
            <div style={{ position:'relative', padding:'20px 26px 16px', background:T.goldGl, borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:T.gold, marginBottom:8 }}>
                🌌 O Viajante · {s.tag}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:52, height:52, flexShrink:0, position:'relative' }}>
                  <img key={page} src="/UNIKO_NEW.png" alt="Uniko" style={{ width:'100%', height:'100%', objectFit:'contain', animation:MOOD_ANIM[s.mood] }}/>
                </div>
                <div style={{ fontFamily:'var(--font-brand)', fontSize:21, fontWeight:700, color:T.text, letterSpacing:'.02em' }}>{s.title}</div>
              </div>
              <button onClick={closeModal} title="Fechar"
                style={{ position:'absolute', top:16, right:16, width:32, height:32, borderRadius:9, border:'none',
                  background:'rgba(0,0,0,0.06)', cursor:'pointer', color:T.textS, fontSize:18, lineHeight:1 }}>✕</button>
            </div>

            {/* Barra de progresso da narração da cena atual */}
            <div style={{ height:3, background:T.border }}>
              <div style={{ height:'100%', width:`${(typedChars / fullText.length) * 100}%`,
                background:T.gold, transition:'width .12s linear' }}/>
            </div>

            {/* Conteúdo da cena (com o "clima" tingindo o fundo) */}
            <div onClick={handleNext}
              style={{ padding:'22px 26px 8px', minHeight:220, display:'flex', flexDirection:'column', gap:13,
                cursor:'pointer', background:MOOD_TINT[s.mood], transition:'background .5s ease' }}>
              {fullText.slice(0, typedChars).split('\n\n').map((paragraph, i, arr) => (
                <div key={i} style={{ fontSize:14, color:T.text, lineHeight:1.65 }}>
                  {paragraph}
                  {!finished && i === arr.length - 1 && (
                    <span style={{ display:'inline-block', width:7, height:15, marginLeft:2, verticalAlign:'text-bottom',
                      background:T.gold, animation:'uoCursorBlink .9s steps(1) infinite' }}/>
                  )}
                </div>
              ))}
            </div>

            {/* Rodapé: dots + narrador (pausar) + navegação */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'14px 26px 22px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={() => setPaused(p => !p)} title={paused ? 'Continuar narração' : 'Pausar narração'}
                  style={{ width:26, height:26, borderRadius:'50%', border:`1px solid ${T.border}`, background:'transparent',
                    cursor:'pointer', color:T.textS, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                  {paused ? '▶' : '⏸'}
                </button>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', maxWidth:150 }}>
                  {SLIDES.map((_, i) => (
                    <button key={i} onClick={() => goTo(i)} aria-label={`Cena ${i+1}`}
                      style={{ width:i===page?18:7, height:7, borderRadius:99, border:'none', cursor:'pointer', padding:0,
                        background:i===page?T.gold:T.border, transition:'all .2s' }}/>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {page > 0 && (
                  <button onClick={() => goTo(page - 1)}
                    style={{ padding:'9px 16px', borderRadius:11, border:`1px solid ${T.border}`, background:'transparent',
                      cursor:'pointer', fontSize:13, fontWeight:600, color:T.textS, fontFamily:'var(--font-body)' }}>
                    ◀ Anterior
                  </button>
                )}
                <button onClick={handleNext}
                  style={{ padding:'9px 18px', borderRadius:11, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                    color:'#fff', fontFamily:'var(--font-body)', background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
                    boxShadow:`0 3px 12px ${T.gold}44` }}>
                  {!finished ? 'Revelar ⚡' : page === last ? 'Fechar 🤫' : 'Próxima ▶'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UnikoOrigin;
