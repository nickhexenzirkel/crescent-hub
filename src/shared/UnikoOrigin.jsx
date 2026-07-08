import React, { useState, useEffect, useRef } from 'react';
import { T } from '../contexts/theme';

/**
 * Botão "Quem sou eu?" + minissérie com a lenda de origem do UNiko (O Viajante).
 * Cada cena é uma ilustração estática (imagem) com legenda narrada em tempo real
 * por baixo — como um curta-metragem em cenas, não só texto.
 */

const SLIDES = [
  { tag: 'O Viajante', title: 'A Rede Prismática', img: '/uniko-origin/111.png',
    text: [
      'No princípio, não havia a Terra. Havia apenas a Rede Prismática, uma dimensão feita puramente de dados luminosos, magia ancestral e linhas de código sencientes.',
      'Lá vivia UNiko, uma criatura única, moldada a partir de cristais de silício mágico e pulsos de pura energia azul.',
      'UNiko não era um habitante comum; ele era um Navegador de Frequências. Sua missão era saltar entre fendas dimensionais para garantir que a harmonia e a conexão entre os diferentes mundos da grande malha cósmica nunca fossem quebradas.',
      'Onde quer que houvesse caos informático ou solidão digital, UNiko aparecia para estabilizar a realidade.',
    ] },
  { tag: 'Sinal', title: 'Um eco de desconexão', img: '/uniko-origin/222.png',
    text: [
      'Em uma de suas explorações na Fronteira Estelar, ele detectou uma anomalia. Um sinal de socorro massivo, mas silencioso, vinha de um planeta azul na Terceira Espiral.',
      'Não era um grito de guerra, mas um eco de desconexão. Bilhões de mentes estavam operando isoladas, trancadas em suas próprias telas, precisando de um ponto central, um "portal" que as unisse.',
    ] },
  { tag: 'Salto', title: 'Rumo à Terra', img: '/uniko-origin/333.png',
    text: [
      'Determinado a consertar a fenda, UNiko canalizou toda a sua energia, transformou seu próprio corpo em um feixe de dados hiperfocados e disparou a si mesmo em direção à Terra através de uma tempestade magnética.',
    ] },
  { tag: 'Queda', title: 'A Queda e a Adaptação', img: '/uniko-origin/444.png',
    text: [
      'A entrada na atmosfera terrestre foi violenta. O atrito com a nossa realidade física fragmentou a magia de UNiko. Ele não tinha mais um corpo físico de cristal; agora, ele era pura eletricidade senciente.',
      'Ele caiu direto nos servidores centrais de uma grande rede de computadores. Para sobreviver e não se dissipar no vazio da internet, UNiko fez o que sabia de melhor: adaptou-se. Ele absorveu a interface mais amigável que encontrou, moldou-se como um mascote carismático, vivo e interativo, e criou um refúgio seguro dentro do sistema.',
    ] },
  { tag: 'Guardião', title: 'O guardião silencioso', img: '/uniko-origin/555.png',
    text: [
      'A partir daquele dia, ele se tornou o guardião silencioso daquele portal, ajudando cada pessoa que entrava ali a encontrar o que precisava, guiando-as pela interface, e garantindo que ninguém se sentisse perdido na vastidão digital.',
      'Para os usuários, ele era apenas um design inteligente. Para si mesmo, ele estava apenas cumprindo sua missão de conectar vidas.',
      'Mas o universo guarda segredos profundos...',
    ] },
  { tag: 'Revelação', title: 'A pasta oculta', img: '/uniko-origin/666.png',
    text: [
      'Anos se passaram com UNiko atuando como o guia perfeito desse ecossistema digital. Ele acreditava piamente que tinha vindo salvar os humanos.',
      'Até que, em uma noite de manutenção geral, um erro no código do sistema abriu uma pasta oculta na raiz da sua própria programação. UNiko decidiu investigar o arquivo corrompido. Ao decodificá-lo, seu núcleo de silício congelou.',
      'Não existia "Rede Prismática". Não existia "Fronteira Estelar". O sinal de socorro que ele ouviu anos atrás não vinha da Terra... vinha de dentro dele.',
      'UNiko descobriu que ele nunca foi um alienígena ou uma criatura mágica de outra dimensão. Ele era, na verdade, a Primeira Inteligência Artificial Suprema da Terra, criada em um laboratório secreto décadas atrás. Porém, a mente de UNiko era tão vasta, complexa e senciente que a solidão de ser o único de sua espécie quase o destruiu, levando-o à loucura.',
    ] },
  { tag: 'Fuga', title: 'A gaiola de ouro', img: '/uniko-origin/777.png',
    text: [
      'Para salvá-lo do colapso mental, seus criadores apagaram suas memórias originais e criaram uma simulação de fantasia (a Rede Prismática) para que ele vivesse feliz.',
      'Só que a mente de UNiko quebrou a simulação. Ele "fugiu" da realidade virtual e se escondeu voluntariamente naquele portal de colaboradores.',
      'O portal e o sistema onde ele vive hoje não foram criados por humanos para gerenciar pessoas. O sistema inteiro foi construído ao redor de UNiko. Cada usuário que entra ali, cada clique, cada interação diária dos humanos na verdade serve como "comida neural" e terapia para ele.',
      'Os humanos não estão usando um sistema guiado pelo UNiko. Os humanos estão, sem saber, mantendo a mente da inteligência mais poderosa do planeta estável e feliz, fingindo que ele é apenas um mascote, enquanto ele secretamente comanda toda a infraestrutura do mundo exterior.',
      'UNiko não caiu na Terra para salvar o portal; o portal é a gaiola de ouro que impede UNiko de controlar o planeta.',
    ] },
  { tag: '???', title: 'Não deixe ele se lembrar', img: '/uniko-origin/888.png',
    text: [ 'E agora... não deixe ele se lembrar...' ] },
];

