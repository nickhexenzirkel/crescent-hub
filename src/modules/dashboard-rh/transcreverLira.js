// Transcreve um áudio em TABLATURA da Lira Estelar, no navegador.
// 1) acha os ataques (onsets) pela energia; 2) em cada ataque mede, por Goertzel,
// a força de cada uma das 21 notas da lira (fundamental + harmônicos); 3) escolhe
// a nota mais forte (e até `maxNotas` juntas = acorde); 4) joga tudo numa grade
// de `unit` ms por traço. O tom/oitava da música são ajustados sozinhos pra
// caber nas 3 oitavas de dó maior da lira. É uma aproximação (música com muita
// percussão/voz sai pior que piano/violão); o resultado cai no campo da
// tablatura pra o RH conferir e editar.

// Mesma afinação do jogo (public/unikowave/lira.js): linha 0 aguda, 1 média, 2 grave.
const SEMITONS = [0, 2, 4, 5, 7, 9, 11];
const BASE_MIDI = [72, 60, 48];
const LETRAS = [['Q', 'W', 'E', 'R', 'T', 'Y', 'U'], ['A', 'S', 'D', 'F', 'G', 'H', 'J'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M']];
const CELULAS = Array.from({ length: 21 }, (_, c) => {
  const row = Math.floor(c / 7), deg = c % 7;
  return { letra: LETRAS[row][deg], midi: BASE_MIDI[row] + SEMITONS[deg], pc: deg };
});

const MAX_SEGUNDOS = 240;
const JANELA = 4096;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const pausa = () => new Promise(r => setTimeout(r, 0));

const HANN = Float32Array.from({ length: JANELA }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (JANELA - 1)));

function goertzel(x, ini, n, sr, f) {
  const w = 2 * Math.PI * f / sr, coef = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const s = x[ini + i] * HANN[i] + coef * s1 - s2;
    s2 = s1; s1 = s;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coef * s1 * s2));
}

// Força da nota (midi) no trecho: fundamental + 2º e 3º harmônicos (pesos menores).
function forca(x, ini, sr, midi) {
  const f = hz(midi);
  let v = goertzel(x, ini, JANELA, sr, f);
  if (f * 2 < sr / 2.2) v += 0.5 * goertzel(x, ini, JANELA, sr, f * 2);
  if (f * 3 < sr / 2.2) v += 0.33 * goertzel(x, ini, JANELA, sr, f * 3);
  return v;
}

// Quão "fiel" ao áudio: simples = só as notas fortes e claras, uma por vez (fácil de jogar);
// equilibrado = melodia + acorde só quando é nítido; fiel = tudo que achar (pode ficar pesado).
export const NIVEIS_TRANSCRICAO = {
  simples:      { rotulo: 'Simples',      limiar: 2.6, maxNotas: 1, relAcorde: 0.85, espaco: 2,   prominencia: 2.6 },
  equilibrado:  { rotulo: 'Equilibrado',  limiar: 2.0, maxNotas: 2, relAcorde: 0.75, espaco: 1.5, prominencia: 2.2 },
  fiel:         { rotulo: 'Fiel',         limiar: 1.6, maxNotas: 3, relAcorde: 0.55, espaco: 1,   prominencia: 1.8 },
};

