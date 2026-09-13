// ─── TEMA — tokens de design, temas e applyTheme ───────────────────────────
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap');

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
    blobBase:'#E8F3FB', blobVeil:'rgba(235,246,255,0.58)',
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
    blobBase:'#EDE8FB', blobVeil:'rgba(238,232,255,0.58)',
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
    blobBase:'#FBE8F2', blobVeil:'rgba(255,238,248,0.58)',
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
    blobBase:'#E8FBF2', blobVeil:'rgba(232,255,244,0.58)',
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
    blobBase:'#FBF2E8', blobVeil:'rgba(255,247,232,0.58)',
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
    blobBase:'#FBE8E8', blobVeil:'rgba(255,235,235,0.58)',
    b1:'rgba(130,10,20,0.75)',  b2:'rgba(195,30,45,0.65)',
    b3:'rgba(255,70,80,0.50)',  b4:'rgba(170,18,30,0.60)',
    b5:'rgba(255,130,140,0.46)',b6:'rgba(90,5,12,0.50)',
    b7:'rgba(215,50,65,0.44)',
    sb1:'rgba(175,20,32,0.38)',sb2:'rgba(225,45,58,0.28)',sb3:'rgba(255,140,150,0.20)',
    lb:'rgba(192,32,48,0.28)', lb2:'rgba(192,32,48,0.12)',
    sidebarBg:'rgba(255,245,245,0.97)', topbarBg:'rgba(255,245,245,0.94)',
    text:'#2E0B0B', textS:'#683030', textT:'#A87878', textD:'#D4BABA',
  },
  /* Lilás (set/2026) — foco na cor #9BA0FA. No claro ela aparece na bolinha,
     nas linhas e nos brilhos (goldV/goldLine/dot); texto e botões usam um tom
     mais fechado da mesma família (#5B60D0), porque #9BA0FA sobre fundo claro
     não tem contraste pra leitura. No escuro (Lilás Lunar) ela é o destaque. */
  lilac: {
    name:'Lilás Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#9BA0FA', dark:false,
    page:'#F3F3FE', gold:'#5B60D0', goldL:'#7C81EE', goldV:'#9BA0FA',
    goldGl:'rgba(91,96,208,0.09)', goldLine:'#8A8EF5',
    blue:'#5B60D0', blueL:'#7C81EE', blueGl:'rgba(91,96,208,0.08)',
    blobBase:'#EDEEFD', blobVeil:'rgba(240,240,255,0.58)',
    b1:'rgba(35,38,120,0.78)',  b2:'rgba(80,86,200,0.66)',
    b3:'rgba(155,160,250,0.55)',b4:'rgba(95,100,215,0.60)',
    b5:'rgba(190,194,255,0.48)',b6:'rgba(25,26,90,0.50)',
    b7:'rgba(125,130,235,0.44)',
    sb1:'rgba(90,96,210,0.38)',sb2:'rgba(130,136,240,0.30)',sb3:'rgba(190,194,255,0.22)',
    lb:'rgba(155,160,250,0.32)', lb2:'rgba(155,160,250,0.14)',
    sidebarBg:'rgba(246,246,255,0.97)', topbarBg:'rgba(246,246,255,0.94)',
    text:'#141638', textS:'#40446E', textT:'#8286AC', textD:'#BFC1DA',
  },
  /* Sakura (set/2026) — foco na cor #F4C8E2, rosa de flor de cerejeira. É clara
     demais pra texto ou botão sobre fundo claro, então no Sakura Estelar ela
     pinta o fundo, as manchas, as linhas e a bolinha do tema, e o texto/botões
     usam um rosa-cereja fechado da mesma família (#B8527F). No escuro (Sakura
     Espiritual) ela é o destaque das linhas e brilhos, sobre um ameixa bem escuro. */
  sakura: {
    name:'Sakura Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#F4C8E2', dark:false,
    page:'#FDF5FA', gold:'#B8527F', goldL:'#D77BA6', goldV:'#F4C8E2',
    goldGl:'rgba(184,82,127,0.09)', goldLine:'#E7A3C6',
    blue:'#B8527F', blueL:'#D77BA6', blueGl:'rgba(184,82,127,0.08)',
    blobBase:'#FCEFF6', blobVeil:'rgba(255,243,250,0.58)',
    b1:'rgba(150,60,105,0.62)', b2:'rgba(220,130,175,0.58)',
    b3:'rgba(244,200,226,0.70)',b4:'rgba(200,100,150,0.52)',
    b5:'rgba(250,220,238,0.62)',b6:'rgba(120,45,85,0.42)',
    b7:'rgba(235,165,205,0.50)',
    sb1:'rgba(215,123,166,0.36)',sb2:'rgba(244,200,226,0.45)',sb3:'rgba(250,225,240,0.35)',
    lb:'rgba(231,163,198,0.38)', lb2:'rgba(244,200,226,0.22)',
    sidebarBg:'rgba(255,247,252,0.97)', topbarBg:'rgba(255,247,252,0.94)',
    text:'#35142A', textS:'#6E4460', textT:'#A7859A', textD:'#D8C3CF',
  },
  /* Neutros (set/2026) — Preto e Cinza. Sem matiz: o destaque é o próprio
     preto/cinza e as manchas do fundo são tons de grafite. Nos escuros, a cor de
     botão/avatar (gold) é um cinza médio — branco puro ali deixaria o texto
     branco dos botões invisível; o prata claro fica nas linhas e brilhos. */
  /* Bege (set/2026) — foco na cor #E6D5BE, areia. Clara demais pra texto ou
     botão: no Bege Estelar ela pinta fundo, manchas, linhas e bolinha, e o
     texto/botões usam um caramelo fechado da mesma família (#8A6740). No
     escuro (Bege Nebula) ela fica nas linhas e brilhos sobre um café escuro, e
     botão/avatar usam #A8845A pra o texto branco continuar legível. */
  beige: {
    name:'Bege Estelar', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#E6D5BE', dark:false,
    page:'#FAF6F0', gold:'#8A6740', goldL:'#B08D63', goldV:'#E6D5BE',
    goldGl:'rgba(138,103,64,0.09)', goldLine:'#CDB692',
    blue:'#8A6740', blueL:'#B08D63', blueGl:'rgba(138,103,64,0.08)',
    blobBase:'#F5EEE3', blobVeil:'rgba(250,246,240,0.58)',
    b1:'rgba(110,80,45,0.55)',  b2:'rgba(176,141,99,0.52)',
    b3:'rgba(230,213,190,0.72)',b4:'rgba(150,115,75,0.48)',
    b5:'rgba(240,228,210,0.62)',b6:'rgba(80,58,32,0.40)',
    b7:'rgba(205,182,146,0.52)',
    sb1:'rgba(176,141,99,0.34)',sb2:'rgba(230,213,190,0.50)',sb3:'rgba(242,232,218,0.40)',
    lb:'rgba(205,182,146,0.36)', lb2:'rgba(230,213,190,0.22)',
    sidebarBg:'rgba(252,249,244,0.97)', topbarBg:'rgba(252,249,244,0.94)',
    text:'#2A1E12', textS:'#5E4A34', textT:'#A08B72', textD:'#D6C8B6',
  },
  black: {
    name:'Preto Vulcânico', surfaceSub:'rgba(0,0,0,0.03)', itemHover:'rgba(0,0,0,0.05)', dot:'#1C1C1E', dark:false,
    page:'#F4F4F6', gold:'#1C1C1E', goldL:'#3A3A3C', goldV:'#8E8E93',
    goldGl:'rgba(28,28,30,0.08)', goldLine:'#48484A',
    blue:'#1C1C1E', blueL:'#3A3A3C', blueGl:'rgba(28,28,30,0.07)',
    blobBase:'#EDEDF0', blobVeil:'rgba(244,244,246,0.60)',
    b1:'rgba(10,10,12,0.62)',  b2:'rgba(58,58,62,0.52)',
    b3:'rgba(120,120,128,0.42)',b4:'rgba(30,30,34,0.48)',
    b5:'rgba(170,170,178,0.40)',b6:'rgba(5,5,6,0.42)',
    b7:'rgba(90,90,96,0.38)',
    sb1:'rgba(28,28,30,0.26)',sb2:'rgba(72,72,74,0.20)',sb3:'rgba(142,142,147,0.18)',
    lb:'rgba(28,28,30,0.22)', lb2:'rgba(28,28,30,0.10)',
    sidebarBg:'rgba(248,248,250,0.97)', topbarBg:'rgba(248,248,250,0.94)',
    text:'#111113', textS:'#3C3C43', textT:'#86868C', textD:'#C3C3C8',
  },
  gray: {
    name:'Cinza Vulcânico', surfaceSub:'rgba(0,0,0,0.025)', itemHover:'rgba(0,0,0,0.04)', dot:'#7C818D', dark:false,
    page:'#F2F3F5', gold:'#565B66', goldL:'#7C818D', goldV:'#B8BCC6',
    goldGl:'rgba(86,91,102,0.09)', goldLine:'#8A8F9A',
    blue:'#565B66', blueL:'#7C818D', blueGl:'rgba(86,91,102,0.08)',
    blobBase:'#EBECEF', blobVeil:'rgba(242,243,245,0.58)',
    b1:'rgba(40,44,52,0.58)',  b2:'rgba(90,96,108,0.52)',
    b3:'rgba(150,156,168,0.46)',b4:'rgba(70,75,86,0.50)',
    b5:'rgba(190,195,205,0.44)',b6:'rgba(28,30,36,0.42)',
    b7:'rgba(120,126,138,0.40)',
    sb1:'rgba(86,91,102,0.30)',sb2:'rgba(124,129,141,0.24)',sb3:'rgba(184,188,198,0.22)',
    lb:'rgba(86,91,102,0.26)', lb2:'rgba(86,91,102,0.12)',
    sidebarBg:'rgba(246,247,249,0.97)', topbarBg:'rgba(246,247,249,0.94)',
    text:'#1A1D23', textS:'#474C57', textT:'#8C919B', textD:'#C6C9D0',
  },
  /* ─────────── MODO ESCURO — NEBULA ─────────── */
  blueDark: {
    name:'Azul Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#4A9FE8', dark:true,
    page:'#08101E', surface:'#111B2E', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#4A9FE8', goldL:'#6BB8FF', goldV:'#90D0FF',
    goldGl:'rgba(74,159,232,0.18)', goldLine:'#4A9FE8',
    blue:'#4A9FE8', blueL:'#6BB8FF', blueGl:'rgba(74,159,232,0.15)',
    blobBase:'#060D18', blobVeil:'rgba(6,12,24,0.50)',
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
    blobBase:'#080412', blobVeil:'rgba(8,4,18,0.50)',
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
    blobBase:'#100408', blobVeil:'rgba(16,4,8,0.50)',
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
    blobBase:'#030E08', blobVeil:'rgba(3,12,8,0.50)',
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
    blobBase:'#100404', blobVeil:'rgba(16,4,4,0.50)',
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
    blobBase:'#100804', blobVeil:'rgba(16,8,4,0.50)',
    b1:'rgba(100,48,8,0.90)', b2:'rgba(180,88,16,0.85)',
    b3:'rgba(255,158,0,0.65)', b4:'rgba(200,98,8,0.82)',
    b5:'rgba(255,200,72,0.50)',b6:'rgba(80,35,4,0.90)',
    b7:'rgba(220,128,28,0.65)',
    sb1:'rgba(175,85,14,0.60)',sb2:'rgba(225,128,26,0.50)',sb3:'rgba(255,198,78,0.35)',
    lb:'rgba(232,136,32,0.42)', lb2:'rgba(232,136,32,0.18)',
    sidebarBg:'rgba(20,10,4,0.98)', topbarBg:'rgba(20,10,4,0.95)',
    text:'#FFF0D8', textS:'#C09060', textT:'#806040', textD:'#503020',
  },
  sakuraDark: {
    name:'Sakura Espiritual', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#F4C8E2', dark:true,
    page:'#150A12', surface:'#24121E', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    // gold (botões, avatar, texto de destaque sobre cor) é um tom mais fundo:
    // texto branco sobre #F4C8E2 tem contraste 1,5 e sumia. #F4C8E2 fica nas
    // linhas, aura dos cards, bolinha, brilhos e manchas.
    gold:'#D77BA6', goldL:'#F4C8E2', goldV:'#FDEEF6',
    goldGl:'rgba(244,200,226,0.18)', goldLine:'#F4C8E2',
    blue:'#D77BA6', blueL:'#F4C8E2', blueGl:'rgba(244,200,226,0.14)',
    blobBase:'#0E060C', blobVeil:'rgba(14,6,12,0.50)',
    b1:'rgba(120,40,85,0.88)', b2:'rgba(185,85,135,0.78)',
    b3:'rgba(244,200,226,0.52)',b4:'rgba(150,60,110,0.80)',
    b5:'rgba(250,220,238,0.40)',b6:'rgba(70,20,50,0.90)',
    b7:'rgba(215,123,166,0.60)',
    sb1:'rgba(185,85,135,0.55)',sb2:'rgba(231,163,198,0.42)',sb3:'rgba(244,200,226,0.30)',
    lb:'rgba(244,200,226,0.40)', lb2:'rgba(244,200,226,0.18)',
    sidebarBg:'rgba(20,10,17,0.98)', topbarBg:'rgba(20,10,17,0.95)',
    text:'#FCEAF4', textS:'#D2A3BF', textT:'#94708A', textD:'#5A3B50',
  },
  beigeDark: {
    name:'Bege Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#E6D5BE', dark:true,
    page:'#13100C', surface:'#211B14', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#A8845A', goldL:'#E6D5BE', goldV:'#F4EBDD',
    goldGl:'rgba(230,213,190,0.16)', goldLine:'#E6D5BE',
    blue:'#A8845A', blueL:'#E6D5BE', blueGl:'rgba(230,213,190,0.13)',
    blobBase:'#0D0A07', blobVeil:'rgba(13,10,7,0.50)',
    b1:'rgba(90,64,36,0.90)', b2:'rgba(140,105,66,0.78)',
    b3:'rgba(230,213,190,0.42)',b4:'rgba(110,82,50,0.82)',
    b5:'rgba(240,228,210,0.32)',b6:'rgba(50,36,20,0.90)',
    b7:'rgba(176,141,99,0.58)',
    sb1:'rgba(140,105,66,0.55)',sb2:'rgba(205,182,146,0.42)',sb3:'rgba(230,213,190,0.28)',
    lb:'rgba(230,213,190,0.38)', lb2:'rgba(230,213,190,0.16)',
    sidebarBg:'rgba(18,14,10,0.98)', topbarBg:'rgba(18,14,10,0.95)',
    text:'#F6EFE5', textS:'#C9B597', textT:'#8C7A63', textD:'#4E4234',
  },
  blackDark: {
    name:'Preto Cósmico', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#C7C7CE', dark:true,
    page:'#050506', surface:'#111113', border:'rgba(255,255,255,0.09)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#8E8E96', goldL:'#C7C7CE', goldV:'#EDEDF2',
    goldGl:'rgba(199,199,206,0.14)', goldLine:'#C7C7CE',
    blue:'#8E8E96', blueL:'#C7C7CE', blueGl:'rgba(199,199,206,0.12)',
    blobBase:'#030303', blobVeil:'rgba(3,3,4,0.52)',
    b1:'rgba(40,40,46,0.90)', b2:'rgba(70,70,78,0.78)',
    b3:'rgba(130,130,140,0.46)',b4:'rgba(55,55,62,0.82)',
    b5:'rgba(180,180,190,0.30)',b6:'rgba(18,18,22,0.92)',
    b7:'rgba(100,100,110,0.55)',
    sb1:'rgba(90,90,98,0.50)',sb2:'rgba(140,140,150,0.36)',sb3:'rgba(199,199,206,0.24)',
    lb:'rgba(199,199,206,0.34)', lb2:'rgba(199,199,206,0.14)',
    sidebarBg:'rgba(8,8,10,0.98)', topbarBg:'rgba(8,8,10,0.95)',
    text:'#F2F2F5', textS:'#A9A9B2', textT:'#6E6E78', textD:'#3E3E46',
  },
  grayDark: {
    name:'Cinza Nebula', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#B4B9C4', dark:true,
    page:'#121418', surface:'#1D2026', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#8A909C', goldL:'#B4B9C4', goldV:'#D8DCE3',
    goldGl:'rgba(180,185,196,0.16)', goldLine:'#B4B9C4',
    blue:'#8A909C', blueL:'#B4B9C4', blueGl:'rgba(180,185,196,0.13)',
    blobBase:'#0C0E11', blobVeil:'rgba(12,14,17,0.50)',
    b1:'rgba(50,56,68,0.90)', b2:'rgba(85,92,106,0.80)',
    b3:'rgba(140,148,162,0.52)',b4:'rgba(68,74,88,0.82)',
    b5:'rgba(184,190,202,0.36)',b6:'rgba(26,30,38,0.90)',
    b7:'rgba(110,118,132,0.58)',
    sb1:'rgba(90,96,110,0.55)',sb2:'rgba(138,144,156,0.42)',sb3:'rgba(180,185,196,0.28)',
    lb:'rgba(180,185,196,0.38)', lb2:'rgba(180,185,196,0.16)',
    sidebarBg:'rgba(16,18,22,0.98)', topbarBg:'rgba(16,18,22,0.95)',
    text:'#EEF0F4', textS:'#AEB3BD', textT:'#737985', textD:'#434854',
  },
  lilacDark: {
    name:'Lilás Lunar', surfaceSub:'rgba(255,255,255,0.05)', itemHover:'rgba(255,255,255,0.08)', dot:'#9BA0FA', dark:true,
    page:'#0A0A1C', surface:'#14152E', border:'rgba(255,255,255,0.08)', divider:'rgba(255,255,255,0.05)',
    surfaceInput:'rgba(255,255,255,0.06)', inputFocus:'rgba(255,255,255,0.10)',
    gold:'#9BA0FA', goldL:'#B6BAFF', goldV:'#D4D6FF',
    goldGl:'rgba(155,160,250,0.20)', goldLine:'#9BA0FA',
    blue:'#9BA0FA', blueL:'#B6BAFF', blueGl:'rgba(155,160,250,0.16)',
    blobBase:'#070714', blobVeil:'rgba(7,7,20,0.50)',
    b1:'rgba(40,44,140,0.90)', b2:'rgba(80,86,200,0.85)',
    b3:'rgba(155,160,250,0.62)',b4:'rgba(60,64,170,0.82)',
    b5:'rgba(190,194,255,0.48)',b6:'rgba(20,22,80,0.90)',
    b7:'rgba(120,126,230,0.62)',
    sb1:'rgba(80,86,200,0.60)',sb2:'rgba(130,136,240,0.50)',sb3:'rgba(190,194,255,0.35)',
    lb:'rgba(155,160,250,0.45)', lb2:'rgba(155,160,250,0.20)',
    sidebarBg:'rgba(12,12,30,0.98)', topbarBg:'rgba(12,12,30,0.95)',
    text:'#E6E7FF', textS:'#A2A6D8', textT:'#6A6E9C', textD:'#3A3C66',
  },
};

