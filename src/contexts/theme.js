// ─── TEMA — tokens de design, temas e applyTheme ───────────────────────────
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
               "Helvetica Neue", Arial, sans-serif;
  --font-brand: 'Inter', -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
                "Helvetica Neue", Arial, sans-serif;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--scroll-color, rgba(42,130,210,0.3)); border-radius: 99px; }

/* Lava lamp blobs */
@keyframes blob1 {
  0%,100% { transform: translate(0px, 0px) scale(1); }
  20%     { transform: translate(90px, -70px) scale(1.12); }
  45%     { transform: translate(-50px, 90px) scale(0.92); }
  70%     { transform: translate(70px, 50px) scale(1.06); }
}
@keyframes blob2 {
  0%,100% { transform: translate(0px, 0px) scale(1); }
  25%     { transform: translate(-80px, 60px) scale(1.1); }
  55%     { transform: translate(60px, -80px) scale(0.9); }
  80%     { transform: translate(-30px, -40px) scale(1.08); }
}
@keyframes blob3 {
  0%,100% { transform: translate(0px, 0px) scale(1); }
  33%     { transform: translate(60px, 80px) scale(1.08); }
  66%     { transform: translate(-70px, -50px) scale(0.94); }
}
@keyframes blob4 {
  0%,100% { transform: translate(0px, 0px) scale(1); }
  40%     { transform: translate(-90px, -60px) scale(1.15); }
  75%     { transform: translate(80px, 70px) scale(0.88); }
}
@keyframes blob5 {
  0%,100% { transform: translate(0px, 0px) scale(1); }
  30%     { transform: translate(100px, 40px) scale(0.95); }
  60%     { transform: translate(-60px, -80px) scale(1.1); }
}
@keyframes lyricsBlob1 {
  0%   { transform: translate(0px, 0px) scale(1); }
  33%  { transform: translate(60px, 80px) scale(1.25); }
  66%  { transform: translate(-40px, 50px) scale(0.85); }
  100% { transform: translate(20px, -60px) scale(1.1); }
}
@keyframes lyricsBlob2 {
  0%   { transform: translate(0px, 0px) scale(1); }
  25%  { transform: translate(-70px, -50px) scale(1.3); }
  60%  { transform: translate(50px, 60px) scale(0.8); }
  100% { transform: translate(-30px, 30px) scale(1.15); }
}
@keyframes lyricsBlob3 {
  0%   { transform: translate(0px, 0px) scale(1); }
  40%  { transform: translate(80px, -60px) scale(1.2); }
  75%  { transform: translate(-60px, 40px) scale(0.9); }
  100% { transform: translate(30px, -20px) scale(1.05); }
}

