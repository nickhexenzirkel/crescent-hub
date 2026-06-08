import React, { useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER } from '../../../contexts/user';

const TabUnikoWave = () => {
  const iframeRef = useRef(null);

  useEffect(() => {
    const playerName = () => {
      try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
      catch { return 'Colaborador'; }
    };

    // Busca o ranking (top 20 por pontuação) e envia ao jogo.
    const sendRank = async () => {
      let rows = [];
      try {
        const { data } = await supabase
          .from('uniko_scores')
          .select('player,score,song,grade,difficulty')
          .order('score', { ascending: false })
          .limit(20);
        rows = data || [];
      } catch {}
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'UNIKO_RANK_DATA', rows, me: playerName() }, '*');
    };

    // Grava a pontuação do jogador (mantém só a MAIOR), depois reenvia o ranking.
    const submitScore = async (d) => {
      const player = playerName();
      const score = Math.round(Number(d.score) || 0);
      if (player && score > 0) {
        try {
          const { data: ex } = await supabase
            .from('uniko_scores').select('score').eq('player', player).maybeSingle();
          if (!ex || score > ex.score) {
            await supabase.from('uniko_scores').upsert({
              player, score,
              song: d.song || '', grade: d.grade || '',
              difficulty: d.diff || '', video_id: d.vid || '',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'player' });
          }
        } catch {}
      }
      sendRank();
    };

    const handler = (e) => {
      const type = e.data?.type;
      if (!type) return;
      const fromGame = e.source === iframeRef.current?.contentWindow;

      // Ranking global
      if (fromGame && type === 'UNIKO_SCORE_SUBMIT') { submitScore(e.data); return; }
      if (fromGame && type === 'UNIKO_RANK_REQUEST') { sendRank(); return; }

      // Ponte do YouTube/Catbot (existente)
      if (fromGame && type.startsWith('UNIKO_YT_')) { window.postMessage(e.data, '*'); return; }
      if (e.source === window && type.startsWith('YT_')) {
        iframeRef.current?.contentWindow?.postMessage(e.data, '*');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.page }}>
      <iframe
        ref={iframeRef}
        src="/unikowave/index.html"
        title="Uniko Wave"
        style={{
          flex: 1,
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        }}
        allow="autoplay; fullscreen"
      />
    </div>
  );
};

export { TabUnikoWave };