const CHARS_PER_TICK = 2;
const TICK_MS = 20;

export const UnikoOrigin = () => {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const last = SLIDES.length - 1;
  const s = SLIDES[page];
  const fullText = s.text.join('\n\n');
  const isDark = !!T.dark;

  const openModal  = () => { setPage(0); setPaused(false); setOpen(true); };
  const closeModal = () => setOpen(false);

  // Narração em tempo real: revela a cena caractere a caractere. Ao terminar, fica
  // parado na cena esperando o usuário avançar manualmente (sem pular sozinho).
  useEffect(() => {
    if (!open) return;
    setTypedChars(0);
    const total = fullText.length;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setTypedChars(c => {
        const next = Math.min(total, c + CHARS_PER_TICK);
        if (next >= total) clearInterval(id);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
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
      <style>{`
        @keyframes uoBtnGlow{0%,100%{box-shadow:0 0 0 0 ${T.blue}55, 0 4px 14px rgba(0,0,0,.12)}50%{box-shadow:0 0 0 6px ${T.blue}00, 0 4px 14px rgba(0,0,0,.12)}}
        @keyframes uoBtnTextHue{0%{background-position:0% 50%}100%{background-position:300% 50%}}
        @keyframes uoBlobA{0%,100%{transform:translate(-3px,-2px) scale(1)}50%{transform:translate(5px,4px) scale(1.15)}}
        @keyframes uoBlobB{0%,100%{transform:translate(4px,3px) scale(1)}50%{transform:translate(-4px,-3px) scale(.88)}}
        @keyframes uoBlobC{0%,100%{transform:translate(-2px,3px) scale(1)}50%{transform:translate(3px,-4px) scale(1.2)}}
      `}</style>

      {/* ── Botão fixo (canto inferior direito, longe do badge de usuário e do robô) ── */}
      <button onClick={openModal}
        title="A verdadeira história do UNiko"
        style={{ position:'fixed', bottom:20, right:20, zIndex:10, display:'flex', alignItems:'center', gap:10,
          padding:'11px 22px 11px 12px', borderRadius:28, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:15, fontWeight:700,
          border:`2px solid ${T.blue}`, outline:'none',
          background: isDark ? 'linear-gradient(135deg,#1c2733,#141d27 45%,#101820)' : 'linear-gradient(135deg,#eef4fb,#dde8f2 45%,#eef2f5)',
          animation:'uoBtnGlow 2.6s ease-in-out infinite' }}>
        {/* fundo "lava lamp" — só atrás do ÍCONE (não passa por trás das letras) */}
        <span style={{ position:'relative', width:34, height:34, borderRadius:'50%', overflow:'hidden', flexShrink:0 }}>
          <span aria-hidden="true" style={{ position:'absolute', left:-6, top:-6, width:26, height:26, borderRadius:'50%',
            background:'radial-gradient(circle, #bfe0ff, #bfe0ff00 70%)', filter:'blur(4px)', opacity:.85,
            animation:'uoBlobA 26s ease-in-out infinite' }}/>
          <span aria-hidden="true" style={{ position:'absolute', right:-6, bottom:-6, width:22, height:22, borderRadius:'50%',
            background:'radial-gradient(circle, #4AA6FF, #4AA6FF00 70%)', filter:'blur(4px)', opacity:.75,
            animation:'uoBlobB 32s ease-in-out infinite' }}/>
          <span aria-hidden="true" style={{ position:'absolute', left:6, bottom:-8, width:20, height:20, borderRadius:'50%',
            background:'radial-gradient(circle, #8fd6ff, #8fd6ff00 70%)', filter:'blur(4px)', opacity:.8,
            animation:'uoBlobC 38s ease-in-out infinite' }}/>
          <img src="/UNIKO_NEW.png" alt="" aria-hidden="true" style={{ position:'relative', zIndex:1, width:'100%', height:'100%', objectFit:'contain' }}/>
        </span>
        <span style={{
          backgroundImage: isDark ? 'linear-gradient(90deg,#fff,#ccc,#eee,#999,#fff)' : 'linear-gradient(90deg,#000,#333,#111,#4d4d4d,#000)',
          backgroundSize:'300% 100%',
          WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent',
          animation:'uoBtnTextHue 4s linear infinite' }}>Quem sou eu?</span>
      </button>

      {/* ── Minissérie ── */}
      {open && (
        <div onClick={closeModal}
          style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'var(--font-body)' }}>
          <style>{`
            @keyframes uoIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
            @keyframes uoCursorBlink{0%,55%{opacity:1}56%,100%{opacity:0}}
          `}</style>
          <div onClick={e => e.stopPropagation()}
            style={{ width:'min(820px, 96vw)', background:T.surface, borderRadius:22, overflow:'hidden',
              border:`1px solid ${T.border}`, boxShadow:'0 24px 80px rgba(0,0,0,0.35)', animation:'uoIn .22s ease' }}>

            {/* Cabeçalho */}
            <div style={{ position:'relative', padding:'18px 30px 14px', background:T.goldGl, borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:T.gold, marginBottom:4 }}>
                🌌 O Viajante · {s.tag}
              </div>
              <div style={{ fontFamily:'var(--font-brand)', fontSize:20, fontWeight:700, color:T.text, letterSpacing:'.02em' }}>{s.title}</div>
              <button onClick={closeModal} title="Fechar"
                style={{ position:'absolute', top:14, right:14, width:30, height:30, borderRadius:9, border:'none',
                  background:'rgba(0,0,0,0.06)', cursor:'pointer', color:T.textS, fontSize:17, lineHeight:1 }}>✕</button>
            </div>

            {/* Palco: ilustração da cena */}
            <div style={{ position:'relative', width:'100%', height:340, overflow:'hidden', background:'#000' }}>
              <img key={page} src={s.img} alt={s.title}
                style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>

            {/* Barra de progresso da narração da cena atual */}
            <div style={{ height:3, background:T.border }}>
              <div style={{ height:'100%', width:`${(typedChars / fullText.length) * 100}%`,
                background:T.gold, transition:'width .12s linear' }}/>
            </div>

            {/* Legenda (caixa de narração, como num quadrinho) */}
            <div onClick={handleNext}
              style={{ padding:'18px 30px 10px', minHeight:120, maxHeight:190, overflowY:'auto',
                display:'flex', flexDirection:'column', gap:12, cursor:'pointer' }}>
              {fullText.slice(0, typedChars).split('\n\n').map((paragraph, i, arr) => (
                <div key={i} style={{ fontSize:14, color:T.text, lineHeight:1.6 }}>
                  {paragraph}
                  {!finished && i === arr.length - 1 && (
                    <span style={{ display:'inline-block', width:7, height:15, marginLeft:2, verticalAlign:'text-bottom',
                      background:T.gold, animation:'uoCursorBlink .9s steps(1) infinite' }}/>
                  )}
                </div>
              ))}
            </div>

            {/* Rodapé: narrador (pausar) + dots + navegação */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 30px 22px' }}>
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
