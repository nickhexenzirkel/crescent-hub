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
      const ini = /^[-_]+/.exec(l); if(ini && passos.length) passos[passos.length-1].w += ini[0].length;
      const re = /([A-Z]+)([-_]*)/g; let m;
      while((m = re.exec(l))){
        passos.push({ c:[...new Set(m[1].split('').map(ch=>LETRA_CELULA[ch]))], w:m[2].length+1 });
      }
      if(passos.length) passos[passos.length-1].w += 3; // respiro no fim da linha
    });
    return passos;
  }
  SONGS.push({ id:'columbina', nome:'Columbina Lullaby', nivel:'Difícil', unit:105, tab:["NE_________Y_________Y______________T","BY_________T____T____W","VE_________Q_________W____E____T","NE_________E","NE_________Y_________BY______________T","NY_________T____T____BW","VE_________Q_________BW____Q____J____G","NQ____CH____N____M____AQ_________BW","VE____Z____V____NQ____AW____N____BQ____J","NQ____CJ____NH____A____NQ____J____BQ____W","VE____Z____V____ZQ____BW____X____BQ____BJ","ZE____C____B____A____XQ_________W","VE____Z____V____ZQ____NW____B____BQ____J","NQ____CJ____NH____A____NH____J____BQ____J","VH____Z____V____ZE____BW____XQ____BJ____BG","NH____C____N____S","N____C____N____S","N____C____M____N____D_________M____B","N____B____M____B____S_________G","NE_________Y_________Y______________T","BY_________T____T____W","VE_________Q_________W____E____T","NE_________E","NE_________Y_________BY______________T","NY_________T____T____BW","VE_________Q_________BW____Q____J____G","NQ____CH____N____M____AQ_________BW","VE____Z____V____NQ____AW____N____BQ____J","NQ____CJ____NH____A____NQ____J____BQ____W","VE____Z____V____ZQ____BW____X____BQ____BJ","ZE____C____B____A____XQ_________W","VE____Z____V____ZQ____NW____B____BQ____J","NQ____CJ____NH____A____NH____J____BQ____J","VH____Z____V____ZE____BW____XQ____BJ____BG","NBH____C____N____S","N____C____N____S____H____J____Q____J","VH______________E____BW____Q____J____G","NH____C____M____A____G____M____A____N","N"] });
  SONGS.push({ id:'nodkrai', nome:'NodKrai', nivel:'Difícil', unit:105, tab:["H---------W---------W--------------Q","W-------E-W-Q----J----G","H---------F---------G----H----Q","H----Q-H-G--H","XH----W----W---------CW--------------Q","VW-------E-W-Q----J----BG--H--G","VH---------F---------BG----F----D----A","XD--F--S","-------------------Q---------W","VE-------R-E-W----Q----BW-------E-W-Q----J","NQ----J----H---------Q----J----BQ----W","VE-------R-E-W----Q----BW---------Q----J","ZE-------------------XQ---------W","VE-------R-E-W----Q----BW-------E-W-Q----J","NQ----J----H---------H----J----BQ----J","VH--------------E----BW----Q----J----G","NH-------------------BH---------NQ","XW--------------X--E-W-Q---------X----J","XH----G----H----X--------------XH","XG---------F----X----D---------XA","BS--------------B----H---------NQ","XW----------------E-W-CQ--------------J","VH----G----H---------X---------H","BG---------F---------ND---------Q","BW-------------------NF---------D","XS","-------------------Q---------W","VE-------R-E-W----Q----BW-------E-W-Q----J","NQ----J----H---------H----J----BQ----J","VH--------------E----BW----Q----J----G","NH"] });
  SONGS.push({ id:'iloveyou', nome:'I Loved You', nivel:'Difícil', unit:105, tab:["NQ----DJ----H----CD----AH----Q","XE----N----R----NW----F","CW----ME----W----MR----SE----J","NW----A----Q----CD----A","NQ----DJ----H----CD----AH----Q","XE----N----W----NR----F","BU----SY----T----XT----MW----R","ZR----B----E----CE----N----M","NQ----DJ----H----CD----AH----Q--W","XE----N----W----MR----SE----D","VQ----A----D----CJ----M----Q","NH----A----D----NH---------G","ZQ--W--BJ--Q--W--E--BR--E--AW----E--R","BT----SR-------H--XT----MR","BT----SR-------H--XT----MR","XQ----NJ-------G--BE----M----W","ZQ----CG----BD--A--BS--A--S--D--F","XG----NT-------R--BW--J--AG--F--D","BW----M--G--H--G--XG----M--G--H--J","ZQ----BY-------T--BE--Q--DJ--Q--W","NE----D--H--W--H--NT----DG--H--E","XT----N-------N--BR----S----G","BT----M-------M--XR----N----G","NH--F--SG--G--H--J--NQ----D----Q","MW--G--SH--J--Q--W--CE----A----H","XR----N----F----BT----S","------------------------G","ZQ----BD-------D--Z----F----BS","ZD"] });
  SONGS.forEach(s=>{
    if(s.tab){ s.steps = parseTab(s.tab); }
    else { s.steps = parseSeq(s.seq).map(c=>({ c:[c], w:0, ms:s.ms })); }
  });
  const stepMs = (s,p) => p.ms || p.w*s.unit;

  // Config: errar não soa (não atrapalha a melodia). Ligada por padrão.
  const KEY_MUDO = 'dw_lira_mudo_erro';
  let mudoErro = true;
  try{ mudoErro = localStorage.getItem(KEY_MUDO) !== '0'; }catch(_){}

  // Modos: 'maestro' (guiado, espera você) e 'frenesi' (notas caem do céu no tempo certo)
  const KEY_MODO = 'dw_lira_modo';
  let modo = 'maestro';
  try{ modo = localStorage.getItem(KEY_MODO)==='frenesi' ? 'frenesi' : 'maestro'; }catch(_){}
  const FZ_PERF = 0.09, FZ_BOM = 0.2, FZ_LEAD = 2.2;

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
#liraScr .lr-modes{display:flex;gap:8px;flex-wrap:wrap}
#liraScr .lr-modes .lr-chip{font-family:var(--font-pixel,monospace);font-size:9px;letter-spacing:1px;padding:9px 14px}
#liraScr .lr-fall{position:absolute;inset:0;width:100%;height:100%;display:none;z-index:4;touch-action:none}
#liraScr .lr-fall.on{display:block}
#liraScr .lr-grid.fzhide{visibility:hidden}
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
        <div class="lr-modes">
          <button class="lr-chip" data-a="modo-maestro" id="lrMM">🎼 MODO MAESTRO</button>
          <button class="lr-chip" data-a="modo-frenesi" id="lrMF">🌠 FRENESI ESTELAR</button>
          <span id="lrOpts" style="display:none;gap:8px;margin-left:auto;flex-wrap:wrap">
            <button class="lr-chip" data-a="nt-todas" id="lrNT">🎹 TODAS AS NOTAS (21)</button>
            <button class="lr-chip" data-a="nt-facil" id="lrNF">🟢 FÁCIL (4 BOTÕES)</button>
          </span>
        </div>
        <div class="lr-songs" id="lrSongs"></div>
        <div class="lr-queue" id="lrQueue"></div>
        <div class="lr-prog"><i id="lrProg"></i></div>
        <div class="lr-hint" id="lrHint"></div>
      </div>
      <div class="lr-stage"><div class="lr-grid" id="lrGrid">${grid}</div><canvas class="lr-fall" id="lrFall"></canvas></div>
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
      else if(a==='again'){ escolher(song); if(modo==='frenesi' && song) frenesiIniciar(); }
      else if(a==='modo-maestro') trocarModo('maestro');
      else if(a==='modo-frenesi') trocarModo('frenesi');
      else if(a==='nt-todas') trocarFacil(false);
      else if(a==='nt-facil') trocarFacil(true);
      else if(a==='fstart') frenesiIniciar();
      else if(a==='fstop'){ frenesiParar(); atualizar(); }
      else if(a==='next'){ const i = SONGS.indexOf(song); escolher(SONGS[(i+1)%SONGS.length]); }
    });
    renderSongs(); rotuloMudo(); rotuloModo();
    window.addEventListener('resize',()=>{ if(fv) fzGeom(); });
    root.querySelector('#lrFall').addEventListener('pointerdown',e=>{
      if(!fv || !openFlag) return; e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect(), x = e.clientX-r.left, g = fv.g; let best = -1, bd = 1e9;
      g.x.forEach((lx,i)=>{ const d = Math.abs(lx-x); if(d<bd){ bd = d; best = i; } });
      if(best>=0 && bd <= g.w*0.9) tocar(best);
    });
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
      SONGS.map(s=>`<button class="lr-chip ${song===s?'sel':''}" data-song="${s.id}">${s.nome} <small>${s.nivel} · ${stars(best[s.id+(modo==='frenesi'?'_f':'')]||0)}</small></button>`).join('');
    el.querySelectorAll('[data-song]').forEach(b=>b.addEventListener('click',()=>escolher(SONGS.find(s=>s.id===b.dataset.song))));
  }

  function pararDemo(){ demoTimers.forEach(clearTimeout); demoTimers = []; demoOn = false; cells.forEach(c=>c.classList.remove('demo')); }

  function escolher(s){
    pararDemo(); frenesiParar();
    song = s; idx = 0; got = new Set(); errors = 0; streak = 0; bestStreak = 0; done = false;
    root.querySelector('#lrEnd').classList.remove('on');
    renderSongs(); atualizar();
  }

  function atualizar(){
    fzVista(modo==='frenesi' && !!song);
    cells.forEach(c=>{ c.classList.remove('target','next','multi'); const o=c.querySelector('.lr-ord'); o.className='lr-ord'; o.textContent=''; });
    const q = id => root.querySelector(id);
    q('#lrOk').textContent = idx; q('#lrErr').textContent = errors; q('#lrStreak').textContent = streak;
    const hint = q('#lrHint'), prog = q('#lrProg');
    if(!song){
      q('#lrQueue').innerHTML = ''; prog.style.width = '0'; hint.innerHTML = 'Modo livre: toque nas notas (ou use <b>Q W E R T Y U</b> / <b>A S D F G H J</b> / <b>Z X C V B N M</b>) e crie sua música.';
      return;
    }
    if(modo==='frenesi'){
      q('#lrQueue').innerHTML = ''; fzStats();
      hint.innerHTML = fz
        ? 'Toque na nota (ou na tecla) quando a nota <b style="color:#ffd45a">chegar no círculo</b>.'+(facil?' Teclas: <b>D F J K</b>.':'')+' <button class="lr-btn" style="padding:3px 10px;font-size:11px" data-a="fstop">■ Parar</button>'
        : 'As notas caem do céu: toque quando chegarem. Antes de começar dá pra treinar nas notas. <button class="lr-btn pri" style="padding:4px 12px;font-size:11px" data-a="fstart">▶ COMEÇAR</button>';
      prog.style.width = '0';
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

  /* ---------- Modo Frenesi Estelar ---------- */
  // Layout estilo "ritmo da lira": 21 trilhas verticais, círculos de acerto embaixo com a tecla,
  // combo grande no centro-topo, nome/pontos no canto, "Perfect" com estrela. Tudo em canvas (#lrFall).
  // Opção do Frenesi: todas as 21 notas ou 4 botões (fácil). No fácil as notas continuam soando com o tom real.
  const KEY_FACIL = 'dw_lira_facil';
  let facil = false;
  try{ facil = localStorage.getItem(KEY_FACIL)==='1'; }catch(_){}
  const FACIL_KEYS = ['KeyD','KeyF','KeyJ','KeyK'], FACIL_LETRAS = ['D','F','J','K'];
  const COR_FACIL = [['#9ff3ff','#2fc4e0'],['#ffe9a0','#ffc83d'],['#ffb3e6','#ff5fc0'],['#cbb3ff','#8b5cff']];
  const corDe = i => facil ? COR_FACIL[i] : COR_LINHA[Math.floor(i/7)];
  const letraDe = i => facil ? FACIL_LETRAS[i] : ROW_KEYS[Math.floor(i/7)][i%7].replace('Key','');
  // fácil: reparte os tons usados na música em 4 faixas (esquerda = grave, direita = agudo)
  function facilInfo(){
    const pitch = c => (2-Math.floor(c/7))*7 + c%7;
    const usados = [...new Set(song.steps.flatMap(p=>p.c))].sort((a,b)=>pitch(a)-pitch(b));
    const laneOf = {}, rep = [[],[],[],[]];
    usados.forEach((c,k)=>{ const l = Math.min(3,Math.floor(k*4/usados.length)); laneOf[c] = l; rep[l].push(c); });
    return { laneOf, rep: rep.map(a=>a.length ? a[Math.floor(a.length/2)] : 0) };
  }
  function trocarFacil(v){
    if(v===facil) return;
    facil = v; try{ localStorage.setItem(KEY_FACIL, v?'1':'0'); }catch(_){}
    rotuloModo(); escolher(song); if(fv) fzGeom();
  }
  let fz = null;   // partida em andamento (null = treino antes de começar)
  let fv = null;   // vista (loop de desenho + geometria) — vive enquanto o Frenesi está na tela
  const COR_LINHA = [['#ffe9a0','#ffc83d'],['#ffb3e6','#ff5fc0'],['#cbb3ff','#8b5cff']]; // aguda / média / grave

  function trocarModo(m){
    if(m===modo) return;
    modo = m; try{ localStorage.setItem(KEY_MODO, m); }catch(_){}
    rotuloModo(); escolher(song);
  }
  function rotuloModo(){
    root.querySelector('#lrMM').classList.toggle('sel', modo==='maestro');
    root.querySelector('#lrMF').classList.toggle('sel', modo==='frenesi');
    root.querySelector('#lrOpts').style.display = modo==='frenesi' ? 'flex' : 'none';
    root.querySelector('#lrNT').classList.toggle('sel', !facil);
    root.querySelector('#lrNF').classList.toggle('sel', facil);
    renderSongs();
  }
  function fzNow(){ return (performance.now()-fz.t0)/1000; }

  function fzVista(on){
    const cv = root.querySelector('#lrFall'), grid = root.querySelector('#lrGrid');
    cv.classList.toggle('on', on); grid.classList.toggle('fzhide', on);
    if(on && !fv){
      fv = { raf:0, last:performance.now(), fx:[], press:{}, judge:null, g:null, info: facil ? facilInfo() : null };
      fzGeom(); fv.raf = requestAnimationFrame(fzLoop);
    } else if(!on && fv){
      cancelAnimationFrame(fv.raf); fv = null;
      cv.getContext('2d').clearRect(0,0,cv.width,cv.height);
    }
  }
  function fzGeom(){
    const cv = root.querySelector('#lrFall'), st = cv.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio||1;
    cv.width = Math.round(st.width*dpr); cv.height = Math.round(st.height*dpr);
    const W = st.width, H = st.height;
    const n = facil ? 4 : 21;
    const w = facil ? Math.min(110,(W-16)/5) : Math.max(10, Math.min(54, (W-16)/22.2)), gap = facil ? 0 : w*0.55;
    const total = n*w + (facil?0:2*gap), x0 = (W-total)/2;
    const x = []; for(let i=0;i<n;i++) x.push(x0 + i*w + w/2 + (facil?0:Math.floor(i/7)*gap));
    const hitY = H - (Math.min(w,90)*0.44*1.7 + Math.min(22,Math.max(8,w*0.3))*1.5 + 10);
    fv.g = { W, H, w, x, n, hitY, dpr, speed: hitY/1.7 };
  }

  function frenesiIniciar(){
    frenesiParar();
    const notes = []; let t = 0;
    const info = facil ? facilInfo() : null;
    song.steps.forEach(p=>{
      if(info){
        const por = {}; p.c.forEach(c=>{ (por[info.laneOf[c]] = por[info.laneOf[c]] || []).push(c); });
        Object.keys(por).forEach(l=>notes.push({ c:+l, cells:por[l], t, st:'pending' }));
      } else p.c.forEach(c=>notes.push({ c, cells:[c], t, st:'pending' }));
      t += stepMs(song,p)/1000;
    });
    fz = { info, notes, lo:0, last:t, t0:performance.now()+FZ_LEAD*1000, perfect:0, good:0, miss:0, stray:0, score:0, combo:0, max:0, end:0 };
    root.querySelector('#lrEnd').classList.remove('on');
    atualizar();
  }
  function frenesiParar(){
    if(fz) clearTimeout(fz.end);
    fz = null;
  }
  function fzStats(){
    const q = id => root.querySelector(id);
    const f = fz;
    q('#lrOk').textContent = f ? f.perfect+f.good : 0;
    q('#lrErr').textContent = f ? f.miss+f.stray : 0;
    q('#lrStreak').textContent = f ? f.combo : 0;
  }
  function fzJulga(txt, col){ if(fv) fv.judge = { txt, col, age:0 }; }
  function fzBurst(lane, tipo){ if(fv) fv.fx.push({ lane, tipo, age:0 }); }

  function frenesiTocar(cell){
    if(!fv) return;
    if(!fz){ (facil && fv.info ? [fv.info.rep[cell]] : [cell]).forEach(pluck); fzBurst(cell,'press'); return; } // antes de começar: treino livre
    const now = fzNow(); let best = null;
    for(let i=fz.lo;i<fz.notes.length;i++){
      const n = fz.notes[i]; if(n.t-now > FZ_BOM) break;
      if(n.st==='pending' && n.c===cell){ const d = Math.abs(n.t-now); if(d<=FZ_BOM && (!best || d<best.d)) best = { n, d }; }
    }
    if(best){
      const perf = best.d <= FZ_PERF; best.n.st = 'hit';
      if(perf) fz.perfect++; else fz.good++;
      fz.score += Math.round((perf?100:60)*(1+Math.floor(fz.combo/10)*0.1));
      fz.combo++; if(fz.combo>fz.max) fz.max = fz.combo;
      best.n.cells.forEach(pluck); fzBurst(cell, perf?'perfect':'good');
      fzJulga(perf?'Perfect':'Good', perf?'#fff3b0':'#9ff3ff');
    } else {
      fz.stray++; fz.combo = 0;
      if(!mudoErro){ sfxErro(); pluck(facil && fz.info ? fz.info.rep[cell] : cell); }
      fzBurst(cell,'press');
    }
    fv.press[cell] = 0.22;
    fzStats();
  }

  function fzEstrela(ctx,x,y,r1,r2,pts,rot){
    ctx.beginPath();
    for(let k=0;k<pts*2;k++){ const a = rot + k*Math.PI/pts, r = k%2 ? r2 : r1; ctx.lineTo(x+Math.cos(a)*r, y+Math.sin(a)*r); }
    ctx.closePath();
  }
  function rrect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  function fzLoop(ts){
    if(!fv) return;
    const v = fv, g = v.g, dt = Math.min(0.05,(ts-v.last)/1000); v.last = ts;
    const f = fz, N = f ? f.notes : [], now = f ? fzNow() : 0;
    // jogo: notas que passaram da janela = Miss
    if(f){
      for(let i=f.lo;i<N.length && N[i].t+FZ_BOM < now;i++){
        if(N[i].st==='pending'){ N[i].st='miss'; f.miss++; f.combo = 0; fzJulga('Miss','#ff8aa8'); fzBurst(N[i].c,'miss'); fzStats(); }
      }
      while(f.lo<N.length && N[f.lo].st!=='pending') f.lo++;
      root.querySelector('#lrProg').style.width = Math.max(0,Math.min(1,now/f.last))*100+'%';
      fzStats();
      if(f.lo>=N.length && !f.end) f.end = setTimeout(frenesiFim, 700);
    }
    const cv = root.querySelector('#lrFall'), ctx = cv.getContext('2d');
    ctx.setTransform(g.dpr,0,0,g.dpr,0,0); ctx.clearRect(0,0,g.W,g.H);

    // brilho rosado no chão
    const gl0 = ctx.createLinearGradient(0,g.H*0.5,0,g.H); gl0.addColorStop(0,'rgba(255,95,192,0)'); gl0.addColorStop(1,'rgba(255,95,192,0.26)');
    ctx.fillStyle = gl0; ctx.fillRect(0,g.H*0.5,g.W,g.H*0.5);

    // trilhas
    ctx.lineWidth = 1.5;
    for(let i=0;i<g.n;i++){
      const lg = ctx.createLinearGradient(0,0,0,g.hitY); lg.addColorStop(0,'rgba(255,255,255,0)'); lg.addColorStop(0.35,'rgba(255,255,255,0.28)'); lg.addColorStop(1,'rgba(255,255,255,0.5)');
      ctx.strokeStyle = lg; ctx.beginPath(); ctx.moveTo(g.x[i],0); ctx.lineTo(g.x[i],g.hitY); ctx.stroke();
    }
    // linha de acerto
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.x[0],g.hitY); ctx.lineTo(g.x[g.n-1],g.hitY); ctx.stroke();

    // notas que estão chegando (brilho no círculo)
    const alvo = new Set();
    for(let i=f?f.lo:0;i<N.length && N[i].t-now < 0.4;i++) if(N[i].st==='pending') alvo.add(N[i].c);

    // círculos de acerto + teclas
    const rc = Math.min(g.w,90)*0.44;
    for(let i=0;i<g.n;i++){
      const x = g.x[i], cor = corDe(i), pr = v.press[i]||0;
      if(pr>0){ v.press[i] = Math.max(0,pr-dt); }
      if(alvo.has(i)){ ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = 2.5; ctx.shadowColor='#ffd45a'; ctx.shadowBlur=14; ctx.beginPath(); ctx.arc(x,g.hitY,rc*1.7,0,7); ctx.stroke(); ctx.shadowBlur=0; }
      ctx.fillStyle = pr>0 ? '#fff6c8' : '#fff'; ctx.strokeStyle = cor[1]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x,g.hitY,rc*(1+pr*1.2),0,7); ctx.fill(); ctx.stroke();
      // tecla
      const lt = letraDe(i), fs = Math.max(8,Math.min(22,g.w*0.3)), bw = fs*1.5, by = g.hitY+rc*1.7;
      ctx.fillStyle = '#fff'; rrect(ctx,x-bw/2,by,bw,fs*1.5,4); ctx.fill();
      ctx.fillStyle = '#2a2440'; ctx.font = '700 '+fs+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(lt,x,by+fs*0.78);
    }

    // notas caindo
    const ahead = g.hitY/g.speed + 0.05;
    for(let i=f?f.lo:0;i<N.length;i++){
      const n = N[i]; if(n.t-now > ahead) break;
      if(n.st!=='pending') continue;
      const x = g.x[n.c], y = g.hitY-(n.t-now)*g.speed, cor = corDe(n.c);
      const nw = Math.min(g.w*0.9, facil?90:48), nh = nw*0.78;
      ctx.shadowColor = cor[1]; ctx.shadowBlur = 12;
      const ng = ctx.createLinearGradient(0,y-nh/2,0,y+nh/2); ng.addColorStop(0,cor[0]); ng.addColorStop(1,cor[1]);
      ctx.fillStyle = ng; rrect(ctx,x-nw/2,y-nh/2,nw,nh,nw*0.22); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#2a2440'; ctx.font = '700 '+Math.max(8,nw*0.34)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(SOLFEGE[n.cells[0]%7], x, y+1);
    }

    // explosões nos círculos
    for(let i=v.fx.length-1;i>=0;i--){
      const e = v.fx[i]; e.age += dt; const dur = e.tipo==='press'?0.25:0.5;
      if(e.age>dur){ v.fx.splice(i,1); continue; }
      const p = e.age/dur, x = g.x[e.lane], y = g.hitY, R = g.w*(e.tipo==='press'?0.9:2.1)*(0.4+p*0.8);
      ctx.globalAlpha = 1-p;
      if(e.tipo==='miss'){ ctx.strokeStyle='#ff8aa8'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,R*0.6,0,7); ctx.stroke(); }
      else {
        const gr = ctx.createRadialGradient(x,y,0,x,y,R); gr.addColorStop(0,'rgba(255,240,150,0.95)'); gr.addColorStop(1,'rgba(255,190,60,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x,y,R,0,7); ctx.fill();
        if(e.tipo!=='press'){ ctx.fillStyle = e.tipo==='perfect' ? '#ffd45a' : '#8feaff'; fzEstrela(ctx,x,y,R*0.95,R*0.42,8,p*0.6); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }

    // julgamento (Perfect/Good/Miss) com estrela amarela atrás
    if(v.judge){
      const j = v.judge; j.age += dt;
      if(j.age>0.7) v.judge = null;
      else {
        const p = j.age/0.7, sc = 1+0.35*Math.max(0,1-j.age*7), cx = g.W/2, cy = g.hitY-g.H*0.22;
        ctx.globalAlpha = 1-p*p;
        if(j.txt!=='Miss'){ ctx.fillStyle = j.txt==='Perfect' ? '#ffd02a' : '#6fdcf0'; fzEstrela(ctx,cx,cy,g.H*0.12*sc,g.H*0.03*sc,4,-0.4); ctx.fill(); }
        ctx.fillStyle = j.col; ctx.font = '700 '+Math.round(g.H*0.055*sc)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8; ctx.fillText(j.txt,cx,cy); ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    // HUD: nome + pontos (esq), combo (centro)
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '600 14px sans-serif'; ctx.fillText(song ? song.nome : '', 14, 22);
    ctx.fillStyle = '#ffd45a'; ctx.font = '700 24px sans-serif'; ctx.fillText(String(f ? f.score : 0), 14, 50);
    if(f && f.combo>=2){
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor='rgba(150,120,255,.9)'; ctx.shadowBlur = 12;
      ctx.font = '700 '+Math.round(Math.min(56,g.H*0.11))+'px sans-serif'; ctx.fillText(String(f.combo), g.W/2, Math.min(56,g.H*0.11)+8);
      ctx.shadowBlur = 0; ctx.font = '600 13px sans-serif'; ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillText('Combo', g.W/2, Math.min(56,g.H*0.11)+26);
    }
    // contagem regressiva / aviso antes de começar
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if(f && now<0){ ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font='700 '+Math.round(g.H*0.16)+'px sans-serif'; ctx.fillText(String(Math.ceil(-now)), g.W/2, g.H*0.38); }
    else if(!f){ ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font='600 15px sans-serif'; ctx.fillText('Clique em COMEÇAR — ou treine tocando nas notas', g.W/2, g.H*0.36); }

    v.raf = requestAnimationFrame(fzLoop);
  }

  function frenesiFim(){
    const f = fz; if(!f) return;
    const total = f.notes.length, prec = (f.perfect+f.good*0.6)/total;
    const est = prec>=0.9?3:prec>=0.7?2:1;
    saveBest(song.id+'_f', est); renderSongs(); sfxFim();
    const star = '★'.repeat(est)+`<span class="off">${'★'.repeat(3-est)}</span>`;
    root.querySelector('#lrCard').innerHTML = `
      <h2>FRENESI COMPLETO!</h2><p>${song.nome}</p>
      <div class="lr-stars-row">${star}</div>
      <p>Pontos: <b>${f.score}</b> · Perfeitos: <b>${f.perfect}</b> · Bons: <b>${f.good}</b></p>
      <p>Errou: <b>${f.miss}</b> · Toques fora: <b>${f.stray}</b> · Maior combo: <b>${f.max}</b></p>
      <div class="lr-btns"><button class="lr-btn pri" data-a="again">Jogar de novo</button><button class="lr-btn" data-a="next">Próxima música</button><button class="lr-btn" data-a="free">Modo livre</button></div>`;
    fz = null;
    root.querySelector('#lrEnd').classList.add('on');
  }

  /* ---------- Jogo ---------- */
  function tocar(cell){
    if(!openFlag || demoOn) return;
    if(modo==='frenesi' && song) return frenesiTocar(cell);
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
    if(modo==='frenesi' && song && facil){ // 4 botões: D F J K
      const l = FACIL_KEYS.indexOf(e.code);
      if(l>=0){ e.preventDefault(); tocar(l); }
      return;
    }
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
    pararDemo(); frenesiParar(); fzVista(false); openFlag = false;
    if(root) root.classList.remove('on');
    try{ if(typeof playMenuMusic==='function') playMenuMusic(); }catch(_){}
  }

  window.abrirLira = abrir;
  window.fecharLira = fechar;
})();
