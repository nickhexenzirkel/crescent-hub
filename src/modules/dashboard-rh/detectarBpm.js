// Detecta o andamento (BPM) de um arquivo de áudio, no navegador, sem servidor.
// Envelope de energia (janelas de 10 ms) → onsets (aumentos de energia) →
// autocorrelação nos andamentos de 60 a 200 BPM. Usado pela aba Lira Estelar
// do Dashboard RH pra sugerir os "ms por traço" da tablatura.

const BPM_MIN = 60, BPM_MAX = 200;
const MAX_SEGUNDOS = 120;   // basta o começo da música; mais que isso só pesa

export async function detectarBpm(arquivo) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Este navegador não consegue ler áudio.');
  const ctx = new Ctx();
  let buf;
  try { buf = await ctx.decodeAudioData(await arquivo.arrayBuffer()); }
  catch { throw new Error('Não consegui ler esse áudio. Tente um MP3, WAV ou M4A.'); }
  finally { ctx.close?.(); }

  const sr = buf.sampleRate;
  const total = Math.min(buf.length, Math.floor(sr * MAX_SEGUNDOS));
  const canais = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const janela = Math.round(sr * 0.01);                 // 10 ms
  const n = Math.floor(total / janela);
  if (n < 400) throw new Error('Áudio curto demais pra descobrir o andamento.');

  // energia média por janela (mistura dos canais)
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = i * janela; k < (i + 1) * janela; k++) {
      let v = 0; for (const ch of canais) v += ch[k];
      v /= canais.length; s += v * v;
    }
    env[i] = Math.sqrt(s / janela);
  }

  // onsets: só os aumentos de energia, tirando a média local
  const on = new Float32Array(n);
  for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
  const media = on.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) on[i] = Math.max(0, on[i] - media);

  const lagMin = Math.floor(6000 / BPM_MAX), lagMax = Math.ceil(6000 / BPM_MIN);
  const ac = new Float32Array(lagMax + 2);
  for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += on[i] * on[i - lag];
    ac[lag] = s / (n - lag);
  }
  let melhor = lagMin;
  for (let lag = lagMin; lag <= lagMax; lag++) if (ac[lag] > ac[melhor]) melhor = lag;
  if (!(ac[melhor] > 0)) throw new Error('Não achei um pulso claro nessa música.');

  // interpolação parabólica pra passar da resolução de 10 ms
  const a = ac[melhor - 1], b = ac[melhor], c = ac[melhor + 1];
  const den = a - 2 * b + c;
  const lagFino = melhor + (den ? 0.5 * (a - c) / den : 0);
  let bpm = 6000 / lagFino;
  while (bpm < 70) bpm *= 2;      // dobra/metade: leva pro intervalo mais natural
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

// ms de cada traço da tablatura, dado o BPM e quantos traços cabem num tempo.
export const msPorTraco = (bpm, tracosPorTempo) =>
  Math.round(60000 / bpm / Math.max(1, tracosPorTempo));
