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

    // Busca todas as pontuações e monta dois rankings: GLOBAL (soma por jogador,
    // somando o melhor de cada dificuldade) e POR DIFICULDADE (top de cada nível).
    const sendRank = async () => {
      let rows = [];
      try {
        const { data } = await supabase
          .from('uniko_scores')
          .select('player,score,song,difficulty')
          .order('score', { ascending: false });
        rows = data || [];
      } catch {}

      // Por dificuldade (rows já vêm ordenadas por score desc)
      const byDiff = {};
      for (const r of rows) {
        const d = r.difficulty || 'normal';
        (byDiff[d] = byDiff[d] || []).push({ player: r.player, score: r.score, song: r.song });
      }
      Object.keys(byDiff).forEach(k => { byDiff[k] = byDiff[k].slice(0, 20); });

      // Global: soma dos melhores de cada dificuldade por jogador; música = o recorde
      const tot = {};
      for (const r of rows) {
        const sc = Number(r.score) || 0;
        const p = (tot[r.player] = tot[r.player] || { player: r.player, score: 0, song: '', best: -1 });
        p.score += sc;
        if (sc > p.best) { p.best = sc; p.song = r.song || ''; }
      }
      const global = Object.values(tot)
        .map(({ player, score, song }) => ({ player, score, song }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      iframeRef.current?.contentWindow?.postMessage(
        { type: 'UNIKO_RANK_DATA', global, byDiff, me: playerName() }, '*');
    };

    // Grava a pontuação do jogador na dificuldade jogada (mantém só a MAIOR de cada).
    const submitScore = async (d) => {
      const player = playerName();
      const score = Math.round(Number(d.score) || 0);
      const difficulty = d.diff || 'normal';
      if (player && score > 0) {
        try {
          const { data: ex } = await supabase
            .from('uniko_scores').select('score')
            .eq('player', player).eq('difficulty', difficulty).maybeSingle();
          if (!ex || score > ex.score) {
            await supabase.from('uniko_scores').upsert({
              player, difficulty, score,
              song: d.song || '', grade: d.grade || '', video_id: d.vid || '',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'player,difficulty' });
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
