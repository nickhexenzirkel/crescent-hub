import React, { useState, useEffect } from "react";
import logoNicolas from "./assets/LogoTipoNicolas.png";
import dokoTecnico      from "./assets/DodocoTecnico.jpg";
import dokoCozinheiro   from "./assets/DodocoCozinheiro.jpg";
import dokoMedico       from "./assets/DodocoMedico.jpg";
import dokoAmbiental    from "./assets/DodocoAmbientalista.jpg";
import dokoContador     from "./assets/DodocoContador.jpg";
/* Versões cansadas — aparecem quando fome + energia estão críticas */
import dokoTecnicoCansado     from "./assets/DodocoTecnicoCansado.jpg";
import dokoCozinheiroCansado  from "./assets/DodocoCozinheiroCansado.jpg";
import dokoMedicoCansado      from "./assets/DodocoMedicoCansado.jpg";
import dokoAmbientalCansado   from "./assets/DodocoAmbientalistaCansada.jpg";
import dokoContadorCansado    from "./assets/DodocoContadorCansado.jpg";


/* ─────────────────────────────────────────
   FONTE APPLE — SF Pro / sistema Apple
───────────────────────────────────────── */
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

};

/* T é mutável — atualizado pelo seletor de tema */
/* Set initial CSS var on load */
if(typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--scroll-color', THEMES.blue.goldLine + '55');
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
  ...THEMES.blue,
};

const applyTheme = (key) => {
  const base = {
    border:'rgba(0,0,0,0.07)', divider:'rgba(0,0,0,0.05)',
    surface:'#FFFFFF', surfaceW:'rgba(255,255,255,0.85)',
  };
  Object.assign(T, base, THEMES[key]);
  /* Atualiza scrollbar via CSS variable */
  document.documentElement.style.setProperty(
    '--scroll-color', THEMES[key].goldLine + '55'
  );
};

/* ─── MOCK DATA ─── */
const USER = {
  name:'Ana Ferreira', short:'Ana', role:'Analista de RH', avatar:'AF', color:T.blue,
  cpf:'***.***.888-**', rg:'20080001234', birth:'15/03/1997',
  email:'ana.ferreira@empresa.com', phone:'(85) 99845-2211',
  street:'Rua das Flores, 142', district:'Cajazeiras', cep:'60860-150',
  city:'Fortaleza', state:'CE', category:'CLT', cargo:'Analista Jr.',
  admission:'01/02/2022', dependents:1, horasMes:'160h',
  salary:4800, inss:528, ir:240, vt:220, va:300, hours:45,
  trophies:[{icon:'🏆',label:'Platina',from:'Gerência'},{icon:'🥇',label:'Ouro',from:'Nicolas Andrade'}],
};
/* ── MOCK DATA — novas features ── */
const SALARY_HISTORY = [
  {date:'Jan/22',salary:3500,pct:null,   event:'Admissão'},
  {date:'Jul/22',salary:3800,pct:'+8.5%',event:'Reajuste anual'},
  {date:'Jan/23',salary:4100,pct:'+7.9%',event:'Reajuste anual'},
  {date:'Jul/23',salary:4400,pct:'+7.3%',event:'Promoção — Analista Jr.'},
  {date:'Jan/24',salary:4600,pct:'+4.5%',event:'Reajuste coletivo'},
  {date:'Jan/25',salary:4800,pct:'+4.3%',event:'Reajuste coletivo'},
];

const COMUNICADOS_DATA = [
  {id:1,title:'Atualização da Política de Home Office',cat:'Política',date:'20/05/2025',
   read:false,urgent:true,
   body:'A partir de julho/2025, colaboradores do administrativo podem solicitar até 2 dias de home office por semana mediante aprovação do gestor imediato. Acesse o formulário de solicitação pelo RH.'},
  {id:2,title:'Calendário de Férias Coletivas 2025',cat:'RH',date:'15/05/2025',
   read:false,urgent:false,
   body:'As férias coletivas de fim de ano ocorrerão entre 22/12/2025 e 02/01/2026. Todos os colaboradores devem garantir que suas demandas estejam alinhadas com seus gestores até 30/11.'},
  {id:3,title:'Novo benefício: Gympass',cat:'Benefícios',date:'10/05/2025',
   read:true,urgent:false,
   body:'A empresa firmou parceria com o Gympass. A partir de junho, todos os colaboradores CLT têm acesso ao plano Basic sem custo. Faça o cadastro com seu e-mail corporativo.'},
  {id:4,title:'Treinamento Obrigatório — LGPD',cat:'Compliance',date:'05/05/2025',
   read:true,urgent:false,
   body:'Todos os colaboradores devem concluir o treinamento de LGPD até 31/05/2025. Acesse a plataforma de treinamentos com seu login corporativo. Duração estimada: 40 minutos.'},
];

const NOTIFS_DATA = [
  {id:1,type:'financeiro',icon:'R$', msg:'Holerite de Maio/2025 disponível',     time:'há 2h',    read:false},
  {id:2,type:'conquista', icon:'★', msg:'Você recebeu o troféu 🥇 Ouro de Nicolas Andrade', time:'há 1 dia',  read:false},
  {id:3,type:'comunicado',icon:'!', msg:'Novo comunicado: Política de Home Office', time:'há 2 dias', read:false},
  {id:4,type:'evento',    icon:'◫', msg:'Lembrete: Happy Hour amanhã às 18h',    time:'há 3 dias', read:true},
];

const TEAM_DATA = [
  {name:'Ana Ferreira',    role:'Analista RH',   av:'AF',c:'#2E8DD4',hours:45, bday:'15/03',trophies:2,salary:4800,status:'ok'},
  {name:'Nicolas Andrade', role:'Aux. ADM',       av:'NA',c:'#7060C8',hours:-8, bday:'22/08',trophies:1,salary:3600,status:'negative'},
  {name:'Alan Paixão',     role:'Aux. ADM',       av:'AP',c:'#4E8FA8',hours:12, bday:'04/11',trophies:3,salary:3400,status:'ok'},
  {name:'Robson Kauan',    role:'Serviços Gerais',av:'RK',c:'#D4A84B',hours:0,  bday:'30/07',trophies:11,salary:2800,status:'ok'},
  {name:'Lucas Santos',    role:'Dev Frontend',   av:'LS',c:'#0A9BB5',hours:28, bday:'18/02',trophies:1,salary:5200,status:'ok'},
  {name:'Maria Oliveira',  role:'Financeiro',     av:'MO',c:'#1A9C70',hours:-3, bday:'09/06',trophies:1,salary:4200,status:'negative'},
];

const EVENTS=[
  {day:1, label:'Dia do Trabalho',     time:'Dia todo', type:'Feriado',        color:T.blue},
  {day:6, label:'Aniversário — Alan',  time:'09:00',    type:'Confraternização',color:T.pink},
  {day:12,label:'Aniversário — Renata',time:'15:00',    type:'Confraternização',color:T.pink},
  {day:14,label:'Reunião Trimestral',  time:'10:00',    type:'Reunião',         color:T.purple},
  {day:20,label:'Check-in semanal',    time:'Agora',    type:'Hoje',            color:T.teal},
  {day:23,label:'Review de Metas',     time:'14:00',    type:'Reunião',         color:T.purple},
  {day:27,label:'Happy Hour',          time:'18:00',    type:'Confraternização',color:T.pink},
];
const RANK=[
  {pos:1,name:'Robson Kauan',    role:'Serviço',     t:11,av:'RK',c:T.goldL},
  {pos:2,name:'Alan Paixão',     role:'Aux. ADM',    t:3, av:'AP',c:T.blue},
  {pos:3,name:'Nicolas Andrade', role:'Aux. ADM',    t:1, av:'NA',c:T.purple},
  {pos:4,name:'Ana Ferreira',    role:'Analista RH', t:2, av:'AF',c:T.blue},
  {pos:5,name:'Lucas Santos',    role:'Dev Frontend',t:1, av:'LS',c:T.teal},
  {pos:6,name:'Maria Oliveira',  role:'Financeiro',  t:1, av:'MO',c:T.green},
];

