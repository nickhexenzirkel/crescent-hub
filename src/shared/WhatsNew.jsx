import React, { useState } from 'react';
import { T } from '../contexts/theme';

/**
 * Botão "Novidades" + banner paginado com as notas de atualização do Uniko.
 * Cada página explica um conjunto de novidades, de forma bem didática e com emojis.
 */
const PAGES = [
  {
    emoji: '🎮',
    tag: 'Jogo',
    title: 'Uniko Wave repaginado',
    intro: 'O joguinho de ritmo ficou muito melhor:',
    lines: [
      ['🎵', 'Agora ele toca no ritmo REAL da música do YouTube — antes era só uma estimativa.'],
      ['👀', 'As notas ficaram mais espaçadas e na velocidade certa, bem mais fáceis de ler.'],
      ['❤️', 'Tem barra de vida! Se errar demais, você perde a partida — então foca no ritmo. 😄'],
      ['⛶', 'Dá pra entrar em tela cheia direto pelo menu de pausa (aperte ESC durante a partida).'],
      ['🐱', 'Todos os personagens estão liberados por tempo limitado — experimente todos!'],
    ],
  },
  {
    emoji: '🔔',
    tag: 'Notificações',
    title: 'Avisos no seu computador',
    intro: 'Agora os avisos saem do site e aparecem na sua área de trabalho:',
    lines: [
      ['📌', 'Seus lembretes pessoais viram pop-up no desktop, não só dentro do site.'],
      ['🚨', 'Avisos do RH (Urgente e Lembrete geral) também chegam no desktop de todo mundo.'],
      ['🐾', 'O título do lembrete aparece fofo assim: .𖥔 . { seu título } .𖥔 .'],
      ['📍', 'Eles ficam fixos na tela até você fechar — não somem sozinhos.'],
    ],
  },
  {
    emoji: '🧩',
    tag: 'Extensão',
    title: 'Extensão Uniko Cat-Bot',
    intro: 'É ela que entrega as notificações no desktop. Bem fácil de instalar:',
    lines: [
      ['⬇️', 'Baixe a extensão na tela inicial ou na tab "Meus Lembretes".'],
      ['🛠️', 'Siga o passo a passo: extrair o .zip → chrome://extensions → Modo do desenvolvedor → Carregar sem compactação.'],
      ['✅', 'Confira se ela está ativa com um clique — o indicador fica verde quando conectada.'],
      ['🌐', 'Funciona no Chrome, Edge, Opera e Brave.'],
    ],
  },
  {
    emoji: '💡',
    tag: 'Dicas',
    title: 'Para aproveitar tudo',
    intro: 'Três passos rápidos:',
    lines: [
      ['🔓', 'Em "Meus Lembretes", clique em "Ativar notificações" e permita no navegador.'],
      ['🖥️', 'Mantenha o Uniko aberto numa aba (pode ser em segundo plano) para receber os avisos.'],
      ['🧪', 'Use o botão "Testar no desktop" para confirmar que está tudo funcionando.'],
      ['🎉', 'Pronto! Bom proveito. 💛'],
    ],
  },
];

export const WhatsNew = () => {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const last = PAGES.length - 1;
  const p = PAGES[page];

  const openModal  = () => { setPage(0); setOpen(true); };
  const closeModal = () => setOpen(false);

  return (
    <>
      {/* ── Botão fixo (canto superior esquerdo) ── */}
      <button onClick={openModal}
        title="Ver as novidades e notas de atualização"
        style={{ position:'fixed', top:16, left:20, zIndex:10, display:'flex', alignItems:'center', gap:7,
          padding:'7px 14px', borderRadius:20, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:600,
          color:T.gold, background:T.goldGl, border:`1px solid ${T.goldLine}44`, outline:'none' }}>
        <span style={{ fontSize:14, lineHeight:1 }}>✨</span>
        Novidades
        <span style={{ width:7, height:7, borderRadius:'50%', background:T.gold, display:'inline-block', boxShadow:`0 0 8px ${T.gold}` }}/>
      </button>

      {/* ── Banner / modal paginado ── */}
      {open && (
        <div onClick={closeModal}
          style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'var(--font-body)' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width:'min(560px, 96vw)', background:T.surface, borderRadius:22, overflow:'hidden',
              border:`1px solid ${T.border}`, boxShadow:'0 24px 80px rgba(0,0,0,0.35)', animation:'wnIn .22s ease' }}>
            <style>{`@keyframes wnIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}`}</style>

            {/* Cabeçalho */}
            <div style={{ position:'relative', padding:'22px 26px 18px', background:T.goldGl, borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:T.gold, marginBottom:6 }}>
                ✨ Novidades · {p.tag}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ fontSize:34, lineHeight:1 }}>{p.emoji}</div>
                <div style={{ fontFamily:'var(--font-brand)', fontSize:22, fontWeight:700, color:T.text, letterSpacing:'.02em' }}>{p.title}</div>
              </div>
              <button onClick={closeModal} title="Fechar"
                style={{ position:'absolute', top:16, right:16, width:32, height:32, borderRadius:9, border:'none',
                  background:'rgba(0,0,0,0.06)', cursor:'pointer', color:T.textS, fontSize:18, lineHeight:1 }}>✕</button>
            </div>

            {/* Conteúdo da página */}
            <div style={{ padding:'22px 26px 8px', minHeight:230 }}>
              {p.intro && <div style={{ fontSize:14.5, color:T.textS, marginBottom:16 }}>{p.intro}</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                {p.lines.map(([ic, txt], i) => (
                  <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                    <span style={{ fontSize:18, lineHeight:1.3, flexShrink:0 }}>{ic}</span>
                    <span style={{ fontSize:14, color:T.text, lineHeight:1.6 }}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé: dots + navegação */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'16px 26px 22px' }}>
              <div style={{ display:'flex', gap:7 }}>
                {PAGES.map((_, i) => (
                  <button key={i} onClick={() => setPage(i)} aria-label={`Página ${i+1}`}
                    style={{ width:i===page?22:8, height:8, borderRadius:99, border:'none', cursor:'pointer', padding:0,
                      background:i===page?T.gold:T.border, transition:'all .2s' }}/>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {page > 0 && (
                  <button onClick={() => setPage(p2 => p2 - 1)}
                    style={{ padding:'9px 16px', borderRadius:11, border:`1px solid ${T.border}`, background:'transparent',
                      cursor:'pointer', fontSize:13, fontWeight:600, color:T.textS, fontFamily:'var(--font-body)' }}>
                    ◀ Anterior
                  </button>
                )}
                <button onClick={() => page === last ? closeModal() : setPage(p2 => p2 + 1)}
                  style={{ padding:'9px 18px', borderRadius:11, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                    color:'#fff', fontFamily:'var(--font-body)', background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
                    boxShadow:`0 3px 12px ${T.gold}44` }}>
                  {page === last ? 'Concluir 🎉' : 'Próxima ▶'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WhatsNew;
