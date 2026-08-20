// src/shared/FriendsInvite.jsx
// Lista de amigos (todos os colaboradores) com "Convidar" por pessoa e "Convidar
// todos" pra jogar Uniko Paint / Uniko Stop. Usada no lobby (roomId null = "vem
// jogar") e dentro da sala (roomId = entra direto nesta sala). Ver gameInvites.js.
import React, { useState, useEffect } from 'react';
import { T } from '../contexts/theme';
import { fetchColegas, sendGameInvites, GAME_LABEL } from './gameInvites';

const inicial = (n) => (n || '?').split(' ').map(x => x[0]).slice(0, 2).join('');

// Painel (conteúdo). accent = cor do jogo.
export function FriendsInvite({ game, roomId = null, roomName = null, accent = '#7C3AED', maxHeight = 320 }) {
  const [colegas, setColegas]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busca, setBusca]         = useState('');
  const [convidados, setConvidados] = useState({}); // name -> ts
  const [enviando, setEnviando]   = useState(false);

  useEffect(() => { let alive = true; fetchColegas().then(l => { if (alive) { setColegas(l); setLoading(false); } }); return () => { alive = false; }; }, []);

  const convidar = async (names) => {
    if (!names.length) return;
    setEnviando(true);
    try { await sendGameInvites({ toNames: names, game, roomId, roomName }); }
    finally {
      setConvidados(prev => { const n = { ...prev }; names.forEach(x => (n[x] = Date.now())); return n; });
      setEnviando(false);
    }
  };
  const jaConvidou = (name) => convidados[name] && (Date.now() - convidados[name] < 60000);

  const q = busca.trim().toLowerCase();
  const filtrados = q ? colegas.filter(c => c.name.toLowerCase().includes(q)) : colegas;
  const naoConvidados = filtrados.map(c => c.name).filter(n => !jaConvidou(n));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, flex: 1 }}>
          Chamar amigos {roomId ? 'pra esta sala' : `pro ${GAME_LABEL[game]}`}
        </div>
        <button onClick={() => convidar(naoConvidados)} disabled={enviando || !naoConvidados.length}
          style={{ padding: '6px 12px', borderRadius: 9, border: 'none', cursor: (enviando || !naoConvidados.length) ? 'default' : 'pointer',
            background: naoConvidados.length ? accent : T.border, color: '#fff', fontSize: 11.5, fontWeight: 800, fontFamily: 'var(--font-body)', opacity: naoConvidados.length ? 1 : .6 }}>
          Convidar todos
        </button>
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔎 Buscar colega..."
        style={{ width: '100%', padding: '8px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.surface || '#fff',
          fontSize: 12.5, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', marginBottom: 10, flexShrink: 0 }} />

      <div className="up-scroll" style={{ overflowY: 'auto', maxHeight, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 18, color: T.textT, fontSize: 12 }}>Carregando colegas...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 18, color: T.textT, fontSize: 12 }}>{q ? 'Nenhum colega encontrado.' : 'Sem colegas na lista.'}</div>
        ) : filtrados.map(c => {
          const feito = jaConvidou(c.name);
          return (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 10,
              background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}` }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{inicial(c.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name.split(' ').slice(0, 2).join(' ')}</div>
                {c.cargo && <div style={{ fontSize: 10.5, color: T.textT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.cargo}</div>}
              </div>
              <button onClick={() => convidar([c.name])} disabled={feito}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 8, cursor: feito ? 'default' : 'pointer',
                  border: feito ? `1px solid ${T.border}` : 'none', background: feito ? 'transparent' : accent,
                  color: feito ? T.textT : '#fff', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                {feito ? '✓ Convidado' : 'Convidar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Botão que abre a lista de amigos num modal (usado DENTRO da sala).
export function ConvidarButton({ game, roomId, roomName, accent = '#7C3AED', style }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Convidar amigos"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: 'none',
          background: '#fff', color: accent, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,0,0,.18)', ...style }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Convidar amigos
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(10,6,24,.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface || '#fff', borderRadius: 18, border: `1px solid ${T.border}`, padding: 20,
            width: 440, maxWidth: '95vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text }}>Convidar amigos</div>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            <FriendsInvite game={game} roomId={roomId} roomName={roomName} accent={accent} maxHeight="60vh" />
          </div>
        </div>
      )}
    </>
  );
}
