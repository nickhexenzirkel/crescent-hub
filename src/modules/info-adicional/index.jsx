// src/modules/info-adicional/index.jsx
// Módulo "Informações Adicionais" — reúne em duas abas o que antes eram dois
// botões flutuantes soltos por cima de toda a tela de módulos (Instalar
// Aplicativo e Sobre o Uniko/O Viajante). Conteúdo idêntico ao que já
// existia, só que agora é uma página normal (com "← Módulos" de volta) em
// vez de um botão-modal grudado no canto da tela.
import { useState, useEffect, useRef } from 'react';
import { T } from '../../contexts/theme';

/* ═══════════════ Aba "Instalar Aplicativo" ═══════════════════════════════
   Tutorial estático (passo a passo com prints) de como adicionar o Portal à
   Tela de Início do iPhone e configurar notificações. Sem Supabase/estado. */
const PASSOS_INSTALAR = [
  { texto: 'No Safari, com o Portal aberto, toque nos três pontinhos (•••) no canto da barra de baixo.', img: '/tutorial-app/instalar-1-menu.jpg' },
  { texto: 'Toque em "Compartilhar".', img: '/tutorial-app/instalar-2-compartilhar.jpg' },
  { texto: 'Role a lista e toque em "Adicionar à Tela de Início".', img: '/tutorial-app/instalar-3-adicionar-tela.jpg' },
  { texto: 'Abra o Portal pelo ícone novo (não pelo Safari) e faça login normalmente.', img: '/tutorial-app/instalar-4-login.jpg' },
  { texto: 'Quando o iPhone perguntar se pode mandar notificação, toque em "Permitir".', img: '/tutorial-app/instalar-5-permitir-ios.jpg' },
  { texto: 'Dentro do Uniko FIT, toque em "Ativar" no aviso laranja pra receber comentário, curtida e mensagem do Bate-Papo no celular.', img: '/tutorial-app/instalar-6-ativar-unikofit.jpg' },
];
const PASSOS_NOTIF = [
  { texto: 'Abra os Ajustes do iPhone.', img: null },
  { texto: 'Vá até "Notificações".', img: '/tutorial-app/notif-2-ajustes-notificacoes.jpg' },
  { texto: 'Procure pelo U∩IKO na lista de aplicativos (ordem alfabética).', img: '/tutorial-app/notif-3-lista-apps.jpg' },
  { texto: 'Se não quiser o aviso aparecendo NA TELA (só receber sem popup), desmarque a opção "Banners".', img: '/tutorial-app/notif-4-banners.jpg' },
];

const IcoSeta = ({ dir }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points={dir === 'prev' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
  </svg>
);

const AbaInstalar = () => {
  const [aba, setAba] = useState('instalar'); // instalar | notificacao
  const [passoIdx, setPassoIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const passos = aba === 'instalar' ? PASSOS_INSTALAR : PASSOS_NOTIF;
  const passo = passos[passoIdx];

  useEffect(() => { setPassoIdx(0); setZoom(false); }, [aba]);

  const mudarAba = (id) => { if (id !== aba) setAba(id); };
  const irPasso = (delta) => setPassoIdx(i => Math.max(0, Math.min(passos.length - 1, i + delta)));

  return (
    <div style={{ width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: T.surface, borderRadius: 20,
      overflow: 'hidden', border: `1px solid ${T.border}`, boxShadow: T.shL }}>
      <div style={{ padding: '18px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
          {[['instalar', 'Instalar Aplicativo'], ['notificacao', 'Configurar Notificação']].map(([id, label]) => {
            const sel = aba === id;
            return (
              <button key={id} onClick={() => mudarAba(id)}
                style={{ padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
                  border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : 'transparent', color: sel ? T.gold : T.textS, whiteSpace: 'nowrap' }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: T.textT, letterSpacing: '.04em' }}>PASSO {passoIdx + 1} DE {passos.length}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: T.page, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.goldGl, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, flexShrink: 0 }}>{passoIdx + 1}</div>
          <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.45 }}>{passo.texto}</div>
        </div>

        {passo.img && (
          <div onClick={() => setZoom(true)} role="button" aria-label="Ver imagem em tela grande"
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: T.page, border: `1px solid ${T.border}`, borderRadius: 14, padding: 10, cursor: 'zoom-in', minHeight: 260 }}>
            <img src={passo.img} alt={`Passo ${passoIdx + 1}`} style={{ maxWidth: '100%', maxHeight: '48vh', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: 8 }} />
          </div>
        )}

        {aba === 'notificacao' && passoIdx === passos.length - 1 && (
          <div style={{ fontSize: 11.5, color: T.textT, textAlign: 'center', lineHeight: 1.5 }}>
            Desmarcar "Banners" não desativa a notificação — ela continua chegando na Central de Notificações e no ícone, só não aparece um aviso na tela na hora.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 4 }}>
          <button onClick={() => irPasso(-1)} disabled={passoIdx === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 16px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: 'transparent',
              color: passoIdx === 0 ? T.textD : T.text, cursor: passoIdx === 0 ? 'default' : 'pointer', opacity: passoIdx === 0 ? .45 : 1, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
            <IcoSeta dir="prev" /> Anterior
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {passos.map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === passoIdx ? T.gold : T.border }} />
            ))}
          </div>
          <button onClick={() => irPasso(1)} disabled={passoIdx === passos.length - 1}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 18px', borderRadius: 999, border: 'none', cursor: passoIdx === passos.length - 1 ? 'default' : 'pointer',
              background: T.gold, color: '#fff', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', opacity: passoIdx === passos.length - 1 ? .45 : 1 }}>
            Próximo <IcoSeta dir="next" />
          </button>
        </div>
      </div>

      {zoom && passo.img && (
        <div onClick={() => setZoom(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <button onClick={() => setZoom(false)} aria-label="Fechar"
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <img src={passo.img} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '92%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }} />
        </div>
      )}
    </div>
  );
};