/* Uniko ÚNICO — sem variação por tema (sempre o UNIKO_NEW) */
const UNIKO_NEW = '/UNIKO_NEW.png';

/* T é mutável — inicializado com o tema salvo no localStorage */
const _initThemeKey = (typeof localStorage !== 'undefined' && localStorage.getItem('ch_theme')) || 'blue';
const _initTheme    = THEMES[_initThemeKey] || THEMES.blue;

if(typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--scroll-color', _initTheme.goldLine + '55');
}

let T = {
  surface:'#FFFFFF', surfaceW:'rgba(255,255,255,0.97)',
  border:'rgba(0,0,0,0.07)', divider:'rgba(0,0,0,0.05)',
  surfaceInput:'rgba(0,0,0,0.025)', inputFocus:'#FFFFFF',
  goldPale:'#D6EAFA', cream:'#EDF4FB', ivory:'#F5FAFF',
  green:'#1A9C70',  greenGl:'rgba(26,156,112,0.08)',
  danger:'#C04050', dangerGl:'rgba(192,64,80,0.07)',
  purple:'#5560C8', purpleGl:'rgba(85,96,200,0.07)',
  teal:'#0A9BB5',   tealGl:'rgba(10,155,181,0.07)',
  pink:'#C06090',   pinkGl:'rgba(192,96,144,0.07)',
  sh:'0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)',
  shM:'0 2px 8px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.08)',
  shL:'0 4px 16px rgba(0,0,0,0.07), 0 16px 44px rgba(0,0,0,0.10)',
  unikoSrc: UNIKO_NEW,
  key: _initThemeKey,
  ..._initTheme,
};