/* ══════════════════════════════════════════
   LAVA LAMP BACKGROUND
══════════════════════════════════════════ */
const LavaLamp = () => (
  <div style={{position:'fixed',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
    <div style={{position:'absolute',inset:0,background:T.blobBase}}/>
    <div style={{position:'absolute',width:780,height:780,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b1} 0%,transparent 65%)`,
      top:'-180px',left:'-160px',filter:'blur(85px)',animation:'blob1 11s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:680,height:680,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b2} 0%,transparent 65%)`,
      top:'0%',right:'-140px',filter:'blur(80px)',animation:'blob2 13s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:600,height:600,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b3} 0%,transparent 62%)`,
      bottom:'-80px',left:'20%',filter:'blur(72px)',animation:'blob3 10s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:540,height:540,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b4} 0%,transparent 65%)`,
      bottom:'15%',right:'5%',filter:'blur(78px)',animation:'blob4 12s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:460,height:460,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b5} 0%,transparent 62%)`,
      top:'35%',left:'38%',filter:'blur(65px)',animation:'blob5 14s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:420,height:420,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b6} 0%,transparent 65%)`,
      top:'52%',left:'1%',filter:'blur(70px)',animation:'blob2 10s ease-in-out infinite 2s'}}/>
    <div style={{position:'absolute',width:380,height:380,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b7} 0%,transparent 65%)`,
      bottom:'5%',right:'30%',filter:'blur(68px)',animation:'blob1 9s ease-in-out infinite 3s'}}/>
    <div style={{position:'absolute',inset:0,background:T.blobVeil}}/>
  </div>
)
const Moon = ({size=32, color=T.goldL, opacity=0.45, float=false}) => (
  <svg width={size} height={size} viewBox="0 0 32 32"
    style={{opacity, flexShrink:0, animation:float?'moonFloat 4s ease-in-out infinite':undefined}}>
    <defs>
      <filter id="moonGlow">
        <feGaussianBlur stdDeviation="1.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    {/* crescent via two circles */}
    <path d="M20 5 A13 13 0 1 0 20 27 A9 9 0 1 1 20 5 Z"
      fill={color} filter="url(#moonGlow)"/>
    {/* inner highlight */}
    <path d="M21 8 A9 9 0 1 0 21 24 A6 6 0 1 1 21 8 Z"
      fill="white" opacity="0.18"/>
  </svg>
);

/* ══════════════════════════════════════════
   STAR DIVIDER — linha dourada + estrela
   (estilo da imagem enviada)
══════════════════════════════════════════ */
const StarDivider = ({my=8, width='100%', dim=false}) => {
  /* T.goldLine é hex (#RRGGBB) — sufixo hex de opacidade é válido */
  const lc = T.goldLine + (dim ? '44' : '88');
  const sc = T.goldV    + (dim ? '77' : 'BB');
  /* transparent compatível: versão rgba do goldLine com alpha=0 */
  const lt = T.goldLine + '00';
  return (
    <div style={{
      display:'flex', alignItems:'center',
      padding:`${my}px 0`, width,
      boxSizing:'border-box',
    }}>
      <div style={{
        flex:1, minWidth:8, height:1,
        background:`linear-gradient(to right, ${lt} 0%, ${lc} 100%)`,
      }}/>
      <svg width="10" height="10" viewBox="0 0 14 14"
        style={{flexShrink:0, margin:'0 7px',
          animation:'starPulse 2.5s ease-in-out infinite'}}>
        <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z"
          fill={sc}/>
      </svg>
      <div style={{
        flex:1, minWidth:8, height:1,
        background:`linear-gradient(to left, ${lt} 0%, ${lc} 100%)`,
      }}/>
    </div>
  );
};

/* ══════════════════════════════════════════
   LOGO PNG
══════════════════════════════════════════ */
const Logo = ({size=64}) => (
  <img src={logoNicolas} alt="Crescent Hub — Nicolas Andrade"
    style={{
      width:size, height:size,
      objectFit:'contain',
      display:'block',
      flexShrink:0,
      filter:'drop-shadow(0 4px 20px rgba(14,60,140,0.30))',
    }}/>
);

/* ══════════════════════════════════════════
   ATOMS
══════════════════════════════════════════ */
const Card = ({children,style,onClick,elevated}) => (
  <div onClick={onClick} style={{
    background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,
    boxShadow:elevated?T.shM:T.sh,position:'relative',overflow:'hidden',
    cursor:onClick?'pointer':'default',
    transition:'all .22s cubic-bezier(.16,1,.3,1)',fontFamily:'var(--font-body)',
    ...style}}
    onMouseEnter={onClick?e=>{e.currentTarget.style.boxShadow=T.shL;e.currentTarget.style.transform='translateY(-3px)';}:undefined}
    onMouseLeave={onClick?e=>{e.currentTarget.style.boxShadow=elevated?T.shM:T.sh;e.currentTarget.style.transform='none';}:undefined}>
    {children}
  </div>
);

const Tag = ({children,color=T.gold,bg}) => (
  <span style={{background:bg||`${color}12`,color,border:`1px solid ${color}28`,
    borderRadius:7,padding:'4px 11px',fontSize:12.5,fontWeight:500,
    fontFamily:'var(--font-body)',letterSpacing:'.01em'}}>{children}</span>
);

const Btn = ({children,onClick,v='ghost',icon,full,style:s,disabled}) => {
  const V={
    primary:{background:`linear-gradient(135deg,${T.gold},${T.blueL})`,
      color:'#fff',border:'none',boxShadow:`0 4px 18px rgba(14,80,180,0.32)`},
    secondary:{background:T.surface,color:T.gold,
      border:`1.5px solid ${T.gold}99`,boxShadow:T.sh},
    ghost:{background:T.goldGl,color:T.gold,
      border:`1px solid rgba(30,111,181,0.18)`},
    ghostGray:{background:'rgba(0,0,0,0.04)',color:T.textS,
      border:`1px solid ${T.border}`},
    blue:{background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
      color:'#fff',border:'none',boxShadow:`0 4px 18px rgba(78,143,168,0.28)`},
    danger:{background:T.dangerGl,color:T.danger,
      border:`1px solid rgba(192,64,80,0.18)`},
  };
  return(
    <button onClick={onClick} disabled={disabled} style={{
      display:'inline-flex',alignItems:'center',gap:8,padding:'10px 20px',
      borderRadius:10,cursor:disabled?'not-allowed':'pointer',
      fontFamily:'var(--font-body)',fontSize:14,fontWeight:500,
      outline:'none',transition:'all .18s',fontSize:15,
      width:full?'100%':'auto',justifyContent:full?'center':'flex-start',
      opacity:disabled?.45:1,...V[v],...s}}>
      {icon&&<span style={{fontSize:16}}>{icon}</span>}{children}
    </button>
  );
};

const Inp = ({label,value,onChange,type='text',placeholder,icon,autoFocus,style:s}) => {
  const [f,sf]=useState(false);
  return(
    <div style={{marginBottom:16}}>
      {label&&<div style={{color:T.textS,fontSize:14,fontWeight:500,marginBottom:7,
        fontFamily:'var(--font-body)'}}>{label}</div>}
      <div style={{position:'relative'}}>
        {icon&&<span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',
          color:f?T.gold:T.textD,fontSize:15,transition:'color .15s',userSelect:'none'}}>{icon}</span>}
        <input autoFocus={autoFocus} type={type} value={value}
          onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          onFocus={()=>sf(true)} onBlur={()=>sf(false)}
          style={{width:'100%',background:f?T.inputFocus:(T.surfaceInput||'rgba(0,0,0,0.025)'),
            border:`1.5px solid ${f?T.gold+'88':T.border}`,borderRadius:10,
            padding:`12px ${icon?'14px':'14px'} 12px ${icon?'42px':'14px'}`,
            color:T.text,fontFamily:'var(--font-body)',fontSize:16,outline:'none',
            transition:'all .18s',
            boxShadow:f?`0 0 0 3px rgba(30,111,181,0.10)`:'none',...s}}/>
      </div>
    </div>
  );
};

const SHead = ({children,sub}) => (
  <div style={{marginBottom:28}}>
    <div style={{fontFamily:'var(--font-body)',fontSize:24,fontWeight:700,
      color:T.text,letterSpacing:'-.01em',lineHeight:1.2}}>{children}</div>
    {sub&&<div style={{fontFamily:'var(--font-body)',fontSize:16,color:T.textT,marginTop:6}}>{sub}</div>}
    <StarDivider my={14}/>
  </div>
);

/* ══════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════ */
const LandingPage = ({onStart}) => {
  const [hov,sh]=useState(false);
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',position:'relative',zIndex:1,overflow:'hidden'}}>
      {/* sem luas nos cantos e sem linhas absolutas */}

      <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center'}}>
        {/* Logo ring */}
        {/* Logo — PNG puro, grande, centralizado */}
        <div className="fsu" style={{marginBottom:28,display:'flex',justifyContent:'center',alignItems:'center'}}>
          <Logo size={160}/>
        </div>

        <div className="fsu2">
          <div style={{fontFamily:'var(--font-brand)',fontSize:54,fontWeight:700,
            color:T.text,letterSpacing:'.12em',lineHeight:1}}>CRESCENT</div>
          <div style={{fontFamily:'var(--font-brand)',fontSize:28,fontWeight:400,
            color:T.gold,letterSpacing:'.30em',marginTop:6}}>HUB</div>
        </div>

        <div className="fsu3" style={{margin:'22px 0 10px',width:'460px'}}>
          <StarDivider/>
        </div>

        <div className="fsu3" style={{fontFamily:'var(--font-body)',fontSize:17,
          color:T.textT,marginBottom:44,fontWeight:400}}>
          Sistema Integrado de Gestão de Recursos Humanos
        </div>

        <div className="fsu4">
          <button onClick={onStart} onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
            style={{display:'inline-flex',alignItems:'center',gap:14,padding:'15px 52px',
              background:hov
                ?`linear-gradient(135deg,${T.gold},${T.blueL})`
                :`linear-gradient(135deg,${T.blueL},${T.gold})`,
              color:'#fff',border:'none',borderRadius:14,cursor:'pointer',
              fontFamily:'var(--font-body)',fontSize:16,fontWeight:500,
              boxShadow:hov?`0 10px 36px rgba(14,80,180,0.40)`:`0 5px 22px rgba(14,80,180,0.28)`,
              transform:hov?'translateY(-2px)':'none',
              transition:'all .22s cubic-bezier(.16,1,.3,1)',outline:'none',letterSpacing:'.01em'}}>
            Iniciar
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"
              style={{transition:'transform .2s',transform:hov?'translateX(3px)':'none'}}>
              <path d="M3 8.5H14M14 8.5L9.5 4M14 8.5L9.5 13"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="fsu4" style={{marginTop:50,display:'flex',alignItems:'center',gap:12,opacity:.4}}>
          <Logo size={26}/>
          <span style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT}}>
            Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
          </span>
        </div>
      </div>

    </div>
  );
};

/* ══════════════════════════════════════════
   LOGIN
══════════════════════════════════════════ */
const LoginScreen = ({onLogin}) => {
  const [email,se]=useState('');
  const [pass,sp]=useState('');
  const [loading,sl]=useState(false);
  const [err,serr]=useState('');
  const go=()=>{
    if(!email||!pass){serr('Preencha e-mail e senha.');return;}
    serr('');sl(true);
    setTimeout(()=>{sl(false);onLogin();},1400);
  };
  return(
    <div style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',position:'relative',zIndex:1}}>
      {/* LEFT */}
      <div className="fsu" style={{display:'flex',flexDirection:'column',alignItems:'center',
        justifyContent:'center',padding:64,
        background:'rgba(240,248,255,0.55)',backdropFilter:'blur(12px)',
        borderRight:`1px solid ${T.border}`}}>
        {/* floating moons */}
        <div style={{position:'absolute',top:32,right:32}}></div>
        <div style={{position:'absolute',bottom:40,left:32,transform:'rotate(180deg)'}}></div>
        <div style={{marginBottom:32,display:'flex',justifyContent:'center'}}>
          <Logo size={110}/>
        </div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:38,fontWeight:700,
          color:T.text,letterSpacing:'.10em',textAlign:'center',lineHeight:1}}>CRESCENT</div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:20,fontWeight:400,
          color:T.gold,letterSpacing:'.28em',marginTop:6,textAlign:'center'}}>HUB</div>
        <div style={{margin:'20px 0 16px',width:'320px'}}><StarDivider/></div>
        <div style={{fontFamily:'var(--font-body)',fontSize:15,color:T.textS,
          textAlign:'center',lineHeight:1.8}}>
          Sistema Integrado de Gestão<br/>de Recursos Humanos
        </div>
      </div>

      {/* RIGHT */}
      <div className="fsu2" style={{display:'flex',alignItems:'center',
        justifyContent:'center',padding:64}}>
        <div style={{width:'100%',maxWidth:400}}>
          <div style={{marginBottom:36}}>
            <div style={{fontFamily:'var(--font-body)',fontSize:28,fontWeight:600,
              color:T.text,marginBottom:7}}>Entrar no Sistema</div>
            <div style={{fontFamily:'var(--font-body)',fontSize:15,color:T.textS}}>
              Acesse sua conta corporativa
            </div>
          </div>
          <Inp label="E-mail corporativo" value={email} onChange={se} type="email"
            placeholder="colaborador@empresa.com" icon="✉" autoFocus/>
          <Inp label="Senha" value={pass} onChange={sp} type="password"
            placeholder="••••••••" icon="🔒"/>
          {err&&<div style={{fontFamily:'var(--font-body)',fontSize:13,color:T.danger,
            background:T.dangerGl,border:`1px solid rgba(192,64,80,0.20)`,
            borderRadius:9,padding:'9px 14px',marginBottom:14}}>{err}</div>}
          <Btn v="primary" full onClick={go} disabled={loading}
            style={{padding:'14px',fontSize:15,borderRadius:11,justifyContent:'center',marginTop:4}}>
            {loading
              ?<span style={{display:'flex',alignItems:'center',gap:9}}>
                  <span style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',
                    borderTop:'2px solid #fff',borderRadius:'50%',
                    animation:'spin .7s linear infinite',display:'inline-block'}}/>Entrando...
                </span>
              :'Entrar'}
          </Btn>
          <div style={{textAlign:'center',marginTop:14}}>
            <span style={{fontFamily:'var(--font-body)',fontSize:13,color:T.textD,cursor:'pointer'}}>
              Esqueceu a senha? Fale com o administrador
            </span>
          </div>
          <div style={{marginTop:26,width:'100%'}}><StarDivider/></div>
          <div style={{display:'flex',alignItems:'center',gap:11,justifyContent:'center',marginTop:16}}>
            <Logo size={26}/>
            <div style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT}}>
              Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,
                fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

/* ══════════════════════════════════════════
   MODULE SELECTOR
══════════════════════════════════════════ */
const ModuleSelector = ({onSelect}) => {
  const [hov,sh]=useState(null);
  /* ícones SVG elegantes para cada módulo */
  const IcoOFX = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
  const IcoComp = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
      <line x1="7" y1="15" x2="7.01" y2="15"/>
      <line x1="11" y1="15" x2="13" y2="15"/>
    </svg>
  );
  const IcoColab = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
  const IcoDash = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
  const mods=[
    {id:'ofx',         label:'Analisador OFX',         sub:'Extratos financeiros', icon:IcoOFX,  color:T.gold, bg:T.goldGl, tag:'Financeiro'},
    {id:'comprovantes',label:'Central de Comprovantes', sub:'Documentos bancários', icon:IcoComp, color:T.gold, bg:T.goldGl, tag:'Documentos'},
    {id:'colaborador', label:'Central do Colaborador',  sub:'Portal RH completo',   icon:IcoColab,color:T.gold, bg:T.goldGl, tag:'Principal',hi:true},
    {id:'dashboard',   label:'Dashboard RH',            sub:'Visão do gestor',      icon:IcoDash, color:T.gold, bg:T.goldGl, tag:'Gestor',hi:true},
  ];
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',position:'relative',zIndex:1,padding:'40px 32px'}}>
      <div className="fsu" style={{textAlign:'center',marginBottom:44}}>
        {/* Logo grande centralizado */}
        <div style={{display:'flex',justifyContent:'center',marginBottom:18}}>
          <Logo size={165}/>
        </div>
        {/* Nome do sistema */}
        <div style={{fontFamily:'var(--font-brand)',fontSize:28,fontWeight:700,
          color:T.text,letterSpacing:'.07em',lineHeight:1}}>CRESCENT HUB</div>
        <div style={{fontFamily:'var(--font-body)',fontSize:13,color:T.textT,
          letterSpacing:'.10em',textTransform:'uppercase',marginTop:5,marginBottom:14}}>
          Sistema Corporativo
        </div>
        <div style={{width:'380px',margin:'0 auto 14px'}}><StarDivider/></div>
        <div style={{fontFamily:'var(--font-body)',fontSize:16,color:T.textS}}>
          Selecione um módulo para continuar
        </div>
      </div>

      <div className="fsu2" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',
        gap:22,width:'100%',maxWidth:980}}>
        {mods.map(m=>(
          <div key={m.id} onClick={()=>onSelect(m.id)}
            onMouseEnter={()=>sh(m.id)} onMouseLeave={()=>sh(null)}
            style={{background:T.surface,
              border:`1px solid ${hov===m.id?m.color+'55':T.border}`,
              borderRadius:18,boxShadow:hov===m.id?T.shL:T.sh,padding:'36px 30px',
              cursor:'pointer',transform:hov===m.id?'translateY(-6px)':'none',
              transition:'all .25s cubic-bezier(.16,1,.3,1)',
              position:'relative',overflow:'hidden',fontFamily:'var(--font-body)'}}>
            {/* linha azul no topo de todos os cards */}
            <div style={{position:'absolute',top:0,left:'15%',right:'15%',height:2,
              background:`linear-gradient(90deg,transparent,${T.goldV},transparent)`,
              borderRadius:999,opacity:m.hi?1:0.55}}/>

            <div style={{display:'flex',justifyContent:'space-between',
              alignItems:'flex-start',marginBottom:20}}>
              <div style={{width:54,height:54,borderRadius:14,background:m.bg,
                border:`1px solid ${m.color}22`,display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:23,color:m.color}}>{m.icon}</div>
              <Tag color={m.color} style={{marginTop:4}}>{m.tag}</Tag>
            </div>
            <div style={{fontSize:19,fontWeight:600,color:T.text,marginBottom:7}}>{m.label}</div>
            <div style={{fontSize:14,color:T.textS,marginBottom:22,lineHeight:1.65}}>{m.sub}</div>
            <div style={{marginBottom:18}}></div>
            <div style={{display:'flex',alignItems:'center',gap:8,color:m.color,
              fontSize:13,fontWeight:500}}>
              {/* estrela cintilante */}
              <svg width="11" height="11" viewBox="0 0 14 14"
                style={{flexShrink:0,animation:'starPulse 2s ease-in-out infinite',
                  animationDelay:`${mods.indexOf(m)*0.3}s`}}>
                <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z"
                  fill={m.color}/>
              </svg>
              Acessar
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                style={{transition:'transform .18s',transform:hov===m.id?'translateX(4px)':'none'}}>
                <path d="M2.5 7H11.5M11.5 7L8 3.5M11.5 7L8 10.5"
                  stroke={m.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        ))}
      </div>

      <div className="fsu3" style={{marginTop:44,display:'flex',alignItems:'center',gap:10,opacity:.35}}>
        <Logo size={22}/>
        <span style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT,whiteSpace:'nowrap'}}>
          Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,
            fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
        </span>
      </div>

    </div>
  );
};

/* ══════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════ */
const I = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);
const NAV=[
  /* Grupo 1 — Pessoal */
  {id:'inicio',     label:'Início',        icon:<I><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-5H9v5H4a1 1 0 01-1-1z"/></I>},
  {id:'dados',      label:'Seus Dados',    icon:<I><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></I>},
  {id:'financeiro', label:'Financeiro',    icon:<I><circle cx="12" cy="12" r="9"/><path d="M12 7v1.5M12 15.5V17M9.5 10.5c0-1.1.9-2 2.5-2s2.5.9 2.5 2-2.5 2-2.5 2-2.5.9-2.5 2 .9 2 2.5 2 2.5-.9 2.5-2"/></I>},
  {id:'horas',      label:'Banco de Horas',icon:<I><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></I>},
  /* Grupo 2 — Corporativo (divider antes) */
  {id:'comunicados',label:'Comunicados',   icon:<I><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></I>},
  {id:'eventos',    label:'Eventos',       icon:<I><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></I>},
  {id:'feedback',   label:'Feedback',      icon:<I><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></I>},
  {id:'conquistas', label:'Conquistas',    icon:<I><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/></I>},
  /* Grupo 3 — Entretenimento (divider antes) */
  {id:'feed',       label:'Feed',          icon:<I><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="11" y2="18"/></I>},
  {id:'doko',       label:'My Doko',       icon:<I><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></I>},
  {id:'games',      label:'Games',         icon:<I><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 12h2m-1-1v2M14 12h2"/></I>},
  {id:'simulador',  label:'Simulação',     icon:<I><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></I>},
];

const Sidebar = ({tab,setTab,onBack,activeTheme,onTheme,onOpenSettings}) => {
  const [hov,sh]=useState(null);
  return(
    <div style={{width:252,minHeight:'100vh',
      background:T.sidebarBg,
      borderRight:`1px solid ${T.border}`,
      display:'flex',flexDirection:'column',
      position:'fixed',top:0,left:0,bottom:0,zIndex:200,
      fontFamily:'var(--font-body)'}}>

      {/* Brand — mini lava lamp azul animado */}
      <div style={{padding:'18px 16px 12px',position:'relative',overflow:'hidden',
        borderBottom:`1px solid rgba(42,130,210,0.10)`}}>
        {/* blobs animados de fundo */}
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',width:110,height:110,borderRadius:'50%',
            background:`radial-gradient(circle,${T.sb1} 0%,transparent 70%)`,
            top:'-30px',left:'-20px',filter:'blur(22px)',
            animation:'brandBlob1 6s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:95,height:95,borderRadius:'50%',
            background:`radial-gradient(circle,${T.sb2} 0%,transparent 70%)`,
            top:'-10px',right:'-10px',filter:'blur(18px)',
            animation:'brandBlob2 8s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:80,height:80,borderRadius:'50%',
            background:`radial-gradient(circle,${T.sb3} 0%,transparent 70%)`,
            bottom:'-20px',left:'30%',filter:'blur(16px)',
            animation:'brandBlob3 7s ease-in-out infinite'}}/>
        </div>
        <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:13,marginBottom:12}}>
          {/* Logo com blob #1F6FA9 atrás */}
          <div style={{position:'relative',flexShrink:0,width:58,height:58}}>
            <div style={{position:'absolute',inset:'-8px',borderRadius:'50%',
              background:`radial-gradient(circle,${T.lb} 0%,${T.lb2} 55%,transparent 80%)`,
              filter:'blur(10px)',animation:'brandBlob1 12s ease-in-out infinite',
              zIndex:0,pointerEvents:'none'}}/>
            <div style={{position:'absolute',inset:0,zIndex:1,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Logo size={58}/>
            </div>
          </div>
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:15.5,fontWeight:700,
              color:T.text,letterSpacing:'.05em'}}>CRESCENT HUB</div>
            <div style={{fontSize:12,color:T.textT,letterSpacing:'.06em',
              textTransform:'uppercase',marginTop:3}}>Portal do Colaborador</div>
          </div>
        </div>
        {/* star divider under brand */}
        <StarDivider my={0}/>
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:'8px 12px',display:'flex',flexDirection:'column',
        gap:2,overflowY:'auto'}}>
        <div style={{fontSize:11.5,color:T.textD,letterSpacing:'.09em',
          textTransform:'uppercase',padding:'2px 8px 10px',fontWeight:600}}>NAVEGAÇÃO</div>

        {NAV.map((n,idx)=>{
          const a=tab===n.id;
          const showDivider = idx===4 || idx===8; /* dividers between logical groups */
          return(
            <div key={n.id}>
              {showDivider && <StarDivider my={5} dim/>}
              <div onClick={()=>setTab(n.id)}
                onMouseEnter={()=>sh(n.id)} onMouseLeave={()=>sh(null)}
                style={{display:'flex',alignItems:'center',gap:11,padding:'11px 13px',
                  borderRadius:10,cursor:'pointer',
                  background:a?T.goldGl:hov===n.id?(T.surfaceSub||'rgba(0,0,0,0.03)'):'transparent',
                  border:a?`1px solid rgba(212,168,75,0.22)`:'1px solid transparent',
                  color:a?T.gold:hov===n.id?T.text:T.textS,
                  transition:'all .14s'}}>
                <span style={{color:a?T.gold:hov===n.id?T.textS:T.textT,fontSize:18,
                  minWidth:22,textAlign:'center'}}>{n.icon}</span>
                <span style={{fontSize:15,fontWeight:a?600:400}}>{n.label}</span>
                {a&&<span style={{marginLeft:'auto',flexShrink:0}}>
                </span>}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{padding:'10px 12px 18px'}}>
        <StarDivider my={0}/>
        <div onClick={onOpenSettings}
          onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          style={{display:'flex',alignItems:'center',gap:9,padding:'9px 11px',
            borderRadius:9,cursor:'pointer',marginBottom:6,transition:'background .14s'}}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none"
            stroke={T.textS} strokeWidth="1.6" strokeLinecap="round">
            <circle cx="10" cy="10" r="3"/>
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/>
          </svg>
          <span style={{fontFamily:'var(--font-body)',fontSize:13,color:T.textS}}>Configurações</span>
          <span style={{marginLeft:'auto',fontFamily:'var(--font-body)',fontSize:10,
            fontWeight:500,
            color:THEMES[activeTheme]?.dark ? '#fff' : T.gold,
            background:THEMES[activeTheme]?.dark ? T.gold+'CC' : T.goldGl,
            border:`1px solid ${T.gold}44`,
            padding:'2px 8px',borderRadius:6}}>
            {THEMES[activeTheme]?.name?.split(' ')[0]||'Azul'}
          </span>
        </div>
        <div style={{marginTop:4,display:'flex',alignItems:'center',gap:11,padding:'12px 13px',
          background:T.goldGl,borderRadius:12,
          border:`1px solid rgba(212,168,75,0.15)`,marginBottom:7}}>
          <div style={{width:38,height:38,borderRadius:'50%',
            background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:14,fontWeight:600,color:'#fff',flexShrink:0}}>
            {USER.avatar}
          </div>
          <div style={{overflow:'hidden',flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text,
              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{USER.name}</div>
            <div style={{fontSize:12,color:T.textT,marginTop:1}}>Colaborador</div>
          </div>
        </div>
        <div onClick={onBack}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(192,64,80,0.05)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          style={{display:'flex',alignItems:'center',gap:8,padding:'9px 13px',
            borderRadius:9,cursor:'pointer',color:T.danger,fontSize:14,fontWeight:500,
            transition:'background .14s'}}>
          ← Sair
        </div>
      </div>
    </div>
  );
};

/* ── TOP BAR ── */
const TopBar = ({tab,onBack}) => {
  const nm={inicio:'Início',financeiro:'Financeiro',dados:'Seus Dados',horas:'Banco de Horas',
    feedback:'Feedback',eventos:'Eventos',games:'Games',conquistas:'Conquistas',feed:'Feed',
    comunicados:'Comunicados',simulador:'Simulação',doko:'My Doko'};
  const [notifOpen,setNO]=useState(false);
  const [notifs,setNotifs]=useState(NOTIFS_DATA);
  const unread=notifs.filter(n=>!n.read).length;
  if(tab==='inicio')return null;
  return(
    <div style={{height:52,display:'flex',alignItems:'center',gap:12,padding:'0 30px',
      background:T.topbarBg,backdropFilter:'blur(12px)',
      borderBottom:`1px solid ${T.border}`,flexShrink:0,
      fontFamily:'var(--font-body)',position:'relative',zIndex:300}}>
      <button onClick={onBack}
        onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
        style={{display:'flex',alignItems:'center',gap:7,background:'none',border:'none',
          cursor:'pointer',color:T.textS,fontFamily:'var(--font-body)',fontSize:14,
          padding:'4px 9px',borderRadius:7,transition:'background .14s'}}>← Voltar</button>
      <div style={{width:1,height:16,background:T.divider}}/>
      <div style={{fontSize:14,color:T.textT,flex:1}}>
        Central do Colaborador<span style={{color:T.textD,margin:'0 5px'}}>›</span>
        <strong style={{color:T.text,fontWeight:500}}>{nm[tab]||tab}</strong>
      </div>
      <div style={{position:'relative'}}>
        <button onClick={()=>setNO(o=>!o)} style={{position:'relative',
          background:notifOpen?T.goldGl:'none',border:'none',cursor:'pointer',
          width:36,height:36,borderRadius:10,outline:'none',
          display:'flex',alignItems:'center',justifyContent:'center',
          color:T.textS,transition:'all .15s'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={unread>0?T.gold:'currentColor'} strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          {unread>0&&<div style={{position:'absolute',top:4,right:4,width:16,height:16,
            borderRadius:'50%',background:T.gold,color:'#fff',fontSize:9,fontWeight:700,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontFamily:'var(--font-body)',border:`2px solid ${T.topbarBg}`}}>{unread}</div>}
        </button>
        {notifOpen&&(<div style={{position:'absolute',top:44,right:0,width:340,
          background:T.surface,border:`1px solid ${T.border}`,
          borderRadius:14,boxShadow:T.shL,zIndex:400,overflow:'hidden'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'14px 16px 10px',borderBottom:`1px solid ${T.divider}`}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>Notificações
              {unread>0&&<span style={{marginLeft:8,background:T.goldGl,color:T.gold,
                borderRadius:999,padding:'1px 8px',fontSize:11,
                border:`1px solid ${T.goldLine}44`}}>{unread} novas</span>}
            </div>
            {unread>0&&<button onClick={()=>setNotifs(n=>n.map(x=>({...x,read:true})))}
              style={{background:'none',border:'none',cursor:'pointer',
                color:T.gold,fontSize:12,fontFamily:'var(--font-body)'}}>Marcar lidas</button>}
          </div>
          <div style={{maxHeight:300,overflowY:'auto'}}>
            {notifs.map(n=>(
              <div key={n.id}
                onClick={()=>setNotifs(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))}
                style={{display:'flex',gap:12,padding:'12px 16px',cursor:'pointer',
                  background:n.read?'transparent':T.goldGl,
                  borderBottom:`1px solid ${T.divider}`,transition:'background .14s'}}>
                <div style={{width:34,height:34,borderRadius:9,background:T.goldGl,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:13,fontWeight:700,color:T.gold,flexShrink:0}}>{n.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:T.text,fontWeight:n.read?400:500,lineHeight:1.5}}>{n.msg}</div>
                  <div style={{fontSize:11,color:T.textT,marginTop:2}}>{n.time}</div>
                </div>
                {!n.read&&<div style={{width:6,height:6,borderRadius:'50%',
                  background:T.gold,flexShrink:0,marginTop:6}}/>}
              </div>
            ))}
          </div>
          <div style={{padding:'10px',borderTop:`1px solid ${T.divider}`,
            textAlign:'center',fontSize:12,color:T.textT}}>Últimas notificações</div>
        </div>)}
      </div>
    </div>
  );
};
const TabInicio = ({setTab}) => {
  const [sv,ssv]=useState(false);
  const Qi=({d})=>(<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>);
  const q=[
    {id:'financeiro',label:'Financeiro',sub:'Contracheques',c:T.green,bg:T.greenGl,
      e:<Qi d={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>}/>},
    {id:'feedback',label:'Feedback',sub:'Sugestões',c:T.pink,bg:T.pinkGl,
      e:<Qi d={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>}/>},
    {id:'eventos',label:'Eventos',sub:'Agenda',c:T.blue,bg:T.blueGl,
      e:<Qi d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>},
    {id:'games',label:'Games',sub:'Jogar',c:T.gold,bg:T.goldGl,
      e:<Qi d={<><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 12h2m-1-1v2M14 12h2"/></>}/>},
  ];
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      {/* Banner */}
      <div style={{borderRadius:18,overflow:'hidden',marginBottom:20,height:158,position:'relative',
        background:`linear-gradient(120deg,${T.blue},${T.blueL} 55%,${T.gold})`,boxShadow:T.shM}}>
        <div style={{position:'absolute',right:-40,top:-40,width:280,height:280,
          borderRadius:'50%',background:'rgba(255,255,255,0.06)',pointerEvents:'none'}}/>
        {/* crescent in banner */}
        <div style={{position:'absolute',right:20,top:'50%',transform:'translateY(-50%)'}}>
        </div>
        <div style={{position:'relative',zIndex:1,padding:'26px 30px',
          display:'flex',alignItems:'center',gap:20,height:'100%'}}>
          <div style={{width:72,height:72,borderRadius:'50%',
            background:'rgba(255,255,255,0.92)',display:'flex',alignItems:'center',
            justifyContent:'center',fontSize:24,fontWeight:700,color:T.blue,
            border:'3px solid rgba(255,255,255,.55)',boxShadow:'0 4px 20px rgba(0,0,0,.15)',
            flexShrink:0,cursor:'pointer'}}>
            {USER.avatar}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:24,fontWeight:600,color:'#fff',marginBottom:5}}>Olá, {USER.short}!</div>
            <div style={{fontSize:15,color:'rgba(255,255,255,.78)'}}>Bem-vindo(a) à sua Central de RH</div>
          </div>
          <button style={{padding:'9px 18px',background:'rgba(255,255,255,.15)',
            border:'1px solid rgba(255,255,255,.3)',borderRadius:9,color:'#fff',
            fontFamily:'var(--font-body)',fontSize:13,cursor:'pointer'}}>
            Trocar Banner
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <Card style={{padding:'24px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:12,background:T.greenGl,
              border:`1px solid ${T.green}22`,display:'flex',alignItems:'center',
              justifyContent:'center',color:T.green,fontSize:20}}>$</div>
            <button onClick={()=>ssv(!sv)} style={{background:'none',border:'none',
              cursor:'pointer',color:sv?T.gold:T.textD,padding:3,display:'flex',
              alignItems:'center',transition:'color .18s'}}>
              {sv
                ?<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                :<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/>
                  </svg>}
            </button>
          </div>
          <div style={{fontSize:13,color:T.textT,marginBottom:5,fontWeight:500}}>Último Salário</div>
          <div style={{fontSize:24,fontWeight:700,color:T.text,marginBottom:8,letterSpacing:'-.01em'}}>
            {sv?`R$ ${USER.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'R$ ••••,••'}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:T.green}}/>
            <span style={{fontSize:13,color:T.green,fontWeight:500}}>Pagamento em dia</span>
          </div>
        </Card>

        <Card style={{padding:'24px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:12,background:T.goldGl,
              border:`1px solid ${T.gold}22`,display:'flex',alignItems:'center',
              justifyContent:'center',color:T.gold}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4a2 2 0 01-2-2V5h4"/><path d="M18 9h2a2 2 0 002-2V5h-4"/>
                <path d="M12 17v4M8 21h8"/>
                <path d="M6 5v4a6 6 0 0012 0V5H6z"/>
              </svg>
            </div>
            <button onClick={()=>setTab('conquistas')} style={{background:'none',border:'none',
              cursor:'pointer',color:T.textD,fontSize:16,padding:3}}>↗</button>
          </div>
          <div style={{fontSize:13,color:T.textT,marginBottom:5,fontWeight:500}}>Troféus</div>
          <div style={{fontSize:30,fontWeight:700,color:T.text,marginBottom:8}}>{USER.trophies.length}</div>
          <div style={{display:'flex',gap:7}}>
            {USER.trophies.map((t,i)=><span key={i} style={{fontSize:20}}>{t.icon}</span>)}
          </div>
        </Card>
      </div>

      <Card style={{padding:'24px',marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
          <div style={{fontSize:18,fontWeight:600,color:T.text}}>Acesso Rápido</div>
        </div>
        <div style={{fontSize:14,color:T.textT,marginBottom:4}}>Módulos mais utilizados</div>
        <StarDivider my={12}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
          {q.map(ql=>(
            <div key={ql.id} onClick={()=>setTab(ql.id)}
              style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',
                background:ql.bg,border:`1px solid rgba(0,0,0,0.05)`,borderRadius:12,
                cursor:'pointer',transition:'all .18s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=T.shM;}}
              onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
              <span style={{color:ql.c,display:'flex',alignItems:'center'}}>{ql.e}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500,color:T.text}}>{ql.label}</div>
                <div style={{fontSize:12,color:T.textT}}>{ql.sub}</div>
              </div>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5H10.5M10.5 6.5L7.5 3.5M10.5 6.5L7.5 9.5"
                  stroke={ql.c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ))}
        </div>
      </Card>

      <div style={{display:'flex',alignItems:'center',gap:13,padding:'13px 18px',
        background:T.goldGl,border:`1px solid rgba(184,144,42,.16)`,borderRadius:12}}>
        <span style={{flexShrink:0,color:T.gold,display:'flex',alignItems:'center'}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/>
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/>
          </svg></span>
        <div style={{fontSize:14,color:T.textS,lineHeight:1.65}}>
          <strong style={{color:T.gold,fontWeight:500}}>Dica:</strong> Clique na foto de perfil para alterá-la a qualquer momento.
        </div>
      </div>
    </div>
  );
};

const TabFinanceiro = () => {
  const liq=USER.salary-USER.inss-USER.ir;
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Salários e contracheques">Financeiro</SHead>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',
        background:T.surface,border:`1px solid ${T.border}`,
        borderRadius:14,overflow:'hidden',marginBottom:20,boxShadow:T.sh}}>
        {[['Nome',USER.name],['Categoria',USER.category],['Cargo',USER.cargo],
          ['Admissão',USER.admission],['Dependentes',USER.dependents],['Hora/Mês',USER.horasMes]].map(([l,v],i)=>(
          <div key={l} style={{padding:'15px 17px',borderRight:i<5?`1px solid ${T.divider}`:'none'}}>
            <div style={{fontSize:11,color:T.textD,letterSpacing:'.06em',
              textTransform:'uppercase',marginBottom:5,fontWeight:500}}>{l}</div>
            <div style={{fontSize:13,fontWeight:500,color:T.text}}>{v}</div>
          </div>
        ))}
      </div>
      <Card style={{padding:'28px',marginBottom:18}} elevated>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div>
            <div style={{fontSize:20,fontWeight:600,color:T.text}}>Resumo Financeiro</div>
            <div style={{fontSize:14,color:T.textT,marginTop:4}}>Cálculo do salário líquido</div>
          </div>
        </div>
        <StarDivider my={14}/>
        <div style={{background:T.greenGl,border:`1px solid ${T.green}22`,borderRadius:13,
          padding:'20px 24px',marginBottom:14,display:'flex',
          justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:11,color:T.green,letterSpacing:'.07em',
              textTransform:'uppercase',marginBottom:6,fontWeight:500}}>+ SALÁRIO BRUTO</div>
            <div style={{fontSize:24,fontWeight:700,color:T.green}}>
              R$ {USER.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </div>
          </div>
          <div style={{width:46,height:46,borderRadius:'50%',background:T.green,
            display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:20}}>$</div>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:16,padding:'12px',
          fontSize:14,marginBottom:14,color:T.textS}}>
          <span style={{color:T.green,fontWeight:500}}>R$ {USER.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span>−</span>
          <span style={{color:T.danger,fontWeight:500}}>R$ {(USER.inss+USER.ir).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span>=</span>
          <span style={{color:T.gold,fontWeight:600}}>R$ {liq.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
        </div>
        <div style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
          borderRadius:13,padding:'22px 26px',
          display:'flex',justifyContent:'space-between',alignItems:'center',
          boxShadow:`0 6px 24px rgba(184,144,42,0.28)`}}>
          <div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.65)',letterSpacing:'.07em',
              textTransform:'uppercase',marginBottom:6}}>↑ SALÁRIO LÍQUIDO</div>
            <div style={{fontSize:26,fontWeight:700,color:'#fff'}}>
              R$ {liq.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,.6)',marginTop:4}}>Valor final a receber</div>
          </div>
          <div style={{width:46,height:46,borderRadius:'50%',background:'rgba(255,255,255,.22)',
            display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:20}}>↗</div>
        </div>
      </Card>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18}}>
        {[['INSS',USER.inss,T.danger,T.dangerGl],['IR Retido',USER.ir,T.gold,T.goldGl],
          ['VT',USER.vt,T.blue,T.blueGl],['VA',USER.va,T.green,T.greenGl]].map(([l,v,c,bg])=>(
          <div key={l} style={{background:bg,border:`1px solid ${c}22`,borderRadius:13,
            padding:'16px 20px',display:'flex',justifyContent:'space-between',
            alignItems:'center',boxShadow:T.sh}}>
            <span style={{fontSize:14,color:T.textS}}>— {l}</span>
            <span style={{fontSize:16,fontWeight:700,color:c}}>
              R$ {v.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </span>
          </div>
        ))}
      </div>
      <Card style={{padding:'28px',marginBottom:16}}>
        <div style={{fontSize:19,fontWeight:600,color:T.text,marginBottom:4}}>Evolução Salarial</div>
        <div style={{fontSize:14,color:T.textT,marginBottom:14}}>Histórico de reajustes</div>
        <StarDivider my={14}/>
        <SalaryChart/>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:14}}>
          {SALARY_HISTORY.map((s,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',
              background:T.surfaceSub||'rgba(0,0,0,0.025)',borderRadius:9,border:`1px solid ${T.border}`}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:T.gold,flexShrink:0}}/>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.text}}>{s.date} — R$ {s.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                {s.pct&&<div style={{fontSize:11,color:T.green}}>{s.pct} · {s.event}</div>}
                {!s.pct&&<div style={{fontSize:11,color:T.textT}}>{s.event}</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{padding:'28px'}}>
        <div style={{fontSize:19,fontWeight:600,color:T.text,marginBottom:4}}>Contracheques</div>
        <div style={{fontSize:14,color:T.textT,marginBottom:14}}>Histórico de pagamentos</div>
        <StarDivider my={14}/>
        {['Jan','Fev','Mar','Abr','Mai','Jun'].map(m=>(
          <div key={m} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 15px',
            background:m==='Mai'?T.goldGl:'rgba(0,0,0,0.02)',
            border:`1px solid ${m==='Mai'?'rgba(212,168,75,0.20)':T.divider}`,
            borderRadius:11,marginBottom:9}}>
            <div style={{width:38,height:38,borderRadius:10,
              background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:12,fontWeight:600,color:'#fff',flexShrink:0}}>{m}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:500,color:T.text}}>Contracheque {m}/2025</div>
              <div style={{fontSize:12,color:T.textT,marginTop:2}}>Competência {m} 2025</div>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:T.green}}>
              R$ {liq.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </div>
            <Btn v="ghostGray" style={{padding:'6px 14px',fontSize:13}}>PDF</Btn>
          </div>
        ))}
      </Card>
    </div>
  );
};