@keyframes fsu  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
@keyframes fi   { from { opacity:0; } to { opacity:1; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes dokoSleep {
  0%   { box-shadow: 0 0 0 3px rgba(120,100,220,0.35), 0 0 0 6px rgba(120,100,220,0.12); }
  50%  { box-shadow: 0 0 0 10px rgba(120,100,220,0.45), 0 0 0 20px rgba(120,100,220,0.15), 0 0 30px 4px rgba(100,80,220,0.25); }
  100% { box-shadow: 0 0 0 3px rgba(120,100,220,0.35), 0 0 0 6px rgba(120,100,220,0.12); }
}
@keyframes dokoTalk {
  0%   { box-shadow: 0 0 0 4px var(--doko-color,#2E8DD4), 0 0 0 8px transparent; }
  40%  { box-shadow: 0 0 0 8px var(--doko-color,#2E8DD4), 0 0 0 18px transparent, 0 0 24px 6px var(--doko-color,#2E8DD4); }
  100% { box-shadow: 0 0 0 4px var(--doko-color,#2E8DD4), 0 0 0 8px transparent; }
}
@keyframes dotBounce {
  0%, 80%, 100% { transform: translateY(0px); opacity: 0.4; }
  40%           { transform: translateY(-6px); opacity: 1; }
}
@keyframes moonFloat {
  0%,100% { transform: translateY(0px) rotate(-5deg); }
  50%     { transform: translateY(-8px) rotate(-5deg); }
}
@keyframes starPulse {
  0%,100% { opacity: 0.5; transform: scale(1); }
  50%     { opacity: 1;   transform: scale(1.3); }
}

.fsu  { animation: fsu .5s cubic-bezier(.16,1,.3,1) both; }
.fsu2 { animation: fsu .5s .10s cubic-bezier(.16,1,.3,1) both; }
.fsu3 { animation: fsu .5s .20s cubic-bezier(.16,1,.3,1) both; }
.fsu4 { animation: fsu .5s .30s cubic-bezier(.16,1,.3,1) both; }
.fi   { animation: fi .3s ease both; }
@keyframes brandBlob1 {
  0%,100% { transform: translate(0px,0px) scale(1); }
  40%     { transform: translate(18px,-12px) scale(1.15); }
  70%     { transform: translate(-10px,14px) scale(0.9); }
}
@keyframes brandBlob2 {
  0%,100% { transform: translate(0px,0px) scale(1); }
  35%     { transform: translate(-14px,10px) scale(1.12); }
  65%     { transform: translate(12px,-16px) scale(0.92); }
}
@keyframes brandBlob3 {
  0%,100% { transform: translate(0px,0px) scale(1); }
  50%     { transform: translate(10px,10px) scale(1.1); }
}
@keyframes wave1 {
  0%,100% { transform: translateY(0px) scaleX(1); }
  30%     { transform: translateY(-55px) scaleX(1.04); }
  65%     { transform: translateY(35px) scaleX(0.97); }
}
@keyframes wave2 {
  0%,100% { transform: translateY(0px) scaleX(1); }
  35%     { transform: translateY(60px) scaleX(0.96); }
  70%     { transform: translateY(-40px) scaleX(1.05); }
}
@keyframes wave3 {
  0%,100% { transform: translateY(0px) scaleX(1); }
  45%     { transform: translateY(-50px) scaleX(1.03); }
  80%     { transform: translateY(40px) scaleX(0.95); }
}
`;

/* ─── DESIGN TOKENS ─── */
/* ── TEMAS ────────────────────────────────────────────────── */
const THEMES = {
  blue: {
    name:'Azul Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#2E8DD4', dark:false,
    surface:'#FFFFFF', border:'rgba(0,0,0,0.07)', divider:'rgba(0,0,0,0.05)',
    surfaceInput:'rgba(0,0,0,0.025)', inputFocus:'#FFFFFF',
    page:'#F0F6FC', gold:'#1A6FB5', goldL:'#2E8DD4', goldV:'#5AAEE8',
    goldGl:'rgba(30,111,181,0.09)', goldLine:'#2A82D2',
    blue:'#1A6FB5', blueL:'#2E8DD4', blueGl:'rgba(30,111,181,0.08)',
    blobBase:'#E8F3FB', blobVeil:'rgba(235,246,255,0.40)',
    b1:'rgba(10,35,90,0.82)',  b2:'rgba(25,80,180,0.70)',
    b3:'rgba(0,160,255,0.55)', b4:'rgba(30,100,220,0.62)',
    b5:'rgba(100,190,255,0.48)',b6:'rgba(5,20,70,0.52)',
    b7:'rgba(0,140,200,0.45)',
    sb1:'rgba(20,80,200,0.42)',sb2:'rgba(40,130,240,0.32)',sb3:'rgba(100,190,255,0.22)',
    lb:'rgba(31,111,169,0.30)', lb2:'rgba(31,111,169,0.14)',
    sidebarBg:'rgba(245,250,255,0.97)', topbarBg:'rgba(245,250,255,0.94)',
    text:'#0D1B2E', textS:'#3A5068', textT:'#7A92A8', textD:'#B0C4D4',
  },
  purple: {
    name:'Roxo Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#8B5FE8',
    page:'#F4F0FC', gold:'#6B3FC8', goldL:'#8B5FE8', goldV:'#C0AAFF',
    goldGl:'rgba(107,63,200,0.09)', goldLine:'#7B52D2',
    blue:'#6B3FC8', blueL:'#8B5FE8', blueGl:'rgba(107,63,200,0.08)',
    blobBase:'#EDE8FB', blobVeil:'rgba(238,232,255,0.42)',
    b1:'rgba(55,15,110,0.78)', b2:'rgba(90,35,190,0.68)',
    b3:'rgba(150,70,255,0.52)',b4:'rgba(75,25,170,0.62)',
    b5:'rgba(180,140,255,0.46)',b6:'rgba(35,8,85,0.52)',
    b7:'rgba(120,55,220,0.44)',
    sb1:'rgba(80,30,180,0.40)',sb2:'rgba(120,60,230,0.30)',sb3:'rgba(180,140,255,0.20)',
    lb:'rgba(100,50,200,0.28)', lb2:'rgba(100,50,200,0.13)',
    sidebarBg:'rgba(248,244,255,0.97)', topbarBg:'rgba(248,244,255,0.94)',
    text:'#1A0B35', textS:'#4A3068', textT:'#8A78A8', textD:'#C4BAD4',
  },
  pink: {
    name:'Rosa Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#E060A0',
    page:'#FCF0F6', gold:'#C0307A', goldL:'#E060A0', goldV:'#FFB0D0',
    goldGl:'rgba(192,48,122,0.09)', goldLine:'#D04A8C',
    blue:'#C0307A', blueL:'#E060A0', blueGl:'rgba(192,48,122,0.08)',
    blobBase:'#FBE8F2', blobVeil:'rgba(255,238,248,0.42)',
    b1:'rgba(130,15,75,0.75)',  b2:'rgba(195,40,115,0.65)',
    b3:'rgba(255,90,170,0.50)', b4:'rgba(170,25,100,0.60)',
    b5:'rgba(255,150,200,0.46)',b6:'rgba(95,8,55,0.50)',
    b7:'rgba(215,75,150,0.44)',
    sb1:'rgba(180,30,100,0.38)',sb2:'rgba(230,60,130,0.28)',sb3:'rgba(255,160,210,0.20)',
    lb:'rgba(192,48,122,0.28)', lb2:'rgba(192,48,122,0.12)',
    sidebarBg:'rgba(255,245,250,0.97)', topbarBg:'rgba(255,245,250,0.94)',
    text:'#2E0B1A', textS:'#683050', textT:'#A87890', textD:'#D4BAC4',
  },
  green: {
    name:'Verde Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#28A870',
    page:'#F0FCF6', gold:'#1A8050', goldL:'#28A870', goldV:'#70D8A8',
    goldGl:'rgba(26,128,80,0.09)', goldLine:'#2A9060',
    blue:'#1A8050', blueL:'#28A870', blueGl:'rgba(26,128,80,0.08)',
    blobBase:'#E8FBF2', blobVeil:'rgba(232,255,244,0.42)',
    b1:'rgba(8,65,38,0.78)',   b2:'rgba(18,115,65,0.68)',
    b3:'rgba(0,195,115,0.52)', b4:'rgba(12,95,58,0.62)',
    b5:'rgba(75,205,145,0.46)',b6:'rgba(4,45,25,0.52)',
    b7:'rgba(38,155,95,0.44)',
    sb1:'rgba(18,110,60,0.38)',sb2:'rgba(30,160,90,0.28)',sb3:'rgba(80,210,150,0.20)',
    lb:'rgba(26,128,80,0.28)', lb2:'rgba(26,128,80,0.12)',
    sidebarBg:'rgba(244,255,249,0.97)', topbarBg:'rgba(244,255,249,0.94)',
    text:'#0B2E1A', textS:'#306845', textT:'#78A890', textD:'#BAD4C4',
  },
  orange: {
    name:'Laranja Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#D89030',
    page:'#FCF6F0', gold:'#B87010', goldL:'#D89030', goldV:'#FFD070',
    goldGl:'rgba(184,112,16,0.09)', goldLine:'#C88020',
    blue:'#B87010', blueL:'#D89030', blueGl:'rgba(184,112,16,0.08)',
    blobBase:'#FBF2E8', blobVeil:'rgba(255,247,232,0.42)',
    b1:'rgba(95,48,8,0.78)',    b2:'rgba(175,88,18,0.68)',
    b3:'rgba(255,155,0,0.52)',  b4:'rgba(195,98,8,0.62)',
    b5:'rgba(255,198,75,0.46)', b6:'rgba(75,33,4,0.52)',
    b7:'rgba(218,128,28,0.44)',
    sb1:'rgba(175,88,16,0.38)',sb2:'rgba(225,130,28,0.28)',sb3:'rgba(255,200,80,0.20)',
    lb:'rgba(184,112,16,0.28)', lb2:'rgba(184,112,16,0.12)',
    sidebarBg:'rgba(255,251,244,0.97)', topbarBg:'rgba(255,251,244,0.94)',
    text:'#2E1A0B', textS:'#684530', textT:'#A88568', textD:'#D4C4B0',
  },
  red: {
    name:'Vermelho Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#E03040', dark:false,
    page:'#FCF0F0', gold:'#C02030', goldL:'#E03040', goldV:'#FF9090',
    goldGl:'rgba(192,32,48,0.09)', goldLine:'#D02838',
    blue:'#C02030', blueL:'#E03040', blueGl:'rgba(192,32,48,0.08)',
    blobBase:'#FBE8E8', blobVeil:'rgba(255,235,235,0.42)',
    b1:'rgba(130,10,20,0.75)',  b2:'rgba(195,30,45,0.65)',
    b3:'rgba(255,70,80,0.50)',  b4:'rgba(170,18,30,0.60)',
    b5:'rgba(255,130,140,0.46)',b6:'rgba(90,5,12,0.50)',
    b7:'rgba(215,50,65,0.44)',
    sb1:'rgba(175,20,32,0.38)',sb2:'rgba(225,45,58,0.28)',sb3:'rgba(255,140,150,0.20)',
    lb:'rgba(192,32,48,0.28)', lb2:'rgba(192,32,48,0.12)',
    sidebarBg:'rgba(255,245,245,0.97)', topbarBg:'rgba(255,245,245,0.94)',
    text:'#2E0B0B', textS:'#683030', textT:'#A87878', textD:'#D4BABA',
  },
  /* ─────────── MODO ESCURO — NEBULA ─────────── */
  blueDark: {
    name:'Azul Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#4A9FE8', dark:true,
    page:'#08101E', surface:'#111B2E', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#4A9FE8', goldL:'#6BB8FF', goldV:'#90D0FF',
    goldGl:'rgba(74,159,232,0.18)', goldLine:'#4A9FE8',
    blue:'#4A9FE8', blueL:'#6BB8FF', blueGl:'rgba(74,159,232,0.15)',
    blobBase:'#060D18', blobVeil:'rgba(6,12,24,0.35)',
    b1:'rgba(20,60,160,0.90)', b2:'rgba(10,40,120,0.85)',
    b3:'rgba(0,100,220,0.70)', b4:'rgba(30,80,200,0.80)',
    b5:'rgba(60,140,255,0.55)',b6:'rgba(5,15,60,0.88)',
    b7:'rgba(0,90,180,0.65)',
    sb1:'rgba(20,80,200,0.60)',sb2:'rgba(40,120,240,0.50)',sb3:'rgba(80,170,255,0.35)',
    lb:'rgba(74,159,232,0.45)', lb2:'rgba(74,159,232,0.20)',
    sidebarBg:'rgba(10,18,36,0.98)', topbarBg:'rgba(10,18,36,0.95)',
    text:'#DDEEFF', textS:'#8AB0D4', textT:'#5A7A9A', textD:'#3A5570',
  },
  purpleDark: {
    name:'Roxo Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#9B6FE8', dark:true,
    page:'#0C0818', surface:'#160C28', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#9B6FE8', goldL:'#B890FF', goldV:'#D4B8FF',
    goldGl:'rgba(155,111,232,0.20)', goldLine:'#9B6FE8',
    blue:'#9B6FE8', blueL:'#B890FF', blueGl:'rgba(155,111,232,0.16)',
    blobBase:'#080412', blobVeil:'rgba(8,4,18,0.35)',
    b1:'rgba(60,15,120,0.92)', b2:'rgba(90,35,190,0.85)',
    b3:'rgba(150,70,255,0.68)',b4:'rgba(75,25,170,0.82)',
    b5:'rgba(180,140,255,0.52)',b6:'rgba(40,8,85,0.90)',
    b7:'rgba(120,55,220,0.65)',
    sb1:'rgba(80,30,180,0.60)',sb2:'rgba(120,60,230,0.50)',sb3:'rgba(170,120,255,0.35)',
    lb:'rgba(155,111,232,0.45)', lb2:'rgba(155,111,232,0.20)',
    sidebarBg:'rgba(14,8,28,0.98)', topbarBg:'rgba(14,8,28,0.95)',
    text:'#EDE0FF', textS:'#A080C8', textT:'#6A5090', textD:'#3A2860',
  },
  pinkDark: {
    name:'Rosa Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#E860A8', dark:true,
    page:'#180810', surface:'#280C1C', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#E860A8', goldL:'#FF88C8', goldV:'#FFB8E0',
    goldGl:'rgba(232,96,168,0.20)', goldLine:'#E860A8',
    blue:'#E860A8', blueL:'#FF88C8', blueGl:'rgba(232,96,168,0.16)',
    blobBase:'#100408', blobVeil:'rgba(16,4,8,0.35)',
    b1:'rgba(140,15,75,0.90)', b2:'rgba(200,35,110,0.85)',
    b3:'rgba(255,80,160,0.65)',b4:'rgba(175,20,95,0.82)',
    b5:'rgba(255,130,190,0.50)',b6:'rgba(100,8,50,0.90)',
    b7:'rgba(220,60,140,0.65)',
    sb1:'rgba(180,25,95,0.60)',sb2:'rgba(230,55,125,0.50)',sb3:'rgba(255,140,195,0.35)',
    lb:'rgba(232,96,168,0.45)', lb2:'rgba(232,96,168,0.20)',
    sidebarBg:'rgba(22,8,16,0.98)', topbarBg:'rgba(22,8,16,0.95)',
    text:'#FFE0F0', textS:'#C87090', textT:'#885060', textD:'#502030',
  },
  greenDark: {
    name:'Verde Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#28C878', dark:true,
    page:'#061410', surface:'#0C2018', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#28C878', goldL:'#50E898', goldV:'#90FFD0',
    goldGl:'rgba(40,200,120,0.18)', goldLine:'#28C878',
    blue:'#28C878', blueL:'#50E898', blueGl:'rgba(40,200,120,0.15)',
    blobBase:'#030E08', blobVeil:'rgba(3,12,8,0.35)',
    b1:'rgba(8,70,40,0.90)', b2:'rgba(15,120,65,0.85)',
    b3:'rgba(0,200,110,0.65)',b4:'rgba(10,100,58,0.82)',
    b5:'rgba(60,210,140,0.52)',b6:'rgba(3,45,22,0.90)',
    b7:'rgba(30,165,90,0.65)',
    sb1:'rgba(15,110,58,0.60)',sb2:'rgba(28,160,88,0.50)',sb3:'rgba(70,220,150,0.35)',
    lb:'rgba(40,200,120,0.42)', lb2:'rgba(40,200,120,0.18)',
    sidebarBg:'rgba(4,16,10,0.98)', topbarBg:'rgba(4,16,10,0.95)',
    text:'#D8FFF0', textS:'#70C0A0', textT:'#408060', textD:'#204838',
  },
  redDark: {
    name:'Vermelho Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#E84050', dark:true,
    page:'#180606', surface:'#280C0E', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#E84050', goldL:'#FF6878', goldV:'#FFB0B8',
    goldGl:'rgba(232,64,80,0.20)', goldLine:'#E84050',
    blue:'#E84050', blueL:'#FF6878', blueGl:'rgba(232,64,80,0.16)',
    blobBase:'#100404', blobVeil:'rgba(16,4,4,0.35)',
    b1:'rgba(140,10,20,0.90)', b2:'rgba(200,25,38,0.85)',
    b3:'rgba(255,65,75,0.65)', b4:'rgba(175,15,25,0.82)',
    b5:'rgba(255,120,130,0.50)',b6:'rgba(100,5,10,0.90)',
    b7:'rgba(220,48,60,0.65)',
    sb1:'rgba(180,18,28,0.60)',sb2:'rgba(230,45,55,0.50)',sb3:'rgba(255,130,140,0.35)',
    lb:'rgba(232,64,80,0.45)', lb2:'rgba(232,64,80,0.20)',
    sidebarBg:'rgba(22,5,8,0.98)', topbarBg:'rgba(22,5,8,0.95)',
    text:'#FFE0E0', textS:'#C87070', textT:'#885050', textD:'#502028',
  },
  orangeDark: {
    name:'Laranja Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#E88820', dark:true,
    page:'#180C04', surface:'#281408', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#E88820', goldL:'#FFA840', goldV:'#FFD070',
    goldGl:'rgba(232,136,32,0.20)', goldLine:'#E88820',
    blue:'#E88820', blueL:'#FFA840', blueGl:'rgba(232,136,32,0.16)',
    blobBase:'#100804', blobVeil:'rgba(16,8,4,0.35)',
    b1:'rgba(100,48,8,0.90)', b2:'rgba(180,88,16,0.85)',
    b3:'rgba(255,158,0,0.65)', b4:'rgba(200,98,8,0.82)',
    b5:'rgba(255,200,72,0.50)',b6:'rgba(80,35,4,0.90)',
    b7:'rgba(220,128,28,0.65)',
    sb1:'rgba(175,85,14,0.60)',sb2:'rgba(225,128,26,0.50)',sb3:'rgba(255,198,78,0.35)',
    lb:'rgba(232,136,32,0.42)', lb2:'rgba(232,136,32,0.18)',
    sidebarBg:'rgba(20,10,4,0.98)', topbarBg:'rgba(20,10,4,0.95)',
    text:'#FFF0D8', textS:'#C09060', textT:'#806040', textD:'#503020',
  },
  /* ─────────── ESPECIAL — VOZ DO BRASIL ─────────── */
  vozBrasil: {
    name:'Voz do Brasil', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#C8A000', dark:false,
    page:'#F6FCF0', gold:'#9A7A00', goldL:'#C8A000', goldV:'#FFE050',
    goldGl:'rgba(154,122,0,0.09)', goldLine:'#B09000',
    blue:'#9A7A00', blueL:'#C8A000', blueGl:'rgba(154,122,0,0.08)',
    blobBase:'#EEF8E6', blobVeil:'rgba(238,248,230,0.42)',
    b1:'rgba(0,60,15,0.80)',   b2:'rgba(0,100,35,0.68)',
    b3:'rgba(255,220,0,0.55)', b4:'rgba(0,40,130,0.58)',
    b5:'rgba(255,245,80,0.48)',b6:'rgba(0,20,80,0.50)',
    b7:'rgba(0,140,50,0.45)',
    sb1:'rgba(150,120,0,0.38)',sb2:'rgba(200,160,0,0.28)',sb3:'rgba(255,225,60,0.20)',
    lb:'rgba(154,122,0,0.28)', lb2:'rgba(154,122,0,0.12)',
    sidebarBg:'rgba(244,252,240,0.97)', topbarBg:'rgba(244,252,240,0.94)',
    text:'#0B1E08', textS:'#2E5020', textT:'#6A8860', textD:'#AABCA0',
  },
  vozBrasilDark: {
    name:'Voz do Brasil Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#D4B000', dark:true,
    page:'#080D04', surface:'#111A08', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#D4B000', goldL:'#FFCC10', goldV:'#FFE860',
    goldGl:'rgba(212,176,0,0.20)', goldLine:'#D4B000',
    blue:'#D4B000', blueL:'#FFCC10', blueGl:'rgba(212,176,0,0.16)',
    blobBase:'#050A02', blobVeil:'rgba(5,10,2,0.35)',
    b1:'rgba(0,50,10,0.92)',   b2:'rgba(0,80,22,0.88)',
    b3:'rgba(215,175,0,0.70)', b4:'rgba(0,15,90,0.88)',
    b5:'rgba(255,228,40,0.55)',b6:'rgba(0,10,55,0.92)',
    b7:'rgba(0,110,35,0.68)',
    sb1:'rgba(160,125,0,0.60)',sb2:'rgba(210,165,0,0.50)',sb3:'rgba(255,225,50,0.35)',
    lb:'rgba(212,176,0,0.42)', lb2:'rgba(212,176,0,0.18)',
    sidebarBg:'rgba(5,9,3,0.98)', topbarBg:'rgba(5,9,3,0.95)',
    text:'#EEFFD8', textS:'#90B870', textT:'#507040', textD:'#284020',
  },
  /* ─────────── ESPECIAL — MÊS DO ORGULHO ─────────── */
  orgulho: {
    name:'Mês do Orgulho', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#C030A0', dark:false,
    page:'#FEFEFE', gold:'#9A1880', goldL:'#C030A0', goldV:'#FF80D0',
    goldGl:'rgba(154,24,128,0.09)', goldLine:'#B020A0',
    blue:'#9A1880', blueL:'#C030A0', blueGl:'rgba(154,24,128,0.08)',
    blobBase:'#FFFFFF', blobVeil:'rgba(255,255,255,0.08)',
    b1:'rgba(255,0,0,0.90)',    b2:'rgba(255,110,0,0.85)',
    b3:'rgba(255,240,0,0.85)',  b4:'rgba(0,230,0,0.85)',
    b5:'rgba(0,40,255,0.85)',   b6:'rgba(110,0,255,0.90)',
    b7:'rgba(255,0,200,0.85)',
    sb1:'rgba(154,24,128,0.38)',sb2:'rgba(192,48,160,0.28)',sb3:'rgba(255,128,208,0.20)',
    lb:'rgba(154,24,128,0.28)', lb2:'rgba(154,24,128,0.12)',
    sidebarBg:'rgba(255,253,255,0.97)', topbarBg:'rgba(255,253,255,0.94)',
    text:'#28082A', textS:'#6A3070', textT:'#A880A8', textD:'#D4C0D4',
  },
  orgulhoDark: {
    name:'Mês do Orgulho Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#D840C0', dark:true,
    page:'#030303', surface:'#0C0810', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#D840C0', goldL:'#FF60E0', goldV:'#FFB0F0',
    goldGl:'rgba(216,64,192,0.20)', goldLine:'#D840C0',
    blue:'#D840C0', blueL:'#FF60E0', blueGl:'rgba(216,64,192,0.16)',
    blobBase:'#000000', blobVeil:'rgba(0,0,0,0.08)',
    b1:'rgba(255,0,0,0.98)',    b2:'rgba(255,120,0,0.95)',
    b3:'rgba(255,255,0,0.92)',  b4:'rgba(0,255,0,0.95)',
    b5:'rgba(0,50,255,0.95)',   b6:'rgba(130,0,255,0.98)',
    b7:'rgba(255,0,220,0.95)',
    sb1:'rgba(180,30,160,0.60)',sb2:'rgba(216,60,192,0.50)',sb3:'rgba(255,120,224,0.35)',
    lb:'rgba(216,64,192,0.42)', lb2:'rgba(216,64,192,0.18)',
    sidebarBg:'rgba(3,2,5,0.98)', topbarBg:'rgba(3,2,5,0.95)',
    text:'#FFE8FF', textS:'#D090D0', textT:'#906090', textD:'#503050',
  },

};

/* Mapeamento tema → imagem do Uniko (arquivos em /public) */
const UNIKO_SRC = {
  blue:        '/Uniko.png',
  blueDark:    '/Uniko.png',
  purple:      '/UnikoRoxo.png',
  purpleDark:  '/UnikoRoxo.png',
  pink:        '/UnikoRosa.png',
  pinkDark:    '/UnikoRosa.png',
  green:       '/UnikoVerde.png',
  greenDark:   '/UnikoVerde.png',
  orange:          '/UnikoLaranja.png',
  orangeDark:      '/UnikoLaranja.png',
  red:             '/UnikoVermelho.png',
  redDark:         '/UnikoVermelho.png',
  vozBrasil:       '/UnikoJunino.png',
  vozBrasilDark:   '/UnikoJunino.png',
  orgulho:         '/UnikoOrgulho.png',
  orgulhoDark:     '/UnikoOrgulho.png',
};

/* T é mutável — inicializado com o tema salvo no localStorage */
const _initThemeKey = (typeof localStorage !== 'undefined' && localStorage.getItem('ch_theme')) || 'vozBrasil';
const _initTheme    = THEMES[_initThemeKey] || THEMES.blue;

if(typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--scroll-color', _initTheme.goldLine + '55');
}

let T = {
  surfaceW:'rgba(255,255,255,0.85)',
  goldPale:'#D6EAFA', cream:'#EDF4FB', ivory:'#F5FAFF',
  green:'#1A9C70',  greenGl:'rgba(26,156,112,0.08)',
  danger:'#C04050', dangerGl:'rgba(192,64,80,0.07)',
  purple:'#5560C8', purpleGl:'rgba(85,96,200,0.07)',
  teal:'#0A9BB5',   tealGl:'rgba(10,155,181,0.07)',
  pink:'#C06090',   pinkGl:'rgba(192,96,144,0.07)',
  sh:'0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)',
  shM:'0 2px 8px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.08)',
  shL:'0 4px 16px rgba(0,0,0,0.07), 0 16px 44px rgba(0,0,0,0.10)',
  unikoSrc: UNIKO_SRC[_initThemeKey] || '/Uniko.png',
  ..._initTheme,
};

const applyTheme = (key) => {
  const base = {
    border:'rgba(0,0,0,0.07)', divider:'rgba(0,0,0,0.05)',
    surface:'#FFFFFF', surfaceW:'rgba(255,255,255,0.85)',
  };
  Object.assign(T, base, THEMES[key], { unikoSrc: UNIKO_SRC[key] || '/Uniko.png' });
  document.documentElement.style.setProperty(
    '--scroll-color', THEMES[key].goldLine + '55'
  );
};

export { FONTS, THEMES, T, applyTheme };