const applyTheme = (key) => {
  const base = {
    border:'rgba(0,0,0,0.07)', divider:'rgba(0,0,0,0.05)',
    surface:'#FFFFFF', surfaceW:'rgba(255,255,255,0.97)',
  };
  Object.assign(T, base, THEMES[key], { unikoSrc: UNIKO_NEW, key });
  document.documentElement.style.setProperty(
    '--scroll-color', THEMES[key].goldLine + '55'
  );
  /* T é um objeto mutável: quem já renderizou não fica sabendo que as cores
     mudaram. A maioria das telas resolve isso re-renderizando junto (o tema é
     trocado de dentro delas), mas quem vive FORA da tela ativa — o lava lamp
     do fundo, montado lá no App — não re-renderiza e ficava com as cores do
     tema anterior. Daí este aviso: quem depende de T e não está na árvore de
     quem trocou o tema escuta THEME_EVENT e se redesenha. */
  try { window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: key })); } catch { /* SSR/teste */ }
};

const THEME_EVENT = 'uniko-tema:mudou';

/* Re-renderiza o componente sempre que o tema mudar, de qualquer lugar do app. */
const onThemeChange = (cb) => {
  const h = (e) => cb(e.detail);
  window.addEventListener(THEME_EVENT, h);
  return () => window.removeEventListener(THEME_EVENT, h);
};

export { FONTS, THEMES, T, applyTheme, THEME_EVENT, onThemeChange };