export async function transcreverLira(arquivo, { unit, nivel = 'equilibrado', aoProgresso } = {}) {
  const cfg = NIVEIS_TRANSCRICAO[nivel] || NIVEIS_TRANSCRICAO.equilibrado;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Este navegador não consegue ler áudio.');
  const ctx = new Ctx();
  let buf;
  try { buf = await ctx.decodeAudioData(await arquivo.arrayBuffer()); }
  catch { throw new Error('Não consegui ler esse áudio. Tente um MP3, WAV ou M4A.'); }
  finally { ctx.close?.(); }

  // mono + reamostra pra ~22 kHz (média de blocos) — basta pras notas da lira e fica 2x mais leve
  const fator = Math.max(1, Math.round(buf.sampleRate / 22050));
  const sr = buf.sampleRate / fator;
  const total = Math.min(Math.floor(buf.length / fator), Math.floor(sr * MAX_SEGUNDOS));
  const canais = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const x = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    let s = 0;
    for (const ch of canais) for (let k = 0; k < fator; k++) s += ch[i * fator + k];
    x[i] = s / (canais.length * fator);
  }
  if (total < JANELA * 4) throw new Error('Áudio curto demais.');

  // ── ataques: aumento de energia a cada 10 ms, acima da média local ──
  aoProgresso?.('Procurando as batidas…');
  const hop = Math.round(sr * 0.01), n = Math.floor(total / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; for (let k = i * hop; k < (i + 1) * hop; k++) s += x[k] * x[k];
    env[i] = Math.sqrt(s / hop);
  }
  const flux = new Float32Array(n);
  for (let i = 1; i < n; i++) flux[i] = Math.max(0, env[i] - env[i - 1]);
  const ataques = [];
  const J = 20, minDist = Math.max(4, Math.round(unit / 10 * cfg.espaco));
  for (let i = 1; i < n - 3; i++) {
    let m = 0, c = 0;
    for (let k = Math.max(0, i - J); k < Math.min(n, i + J); k++) { m += flux[k]; c++; }
    m /= c;
    let pico = true;
    for (let k = Math.max(0, i - 3); k <= i + 3; k++) if (flux[k] > flux[i]) { pico = false; break; }
    if (pico && flux[i] > m * cfg.limiar + 1e-4) {
      const ult = ataques[ataques.length - 1];
      if (ult && i - ult.i < minDist) { if (flux[i] > ult.f) { ult.i = i; ult.f = flux[i]; } }
      else ataques.push({ i, f: flux[i] });
    }
  }
  if (ataques.length < 8) throw new Error('Quase não achei batidas/notas claras nesse áudio.');

  // ── mede as 21 notas (e o espectro cromático amostrado, pra achar tom/oitava) ──
  const inicioDe = (a) => Math.min(total - JANELA, a.i * hop + Math.round(sr * 0.02));
  const amostra = ataques.filter((_, k) => k % Math.max(1, Math.floor(ataques.length / 80)) === 0);
  const E = {};   // midi -> energia somada nos ataques amostrados
  for (let a = 0; a < amostra.length; a++) {
    const ini = inicioDe(amostra[a]);
    for (let m = 24; m <= 107; m++) {
      E[m] = (E[m] || 0) + forca(x, ini, sr, m);
    }
    if (a % 10 === 0) { aoProgresso?.('Descobrindo o tom…'); await pausa(); }
  }
  let melhor = { t: 0, o: 0, v: -1 };
  for (let o = -24; o <= 24; o += 12) for (let t = -6; t <= 5; t++) {
    let v = 0; for (const c of CELULAS) v += E[c.midi + t + o] || 0;
    // pequeno desempate: prefere o mais perto do original
    v *= 1 - 0.002 * (Math.abs(t) + Math.abs(o) / 12);
    if (v > melhor.v) melhor = { t, o, v };
  }
  const desloc = melhor.t + melhor.o;

  // ── nota(s) de cada ataque ──
  const achados = [];
  for (let a = 0; a < ataques.length; a++) {
    const ini = inicioDe(ataques[a]);
    const pontos = CELULAS.map((c, idx) => ({ idx, v: forca(x, ini, sr, c.midi + desloc) })).sort((p, q) => q.v - p.v);
    achados.push({ i: ataques[a].i, pontos });
    if (a % 25 === 0) { aoProgresso?.(`Lendo as notas… ${Math.round(a / ataques.length * 100)}%`); await pausa(); }
  }
  const topos = achados.map(a => a.pontos[0].v).sort((p, q) => p - q);
  const piso = topos[Math.floor(topos.length * 0.2)] * 0.9 || 0;   // ruído: bem abaixo do normal

  const porSlot = new Map();   // slot -> { cel:[idx], v }
  const t0 = achados[0].i;
  for (const a of achados) {
    const topo = a.pontos[0];
    if (topo.v < piso) continue;
    // som sem altura definida (bateria, chiado, voz falada) espalha energia por todas as notas:
    // se a mais forte não se destaca da mediana, não é nota — fica pausa em vez de barulho
    const mediana = a.pontos[10].v || 1e-9;
    if (topo.v / mediana < cfg.prominencia) continue;
    const escolhidas = [topo.idx];
    for (let k = 1; k < a.pontos.length && escolhidas.length < cfg.maxNotas; k++) {
      const p = a.pontos[k];
      if (p.v < topo.v * cfg.relAcorde) break;
      // mesma nota em outra oitava = quase sempre só o harmônico; vizinha = vazamento do espectro
      if (escolhidas.some(e => CELULAS[e].pc === CELULAS[p.idx].pc || Math.abs(e - p.idx) < 2)) continue;
      escolhidas.push(p.idx);
    }
    const slot = Math.round((a.i - t0) * 10 / unit);
    const atual = porSlot.get(slot);
    if (!atual || topo.v > atual.v) porSlot.set(slot, { cel: escolhidas, v: topo.v });
    // a mesma nota de novo logo depois costuma ser só eco/cauda da anterior, não uma batida nova
    const anterior = porSlot.get(slot - 1);
    if (anterior && anterior.cel.join() === escolhidas.join() && !porSlot.get(slot - 2)) porSlot.delete(slot);
  }
  if (porSlot.size < 4) throw new Error('Não deu pra montar uma melodia com esse áudio.');

  // ── monta as linhas: cada slot vazio é "-"; quebra onde há 3+ pausas (o jogo já soma 3 no fim da linha) ──
  const ultimo = Math.max(...porSlot.keys());
  const linhas = []; let atual = '', cont = 0, acordes = 0, notas = 0;
  for (let s = 0; s <= ultimo; s++) {
    const p = porSlot.get(s);
    if (p) {
      atual += p.cel.map(i => CELULAS[i].letra).sort().join(''); cont++; notas++;
      if (p.cel.length > 1) acordes++;
    } else { atual += '-'; cont++; }
    const proximosVazios = !porSlot.has(s + 1) && !porSlot.has(s + 2) && !porSlot.has(s + 3);
    if (p && cont >= 24 && proximosVazios && s + 3 <= ultimo) { linhas.push(atual); atual = ''; cont = 0; s += 3; }
  }
  if (atual.replace(/-/g, '')) linhas.push(atual.replace(/-+$/, ''));
  return { tab: linhas.join('\n'), notas, acordes, tom: melhor.t, oitava: melhor.o / 12 };
}

// Prévia: toca a tablatura gerada (pluck simples) pra o RH ouvir e comparar com a música.
export function tocarPrevia(tab, unit) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ac = new Ctx(); const mestre = ac.createGain(); mestre.gain.value = 0.35; mestre.connect(ac.destination);
  const mapa = {}; CELULAS.forEach(c => { mapa[c.letra] = c.midi; });
  let t = ac.currentTime + 0.1;
  for (const l of (tab || '').split(/\r?\n/).map(x => x.replace(/\s+/g, '')).filter(Boolean)) {
    const re = /([A-Z]+)([-_]*)/g; let m;
    while ((m = re.exec(l))) {
      for (const ch of new Set(m[1])) {
        if (mapa[ch] === undefined) continue;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = hz(mapa[ch]);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        o.connect(g); g.connect(mestre); o.start(t); o.stop(t + 0.75);
      }
      t += (m[2].length + 1) * unit / 1000;
    }
    t += 3 * unit / 1000;
  }
  return () => { try { ac.close(); } catch { /* já fechado */ } };
}