const TabDados = () => (
  <div className="fi" style={{fontFamily:'var(--font-body)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
      <SHead sub="Informações pessoais e documentos">Seus Dados</SHead>
      <Btn v="secondary" style={{marginTop:4}}>✏ Editar Dados</Btn>
    </div>
    {[
      {title:'Informações Pessoais',color:T.blue,  fields:[['Nome Completo',USER.name],['Data de Nascimento',USER.birth],['CPF',USER.cpf],['RG',USER.rg]]},
      {title:'Contato',             color:T.teal,  fields:[['E-mail',USER.email],['Telefone',USER.phone]]},
      {title:'Endereço',            color:T.gold,  fields:[['Logradouro',USER.street],['Bairro',USER.district],['CEP',USER.cep],['Cidade',USER.city],['Estado',USER.state]]},
    ].map(sec=>(
      <Card key={sec.title} style={{padding:'26px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <div style={{width:4,height:18,borderRadius:2,
            background:`linear-gradient(180deg,${sec.color},${sec.color}55)`}}/>
          <span style={{fontSize:18,fontWeight:600,color:T.text}}>{sec.title}</span>
          <div style={{marginLeft:'auto'}}></div>
        </div>
        <StarDivider my={0}/>
        <div style={{marginTop:18,display:'flex',flexWrap:'wrap',gap:'0 32px'}}>
          {sec.fields.map(([l,v])=>(
            <div key={l} style={{marginBottom:20,flex:'1 1 40%',minWidth:150}}>
              <div style={{fontSize:12,color:T.textD,letterSpacing:'.06em',
                textTransform:'uppercase',marginBottom:6,fontWeight:500}}>{l}</div>
              <div style={{fontSize:15,color:v?T.text:T.textD,fontStyle:v?'normal':'italic',
                paddingBottom:9,borderBottom:`1px solid ${T.divider}`}}>
                {v||'Não informado'}
              </div>
            </div>
          ))}
        </div>
      </Card>
    ))}
  </div>
);

const TabHoras = () => {
  const [s,ss]=useState('');
  const [nh,snh]=useState('');
  const [nd,snd]=useState('');
  const [ents,se]=useState([
    {id:1,date:'15/05/2025',desc:'Plantão extra — relatório mensal',h:3},
    {id:2,date:'10/05/2025',desc:'Reunião fora do expediente',h:1.5},
    {id:3,date:'05/05/2025',desc:'Suporte ao time de vendas',h:2},
  ]);
  const total=USER.hours+ents.reduce((a,e)=>a+e.h,0);
  const add=()=>{
    if(!nh||!nd)return;
    se(p=>[{id:Date.now(),date:new Date().toLocaleDateString('pt-BR'),desc:nd,h:Number(nh)},...p]);
    snh('');snd('');
  };
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <div style={{background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
        borderRadius:18,padding:'30px',marginBottom:22,textAlign:'center',
        boxShadow:`0 8px 28px rgba(78,143,168,0.25)`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',right:-20,top:-20}}>
        </div>
        <div style={{position:'relative',zIndex:1}}>
          <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:600,
            color:'#fff',letterSpacing:'.08em',marginBottom:8}}>BANCO DE HORAS</div>
          <div style={{width:'250px',margin:'0 auto 10px'}}><StarDivider/></div>
          <div style={{fontSize:48,fontWeight:700,color:'#fff',marginBottom:10,letterSpacing:'-.02em'}}>
            {total}<span style={{fontSize:26,opacity:.7}}>h</span>
          </div>
          <div style={{fontSize:15,color:'rgba(255,255,255,.72)',marginBottom:12}}>
            Total acumulado · {ents.length} registros
          </div>
          <div style={{display:'inline-flex',alignItems:'center',gap:7,
            background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.28)',
            borderRadius:999,padding:'5px 16px',fontSize:13,color:'#fff'}}>
            ● Sincronizado
          </div>
        </div>
      </div>
      <Card style={{padding:'26px',marginBottom:14}}>
        <div style={{fontSize:18,fontWeight:600,color:T.text,marginBottom:14}}>Registrar Horas</div>
        <StarDivider my={0}/>
        <div style={{marginTop:16,display:'flex',gap:12,alignItems:'flex-end'}}>
          <div style={{flex:2}}><Inp label="Descrição" value={nd} onChange={snd} placeholder="Ex: Plantão, reunião extra..."/></div>
          <div style={{flex:'0 0 100px'}}><Inp label="Horas" value={nh} onChange={snh} type="number" placeholder="Ex: 2"/></div>
          <Btn v="primary" onClick={add} style={{marginBottom:16,padding:'12px 20px',fontSize:14}}>Adicionar</Btn>
        </div>
      </Card>
      <Card style={{padding:'26px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:18,fontWeight:600,color:T.text}}>Histórico</div>
          <input value={s} onChange={e=>ss(e.target.value)} placeholder="Buscar..."
            style={{background:'rgba(0,0,0,0.03)',border:`1.5px solid ${T.border}`,
              borderRadius:9,padding:'8px 14px',color:T.text,
              fontFamily:'var(--font-body)',fontSize:14,outline:'none',width:200}}
            onFocus={e=>e.target.style.borderColor=T.gold}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <StarDivider my={4}/>
        {ents.filter(e=>e.desc.toLowerCase().includes(s.toLowerCase())).map(e=>(
          <div key={e.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 15px',
            background:'rgba(0,0,0,0.02)',border:`1px solid ${T.divider}`,
            borderRadius:11,marginBottom:10}}>
            <div style={{width:42,height:42,borderRadius:11,
              background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
              display:'flex',alignItems:'center',justifyContent:'center',
              color:'#fff',fontSize:13,fontWeight:600,flexShrink:0}}>{e.h}h</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:500,color:T.text}}>{e.desc}</div>
              <div style={{fontSize:12,color:T.textT,marginTop:2}}>{e.date}</div>
            </div>
            <Tag color={T.teal}>Extra</Tag>
          </div>
        ))}
      </Card>
    </div>
  );
};

const TabFeedback = () => {
  const [msg,sm]=useState('');
  const [cat,sc]=useState('Sugestão');
  const [sent,ss]=useState(false);
  if(sent)return(
    <div className="fi" style={{display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',minHeight:400,gap:18,fontFamily:'var(--font-body)'}}>
      <div style={{width:68,height:68,borderRadius:'50%',background:T.greenGl,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>✅</div>
      <div style={{fontSize:24,fontWeight:600,color:T.text}}>Feedback enviado!</div>
      <div style={{fontSize:15,color:T.textS}}>Sua contribuição foi registrada.</div>
      <div style={{width:'250px'}}><StarDivider/></div>
      <Btn v="ghost" onClick={()=>{sm('');ss(false);}}>Enviar outro</Btn>
    </div>
  );
  const cats=['Sugestão','Elogio','Crítica','Problema'];
  const cc={Sugestão:T.blue,Elogio:T.green,Crítica:T.gold,Problema:T.danger};
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Envie sugestões, críticas ou elogios">Feedback</SHead>
      <Card style={{padding:'30px'}}>
        <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
          {cats.map(c=>(
            <button key={c} onClick={()=>sc(c)}
              style={{padding:'8px 18px',borderRadius:9,cursor:'pointer',
                fontFamily:'var(--font-body)',fontSize:14,fontWeight:500,
                background:cat===c?`${cc[c]}12`:'rgba(0,0,0,0.03)',
                border:`1.5px solid ${cat===c?cc[c]+'44':T.border}`,
                color:cat===c?cc[c]:T.textS,transition:'all .15s',outline:'none'}}>{c}</button>
          ))}
        </div>
        <StarDivider my={4}/>
        <div style={{margin:'18px 0 14px'}}>
          <div style={{fontSize:13,color:T.textS,marginBottom:9,fontWeight:500}}>Mensagem</div>
          <textarea value={msg} onChange={e=>sm(e.target.value)}
            placeholder="Escreva aqui sua mensagem..."
            style={{width:'100%',minHeight:130,background:'rgba(0,0,0,0.02)',
              border:`1.5px solid ${T.border}`,borderRadius:11,padding:'14px',
              color:T.text,fontFamily:'var(--font-body)',fontSize:15,
              outline:'none',resize:'vertical',lineHeight:1.65,transition:'border-color .15s'}}
            onFocus={e=>e.target.style.borderColor=T.gold}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <Btn v="primary" full onClick={()=>msg&&ss(true)}
          style={{justifyContent:'center',padding:'13px',fontSize:15,borderRadius:11}}>
          Enviar Feedback
        </Btn>
      </Card>
    </div>
  );
};

const TabEventos = () => {
  const today=20;
  const tc={Feriado:T.blue,Confraternização:T.pink,Reunião:T.purple,Hoje:T.teal};
  const evDays=new Set(EVENTS.map(e=>e.day));
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Agenda corporativa de eventos">Eventos da Empresa</SHead>
      <div style={{display:'grid',gridTemplateColumns:'1fr 295px',gap:20}}>
        <div>
          <div style={{fontSize:12,color:T.textT,letterSpacing:'.07em',
            textTransform:'uppercase',marginBottom:14,fontWeight:500}}>MAIO 2026</div>
          {EVENTS.map((ev,i)=>(
            <div key={i} style={{display:'flex',alignItems:'stretch',marginBottom:12}}>
              <div style={{width:4,background:`linear-gradient(180deg,${ev.color},${ev.color}44)`,
                borderRadius:4,flexShrink:0,marginRight:14}}/>
              <Card style={{flex:1,padding:'15px 20px'}}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <div style={{width:52,textAlign:'center',flexShrink:0}}>
                    <div style={{fontSize:22,fontWeight:700,
                      color:ev.day===today?T.gold:T.text}}>{ev.day}</div>
                    <div style={{fontSize:10,color:T.textD,letterSpacing:'.06em'}}>MAI</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{marginBottom:6}}><Tag color={tc[ev.type]||T.blue}>{ev.type}</Tag></div>
                    <div style={{fontSize:15,fontWeight:500,color:T.text}}>{ev.label}</div>
                    <div style={{fontSize:12,color:T.textT,marginTop:2}}>◷ {ev.time}</div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
        <Card style={{padding:'22px',alignSelf:'start'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <button style={{background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:17,padding:4}}>‹</button>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:14,fontWeight:500,color:T.text}}>Maio 2026</span>
            </div>
            <button style={{background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:17,padding:4}}>›</button>
          </div>
          <StarDivider my={0}/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginTop:10,marginBottom:8}}>
            {['D','S','T','Q','Q','S','S'].map((d,i)=>(
              <div key={i} style={{textAlign:'center',fontSize:10.5,color:T.textD,
                fontWeight:500,padding:'2px 0'}}>{d}</div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
            {Array.from({length:4},(_,i)=><div key={`o${i}`}/>)}
            {Array.from({length:31},(_,i)=>{
              const d=i+1;const ev=evDays.has(d);const it=d===today;
              return(
                <div key={d} style={{textAlign:'center',padding:'6px 2px',borderRadius:7,
                  cursor:'pointer',position:'relative',
                  background:it?T.gold:ev?T.goldGl:'transparent',
                  color:it?'#fff':ev?T.gold:T.textS,
                  fontSize:12,fontWeight:it?600:400,transition:'background .12s'}}>
                  {d}
                  {ev&&!it&&<span style={{position:'absolute',bottom:1,left:'50%',
                    transform:'translateX(-50%)',width:3,height:3,borderRadius:'50%',
                    background:T.goldL,display:'block'}}/>}
                </div>
              );
            })}
          </div>
          <div style={{marginTop:12}}><StarDivider my={0}/></div>
          <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:7}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:10,height:10,borderRadius:2,background:T.gold}}/>
              <span style={{fontSize:12,color:T.textS}}>Hoje</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:10,height:10,borderRadius:2,background:T.goldGl,border:`1px solid ${T.goldL}44`}}/>
              <span style={{fontSize:12,color:T.textS}}>Com eventos</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const TabGames = () => {
  const g=[
    {icon:'◈',label:'Tetris', desc:'Clássico dos blocos',  c:T.blue,  tag:'Clássico'},
    {icon:'◉',label:'Snake',  desc:'A cobrinha famosa',    c:T.green, tag:'Arcade'},
    {icon:'◎',label:'Memória',desc:'Treine a mente',       c:T.purple,tag:'Casual'},
    {icon:'◇',label:'Quiz RH',desc:'Perguntas da empresa', c:T.gold,  tag:'Educativo'},
  ];
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Entretenimento corporativo">Games</SHead>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {g.map((gm,i)=>(
          <Card key={i} style={{padding:'28px'}} elevated>
            <div style={{position:'absolute',top:14,right:14}}>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',
              alignItems:'flex-start',marginBottom:16}}>
              <div style={{width:54,height:54,borderRadius:14,background:`${gm.c}10`,
                border:`1px solid ${gm.c}20`,display:'flex',alignItems:'center',
                justifyContent:'center',color:gm.c,fontSize:24}}>{gm.icon}</div>
              <Tag color={gm.c} style={{marginTop:2}}>{gm.tag}</Tag>
            </div>
            <div style={{fontSize:19,fontWeight:600,color:T.text,marginBottom:5}}>{gm.label}</div>
            <div style={{fontSize:14,color:T.textS,marginBottom:8,lineHeight:1.55}}>{gm.desc}</div>
            <StarDivider my={10} dim/>
            <Btn v="ghost" full style={{justifyContent:'center',color:gm.c,
              borderColor:`${gm.c}22`,background:`${gm.c}08`,fontSize:14}}>▶ Jogar</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
};

const TabConquistas = () => {
  const [s,ss]=useState('');
  const medals=['#1','#2','#3'];
  const mc=[T.gold,T.textT,T.goldL];
  const fl=RANK.filter(r=>r.name.toLowerCase().includes(s.toLowerCase()));
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Ranking de troféus da equipe">Conquistas</SHead>
      <Card style={{padding:'30px',marginBottom:20,
        background:`linear-gradient(160deg,rgba(212,168,75,0.07),${T.surface} 55%)`}} elevated>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <span style={{fontSize:20}}>👑</span>
            <span style={{fontSize:19,fontWeight:600,color:T.text}}>Top 3 Ranking</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{fontSize:14,color:T.textS}}>
              Sua posição: <strong style={{color:T.gold}}>#4</strong> · <span style={{color:T.gold}}>2 troféus</span>
            </div>
          </div>
        </div>
        <StarDivider my={14}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:22}}>
          {RANK.slice(0,3).map((r,i)=>(
            <div key={r.pos} style={{textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:12}}>{medals[i]}</div>
              <div style={{width:60,height:60,borderRadius:'50%',
                background:`linear-gradient(135deg,${r.c},${r.c}bb)`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:17,fontWeight:600,color:'#fff',margin:'0 auto 12px',
                border:`2px solid ${mc[i]}`,boxShadow:`0 4px 18px ${mc[i]}44`}}>{r.av}</div>
              <div style={{fontSize:14,fontWeight:500,color:T.text,marginBottom:5}}>{r.name}</div>
              <div style={{fontSize:17,fontWeight:700,color:mc[i]}}>★ {r.t}</div>
            </div>
          ))}
        </div>
      </Card>
      <input value={s} onChange={e=>ss(e.target.value)} placeholder="Buscar colaborador..."
        style={{width:'100%',background:T.surface,border:`1.5px solid ${T.border}`,
          borderRadius:11,padding:'11px 16px',color:T.text,
          fontFamily:'var(--font-body)',fontSize:14,outline:'none',marginBottom:16,
          boxShadow:T.sh}}
        onFocus={e=>e.target.style.borderColor=T.gold}
        onBlur={e=>e.target.style.borderColor=T.border}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13}}>
        {fl.map(r=>(
          <Card key={r.pos} style={{padding:'22px'}}>
            <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:12}}>
              <div style={{position:'relative'}}>
                <div style={{width:50,height:50,borderRadius:'50%',
                  background:`linear-gradient(135deg,${r.c},${r.c}bb)`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:15,fontWeight:600,color:'#fff'}}>{r.av}</div>
                <div style={{position:'absolute',top:-5,right:-5,width:21,height:21,
                  borderRadius:'50%',background:T.goldL,display:'flex',
                  alignItems:'center',justifyContent:'center',
                  fontSize:10,fontWeight:600,color:'#fff'}}>#{r.pos}</div>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:500,color:T.text}}>{r.name}</div>
                <div style={{fontSize:12,color:T.textT}}>{r.role}</div>
              </div>
            </div>
            <StarDivider my={6} dim/>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:10,marginBottom:14}}>
              <span style={{color:T.gold,fontSize:15}}>★</span>
              <span style={{fontSize:14,fontWeight:500,color:T.gold}}>
                {r.t} {r.t===1?'troféu':'troféus'}
              </span>
            </div>
            <Btn v="ghostGray" style={{padding:'7px 14px',fontSize:13}}>Ver Conquistas</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
};

const NEXUS_URL = 'https://dodoconexus.vercel.app/login';

const TabFeed = () => {
  const [full,setFull]=useState(false);
  return(
    <div style={{fontFamily:'var(--font-body)',height:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:600,color:T.text}}>Feed Nexus</div>
          <div style={{fontSize:14,color:T.textT,marginTop:2}}>Conecte-se com seus colegas</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <a href={NEXUS_URL} target="_blank" rel="noopener noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:6,
              padding:'7px 14px',borderRadius:9,
              background:T.surfaceSub||'rgba(0,0,0,0.04)',
              border:`1px solid ${T.border}`,color:T.textS,
              fontFamily:'var(--font-body)',fontSize:13,textDecoration:'none',transition:'all .15s'}}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8"/>
              <path d="M8 1h3v3M11 1L5.5 6.5"/>
            </svg>
            Acessar direto
          </a>
          <button onClick={()=>setFull(f=>!f)}
            style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',
              borderRadius:9,background:full?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.04)'),
              border:`1px solid ${full?T.goldLine+'55':T.border}`,
              color:full?T.gold:T.textS,fontFamily:'var(--font-body)',fontSize:13,
              cursor:'pointer',outline:'none',transition:'all .15s'}}>
            {full
              ?<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4.5 1v4H.5M8.5 1v4h4M4.5 12v-4H.5M8.5 12v-4h4"/></svg>
              :<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M.5 4.5V.5h4M8.5.5h4v4M12.5 8.5v4h-4M4.5 12.5H.5v-4"/></svg>}
            Tela Cheia
          </button>
        </div>
      </div>
      <div style={{
        position:full?'fixed':'relative',inset:full?0:'auto',zIndex:full?999:'auto',
        height:full?'100vh':'calc(100vh - 160px)',minHeight:500,
        borderRadius:full?0:16,overflow:'hidden',
        boxShadow:full?'none':T.shL,border:full?'none':`1px solid ${T.border}`,
      }}>
        <iframe src={NEXUS_URL} title="Nexus Feed"
          style={{width:'100%',height:'100%',border:'none',display:'block'}}
          allow="fullscreen; camera; microphone"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"/>
        {full&&(<button onClick={()=>setFull(false)}
          style={{position:'fixed',top:14,right:14,zIndex:1000,width:36,height:36,
            borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.55)',
            backdropFilter:'blur(8px)',color:'#fff',fontSize:17,cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',outline:'none'}}>✕</button>)}
      </div>
    </div>
  );
};

const SalaryChart = () => {
  const data=SALARY_HISTORY;
  const maxS=Math.max(...data.map(d=>d.salary));
  const minS=Math.min(...data.map(d=>d.salary));
  const W=540,H=160,padX=44,padY=22;
  const xStep=(W-padX*2)/(data.length-1);
  const yRange=maxS-minS||1;
  const pts=data.map((d,i)=>({x:padX+i*xStep,y:padY+(1-(d.salary-minS)/yRange)*(H-padY*2),...d}));
  const polyline=pts.map(p=>`${p.x},${p.y}`).join(' ');
  const area=`M${pts[0].x},${H-padY} `+pts.map(p=>`L${p.x},${p.y}`).join(' ')+` L${pts[pts.length-1].x},${H-padY} Z`;
  return(<div style={{overflowX:'auto'}}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block',overflow:'visible'}}>
      <defs><linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={T.gold} stopOpacity="0.22"/>
        <stop offset="100%" stopColor={T.gold} stopOpacity="0.02"/>
      </linearGradient></defs>
      {[0,0.25,0.5,0.75,1].map((f,i)=>{
        const y=padY+f*(H-padY*2);
        const val=Math.round(maxS-f*yRange);
        return(<g key={i}>
          <line x1={padX} y1={y} x2={W-padX} y2={y} stroke={T.divider} strokeWidth="1" strokeDasharray="4 4"/>
          <text x={padX-6} y={y+4} fontSize="9" fill={T.textD} textAnchor="end" fontFamily="var(--font-body)">
            {val>=1000?`${(val/1000).toFixed(1)}k`:val}
          </text>
        </g>);
      })}
      <path d={area} fill="url(#salGrad)"/>
      <polyline points={polyline} fill="none" stroke={T.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill={T.surface} stroke={T.gold} strokeWidth="2.5"/>
          <circle cx={p.x} cy={p.y} r="2.5" fill={T.gold}/>
          <text x={p.x} y={H-4} fontSize="9" fill={T.textT} textAnchor="middle" fontFamily="var(--font-body)">{p.date}</text>
          <text x={p.x} y={p.y-12} fontSize="9" fill={T.gold} fontWeight="600" textAnchor="middle" fontFamily="var(--font-body)">
            {p.salary>=1000?`R$${(p.salary/1000).toFixed(1)}k`:`R$${p.salary}`}
          </text>
          {p.pct&&<text x={p.x} y={p.y-22} fontSize="8" fill={T.green} textAnchor="middle" fontFamily="var(--font-body)">{p.pct}</text>}
        </g>
      ))}
    </svg>
  </div>);
};