/* ═══════════════ Aba "Sobre o Uniko" ══════════════════════════════════════
   Minissérie com a lenda de origem do UNiko (O Viajante) — narração em tempo
   real, caractere a caractere. */
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

const AbaSobre = () => {
  const [page, setPage] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const last = SLIDES.length - 1;
  const s = SLIDES[page];
  const fullText = s.text.join('\n\n');

  useEffect(() => {
    SLIDES.forEach(sl => { const img = new Image(); img.src = sl.img; });
  }, []);

  useEffect(() => {
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
  }, [page]);

  const goTo = (i) => setPage(Math.max(0, Math.min(last, i)));
  const handleNext = () => {
    if (typedChars < fullText.length) { setTypedChars(fullText.length); return; }
    goTo(page === last ? 0 : page + 1);
  };
  const finished = typedChars >= fullText.length;

  return (
    <div style={{ width: '100%', background: T.surface, borderRadius: 22, overflow: 'hidden',
      border: `1px solid ${T.border}`, boxShadow: T.shL }}>
      <style>{`@keyframes uoCursorBlink{0%,55%{opacity:1}56%,100%{opacity:0}}`}</style>

      <div style={{ position: 'relative', padding: '18px 30px 14px', background: T.goldGl, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.gold, marginBottom: 4 }}>
          🌌 O Viajante · {s.tag}
        </div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: '.02em' }}>{s.title}</div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: 340, overflow: 'hidden', background: '#000' }}>
        <img key={page} src={s.img} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <div style={{ height: 3, background: T.border }}>
        <div style={{ height: '100%', width: `${(typedChars / fullText.length) * 100}%`, background: T.gold, transition: 'width .12s linear' }} />
      </div>

      <div onClick={handleNext}
        style={{ padding: '18px 30px 10px', minHeight: 120, maxHeight: 190, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}>
        {fullText.slice(0, typedChars).split('\n\n').map((paragraph, i, arr) => (
          <div key={i} style={{ fontSize: 14, color: T.text, lineHeight: 1.6 }}>
            {paragraph}
            {!finished && i === arr.length - 1 && (
              <span style={{ display: 'inline-block', width: 7, height: 15, marginLeft: 2, verticalAlign: 'text-bottom',
                background: T.gold, animation: 'uoCursorBlink .9s steps(1) infinite' }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 30px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setPaused(p => !p)} title={paused ? 'Continuar narração' : 'Pausar narração'}
            style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${T.border}`, background: 'transparent',
              cursor: 'pointer', color: T.textS, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            {paused ? '▶' : '⏸'}
          </button>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 150 }}>
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} aria-label={`Cena ${i + 1}`}
                style={{ width: i === page ? 18 : 7, height: 7, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
                  background: i === page ? T.gold : T.border, transition: 'all .2s' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {page > 0 && (
            <button onClick={() => goTo(page - 1)}
              style={{ padding: '9px 16px', borderRadius: 11, border: `1px solid ${T.border}`, background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textS, fontFamily: 'var(--font-body)' }}>
              ◀ Anterior
            </button>
          )}
          <button onClick={handleNext}
            style={{ padding: '9px 18px', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              color: '#fff', fontFamily: 'var(--font-body)', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`,
              boxShadow: `0 3px 12px ${T.gold}44` }}>
            {!finished ? 'Revelar ⚡' : page === last ? 'Recomeçar 🤫' : 'Próxima ▶'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════ Módulo (2 abas) ══════════════════════════════════════════ */
const InfoAdicional = ({ onBack }) => {
  const [tab, setTab] = useState('instalar'); // instalar | sobre

  return (
    <div style={{ minHeight: '100vh', background: T.page, fontFamily: 'var(--font-body)' }}>
      <div style={{ height: 56, background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.75)'),
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, position: 'sticky', top: 0, zIndex: 200 }}>
        <button onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: T.surfaceSub || 'rgba(0,0,0,0.04)',
            border: `1px solid ${T.border}`, borderRadius: 9, cursor: 'pointer', color: T.textS, outline: 'none', fontFamily: 'var(--font-body)', fontSize: 13 }}
          onMouseEnter={e => e.currentTarget.style.color = T.gold} onMouseLeave={e => e.currentTarget.style.color = T.textS}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          Módulos
        </button>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text }}>Informações Adicionais</div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '26px 20px 40px' }}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
          {[['instalar', '📲', 'Instalar Aplicativo'], ['sobre', '🌌', 'Sobre o Uniko']].map(([id, icon, label]) => {
            const sel = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                  border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : T.surface, color: sel ? T.gold : T.textS }}>
                <span style={{ fontSize: 16 }}>{icon}</span>{label}
              </button>
            );
          })}
        </div>

        {tab === 'instalar' ? <AbaInstalar /> : <AbaSobre />}
      </div>
    </div>
  );
};

export { InfoAdicional };
export default InfoAdicional;
