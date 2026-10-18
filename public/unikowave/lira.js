/* Lira Estelar — modo de jogo do Uniko Wave inspirado na lira do Genshin Impact.
   21 notas (3 oitavas x do-re-mi-fa-sol-la-si). Cada toque soa e vibra; no modo
   guiado um círculo dourado mostra QUAL nota tocar agora (e um anel que encolhe
   chama a atenção). Autocontido: injeta o próprio CSS/HTML e só expõe
   abrirLira()/fecharLira(). Ver vault/Sistema/unikowave-lira-estelar.md */
(function(){
  'use strict';

  const SOLFEGE = ['do','re','mi','fa','sol','la','si'];
  const SEMITONS = [0,2,4,5,7,9,11];
  const BASE_MIDI = [72,60,48]; // linha de cima = aguda, meio, baixo = grave
  const ROW_KEYS = [
    ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU'],
    ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ'],
    ['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM']
  ];
  const ROW_NAMES = ['AGUDO','MÉDIO','GRAVE'];

  /* Músicas: "+n" = linha aguda, "n" = média, "-n" = grave (n = 1..7 do dó ao si). */
  const SONGS = [
    { id:'estrelinha', nome:'Brilha, Brilha Estrelinha', nivel:'Fácil', ms:480,
      seq:'1 1 5 5 6 6 5 4 4 3 3 2 2 1 5 5 4 4 3 3 2 5 5 4 4 3 3 2 1 1 5 5 6 6 5 4 4 3 3 2 2 1' },
    { id:'ode', nome:'Ode à Alegria', nivel:'Fácil', ms:460,
      seq:'3 3 4 5 5 4 3 2 1 1 2 3 3 2 2 3 3 4 5 5 4 3 2 1 1 2 3 2 1 1 2 2 3 1 2 3 4 3 1 2 3 4 3 2 1 2 -5 3 3 4 5 5 4 3 2 1 1 2 3 2 1 1' },
    { id:'jacques', nome:'Frère Jacques', nivel:'Fácil', ms:480,
      seq:'1 2 3 1 1 2 3 1 3 4 5 3 4 5 5 6 5 4 3 1 5 6 5 4 3 1 1 -5 1 1 -5 1' },
    { id:'jingle', nome:'Jingle Bells', nivel:'Médio', ms:360,
      seq:'3 3 3 3 3 3 3 5 1 2 3 4 4 4 4 4 3 3 3 3 2 2 3 2 5 3 3 3 3 3 3 3 5 1 2 3 4 4 4 4 4 3 3 3 5 5 4 2 1' },
    { id:'parabens', nome:'Parabéns pra Você', nivel:'Médio', ms:460,
      seq:'5 5 6 5 +1 7 5 5 6 5 +2 +1 5 5 +5 +3 +1 7 6 +4 +4 +3 +1 +2 +1' }
  ];

  function parseSeq(str){
    return str.trim().split(/\s+/).map(tok=>{
      let row = 1; let t = tok;
      if(t[0]==='+'){ row=0; t=t.slice(1); }
      else if(t[0]==='-'){ row=2; t=t.slice(1); }
      const deg = parseInt(t,10)-1;
      return row*7 + deg;
    });
  }
  /* Tablatura: cada letra é uma tecla; letras coladas = acorde (tocar juntas);
     cada "-" ou "_" é uma pausa de 1 unidade (só afeta o "Ouvir"). */
  const LETRA_CELULA = {};
  ROW_KEYS.forEach((row,r)=>row.forEach((code,d)=>{ LETRA_CELULA[code.replace('Key','')] = r*7+d; }));
  function parseTab(linhas){
    const passos = [];
    linhas.forEach(l=>{
      const re = /([A-Z]+)([-_]*)/g; let m;
      while((m = re.exec(l))){
        passos.push({ c:[...new Set(m[1].split('').map(ch=>LETRA_CELULA[ch]))], w:m[2].length+1 });
      }
      if(passos.length) passos[passos.length-1].w += 3; // respiro no fim da linha
    });
    return passos;
  }
  SONGS.push({ id:'columbina', nome:'Columbina Lullaby', nivel:'Difícil', unit:105, tab:["NE_________Y_________Y______________T","BY_________T____T____W","VE_________Q_________W____E____T","NE_________E","NE_________Y_________BY______________T","NY_________T____T____BW","VE_________Q_________BW____Q____J____G","NQ____CH____N____M____AQ_________BW","VE____Z____V____NQ____AW____N____BQ____J","NQ____CJ____NH____A____NQ____J____BQ____W","VE____Z____V____ZQ____BW____X____BQ____BJ","ZE____C____B____A____XQ_________W","VE____Z____V____ZQ____NW____B____BQ____J","NQ____CJ____NH____A____NH____J____BQ____J","VH____Z____V____ZE____BW____XQ____BJ____BG","NH____C____N____S","N____C____N____S","N____C____M____N____D_________M____B","N____B____M____B____S_________G","NE_________Y_________Y______________T","BY_________T____T____W","VE_________Q_________W____E____T","NE_________E","NE_________Y_________BY______________T","NY_________T____T____BW","VE_________Q_________BW____Q____J____G","NQ____CH____N____M____AQ_________BW","VE____Z____V____NQ____AW____N____BQ____J","NQ____CJ____NH____A____NQ____J____BQ____W","VE____Z____V____ZQ____BW____X____BQ____BJ","ZE____C____B____A____XQ_________W","VE____Z____V____ZQ____NW____B____BQ____J","NQ____CJ____NH____A____NH____J____BQ____J","VH____Z____V____ZE____BW____XQ____BJ____BG","NBH____C____N____S","N____C____N____S____H____J____Q____J","VH______________E____BW____Q____J____G","NH____C____M____A____G____M____A____N","N"] });
  SONGS.forEach(s=>{
    if(s.tab){ s.steps = parseTab(s.tab); }
    else { s.steps = parseSeq(s.seq).map(c=>({ c:[c], w:0, ms:s.ms })); }
  });
  const stepMs = (s,p) => p.ms || p.w*s.unit;

  // Config: errar não soa (não atrapalha a melodia). Ligada por padrão.
  const KEY_MUDO = 'dw_lira_mudo_erro';
  let mudoErro = true;
  try{ mudoErro = localStorage.getItem(KEY_MUDO) !== '0'; }catch(_){}

  const KEY_BEST = 'dw_lira_best';
  function loadBest(){ try{ return JSON.parse(localStorage.getItem(KEY_BEST))||{}; }catch(_){ return {}; } }
  function saveBest(id, stars){
    const b = loadBest(); if((b[id]||0) >= stars) return;
    b[id] = stars; try{ localStorage.setItem(KEY_BEST, JSON.stringify(b)); }catch(_){}
  }

  /* ---------- Som (lira sintetizada) ---------- */
  let ac = null, master = null;
  function audio(){
    if(!ac){
      try{
        ac = new (window.AudioContext||window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0.8;
        // eco leve, dá o "ar" de harpa
        const delay = ac.createDelay(1); delay.delayTime.value = 0.21;
        const fb = ac.createGain(); fb.gain.value = 0.3;
        const wet = ac.createGain(); wet.gain.value = 0.28;
        master.connect(ac.destination);
        master.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ac.destination);
      }catch(_){ ac = null; }
    }
    if(ac && ac.state==='suspended') ac.resume();
    return ac;
  }
  function freqOf(cell){
    const row = Math.floor(cell/7), deg = cell%7;
    const midi = BASE_MIDI[row] + SEMITONS[deg];
    return 440*Math.pow(2,(midi-69)/12);
  }
  function pluck(cell){
    const a = audio(); if(!a) return;
    const f = freqOf(cell), t = a.currentTime;
    const dur = f < 200 ? 2.2 : f < 450 ? 1.7 : 1.3;
    const partes = [[1,'triangle',0.55,dur],[2,'sine',0.22,dur*0.6],[3,'sine',0.08,dur*0.35],[4,'sine',0.04,dur*0.2]];
    partes.forEach(([mul,tipo,vol,d])=>{
      const o = a.createOscillator(), g = a.createGain();
      o.type = tipo; o.frequency.value = f*mul;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(vol,t+0.006);
      g.gain.exponentialRampToValueAtTime(0.0008,t+d);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t+d+0.05);
    });
  }
  function sfxErro(){
    const a = audio(); if(!a) return;
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type='sine'; o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(110,t+0.18);
    g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.0008,t+0.2);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+0.22);
  }
  function sfxFim(){
    [14,18,7,11,0].forEach((c,i)=>setTimeout(()=>pluck(c+0),i*140)); // arpejo de vitória (linha aguda)
  }

  /* ---------- CSS ---------- */
  const CSS = `
#liraScr{position:fixed;inset:0;z-index:9500;display:none;flex-direction:column;align-items:center;color:#fff;overflow:hidden;
  font-family:var(--font-body,system-ui,sans-serif);user-select:none;-webkit-user-select:none;touch-action:manipulation;
  background:radial-gradient(ellipse at 50% 0%,#2a1a5e 0%,#120a33 55%,#07041a 100%);--s:min(11.4vw,13.5vh,88px)}
#liraScr.on{display:flex}
#liraScr .lr-stars{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#liraScr .lr-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.5;animation:lrTw 3s ease-in-out infinite}
@keyframes lrTw{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:.9;transform:scale(1.3)}}
#liraScr .lr-top{position:relative;z-index:2;width:100%;max-width:980px;padding:12px 16px 4px;display:flex;flex-direction:column;gap:8px}
#liraScr .lr-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#liraScr .lr-back{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:10px;padding:8px 14px;cursor:pointer;font-family:var(--font-pixel,monospace);font-size:9px;letter-spacing:1px}
#liraScr .lr-back:hover{background:rgba(255,255,255,.16)}
#liraScr .lr-title{font-family:var(--font-pixel,monospace);font-size:13px;letter-spacing:2px;background:linear-gradient(135deg,#7ff0ff,#c9a8ff,#ffd98a);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
#liraScr .lr-sp{flex:1}
#liraScr .lr-stat{font-family:var(--font-pixel,monospace);font-size:9px;color:rgba(255,255,255,.7);letter-spacing:1px}
#liraScr .lr-stat b{color:#ffd98a;font-weight:400}
#liraScr .lr-songs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
#liraScr .lr-chip{flex:0 0 auto;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:999px;padding:7px 13px;cursor:pointer;font-size:12px;white-space:nowrap;display:flex;gap:6px;align-items:center}
#liraScr .lr-chip.sel{background:linear-gradient(135deg,rgba(127,240,255,.28),rgba(201,168,255,.28));border-color:#9fe9ff;box-shadow:0 0 14px rgba(127,240,255,.35)}
#liraScr .lr-chip small{opacity:.65;font-size:10px}
#liraScr .lr-prog{height:6px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}
#liraScr .lr-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7ff0ff,#ffd98a);transition:width .25s}
#liraScr .lr-hint{text-align:center;font-size:12px;color:rgba(255,255,255,.65);min-height:16px}
#liraScr .lr-stage{position:relative;z-index:2;flex:1;display:flex;align-items:center;justify-content:center;width:100%}
#liraScr .lr-grid{display:flex;flex-direction:column;gap:calc(var(--s)*.5);padding:0 8px}
#liraScr .lr-row{display:flex;align-items:center;gap:calc(var(--s)*.22)}
#liraScr .lr-rowlbl{width:calc(var(--s)*.5);font-family:var(--font-pixel,monospace);font-size:calc(var(--s)*.12);color:rgba(255,255,255,.4);writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;letter-spacing:2px}
#liraScr .lr-cell{position:relative;width:var(--s);height:var(--s);flex:0 0 auto;display:flex;align-items:center;justify-content:center;cursor:pointer}
#liraScr .lr-note{position:relative;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fffdf0,#f1e9c9 70%,#e2d6aa);
  box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 -3px 6px rgba(160,140,80,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:filter .15s}
#liraScr .lr-note svg{width:58%;height:48%;margin-top:-4%}
#liraScr .lr-sol{position:absolute;bottom:17%;font-size:calc(var(--s)*.15);color:#9a8a4a;font-weight:600}
#liraScr .lr-key{position:absolute;bottom:calc(var(--s)*-.2);background:#fff;color:#2a2440;border-radius:5px;font-family:var(--font-pixel,monospace);font-size:calc(var(--s)*.14);padding:3px 5px 2px;box-shadow:0 2px 5px rgba(0,0,0,.4)}
#liraScr .lr-cnt{position:absolute;bottom:calc(var(--s)*-.56);left:50%;transform:translateX(-50%);display:none;background:#ffd45a;color:#2a1a00;font-family:var(--font-pixel,monospace);font-size:calc(var(--s)*.17);padding:3px 7px 2px;border-radius:8px;box-shadow:0 0 10px rgba(255,212,90,.8);animation:lrPulse 1s ease-in-out infinite;white-space:nowrap}
#liraScr .lr-cell.multi .lr-cnt{display:block}
#liraScr .lr-ord{position:absolute;top:calc(var(--s)*-.1);right:calc(var(--s)*-.1);display:none;min-width:calc(var(--s)*.3);height:calc(var(--s)*.3);padding:0 4px;box-sizing:border-box;border-radius:999px;background:#4fd8ee;color:#05283a;font-family:var(--font-pixel,monospace);font-size:calc(var(--s)*.15);align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.5);z-index:3}
#liraScr .lr-ord.on{display:flex}
#liraScr .lr-ord.first{background:#ffd45a;color:#2a1a00}
#liraScr .lr-queue{display:flex;gap:6px;align-items:center;overflow:hidden;min-height:30px}
#liraScr .lr-queue .ql{font-family:var(--font-pixel,monospace);font-size:8px;color:rgba(255,255,255,.5);letter-spacing:1px;margin-right:2px}
#liraScr .lr-q{flex:0 0 auto;display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:9px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);font-family:var(--font-pixel,monospace);font-size:10px;color:#cfeaff}
#liraScr .lr-q i{font-style:normal;font-size:8px;color:#4fd8ee}
#liraScr .lr-q b{font-weight:400;color:#ffd98a;font-size:9px}
#liraScr .lr-q.cur{background:rgba(255,212,90,.2);border-color:#ffd45a;color:#fff;box-shadow:0 0 12px rgba(255,212,90,.5);transform:scale(1.1)}
#liraScr .lr-q.cur i{color:#ffd45a}
#liraScr .lr-cell.hit .lr-note{animation:lrVib .42s cubic-bezier(.2,.8,.3,1)}
@keyframes lrVib{0%{transform:scale(1)}12%{transform:scale(1.22) rotate(-5deg);filter:brightness(1.25)}28%{transform:scale(.93) rotate(4deg)}44%{transform:scale(1.1) rotate(-3deg)}60%{transform:scale(.97) rotate(2deg)}78%{transform:scale(1.03) rotate(-1deg)}100%{transform:scale(1) rotate(0)}}
#liraScr .lr-cell.err .lr-note{animation:lrErr .3s;filter:hue-rotate(-40deg) saturate(1.8)}
@keyframes lrErr{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
#liraScr .lr-ripple{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(127,240,255,.9);pointer-events:none;animation:lrRip .75s ease-out forwards}
@keyframes lrRip{from{transform:scale(1);opacity:.9}to{transform:scale(2.5);opacity:0}}
#liraScr .lr-spark{position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3px;pointer-events:none;background:#fff8c8;border-radius:50%;box-shadow:0 0 8px #ffe48a;animation:lrSpark .7s ease-out forwards}
@keyframes lrSpark{to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
#liraScr .lr-float{position:absolute;left:50%;top:0;pointer-events:none;font-size:calc(var(--s)*.4);color:#bff4ff;text-shadow:0 0 8px #7ff0ff;animation:lrFloat 1s ease-out forwards}
@keyframes lrFloat{from{transform:translate(-50%,0);opacity:1}to{transform:translate(calc(-50% + var(--dx)),calc(var(--s)*-1.1));opacity:0}}
/* guia: círculo dourado ao redor da nota da vez */
#liraScr .lr-guide{position:absolute;inset:-9%;border-radius:50%;pointer-events:none;display:none;border:3px solid #ffd45a;box-shadow:0 0 18px 3px rgba(255,212,90,.85),inset 0 0 14px rgba(255,212,90,.55);animation:lrPulse 1s ease-in-out infinite}
#liraScr .lr-guide::after{content:'';position:absolute;inset:-6%;border-radius:50%;border:2px solid rgba(255,230,150,.9);animation:lrApproach 1.1s ease-out infinite}
#liraScr .lr-cell.target .lr-guide{display:block}
#liraScr .lr-cell.target .lr-note{filter:drop-shadow(0 0 10px rgba(255,212,90,.9))}
@keyframes lrPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.8}}
@keyframes lrApproach{from{transform:scale(2.1);opacity:0}25%{opacity:.9}to{transform:scale(1);opacity:0}}
#liraScr .lr-next{position:absolute;inset:-4%;border-radius:50%;pointer-events:none;display:none;border:2px dashed rgba(127,240,255,.6)}
#liraScr .lr-cell.next .lr-next{display:block}
#liraScr .lr-cell.demo .lr-note{animation:lrVib .42s cubic-bezier(.2,.8,.3,1)}
#liraScr .lr-end{position:absolute;inset:0;z-index:5;background:rgba(5,3,20,.78);display:none;align-items:center;justify-content:center;padding:16px}
#liraScr .lr-end.on{display:flex}
#liraScr .lr-card{background:linear-gradient(160deg,#2b1a63,#150d3b);border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:26px 30px;text-align:center;max-width:420px;box-shadow:0 10px 40px rgba(0,0,0,.6)}
#liraScr .lr-card h2{margin:0 0 6px;font-family:var(--font-pixel,monospace);font-size:14px;letter-spacing:2px;color:#ffd98a}
#liraScr .lr-card p{margin:4px 0;font-size:13px;color:rgba(255,255,255,.8)}
#liraScr .lr-stars-row{font-size:38px;letter-spacing:6px;margin:10px 0;color:#ffd45a;text-shadow:0 0 14px rgba(255,212,90,.7)}
#liraScr .lr-stars-row .off{color:rgba(255,255,255,.2);text-shadow:none}
#liraScr .lr-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}
#liraScr .lr-btn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:10px;padding:10px 16px;cursor:pointer;font-size:12px}
#liraScr .lr-btn.pri{background:linear-gradient(135deg,#7ff0ff,#b794ff);color:#150d3b;border:none;font-weight:700}
#liraScr .lr-act{display:flex;gap:8px;justify-content:center}
@media (max-height:560px){#liraScr .lr-hint{display:none}}
`;

  /* ---------- Estado / DOM ---------- */
  let root = null, cells = [];
  let song = null, idx = 0, got = new Set(), errors = 0, streak = 0, bestStreak = 0, done = false;
  let demoTimers = [], demoOn = false, openFlag = false;

  const NOTE_SVG = (deg) => {
    // glifo: anel com barras horizontais empilhadas (mais barras = nota mais alta), como na lira do jogo
    const bars = deg + 1; let s = '<svg viewBox="0 0 40 40" fill="none" stroke="#3f9a8c" stroke-width="3" stroke-linecap="round">';
    if(deg===0){ s += '<circle cx="20" cy="20" r="8"/><path d="M6 20h28"/>'; }
    else {
      const gap = Math.min(5, 22/bars);
      const y0 = 20 - (bars-1)*gap/2;
      for(let i=0;i<bars;i++){ const y=y0+i*gap; s += `<path d="M${10+(i%2)*2} ${y.toFixed(1)}h${20-(i%2)*4}"/>`; }
      s += '<circle cx="20" cy="20" r="3.2" fill="#3f9a8c" stroke="none"/>';
    }
    return s+'</svg>';
  };

  function build(){
    if(root) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'liraScr';
    let stars = ''; for(let i=0;i<40;i++) stars += `<span class="lr-star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${(Math.random()*3).toFixed(2)}s"></span>`;
    let grid = '';
    for(let r=0;r<3;r++){
      grid += `<div class="lr-row"><div class="lr-rowlbl">${ROW_NAMES[r]}</div>`;
      for(let d=0;d<7;d++){
        const key = ROW_KEYS[r][d].replace('Key','');
        grid += `<div class="lr-cell" data-cell="${r*7+d}"><div class="lr-note">${NOTE_SVG(d)}<span class="lr-sol">${SOLFEGE[d]}</span></div><div class="lr-next"></div><div class="lr-guide"></div><span class="lr-key">${key}</span><span class="lr-cnt"></span><span class="lr-ord"></span></div>`;
      }
      grid += '</div>';
    }
    root.innerHTML = `
      <div class="lr-stars">${stars}</div>
      <div class="lr-top">
        <div class="lr-bar">
          <button class="lr-back" data-a="close">◀ VOLTAR</button>
          <div class="lr-title">LIRA ESTELAR</div>
          <div class="lr-sp"></div>
          <button class="lr-back" data-a="mudo" id="lrMudo" title="Quando ligado, tocar uma nota errada não faz som"></button>
          <div class="lr-stat">ACERTOS <b id="lrOk">0</b></div>
          <div class="lr-stat">ERROS <b id="lrErr">0</b></div>
          <div class="lr-stat">SEQ <b id="lrStreak">0</b></div>
        </div>
        <div class="lr-songs" id="lrSongs"></div>
        <div class="lr-queue" id="lrQueue"></div>
        <div class="lr-prog"><i id="lrProg"></i></div>
        <div class="lr-hint" id="lrHint"></div>
      </div>
      <div class="lr-stage"><div class="lr-grid" id="lrGrid">${grid}</div></div>
      <div class="lr-end" id="lrEnd"><div class="lr-card" id="lrCard"></div></div>`;
    document.body.appendChild(root);
    cells = Array.from(root.querySelectorAll('.lr-cell'));

    // toque/clique (pointerdown permite vários dedos ao mesmo tempo)
    cells.forEach(c=>{
      c.addEventListener('pointerdown',e=>{ e.preventDefault(); tocar(+c.dataset.cell); });
    });
    root.addEventListener('click',e=>{
      const b = e.target.closest('[data-a]'); if(!b) return;
      const a = b.dataset.a;
      if(a==='close') fechar();
      else if(a==='demo') ouvir();
      else if(a==='mudo'){ mudoErro = !mudoErro; try{ localStorage.setItem(KEY_MUDO, mudoErro?'1':'0'); }catch(_){} rotuloMudo(); }
      else if(a==='free') escolher(null);
      else if(a==='again') escolher(song);
      else if(a==='next'){ const i = SONGS.indexOf(song); escolher(SONGS[(i+1)%SONGS.length]); }
    });
    renderSongs(); rotuloMudo();
    window.addEventListener('keydown',onKey,true);
  }

  function rotuloMudo(){
    const b = root.querySelector('#lrMudo');
    b.textContent = mudoErro ? '🔇 ERRO SEM SOM: SIM' : '🔊 ERRO SEM SOM: NÃO';
    b.style.borderColor = mudoErro ? '#7ff0ff' : '';
  }

  function renderSongs(){
    const best = loadBest(), el = root.querySelector('#lrSongs');
    const stars = n => '★'.repeat(n)+'☆'.repeat(3-n);
    el.innerHTML = `<button class="lr-chip ${song?'':'sel'}" data-a="free">🎵 Livre</button>` +
      SONGS.map(s=>`<button class="lr-chip ${song===s?'sel':''}" data-song="${s.id}">${s.nome} <small>${s.nivel} · ${stars(best[s.id]||0)}</small></button>`).join('');
    el.querySelectorAll('[data-song]').forEach(b=>b.addEventListener('click',()=>escolher(SONGS.find(s=>s.id===b.dataset.song))));
  }

  function pararDemo(){ demoTimers.forEach(clearTimeout); demoTimers = []; demoOn = false; cells.forEach(c=>c.classList.remove('demo')); }

  function escolher(s){
    pararDemo();
    song = s; idx = 0; got = new Set(); errors = 0; streak = 0; bestStreak = 0; done = false;
    root.querySelector('#lrEnd').classList.remove('on');
    renderSongs(); atualizar();
  }

  function atualizar(){
    cells.forEach(c=>{ c.classList.remove('target','next','multi'); const o=c.querySelector('.lr-ord'); o.className='lr-ord'; o.textContent=''; });
    const q = id => root.querySelector(id);
    q('#lrOk').textContent = idx; q('#lrErr').textContent = errors; q('#lrStreak').textContent = streak;
    const hint = q('#lrHint'), prog = q('#lrProg');
    if(!song){
      q('#lrQueue').innerHTML = ''; prog.style.width = '0'; hint.innerHTML = 'Modo livre: toque nas notas (ou use <b>Q W E R T Y U</b> / <b>A S D F G H J</b> / <b>Z X C V B N M</b>) e crie sua música.';
      return;
    }
    prog.style.width = (idx/song.steps.length*100)+'%';
    if(!done){
      song.steps[idx].c.forEach(c=>{ if(!got.has(c)) cells[c].classList.add('target'); });
      if(idx+1 < song.steps.length) song.steps[idx+1].c.forEach(c=>cells[c].classList.add('next'));
      desenharOrdem();
    }
    hint.innerHTML = `Toque na nota com o <b style="color:#ffd45a">círculo dourado</b>. <button class="lr-btn" style="padding:3px 10px;font-size:11px" data-a="demo">👂 Ouvir a música</button>`;
  }

  /* Fila: junta passos seguidos iguais ("Y ×2") e mostra a ordem nas notas e numa faixa */
  const LETRA_DA = c => ROW_KEYS[Math.floor(c/7)][c%7].replace('Key','');
  function filaProxima(max){
    const fila = []; let i = idx;
    while(i < song.steps.length && fila.length < max){
      const k = song.steps[i].c.join(',');
      let n = 1; while(i+n < song.steps.length && song.steps[i+n].c.join(',') === k) n++;
      fila.push({ c:song.steps[i].c, n });
      i += n;
    }
    return fila;
  }
  function desenharOrdem(){
    const fila = filaProxima(10);
    // número de vezes na nota da vez (ex.: 2x)
    const atual = fila[0];
    if(atual && atual.n > 1) atual.c.forEach(c=>{ if(!got.has(c)){ cells[c].classList.add('multi'); cells[c].querySelector('.lr-cnt').textContent = atual.n+'x'; } });
    // ordem 1,2,3,4 nas notas
    const marcas = {};
    fila.slice(0,4).forEach((f,k)=>f.c.forEach(c=>{ (marcas[c] = marcas[c]||[]).push(k+1); }));
    Object.keys(marcas).forEach(c=>{
      const o = cells[c].querySelector('.lr-ord'); o.textContent = marcas[c].join('·');
      o.className = 'lr-ord on' + (marcas[c][0]===1 ? ' first' : '');
    });
    // faixa de próximas notas
    root.querySelector('#lrQueue').innerHTML = '<span class="ql">ORDEM</span>' + fila.map((f,k)=>
      `<span class="lr-q${k===0?' cur':''}"><i>${k+1}</i>${f.c.map(LETRA_DA).join('+')}${f.n>1?` <b>${f.n}x</b>`:''}</span>`).join('');
  }

  /* ---------- Efeitos ---------- */
  function efeito(cell, ok){
    const c = cells[cell];
    c.classList.remove('hit','err'); void c.offsetWidth; c.classList.add(ok===false?'err':'hit');
    if(ok===false) return;
    for(let i=0;i<2;i++){
      const r = document.createElement('div'); r.className='lr-ripple'; r.style.animationDelay=(i*0.14)+'s';
      c.appendChild(r); setTimeout(()=>r.remove(),1100);
    }
    for(let i=0;i<8;i++){
      const sp = document.createElement('span'); sp.className='lr-spark';
      const ang = Math.random()*Math.PI*2, dist = 40+Math.random()*34;
      sp.style.setProperty('--dx',Math.cos(ang)*dist+'px'); sp.style.setProperty('--dy',Math.sin(ang)*dist+'px');
      c.appendChild(sp); setTimeout(()=>sp.remove(),800);
    }
    const fl = document.createElement('span'); fl.className='lr-float'; fl.textContent = Math.random()<.5?'♪':'♫';
    fl.style.setProperty('--dx',(Math.random()*40-20)+'px'); c.appendChild(fl); setTimeout(()=>fl.remove(),1100);
  }

  /* ---------- Jogo ---------- */
  function tocar(cell){
    if(!openFlag || demoOn) return;
    if(song && !done){
      const passo = song.steps[idx];
      if(passo.c.includes(cell) && !got.has(cell)){
        pluck(cell); efeito(cell,true); got.add(cell);
        if(got.size >= passo.c.length){
          got = new Set(); idx++; streak++; if(streak>bestStreak) bestStreak = streak;
          if(idx >= song.steps.length){ done = true; atualizar(); setTimeout(fim,550); return; }
        }
        atualizar();
      } else if(passo.c.includes(cell)){
        pluck(cell); efeito(cell,true); // já tocada neste acorde: só soa
      } else {
        if(!mudoErro){ sfxErro(); pluck(cell); }
        efeito(cell,false);
        errors++; streak = 0; atualizar();
      }
    } else {
      pluck(cell); efeito(cell,true);
    }
  }

  function fim(){
    const total = song.steps.length, prec = total/(total+errors);
    const est = prec>=0.95?3:prec>=0.8?2:1;
    saveBest(song.id, est); renderSongs(); sfxFim();
    const star = '★'.repeat(est)+`<span class="off">${'★'.repeat(3-est)}</span>`;
    root.querySelector('#lrCard').innerHTML = `
      <h2>MÚSICA COMPLETA!</h2><p>${song.nome}</p>
      <div class="lr-stars-row">${star}</div>
      <p>Precisão: <b>${Math.round(prec*100)}%</b> · Erros: <b>${errors}</b> · Maior sequência: <b>${bestStreak}</b></p>
      <div class="lr-btns"><button class="lr-btn pri" data-a="again">Tocar de novo</button><button class="lr-btn" data-a="next">Próxima música</button><button class="lr-btn" data-a="free">Modo livre</button></div>`;
    root.querySelector('#lrEnd').classList.add('on');
  }

  function ouvir(){
    if(!song) return;
    if(demoOn){ pararDemo(); atualizar(); return; }
    demoOn = true; cells.forEach(c=>c.classList.remove('target','next'));
    let t = 300;
    song.steps.forEach(p=>{
      demoTimers.push(setTimeout(()=>{
        p.c.forEach(cell=>{ pluck(cell); const c = cells[cell]; c.classList.remove('demo'); void c.offsetWidth; c.classList.add('demo'); efeito(cell,true); });
      }, t));
      t += stepMs(song,p);
    });
    demoTimers.push(setTimeout(()=>{ pararDemo(); atualizar(); }, t + 500));
    root.querySelector('#lrHint').textContent = 'Ouvindo… (clique em "Ouvir" de novo pra parar)';
  }

  function onKey(e){
    if(!openFlag) return;
    e.stopImmediatePropagation(); // o resto do Uniko Wave não deve reagir às teclas aqui
    if(e.code==='Escape'){ e.preventDefault(); fechar(); return; }
    if(e.repeat) return;
    for(let r=0;r<3;r++){
      const d = ROW_KEYS[r].indexOf(e.code);
      if(d>=0){ e.preventDefault(); tocar(r*7+d); return; }
    }
  }

  function abrir(){
    build();
    openFlag = true; root.classList.add('on');
    try{ if(typeof pauseMenuMusic==='function') pauseMenuMusic(); }catch(_){}
    audio();
    escolher(SONGS[0]);
  }
  function fechar(){
    pararDemo(); openFlag = false;
    if(root) root.classList.remove('on');
    try{ if(typeof playMenuMusic==='function') playMenuMusic(); }catch(_){}
  }

  window.abrirLira = abrir;
  window.fecharLira = fechar;
})();