/* ═══════════════════════════════════════════════════════════
   TAB COMUNICADOS
═══════════════════════════════════════════════════════════ */
const TabComunicados = () => {
  const [comuns,setComuns]=useState(COMUNICADOS_DATA);
  const [selected,setSelected]=useState(null);
  const unread=comuns.filter(c=>!c.read).length;
  const markRead=(id)=>setComuns(p=>p.map(c=>c.id===id?{...c,read:true}:c));
  const catColor={Política:T.purple||'#7060C8',RH:T.blue,Benefícios:T.green,Compliance:T.gold};
  if(selected){
    const c=comuns.find(x=>x.id===selected);
    return(<div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <button onClick={()=>setSelected(null)} style={{display:'flex',alignItems:'center',
        gap:6,background:'none',border:'none',cursor:'pointer',color:T.textS,
        fontSize:14,marginBottom:20,padding:0}}>← Voltar aos comunicados</button>
      <Card style={{padding:'28px'}} elevated>
        <div style={{flex:1,marginBottom:16}}>
          {c.urgent&&<div style={{display:'inline-flex',alignItems:'center',gap:5,
            background:T.dangerGl,border:`1px solid ${T.danger}33`,borderRadius:6,
            padding:'3px 10px',fontSize:11,color:T.danger,fontWeight:500,marginBottom:10}}>
            Urgente</div>}
          <div style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:6}}>{c.title}</div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <Tag color={catColor[c.cat]||T.gold}>{c.cat}</Tag>
            <span style={{fontSize:12,color:T.textT}}>Publicado em {c.date}</span>
          </div>
        </div>
        <StarDivider my={16}/>
        <div style={{fontSize:15,color:T.textS,lineHeight:1.8}}>{c.body}</div>
        <StarDivider my={20}/>
        <div style={{display:'flex',alignItems:'center',gap:10,background:T.greenGl,
          border:`1px solid ${T.green}22`,borderRadius:10,padding:'12px 16px'}}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill={T.green} opacity="0.15"/>
            <path d="M4.5 8L7 10.5L11.5 5.5" stroke={T.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontSize:13,color:T.green,fontWeight:500}}>Leitura confirmada — {c.date}</span>
        </div>
      </Card>
    </div>);
  }
  return(<div className="fi" style={{fontFamily:'var(--font-body)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
      <div>
        <div style={{fontSize:22,fontWeight:600,color:T.text}}>Comunicados</div>
        <div style={{fontSize:15,color:T.textT,marginTop:4}}>Avisos e informações oficiais do RH</div>
      </div>
      {unread>0&&<div style={{background:T.goldGl,border:`1px solid ${T.goldLine}44`,
        borderRadius:8,padding:'6px 14px',fontSize:13,color:T.gold,fontWeight:500}}>
        {unread} não {unread===1?'lido':'lidos'}</div>}
    </div>
    <StarDivider my={16}/>
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {comuns.map(c=>(
        <Card key={c.id} onClick={()=>{setSelected(c.id);markRead(c.id);}}
          style={{padding:'20px 22px',borderLeft:`3px solid ${c.urgent?T.danger:(catColor[c.cat]||T.gold)}`}}>
          <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                <Tag color={catColor[c.cat]||T.gold}>{c.cat}</Tag>
                {c.urgent&&<Tag color={T.danger}>Urgente</Tag>}
                {!c.read&&<div style={{width:7,height:7,borderRadius:'50%',background:T.gold,flexShrink:0}}/>}
              </div>
              <div style={{fontSize:15,fontWeight:c.read?400:600,color:T.text,marginBottom:5}}>{c.title}</div>
              <div style={{fontSize:13,color:T.textT}}>{c.date}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,color:T.textD,fontSize:13}}>
              {c.read
                ?<span style={{color:T.green,fontSize:12}}>Lido</span>
                :<span style={{color:T.textD,fontSize:12}}>Não lido</span>}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3.5L9 7L5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>);
};

/* ═══════════════════════════════════════════════════════════
   TAB SIMULADOR RH
═══════════════════════════════════════════════════════════ */
const TabSimulador = () => {
  const [tipo,setTipo]=useState('ferias');
  const [dataInicio,setDI]=useState('2022-02-01');
  const [dataSaida,setDS]=useState('2025-08-15');
  const [diasFerias,setDF]=useState(30);
  const calcular=()=>{
    const admissao=new Date(dataInicio);
    const saida=new Date(dataSaida);
    const meses=Math.floor((saida-admissao)/(1000*60*60*24*30.44));
    const sal=USER.salary;
    if(tipo==='ferias'){
      const vF=sal*(diasFerias/30), t=vF/3;
      return{items:[
        {label:`Férias (${diasFerias} dias)`,valor:vF,c:T.blue},
        {label:'1/3 Constitucional',valor:t,c:T.gold},
        {label:'Total Bruto',valor:vF+t,c:T.green,bold:true},
        {label:'INSS estimado',valor:-(vF+t)*0.11,c:T.danger},
        {label:'Valor Líquido estimado',valor:(vF+t)*0.89,c:T.green,bold:true},
      ]};
    }
    if(tipo==='decimoTerceiro'){
      const mesesAno=Math.min(saida.getMonth()+1,12);
      const prop=(sal/12)*mesesAno;
      return{items:[
        {label:`13º proporcional (${mesesAno}/12 meses)`,valor:prop,c:T.blue},
        {label:'1ª parcela (adiantamento Jun)',valor:prop*0.5,c:T.textT},
        {label:'2ª parcela (Dezembro)',valor:prop*0.5,c:T.green},
        {label:'INSS sobre 2ª parcela',valor:-prop*0.5*0.11,c:T.danger},
        {label:'Valor líquido 2ª parcela',valor:prop*0.5*0.89,c:T.green,bold:true},
      ]};
    }
    if(tipo==='rescisao'){
      const mp=meses%12;
      const saldo=sal*(saida.getDate()/30);
      const ferias=sal*(mp/12), terco=ferias/3;
      const dec=(sal/12)*mp;
      const fgts=sal*meses*0.08, multa=fgts*0.4;
      return{items:[
        {label:'Saldo de salário',valor:saldo,c:T.blue},
        {label:`Férias proporcionais (${mp} meses)`,valor:ferias,c:T.blue},
        {label:'1/3 sobre férias',valor:terco,c:T.gold},
        {label:`13º proporcional (${mp} meses)`,valor:dec,c:T.gold},
        {label:'Multa FGTS (40%)',valor:multa,c:T.green},
        {label:'Total Bruto da Rescisão',valor:saldo+ferias+terco+dec+multa,c:T.green,bold:true},
      ]};
    }
    return{items:[]};
  };
  const res=calcular();
  const fmt=(v)=>(v<0?'- ':'')+`R$ ${Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  const tipos=[
    {id:'ferias',label:'Simulação de Férias',iKey:'sun'},
    {id:'decimoTerceiro',label:'13º Salário',iKey:'gift'},
    {id:'rescisao',label:'Rescisão',iKey:'doc'},
  ];
  const TipoIcon=({iKey,active})=>{
    const props={width:16,height:16,viewBox:"0 0 24 24",fill:"none",
      stroke:active?T.gold:T.textD,strokeWidth:"1.7",strokeLinecap:"round",
      style:{flexShrink:0}};
    if(iKey==='sun')return(<svg {...props}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>);
    if(iKey==='gift')return(<svg {...props}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>);
    return(<svg {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>);
  };
  return(<div className="fi" style={{fontFamily:'var(--font-body)'}}>
    <SHead sub="Calcule valores de férias, 13º e rescisão">Simulação</SHead>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      <div>
        <Card style={{padding:'24px',marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:14}}>Tipo de simulação</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {tipos.map(t=>(
              <div key={t.id} onClick={()=>setTipo(t.id)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                  borderRadius:11,cursor:'pointer',
                  background:tipo===t.id?T.goldGl:'transparent',
                  border:`1.5px solid ${tipo===t.id?T.goldLine+'55':T.border}`,transition:'all .15s'}}>
                <TipoIcon iKey={t.iKey} active={tipo===t.id}/>
                <span style={{fontSize:14,fontWeight:tipo===t.id?500:400,
                  color:tipo===t.id?T.gold:T.text}}>{t.label}</span>
                {tipo===t.id&&<div style={{marginLeft:'auto',width:7,height:7,borderRadius:'50%',background:T.gold}}/>}
              </div>
            ))}
          </div>
        </Card>
        <Card style={{padding:'24px'}}>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:14}}>Dados para cálculo</div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,color:T.textS,marginBottom:6,fontWeight:500}}>Data de admissão</div>
            <input type="date" value={dataInicio} onChange={e=>setDI(e.target.value)}
              style={{width:'100%',background:T.surfaceSub||'rgba(0,0,0,0.025)',
                border:`1.5px solid ${T.border}`,borderRadius:9,padding:'10px 12px',
                color:T.text,fontFamily:'var(--font-body)',fontSize:14,outline:'none'}}
              onFocus={e=>e.target.style.borderColor=T.gold}
              onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,color:T.textS,marginBottom:6,fontWeight:500}}>
              {tipo==='rescisao'?'Data de saída':'Data de referência'}
            </div>
            <input type="date" value={dataSaida} onChange={e=>setDS(e.target.value)}
              style={{width:'100%',background:T.surfaceSub||'rgba(0,0,0,0.025)',
                border:`1.5px solid ${T.border}`,borderRadius:9,padding:'10px 12px',
                color:T.text,fontFamily:'var(--font-body)',fontSize:14,outline:'none'}}
              onFocus={e=>e.target.style.borderColor=T.gold}
              onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          {tipo==='ferias'&&(<div>
            <div style={{fontSize:13,color:T.textS,marginBottom:6,fontWeight:500}}>Dias de férias</div>
            <div style={{display:'flex',gap:8}}>
              {[10,15,20,30].map(d=>(
                <button key={d} onClick={()=>setDF(d)}
                  style={{flex:1,padding:'8px',borderRadius:8,cursor:'pointer',outline:'none',
                    fontFamily:'var(--font-body)',fontSize:13,fontWeight:500,
                    background:diasFerias===d?T.goldGl:'transparent',
                    border:`1.5px solid ${diasFerias===d?T.goldLine+'55':T.border}`,
                    color:diasFerias===d?T.gold:T.textS,transition:'all .15s'}}>{d}d</button>
              ))}
            </div>
          </div>)}
          <div style={{marginTop:14,padding:'10px 12px',background:T.blueGl,
            border:`1px solid ${T.blue}22`,borderRadius:9,fontSize:12,color:T.textS}}>
            Valores estimados. Consulte o RH para confirmação oficial.
          </div>
        </Card>
      </div>
      <div>
        <Card style={{padding:'24px',background:`linear-gradient(160deg,${T.goldGl},${T.surface} 60%)`}} elevated>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:5}}>Resultado estimado</div>
          <div style={{fontSize:13,color:T.textT,marginBottom:16}}>{tipos.find(t=>t.id===tipo)?.label}</div>
          <StarDivider my={0}/>
          <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:10}}>
            {res.items.map((item,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:item.bold?'14px 16px':'10px 14px',
                background:item.bold?`linear-gradient(135deg,${item.c},${item.c}bb)`:'transparent',
                borderRadius:item.bold?11:0,
                borderBottom:!item.bold?`1px solid ${T.divider}`:'none'}}>
                <span style={{fontSize:item.bold?14:13,color:item.bold?'#fff':T.textS,fontWeight:item.bold?500:400}}>{item.label}</span>
                <span style={{fontSize:item.bold?18:14,fontWeight:700,color:item.bold?'#fff':item.c}}>{fmt(item.valor)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </div>);
};

/* ═══════════════════════════════════════════════════════════
   DASHBOARD RH
═══════════════════════════════════════════════════════════ */
const DashboardRH = ({onBack}) => {
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('todos');
  const today=new Date();
  const thisMonth=today.getMonth();
  const filtered=TEAM_DATA.filter(c=>{
    const ms=c.name.toLowerCase().includes(search.toLowerCase())||c.role.toLowerCase().includes(search.toLowerCase());
    if(filter==='negativos')return ms&&c.status==='negative';
    if(filter==='aniversariantes'){const[d,m]=c.bday.split('/');return ms&&parseInt(m)-1===thisMonth;}
    return ms;
  });
  const totalPos=TEAM_DATA.filter(c=>c.hours>0).reduce((a,c)=>a+c.hours,0);
  const totalNeg=TEAM_DATA.filter(c=>c.hours<0).reduce((a,c)=>a+c.hours,0);
  const anivers=TEAM_DATA.filter(c=>{const[d,m]=c.bday.split('/');return parseInt(m)-1===thisMonth;});
  const KpiIcon=({type,color})=>{
    const p={width:18,height:18,viewBox:"0 0 24 24",fill:"none",stroke:color,strokeWidth:"1.7",strokeLinecap:"round"};
    if(type==='users')return(<svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>);
    if(type==='clock')return(<svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/><line x1="19" y1="5" x2="22" y2="5"/><line x1="22" y1="3" x2="22" y2="7"/></svg>);
    if(type==='alert')return(<svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
    return(<svg {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>);
  };
  return(<div style={{minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)'}}>
    <div style={{background:T.topbarBg,backdropFilter:'blur(12px)',
      borderBottom:`1px solid ${T.border}`,padding:'14px 32px',
      display:'flex',alignItems:'center',gap:16}}>
      <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',
        color:T.textS,fontSize:14,display:'flex',alignItems:'center',gap:6,fontFamily:'var(--font-body)'}}>
        ← Voltar</button>
      <div style={{width:1,height:18,background:T.divider}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:18,fontWeight:600,color:T.text}}>Dashboard RH</div>
        <div style={{fontSize:13,color:T.textT}}>Visão geral da equipe</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <Logo size={32}/>
        <div style={{fontFamily:'var(--font-brand)',fontSize:13,fontWeight:700,
          color:T.text,letterSpacing:'.05em'}}>CRESCENT HUB</div>
      </div>
    </div>
    <div style={{padding:'24px 32px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        {[
          {label:'Total de Colaboradores',val:TEAM_DATA.length,type:'users',c:T.blue},
          {label:'Banco de Horas Positivo',val:`+${totalPos}h`,type:'clock',c:T.green},
          {label:'Banco de Horas Negativo',val:`${totalNeg}h`,type:'alert',c:T.danger},
          {label:'Aniversariantes este mês',val:anivers.length,type:'gift',c:T.gold},
        ].map((k,i)=>(
          <Card key={i} style={{padding:'20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <KpiIcon type={k.type} color={k.c}/>
              <div style={{width:8,height:8,borderRadius:'50%',background:k.c}}/>
            </div>
            <div style={{fontSize:26,fontWeight:700,color:k.c,marginBottom:4}}>{k.val}</div>
            <div style={{fontSize:12,color:T.textT}}>{k.label}</div>
          </Card>
        ))}
      </div>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar colaborador ou cargo..."
          style={{flex:1,background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:10,
            padding:'10px 14px',color:T.text,fontFamily:'var(--font-body)',fontSize:14,outline:'none'}}
          onFocus={e=>e.target.style.borderColor=T.gold}
          onBlur={e=>e.target.style.borderColor=T.border}/>
        {['todos','negativos','aniversariantes'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'9px 14px',borderRadius:9,cursor:'pointer',outline:'none',
              fontFamily:'var(--font-body)',fontSize:13,fontWeight:500,
              background:filter===f?T.goldGl:'transparent',
              border:`1.5px solid ${filter===f?T.goldLine+'55':T.border}`,
              color:filter===f?T.gold:T.textS,transition:'all .15s'}}>
            {f==='todos'?'Todos':f==='negativos'?'Banco negativo':'Aniversariantes'}
          </button>
        ))}
      </div>
      <Card style={{overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1fr',
          padding:'12px 20px',background:T.surfaceSub||'rgba(0,0,0,0.025)',
          borderBottom:`1px solid ${T.border}`}}>
          {['Colaborador','Cargo','Banco Horas','Troféus','Salário','Aniversário'].map((h,i)=>(
            <div key={i} style={{fontSize:11,fontWeight:600,color:T.textD,
              letterSpacing:'.07em',textTransform:'uppercase'}}>{h}</div>
          ))}
        </div>
        {filtered.map((c,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1fr',
            padding:'14px 20px',alignItems:'center',
            borderBottom:`1px solid ${T.divider}`,
            background:c.status==='negative'?`${T.danger}06`:'transparent'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:36,height:36,borderRadius:'50%',
                background:`linear-gradient(135deg,${c.c},${c.c}bb)`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:12,fontWeight:600,color:'#fff',flexShrink:0}}>{c.av}</div>
              <div style={{fontSize:14,fontWeight:500,color:T.text}}>{c.name}</div>
            </div>
            <div style={{fontSize:13,color:T.textS}}>{c.role}</div>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:14,fontWeight:600,color:c.hours>0?T.green:c.hours<0?T.danger:T.textT}}>
                {c.hours>0?'+':''}{c.hours}h</span>
            </div>
            <div style={{fontSize:14,color:T.gold,fontWeight:500}}>★ {c.trophies}</div>
            <div style={{fontSize:13,color:T.textS}}>R$ {c.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:13,color:T.textS}}>{c.bday}</span>
              {parseInt(c.bday.split('/')[1])-1===thisMonth&&(
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={T.gold} strokeWidth="1.7" strokeLinecap="round">
                  <polyline points="20 12 20 22 4 22 4 12"/>
                  <rect x="2" y="7" width="20" height="5"/>
                  <line x1="12" y1="22" x2="12" y2="7"/>
                  <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
                  <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
                </svg>
              )}
            </div>
          </div>
        ))}
        {filtered.length===0&&<div style={{padding:'40px',textAlign:'center',color:T.textT,fontSize:14}}>
          Nenhum colaborador encontrado</div>}
      </Card>
    </div>
  </div>);
};


/* ── MODAL DE CONFIGURAÇÕES ── */
/* ═══════════════════════════════════════════════════════════
   MY DOKO — Pet virtual estilo Tamagotchi
═══════════════════════════════════════════════════════════ */
const DOKO_SKINS = [
  {id:'tecnico',    label:'Técnico',       img:dokoTecnico,    imgCansado:dokoTecnicoCansado,    color:'#2E8DD4'},
  {id:'cozinheiro', label:'Cozinheiro',    img:dokoCozinheiro, imgCansado:dokoCozinheiroCansado, color:'#E05030'},
  {id:'medico',     label:'Médico',        img:dokoMedico,     imgCansado:dokoMedicoCansado,     color:'#D03030'},
  {id:'ambiental',  label:'Ambientalista', img:dokoAmbiental,  imgCansado:dokoAmbientalCansado,  color:'#28A870'},
  {id:'contador',   label:'Contador',      img:dokoContador,   imgCansado:dokoContadorCansado,   color:'#1A7A50'},
];

const DOKO_PERSONALIDADES = {
  /* ─── TÉCNICO — foco em TI: internet, notebook, OneDrive, arquivos ─── */
  tecnico: {
    saudacao: ['Sistemas verificados! Tudo online?','Conexão estabelecida! Como está o seu notebook hoje?','Olá! OneDrive sincronizado?'],
    feed:     ['Energia recebida! Bateria do notebook também carregando?','Combustível aceito! Lembra de salvar o Excel antes de fechar!','Recarregado! Como está a velocidade da internet hoje?'],
    pet:      ['Carinho recebido! Melhor que reiniciar o roteador!','Ahh! Um ctrl+Z na vida real!','Isso sim resolve qualquer problema de conexão!'],
    feliz:    ['Internet estável, OneDrive sincronizado, tudo certo!','Status: verde em todos os sistemas!','Notebook funcionando perfeitamente hoje!'],
    neutro:   ['Hmm... latência alta. Preciso de atenção!','Sinal fraco por aqui. Me da uma força?','Disco quase cheio... falta espaço pra sorrir.'],
    triste:   ['Sem sinal! Estou desconectado!','404: atenção não encontrada!','OneDrive parou de sincronizar... e eu também.'],
    dicas: [
      'Salvou o Excel hoje? Ctrl+S a cada 5 minutos evita muito sofrimento!',
      'OneDrive sincronizando? Verifique o ícone na bandeja do sistema.',
      'Internet lenta? Tente reiniciar o roteador: 30 segundos desligado.',
      'Notebook aquecendo? Limpe a ventoinha e use em superfícies firmes.',
      'Backup em dia? Pelo menos uma cópia na nuvem e uma local.',
      'Feche abas desnecessárias do navegador. Cada aba consome RAM.',
      'Windows Update pendente? Atualize fora do horário de trabalho.',
      'Senha fraca é porta aberta. Use ao menos 12 caracteres misturados.',
      'Câmera ou microfone com problema? Verifique o Gerenciador de Dispositivos.',
      'Espaço em disco abaixo de 10%? Hora de limpar a lixeira e temporários.',
    ],
    conversa: [
      { pergunta: 'Como está a internet por aí hoje?',
        opcoes: [
          {t:'Voando! Sem problemas',   r:'Que alívio! Aproveite enquanto dura!',
            proximo:{pergunta:'Está usando o OneDrive para os seus arquivos?',opcoes:[
              {t:'Sim, tudo sincronizando!', r:'Perfeito! Seus arquivos estão seguros na nuvem. Continue assim!', proximo:null},
              {t:'Estava com problema',      r:'Tente desconectar e reconectar a conta do OneDrive nas configurações.', proximo:null},
              {t:'Não uso muito',            r:'Recomendo! É a melhor proteção contra perda de arquivos.', proximo:null},
            ]}},
          {t:'Instável, cai às vezes',  r:'Clássico! Tente reiniciar o roteador e verificar o cabo.',
            proximo:{pergunta:'Usa Wi-Fi ou cabo de rede?',opcoes:[
              {t:'Wi-Fi',  r:'Wi-Fi é prático mas cabo garante mais estabilidade. Vale o teste!', proximo:null},
              {t:'Cabo',   r:'Com cabo e ainda instável, o problema pode ser no provedor. Abra um chamado!', proximo:null},
              {t:'Ambos',  r:'No cabo e ainda cai? Provável falha no provedor ou no modem mesmo.', proximo:null},
            ]}},
          {t:'Sem internet hoje',        r:'Situação crítica! Reinicie o roteador, verifique o cabo e ligue para a operadora.',
            proximo:{pergunta:'Já tentou reiniciar o modem?',opcoes:[
              {t:'Sim, não resolveu',    r:'Então é com a operadora mesmo. Acione o suporte deles!', proximo:null},
              {t:'Ainda não',            r:'Desligue por 30 segundos e ligue novamente. Resolve 80% dos casos!', proximo:null},
            ]}},
          {t:'Melhorou hoje!',           r:'Que ótimo! Mudança de canal do Wi-Fi ou reinício resolveu?',
            proximo:{pergunta:'O que fez para melhorar?',opcoes:[
              {t:'Reiniciei o roteador',  r:'Clássico e eficiente! Guarda essa dica para sempre.', proximo:null},
              {t:'Mudei o canal do Wi-Fi',r:'Avançado! Canais menos congestionados fazem diferença.', proximo:null},
              {t:'Sozinho melhorou',      r:'Às vezes é só instabilidade do provedor mesmo. Bom que voltou!', proximo:null},
            ]}},
        ]},
      { pergunta: 'Como está o desempenho do seu notebook?',
        opcoes: [
          {t:'Rápido, sem reclamações!', r:'Que bom! Lembra de reiniciar pelo menos uma vez por semana.',
            proximo:{pergunta:'Quantas abas de navegador costuma ter abertas?',opcoes:[
              {t:'Menos de 10',   r:'Excelente disciplina! Seu notebook agradece.', proximo:null},
              {t:'De 10 a 20',    r:'Razoável, mas feche as que não usa. RAM é recurso precioso!', proximo:null},
              {t:'Mais de 20...',  r:'Isso explica qualquer lentidão! Feche umas abas agora!', proximo:null},
            ]}},
          {t:'Um pouco lento hoje',      r:'Verifique o gerenciador de tarefas. Algo pode estar consumindo CPU ou RAM.',
            proximo:{pergunta:'Quantos programas abertos ao mesmo tempo?',opcoes:[
              {t:'Poucos, abri agora',    r:'Pode ser atualização em segundo plano. Aguarde um pouco.', proximo:null},
              {t:'Muitos ao mesmo tempo', r:'Feche o que não usa! Menos programas = mais velocidade.', proximo:null},
              {t:'Reiniciando agora',     r:'Ótima ideia! Reiniciar limpa a memória. Bom caminho!', proximo:null},
            ]}},
          {t:'Travando bastante',         r:'Urgente! Verifique espaço em disco e memória RAM disponível.',
            proximo:{pergunta:'Há quanto tempo não reinicia o computador?',opcoes:[
              {t:'Reiniciei hoje',        r:'Hmm, então pode ser vírus ou disco com problema. Rode um antivírus!', proximo:null},
              {t:'Faz alguns dias',       r:'Reinicia agora! Acúmulo de processos em memória causa isso.', proximo:null},
              {t:'Faz semanas...',        r:'Semanas sem reiniciar! Isso é o problema. Reinicia agora!', proximo:null},
            ]}},
          {t:'Bateria acabando rápido',   r:'Verifique o estado da bateria em Configurações > Sistema.',
            proximo:{pergunta:'Com quantos % a bateria mostra "crítico"?',opcoes:[
              {t:'Abaixo de 20%',         r:'Normal. Mas se chega a 0% rápido demais, a bateria pode estar degradada.', proximo:null},
              {t:'Já começa fraca',       r:'Bateria velha ou configuração de energia muito agressiva. Ajuste o plano!', proximo:null},
              {t:'Sumiu de 100 pra 30%',  r:'Bateria com defeito. Verifique a garantia do equipamento!', proximo:null},
            ]}},
        ]},
      { pergunta: 'Seus arquivos estão salvos e seguros hoje?',
        opcoes: [
          {t:'Sim, tudo no OneDrive!',    r:'Perfeito! Arquivos na nuvem é segurança máxima.',
            proximo:{pergunta:'Última sincronização foi recente?',opcoes:[
              {t:'Sim, agora mesmo',       r:'Excelente! Pode trabalhar tranquilo!', proximo:null},
              {t:'Não sei verificar',      r:'Olha o ícone de nuvem na barra de tarefas. Verde = sincronizado!', proximo:null},
              {t:'Estava com erro',        r:'Clica com o botão direito no ícone do OneDrive e vê o que diz.', proximo:null},
            ]}},
          {t:'Salvei localmente só',       r:'Risco! Um defeito no HD e tudo se perde. Suba para a nuvem agora!',
            proximo:{pergunta:'Quer ajuda para configurar o OneDrive?',opcoes:[
              {t:'Sim, como faço?',         r:'Pesquisa "OneDrive configurar conta" no suporte Microsoft. É simples!', proximo:null},
              {t:'Já sei, só fui preguiçoso',r:'Rsrs! Vai lá fazer agora. Prevenção vale mais que recuperação!', proximo:null},
              {t:'Prefiro HD externo',      r:'HD externo é ótimo! Só não esqueça de conectar todo dia.', proximo:null},
            ]}},
          {t:'Esqueci de salvar o Excel!', r:'Ctrl+S agora! Corre! Depois ativa o salvamento automático nas opções!',
            proximo:{pergunta:'Já ativou o salvamento automático do Office?',opcoes:[
              {t:'Sim, já está ativo!',     r:'Ótimo! Mas Ctrl+S manual de vez em quando não faz mal.', proximo:null},
              {t:'Não sei onde fica',       r:'No Excel: Arquivo > Opções > Salvar > ativar "Salvar automaticamente"!', proximo:null},
              {t:'Vou ativar agora!',       r:'Excelente decisão! Isso vai te salvar de muita dor de cabeça!', proximo:null},
            ]}},
          {t:'Nem sei onde estão...',      r:'Situação crítica! Usa o Explorador de Arquivos e pesquisa por data de modificação.',
            proximo:{pergunta:'Os arquivos são de trabalho importantes?',opcoes:[
              {t:'Sim, muito importantes',  r:'Ativa o OneDrive agora e move tudo pra lá! Urgente!', proximo:null},
              {t:'São pessoais',            r:'Mesmo assim, organize uma pasta padrão. Facilita tudo!', proximo:null},
              {t:'Já achei, valeu!',        r:'Que alívio! Agora cria uma rotina de organização!', proximo:null},
            ]}},
        ]},
    ],
    conclusao:'Conversamos muito hoje! Você é incrível. Descanse e volte logo!',

    alertaFome:    'Processador em modo de alerta: preciso de combustível!',
    alertaEnergia: 'Bateria crítica! Preciso recarregar urgente!',
    alertaSono:    'Sistema operando há muito tempo... modo sleep necessário!',
    dormindo: ['Entrando em modo standby... zzz...','Desligando temporariamente...','Hibernando sistema...'],
    acordando: ['Boot completo! Pronto para o dia!','Sistemas reiniciados! Bom dia!','Acordado e atualizado!'],  },

  /* ─── COZINHEIRO ─── */
  cozinheiro: {
    saudacao: ['Que fome de te ver! Seja bem-vindo!','A cozinha está pronta, e você?','Que alegria! Vamos cozinhar um dia incrível!'],
    feed:     ['Delicioso! Adoro quando me alimentam!','Hmm, que sabor maravilhoso!','Obrigado! Tô cheinho de energia agora!'],
    pet:      ['Ahh, doce como um suspiro!','Que carinho quentinho!','Melhor do que chocolate quente!'],
    feliz:    ['Tudo temperado na medida certa!','O prato do dia está divino!'],
    neutro:   ['Hmm, faltou um tempero hoje...','O caldo está morno. Me anima!'],
    triste:   ['A panela está vazia e meu coração também!','Sem ingredientes... tô na saudade!'],
    dicas: [
      'Já tomou café da manhã? O dia começa melhor com energia de manhã!',
      'Frutas e oleaginosas são ótimas para manter o foco. Tente!',
      'Almoço é sagrado. Para tudo e vai comer com calma!',
      'Comida feita em casa tem mais amor e menos sódio!',
      'Um chá quente depois do almoço faz maravilhas para o sistema.',
      'Proteína no café da manhã reduz ansiedade ao longo do dia.',
      'Evite açúcar em excesso — energia rápida que cai igual torta.',
      'Beber água antes das refeições melhora a digestão.',
      'O intestino é o segundo cérebro. Cuide do que você coloca nele!',
    ],
    conversa: [
      { pergunta: 'Qual o sabor do seu dia hoje?',
        opcoes: [
          {t:'Delicioso! Mel e canela 🍯',  r:'Que receita perfeita! Continue assim!',
            proximo:{pergunta:'Você se alimentou bem hoje?',opcoes:[
              {t:'Sim, três refeições!',   r:'Perfeito! Corpo nutrido, mente afiada. Você sabe viver!', proximo:null},
              {t:'Almoço só',              r:'Adiciona um lanchinho da tarde. Sua energia vai agradecer!', proximo:null},
              {t:'Fui de delivery',        r:'Tudo bem! O importante é se nutrir. Tente cozinhar amanhã?', proximo:null},
            ]}},
          {t:'Temperado, mas saboroso',     r:'Um pouco picante é bom! Você arrasou!',
            proximo:{pergunta:'O que foi o ingrediente mais difícil hoje?',opcoes:[
              {t:'Uma tarefa complicada',   r:'Desafios dão sabor à vida. Você temperou bem!', proximo:null},
              {t:'Uma conversa difícil',    r:'Comunicação é uma receita com muitos ajustes. Parabéns pela coragem!', proximo:null},
              {t:'Falta de tempo',          r:'Preparo rápido também alimenta! Você fez o possível.', proximo:null},
            ]}},
          {t:'Sem sal, meio sem graça',     r:'Vamos temperar esse dia! Amanhã começa nova receita.',
            proximo:{pergunta:'O que falta para melhorar o sabor?',opcoes:[
              {t:'Uma pausa para respirar', r:'Isso! Descanso é o fermento da vida. Imprescindível!', proximo:null},
              {t:'Uma conversa boa',        r:'Boa companhia é o melhor tempero. Chame alguém!', proximo:null},
              {t:'Só passa o dia',          r:'Às vezes a receita demora. Confie no processo!', proximo:null},
            ]}},
          {t:'Amargo, foi muito difícil',   r:'Até o café amargo tem seu charme. Vai passar!',
            proximo:{pergunta:'Quer um ingrediente secreto para melhorar?',opcoes:[
              {t:'Sim! Qual é?',            r:'Uma coisa que você gosta antes de dormir. Recompensa é essencial!', proximo:null},
              {t:'Preciso descansar',       r:'Sábio! Repouso é parte da receita. Dorme bem!', proximo:null},
              {t:'Só quero que acabe',      r:'Coragem! Todo prato difícil vira experiência de chef.', proximo:null},
            ]}},
        ]},
    ],
    conclusao:'Sessão encerrada! Você foi muito bem. Cuide-se e até a próxima consulta!',

    alertaFome:    'Minha barriga está roncando na cozinha!',
    alertaEnergia: 'O fogão apagou... sem energia aqui!',
    alertaSono:    'Os olhos estão fechando sozinhos...',
    dormindo: ['Hora de descansar o fogão e eu também... zzz...','Guardando o avental. Boa noite!','Sonhos deliciosos chegando...'],
    acordando: ['Bom dia! Já pensei no cardápio de hoje!','Acordei com fome de viver!','Pronto para uma nova receita!'],  },

  /* ─── MÉDICO ─── */
  medico: {
    saudacao: ['Consulta iniciada! Como posso ajudar?','Dr. Doko à disposição! Tudo bem?','Diagnóstico do dia: você chegou! Que ótimo!'],
    feed:     ['Prescrição de comida aceita!','Nutrientes recebidos! Saúde em dia!','Dose diária de energia administrada!'],
    pet:      ['Terapia de carinho aplicada com sucesso!','Oxitocina liberada! Que bom!','Tratamento afetivo em andamento!'],
    feliz:    ['Todos os indicadores vitais ótimos!','Check-up perfeito hoje!'],
    neutro:   ['Alguns sintomas de cansaço detectados...','Precisando de atenção médica — a minha!'],
    triste:   ['Situação crítica! Preciso de socorro!','Baixo nível de energia detectado!'],
    dicas: [
      'Dormiu menos de 7 horas? Seu sistema imunológico fica comprometido.',
      'Saúde mental importa tanto quanto física. Como está sua cabeça hoje?',
      'Faça pelo menos 30 min de caminhada hoje. Prescrição médica!',
      'Tela antes de dormir atrapalha o sono. Desligue 30 min antes.',
      'Já fez seu exame anual? Prevenção é o melhor remédio.',
      'Ansiedade alta? Respire: 4s inhale, 7s segure, 8s expire.',
      'Hidrate-se! 35ml de água por kg corporal por dia é o mínimo.',
      'Exercício físico libera endorfina — o antidepressivo natural gratuito.',
      'Dor nas costas? Se você fica muito tempo sentado, levante-se agora.',
      'Uma alimentação colorida garante variedade de nutrientes!',
    ],
    conversa: [
      { pergunta: 'Como está sua saúde mental hoje?',
        opcoes: [
          {t:'Excelente, me sinto leve!',    r:'Diagnóstico: saudável! Continue assim!',
            proximo:{pergunta:'Está praticando alguma atividade física?',opcoes:[
              {t:'Sim, regularmente!',        r:'Perfeito! Exercício é o melhor remédio preventivo. Parabéns!', proximo:null},
              {t:'De vez em quando',          r:'Tente tornar regular! Até 20 min por dia já faz diferença.', proximo:null},
              {t:'Não pratico',               r:'Prescrevo: comece com uma caminhada de 15 min amanhã!', proximo:null},
            ]}},
          {t:'Bem, só um pouco cansado',     r:'Normal! O corpo pede descanso às vezes.',
            proximo:{pergunta:'Dormiu quantas horas esta semana?',opcoes:[
              {t:'7 a 9 horas por noite',     r:'Sono ideal! Continue essa rotina saudável.', proximo:null},
              {t:'Entre 5 e 7 horas',         r:'Limite aceitável, mas tente melhorar. Durma 30 min antes.', proximo:null},
              {t:'Menos de 5 horas',          r:'Alerta médico! Privação de sono prejudica tudo. Priorize dormir!', proximo:null},
            ]}},
          {t:'Estressado, muita pressão',    r:'Sinto muito. Tente respirar fundo 3x agora.',
            proximo:{pergunta:'Identificou a causa do estresse?',opcoes:[
              {t:'Trabalho em excesso',        r:'Defina horário de desligar. Limites são saudáveis!', proximo:null},
              {t:'Problemas pessoais',         r:'Cuide disso com atenção. Considere conversar com alguém de confiança.', proximo:null},
              {t:'Não sei identificar',        r:'Vale um diário de emoções. Ajuda a mapear o que te afeta.', proximo:null},
            ]}},
          {t:'Ansioso com tudo',             r:'Você não está sozinho. Um passo de cada vez!',
            proximo:{pergunta:'Você tem uma rotina noturna para relaxar?',opcoes:[
              {t:'Sim, funciona bem!',         r:'Ótimo! Rotinas são âncoras para o sistema nervoso.', proximo:null},
              {t:'Não tenho nenhuma',          r:'Experimente: banho morno, sem tela, leitura leve. Simples e eficaz!', proximo:null},
              {t:'Tento mas não consigo',      r:'Meditação guiada pode ajudar. 5 minutinhos antes de dormir!', proximo:null},
            ]}},
        ]},
      { pergunta: 'Cuidou bem de você hoje?',
        opcoes: [
          {t:'Sim! Água, comida e pausa',    r:'Paciente exemplar! Esse é o tratamento certo.',
            proximo:{pergunta:'Tem feito check-ups médicos regularmente?',opcoes:[
              {t:'Sim, estou em dia!',         r:'Prevenção é o melhor remédio. Continue assim!', proximo:null},
              {t:'Faz tempo que não vou',      r:'Marque uma consulta esta semana! Exames de rotina salvam vidas.', proximo:null},
              {t:'Tenho medo de ir ao médico', r:'Entendo. Mas o medo de saber é menor que o custo de não saber!', proximo:null},
            ]}},
          {t:'Mais ou menos, fui descuidado', r:'Reconhecer é o primeiro passo! Hidrate-se agora.',
            proximo:{pergunta:'O que negligenciou hoje?',opcoes:[
              {t:'Esqueci de comer direito',   r:'Alimentação é base! Corrija agora e planeje amanhã melhor.', proximo:null},
              {t:'Fiquei sem água',            r:'Beba um copo agora! Desidratação leve já reduz o foco em 20%.', proximo:null},
              {t:'Não descansei nada',         r:'Micro pausas de 5 min a cada hora fazem diferença enorme!', proximo:null},
            ]}},
          {t:'Honestamente, não muito',       r:'Cuide-se! Você não pode ajudar ninguém no limite.',
            proximo:{pergunta:'Qual é a principal dificuldade?',opcoes:[
              {t:'Falta de tempo',             r:'Autocuidado de 15 min vale mais que nada. Priorize!', proximo:null},
              {t:'Sempre coloco os outros na frente',r:'Nobre, mas insustentável. Cuide de você para cuidar melhor deles!', proximo:null},
              {t:'Não sei por onde começar',   r:'Comece pela água: beba um copo agora. Depois veja o próximo passo.', proximo:null},
            ]}},
        ]},
    ],
    conclusao:'Ciclo de perguntas completo. Você demonstrou consciência. Até o próximo ciclo.',

    alertaFome:    'Hipoglicemia detectada! Preciso me alimentar!',
    alertaEnergia: 'Sinais vitais de energia em queda!',
    alertaSono:    'Privação de sono detectada! Hora de descansar!',
    dormindo: ['Encerrando plantão... boa noite...','Prescrevo uma boa noite de sono para nós dois!','Descanso médico iniciado...'],
    acordando: ['Plantão reiniciado! Bom dia!','Sinais vitais normalizados após o sono!','Descansado e pronto para cuidar!'],  },

  /* ─── AMBIENTALISTA ─── */
  ambiental: {
    saudacao: ['...Você chegou. Bom.','O ecossistema precisa de equilíbrio. E você?','Hmm. Mais um humano. Espero que traga boas energias.'],
    feed:     ['...Aceitável. Obrigado.','Combustível renovável recebido.','A natureza provê. E você também. Grato.'],
    pet:      ['...Isso. Equilíbrio restaurado.','Energia positiva transferida. Bem melhor.','Hmm. Tá bom, adorei. Pode continuar.'],
    feliz:    ['Ecossistema em equilíbrio. Satisfatório.','A floresta está em paz. Eu também.'],
    neutro:   ['Hmm. Poderia estar melhor. Assim como o planeta.','Recursos energéticos em queda...'],
    triste:   ['Desequilíbrio total. Emergência ambiental aqui!','Seco. Vazio. Como um deserto.'],
    dicas: [
      'Uma caminhada ao ar livre hoje. Reconectar com a natureza não é luxo.',
      'Você desligou aparelhos em standby? Cada watt conta.',
      'Respira fundo. O ar ainda é de graça. Aproveite.',
      'Quanto tempo de tela hoje? A natureza não tem notificações.',
      'Plante algo, mesmo que seja no vaso. Vida chama vida.',
      'Reduza o desperdício de comida hoje. É ético e sábio.',
      'Uma hora longe do celular por dia. O mundo não vai acabar — talvez melhore.',
      'Seu ritmo circadiano agradece quando você dorme e acorda no mesmo horário.',
      'Gratidão pelo que já tem. É o consumo mais sustentável que existe.',
    ],
    conversa: [
      { pergunta: 'Como foi o impacto do seu dia?',
        opcoes: [
          {t:'Sustentável! Aproveitei bem',    r:'Hmm. Impacto positivo. Isso é raro. Parabéns.',
            proximo:{pergunta:'Fez algo pelo meio ambiente hoje?',opcoes:[
              {t:'Reduzi o consumo de plástico', r:'Bom. Cada peça de plástico evitada importa. Continue.', proximo:null},
              {t:'Economizei água e energia',     r:'Excelente gestão de recursos. O planeta notou.', proximo:null},
              {t:'Só vivi conscientemente',       r:'...Já é mais do que a maioria. Respeito.', proximo:null},
            ]}},
          {t:'Reciclando energias, devagar',   r:'Conservação é sábia. Continue nesse ritmo.',
            proximo:{pergunta:'O que está pesando em você?',opcoes:[
              {t:'Trabalho acumulado',            r:'Trabalho não some. Mas você pode precisar de uma pausa na floresta.', proximo:null},
              {t:'Notícias ruins do mundo',       r:'...O mundo tem problemas. Mas você está aqui, agindo. Isso conta.', proximo:null},
              {t:'Cansaço geral',                 r:'Até os rios precisam de estação seca. Descanse sem culpa.', proximo:null},
            ]}},
          {t:'Consumindo muita energia...',    r:'Atenção. Todo recurso tem limite. Cuide-se.',
            proximo:{pergunta:'Consegue identificar o maior gasto de energia?',opcoes:[
              {t:'Reuniões e pessoas difíceis',   r:'Relações são ecossistemas. Algumas drenam, outras nutrem.', proximo:null},
              {t:'Preocupações que não controlo', r:'Foca no que está no seu raio de ação. O resto, deixa fluir.', proximo:null},
              {t:'Estou sobrecarregado mesmo',    r:'Desligamento preventivo necessário. Priorize agora.', proximo:null},
            ]}},
          {t:'Esgotei tudo hoje',              r:'...Precisa de reflorestamento urgente. Descanse.',
            proximo:{pergunta:'Quando foi a última vez que fez algo só para você?',opcoes:[
              {t:'Hoje mesmo!',                   r:'Ótimo. Continue assim. Autocuidado é sustentabilidade humana.', proximo:null},
              {t:'Faz alguns dias',               r:'Já passou da hora. Amanhã coloca algo no calendário.', proximo:null},
              {t:'Não me lembro...',              r:'...Isso é preocupante. Você importa tanto quanto qualquer causa.', proximo:null},
            ]}},
        ]},
    ],
  },

  /* ─── CONTADOR — foco em finanças, IR, contabilidade ─── */
  contador: {
    saudacao: ['Planilhas abertas! Vamos calcular?','Contador Doko em campo! Lançamentos em dia?','Balanço iniciando! Como posso ajudar?'],
    feed:     ['Receita contabilizada no ativo!','Entrada lançada! Saldo positivo!','Combustível registrado. Dedutível, claro!'],
    pet:      ['Carinho lançado como receita extraordinária!','Isso é um ativo não-monetário valioso!','Balanço emocional: positivo!'],
    feliz:    ['Todos os lançamentos conferindo!','Balanço equilibrado hoje!','Fechamento sem pendências!'],
    neutro:   ['Hmm, alguns lançamentos pendentes...','Preciso fechar o mês. Me ajuda?','Divergência encontrada... precisando de atenção.'],
    triste:   ['Saldo zerado! Precisando de reforço!','Balanço negativo aqui!','Deficit emocional detectado!'],
    dicas: [
      'Valor bruto é o total antes dos descontos. Líquido é o que você recebe de fato.',
      'IR 2024: isenção para rendimentos até R$ 2.824,00/mês.',
      'Taxa administrativa é o custo de gestão de um serviço — não é imposto!',
      'Ressarcimento: reembolso de despesa que você pagou por outra pessoa.',
      'Devolução: retorno de valor pago indevidamente. São conceitos diferentes!',
      'Valor de repasse = bruto menos taxas e deduções. É o que chega ao destinatário.',
      'INSS varia de 7,5% a 14% conforme a faixa salarial. Verifique a sua!',
      'Guarde recibos de despesas dedutíveis no IR: saúde, educação, previdência.',
      'Alíquota máxima do IR pessoa física: 27,5% acima de R$ 4.664,68/mês.',
      'Para calcular 15%: divida o valor por 10 e some a metade. Ex: 3.200 ÷ 10 = 320, + 160 = 480.',
    ],
    conversa: [
      { pergunta: 'O que é Valor Bruto?',
        opcoes: [
          {t:'O total antes de qualquer desconto',   r:'Exato! Bruto é o valor completo antes de impostos, taxas ou deduções.',
            proximo:{pergunta:'E o Valor Líquido é:',opcoes:[
              {t:'O valor após todos os descontos',  r:'Perfeito! Líquido = bruto − todos os descontos. É o que entra na conta!', proximo:null},
              {t:'O valor do produto sem IPI',       r:'Não exatamente. Líquido abrange TODOS os descontos, não só o IPI.', proximo:null},
              {t:'O mesmo que valor de mercado',     r:'Não! Líquido é o bruto menos os descontos aplicados. É o valor final recebido.', proximo:null},
            ]}},
          {t:'O valor após os impostos',             r:'Esse seria o Líquido! Bruto é o total ANTES de qualquer desconto.',proximo:null},
          {t:'O valor do lucro',                     r:'Não confunda! Bruto é o faturado antes dos descontos. Lucro é outra conta.',proximo:null},
          {t:'Não tenho certeza',                    r:'Bruto = total sem nenhum desconto aplicado. Anota aí!',proximo:null},
        ]},
      { pergunta: 'Sobre IR: qual faixa está isenta em 2024?',
        opcoes: [
          {t:'Até R$ 2.824,00/mês',                 r:'Correto! Rendimentos até R$ 2.824,00/mês são isentos na tabela progressiva.',
            proximo:{pergunta:'A alíquota máxima do IR pessoa física é:',opcoes:[
              {t:'27,5%',                            r:'Isso! 27,5% para rendimentos acima de R$ 4.664,68/mês. Guarda esse número!', proximo:null},
              {t:'35%',                              r:'No Brasil o teto é 27,5%, não 35%. Atenção na declaração!', proximo:null},
              {t:'15%',                              r:'15% é intermediário. O teto máximo do IR pessoa física é 27,5%.', proximo:null},
            ]}},
          {t:'Até R$ 1.500,00/mês',                 r:'Não! A faixa de isenção em 2024 é até R$ 2.824,00/mês.',proximo:null},
          {t:'Até R$ 3.500,00/mês',                 r:'Não chegamos lá ainda! A isenção é até R$ 2.824,00. Acima disso incide IR.',proximo:null},
          {t:'Não há faixa isenta',                  r:'Há sim! Rendimentos mensais até R$ 2.824,00 são isentos de IR.',proximo:null},
        ]},
      { pergunta: 'O que é Taxa Administrativa?',
        opcoes: [
          {t:'Custo pela gestão de um serviço ou fundo', r:'Correto! É o valor cobrado por administrar, operar ou gerenciar algo.',
            proximo:{pergunta:'E o Valor de Repasse é:',opcoes:[
              {t:'O valor transferido após as deduções', r:'Exato! Repasse = bruto − taxas e deduções. É o que chega ao destinatário final.', proximo:null},
              {t:'O total bruto da operação',            r:'Não! O bruto é antes. Repasse é o que sobra depois das deduções.', proximo:null},
              {t:'A multa contratual',                   r:'Diferente! Multa é penalidade por descumprimento. Repasse é o valor transferido após descontos.', proximo:null},
            ]}},
          {t:'Um imposto federal',                   r:'Não é imposto! Taxa administrativa é cobrada pelo prestador do serviço.',proximo:null},
          {t:'Multa por atraso',                     r:'São coisas diferentes! Multa é por descumprimento. Taxa administrativa é pelo serviço de gestão.',proximo:null},
          {t:'Não sei',                               r:'Taxa administrativa = valor cobrado pela gestão de um serviço ou contrato. Não é tributo!',proximo:null},
        ]},
      { pergunta: 'Qual a diferença entre Devolução e Ressarcimento?',
        opcoes: [
          {t:'Devolução: pagamento indevido. Ressarcimento: reembolso de terceiro', r:'Perfeito! Devolução retorna o que foi pago errado. Ressarcimento reembolsa quem pagou por você.',
            proximo:{pergunta:'Exemplo: você pagou uma conta da empresa do próprio bolso. A empresa te paga de volta. Isso é:',opcoes:[
              {t:'Ressarcimento',                    r:'Correto! Você pagou por terceiro (empresa) e foi reembolsado. Isso é ressarcimento!', proximo:null},
              {t:'Devolução',                        r:'Não! Devolução é retorno de pagamento indevido. Aqui você pagou algo da empresa e foi reembolsado — ressarcimento.', proximo:null},
              {t:'Desconto',                         r:'Não! Desconto é redução no preço. Você foi reembolsado por pagar algo da empresa — isso é ressarcimento.', proximo:null},
            ]}},
          {t:'São a mesma coisa',                    r:'Não são! Devolução = pagamento indevido devolvido. Ressarcimento = reembolso por despesa de terceiro.',proximo:null},
          {t:'Devolução é mais formal',              r:'Não é questão de formalidade! São situações distintas com tratamentos contábeis diferentes.',proximo:null},
          {t:'Não sei a diferença',                  r:'Devolução: pagou errado, devolvem. Ressarcimento: pagou por outra pessoa, te reembolsam. Anota!',proximo:null},
        ]},
      { pergunta: 'Cálculo rápido! Quanto é 15% de R$ 3.200,00?',
        opcoes: [
          {t:'R$ 480,00',                            r:'Correto! 3.200 × 0,15 = 480. Raciocínio financeiro afiado!',
            proximo:{pergunta:'Ótimo! Agora: quanto é 27,5% de R$ 5.000,00?',opcoes:[
              {t:'R$ 1.375,00',                      r:'Perfeito! 5.000 × 0,275 = 1.375. Você entende de alíquotas!', proximo:null},
              {t:'R$ 1.500,00',                      r:'Errou! 5.000 × 0,275 = 1.375. Atenção na vírgula da alíquota!', proximo:null},
              {t:'R$ 1.250,00',                      r:'Errou! Esse seria 25%. Para 27,5%: 5.000 × 0,275 = R$ 1.375,00.', proximo:null},
            ]}},
          {t:'R$ 320,00',                            r:'Errou! Isso seria 10%. Para 15%: 3.200 × 0,15 = R$ 480,00.',proximo:null},
          {t:'R$ 640,00',                            r:'Errou! Isso seria 20%. Para 15%: 3.200 × 0,15 = R$ 480,00.',proximo:null},
          {t:'R$ 560,00',                            r:'Errou! Para 15%: divida por 10 (= 320) e some a metade (+ 160) = R$ 480,00.',proximo:null},
        ]},
      /* ── Controle financeiro pessoal ── */
      { pergunta: 'Você tem uma reserva de emergência?',
        opcoes: [
          {t:'Sim, 3 a 6 meses de gastos!',   r:'Excelente! O padrão ideal. Agora foque em fazer o excedente trabalhar por você!',
            proximo:{pergunta:'Onde você guarda essa reserva?',opcoes:[
              {t:'CDB ou Tesouro Selic',        r:'Ótima escolha! Liquidez diária + rendimento acima da poupança. Perfeito!', proximo:null},
              {t:'Poupança',                    r:'Segura, mas rende abaixo da inflação. Considere migrar para Tesouro Selic.', proximo:null},
              {t:'Conta corrente',              r:'Risco! Dinheiro parado perde valor. Mova para investimento de liquidez diária!', proximo:null},
            ]}},
          {t:'Estou construindo ainda',         r:'Ótimo caminho! Meta: 3 meses de gastos primeiro. Automatize a transferência!',proximo:null},
          {t:'Não tenho reserva',               r:'Urgente! Sem reserva, qualquer imprevisto vira dívida. Comece com R$ 50/mês!',proximo:null},
          {t:'O que é reserva de emergência?',  r:'É 3 a 6 meses de gastos mensais guardados em investimento de liquidez imediata.',proximo:null},
        ]},
      { pergunta: 'Você conhece a regra 50-30-20?',
        opcoes: [
          {t:'Sim: 50% necessidades, 30% desejos, 20% investimentos',r:'Perfeito! Essa distribuição é o equilíbrio financeiro ideal.',
            proximo:{pergunta:'Você consegue aplicar essa regra?',opcoes:[
              {t:'Aplico e funciona bem!',      r:'Você está à frente da maioria! Agora pense em aumentar o % de investimento.', proximo:null},
              {t:'Tento mas é difícil',         r:'Registre todos os gastos por 30 dias primeiro. O diagnóstico vem sozinho.', proximo:null},
              {t:'Meus fixos passam de 50%',    r:'Revise contratos, planos e assinaturas. Sempre há espaço para cortar!', proximo:null},
            ]}},
          {t:'Nunca ouvi falar',                r:'Anota! 50% para necessidades, 30% para desejos, 20% para guardar e investir.',proximo:null},
          {t:'Conheço mas não pratico',         r:'O primeiro passo: registrar seus gastos atuais para ver onde está o desvio.',proximo:null},
          {t:'Uso uma regra diferente',         r:'Qualquer metodologia funciona se você seguir com consistência!',proximo:null},
        ]},
      { pergunta: 'Como você lida com cartão de crédito?',
        opcoes: [
          {t:'Pago a fatura total todo mês',   r:'Disciplina financeira exemplar! Cartão como aliado, não inimigo.',
            proximo:{pergunta:'Você aproveita cashback ou milhas?',opcoes:[
              {t:'Sim, de forma estratégica!',  r:'Inteligência financeira de alto nível! Benefícios sem juros = ganho puro.', proximo:null},
              {t:'Não uso esses benefícios',    r:'Vale pesquisar! Muitos cartões oferecem cashback sem anuidade.', proximo:null},
              {t:'Não sabia que existia',       r:'Pesquise cartões com cashback ou milhas. Pode render bons benefícios!', proximo:null},
            ]}},
          {t:'Às vezes pago só o mínimo',      r:'Cuidado! O rotativo do cartão pode chegar a 400% ao ano. Quite o quanto antes!',proximo:null},
          {t:'Estou com dívida no cartão',     r:'Prioridade máxima! Juros de cartão são os maiores do mercado. Negocie agora.',proximo:null},
          {t:'Prefiro não usar cartão',        r:'Postura conservadora válida! Com controle, o cartão pode trazer benefícios.',proximo:null},
        ]},
    ],
    conclusao:'Relatório financeiro do dia: aprovado! Você finalizou todas as perguntas. Até mais tarde!',

    alertaFome:    'Reserva de calorias abaixo do mínimo!',
    alertaEnergia: 'Déficit energético crítico detectado!',
    alertaSono:    'Horas de sono: abaixo do ideal. Requer correção!',
    alertaFome:    '...Recursos alimentares se esgotando.',
    alertaEnergia: 'Energia vital em declínio. Intervenção necessária.',
    alertaSono:    'O ciclo circadiano exige repouso agora.',
    dormindo: ['...O ciclo noturno começa. Silêncio.','Reintegração ao ritmo circadiano. Boa noite.','Conservando energia para amanhã.'],
    acordando: ['Novo ciclo iniciado. Bom dia.','O sol voltou. E eu também.','Renovado como a natureza pela manhã.'],  },
};

const COMIDAS = [
  /* Saudáveis */
  {id:'sushi',    nome:'Sushi',               cat:'proteina', saudavel:true,  fome:25, energia:12,
   r:'Sushi! Proteína nobre e leveza. Escolha de qualidade!'},
  {id:'acai',     nome:'Açaí Vitaminado',      cat:'fruta',    saudavel:true,  fome:20, energia:22,
   r:'Açaí com granola! Antioxidantes, energia e sabor. Perfeito!'},
  {id:'salada',   nome:'Salada de Frutas',     cat:'fruta',    saudavel:true,  fome:18, energia:16,
   r:'Vitaminas e cores! Cada fruta uma nutrição diferente. Amei!'},
  {id:'granola',  nome:'Granola com Iogurte',  cat:'cereal',   saudavel:true,  fome:22, energia:20,
   r:'Fibras, probióticos e proteínas! Isso é cuidar do corpo!'},
  {id:'frango',   nome:'Frango Grelhado',      cat:'proteina', saudavel:true,  fome:28, energia:18,
   r:'Proteína magra! Combustível real para o dia. Muito bom!'},
  {id:'vitamina', nome:'Vitamina Verde',       cat:'bebida',   saudavel:true,  fome:16, energia:28,
   r:'Verde de energia! Espinafre, banana e limão. Pura vitalidade!'},
  {id:'arroz',    nome:'Arroz, Feijão e Ovo',  cat:'refeicao', saudavel:true,  fome:32, energia:22,
   r:'O trio sagrado! Completo e nutritivo. Comida de verdade!'},
  {id:'abacate',  nome:'Torrada com Abacate',  cat:'cereal',   saudavel:true,  fome:18, energia:20,
   r:'Gordura boa e fibras! Escolha inteligente e gostosa!'},
  /* Especiais (não tão saudáveis) */
  {id:'carne',    nome:'Carne & Batata Frita', cat:'indulg',   saudavel:false, fome:36, energia:6,
   r:'Que festa! Aproveite, mas não todo dia, combinado?'},
  {id:'bolo',     nome:'Bolo de Chocolate',   cat:'indulg',   saudavel:false, fome:30, energia:-5,
   r:'CHOCOLATE! Que delícia! Fica entre nós, né?'},
  {id:'pizza',    nome:'Pizza',               cat:'indulg',   saudavel:false, fome:33, energia:8,
   r:'PIZZA! Hoje é dia de celebração! Que alegria!'},
  {id:'sorvete',  nome:'Sorvete',             cat:'indulg',   saudavel:false, fome:20, energia:-3,
   r:'Gelado e reconfortante! Às vezes a alma precisa disso!'},
];

const COMIDA_ICONS = {
  proteina: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
    <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/>
    <line x1="14" y1="1" x2="14" y2="4"/>
  </svg>,
  fruta: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>,
  cereal: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
  </svg>,
  bebida: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>,
  refeicao: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><line x1="7" y1="2" x2="7" y2="11"/>
    <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
  </svg>,
  indulg: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>
  </svg>,
};

/* Cenários minimalistas — itens orgânicos e aleatórios ao redor do Doko */
const DOKO_SCENES = {
  tecnico: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── TOP-LEFT cluster ── */}
      <g transform="rotate(-18 55 55)" opacity="0.22">
        {/* monitor inclinado */}
        <rect x="18" y="32" width="62" height="42" rx="3" strokeWidth="1.4"/>
        <line x1="18" y1="52" x2="80" y2="52" strokeWidth="0.9"/>
        <line x1="42" y1="74" x2="42" y2="82" strokeWidth="1.4"/>
        <line x1="30" y1="82" x2="54" y2="82" strokeWidth="1.3"/>
      </g>

      {/* ── TOP-LEFT floating bits ── */}
      <circle cx="108" cy="28" r="2.5" fill={color} strokeWidth="0" opacity="0.2"/>
      <line x1="14" y1="100" x2="42" y2="100" strokeWidth="1.2" opacity="0.16"/>
      <line x1="14" y1="108" x2="34" y2="108" strokeWidth="1.2" opacity="0.13"/>
      <line x1="14" y1="116" x2="38" y2="116" strokeWidth="1.2" opacity="0.15"/>
      <rect x="10" y="98" width="3" height="22" rx="1" fill={color} strokeWidth="0" opacity="0.16"/>

      {/* ── TOP — wifi rotacionado ── */}
      <g transform="rotate(12 470 54)" opacity="0.26">
        <path d="M444 36 Q470 16 496 36" strokeWidth="1.8"/>
        <path d="M452 50 Q470 36 488 50" strokeWidth="1.8"/>
        <circle cx="470" cy="62" r="3.5" fill={color} strokeWidth="0"/>
      </g>

      {/* ── RIGHT EDGE — roteador tombado ── */}
      <g transform="rotate(8 518 195)" opacity="0.2">
        <rect x="494" y="172" width="58" height="28" rx="4" strokeWidth="1.4"/>
        <line x1="508" y1="164" x2="504" y2="172" strokeWidth="1.4"/>
        <line x1="523" y1="161" x2="523" y2="172" strokeWidth="1.5"/>
        <line x1="538" y1="164" x2="542" y2="172" strokeWidth="1.4"/>
        <circle cx="504" cy="188" r="2.2" fill={color} strokeWidth="0"/>
        <circle cx="515" cy="188" r="2.2" fill={color} strokeWidth="0"/>
        <circle cx="526" cy="188" r="2.2" fill={color} strokeWidth="0"/>
      </g>

      {/* ── RIGHT EDGE — bateria inclinada ── */}
      <g transform="rotate(-22 520 295)" opacity="0.18">
        <rect x="498" y="274" width="46" height="22" rx="3" strokeWidth="1.4"/>
        <rect x="544" y="280" width="6" height="10" rx="1" fill={color} strokeWidth="0" opacity="0.5"/>
        <rect x="502" y="278" width="18" height="14" rx="2" fill={color} strokeWidth="0" opacity="0.25"/>
      </g>

      {/* ── BOTTOM-LEFT — teclado rotacionado ── */}
      <g transform="rotate(15 52 375)" opacity="0.18">
        <rect x="14" y="355" width="78" height="42" rx="4" strokeWidth="1.4"/>
        {[0,1,2,3,4,5].map(i=>(
          <rect key={i} x={18+i*12} y={361} width="9" height="7" rx="1.5" strokeWidth="1" opacity="0.7"/>
        ))}
        {[0,1,2,3,4,5].map(i=>(
          <rect key={i} x={18+i*12} y={372} width="9" height="7" rx="1.5" strokeWidth="1" opacity="0.7"/>
        ))}
      </g>

      {/* ── BOTTOM-RIGHT — mouse torto ── */}
      <g transform="rotate(-14 508 368)" opacity="0.2">
        <rect x="490" y="348" width="36" height="50" rx="14" strokeWidth="1.5"/>
        <line x1="508" y1="348" x2="508" y2="374" strokeWidth="1.2"/>
        <line x1="490" y1="374" x2="526" y2="374" strokeWidth="1"/>
      </g>

      {/* ── BOTTOM-RIGHT — headphone tombado ── */}
      <g transform="rotate(20 520 424)" opacity="0.18">
        <path d="M494 418 Q508 400 528 400 Q548 400 556 418" strokeWidth="1.6"/>
        <rect x="488" y="416" width="12" height="20" rx="5" strokeWidth="1.4"/>
        <rect x="550" y="416" width="12" height="20" rx="5" strokeWidth="1.4"/>
      </g>

      {/* ── Pontos/pixels aleatórios ── */}
      <circle cx="76"  cy="142" r="1.8" fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="488" cy="130" r="2"   fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="38"  cy="246" r="1.5" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="532" cy="252" r="1.8" fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="148" cy="434" r="2"   fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="412" cy="440" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="270" cy="14"  r="1.5" fill={color} strokeWidth="0" opacity="0.14"/>

      {/* Barras de sinal pequenas */}
      <g transform="translate(50,16)" opacity="0.18">
        <rect x="0"  y="14" width="6" height="8"  rx="1" fill={color} strokeWidth="0"/>
        <rect x="9"  y="10" width="6" height="12" rx="1" fill={color} strokeWidth="0"/>
        <rect x="18" y="6"  width="6" height="16" rx="1" fill={color} strokeWidth="0"/>
        <rect x="27" y="2"  width="6" height="20" rx="1" fill={color} strokeWidth="0"/>
      </g>
    </svg>
  ),

  cozinheiro: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── TOP-LEFT — chama dançante ── */}
      <g transform="rotate(-8 52 64)" opacity="0.26">
        <path d="M44 82 Q38 62 46 44 Q54 58 48 68 Q60 52 56 36 Q70 50 66 72 Q62 88 52 92 Q38 86 44 82Z"
          strokeWidth="1.5"/>
      </g>

      {/* ── TOP-LEFT — vaporzinhos caóticos ── */}
      <path d="M14 46 Q20 30 14 14"  strokeWidth="1.5" opacity="0.18" transform="rotate(12 14 30)"/>
      <path d="M28 52 Q36 32 28 12"  strokeWidth="1.5" opacity="0.2"  transform="rotate(-8 28 32)"/>
      <path d="M44 44 Q50 28 44 10"  strokeWidth="1.5" opacity="0.16" transform="rotate(5 44 27)"/>

      {/* ── TOP-RIGHT — espátula girada ── */}
      <g transform="rotate(-35 494 54)" opacity="0.22">
        <line x1="494" y1="18" x2="494" y2="78" strokeWidth="2"/>
        <rect x="488" y="14" width="12" height="22" rx="4" strokeWidth="1.5"/>
        <line x1="488" y1="44" x2="500" y2="44" strokeWidth="1" opacity="0.6"/>
      </g>

      {/* ── TOP-RIGHT — fouet ── */}
      <g transform="rotate(28 450 46)" opacity="0.19">
        <line x1="450" y1="14" x2="450" y2="72" strokeWidth="1.8"/>
        <path d="M446 16 Q454 26 448 38" strokeWidth="1.3"/>
        <path d="M454 14 Q462 24 456 36" strokeWidth="1.3"/>
      </g>

      {/* ── LEFT EDGE — colher tombada ── */}
      <g transform="rotate(80 32 185)" opacity="0.2">
        <path d="M32 155 Q32 135 46 130 Q60 130 60 145 Q60 162 46 168Z" strokeWidth="1.5"/>
        <line x1="46" y1="168" x2="46" y2="228" strokeWidth="1.5"/>
      </g>

      {/* ── LEFT EDGE — garfo caído ── */}
      <g transform="rotate(65 22 295)" opacity="0.19">
        <line x1="22" y1="258" x2="22" y2="330" strokeWidth="1.6"/>
        <line x1="16" y1="258" x2="16" y2="276" strokeWidth="1.2"/>
        <line x1="22" y1="258" x2="22" y2="276" strokeWidth="1.2"/>
        <line x1="28" y1="258" x2="28" y2="276" strokeWidth="1.2"/>
        <path d="M16 276 Q22 290 28 276" strokeWidth="1.2"/>
      </g>

      {/* ── RIGHT EDGE — panela torta ── */}
      <g transform="rotate(-12 522 178)" opacity="0.2">
        <ellipse cx="514" cy="178" rx="30" ry="11" strokeWidth="1.5"/>
        <rect x="484" y="148" width="60" height="30" rx="3" strokeWidth="1.5"/>
        <line x1="478" y1="178" x2="484" y2="178" strokeWidth="2.5"/>
        <line x1="544" y1="178" x2="548" y2="178" strokeWidth="2.5"/>
      </g>

      {/* ── RIGHT EDGE — temporizador inclinado ── */}
      <g transform="rotate(10 518 315)" opacity="0.19">
        <circle cx="518" cy="315" r="24" strokeWidth="1.5"/>
        <line x1="518" y1="291" x2="518" y2="315" strokeWidth="1.5"/>
        <line x1="518" y1="315" x2="534" y2="328" strokeWidth="1.3"/>
        <line x1="510" y1="289" x2="526" y2="289" strokeWidth="1.8"/>
      </g>

      {/* ── BOTTOM-LEFT — xícara tombada ── */}
      <g transform="rotate(-20 40 400)" opacity="0.2">
        <rect x="10" y="384" width="42" height="30" rx="4" strokeWidth="1.5"/>
        <path d="M52 390 Q64 390 64 402 Q64 414 52 414" strokeWidth="1.4"/>
        <ellipse cx="31" cy="384" rx="21" ry="6" strokeWidth="1.2"/>
      </g>

      {/* ── BOTTOM-LEFT — vapores ── */}
      <path d="M96 428 Q100 412 96 396"  strokeWidth="1.5" opacity="0.2" transform="rotate(-6 96 412)"/>
      <path d="M110 432 Q115 414 110 396" strokeWidth="1.5" opacity="0.22" transform="rotate(8 110 414)"/>
      <path d="M124 428 Q128 412 124 398" strokeWidth="1.5" opacity="0.18" transform="rotate(-4 124 413)"/>

      {/* ── BOTTOM-RIGHT — tomate girado ── */}
      <g transform="rotate(22 502 398)" opacity="0.2">
        <circle cx="502" cy="398" r="24" strokeWidth="1.5"/>
        <path d="M494 374 Q502 362 510 374" strokeWidth="1.3"/>
      </g>

      {/* ── BOTTOM-RIGHT — cenoura tombada ── */}
      <g transform="rotate(-42 528 432)" opacity="0.18">
        <path d="M510 420 L538 448 L526 432 L542 420 L528 408 Z" strokeWidth="1.4"/>
        <path d="M524 406 Q530 394 526 408" strokeWidth="1.2"/>
      </g>

      {/* Pontos espalhados */}
      <circle cx="130" cy="22" r="2"   fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="290" cy="16" r="1.8" fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="400" cy="30" r="2"   fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="60"  cy="200" r="1.6" fill={color} strokeWidth="0" opacity="0.12"/>
      <circle cx="50"  cy="316" r="1.5" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="496" cy="252" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="200" cy="442" r="2"   fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="358" cy="438" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
    </svg>
  ),

  medico: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── TOP — batimentos quebrados nos lados ── */}
      <polyline points="14,62 40,62 52,36 64,88 76,48 90,64 116,64"
        strokeWidth="1.8" opacity="0.26"/>
      <polyline points="440,58 460,58 468,38 476,74 484,52 494,62 520,62"
        strokeWidth="1.6" opacity="0.2"/>

      {/* ── TOP-LEFT — cruz girada ── */}
      <g transform="rotate(12 40 40)" opacity="0.24">
        <line x1="40" y1="22" x2="40" y2="58" strokeWidth="2.2"/>
        <line x1="22" y1="40" x2="58" y2="40" strokeWidth="2.2"/>
      </g>

      {/* ── TOP-RIGHT — cápsula inclinada ── */}
      <g transform="rotate(-38 502 52)" opacity="0.2">
        <rect x="488" y="26" width="28" height="52" rx="14" strokeWidth="1.5"/>
        <line x1="488" y1="52" x2="516" y2="52" strokeWidth="1" opacity="0.6"/>
      </g>

      {/* ── LEFT EDGE — estetoscópio ── */}
      <g transform="rotate(5 48 160)" opacity="0.21">
        <path d="M28 140 Q28 106 52 94 Q76 84 80 108" strokeWidth="1.8"/>
        <circle cx="80" cy="115" r="12" strokeWidth="1.8"/>
        <line x1="22" y1="140" x2="34" y2="140" strokeWidth="2.2"/>
      </g>

      {/* ── LEFT EDGE — seringa tombada ── */}
      <g transform="rotate(70 26 278)" opacity="0.19">
        <rect x="16" y="248" width="14" height="56" rx="2" strokeWidth="1.4"/>
        <rect x="12" y="244" width="22" height="10" rx="2" strokeWidth="1.3"/>
        <line x1="23" y1="304" x2="23" y2="318" strokeWidth="2.2"/>
        <line x1="12" y1="264" x2="30" y2="264" strokeWidth="1"/>
        <line x1="12" y1="278" x2="30" y2="278" strokeWidth="1"/>
      </g>

      {/* ── LEFT EDGE — termômetro inclinado ── */}
      <g transform="rotate(-22 28 362)" opacity="0.2">
        <rect x="20" y="332" width="12" height="46" rx="6" strokeWidth="1.4"/>
        <circle cx="26" cy="380" r="9" strokeWidth="1.4"/>
        <line x1="24" y1="342" x2="30" y2="342" strokeWidth="1"/>
        <line x1="24" y1="354" x2="30" y2="354" strokeWidth="1"/>
        <line x1="24" y1="366" x2="30" y2="366" strokeWidth="1"/>
      </g>

      {/* ── RIGHT EDGE — prancheta girada ── */}
      <g transform="rotate(-8 518 185)" opacity="0.19">
        <rect x="490" y="152" width="56" height="66" rx="3" strokeWidth="1.4"/>
        <rect x="506" y="144" width="24" height="14" rx="3" strokeWidth="1.3"/>
        <line x1="498" y1="176" x2="538" y2="176" strokeWidth="1"/>
        <line x1="498" y1="188" x2="530" y2="188" strokeWidth="1"/>
        <line x1="498" y1="200" x2="534" y2="200" strokeWidth="1"/>
      </g>

      {/* ── RIGHT EDGE — comprimido ── */}
      <g transform="rotate(32 510 298)" opacity="0.19">
        <ellipse cx="510" cy="298" rx="26" ry="12" strokeWidth="1.5"/>
        <line x1="484" y1="298" x2="536" y2="298" strokeWidth="1"/>
      </g>

      {/* ── BOTTOM-LEFT — kit médico ── */}
      <g transform="rotate(-10 48 406)" opacity="0.2">
        <rect x="14" y="386" width="68" height="44" rx="5" strokeWidth="1.5"/>
        <line x1="46" y1="395" x2="54" y2="395" strokeWidth="2"/>
        <line x1="50" y1="391" x2="50" y2="405" strokeWidth="2"/>
        <line x1="14" y1="408" x2="82" y2="408" strokeWidth="0.9"/>
        <line x1="48" y1="386" x2="48" y2="430" strokeWidth="0.9"/>
      </g>

      {/* ── BOTTOM — gráfico de saúde espalhado ── */}
      <polyline points="110,434 148,414 190,424 230,402 270,414 310,396 350,408 390,386 430,400"
        strokeWidth="1.4" opacity="0.18"/>

      {/* ── BOTTOM-RIGHT — microscópio ── */}
      <g transform="rotate(6 512 394)" opacity="0.19">
        <line x1="512" y1="362" x2="512" y2="420" strokeWidth="2"/>
        <ellipse cx="512" cy="360" rx="16" ry="9" strokeWidth="1.5"/>
        <line x1="512" y1="420" x2="490" y2="436" strokeWidth="1.8"/>
        <line x1="512" y1="420" x2="534" y2="436" strokeWidth="1.8"/>
        <line x1="490" y1="436" x2="534" y2="436" strokeWidth="1.5"/>
      </g>

      {/* Pontos */}
      <circle cx="165" cy="26" r="2"   fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="310" cy="18" r="1.8" fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="418" cy="30" r="2"   fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="66"  cy="244" r="1.6" fill={color} strokeWidth="0" opacity="0.12"/>
      <circle cx="496" cy="118" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="268" cy="446" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
    </svg>
  ),

  ambiental: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── Estrelas espalhadas (topo e cantos) ── */}
      <circle cx="52"  cy="24" r="2.5" fill={color} strokeWidth="0" opacity="0.3"/>
      <circle cx="108" cy="12" r="1.8" fill={color} strokeWidth="0" opacity="0.24"/>
      <circle cx="174" cy="32" r="1.4" fill={color} strokeWidth="0" opacity="0.2"/>
      <circle cx="240" cy="16" r="2.2" fill={color} strokeWidth="0" opacity="0.22"/>
      <circle cx="318" cy="22" r="1.5" fill={color} strokeWidth="0" opacity="0.2"/>
      <circle cx="388" cy="12" r="2"   fill={color} strokeWidth="0" opacity="0.26"/>
      <circle cx="444" cy="28" r="1.6" fill={color} strokeWidth="0" opacity="0.2"/>
      <circle cx="502" cy="16" r="2.2" fill={color} strokeWidth="0" opacity="0.28"/>
      <circle cx="536" cy="44" r="1.4" fill={color} strokeWidth="0" opacity="0.2"/>

      {/* ── TOP-LEFT — lua crescente inclinada ── */}
      <g transform="rotate(-18 46 66)" opacity="0.26">
        <path d="M30 46 A24 24 0 1 1 30 90 A17 17 0 1 0 30 46 Z" strokeWidth="1.5"/>
      </g>

      {/* ── TOP-RIGHT — sol irradiante ── */}
      <g transform="rotate(15 492 58)" opacity="0.2">
        <circle cx="492" cy="58" r="18" strokeWidth="1.5"/>
        <line x1="492" y1="30" x2="492" y2="22" strokeWidth="1.5"/>
        <line x1="492" y1="86" x2="492" y2="94" strokeWidth="1.5"/>
        <line x1="464" y1="58" x2="456" y2="58" strokeWidth="1.5"/>
        <line x1="520" y1="58" x2="528" y2="58" strokeWidth="1.5"/>
        <line x1="472" y1="38" x2="466" y2="32" strokeWidth="1.3"/>
        <line x1="512" y1="78" x2="518" y2="84" strokeWidth="1.3"/>
        <line x1="512" y1="38" x2="518" y2="32" strokeWidth="1.3"/>
        <line x1="472" y1="78" x2="466" y2="84" strokeWidth="1.3"/>
      </g>

      {/* ── TOP — 2 nuvens espalhadas ── */}
      <g transform="rotate(-5 184 52)" opacity="0.18">
        <path d="M154 56 Q160 42 172 44 Q175 36 188 38 Q202 36 204 48 Q214 48 214 58 Z" strokeWidth="1.4"/>
      </g>
      <g transform="rotate(8 358 38)" opacity="0.15">
        <path d="M332 42 Q338 30 348 32 Q350 24 362 26 Q372 24 374 34 Q380 34 380 42 Z" strokeWidth="1.3"/>
      </g>

      {/* ── LEFT — folha girada ── */}
      <g transform="rotate(38 36 158)" opacity="0.22">
        <path d="M14 156 Q38 126 60 156 Q38 172 14 156 Z" strokeWidth="1.4"/>
        <line x1="14" y1="156" x2="60" y2="156" strokeWidth="1"/>
        <line x1="26" y1="150" x2="30" y2="162" strokeWidth="0.9"/>
        <line x1="38" y1="144" x2="40" y2="156" strokeWidth="0.9"/>
      </g>

      {/* ── LEFT — árvore maior orgânica ── */}
      <g transform="rotate(4 38 272)" opacity="0.2">
        <line x1="38" y1="290" x2="38" y2="390" strokeWidth="2.8"/>
        <ellipse cx="38" cy="262" rx="28" ry="36" strokeWidth="1.5"/>
        <ellipse cx="20" cy="278" rx="18" ry="24" strokeWidth="1.2"/>
        <ellipse cx="56" cy="274" rx="18" ry="24" strokeWidth="1.2"/>
      </g>

      {/* ── RIGHT — árvore menor inclinada ── */}
      <g transform="rotate(-7 524 296)" opacity="0.18">
        <line x1="524" y1="316" x2="524" y2="400" strokeWidth="2.2"/>
        <ellipse cx="524" cy="292" rx="22" ry="28" strokeWidth="1.4"/>
        <ellipse cx="508" cy="304" rx="14" ry="20" strokeWidth="1.2"/>
      </g>

      {/* ── RIGHT — painel solar torto ── */}
      <g transform="rotate(12 516 164)" opacity="0.18">
        <rect x="488" y="148" width="56" height="38" rx="3" strokeWidth="1.4"/>
        <line x1="488" y1="167" x2="544" y2="167" strokeWidth="1"/>
        <line x1="507" y1="148" x2="507" y2="186" strokeWidth="1"/>
        <line x1="526" y1="148" x2="526" y2="186" strokeWidth="1"/>
      </g>

      {/* ── RIGHT — borboleta ── */}
      <g transform="rotate(-25 498 268)" opacity="0.19">
        <path d="M498 268 Q484 252 484 268 Q484 282 498 276" strokeWidth="1.3"/>
        <path d="M498 268 Q512 252 512 268 Q512 282 498 276" strokeWidth="1.3"/>
        <line x1="498" y1="266" x2="498" y2="284" strokeWidth="1.2"/>
      </g>

      {/* ── BOTTOM — grama orgânica ── */}
      <g opacity="0.2">
        <path d="M68 438  Q74 416 80 438"  strokeWidth="1.5" transform="rotate(-4 74 427)"/>
        <path d="M88 442  Q95 418 102 442" strokeWidth="1.5" transform="rotate(6 95 430)"/>
        <path d="M108 436 Q114 416 120 436" strokeWidth="1.5" transform="rotate(-8 114 426)"/>
        <path d="M370 440 Q376 418 382 440" strokeWidth="1.5" transform="rotate(5 376 429)"/>
        <path d="M392 436 Q399 416 406 436" strokeWidth="1.5" transform="rotate(-6 399 426)"/>
        <path d="M416 442 Q422 420 428 442" strokeWidth="1.5" transform="rotate(9 422 431)"/>
      </g>

      {/* ── BOTTOM — flor espalhada ── */}
      <g transform="rotate(18 208 428)" opacity="0.2">
        <circle cx="208" cy="428" r="7" strokeWidth="1.4"/>
        <path d="M208 421 Q213 412 208 405 Q203 412 208 421Z" strokeWidth="1.2"/>
        <path d="M215 424 Q224 420 227 424 Q224 430 215 427Z" strokeWidth="1.2"/>
        <path d="M201 424 Q192 420 189 424 Q192 430 201 427Z" strokeWidth="1.2"/>
        <path d="M208 435 Q213 444 208 451 Q203 444 208 435Z" strokeWidth="1.2"/>
      </g>

      {/* ── BOTTOM-RIGHT — reciclagem tombada ── */}
      <g transform="rotate(30 480 428)" opacity="0.2">
        <path d="M466 416 L478 396 L490 416 Z" strokeWidth="1.4"/>
        <path d="M458 430 L500 430" strokeWidth="1.2"/>
        <path d="M454 422 Q456 408 466 416" strokeWidth="1.2"/>
        <path d="M502 422 Q500 408 490 416" strokeWidth="1.2"/>
      </g>
    </svg>
  ),

  contador: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── TOP-LEFT — gráfico de barras inclinado ── */}
      <g transform="rotate(-12 56 70)" opacity="0.22">
        <rect x="18" y="58" width="16" height="40" rx="2" strokeWidth="1.4"/>
        <rect x="40" y="44" width="16" height="54" rx="2" strokeWidth="1.4"/>
        <rect x="62" y="30" width="16" height="68" rx="2" strokeWidth="1.4"/>
        <rect x="84" y="46" width="16" height="52" rx="2" strokeWidth="1.4"/>
        <line x1="14" y1="98" x2="106" y2="98" strokeWidth="1.2"/>
      </g>

      {/* ── TOP-LEFT — números flutuando ── */}
      <text x="14"  y="28" fontSize="11" fill={color} opacity="0.14" stroke="none" fontFamily="monospace"
        transform="rotate(-6 14 28)">R$4.800</text>
      <text x="110" y="18" fontSize="10" fill={color} opacity="0.12" stroke="none" fontFamily="monospace"
        transform="rotate(4 110 18)">+8,5%</text>

      {/* ── TOP-RIGHT — símbolo % inclinado ── */}
      <text x="472" y="72" fontSize="48" fill={color} opacity="0.13" stroke="none"
        fontFamily="monospace" transform="rotate(10 480 55)">%</text>

      {/* ── TOP-RIGHT — nota flutuante ── */}
      <text x="444" y="28" fontSize="10" fill={color} opacity="0.12" stroke="none" fontFamily="monospace"
        transform="rotate(-8 444 28)">27,5%</text>

      {/* ── LEFT — ábaco torto ── */}
      <g transform="rotate(8 32 215)" opacity="0.18">
        <line x1="16" y1="155" x2="16" y2="290" strokeWidth="1.5"/>
        <line x1="50" y1="155" x2="50" y2="290" strokeWidth="1.5"/>
        <line x1="12" y1="153" x2="54" y2="153" strokeWidth="1.5"/>
        <line x1="12" y1="292" x2="54" y2="292" strokeWidth="1.5"/>
        {[172,196,220,244,268].map((y,i)=>(
          <circle key={i} cx={i<3?20:10} cy={y} r="7" strokeWidth="1.4"/>
        ))}
        {[172,196,220,244].map((y,i)=>(
          <circle key={i} cx={i<2?44:54} cy={y} r="7" strokeWidth="1.4"/>
        ))}
      </g>

      {/* ── RIGHT — moedas empilhadas giradas ── */}
      <g transform="rotate(-14 518 168)" opacity="0.2">
        <ellipse cx="518" cy="168" rx="24" ry="8" strokeWidth="1.5"/>
        <ellipse cx="518" cy="154" rx="24" ry="8" strokeWidth="1.5"/>
        <ellipse cx="518" cy="140" rx="24" ry="8" strokeWidth="1.5"/>
        <line x1="494" y1="140" x2="494" y2="168" strokeWidth="1.2"/>
        <line x1="542" y1="140" x2="542" y2="168" strokeWidth="1.2"/>
      </g>

      {/* ── RIGHT — caneta tinteiro ── */}
      <g transform="rotate(-34 514 288)" opacity="0.18">
        <rect x="508" y="252" width="12" height="62" rx="5" strokeWidth="1.4"/>
        <path d="M514" y1="314 L508 332 L520 332 Z" strokeWidth="1.3"/>
        <line x1="508" y1="266" x2="520" y2="266" strokeWidth="1"/>
        <path d="M514 314 L508 332 L520 332 Z" strokeWidth="1.3"/>
      </g>

      {/* ── BOTTOM-LEFT — tendência ascendente ── */}
      <g transform="rotate(-6 110 376)" opacity="0.22">
        <polyline points="16,392 58,372 100,356 142,338 184,318"
          strokeWidth="1.5" strokeDasharray="5 3"/>
        <polygon points="184,308 196,328 172,328" strokeWidth="1.2"/>
      </g>

      {/* ── BOTTOM-LEFT — nota fiscal tombada ── */}
      <g transform="rotate(16 56 428)" opacity="0.18">
        <rect x="14" y="408" width="56" height="48" rx="3" strokeWidth="1.3"/>
        <line x1="20" y1="420" x2="64" y2="420" strokeWidth="1"/>
        <line x1="20" y1="430" x2="56" y2="430" strokeWidth="1"/>
        <line x1="20" y1="440" x2="60" y2="440" strokeWidth="1"/>
        <line x1="20" y1="450" x2="44" y2="450" strokeWidth="1"/>
      </g>

      {/* ── BOTTOM-RIGHT — calculadora ── */}
      <g transform="rotate(-10 510 390)" opacity="0.19">
        <rect x="480" y="354" width="62" height="76" rx="5" strokeWidth="1.5"/>
        <line x1="480" y1="376" x2="542" y2="376" strokeWidth="1"/>
        <rect x="488" y="358" width="44" height="14" rx="2" strokeWidth="1.2"/>
        {[0,1,2].map(i=>[0,1,2].map(j=>(
          <circle key={`${i}${j}`} cx={492+i*17} cy={388+j*16} r="4.5" strokeWidth="1.2"/>
        )))}
      </g>

      {/* ── BOTTOM CENTER — linha de tendência suave ── */}
      <polyline points="170,440 220,424 270,432 320,416 370,428 420,412"
        strokeWidth="1.2" strokeDasharray="3 4" opacity="0.15"/>

      {/* Pontos aleatórios */}
      <circle cx="186" cy="22"  r="1.8" fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="346" cy="16"  r="1.5" fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="444" cy="112" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="56"  cy="316" r="1.6" fill={color} strokeWidth="0" opacity="0.12"/>
      <circle cx="496" cy="336" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="268" cy="446" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
    </svg>
  ),
};

const TabMyDoko = () => {
  const [fome,       setFome]       = useState(75);
  const [energia,    setEnergia]    = useState(70);
  const [fala,       setFala]       = useState('Olá! Que bom te ver por aqui!');
  const [skin,       setSkin]       = useState('tecnico');
  const [showSkins,  setShowSkins]  = useState(false);
  const [showComidas,setShowComidas]= useState(false);
  const [dormindo,   setDormindo]   = useState(false);
  const [sono,       setSono]       = useState(70);
  const [notif,      setNotif]      = useState(null); /* alerta de stat baixo */
  const alertasRef   = {fome:false, energia:false, sono:false}; /* controle de duplicata */
  const [bounce,     setBounce]     = useState(false);
  const [bounceDur,  setBounceDur]  = useState(3);
  const [conversa,   setConversa]   = useState(null);
  const [respondeu,  setRespondeu]  = useState(false);
  const [typing,     setTyping]     = useState(false);
  const [fila,       setFila]       = useState([]);
  const [filaTotal,  setFilaTotal]  = useState(0);
  const [sessaoAtiva,setSessaoAtiva]= useState(false);
  const [sessaoFim,  setSessaoFim]  = useState(false);
  const [pergAtual,  setPergAtual]  = useState('');    /* pergunta fixa visível */

  useEffect(()=>{
    const id=setInterval(()=>{
      if(dormindo){
        /* Dormindo: recupera sono, não perde fome/energia */
        setSono(s=>Math.min(100,s+2.5));
      } else {
        /* Acordado: perde fome, energia e sono gradualmente */
        setFome(f=>Math.max(0,f-1));
        setEnergia(e=>Math.max(0,e-0.5));
        setSono(s=>Math.max(0,s-0.8));
      }
    },8000);
    return ()=>clearInterval(id);
  },[dormindo]);

  /* Alertas de threshold 49% */
  useEffect(()=>{
    if(dormindo) return;
    if(fome <= 49 && fome > 35){
      setNotif({msg: pers.alertaFome   || 'Estou ficando com fome!',      tipo:'fome'});
      setTimeout(()=>setNotif(null), 5000);
    }
  },[Math.floor(fome/10)]); // dispara quando cruza dezena

  useEffect(()=>{
    if(dormindo) return;
    if(energia <= 49 && energia > 25){
      setNotif({msg: pers.alertaEnergia || 'Estou ficando sem energia...', tipo:'energia'});
      setTimeout(()=>setNotif(null), 5000);
    }
  },[Math.floor(energia/10)]);

  useEffect(()=>{
    if(dormindo) return;
    if(sono <= 49 && sono > 15){
      setNotif({msg: pers.alertaSono   || 'Estou com sono! Hora de descansar...', tipo:'sono'});
      setTimeout(()=>setNotif(null), 5000);
    }
  },[Math.floor(sono/10)]);

  const pers       = DOKO_PERSONALIDADES[skin];
  const activeSkin = DOKO_SKINS.find(s=>s.id===skin);
  const mood       = (fome+energia)/2>=70?'feliz':(fome+energia)/2>=35?'neutro':'triste';
  /* Estado cansado: fome E energia ambos críticos (abaixo de 25) */
  const isCansado  = fome < 25 && energia < 25;
  const dokoImg    = isCansado && activeSkin.imgCansado
                     ? activeSkin.imgCansado
                     : activeSkin.img;
  const barColor   = v=>v>=60?T.green:v>=30?T.gold:T.danger;
  const moodLabel  = {feliz:'Feliz',neutro:'Bem',triste:'Triste'};
  const rnd        = arr=>arr[Math.floor(Math.random()*arr.length)];

  const FALA_DUR = 8000;
  /* Resposta: mostra no balão e some após 8s */
  const dizer = txt => {
    setFala(txt);
    setBounce(true); setBounceDur(8);
    setTimeout(()=>setBounce(false), FALA_DUR);
    setTimeout(()=>setFala(''), FALA_DUR+400);
  };
  /* Pergunta: fica no balão até ser respondida + state fixo acima das opções */
  const dizerPergunta = (txt) => {
    setFala(txt);
    setPergAtual(txt);
    setBounce(true); setBounceDur(6);
    setTimeout(()=>setBounce(false), 6000);
    /* NÃO auto-limpa */
  };

  const alimentar = () => setShowComidas(s=>!s);
  const escolherComida = (comida) => {
    setFome(f=>Math.min(100, f+comida.fome));
    setEnergia(e=>Math.min(100, e+comida.energia));
    setShowComidas(false);
    setConversa(null); setRespondeu(false); setTyping(false);
    setSessaoAtiva(false); setSessaoFim(false); setFila([]); setFilaTotal(0); setPergAtual('');
    dizer(comida.r);
  };
  const carinho = () => {
    setEnergia(e=>Math.min(100,e+22));
    setFome(f=>Math.min(100,f+3));
    setConversa(null); setRespondeu(false); setTyping(false); setSessaoAtiva(false); setSessaoFim(false); setFila([]); setFilaTotal(0); setPergAtual('');
    dizer(rnd(pers.pet));
  };
  const iniciarConversa = () => {
    const perguntas = [...pers.conversa];
    setSessaoAtiva(true); setSessaoFim(false);
    setFila(perguntas.slice(1));
    setFilaTotal(perguntas.length);
    setTyping(false);
    setConversa(perguntas[0]); setRespondeu(false);
    dizerPergunta(perguntas[0].pergunta);
  };
  const avancarFila = () => {
    if(fila.length > 0){
      const prox = fila[0];
      setFila(f=>f.slice(1));
      setConversa(prox); setRespondeu(false);
      dizerPergunta(prox.pergunta);
    } else {
      /* Sessão completa */
      setConversa(null);
      setRespondeu(false);
      setSessaoAtiva(false);
      setSessaoFim(true);
      setEnergia(e=>Math.min(100,e+35));
      dizer(pers.conclusao||'Você finalizou todas as perguntas por hoje! Até mais tarde!');
      setTimeout(()=>setSessaoFim(false),10000);
    }
  };
  const PROX_DELAY = 1200;  /* mostra typing após 1.2s de resposta */
  const PROX_SHOW  = 2800;  /* próxima pergunta após 2.8s total     */
  const responderOpcao = (opcao) => {
    setEnergia(e=>Math.min(100,e+(opcao.d||5)));
    setFome(f=>Math.min(100,f+3));
    setRespondeu(true);
    setPergAtual(''); /* limpa pergunta fixa ao responder */
    dizer(opcao.r);
    if(opcao.proximo){
      setTimeout(()=>setTyping(true), PROX_DELAY);
      setTimeout(()=>{
        setTyping(false);
        setConversa(opcao.proximo); setRespondeu(false);
        dizerPergunta(opcao.proximo.pergunta);
      }, PROX_SHOW);
    } else if(sessaoAtiva){
      setTimeout(()=>setTyping(true), PROX_DELAY);
      setTimeout(()=>{ setTyping(false); avancarFila(); }, PROX_SHOW);
    } else {
      setTimeout(()=>{setConversa(null); setRespondeu(false); setPergAtual('');}, PROX_SHOW);
    }
  };
  const toggleDormir = () => {
    setDormindo(d=>{
      const next = !d;
      if(next){
        /* Adormecendo */
        setShowComidas(false);
        setConversa(null); setRespondeu(false); setTyping(false);
        setSessaoAtiva(false); setSessaoFim(false);
        setFila([]); setFilaTotal(0); setPergAtual('');
        dizer(rnd(pers.dormindo||['Boa noite... zzz...','Hora de descansar...','Dormindo... não me acorde!']));
      } else {
        /* Acordando */
        dizer(rnd(pers.acordando||['Bom dia! Que sono gostoso!','Zzz... Hã? Já? Bom dia!','Descansado e pronto!']));
      }
      return next;
    });
  };

  const FRASES_CANSADO = {
    tecnico:    ['Bateria em 2%... socooorro...','Sistema em falha crítica... preciso de comida e descanso...','Modo emergência ativado. Recargue agora...'],
    cozinheiro: ['A frigideira caiu de mão... sem força...','Preciso de comida... que ironia...','Sem energia pra nem cozinhar um ovo...'],
    medico:     ['Diagnóstico: exaustão total. Prescrição: comida e carinho urgente!','Paciente em estado crítico... sou eu...','Sinais vitais baixíssimos! Emergência!'],
    ambiental:  ['...Recurso esgotado. Preciso de reabastecimento.','Desequilíbrio total. Sem energia para continuar.','...Seco como deserto. Ajuda.'],
    contador:   ['Saldo zerado... déficit total...','Balanço extremamente negativo. Requer intervenção!','Reserva de emergência esgotada. Situação crítica.'],
  };
  const clicarDoko = () => {
    if(conversa) return;
    if(isCansado){
      const list = FRASES_CANSADO[skin] || FRASES_CANSADO.tecnico;
      dizer(rnd(list));
    } else {
      dizer(rnd(pers[mood]));
    }
  };

  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{fontSize:22,fontWeight:600,color:T.text}}>My Doko</div>
          <div style={{fontSize:15,color:T.textT,marginTop:4}}>
            Seu companheiro virtual —{' '}
            <span style={{color:activeSkin.color,fontWeight:500}}>{activeSkin.label}</span>
          </div>
        </div>
        <button onClick={()=>setShowSkins(s=>!s)}
          style={{display:'inline-flex',alignItems:'center',gap:7,padding:'8px 16px',
            background:showSkins?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.04)'),
            border:`1px solid ${showSkins?T.goldLine+'55':T.border}`,borderRadius:10,
            color:showSkins?T.gold:T.textS,cursor:'pointer',outline:'none',
            fontFamily:'var(--font-body)',fontSize:13,fontWeight:500,transition:'all .15s'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          Trocar Doko
        </button>
      </div>
      <StarDivider my={16}/>

      {showSkins&&(
        <Card style={{padding:'18px',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:14}}>
            Escolha seu Doko
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
            {DOKO_SKINS.map(s=>(
              <div key={s.id}
                onClick={()=>{setSkin(s.id);setShowSkins(false);setShowComidas(false);setConversa(null);
                  setTimeout(()=>dizer(rnd(DOKO_PERSONALIDADES[s.id].saudacao)),100);}}
                style={{cursor:'pointer',borderRadius:14,overflow:'hidden',
                  border:`2.5px solid ${skin===s.id?s.color:'rgba(0,0,0,0.08)'}`,
                  transition:'all .18s',
                  boxShadow:skin===s.id?`0 4px 16px ${s.color}44`:'none',
                  transform:skin===s.id?'scale(1.04)':'scale(1)'}}>
                <img src={s.img} alt={s.label}
                  style={{width:'100%',aspectRatio:'1',objectFit:'cover',display:'block'}}/>
                <div style={{padding:'6px 8px',textAlign:'center',
                  background:skin===s.id?`${s.color}18`:'transparent',
                  fontSize:12,fontWeight:skin===s.id?600:400,
                  color:skin===s.id?s.color:T.textS}}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Seletor de comida */}
      {showComidas&&(
        <div style={{marginBottom:16}}>
          <Card style={{padding:'18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>O que você vai dar para o Doko?</div>
              <button onClick={()=>setShowComidas(false)}
                style={{background:'none',border:'none',cursor:'pointer',color:T.textT,fontSize:16,padding:'2px 6px'}}>✕</button>
            </div>
            <div style={{marginBottom:10,display:'flex',gap:8,alignItems:'center'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:T.green,flexShrink:0}}/>
              <span style={{fontSize:11,color:T.textT}}>Verde = saudável · </span>
              <div style={{width:8,height:8,borderRadius:'50%',background:T.gold,flexShrink:0}}/>
              <span style={{fontSize:11,color:T.textT}}>Dourado = especial</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {COMIDAS.map(comida=>{
                const cor = comida.saudavel ? T.green : T.gold;
                const Icon = COMIDA_ICONS[comida.cat];
                return(
                  <button key={comida.id} onClick={()=>escolherComida(comida)}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',
                      gap:6,padding:'12px 8px',borderRadius:12,cursor:'pointer',
                      background:`${cor}10`,border:`1.5px solid ${cor}44`,
                      outline:'none',fontFamily:'var(--font-body)',
                      transition:'all .18s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${cor}22`;e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.borderColor=`${cor}88`;}}
                    onMouseLeave={e=>{e.currentTarget.style.background=`${cor}10`;e.currentTarget.style.transform='none';e.currentTarget.style.borderColor=`${cor}44`;}}>
                    <div style={{color:cor}}>{Icon(cor)}</div>
                    <div style={{fontSize:11,fontWeight:500,color:T.text,textAlign:'center',lineHeight:1.3}}>
                      {comida.nome}
                    </div>
                    <div style={{display:'flex',gap:6,fontSize:10,color:T.textT}}>
                      <span style={{color:T.green}}>+{comida.fome} fome</span>
                      {comida.energia>=0
                        ?<span style={{color:T.blue}}>+{comida.energia} en.</span>
                        :<span style={{color:T.danger}}>{comida.energia} en.</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20}}>

        {/* Doko central — layout fixo sem deslocamento */}
        <Card style={{padding:'28px',display:'flex',flexDirection:'column',
          alignItems:'center',minHeight:480,position:'relative',overflow:'hidden'}} elevated>

          {/* Cenário SVG — cobre toda a área do card, itens ao redor do Doko */}
          {DOKO_SCENES[skin]&&(
            <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden',borderRadius:'inherit'}}>
              {React.createElement(DOKO_SCENES[skin],{color:activeSkin.color})}
            </div>
          )}

          {/* Área do balão — altura fixa para não deslocar o Doko */}
          <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:380,
            height:110,display:'flex',alignItems:'center',justifyContent:'center',
            marginBottom:12}}>
            {fala&&(
              <div style={{
                background:T.surface,border:`1.5px solid ${activeSkin.color}55`,
                borderRadius:16,padding:'12px 18px',width:'100%',
                textAlign:'center',boxShadow:`0 4px 16px ${activeSkin.color}22`,
                fontSize:14,color:T.text,lineHeight:1.6,fontStyle:'italic',
                position:'relative',
              }}>
                {fala}
                <div style={{position:'absolute',bottom:-9,left:'50%',
                  transform:'translateX(-50%)',width:0,height:0,
                  borderLeft:'7px solid transparent',borderRight:'7px solid transparent',
                  borderTop:`9px solid ${activeSkin.color}55`}}/>
                <div style={{position:'absolute',bottom:-7,left:'50%',
                  transform:'translateX(-50%)',width:0,height:0,
                  borderLeft:'6px solid transparent',borderRight:'6px solid transparent',
                  borderTop:`8px solid ${T.surface}`}}/>
              </div>
            )}
          </div>

          {/* Doko — completamente estático, apenas o ring pulsa */}
          <div onClick={clicarDoko}
            style={{position:'relative',zIndex:1,cursor:'pointer',marginBottom:14}}>
            <div style={{
              width:230,height:230,borderRadius:'50%',overflow:'hidden',
              border: dormindo
                ? '3px solid rgba(120,100,220,0.6)'
                : isCansado
                  ? `3px solid ${T.danger}88`
                  : `3px solid ${activeSkin.color}${bounce?'BB':'33'}`,
              boxShadow: dormindo
                ? undefined  /* animação CSS cuida do shadow */
                : isCansado
                  ? `0 0 0 6px ${T.danger}33, 0 0 0 12px ${T.danger}11`
                  : bounce
                    ? `0 0 0 7px ${activeSkin.color}44, 0 0 0 14px ${activeSkin.color}18, 0 0 28px 6px ${activeSkin.color}33`
                    : `0 0 0 3px ${activeSkin.color}16`,
              animation: dormindo ? 'dokoSleep 3s ease-in-out infinite' : 'none',
              transition: dormindo ? 'border-color .6s ease' : `box-shadow ${bounceDur}s ease, border-color ${bounceDur}s ease`,
            }}>
              <img src={dokoImg} alt="Doko"
                style={{width:'100%',height:'100%',objectFit:'cover',display:'block',
                  filter:isCansado?'saturate(0.5) brightness(0.8)':'none',
                  transition:'filter .6s ease'}}/>
            </div>
            {/* Overlay de dormindo */}
            {dormindo&&(
              <div style={{position:'absolute',inset:0,borderRadius:'50%',
                background:'rgba(10,15,35,0.55)',display:'flex',alignItems:'center',
                justifyContent:'center',pointerEvents:'none'}}>
                <div style={{textAlign:'center'}}>
                  {['Z','z','z'].map((z,i)=>(
                    <span key={i} style={{
                      display:'block',fontSize:16-i*3,fontWeight:700,
                      color:'rgba(200,220,255,0.9)',lineHeight:1.1,
                      animation:'moonFloat '+(3+i*0.5)+'s ease-in-out infinite',
                      animationDelay:i*0.4+'s',
                      marginLeft:i*4+'px',
                    }}>{z}</span>
                  ))}
                </div>
              </div>
            )}
            {/* mood badge */}
            <div style={{position:'absolute',bottom:2,right:2,
              background:T.surface,
              border:`2px solid ${dormindo?'rgba(120,100,220,0.7)':isCansado?T.danger:barColor((fome+energia)/2)}`,
              borderRadius:999,padding:'3px 10px',
              fontSize:10,fontWeight:600,
              color:dormindo?'rgba(120,100,220,1)':isCansado?T.danger:barColor((fome+energia)/2)}}>
              {dormindo ? 'Dormindo' : isCansado ? 'Cansado!' : moodLabel[mood]}
            </div>
          </div>

          <div style={{position:'relative',zIndex:1,fontSize:12,color:T.textT,marginBottom:10}}>
            Clique no Doko para ele falar
          </div>

          {/* Notificação de stat baixo */}
          {notif&&(
            <div style={{position:'relative',zIndex:2,
              display:'flex',alignItems:'center',gap:8,
              padding:'10px 16px',marginBottom:8,
              borderRadius:12,
              background: notif.tipo==='fome'
                ? `${T.gold}18`
                : notif.tipo==='energia'
                  ? `${T.blue}18`
                  : `rgba(100,80,200,0.12)`,
              border: `1.5px solid ${
                notif.tipo==='fome'
                  ? T.gold+'55'
                  : notif.tipo==='energia'
                    ? T.blue+'55'
                    : 'rgba(100,80,200,0.35)'
              }`,
              boxShadow:`0 4px 12px rgba(0,0,0,0.08)`}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={notif.tipo==='fome'?T.gold:notif.tipo==='energia'?T.blue:'rgba(120,100,220,1)'}
                strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{fontSize:13,color:T.text,fontStyle:'italic',lineHeight:1.4}}>
                {notif.msg}
              </span>
            </div>
          )}

          {/* Mensagem de conclusão */}
          {sessaoFim&&(
            <div style={{position:'relative',zIndex:1,
              background:`linear-gradient(135deg,${activeSkin.color}18,${T.surface} 80%)`,
              border:`2px solid ${activeSkin.color}55`,
              borderRadius:14,padding:'14px 18px',marginBottom:8,
              textAlign:'center',
              boxShadow:`0 6px 20px ${activeSkin.color}33`}}>
              <div style={{fontSize:18,marginBottom:6}}>🎉</div>
              <div style={{fontSize:14,fontWeight:600,color:activeSkin.color,marginBottom:4}}>
                Sessão concluída!
              </div>
              <div style={{fontSize:12,color:T.textS,lineHeight:1.6}}>
                Você finalizou todas as perguntas por hoje!
              </div>
              <div style={{fontSize:11,color:T.green,marginTop:6,fontWeight:500}}>
                +35 energia recebida
              </div>
            </div>
          )}

          {/* Typing indicator + mensagem de transição */}
          {typing&&(
            <div style={{position:'relative',zIndex:1,
              display:'flex',alignItems:'center',gap:10,
              background:T.surface,
              border:`1.5px solid ${activeSkin.color}44`,
              borderRadius:16,padding:'12px 18px',
              marginBottom:8,
              boxShadow:`0 4px 14px ${activeSkin.color}22`}}>
              <div style={{display:'flex',gap:5,alignItems:'center'}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{
                    width:8,height:8,borderRadius:'50%',
                    background:activeSkin.color,
                    animation:'dotBounce 1.1s ease-in-out infinite',
                    animationDelay:`${i*0.18}s`,
                  }}/>
                ))}
              </div>
              <span style={{fontSize:13,color:T.textS,fontStyle:'italic'}}>
                Preparando a próxima pergunta...
              </span>
            </div>
          )}

          {/* Opções de resposta */}
          {conversa&&!respondeu&&(
            <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:380}}>
              {/* Barra de progresso corrigida */}
              {sessaoAtiva&&filaTotal>0&&(()=>{
                const atual = filaTotal - fila.length;
                const pct   = Math.round((atual/filaTotal)*100);
                return(
                  <div style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',
                      alignItems:'center',marginBottom:5}}>
                      <span style={{fontSize:10,color:T.textT,letterSpacing:'.07em',
                        textTransform:'uppercase',fontWeight:600}}>Progresso</span>
                      <span style={{fontSize:10,color:activeSkin.color,fontWeight:600}}>
                        {atual}/{filaTotal}
                      </span>
                    </div>
                    <div style={{height:4,background:T.divider,borderRadius:999,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:999,
                        background:`linear-gradient(90deg,${activeSkin.color},${activeSkin.color}99)`,
                        width:`${pct}%`,transition:'width .5s ease'}}/>
                    </div>
                  </div>
                );
              })()}
              {/* Pergunta visível e fixa acima das opções */}
              {pergAtual&&(
                <div style={{
                  background:`${activeSkin.color}12`,
                  border:`1.5px solid ${activeSkin.color}44`,
                  borderRadius:12,padding:'10px 14px',
                  fontSize:13,color:T.text,lineHeight:1.6,
                  fontWeight:500,marginBottom:10,textAlign:'center',
                  fontStyle:'italic'
                }}>
                  {pergAtual}
                </div>
              )}
              <div style={{fontSize:11,color:T.textT,textAlign:'center',marginBottom:8,
                letterSpacing:'.07em',textTransform:'uppercase',fontWeight:600}}>
                Sua resposta:
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {conversa.opcoes.map((op,i)=>(
                  <button key={i} onClick={()=>responderOpcao(op)}
                    style={{padding:'10px 14px',borderRadius:11,cursor:'pointer',
                      fontFamily:'var(--font-body)',fontSize:13,
                      outline:'none',textAlign:'left',
                      background:T.surfaceSub||'rgba(0,0,0,0.025)',
                      border:`1.5px solid ${T.border}`,
                      color:T.text,transition:'all .15s'}}
                    onMouseEnter={e=>{
                      e.currentTarget.style.background=`${activeSkin.color}18`;
                      e.currentTarget.style.borderColor=`${activeSkin.color}66`;
                      e.currentTarget.style.color=activeSkin.color;
                      e.currentTarget.style.transform='translateX(4px)';}}
                    onMouseLeave={e=>{
                      e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.025)';
                      e.currentTarget.style.borderColor=T.border;
                      e.currentTarget.style.color=T.text;
                      e.currentTarget.style.transform='none';}}>
                    {op.t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Painel lateral */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* Barras */}
          <Card style={{padding:'22px'}}>
            <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:16}}>
              Estado do Doko
            </div>
            {[
              {label:'Fome',   val:fome,   d:<path d="M3 11l19-9-9 19-2-8-8-2z"/>},
              {label:'Energia',val:energia,d:<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>},
              {label:'Sono',   val:sono,   d:<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>},
            ].map(({label,val,d})=>(
              <div key={label} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',
                  alignItems:'center',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,
                    fontSize:13,color:T.textS}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke={barColor(val)} strokeWidth="1.7" strokeLinecap="round">{d}</svg>
                    {label}
                  </div>
                  <span style={{fontSize:13,fontWeight:600,color:barColor(val)}}>
                    {Math.round(val)}%
                  </span>
                </div>
                <div style={{height:8,background:T.surfaceSub||'rgba(0,0,0,0.06)',
                  borderRadius:999,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${val}%`,borderRadius:999,
                    background:`linear-gradient(90deg,${barColor(val)},${barColor(val)}99)`,
                    transition:'width .5s ease',
                    boxShadow:`0 0 6px ${barColor(val)}55`}}/>
                </div>
              </div>
            ))}
            <StarDivider my={8} dim/>
            <div style={{fontSize:12,color:T.textT,textAlign:'center',marginTop:4}}>
              {mood==='feliz'?'Seu Doko está muito feliz!'
               :mood==='neutro'?'Seu Doko precisa de atenção'
               :'Seu Doko precisa de cuidados urgentes!'}
            </div>
          </Card>

          {/* Ações */}
          <Card style={{padding:'22px'}}>
            <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:14}}>
              Interagir
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                {fn:alimentar,       label:'Alimentar',     sub:showComidas?'Escolhendo comida...':'Escolha o que dar para o Doko',
                  d:<path d="M3 11l19-9-9 19-2-8-8-2z"/>},
                {fn:carinho,         label:'Fazer Carinho', sub:'Recupera energia +22',
                  d:<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>},
                {fn:iniciarConversa, label:'Conversar',     sub:`Sessão completa · ${pers.conversa.length} perguntas`,
                  d:<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>},
                {fn:toggleDormir,    label:dormindo?'Acordar':'Colocar pra Dormir',
                  sub:dormindo?`Dormindo... sono ${Math.round(sono)}%`:'Pausa o gasto de energia e fome',
                  d:dormindo
                    ?<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></>
                    :<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>},
              ].map(({fn,label,sub,d})=>(
                <button key={label} onClick={fn}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',
                    background:`${activeSkin.color}12`,
                    border:`1px solid ${activeSkin.color}33`,
                    borderRadius:12,cursor:'pointer',outline:'none',
                    fontFamily:'var(--font-body)',transition:'all .18s',textAlign:'left'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';
                    e.currentTarget.style.boxShadow=`0 6px 18px ${activeSkin.color}33`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='none';
                    e.currentTarget.style.boxShadow='none';}}>
                  <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
                    background:`linear-gradient(135deg,${activeSkin.color},${activeSkin.color}aa)`,
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="1.8" strokeLinecap="round">{d}</svg>
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:500,color:T.text}}>{label}</div>
                    <div style={{fontSize:12,color:T.textT,marginTop:1}}>{sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Dica do Doko */}
          <div style={{padding:'14px 16px',
            background:`linear-gradient(135deg,${activeSkin.color}14,${T.surface} 80%)`,
            border:`1px solid ${activeSkin.color}33`,borderRadius:12}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{width:30,height:30,borderRadius:'50%',overflow:'hidden',
                flexShrink:0,border:`2px solid ${activeSkin.color}55`}}>
                <img src={dokoImg}
                  style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:activeSkin.color,
                  letterSpacing:'.07em',textTransform:'uppercase',marginBottom:4}}>
                  Dica do {activeSkin.label}
                </div>
                <div style={{fontSize:12,color:T.textS,lineHeight:1.6}}>
                  {pers.dicas[Math.floor((Date.now()/60000)%pers.dicas.length)]}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const SettingsModal = ({activeTheme,onTheme,onClose}) => {
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:1000,
      background:'rgba(10,20,40,0.35)',backdropFilter:'blur(14px)',
      WebkitBackdropFilter:'blur(14px)',
      display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'rgba(255,255,255,0.96)',backdropFilter:'blur(24px)',
        border:'1px solid rgba(255,255,255,0.85)',borderRadius:22,
        padding:'28px',width:660,maxWidth:'90vw',
        boxShadow:'0 24px 64px rgba(0,0,0,0.20)',position:'relative'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:'#0D1B2E'}}>Configurações</div>
            <div style={{fontFamily:'var(--font-body)',fontSize:13,color:'#7A92A8',marginTop:2}}>Personalize o visual do sistema</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(0,0,0,0.06)',border:'none',
            borderRadius:'50%',width:32,height:32,cursor:'pointer',fontSize:16,
            color:'#3A5068',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr',gap:'0 18px'}}>
          {/* Modo Claro */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A92A8" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              <span style={{fontFamily:'var(--font-body)',fontSize:11,color:'#7A92A8',
                letterSpacing:'.09em',textTransform:'uppercase',fontWeight:600}}>MODO CLARO</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {['blue','purple','pink','green','orange'].map(key=>{
                const th=THEMES[key]; const isActive=activeTheme===key;
                return(<div key={key} onClick={()=>onTheme(key)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                    borderRadius:11,cursor:'pointer',
                    background:isActive?`${th.goldGl}`:'rgba(0,0,0,0.03)',
                    border:`1.5px solid ${isActive?th.goldLine+'66':'rgba(0,0,0,0.06)'}`,
                    transition:'all .18s'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                    background:`linear-gradient(135deg,${th.goldV},${th.goldL},${th.gold})`,
                    boxShadow:isActive?`0 0 0 2px white,0 0 0 3.5px ${th.goldL}`:
                      `0 2px 6px ${th.gold}44`}}/>
                  <div style={{flex:1,fontFamily:'var(--font-body)',fontSize:13,
                    fontWeight:isActive?500:400,color:isActive?th.gold:'#0D1B2E'}}>{th.name}</div>
                  {isActive&&<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8L7 11L12 5.5" stroke={th.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </div>);
              })}
            </div>
          </div>
          {/* Divider */}
          <div style={{background:'rgba(0,0,0,0.08)',borderRadius:1}}/>
          {/* Modo Escuro */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A92A8" strokeWidth="1.7" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
              <span style={{fontFamily:'var(--font-body)',fontSize:11,color:'#7A92A8',
                letterSpacing:'.09em',textTransform:'uppercase',fontWeight:600}}>MODO ESCURO</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {['blueDark','purpleDark','pinkDark','greenDark','orangeDark'].map(key=>{
                const th=THEMES[key]; const isActive=activeTheme===key;
                if(!th)return null;
                return(<div key={key} onClick={()=>onTheme(key)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                    borderRadius:11,cursor:'pointer',
                    background:isActive?`${th.goldGl}`:'rgba(0,0,0,0.03)',
                    border:`1.5px solid ${isActive?th.goldLine+'66':'rgba(0,0,0,0.06)'}`,
                    transition:'all .18s'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                    background:`linear-gradient(135deg,${th.page},${th.gold}88,${th.goldL})`,
                    boxShadow:isActive?`0 0 0 2px white,0 0 0 3.5px ${th.goldL}`:
                      `0 2px 6px ${th.gold}55`,
                    border:`1px solid ${th.goldLine}44`}}/>
                  <div style={{flex:1,fontFamily:'var(--font-body)',fontSize:13,
                    fontWeight:isActive?500:400,color:isActive?th.gold:'#0D1B2E'}}>{th.name}</div>
                  {isActive&&<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8L7 11L12 5.5" stroke={th.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </div>);
              })}
            </div>
          </div>
        </div>
        <div style={{marginTop:18,fontFamily:'var(--font-body)',fontSize:11,
          color:'#9AA8B8',textAlign:'center'}}>Clique fora para fechar</div>
      </div>
    </div>
  );
};


const Portal = ({onBack}) => {
  const [tab,st]=useState('inicio');
  const [activeTheme,setActiveTheme]=useState('blue');
  const [showSettings,setShowSettings]=useState(false);
  const handleTheme=(key)=>{applyTheme(key);setActiveTheme(key);};
  const render=()=>{
    if(tab==='inicio')     return <TabInicio setTab={st}/>;
    if(tab==='financeiro') return <TabFinanceiro/>;
    if(tab==='dados')      return <TabDados/>;
    if(tab==='horas')      return <TabHoras/>;
    if(tab==='feedback')   return <TabFeedback/>;
    if(tab==='eventos')    return <TabEventos/>;
    if(tab==='games')      return <TabGames/>;
    if(tab==='conquistas') return <TabConquistas/>;
    if(tab==='feed')        return <TabFeed/>;
    if(tab==='comunicados') return <TabComunicados/>;
    if(tab==='simulador')   return <TabSimulador/>;
    if(tab==='doko')        return <TabMyDoko/>;
    return null;
  };
  return(
    <div key={activeTheme} style={{display:'flex',minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)'}}>
      <Sidebar tab={tab} setTab={st} onBack={onBack} activeTheme={activeTheme} onTheme={handleTheme} onOpenSettings={()=>setShowSettings(true)}/>
      <div style={{marginLeft:252,flex:1,display:'flex',flexDirection:'column',minHeight:'100vh'}}>
        <TopBar tab={tab} onBack={()=>st('inicio')}/>
        <div style={{flex:1,padding:'28px 34px',overflowY:'auto',
          height:tab==='inicio'?'100vh':'calc(100vh - 52px)'}}>
          {render()}
        </div>
      </div>
      {showSettings && (
        <SettingsModal activeTheme={activeTheme}
          onTheme={(k)=>{handleTheme(k);}}
          onClose={()=>setShowSettings(false)}/>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════
   ROOT
══════════════════════════════════════════ */
export default function CrescentHub() {
  const [screen,ss]=useState('landing');
  return(
    <>
      <style>{FONTS}</style>
      <div style={{minHeight:'100vh',background:T.page,color:T.text,
        fontFamily:'var(--font-body)',position:'relative'}}>
        <LavaLamp/>
        <div style={{position:'relative',zIndex:1,minHeight:'100vh'}}>
          {screen==='landing'     && <LandingPage   onStart={()=>ss('login')}/>}
          {screen==='login'       && <LoginScreen    onLogin={()=>ss('modules')}/>}
          {screen==='modules'     && <ModuleSelector onSelect={id=>{if(id==='colaborador')ss('colaborador');if(id==='dashboard')ss('dashboard');}}/>}
          {screen==='colaborador' && <Portal         onBack={()=>ss('modules')}/>}
        </div>
      </div>
    </>
  );
}
