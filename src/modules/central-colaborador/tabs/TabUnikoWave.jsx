import React, { useEffect, useRef, useState } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER } from '../../../contexts/user';

// Chaves do save do jogo que ficam atreladas à CONTA do usuário (não ao
// navegador). Personagens/mascotes, carteira (GW/GC), personagem escolhido,
// perfil e pity do gacha. Ver supabase_uniko_wave_saves.sql.
const SAVE_KEYS = ['dw_wallet', 'dw_unlocked', 'dw_char', 'dw_profile', 'dw_wish_pity'];
// Marca de quem é o save atualmente no localStorage (isola contas no mesmo PC).
const OWNER_KEY = 'dw_cloud_owner';

const playerName = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};

const collectLocal = () => {
  const save = {};
  SAVE_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) save[k] = v; });
  return save;
};

const pushSave = async (player, data) => {
  try {
    await supabase.from('uniko_wave_saves').upsert(
      { player, data, updated_at: new Date().toISOString() },
      { onConflict: 'player' });
  } catch {}
};

const TabUnikoWave = () => {
  const iframeRef = useRef(null);
  const saveTimer = useRef(null);
  const [ready, setReady] = useState(false);

  // ── Hidratação: carrega o save da CONTA antes de montar o jogo ──────────
  // Como o iframe compartilha o localStorage (mesma origem), escrever aqui
  // garante que o jogo leia os valores corretos já no carregamento.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const player = playerName();
      let row = null;
      try {
        const { data } = await supabase
          .from('uniko_wave_saves').select('data').eq('player', player).maybeSingle();
        row = data;
      } catch {}
      if (cancelled) return;

      if (row && row.data && typeof row.data === 'object') {
        // Nuvem é a fonte da verdade: limpa o local e aplica o save do usuário.
        SAVE_KEYS.forEach(k => localStorage.removeItem(k));
        Object.entries(row.data).forEach(([k, v]) => {
          if (SAVE_KEYS.includes(k) && v != null) localStorage.setItem(k, String(v));
        });
        localStorage.setItem(OWNER_KEY, player);
      } else {
        // Sem save na nuvem para este usuário ainda.
        const owner = localStorage.getItem(OWNER_KEY);
        if (owner === player) {
          // Progresso local pertence a este usuário (ainda não sincronizado) → migra.
          await pushSave(player, collectLocal());
        } else {
          // Local é de outra conta (ou vazio) → começa limpo para isolar contas.
          SAVE_KEYS.forEach(k => localStorage.removeItem(k));
          localStorage.setItem(OWNER_KEY, player);
          await pushSave(player, {});
        }
      }
      if (!cancelled) setReady(true);
    };
    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
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

    // Acumula o tempo jogado do dia (segundos) por jogador na tabela uniko_playtime.
    const addPlaytime = async (sec) => {
      const add = Math.round(Number(sec) || 0);
      const player = playerName();
      if (add <= 0 || !player) return;
      const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (dia atual)
      try {
        const { data } = await supabase.from('uniko_playtime')
          .select('seconds').eq('player', player).eq('day', day).maybeSingle();
        const cur = data?.seconds || 0;
        await supabase.from('uniko_playtime').upsert(
          { player, day, seconds: cur + add, updated_at: new Date().toISOString() },
          { onConflict: 'player,day' });
      } catch {}
    };

    const handler = (e) => {
      const type = e.data?.type;
      if (!type) return;
      const fromGame = e.source === iframeRef.current?.contentWindow;

      // Save por conta: o jogo avisa quando algo muda → persiste no Supabase (debounce).
      if (fromGame && type === 'UNIKO_SAVE_SET') {
        const data = e.data.save || {};
        localStorage.setItem(OWNER_KEY, playerName());
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => pushSave(playerName(), data), 500);
        return;
      }

      // Ranking global
      if (fromGame && type === 'UNIKO_SCORE_SUBMIT') { submitScore(e.data); return; }
      if (fromGame && type === 'UNIKO_RANK_REQUEST') { sendRank(); return; }

      // Tempo jogado (segundos da partida que acabou) → acumula no total do DIA (Supabase)
      if (fromGame && type === 'UNIKO_PLAYTIME') { addPlaytime(e.data.seconds); return; }

      // Ponte do YouTube/Catbot (existente)
      if (fromGame && type.startsWith('UNIKO_YT_')) { window.postMessage(e.data, '*'); return; }
      if (e.source === window && type.startsWith('YT_')) {
        iframeRef.current?.contentWindow?.postMessage(e.data, '*');
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.page }}>
      {ready ? (
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
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textT, fontFamily: 'var(--font-body)', fontSize: 14 }}>
          Carregando seu progresso…
        </div>
      )}
    </div>
  );
};

export { TabUnikoWave };
