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
          .select('player,score,song,difficulty,nick,avatar,border')
          .order('score', { ascending: false });
        rows = data || [];
      } catch {}

      // Por dificuldade (rows já vêm ordenadas por score desc)
      const byDiff = {};
      for (const r of rows) {
        const d = r.difficulty || 'normal';
        (byDiff[d] = byDiff[d] || []).push({
          player: r.player, score: r.score, song: r.song,
          nick: r.nick, avatar: r.avatar, border: r.border,
        });
      }
      Object.keys(byDiff).forEach(k => { byDiff[k] = byDiff[k].slice(0, 20); });

      // Global: soma dos melhores de cada dificuldade por jogador; nick/avatar/borda
      // e música vêm do MELHOR registro (maior pontuação única) do jogador.
      const tot = {};
      for (const r of rows) {
        const sc = Number(r.score) || 0;
        const p = (tot[r.player] = tot[r.player] || { player: r.player, score: 0, song: '', nick: '', avatar: '', border: '', best: -1 });
        p.score += sc;
        if (sc > p.best) { p.best = sc; p.song = r.song || ''; p.nick = r.nick || ''; p.avatar = r.avatar || ''; p.border = r.border || ''; }
      }
      const global = Object.values(tot)
        .map(({ player, score, song, nick, avatar, border }) => ({ player, score, song, nick, avatar, border }))
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
              nick: d.nick || '', avatar: d.avatar || '', border: d.border || '',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'player,difficulty' });
          }
        } catch {}

        // Mantém nick/avatar/borda atualizados em TODAS as entradas do jogador
        // (mesmo sem bater recorde) → quem já tinha pontuação aparece com o nick.
        const patch = {};
        if (d.nick) patch.nick = d.nick;
        if (d.avatar) patch.avatar = d.avatar;
        if (d.border) patch.border = d.border;
        if (Object.keys(patch).length) {
          try { await supabase.from('uniko_scores').update(patch).eq('player', player); } catch {}
        }
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
