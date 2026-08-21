// Botão flutuante "Instalar Aplicativo" (mesmo padrão do "Quem sou eu?" —
// ver UnikoOrigin.jsx) que abre um tutorial de como adicionar o Portal à
// Tela de Início do iPhone e configurar as notificações. Só conteúdo
// estático (passo a passo com prints), sem Supabase/estado.
import { useState, useEffect } from 'react';
import { T } from '../contexts/theme';

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

export const InstalarAppGuide = () => {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState('instalar'); // instalar | notificacao
  const [passoIdx, setPassoIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const isDark = !!T.dark;
  const passos = aba === 'instalar' ? PASSOS_INSTALAR : PASSOS_NOTIF;
  const passo = passos[passoIdx];

  // Troca de aba (ou reabrir) sempre volta pro passo 1 — senão o índice de
  // uma aba com mais passos podia sobrar inválido na outra.
  useEffect(() => { setPassoIdx(0); setZoom(false); }, [aba, open]);

  const mudarAba = (id) => { if (id !== aba) setAba(id); };
  const irPasso = (delta) => setPassoIdx(i => Math.max(0, Math.min(passos.length - 1, i + delta)));

  return (
    <>
      <style>{`@keyframes iagBtnGlow{0%,100%{box-shadow:0 0 0 0 ${T.gold}55, 0 4px 14px rgba(0,0,0,.12)}50%{box-shadow:0 0 0 6px ${T.gold}00, 0 4px 14px rgba(0,0,0,.12)}}`}</style>

      {/* ── Botão fixo (canto inferior esquerdo — "Quem sou eu?" já ocupa o direito) ── */}
      <button onClick={() => setOpen(true)} title="Como instalar o Portal no celular"
        style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: 9,
          padding: '11px 20px 11px 14px', borderRadius: 28, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
          border: `2px solid ${T.gold}`, outline: 'none', color: T.text,
          background: isDark ? 'linear-gradient(135deg,#241f14,#1c1710 45%,#161209)' : 'linear-gradient(135deg,#fbf5ea,#f2e8d5 45%,#f5efe4)',
          animation: 'iagBtnGlow 2.6s ease-in-out infinite' }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><line x1="10.5" y1="19" x2="13.5" y2="19"/><path d="M12 7v6M9 10.5l3 3 3-3"/></svg>
        Instalar Aplicativo
      </button>

      {/* ── Tutorial ── */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font-body)' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 'min(420px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: T.surface, borderRadius: 20,
              overflow: 'hidden', border: `1px solid ${T.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: T.text }}>📲 Instalar Aplicativo</div>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
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

            {/* ── Passo atual (1 imagem só, navega com as setas) ── */}
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

              {/* ── Navegação ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 4 }}>
                <button onClick={() => irPasso(-1)} disabled={passoIdx === 0} className="fit-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 16px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: 'transparent',
                    color: passoIdx === 0 ? T.textD : T.text, cursor: passoIdx === 0 ? 'default' : 'pointer', opacity: passoIdx === 0 ? .45 : 1, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                  <IcoSeta dir="prev" /> Anterior
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {passos.map((_, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === passoIdx ? T.gold : T.border }} />
                  ))}
                </div>
                {passoIdx < passos.length - 1 ? (
                  <button onClick={() => irPasso(1)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      background: T.gold, color: '#fff', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                    Próximo <IcoSeta dir="next" />
                  </button>
                ) : (
                  <button onClick={() => setOpen(false)}
                    style={{ padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      background: T.gold, color: '#fff', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                    Concluir
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Imagem em tela grande (clique na foto do passo) ── */}
      {zoom && passo.img && (
        <div onClick={() => setZoom(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <button onClick={() => setZoom(false)} aria-label="Fechar"
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <img src={passo.img} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '92%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }} />
        </div>
      )}
    </>
  );
};
