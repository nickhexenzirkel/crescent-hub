// Botão flutuante "Instalar Aplicativo" (mesmo padrão do "Quem sou eu?" —
// ver UnikoOrigin.jsx) que abre um tutorial de como adicionar o Portal à
// Tela de Início do iPhone e configurar as notificações. Só conteúdo
// estático (passo a passo com prints), sem Supabase/estado.
import { useState } from 'react';
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

const PassoCard = ({ n, passo }) => (
  <div style={{ background: T.page, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.goldGl, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, flexShrink: 0 }}>{n}</div>
      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>{passo.texto}</div>
    </div>
    {passo.img && (
      <div style={{ borderTop: `1px solid ${T.border}`, background: T.surface, display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
        <img src={passo.img} alt={`Passo ${n}`} style={{ maxWidth: '84%', maxHeight: 380, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)' }} />
      </div>
    )}
  </div>
);

export const InstalarAppGuide = () => {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState('instalar'); // instalar | notificacao
  const isDark = !!T.dark;
  const passos = aba === 'instalar' ? PASSOS_INSTALAR : PASSOS_NOTIF;

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
            style={{ width: 'min(560px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: T.surface, borderRadius: 20,
              overflow: 'hidden', border: `1px solid ${T.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: T.text }}>📲 Instalar Aplicativo</div>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
              <div style={{ fontSize: 12.5, color: T.textS, lineHeight: 1.5, marginBottom: 14, textAlign: 'center' }}>
                No iPhone, notificação só chega mesmo se o Portal virar um "app" instalado — abrir pelo Safari normal não é suficiente.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
                {[['instalar', 'Instalar Aplicativo'], ['notificacao', 'Configurar Notificação']].map(([id, label]) => {
                  const sel = aba === id;
                  return (
                    <button key={id} onClick={() => setAba(id)}
                      style={{ padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
                        border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : 'transparent', color: sel ? T.gold : T.textS, whiteSpace: 'nowrap' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {passos.map((passo, i) => <PassoCard key={i} n={i + 1} passo={passo} />)}
              {aba === 'notificacao' && (
                <div style={{ fontSize: 11.5, color: T.textT, textAlign: 'center', lineHeight: 1.5 }}>
                  Desmarcar "Banners" não desativa a notificação — ela continua chegando na Central de Notificações e no ícone, só não aparece um aviso na tela na hora.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
