// ════════════════════════════════════════════════════════
// CRESCENT HUB — Festival Music Server
// Node.js + Express + Spotify Web API + Supabase
// ════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Supabase ────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── Spotify config ──────────────────────────────────────
const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI  = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;
const SKIP_NEEDED   = parseInt(process.env.SKIP_VOTES_NEEDED) || 3;

// Token em memória (persiste refresh_token no Supabase para sobreviver restarts)
let tokens = { access: null, refresh: null, expiresAt: 0 };

// ═══════════════════════════════════════════════════════
// SPOTIFY AUTH
// ═══════════════════════════════════════════════════════

app.get('/login', (req, res) => {
  const scope = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    scope,
    redirect_uri:  REDIRECT_URI,
    state: Math.random().toString(36).slice(2),
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`Erro Spotify: ${error}`);

  try {
    const r = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
      { headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = r.data;
    tokens = { access: access_token, refresh: refresh_token, expiresAt: Date.now() + (expires_in - 60) * 1000 };

    // Persiste para sobreviver restart
    await supabase.from('settings').upsert({ key: 'spotify_refresh_token', value: refresh_token });

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conectado</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:linear-gradient(135deg,#F0F6FC,#E8F3FB);min-height:100vh;
  display:flex;align-items:center;justify-content:center">
  <div style="background:white;border-radius:20px;padding:48px;text-align:center;
    box-shadow:0 8px 40px rgba(0,0,0,0.12);max-width:400px">
    <div style="font-size:56px;margin-bottom:16px">🎵</div>
    <h2 style="color:#1A6FB5;margin:0 0 10px;font-size:22px">Spotify conectado!</h2>
    <p style="color:#666;margin:0">Pode fechar essa janela e voltar ao Crescent Hub.</p>
  </div>
</body></html>`);
  } catch (err) {
    console.error('❌ Callback error:', err.response?.data || err.message);
    res.status(500).send('Erro ao autenticar no Spotify. Tente novamente.');
  }
});

function basicAuth() {
  return `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
}

async function ensureToken() {
  // Carrega refresh token salvo se não tiver em memória
  if (!tokens.refresh) {
    const { data } = await supabase.from('settings').select('value').eq('key', 'spotify_refresh_token').single();
    if (data?.value) tokens.refresh = data.value;
    else throw new Error('Spotify não autenticado. Acesse /login primeiro.');
  }

  if (!tokens.access || Date.now() >= tokens.expiresAt) {
    const r = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh }),
      { headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    tokens.access     = r.data.access_token;
    tokens.expiresAt  = Date.now() + (r.data.expires_in - 60) * 1000;
    if (r.data.refresh_token) {
      tokens.refresh = r.data.refresh_token;
      await supabase.from('settings').upsert({ key: 'spotify_refresh_token', value: tokens.refresh });
    }
  }
  return tokens.access;
}

// Wrapper para chamadas à Spotify Web API
async function spotify(method, path, data) {
  const token = await ensureToken();
  return axios({
    method,
    url:     `https://api.spotify.com/v1${path}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data:    data || undefined,
  });
}

// ═══════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════

app.get('/api/status', async (req, res) => {
  try {
    const r = await spotify('get', '/me');
    res.json({ ok: true, user: r.data.display_name, email: r.data.email });
  } catch {
    res.json({ ok: false });
  }
});

// ═══════════════════════════════════════════════════════
// BUSCA DE MÚSICAS
// ═══════════════════════════════════════════════════════

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'Query vazia' });

  try {
    const r = await spotify('get', `/search?q=${encodeURIComponent(q)}&type=track&limit=8&market=BR`);
    const tracks = r.data.tracks.items.map(t => ({
      id:           t.id,
      uri:          t.uri,
      title:        t.name,
      artist:       t.artists.map(a => a.name).join(', '),
      album:        t.album.name,
      album_art:    t.album.images[1]?.url || t.album.images[0]?.url || null,
      duration_ms:  t.duration_ms,
      duration_str: `${Math.floor(t.duration_ms / 60000)}:${String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, '0')}`,
    }));
    res.json({ tracks });
  } catch (err) {
    console.error('❌ Search:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro na busca. Spotify autenticado?' });
  }
});

// ═══════════════════════════════════════════════════════
// FILA (QUEUE)
// ═══════════════════════════════════════════════════════

app.post('/api/queue', async (req, res) => {
  const { uri, spotify_id, title, artist, album_art, requested_by, duration_ms, duration_str } = req.body;
  if (!uri || !title || !requested_by) return res.status(400).json({ error: 'Dados incompletos' });

  // Próxima posição
  const { data: max } = await supabase
    .from('queue').select('position')
    .in('status', ['pending', 'playing'])
    .order('position', { ascending: false }).limit(1);
  const position = (max?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase.from('queue').insert({
    spotify_uri: uri, spotify_id, title, artist, album_art,
    requested_by, duration_ms, duration_str, position, status: 'pending',
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  console.log(`➕ Queue: ${title} por ${requested_by} (pos ${position})`);
  res.json({ song: data });
});

app.delete('/api/queue/:id', async (req, res) => {
  const { error } = await supabase.from('queue').update({ status: 'removed' }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════
// CONTROLES DO PLAYER
// ═══════════════════════════════════════════════════════

// Começa a tocar a primeira música da fila
app.post('/api/player/play', async (req, res) => {
  try {
    const next = await getNextSong();
    if (!next) return res.status(404).json({ error: 'Fila vazia' });
    await startPlaying(next);
    res.json({ ok: true, song: next });
  } catch (err) {
    console.error('❌ Play:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || 'Erro ao tocar' });
  }
});

// Pausa
app.post('/api/player/pause', async (req, res) => {
  try {
    await spotify('put', '/me/player/pause');
    await supabase.from('player_state').upsert({ id: 1, is_playing: false, updated_at: new Date().toISOString() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || 'Erro ao pausar' });
  }
});

// Retoma
app.post('/api/player/resume', async (req, res) => {
  try {
    await spotify('put', '/me/player/play');
    await supabase.from('player_state').upsert({ id: 1, is_playing: true, updated_at: new Date().toISOString() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || 'Erro ao retomar' });
  }
});

// Pula para a próxima (manual)
app.post('/api/player/next', async (req, res) => {
  try {
    await advanceQueue('manual_skip');
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Next:', err.message);
    res.status(500).json({ error: 'Erro ao pular' });
  }
});

// ═══════════════════════════════════════════════════════
// VOTOS PARA PULAR
// ═══════════════════════════════════════════════════════

app.post('/api/vote/skip', async (req, res) => {
  const { user_id, song_id } = req.body;
  if (!user_id || !song_id) return res.status(400).json({ error: 'Dados incompletos' });

  // Bloqueia voto duplicado
  const { data: existing } = await supabase
    .from('skip_votes').select('id').eq('song_id', song_id).eq('user_id', user_id).single();
  if (existing) return res.status(409).json({ error: 'Você já votou' });

  const { error } = await supabase.from('skip_votes').insert({ song_id, user_id });
  if (error) return res.status(500).json({ error: error.message });

  // Conta votos
  const { count } = await supabase
    .from('skip_votes').select('id', { count: 'exact', head: true }).eq('song_id', song_id);

  console.log(`👎 Voto skip: ${count}/${SKIP_NEEDED}`);

  if (count >= SKIP_NEEDED) {
    await advanceQueue('vote_skip');
    return res.json({ ok: true, skipped: true, votes: count, needed: SKIP_NEEDED });
  }

  res.json({ ok: true, skipped: false, votes: count, needed: SKIP_NEEDED });
});

// ═══════════════════════════════════════════════════════
// DISPOSITIVOS SPOTIFY
// ═══════════════════════════════════════════════════════

app.get('/api/devices', async (req, res) => {
  try {
    const r = await spotify('get', '/me/player/devices');
    res.json({ devices: r.data.devices });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar dispositivos' });
  }
});

app.post('/api/devices/select', async (req, res) => {
  const { device_id } = req.body;
  try {
    await spotify('put', '/me/player', { device_ids: [device_id], play: false });
    await supabase.from('settings').upsert({ key: 'device_id', value: device_id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao selecionar dispositivo' });
  }
});

// ═══════════════════════════════════════════════════════
// FUNÇÕES INTERNAS
// ═══════════════════════════════════════════════════════

async function getNextSong() {
  const { data } = await supabase
    .from('queue').select('*').eq('status', 'pending')
    .order('position', { ascending: true }).limit(1);
  return data?.[0] || null;
}

async function startPlaying(song) {
  // Marca música atual como tocada
  await supabase.from('queue').update({ status: 'played' }).eq('status', 'playing');

  // Verifica se tem dispositivo preferido salvo
  const { data: devSetting } = await supabase
    .from('settings').select('value').eq('key', 'device_id').single();

  const playBody = { uris: [song.spotify_uri] };
  if (devSetting?.value) playBody.device_id = devSetting.value;

  // Manda tocar no Spotify (e na Alexa via Spotify Connect)
  await spotify('put', '/me/player/play', playBody);

  // Atualiza estado no banco
  await supabase.from('queue').update({ status: 'playing' }).eq('id', song.id);
  await supabase.from('player_state').upsert({
    id: 1,
    is_playing:          true,
    current_song_id:     song.id,
    current_spotify_id:  song.spotify_id,
    updated_at:          new Date().toISOString(),
  });

  // Limpa votos de skip desta música
  await supabase.from('skip_votes').delete().eq('song_id', song.id);

  console.log(`▶️  Tocando: ${song.title} — ${song.artist}`);
}

async function advanceQueue(reason = 'auto') {
  // Pega o que estava tocando
  const { data: state } = await supabase
    .from('player_state').select('current_song_id').eq('id', 1).single();

  if (state?.current_song_id) {
    const newStatus = reason === 'vote_skip' ? 'skipped' : 'played';
    await supabase.from('queue').update({ status: newStatus }).eq('id', state.current_song_id);
    console.log(`⏭  ${reason}: marcou ${state.current_song_id} como ${newStatus}`);
  }

  const next = await getNextSong();
  if (!next) {
    // Fila acabou
    await supabase.from('player_state').upsert({
      id: 1, is_playing: false,
      current_song_id: null, current_spotify_id: null,
      updated_at: new Date().toISOString(),
    });
    console.log('🎵 Fila vazia — playback encerrado.');
    return;
  }

  await startPlaying(next);
}

// ═══════════════════════════════════════════════════════
// MONITOR DE PLAYBACK (a cada 4 segundos)
// Detecta quando a música atual terminou e avança a fila
// ═══════════════════════════════════════════════════════

let lastKnownSpotifyId = null;
let nearEndTriggered   = false;

async function monitorPlayback() {
  try {
    const r = await spotify('get', '/me/player/currently-playing');

    // 204 = nada tocando
    if (r.status === 204 || !r.data?.item) {
      lastKnownSpotifyId = null;
      nearEndTriggered   = false;
      return;
    }

    const { item, progress_ms, is_playing } = r.data;
    if (!is_playing) return;

    const spotifyId = item.id;
    const remaining = item.duration_ms - progress_ms;

    // Pega o que WE sabemos que está tocando
    const { data: state } = await supabase
      .from('player_state')
      .select('current_spotify_id, is_playing')
      .eq('id', 1).single();

    // ── Mudança de faixa ──────────────────────────────────
    // Spotify mudou para outra música (fim natural ou skip no dispositivo)
    if (lastKnownSpotifyId && lastKnownSpotifyId !== spotifyId) {
      if (state?.current_spotify_id && state.current_spotify_id === lastKnownSpotifyId) {
        // Era a nossa música que acabou → avança fila
        await advanceQueue('auto');
        nearEndTriggered = false;
      }
    }
    lastKnownSpotifyId = spotifyId;

    // ── Pré-transição nos últimos 8 segundos ──────────────
    // Chama próxima música antes de acabar para reduzir gap
    if (remaining < 8000 && remaining > 500 && !nearEndTriggered) {
      if (state?.current_spotify_id === spotifyId) {
        const next = await getNextSong();
        if (next) {
          nearEndTriggered = true;
          console.log(`⏳ ${Math.round(remaining / 1000)}s restantes — preparando: ${next.title}`);
          // Aguarda a faixa terminar naturalmente (detected pela mudança de ID no próximo poll)
        }
      }
    }

    // Reset trigger se ainda temos tempo
    if (remaining > 15000) nearEndTriggered = false;

  } catch (err) {
    const status = err.response?.status;
    // Ignora erros esperados
    if (status && [401, 404, 429].includes(status)) return;
    console.error('⚠️  Monitor:', err.response?.data?.error?.message || err.message);
  }
}

setInterval(monitorPlayback, 4000);
console.log('🔁 Monitor de playback iniciado (4s)');

// ═══════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🚀  Crescent Hub – Festival Server`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`    Login:  http://localhost:${PORT}/login`);
  console.log(`    Status: http://localhost:${PORT}/api/status\n`);
});
