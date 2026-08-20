// src/modules/central-colaborador/tabs/TabUnikoSuspect.jsx
// UNIKO SUSPECT — jogo estilo Among Us (tripulantes x impostor) em construção.
// Aba admin-only enquanto desenvolvemos (gate em Sidebar.jsx: adminOnly:true no
// item 'unikosuspect' de NAV; tirar a flag quando o jogo for lançado pra todos).
import React from 'react';
import { T } from '../../../contexts/theme';

const A = '#DC2626', A2 = '#7C3AED'; // vermelho suspeito + roxo espacial

// Cada fase é um marco concreto — vai virando ✅ conforme construímos juntos.
const ROADMAP = [
  { fase: 'Fundação', done: true, itens: [
    'Aba admin-only (essa tela)',
  ]},
  { fase: 'Lobby & salas', done: false, itens: [
    'Criar/entrar em sala (mesmo padrão do Paint/Stop: presence + host eleito)',
    'Sorteio de papéis (Impostor x Tripulante)',
  ]},
  { fase: 'Mapa & movimento', done: false, itens: [
    'Cenário com salas/corredores',
    'Avatar (Uniko) se move pelo mapa em tempo real',
  ]},
  { fase: 'Tarefas', done: false, itens: [
    'Lista de tarefas por tripulante',
    'Mini-jogos/ações pra completar cada tarefa',
  ]},
  { fase: 'Impostor', done: false, itens: [
    'Matar (com cooldown)',
    'Ventilação / sabotagem',
  ]},
  { fase: 'Reuniões & votação', done: false, itens: [
    'Reportar corpo / botão de emergência',
    'Chat da reunião + votação + expulsão',
  ]},
  { fase: 'Fim de jogo', done: false, itens: [
    'Condições de vitória (tarefas completas / impostor pego / maioria impostora)',
    'Placar e ranking geral',
  ]},
];

const TabUnikoSuspect = () => {
  const totalItens = ROADMAP.flatMap(f => f.itens).length;
  const feitos = ROADMAP.filter(f => f.done).flatMap(f => f.itens).length;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ borderRadius: 18, padding: '22px 26px', marginBottom: 20, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(120deg, ${A2} 0%, #1a0a2e 60%, ${A} 130%)`, boxShadow: `0 10px 32px ${A2}44` }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .15, pointerEvents: 'none',
          background: 'radial-gradient(circle at 15% 20%, #fff 0%, transparent 45%), radial-gradient(circle at 85% 80%, #fff 0%, transparent 40%)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>🕵️</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 24, fontWeight: 800, color: '#fff' }}>Uniko Suspect</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>
              Tripulantes x Impostor — em construção, feito junto com você.
            </div>
          </div>
          <div style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.25)',
            fontSize: 11.5, fontWeight: 800, color: '#fff', letterSpacing: '.04em' }}>
            🔒 SÓ ADMIN VÊ ESSA ABA
          </div>
        </div>
      </div>

      {/* Progresso */}
      <div style={{ background: T.surface || '#fff', border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Progresso</div>
          <div style={{ fontSize: 12.5, color: T.textT, fontWeight: 700 }}>{feitos}/{totalItens} itens</div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(feitos / totalItens) * 100}%`, borderRadius: 999,
            background: `linear-gradient(90deg, ${A2}, ${A})`, transition: 'width .3s ease' }} />
        </div>
      </div>

      {/* Roadmap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ROADMAP.map((f, i) => (
          <div key={f.fase} style={{ background: T.surface || '#fff', border: `1px solid ${f.done ? '#16a34a55' : T.border}`,
            borderRadius: 13, padding: '13px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: f.done ? '#fff' : T.textT,
                background: f.done ? '#16a34a' : (T.surfaceSub || 'rgba(0,0,0,.08)') }}>
                {f.done ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{f.fase}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 33 }}>
              {f.itens.map(it => (
                <div key={it} style={{ fontSize: 12.5, color: T.textS, display: 'flex', alignItems: 'flex-start', gap: 7, lineHeight: 1.4 }}>
                  <span style={{ opacity: .6, marginTop: 1 }}>{f.done ? '✓' : '·'}</span>{it}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: T.textT, marginTop: 20, lineHeight: 1.6 }}>
        Bora construir isso junto — na próxima etapa a gente define o lobby e o sorteio de papéis. 🚀
      </div>
    </div>
  );
};

export { TabUnikoSuspect };
export default TabUnikoSuspect;
