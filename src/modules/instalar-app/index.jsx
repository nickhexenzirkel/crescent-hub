// Tutorial "Instalar Aplicativo" — como adicionar o Portal à Tela de Início
// do iPhone (vira um app de verdade, sem barra do Safari) e como ativar/
// ajustar as notificações. Só conteúdo estático (passo a passo com prints),
// sem Supabase/estado — por isso fica fora do padrão dos outros módulos.
import { useState } from 'react';
import { T } from '../../contexts/theme';

const IcoBack = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>;

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

const PassoCard = ({ n, passo, cardBg }) => (
  <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: T.shM }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: T.goldGl, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{n}</div>
      <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.45 }}>{passo.texto}</div>
    </div>
    {passo.img && (
      <div style={{ borderTop: `1px solid ${T.border}`, background: T.page, display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
        <img src={passo.img} alt={`Passo ${n}`} style={{ maxWidth: '86%', maxHeight: 420, borderRadius: 12, boxShadow: '0 8px 26px rgba(0,0,0,.18)' }} />
      </div>
    )}
  </div>
);

const InstalarApp = ({ onBack }) => {
  const cardBg = T.surface || '#fff';
  const [aba, setAba] = useState('instalar'); // instalar | notificacao
  const passos = aba === 'instalar' ? PASSOS_INSTALAR : PASSOS_NOTIF;

  return (
    <div style={{ minHeight: '100vh', background: T.page, fontFamily: 'var(--font-body)' }}>
      <div style={{ height: 56, background: T.topbarBg || cardBg, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: T.textS, fontSize: 13, fontFamily: 'var(--font-body)', padding: '4px 8px', borderRadius: 7 }}>
          {IcoBack} Módulos
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>📲 Instalar Aplicativo</div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 18px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 21, fontWeight: 800, color: T.text, marginBottom: 6 }}>Coloque o Portal na Tela de Início</div>
          <div style={{ fontSize: 13, color: T.textS, lineHeight: 1.5, maxWidth: 440, margin: '0 auto' }}>
            No iPhone, notificação (comentário, curtida, mensagem do Bate-Papo do Uniko FIT etc.) só chega mesmo se o Portal virar um "app" instalado — abrir pelo Safari normal não é suficiente. Segue o passo a passo:
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 22 }}>
          {[['instalar', 'Instalar Aplicativo'], ['notificacao', 'Configurar Notificação']].map(([id, label]) => {
            const sel = aba === id;
            return (
              <button key={id} onClick={() => setAba(id)}
                style={{ padding: '9px 18px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                  border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : 'transparent', color: sel ? T.gold : T.textS, whiteSpace: 'nowrap' }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {passos.map((passo, i) => <PassoCard key={i} n={i + 1} passo={passo} cardBg={cardBg} />)}
        </div>

        {aba === 'notificacao' && (
          <div style={{ marginTop: 18, fontSize: 12, color: T.textT, textAlign: 'center', lineHeight: 1.5 }}>
            Desmarcar "Banners" não desativa a notificação — ela continua chegando na Central de Notificações e no ícone, só não aparece um aviso na tela na hora.
          </div>
        )}
      </div>
    </div>
  );
};

export default InstalarApp;
