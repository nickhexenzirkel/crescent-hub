import React, { useState, useEffect, useRef } from "react";
import { createClient as _createSupabaseClient } from '@supabase/supabase-js';
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

// ─── FESTIVAL INTEGRATION ────────────────────────────────────────────────────
const SERVER_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) || 'http://localhost:3001';
const _supabase  = _createSupabaseClient(
  'https://sifcxfymkmlmbelzolbx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZmN4Znlta21sbWJlbHpvbGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjQ1NzYsImV4cCI6MjA5NTQwMDU3Nn0.YvMr2aAqfmyBMKky94YfvVSpCurzlet5tZlv4WfCvRA'
);

// Extrai cores dominantes da capa do álbum via Canvas
async function extractAlbumColors(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const W = 80, H = 80;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H).data;

        const region = (x1, y1, x2, y2) => {
          let r=0,g=0,b=0,n=0;
          for(let y=y1;y<y2;y++) for(let x=x1;x<x2;x++){
            const i=(y*W+x)*4; r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++;
          }
          return [Math.round(r/n), Math.round(g/n), Math.round(b/n)];
        };

        const boost = ([r,g,b], s=1.6) => {
          const avg=(r+g+b)/3;
          const clamp=v=>Math.min(255,Math.max(0,Math.round(v)));
          return `rgb(${clamp(avg+(r-avg)*s)},${clamp(avg+(g-avg)*s)},${clamp(avg+(b-avg)*s)})`;
        };

        resolve([
          boost(region(0,0,40,40)),
          boost(region(40,0,80,40)),
          boost(region(0,40,40,80)),
          boost(region(40,40,80,80)),
          boost(region(15,15,65,65)),
        ]);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}


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
// Lê o usuário autenticado do token JWT (sem verificação — só leitura do payload)
function getAuthUser() {
  try {
    const token = localStorage.getItem('ch_token');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return null; }
}

let USER = {
  name:'Colaborador', short:'Colaborador', role:'Colaborador', avatar:'CO', color:T.blue,
  cpf:'***.***.***-**', rg:'—', birth:'—',
  email:'—', phone:'—',
  street:'—', district:'—', cep:'—',
  city:'—', state:'CE', category:'CLT', cargo:'Colaborador',
  admission:'—', dependents:0, horasMes:'160h',
  salary:0, inss:0, ir:0, vt:0, va:0, hours:0,
  trophies:[],
};

// Atualiza USER com dados reais do token ao carregar a página
try {
  const _auth = getAuthUser();
  if (_auth) {
    USER.name   = _auth.name;
    USER.short  = _auth.name.split(' ')[0];
    USER.avatar = _auth.name.split(' ').map(n => n[0]).slice(0, 2).join('');
    USER.cpf    = _auth.cpf
      ? _auth.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-**')
      : '***.***.***-**';
  }
} catch {}
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

// Dados de equipe, eventos e ranking agora vêm do Supabase — sem mock
const TEAM_DATA = [];
const EVENTS    = [];
const RANK      = [];

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
  const [cpf,  setCpf]  = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const maskCpf = (v) => {
    const d = v.replace(/\D/g,'').slice(0,11);
    if(d.length<=3) return d;
    if(d.length<=6) return d.replace(/(\d{3})(\d+)/,'$1.$2');
    if(d.length<=9) return d.replace(/(\d{3})(\d{3})(\d+)/,'$1.$2.$3');
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d+)/,'$1.$2.$3-$4');
  };

  const go = async () => {
    const rawCpf = cpf.replace(/\D/g,'');
    if(rawCpf.length !== 11){ setErr('CPF inválido. Digite os 11 dígitos.'); return; }
    if(!pass){ setErr('Digite sua senha.'); return; }
    setErr(''); setLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/auth/login`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ cpf: rawCpf, password: pass }),
      });
      const data = await r.json();
      if(!r.ok){ setErr(data.error || 'Erro ao entrar.'); setLoading(false); return; }
      localStorage.setItem('ch_token', data.token);
      onLogin(data.user);
    } catch {
      setErr('Servidor offline. Verifique se o servidor está rodando.');
      setLoading(false);
    }
  };

  const handleKey = (e) => { if(e.key==='Enter') go(); };

  return(
    <div style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',position:'relative',zIndex:1}}>
      {/* LEFT */}
      <div className="fsu" style={{display:'flex',flexDirection:'column',alignItems:'center',
        justifyContent:'center',padding:64,
        background:'rgba(240,248,255,0.55)',backdropFilter:'blur(12px)',
        borderRight:`1px solid ${T.border}`}}>
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
      <div className="fsu2" style={{display:'flex',alignItems:'center',justifyContent:'center',padding:64}}>
        <div style={{width:'100%',maxWidth:400}}>
          <div style={{marginBottom:36}}>
            <div style={{fontFamily:'var(--font-body)',fontSize:28,fontWeight:600,color:T.text,marginBottom:7}}>
              Entrar no Sistema
            </div>
            <div style={{fontFamily:'var(--font-body)',fontSize:15,color:T.textS}}>
              Use seu CPF e a senha fornecida pelo RH
            </div>
          </div>

          {/* CPF */}
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,color:T.textS,marginBottom:6}}>
              CPF
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',
              borderRadius:11,border:`1.5px solid ${T.border}`,background:T.surface||'white'}}>
              <span style={{fontSize:15}}>🪪</span>
              <input
                value={cpf}
                onChange={e=>setCpf(maskCpf(e.target.value))}
                onKeyDown={handleKey}
                placeholder="000.000.000-00"
                autoFocus
                style={{flex:1,border:'none',outline:'none',background:'transparent',
                  fontSize:15,color:T.text,fontFamily:'var(--font-body)',letterSpacing:'.04em'}}/>
            </div>
          </div>

          {/* Senha */}
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,color:T.textS,marginBottom:6}}>
              Senha
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',
              borderRadius:11,border:`1.5px solid ${T.border}`,background:T.surface||'white'}}>
              <span style={{fontSize:15}}>🔒</span>
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e=>setPass(e.target.value)}
                onKeyDown={handleKey}
                placeholder="••••••••"
                style={{flex:1,border:'none',outline:'none',background:'transparent',
                  fontSize:15,color:T.text,fontFamily:'var(--font-body)'}}/>
              <button onClick={()=>setShowPass(s=>!s)}
                style={{border:'none',background:'transparent',cursor:'pointer',padding:'2px 4px',color:T.textD,fontSize:13,outline:'none'}}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {err&&(
            <div style={{fontFamily:'var(--font-body)',fontSize:13,color:T.danger||'#C04050',
              background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.20)',
              borderRadius:9,padding:'9px 14px',marginBottom:14}}>⚠️ {err}
            </div>
          )}

          <Btn v="primary" full onClick={go} disabled={loading}
            style={{padding:'14px',fontSize:15,borderRadius:11,justifyContent:'center',marginTop:4}}>
            {loading
              ? <span style={{display:'flex',alignItems:'center',gap:9}}>
                  <span style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',
                    borderTop:'2px solid #fff',borderRadius:'50%',
                    animation:'spin .7s linear infinite',display:'inline-block'}}/>
                  Entrando...
                </span>
              : 'Entrar'}
          </Btn>

          <div style={{textAlign:'center',marginTop:14}}>
            <span style={{fontFamily:'var(--font-body)',fontSize:13,color:T.textD}}>
              Esqueceu a senha? Fale com o RH
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
const ModuleSelector = ({onSelect, authUser, onLogout}) => {
  const [hov,sh]=useState(null);
  const isAdmin = authUser?.role === 'admin';
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
  const IcoPonto = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <circle cx="8"  cy="16" r="1.2" fill="currentColor"/>
      <circle cx="12" cy="16" r="1.2" fill="currentColor"/>
      <circle cx="16" cy="16" r="1.2" fill="currentColor"/>
    </svg>
  );
  const IcoAlexa = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M8 12a4 4 0 008 0"/>
      <line x1="8" y1="8" x2="8.01" y2="8" strokeWidth="2.5"/>
      <line x1="16" y1="8" x2="16.01" y2="8" strokeWidth="2.5"/>
    </svg>
  );
  const allMods=[
    {id:'colaborador', label:'Central do Colaborador',  sub:'Portal RH completo',    icon:IcoColab, color:T.gold, bg:T.goldGl, tag:'Principal', hi:true, adminOnly:false},
    {id:'alexa',       label:'Central Alexa',           sub:'Festival · Mural · Recados', icon:IcoAlexa, color:T.gold, bg:T.goldGl, tag:'Novo', hi:true, adminOnly:false},
    {id:'dashboard',   label:'Dashboard RH',            sub:'Gestão · Funcionários', icon:IcoDash,  color:T.gold, bg:T.goldGl, tag:'Admin', hi:true, adminOnly:true},
    {id:'ponto',       label:'Ponto Eletrônico',        sub:'Leitor de arquivo AFD', icon:IcoPonto, color:T.gold, bg:T.goldGl, tag:'Admin', hi:true, adminOnly:true},
  ];
  const mods = allMods.filter(m => !m.adminOnly || isAdmin);
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
        {authUser&&(
          <div style={{marginTop:16,display:'flex',alignItems:'center',gap:10,justifyContent:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:20,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
              <div style={{width:24,height:24,borderRadius:7,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white'}}>
                {authUser.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
              </div>
              <span style={{fontSize:13,fontWeight:600,color:T.text}}>{authUser.name}</span>
              {isAdmin&&<span style={{fontSize:10,color:T.gold,fontWeight:700,padding:'1px 6px',borderRadius:4,background:`${T.gold}18`}}>Admin</span>}
            </div>
            <button onClick={onLogout}
              style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,color:T.textD,fontFamily:'var(--font-body)',outline:'none'}}>
              Sair
            </button>
          </div>
        )}
      </div>

      <div className="fsu2" style={{display:'grid',gridTemplateColumns:`repeat(${mods.length},1fr)`,
        gap:18,width:'100%',maxWidth:1200}}>
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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const typeColor = { Feriado:T.blue, Confraternização:T.pink, Reunião:T.purple, Evento:T.gold, Outro:T.teal };

  useEffect(() => {
    const load = async () => {
      const { data } = await _supabase.from('calendar_events').select('*').order('event_date', { ascending: true });
      setEvents(data || []);
      setLoading(false);
    };
    load();
    const sub = _supabase.channel('tab_events_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, load)
      .subscribe();
    return () => _supabase.removeChannel(sub);
  }, []);

  const today = new Date();
  const yr = calMonth.getFullYear();
  const mo = calMonth.getMonth();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const firstDay    = new Date(yr, mo, 1).getDay();
  const monthName   = calMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const eventsThisMonth = events.filter(e => {
    const d = new Date(e.event_date + 'T12:00:00');
    return d.getFullYear() === yr && d.getMonth() === mo;
  });
  const daysWithEvents = new Set(eventsThisMonth.map(e => new Date(e.event_date + 'T12:00:00').getDate()));

  const prevMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Agenda corporativa de eventos">Eventos da Empresa</SHead>
      {loading
        ? <div style={{textAlign:'center',padding:40,color:T.textT}}>
            <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>
            Carregando eventos...
          </div>
        : <div style={{display:'grid',gridTemplateColumns:'1fr 295px',gap:20}}>
            <div>
              <div style={{fontSize:12,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:14,fontWeight:500}}>
                {monthName.toUpperCase()}
              </div>
              {eventsThisMonth.length === 0
                ? <Card style={{padding:'32px',textAlign:'center'}}>
                    <div style={{fontSize:32,marginBottom:8}}>📅</div>
                    <div style={{color:T.textT,fontSize:14}}>Nenhum evento este mês.</div>
                  </Card>
                : eventsThisMonth.map((ev, i) => {
                    const d = new Date(ev.event_date + 'T12:00:00');
                    const day = d.getDate();
                    const isToday = d.toDateString() === today.toDateString();
                    const color = typeColor[ev.type] || T.gold;
                    return (
                      <div key={ev.id} style={{display:'flex',alignItems:'stretch',marginBottom:12}}>
                        <div style={{width:4,background:`linear-gradient(180deg,${color},${color}44)`,borderRadius:4,flexShrink:0,marginRight:14}}/>
                        <Card style={{flex:1,padding:'15px 20px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:14}}>
                            <div style={{width:52,textAlign:'center',flexShrink:0}}>
                              <div style={{fontSize:22,fontWeight:700,color:isToday?T.gold:T.text}}>{day}</div>
                              <div style={{fontSize:10,color:T.textD,letterSpacing:'.06em'}}>
                                {d.toLocaleString('pt-BR',{month:'short'}).toUpperCase()}
                              </div>
                            </div>
                            <div style={{flex:1}}>
                              <div style={{marginBottom:6}}><Tag color={color}>{ev.type}</Tag></div>
                              <div style={{fontSize:15,fontWeight:500,color:T.text}}>{ev.title}</div>
                              <div style={{fontSize:12,color:T.textT,marginTop:2}}>◷ {ev.event_time||'Dia todo'}</div>
                              {ev.description&&<div style={{fontSize:12,color:T.textS,marginTop:4}}>{ev.description}</div>}
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  })
              }
            </div>
            {/* Mini calendário */}
            <Card style={{padding:'22px',alignSelf:'start'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <button onClick={prevMonth} style={{background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:17,padding:4}}>‹</button>
                <span style={{fontSize:13,fontWeight:500,color:T.text,textTransform:'capitalize'}}>{monthName}</span>
                <button onClick={nextMonth} style={{background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:17,padding:4}}>›</button>
              </div>
              <StarDivider my={0}/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginTop:10,marginBottom:8}}>
                {['D','S','T','Q','Q','S','S'].map((d,i)=>(
                  <div key={i} style={{textAlign:'center',fontSize:10.5,color:T.textD,fontWeight:500,padding:'2px 0'}}>{d}</div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
                {Array.from({length:firstDay},(_,i)=><div key={`o${i}`}/>)}
                {Array.from({length:daysInMonth},(_,i)=>{
                  const d=i+1;
                  const isT = yr===today.getFullYear()&&mo===today.getMonth()&&d===today.getDate();
                  const hasEv = daysWithEvents.has(d);
                  return(
                    <div key={d} style={{textAlign:'center',padding:'6px 2px',borderRadius:7,position:'relative',
                      background:isT?T.gold:hasEv?T.goldGl:'transparent',
                      color:isT?'#fff':hasEv?T.gold:T.textS,
                      fontSize:12,fontWeight:isT?600:400}}>
                      {d}
                      {hasEv&&!isT&&<span style={{position:'absolute',bottom:1,left:'50%',transform:'translateX(-50%)',
                        width:3,height:3,borderRadius:'50%',background:T.goldL,display:'block'}}/>}
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:12}}><StarDivider my={0}/></div>
              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:7}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:2,background:T.gold}}/><span style={{fontSize:12,color:T.textS}}>Hoje</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:2,background:T.goldGl,border:`1px solid ${T.goldL}44`}}/><span style={{fontSize:12,color:T.textS}}>Com eventos</span>
                </div>
              </div>
            </Card>
          </div>
      }
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
  const auth = getAuthUser();
  const myTrophies = USER.trophies || [];
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Ranking de troféus da equipe">Conquistas</SHead>
      {/* Meus troféus */}
      <Card style={{padding:'28px',marginBottom:20,background:`linear-gradient(160deg,rgba(212,168,75,0.07),${T.surface} 55%)`}} elevated>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14}}>
          <span style={{fontSize:20}}>🏆</span>
          <span style={{fontSize:19,fontWeight:600,color:T.text}}>Meus Troféus</span>
        </div>
        <StarDivider my={10}/>
        {myTrophies.length === 0
          ? <div style={{textAlign:'center',padding:'24px 0',color:T.textT,fontSize:14}}>
              Você ainda não recebeu nenhum troféu.<br/>
              <span style={{fontSize:12,opacity:.7}}>Os troféus são concedidos pelo RH.</span>
            </div>
          : <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:8}}>
              {myTrophies.map((t,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:10,background:T.goldGl,border:`1px solid ${T.goldLine}33`}}>
                  <span style={{fontSize:20}}>{t.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:T.gold}}>{t.label}</div>
                    <div style={{fontSize:11,color:T.textT}}>de {t.from}</div>
                  </div>
                </div>
              ))}
            </div>
        }
      </Card>
      {/* Ranking */}
      <Card style={{padding:'28px'}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14}}>
          <span style={{fontSize:20}}>👑</span>
          <span style={{fontSize:19,fontWeight:600,color:T.text}}>Ranking da Equipe</span>
        </div>
        <StarDivider my={10}/>
        <div style={{textAlign:'center',padding:'32px 0',color:T.textT,fontSize:14}}>
          O ranking será construído conforme troféus forem concedidos pelo RH.<br/>
          <span style={{fontSize:12,opacity:.7}}>Acesse o Dashboard RH → Troféus para premiar colaboradores.</span>
        </div>
      </Card>
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
/* ══════════════════════════════════════════════════
   ADMIN LOGIN MODAL
══════════════════════════════════════════════════ */
const AdminLoginModal = ({onSuccess, onCancel}) => {
  const [pw, setPw]     = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr]   = useState('');
  const [shake, setShake] = useState(false);
  const ADMIN_PW = 'ColumbinaCleyNick50';
  // Dark mode detection
  const isDark   = !!T.page;
  const modalBg  = isDark ? T.surface : (T.surfaceW||'rgba(255,255,255,0.97)');
  const inputBg  = isDark ? (T.surfaceSub||'rgba(255,255,255,0.06)') : (T.surface||'white');
  const tryLogin = () => {
    if (pw === ADMIN_PW) { onSuccess(); }
    else {
      setErr('Senha incorreta. Apenas administradores têm acesso.');
      setShake(true); setTimeout(()=>setShake(false), 500);
    }
  };
  return(
    <div onClick={onCancel} style={{position:'fixed',inset:0,zIndex:2000,
      background:'rgba(6,10,20,0.65)',backdropFilter:'blur(18px)',
      WebkitBackdropFilter:'blur(18px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:modalBg,
        backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',
        border:`1px solid ${T.border}`,borderRadius:22,
        padding:'36px 40px',width:400,maxWidth:'90vw',
        boxShadow:'0 32px 80px rgba(0,0,0,0.38)',
        transition:'transform .08s ease'}}>
        {/* Shield icon */}
        <div style={{width:56,height:56,borderRadius:16,
          background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
          display:'flex',alignItems:'center',justifyContent:'center',
          margin:'0 auto 20px',boxShadow:`0 8px 24px ${T.goldLine}55`}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontFamily:'var(--font-brand)',fontSize:20,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Acesso Restrito</div>
          <div style={{fontSize:13,color:T.textT,marginTop:4}}>Área exclusiva para administradores do sistema</div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:7}}>Senha de Administrador</label>
          <div style={{position:'relative'}}>
            <input type={show?'text':'password'} value={pw}
              onChange={e=>{setPw(e.target.value);setErr('');}}
              onKeyDown={e=>e.key==='Enter'&&tryLogin()}
              autoFocus
              placeholder="Digite a senha..."
              style={{width:'100%',padding:'11px 42px 11px 14px',border:`2px solid ${err?T.danger||'#C04050':pw?T.goldLine+'88':T.border}`,borderRadius:10,fontFamily:'var(--font-body)',fontSize:14,color:T.text,background:inputBg,outline:'none',transition:'border-color .15s',boxSizing:'border-box'}}/>
            <button onClick={()=>setShow(s=>!s)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.textD,fontSize:16,lineHeight:1,padding:0}}>
              {show?'🙈':'👁'}
            </button>
          </div>
          {err&&<div style={{marginTop:7,fontSize:12,color:'#C04050',display:'flex',alignItems:'center',gap:5}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {err}
          </div>}
        </div>
        <button onClick={tryLogin} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:14,fontWeight:700,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',boxShadow:`0 4px 16px ${T.goldLine}55`,transition:'transform .1s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e=>e.currentTarget.style.transform='none'}>
          Entrar no Dashboard RH
        </button>
        <button onClick={onCancel} style={{width:'100%',marginTop:10,padding:'10px',borderRadius:10,border:`1px solid ${T.border}`,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,color:T.textS,background:isDark?T.surfaceSub||'rgba(255,255,255,0.04)':'transparent'}}>
          Cancelar
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   DASHBOARD RH — PAINEL ADMINISTRATIVO
══════════════════════════════════════════════════ */
const ADMIN_PW = 'ColumbinaCleyNick50';
const DashboardRH = ({onBack, adminName='Administrador'}) => {
  // Dark mode detection (same pattern as PontoEletronico)
  const isDark   = !!T.page;
  const cardBg   = isDark ? T.surface : (T.surfaceW||'rgba(255,255,255,0.85)');
  const headerBg = isDark ? `${T.surface}ee` : (T.surfaceW||'rgba(255,255,255,0.82)');
  const tabsBg   = isDark ? `${T.surface}cc` : (T.surfaceW||'rgba(255,255,255,0.75)');
  const [tab, setTab]         = useState('funcionarios');
  const [users, setUsers]     = useState([]);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser]         = useState({name:'',email:'',role:'colaborador',dept:'',pw:'',pw2:''});
  const [newUserErr, setNewUserErr]   = useState('');
  const [editProfile, setEditProfile] = useState(null);
  const [trophyTarget, setTrophyTarget] = useState(null);
  const [trophyType, setTrophyType]   = useState('ouro');
  const [trophyMsg, setTrophyMsg]     = useState('');
  const [trophyHistory, setTrophyHistory] = useState([]);
  const [bancoExtra] = useState([
    {id:1,col:'Maria Santos',date:'20/05/2026',tipo:'Hora Extra',valor:'+2h30',status:'pendente',obs:'Ficou além do horário para entrega do relatório'},
    {id:2,col:'João Alves',date:'19/05/2026',tipo:'Banco Negativo',valor:'-1h00',status:'aprovado',obs:'Saída antecipada autorizada pelo gestor'},
    {id:3,col:'Fernanda Costa',date:'18/05/2026',tipo:'Hora Extra',valor:'+1h45',status:'pendente',obs:'Reunião com cliente fora do horário'},
    {id:4,col:'Maria Santos',date:'15/05/2026',tipo:'Hora Extra',valor:'+3h00',status:'rejeitado',obs:'Horas não autorizadas previamente'},
  ]);
  const [changePw, setChangePw] = useState({old:'',new1:'',new2:''});
  const [changePwMsg, setChangePwMsg] = useState('');

  // ── Funcionários (real, conectado ao servidor) ───────────
  const [empList, setEmpList]         = useState([]);
  const [empLoading, setEmpLoading]   = useState(false);
  const [empModal, setEmpModal]       = useState(null); // null | 'new' | {employee}
  const [empForm, setEmpForm]         = useState({name:'',cpf:'',role:'employee'});
  const [empFormErr, setEmpFormErr]   = useState('');
  const [empSaving, setEmpSaving]     = useState(false);
  const [pwModal, setPwModal]         = useState(null); // null | employee
  const [pwVal, setPwVal]             = useState('');
  const [pwMsg, setPwMsg]             = useState('');

  const authHeader = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('ch_token')||''}` });

  const loadEmployees = async () => {
    setEmpLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/employees`, { headers: authHeader() });
      const d = await r.json();
      setEmpList(d.employees || []);
    } catch { /* servidor offline */ }
    setEmpLoading(false);
  };

  const saveEmployee = async () => {
    const cpfClean = empForm.cpf.replace(/\D/g,'');
    if(!empForm.name.trim()){ setEmpFormErr('Nome obrigatório'); return; }
    if(cpfClean.length!==11){ setEmpFormErr('CPF deve ter 11 dígitos'); return; }
    setEmpSaving(true); setEmpFormErr('');
    try {
      const isEdit = empModal && empModal !== 'new';
      const url  = isEdit ? `${SERVER_URL}/api/employees/${empModal.id}` : `${SERVER_URL}/api/employees`;
      const meth = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, { method:meth, headers: authHeader(), body: JSON.stringify({ name:empForm.name.trim(), cpf:cpfClean, role:empForm.role }) });
      const d = await r.json();
      if(!r.ok){ setEmpFormErr(d.error||'Erro ao salvar'); setEmpSaving(false); return; }
      await loadEmployees();
      setEmpModal(null); setEmpForm({name:'',cpf:'',role:'employee'});
    } catch { setEmpFormErr('Erro de conexão'); }
    setEmpSaving(false);
  };

  const toggleActive = async (emp) => {
    await fetch(`${SERVER_URL}/api/employees/${emp.id}`, { method:'PUT', headers: authHeader(), body: JSON.stringify({ active: !emp.active }) });
    await loadEmployees();
  };

  const resetPassword = async () => {
    if(!pwVal.trim()){ setPwMsg('Digite a nova senha'); return; }
    const r = await fetch(`${SERVER_URL}/api/employees/${pwModal.id}/password`, { method:'PUT', headers: authHeader(), body: JSON.stringify({ password: pwVal }) });
    const d = await r.json();
    if(r.ok){ setPwMsg('✅ Senha redefinida!'); setTimeout(()=>{ setPwModal(null); setPwVal(''); setPwMsg(''); }, 1500); }
    else setPwMsg(d.error||'Erro');
  };

  const maskCpfDisp = (v) => v; // já vem mascarado do servidor

  useEffect(()=>{ if(tab==='funcionarios') loadEmployees(); }, [tab]);

  // ── Gerenciar Usuários — perfil completo ─────────────────
  const [gerList, setGerList]         = useState([]);
  const [gerLoading, setGerLoading]   = useState(false);
  const [gerModal, setGerModal]       = useState(null); // null | employee
  const [gerForm, setGerForm]         = useState({});
  const [gerSaving, setGerSaving]     = useState(false);
  const [gerMsg, setGerMsg]           = useState('');

  const loadGerList = async () => {
    setGerLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/employees`, { headers: authHeader() });
      const d = await r.json();
      setGerList(d.employees || []);
    } catch {}
    setGerLoading(false);
  };

  const openGerModal = async (emp) => {
    setGerMsg('');
    try {
      const r = await fetch(`${SERVER_URL}/api/employees/${emp.id}`, { headers: authHeader() });
      const d = await r.json();
      setGerForm(d.employee || emp);
    } catch { setGerForm(emp); }
    setGerModal(emp);
  };

  const saveGerProfile = async () => {
    setGerSaving(true); setGerMsg('');
    const r = await fetch(`${SERVER_URL}/api/employees/${gerModal.id}/profile`, {
      method: 'PUT', headers: authHeader(),
      body: JSON.stringify(gerForm),
    });
    const d = await r.json();
    if (r.ok) { setGerMsg('✅ Perfil salvo!'); await loadGerList(); setTimeout(()=>setGerMsg(''),2000); }
    else setGerMsg('⚠️ ' + (d.error||'Erro ao salvar'));
    setGerSaving(false);
  };

  useEffect(()=>{ if(tab==='gerenciar') loadGerList(); }, [tab]);

  // ── Calendário ────────────────────────────────────────────
  const [calEvents, setCalEvents]     = useState([]);
  const [calLoading, setCalLoading]   = useState(false);
  const [calModal, setCalModal]       = useState(null); // null | 'new' | event
  const [calForm, setCalForm]         = useState({title:'',event_date:'',event_time:'Dia todo',type:'Evento',description:''});
  const [calSaving, setCalSaving]     = useState(false);
  const [calMsg, setCalMsg]           = useState('');

  const loadCalEvents = async () => {
    setCalLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/events`);
      const d = await r.json();
      setCalEvents(d.events || []);
    } catch {}
    setCalLoading(false);
  };

  const saveCalEvent = async () => {
    if (!calForm.title || !calForm.event_date) { setCalMsg('⚠️ Título e data obrigatórios'); return; }
    setCalSaving(true); setCalMsg('');
    const isEdit = calModal && calModal !== 'new';
    const url  = isEdit ? `${SERVER_URL}/api/events/${calModal.id}` : `${SERVER_URL}/api/events`;
    const meth = isEdit ? 'PUT' : 'POST';
    const r = await fetch(url, { method:meth, headers: authHeader(), body: JSON.stringify(calForm) });
    const d = await r.json();
    if (r.ok) { await loadCalEvents(); setCalModal(null); setCalForm({title:'',event_date:'',event_time:'Dia todo',type:'Evento',description:''}); }
    else setCalMsg('⚠️ ' + (d.error||'Erro'));
    setCalSaving(false);
  };

  const deleteCalEvent = async (id) => {
    if (!window.confirm('Remover este evento?')) return;
    await fetch(`${SERVER_URL}/api/events/${id}`, { method:'DELETE', headers: authHeader() });
    await loadCalEvents();
  };

  useEffect(()=>{ if(tab==='calendario') loadCalEvents(); }, [tab]);

  const genPw = () => {
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    return Array.from({length:10},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  };

  const saveNewUser = () => {
    if(!newUser.name.trim()){setNewUserErr('Nome obrigatório');return;}
    if(!newUser.email.includes('@')){setNewUserErr('E-mail inválido');return;}
    if(!newUser.pw){setNewUserErr('Defina uma senha');return;}
    if(newUser.pw!==newUser.pw2){setNewUserErr('As senhas não coincidem');return;}
    setUsers(prev=>[...prev,{id:Date.now(),...newUser,status:'ativo',lastLogin:'—'}]);
    setNewUser({name:'',email:'',role:'colaborador',dept:'',pw:'',pw2:''});
    setShowNewUser(false); setNewUserErr('');
  };

  const sendTrophy = () => {
    if(!trophyTarget||!trophyMsg.trim()) return;
    setTrophyHistory(prev=>[{id:Date.now(),to:trophyTarget,type:trophyType,msg:trophyMsg,date:new Date().toLocaleDateString('pt-BR'),from:adminName},...prev]);
    setTrophyTarget(null); setTrophyMsg('');
  };

  const tabSt = v=>({
    display:'flex',alignItems:'center',gap:8,padding:'10px 16px',borderRadius:10,
    cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,
    fontWeight:tab===v?600:400,textAlign:'left',border:'none',
    background:tab===v?`${T.gold}18`:'transparent',
    color:tab===v?T.gold:T.textS,
    transition:'all .15s',width:'100%',
  });

  const TABS=[
    {id:'funcionarios',   label:'Funcionários',      icon:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></>},
    {id:'gerenciar',      label:'Gerenciar Usuários', icon:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>},
    {id:'banco',          label:'Banco Extra',        icon:<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/><line x1="19" y1="5" x2="22" y2="5"/><line x1="22" y1="3" x2="22" y2="7"/></>},
    {id:'calendario',     label:'Calendário',         icon:<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>},
    {id:'perfis',         label:'Perfis',             icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>},
    {id:'alexa',          label:'Central Alexa',      icon:<><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 010 20"/><path d="M12 6a6 6 0 010 12"/><path d="M12 22v-4M12 6V2"/></>},
    {id:'trofeus',        label:'Troféus',            icon:<><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></>},
    {id:'config',         label:'Configurações',      icon:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>},
  ];

  return(
    <div style={{minHeight:'100vh',background:'transparent',fontFamily:'var(--font-body)',display:'flex',flexDirection:'column',position:'relative'}}>
      <style>{`
        @keyframes hdrBlob1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(28px,-8px) scale(1.15)} 66%{transform:translate(-12px,10px) scale(0.92)} }
        @keyframes hdrBlob2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-22px,12px) scale(1.08)} 80%{transform:translate(16px,-6px) scale(0.9)} }
        @keyframes hdrBlob3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,14px) scale(1.12)} }
      `}</style>
      {/* Topbar */}
      <div style={{height:56,background:T.topbarBg||cardBg,backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 24px',gap:12,position:'sticky',top:0,zIndex:200,boxShadow:`0 1px 20px ${T.goldLine}22`}}>
        <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:13,fontFamily:'var(--font-body)',padding:'4px 8px',borderRadius:7,transition:'background .1s'}}
          onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
          onMouseLeave={e=>e.currentTarget.style.background='none'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Módulos
        </button>
        <div style={{width:1,height:20,background:T.border}}/>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span style={{fontSize:14,fontWeight:700,color:T.text,fontFamily:'var(--font-brand)',letterSpacing:'.04em'}}>Dashboard RH</span>
        <Tag color={T.gold}>Admin</Tag>
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 12px',borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
          <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white'}}>
            {adminName.split(' ').map(n=>n[0]).slice(0,2).join('')}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.text}}>{adminName}</div>
            <div style={{fontSize:10,color:T.gold,fontWeight:500}}>Administrador</div>
          </div>
        </div>
        <Logo size={28}/>
      </div>

      {/* Body: sidebar + content */}
      <div style={{display:'flex',flex:1,maxWidth:1400,margin:'0 auto',width:'100%',padding:'24px 24px',gap:20,alignItems:'flex-start'}}>
              {/* Sidebar com identidade visual Crescent Hub */}
        <div style={{width:220,flexShrink:0,display:'flex',flexDirection:'column',gap:0,
          background:tabsBg,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
          border:`1px solid ${T.border}`,borderRadius:16,overflow:'hidden',
          boxShadow:`0 4px 24px rgba(0,0,0,0.08)`,position:'relative',alignSelf:'flex-start',
          minHeight:500}}>

          {/* Blobs decorativos no sidebar header */}
          <div style={{position:'relative',overflow:'hidden',padding:'18px 16px 14px',
            borderBottom:`1px solid ${T.border}`,
            background:`linear-gradient(135deg,${T.goldGl},transparent)`}}>
            <div style={{position:'absolute',width:70,height:70,borderRadius:'50%',background:T.gold,filter:'blur(22px)',opacity:0.18,top:'-15px',left:'10%',animation:'hdrBlob1 6s ease-in-out infinite'}}/>
            <div style={{position:'absolute',width:50,height:50,borderRadius:'50%',background:T.goldL||T.gold,filter:'blur(16px)',opacity:0.15,top:'5px',left:'65%',animation:'hdrBlob2 8s ease-in-out infinite'}}/>
            {/* Logo + nome */}
            <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:10}}>
              <Logo size={30}/>
              <div>
                <div style={{fontFamily:'var(--font-brand)',fontSize:12,fontWeight:700,color:T.text,letterSpacing:'.08em'}}>CRESCENT HUB</div>
                <div style={{fontSize:10,color:T.gold,fontWeight:600,letterSpacing:'.05em'}}>Dashboard RH</div>
              </div>
            </div>
          </div>

          {/* Admin badge */}
          <div style={{padding:'10px 14px 4px',borderBottom:`1px solid ${T.border}`}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
              <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                {adminName.split(' ').map(n=>n[0]).slice(0,2).join('')}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{adminName}</div>
                <div style={{fontSize:10,color:T.gold,fontWeight:500}}>Administrador</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div style={{padding:'10px 10px',display:'flex',flexDirection:'column',gap:2}}>
            <div style={{fontSize:9,fontWeight:700,color:T.textD,textTransform:'uppercase',letterSpacing:'.12em',padding:'0 6px 6px',borderBottom:`1px solid ${T.border}`,marginBottom:4}}>Menu</div>
            {TABS.map(({id,label,icon})=>(
              <button key={id} onClick={()=>setTab(id)} style={{
                display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:9,
                cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,
                fontWeight:tab===id?600:400,textAlign:'left',border:'none',width:'100%',
                background:tab===id?T.goldGl:'transparent',
                color:tab===id?T.gold:T.textS,
                transition:'all .15s',
              }}
                onMouseEnter={e=>{if(tab!==id)e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.03)';}}
                onMouseLeave={e=>{if(tab!==id)e.currentTarget.style.background='transparent';}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{flexShrink:0,color:tab===id?T.gold:T.textD}}>{icon}</svg>
                {label}
                {tab===id&&<div style={{marginLeft:'auto',width:4,height:16,borderRadius:2,background:T.gold}}/>}
              </button>
            ))}
          </div>

          {/* Bottom warning */}
          <div style={{marginTop:'auto',padding:'12px',borderTop:`1px solid ${T.border}`}}>
            <div style={{padding:'9px 11px',borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}33`}}>
              <div style={{fontSize:9,color:T.gold,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>⚠ Área Restrita</div>
              <div style={{fontSize:10,color:T.textT,lineHeight:1.4}}>Ações registradas no log do sistema.</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:16}}>

          {/* ── TAB: FUNCIONÁRIOS (real, Supabase) ── */}
          {tab==='funcionarios'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Funcionários</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>{empList.length} cadastrados · {empList.filter(e=>e.role==='admin').length} admins · {empList.filter(e=>!e.active).length} inativos</div>
                </div>
                <button onClick={()=>{ setEmpForm({name:'',cpf:'',role:'employee'}); setEmpFormErr(''); setEmpModal('new'); }}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                  + Novo Funcionário
                </button>
              </div>

              {/* Table */}
              <div style={{borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.sh,overflow:'hidden'}}>
                {/* Head */}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 80px 80px 120px',gap:0,padding:'10px 20px',borderBottom:`1px solid ${T.border}`,background:`${T.gold}08`}}>
                  {['Nome','CPF','Cargo','Status','Ações'].map(h=>(
                    <div key={h} style={{fontSize:11,fontWeight:700,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em'}}>{h}</div>
                  ))}
                </div>
                {empLoading
                  ? <div style={{padding:'32px',textAlign:'center',color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>
                      Carregando...
                    </div>
                  : empList.length===0
                    ? <div style={{padding:'32px',textAlign:'center',color:T.textT,fontSize:13}}>Nenhum funcionário cadastrado ainda.</div>
                    : empList.map((emp,i)=>(
                        <div key={emp.id} style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 80px 80px 120px',gap:0,padding:'12px 20px',borderTop:i===0?'none':`1px solid ${T.border}`,alignItems:'center',opacity:emp.active?1:0.55,transition:'opacity .15s'}}>
                          {/* Nome */}
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
                              {emp.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
                            </div>
                            <div>
                              <div style={{fontSize:13,fontWeight:600,color:T.text}}>{emp.name}</div>
                              <div style={{fontSize:10,color:T.textT}}>desde {new Date(emp.created_at).toLocaleDateString('pt-BR')}</div>
                            </div>
                          </div>
                          {/* CPF */}
                          <div style={{fontSize:12,color:T.textS,fontFamily:'monospace'}}>{emp.cpf}</div>
                          {/* Role */}
                          <div>
                            <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,
                              background:emp.role==='admin'?`${T.gold}18`:'rgba(0,0,0,0.04)',
                              color:emp.role==='admin'?T.gold:T.textS}}>
                              {emp.role==='admin'?'Admin':'Func.'}
                            </span>
                          </div>
                          {/* Status */}
                          <div>
                            <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,
                              background:emp.active?'rgba(34,197,94,0.1)':'rgba(192,64,80,0.08)',
                              color:emp.active?'#16a34a':'#C04050'}}>
                              {emp.active?'Ativo':'Inativo'}
                            </span>
                          </div>
                          {/* Ações */}
                          <div style={{display:'flex',gap:5}}>
                            <button onClick={()=>{ setEmpForm({name:emp.name,cpf:emp.cpf,role:emp.role}); setEmpFormErr(''); setEmpModal(emp); }}
                              title="Editar"
                              style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none'}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={()=>{ setPwVal(''); setPwMsg(''); setPwModal(emp); }}
                              title="Redefinir senha"
                              style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none'}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            </button>
                            <button onClick={()=>toggleActive(emp)}
                              title={emp.active?'Desativar':'Ativar'}
                              style={{width:28,height:28,borderRadius:7,border:`1px solid ${emp.active?'rgba(192,64,80,0.3)':T.border}`,background:emp.active?'rgba(192,64,80,0.06)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:emp.active?'#C04050':T.textS,outline:'none'}}>
                              {emp.active
                                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              }
                            </button>
                          </div>
                        </div>
                      ))
                }
              </div>

              {/* Modal novo/editar */}
              {empModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                  <div style={{background:cardBg,borderRadius:18,padding:32,width:400,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:20}}>
                      {empModal==='new'?'Novo Funcionário':'Editar Funcionário'}
                    </div>
                    {/* Nome */}
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:5}}>Nome completo</div>
                      <input value={empForm.name} onChange={e=>setEmpForm(f=>({...f,name:e.target.value}))}
                        placeholder="Ex: Maria da Silva"
                        style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                    </div>
                    {/* CPF */}
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:5}}>CPF</div>
                      <input value={empForm.cpf} onChange={e=>setEmpForm(f=>({...f,cpf:e.target.value}))}
                        placeholder="000.000.000-00"
                        disabled={empModal!=='new'}
                        style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:empModal==='new'?(T.surface||'white'):`${T.border}44`,fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)',cursor:empModal==='new'?'text':'not-allowed'}}/>
                      {empModal==='new'&&<div style={{fontSize:11,color:T.textD,marginTop:4}}>💡 Senha inicial = CPF (somente números)</div>}
                    </div>
                    {/* Cargo */}
                    <div style={{marginBottom:20}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:5}}>Cargo</div>
                      <select value={empForm.role} onChange={e=>setEmpForm(f=>({...f,role:e.target.value}))}
                        style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                        <option value="employee">Funcionário</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    {empFormErr&&<div style={{fontSize:12,color:'#C04050',marginBottom:12,padding:'7px 12px',borderRadius:7,background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)'}}>⚠️ {empFormErr}</div>}
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>{setEmpModal(null);setEmpFormErr('');}}
                        style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                        Cancelar
                      </button>
                      <button onClick={saveEmployee} disabled={empSaving}
                        style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:empSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        {empSaving?'Salvando...':'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal redefinir senha */}
              {pwModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                  <div style={{background:cardBg,borderRadius:18,padding:32,width:360,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:6}}>Redefinir Senha</div>
                    <div style={{fontSize:13,color:T.textS,marginBottom:20}}>{pwModal.name}</div>
                    <input value={pwVal} onChange={e=>setPwVal(e.target.value)}
                      placeholder="Nova senha"
                      style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)',marginBottom:14}}/>
                    <div style={{fontSize:11,color:T.textD,marginBottom:16}}>💡 Para usar o CPF como senha, digite somente os 11 números.</div>
                    {pwMsg&&<div style={{fontSize:12,color:pwMsg.startsWith('✅')?'#16a34a':'#C04050',marginBottom:12}}>{pwMsg}</div>}
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>setPwModal(null)}
                        style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                        Cancelar
                      </button>
                      <button onClick={resetPassword}
                        style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        Redefinir
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: GERENCIAR USUÁRIOS — perfil completo ── */}
          {tab==='gerenciar'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Gerenciar Usuários</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Clique em um colaborador para editar o perfil completo</div>
                </div>
                <button onClick={loadGerList} style={{padding:'8px 16px',borderRadius:9,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>↻ Atualizar</button>
              </div>
              <div style={{borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.sh,overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 1fr 80px 100px',padding:'10px 20px',borderBottom:`1px solid ${T.border}`,background:`${T.gold}08`}}>
                  {['Nome','CPF','Cargo','Status','Editar'].map(h=>(
                    <div key={h} style={{fontSize:11,fontWeight:700,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em'}}>{h}</div>
                  ))}
                </div>
                {gerLoading
                  ? <div style={{padding:32,textAlign:'center',color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>Carregando...
                    </div>
                  : gerList.map((emp,i)=>(
                      <div key={emp.id} style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 1fr 80px 100px',padding:'11px 20px',borderTop:i===0?'none':`1px solid ${T.border}`,alignItems:'center',opacity:emp.active?1:0.55}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                            {emp.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
                          </div>
                          <div style={{fontSize:13,fontWeight:500,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.name}</div>
                        </div>
                        <div style={{fontSize:11,color:T.textS,fontFamily:'monospace'}}>{emp.cpf}</div>
                        <div style={{fontSize:12,color:T.textT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.cargo||'—'}</div>
                        <div><span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:emp.active?'rgba(34,197,94,0.1)':'rgba(192,64,80,0.08)',color:emp.active?'#16a34a':'#C04050'}}>{emp.active?'Ativo':'Inativo'}</span></div>
                        <button onClick={()=>openGerModal(emp)}
                          style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                          ✏️ Editar
                        </button>
                      </div>
                    ))
                }
              </div>
              {/* Modal edição perfil completo */}
              {gerModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:20}}>
                  <div style={{background:cardBg,borderRadius:20,padding:32,width:'100%',maxWidth:620,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                      <div>
                        <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text}}>Editar Perfil</div>
                        <div style={{fontSize:13,color:T.textS}}>{gerModal.name}</div>
                      </div>
                      <button onClick={()=>setGerModal(null)} style={{border:'none',background:'transparent',cursor:'pointer',fontSize:20,color:T.textD,outline:'none'}}>×</button>
                    </div>
                    {/* Campos organizados em seções */}
                    {[
                      { title:'Dados Pessoais', fields:[
                        {label:'Nome completo',key:'name',type:'text'},
                        {label:'CPF',key:'cpf',type:'text',disabled:true},
                        {label:'RG',key:'rg',type:'text'},
                        {label:'Data de Nascimento',key:'birth_date',type:'text',placeholder:'DD/MM/AAAA'},
                        {label:'E-mail',key:'email',type:'email'},
                        {label:'Telefone',key:'phone',type:'text',placeholder:'(85) 99999-9999'},
                      ]},
                      { title:'Endereço', fields:[
                        {label:'Rua / Logradouro',key:'street',type:'text'},
                        {label:'Bairro',key:'district',type:'text'},
                        {label:'Cidade',key:'city',type:'text'},
                        {label:'Estado',key:'state',type:'text'},
                        {label:'CEP',key:'cep',type:'text'},
                      ]},
                      { title:'Dados Profissionais', fields:[
                        {label:'Cargo',key:'cargo',type:'text'},
                        {label:'Categoria',key:'category',type:'text',placeholder:'CLT, PJ...'},
                        {label:'Data de Admissão',key:'admission',type:'text',placeholder:'DD/MM/AAAA'},
                        {label:'Nº de Dependentes',key:'dependents',type:'number'},
                        {label:'Cargo / Perfil',key:'role',type:'select',options:[{v:'employee',l:'Funcionário'},{v:'admin',l:'Administrador'}]},
                      ]},
                      { title:'Remuneração', fields:[
                        {label:'Salário Base (R$)',key:'salary',type:'number'},
                        {label:'INSS (R$)',key:'inss',type:'number'},
                        {label:'IR (R$)',key:'ir',type:'number'},
                        {label:'Vale Transporte (R$)',key:'vt',type:'number'},
                        {label:'Vale Alimentação (R$)',key:'va',type:'number'},
                      ]},
                    ].map(sec=>(
                      <div key={sec.title} style={{marginBottom:20}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.gold,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:12}}>{sec.title}</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                          {sec.fields.map(f=>(
                            <div key={f.key}>
                              <div style={{fontSize:11,fontWeight:600,color:T.textS,marginBottom:4}}>{f.label}</div>
                              {f.type==='select'
                                ? <select value={gerForm[f.key]||''} onChange={e=>setGerForm(p=>({...p,[f.key]:e.target.value}))}
                                    style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:12,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                                    {f.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                                  </select>
                                : <input type={f.type||'text'} value={gerForm[f.key]||''} disabled={f.disabled}
                                    placeholder={f.placeholder||''}
                                    onChange={e=>setGerForm(p=>({...p,[f.key]:f.type==='number'?Number(e.target.value):e.target.value}))}
                                    style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${T.border}`,background:f.disabled?(T.border+'44'):(T.surface||'white'),fontSize:12,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)',cursor:f.disabled?'not-allowed':'text'}}/>
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {gerMsg&&<div style={{fontSize:12,color:gerMsg.startsWith('✅')?'#16a34a':'#C04050',marginBottom:12,padding:'7px 12px',borderRadius:7,background:gerMsg.startsWith('✅')?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)'}}>{gerMsg}</div>}
                    <div style={{display:'flex',gap:10,marginTop:4}}>
                      <button onClick={()=>setGerModal(null)} style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>Cancelar</button>
                      <button onClick={saveGerProfile} disabled={gerSaving}
                        style={{flex:2,padding:'11px',borderRadius:10,border:'none',cursor:gerSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        {gerSaving?'Salvando...':'Salvar Perfil'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: CALENDÁRIO ── */}
          {tab==='calendario'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Calendário de Eventos</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Eventos criados aqui aparecem para todos os colaboradores</div>
                </div>
                <button onClick={()=>{ setCalForm({title:'',event_date:'',event_time:'Dia todo',type:'Evento',description:''}); setCalMsg(''); setCalModal('new'); }}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                  + Novo Evento
                </button>
              </div>
              <div style={{borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.sh,overflow:'hidden'}}>
                {calLoading
                  ? <div style={{padding:32,textAlign:'center',color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>Carregando...
                    </div>
                  : calEvents.length===0
                    ? <div style={{padding:40,textAlign:'center',color:T.textT,fontSize:13}}>
                        Nenhum evento cadastrado. Clique em <strong>+ Novo Evento</strong> para adicionar.
                      </div>
                    : calEvents.map((ev,i)=>{
                        const typeColor = {Feriado:T.blue,Reunião:T.purple,Confraternização:(T.pink||'#E91E8C'),Evento:T.gold,Outro:T.teal};
                        const color = typeColor[ev.type]||T.gold;
                        const d = new Date(ev.event_date+'T12:00:00');
                        return(
                          <div key={ev.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 20px',borderTop:i===0?'none':`1px solid ${T.border}`}}>
                            <div style={{width:44,textAlign:'center',flexShrink:0}}>
                              <div style={{fontSize:18,fontWeight:700,color:T.text}}>{d.getDate()}</div>
                              <div style={{fontSize:9,color:T.textD,textTransform:'uppercase'}}>{d.toLocaleString('pt-BR',{month:'short'})}</div>
                            </div>
                            <div style={{width:3,height:36,borderRadius:2,background:color,flexShrink:0}}/>
                            <div style={{flex:1}}>
                              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                                <Tag color={color}>{ev.type}</Tag>
                                <span style={{fontSize:11,color:T.textD}}>◷ {ev.event_time}</span>
                              </div>
                              <div style={{fontSize:14,fontWeight:500,color:T.text}}>{ev.title}</div>
                              {ev.description&&<div style={{fontSize:12,color:T.textT,marginTop:2}}>{ev.description}</div>}
                            </div>
                            <div style={{display:'flex',gap:6,flexShrink:0}}>
                              <button onClick={()=>{ setCalForm({title:ev.title,event_date:ev.event_date,event_time:ev.event_time,type:ev.type,description:ev.description||''}); setCalMsg(''); setCalModal(ev); }}
                                style={{width:30,height:30,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none',fontSize:14}}>✏️</button>
                              <button onClick={()=>deleteCalEvent(ev.id)}
                                style={{width:30,height:30,borderRadius:7,border:'1px solid rgba(192,64,80,0.3)',background:'rgba(192,64,80,0.05)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#C04050',outline:'none',fontSize:14}}>🗑</button>
                            </div>
                          </div>
                        );
                      })
                }
              </div>
              {/* Modal criar/editar evento */}
              {calModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                  <div style={{background:cardBg,borderRadius:18,padding:32,width:420,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:20}}>
                      {calModal==='new'?'Novo Evento':'Editar Evento'}
                    </div>
                    {[
                      {label:'Título do evento',key:'title',type:'text',placeholder:'Ex: Reunião trimestral'},
                      {label:'Data',key:'event_date',type:'date'},
                      {label:'Horário',key:'event_time',type:'text',placeholder:'Ex: 14:00 ou Dia todo'},
                    ].map(f=>(
                      <div key={f.key} style={{marginBottom:12}}>
                        <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>{f.label}</div>
                        <input type={f.type} value={calForm[f.key]||''} placeholder={f.placeholder||''}
                          onChange={e=>setCalForm(p=>({...p,[f.key]:e.target.value}))}
                          style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                      </div>
                    ))}
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Tipo</div>
                      <select value={calForm.type} onChange={e=>setCalForm(p=>({...p,type:e.target.value}))}
                        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                        {['Feriado','Reunião','Confraternização','Evento','Outro'].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Descrição (opcional)</div>
                      <textarea value={calForm.description||''} onChange={e=>setCalForm(p=>({...p,description:e.target.value}))}
                        placeholder="Detalhes do evento..."
                        rows={2}
                        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',resize:'vertical',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                    </div>
                    {calMsg&&<div style={{fontSize:12,color:'#C04050',marginBottom:12}}>{calMsg}</div>}
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>setCalModal(null)} style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>Cancelar</button>
                      <button onClick={saveCalEvent} disabled={calSaving}
                        style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:calSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        {calSaving?'Salvando...':'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: BANCO EXTRA ── */}
          {tab==='banco'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Banco de Horas Extra</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Solicitações enviadas pelos colaboradores via Central do Colaborador</div>
                </div>
                <Moon size={24} color={T.goldL} opacity={0.35} float/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {[{l:'Pendentes',v:bancoExtra.filter(b=>b.status==='pendente').length,c:'#D89030'},{l:'Aprovados',v:bancoExtra.filter(b=>b.status==='aprovado').length,c:'#1A9C70'},{l:'Rejeitados',v:bancoExtra.filter(b=>b.status==='rejeitado').length,c:'#C04050'}].map(({l,v,c})=>(
                  <Card key={l} style={{padding:'16px 20px'}} elevated>
                    <div style={{fontSize:28,fontWeight:700,color:c}}>{v}</div>
                    <div style={{fontSize:12,color:T.textT,marginTop:3}}>{l}</div>
                  </Card>
                ))}
              </div>
              <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                  <thead><tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                    {['Colaborador','Data','Tipo','Valor','Status','Observação','Ações'].map(h=>(
                      <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 14px'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {bancoExtra.map(b=>(
                      <tr key={b.id} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:T.text}}>{b.col}</td>
                        <td style={{padding:'11px 14px',fontSize:12,color:T.textS}}>{b.date}</td>
                        <td style={{padding:'11px 14px'}}>
                          <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:b.tipo==='Hora Extra'?'rgba(26,156,112,0.12)':'rgba(192,64,80,0.12)',color:b.tipo==='Hora Extra'?'#1A9C70':'#C04050'}}>{b.tipo}</span>
                        </td>
                        <td style={{padding:'11px 14px',fontSize:14,fontWeight:700,color:b.valor.startsWith('+')?'#1A9C70':'#C04050'}}>{b.valor}</td>
                        <td style={{padding:'11px 14px'}}>
                          <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:b.status==='pendente'?'rgba(216,144,48,0.15)':b.status==='aprovado'?'rgba(26,156,112,0.12)':'rgba(192,64,80,0.12)',color:b.status==='pendente'?'#D89030':b.status==='aprovado'?'#1A9C70':'#C04050'}}>{b.status}</span>
                        </td>
                        <td style={{padding:'11px 14px',fontSize:12,color:T.textS,maxWidth:200}}>{b.obs}</td>
                        <td style={{padding:'11px 14px'}}>
                          {b.status==='pendente'&&(
                            <div style={{display:'flex',gap:5}}>
                              <button style={{padding:'4px 10px',borderRadius:6,border:'1px solid rgba(26,156,112,0.3)',background:'rgba(26,156,112,0.10)',color:'#1A9C70',cursor:'pointer',fontSize:11,outline:'none',fontWeight:600}}>Aprovar</button>
                              <button style={{padding:'4px 10px',borderRadius:6,border:'1px solid rgba(192,64,80,0.3)',background:'rgba(192,64,80,0.08)',color:'#C04050',cursor:'pointer',fontSize:11,outline:'none'}}>Recusar</button>
                            </div>
                          )}
                          {b.status!=='pendente'&&<span style={{fontSize:11,color:T.textD}}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* ── TAB: PERFIS ── */}
          {tab==='perfis'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Dados Pessoais</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Somente administradores podem editar informações dos colaboradores</div>
                </div>
                <Moon size={24} color={T.goldL} opacity={0.35} float/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
                {users.filter(u=>u.role==='colaborador').map(u=>(
                  <Card key={u.id} style={{padding:'18px 20px',cursor:'pointer'}} elevated
                    onClick={()=>setEditProfile(editProfile?.id===u.id?null:u)}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                      <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#1E70B5,#0f4a80)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
                        {u.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
                      </div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:T.text}}>{u.name}</div>
                        <div style={{fontSize:11,color:T.textT}}>{u.dept||'Sem departamento'}</div>
                      </div>
                    </div>
                    <div style={{fontSize:12,color:T.textS}}>{u.email}</div>
                    <div style={{marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:5,background:u.status==='ativo'?'rgba(26,156,112,0.12)':'rgba(0,0,0,0.06)',color:u.status==='ativo'?'#1A9C70':T.textD}}>{u.status==='ativo'?'Ativo':'Inativo'}</span>
                      <span style={{fontSize:11,color:T.gold,fontWeight:600}}>✏ Editar</span>
                    </div>
                  </Card>
                ))}
              </div>
              {editProfile&&(
                <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',border:`1.5px solid ${T.goldLine}44`}} elevated>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:18}}>Editando: {editProfile.name}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
                    {[['name','Nome completo'],['email','E-mail'],['dept','Departamento'],['cargo','Cargo'],['admissao','Data de Admissão'],['telefone','Telefone']].map(([k,l])=>(
                      <div key={k}>
                        <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>{l}</label>
                        <input defaultValue={editProfile[k]||''}
                          style={{width:'100%',padding:'8px 12px',border:`1.5px solid ${T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',boxSizing:'border-box'}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={{padding:'9px 20px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,background:'linear-gradient(135deg,#1A9C70,#0f7a56)',color:'white'}}>Salvar Alterações</button>
                    <button onClick={()=>setEditProfile(null)} style={{padding:'9px 16px',borderRadius:9,border:`1px solid ${T.border}`,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,color:T.textS,background:'transparent'}}>Cancelar</button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── TAB: CENTRAL ALEXA ── */}
          {tab==='alexa'&&(()=>{
            const [alexaMsgs, setAlexaMsgs] = React.useState([
              {id:1,title:'Reunião de Equipe',msg:'Atenção! Reunião de equipe hoje às 14h na sala de conferências.',dest:'todos',status:'enviado',date:'23/05/2026',hora:'09:15'},
              {id:2,title:'Lembrete Ponto',msg:'Colaboradores, não esqueçam de bater o ponto ao sair.',dest:'todos',status:'enviado',date:'22/05/2026',hora:'17:45'},
              {id:3,title:'Manutenção do Sistema',msg:'O sistema ficará em manutenção hoje à noite entre 22h e 23h.',dest:'admins',status:'agendado',date:'26/05/2026',hora:'19:00'},
            ]);
            const [newAlexa, setNewAlexa] = React.useState({title:'',msg:'',dest:'todos',hora:'agora'});
            const [sending, setSending]   = React.useState(false);
            const [sent, setSent]         = React.useState(false);
            const sendAlexa = () => {
              if(!newAlexa.title||!newAlexa.msg) return;
              setSending(true);
              setTimeout(()=>{
                setAlexaMsgs(prev=>[{id:Date.now(),title:newAlexa.title,msg:newAlexa.msg,dest:newAlexa.dest,status:'enviado',date:new Date().toLocaleDateString('pt-BR'),hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})},...prev]);
                setNewAlexa({title:'',msg:'',dest:'todos',hora:'agora'});
                setSending(false); setSent(true);
                setTimeout(()=>setSent(false),3000);
              },1600);
            };
            return(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Central Alexa</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Anuncie comunicados para os colaboradores via alto-falante</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:8,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:'#1A9C70',animation:'blobGrad 1.5s ease infinite'}}/>
                    <span style={{fontSize:11,fontWeight:600,color:'#1A9C70'}}>Alexa Online</span>
                  </div>
                  <Moon size={24} color={T.goldL} opacity={0.35} float/>
                </div>
              </div>

              {/* Compose */}
              <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  Novo Comunicado
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>Título do Comunicado</label>
                    <input value={newAlexa.title} onChange={e=>setNewAlexa(p=>({...p,title:e.target.value}))}
                      placeholder="Ex: Reunião de Equipe, Aviso de Sistema..."
                      style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>Destinatário</label>
                    <select value={newAlexa.dest} onChange={e=>setNewAlexa(p=>({...p,dest:e.target.value}))}
                      style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',cursor:'pointer'}}>
                      <option value="todos">📢 Todos os colaboradores</option>
                      <option value="financeiro">💼 Departamento Financeiro</option>
                      <option value="comercial">🤝 Departamento Comercial</option>
                      <option value="operacoes">⚙️ Operações</option>
                      <option value="admins">🛡 Somente Administradores</option>
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>Mensagem do Comunicado</label>
                  <textarea value={newAlexa.msg} onChange={e=>setNewAlexa(p=>({...p,msg:e.target.value}))} rows={4}
                    placeholder="Digite a mensagem que será anunciada pela Alexa para os colaboradores..."
                    style={{width:'100%',padding:'10px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
                  <div style={{textAlign:'right',fontSize:11,color:T.textD,marginTop:4}}>{newAlexa.msg.length}/300 caracteres</div>
                </div>
                {/* Preview */}
                {newAlexa.msg&&(
                  <div style={{padding:'12px 16px',borderRadius:10,background:T.goldGl,border:`1px solid ${T.goldLine}44`,marginBottom:14,display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:T.gold,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:3}}>Prévia do Anúncio</div>
                      <div style={{fontSize:13,color:T.text,lineHeight:1.5}}>"{newAlexa.msg}"</div>
                    </div>
                  </div>
                )}
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <button onClick={sendAlexa} disabled={!newAlexa.title||!newAlexa.msg||sending}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'10px 24px',borderRadius:10,border:'none',cursor:newAlexa.title&&newAlexa.msg&&!sending?'pointer':'not-allowed',fontFamily:'var(--font-body)',fontSize:13,fontWeight:700,background:sending?T.surfaceSub:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:sending?T.textS:'white',boxShadow:sending?'none':`0 4px 14px ${T.goldLine}55`,opacity:newAlexa.title&&newAlexa.msg?1:0.5,transition:'all .2s'}}>
                    {sending?(
                      <><div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}}/> Enviando...</>
                    ):(
                      <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Anunciar pela Alexa</>
                    )}
                  </button>
                  {sent&&<div style={{fontSize:12,color:'#1A9C70',display:'flex',alignItems:'center',gap:5}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Comunicado enviado com sucesso!
                  </div>}
                </div>
              </Card>

              {/* Histórico */}
              <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(135deg,${T.goldGl},transparent)`}}>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:14,fontWeight:700,color:T.text}}>Histórico de Comunicados</div>
                  <span style={{fontSize:11,color:T.textT}}>{alexaMsgs.length} anúncio{alexaMsgs.length!==1?'s':''}</span>
                </div>
                {alexaMsgs.length===0
                  ? <div style={{padding:'40px',textAlign:'center',color:T.textT}}>Nenhum comunicado enviado ainda</div>
                  : <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                      <thead><tr style={{background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                        {['Título','Mensagem','Destinatário','Status','Data / Hora'].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:10,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'9px 14px'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {alexaMsgs.map(a=>(
                          <tr key={a.id} style={{borderTop:`1px solid ${T.border}`}}>
                            <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:T.text}}>{a.title}</td>
                            <td style={{padding:'11px 14px',fontSize:12,color:T.textS,maxWidth:260}}>{a.msg}</td>
                            <td style={{padding:'11px 14px'}}>
                              <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:T.goldGl,color:T.gold}}>{a.dest==='todos'?'📢 Todos':a.dest==='admins'?'🛡 Admins':`💼 ${a.dest}`}</span>
                            </td>
                            <td style={{padding:'11px 14px'}}>
                              <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:a.status==='enviado'?'rgba(26,156,112,0.12)':'rgba(216,144,48,0.15)',color:a.status==='enviado'?'#1A9C70':'#D89030'}}>{a.status==='enviado'?'✓ Enviado':'⏱ Agendado'}</span>
                            </td>
                            <td style={{padding:'11px 14px',fontSize:12,color:T.textT,whiteSpace:'nowrap'}}>{a.date} às {a.hora}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </Card>
            </div>
            );
          })()}
          {tab==='trofeus'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Troféus & Reconhecimento</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Envie troféus de Ouro e Platina para reconhecer colaboradores destacados</div>
                </div>
                <Moon size={24} color={T.goldL} opacity={0.35} float/>
              </div>
              {/* Enviar troféu */}
              <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:16}}>Enviar Troféu</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:7}}>Colaborador</label>
                    <select value={trophyTarget||''} onChange={e=>setTrophyTarget(e.target.value||null)}
                      style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',cursor:'pointer'}}>
                      <option value="">Selecione o colaborador...</option>
                      {users.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:7}}>Tipo de Troféu</label>
                    <div style={{display:'flex',gap:8}}>
                      {[['ouro','🥇 Ouro','#D89030'],['platina','💎 Platina','#5B8DB8']].map(([v,l,c])=>(
                        <button key={v} onClick={()=>setTrophyType(v)}
                          style={{flex:1,padding:'9px',borderRadius:9,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:trophyType===v?700:500,background:trophyType===v?`${c}18`:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:trophyType===v?c:T.textS,border:`2px solid ${trophyType===v?c+'66':T.border}`,transition:'all .15s'}}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:7}}>Mensagem de Reconhecimento</label>
                  <textarea value={trophyMsg} onChange={e=>setTrophyMsg(e.target.value)} rows={3}
                    placeholder="Descreva o motivo do reconhecimento..."
                    style={{width:'100%',padding:'10px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
                </div>
                <button onClick={sendTrophy} disabled={!trophyTarget||!trophyMsg.trim()}
                  style={{padding:'10px 24px',borderRadius:9,border:'none',cursor:trophyTarget&&trophyMsg.trim()?'pointer':'not-allowed',fontFamily:'var(--font-body)',fontSize:13,fontWeight:700,background:trophyType==='ouro'?'linear-gradient(135deg,#D89030,#b06820)':'linear-gradient(135deg,#5B8DB8,#3a6a90)',color:'white',opacity:trophyTarget&&trophyMsg.trim()?1:0.5}}>
                  {trophyType==='ouro'?'🥇':'💎'} Enviar Troféu
                </button>
              </Card>
              {/* Histórico */}
              <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`,fontFamily:'var(--font-brand)',fontSize:14,fontWeight:700,color:T.text}}>Histórico de Troféus</div>
                {trophyHistory.length===0
                  ? <div style={{padding:'40px',textAlign:'center',color:T.textT}}>Nenhum troféu enviado ainda</div>
                  : <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                      <thead><tr style={{background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                        {['Colaborador','Tipo','Mensagem','Data','Enviado por'].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'9px 16px'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {trophyHistory.map(t=>(
                          <tr key={t.id} style={{borderTop:`1px solid ${T.border}`}}>
                            <td style={{padding:'11px 16px',fontSize:14,fontWeight:600,color:T.text}}>{t.to}</td>
                            <td style={{padding:'11px 16px'}}>
                              <span style={{fontSize:13,fontWeight:700,color:t.type==='ouro'?'#D89030':'#5B8DB8'}}>{t.type==='ouro'?'🥇 Ouro':'💎 Platina'}</span>
                            </td>
                            <td style={{padding:'11px 16px',fontSize:12,color:T.textS,maxWidth:220}}>{t.msg}</td>
                            <td style={{padding:'11px 16px',fontSize:12,color:T.textT}}>{t.date}</td>
                            <td style={{padding:'11px 16px',fontSize:12,color:T.textT}}>{t.from}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </Card>
            </div>
          )}

          {/* ── TAB: CONFIGURAÇÕES ── */}
          {tab==='config'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Configurações do Sistema</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Gerencie as configurações administrativas</div>
                </div>
                <Moon size={24} color={T.goldL} opacity={0.35} float/>
              </div>
              {/* Alterar senha */}
              <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',border:`1.5px solid ${T.border}`}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Alterar Senha do Dashboard RH
                </div>
                <div style={{fontSize:12,color:T.textT,marginBottom:16}}>Funcionalidade visual — integração com banco de dados em breve</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
                  {[['old','Senha atual'],['new1','Nova senha'],['new2','Confirmar nova']].map(([k,l])=>(
                    <div key={k}>
                      <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>{l}</label>
                      <input type="password" value={changePw[k]} onChange={e=>setChangePw(p=>({...p,[k]:e.target.value}))}
                        style={{width:'100%',padding:'8px 12px',border:`1.5px solid ${T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',boxSizing:'border-box'}}/>
                    </div>
                  ))}
                </div>
                {changePwMsg&&<div style={{fontSize:12,color:'#1A9C70',marginBottom:10}}>✓ {changePwMsg}</div>}
                <button onClick={()=>{if(changePw.old===ADMIN_PW&&changePw.new1===changePw.new2&&changePw.new1.length>=6){setChangePwMsg('Senha atualizada com sucesso (visual).');}else{setChangePwMsg('Erro: verifique os campos.');}}}
                  style={{padding:'9px 20px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white'}}>
                  Atualizar Senha
                </button>
              </Card>
              {/* Info */}
              <Card style={{padding:'20px 24px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:16}}>Sobre o Sistema</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  {[['Sistema','Crescent Hub'],['Versão','1.0 — Visual Preview'],['Empresa','7SERV GESTÃO BENEFÍCIOS'],['Módulos','Portal Colaborador · Ponto Eletrônico · Dashboard RH'],['Backend','Previsto — em desenvolvimento'],['Desenvolvido por','Nicolas Andrade']].map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontSize:10,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em',fontWeight:600,marginBottom:3}}>{l}</div>
                      <div style={{fontSize:13,color:T.textS}}>{v}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
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


/* ══════════════════════════════════════════════════════════════════
   PONTO ELETRÔNICO — Leitor de AFD (Portaria 671 / 1510)
══════════════════════════════════════════════════════════════════ */
const isWknd_p = d => { const w = new Date(d+'T12:00:00').getDay(); return w===0||w===6; };

const PontoEletronico = ({onBack, isAdmin=false}) => {
  const [afd,    setAfd]    = useState(null);
  const [drag,   setDrag]   = useState(false);
  const [load,   setLoad]   = useState(false);
  const [tab,    setTab]    = useState('usuarios');
  const [selEmp, setSelEmp] = useState(null);   // banco de horas
  const [calIdx, setCalIdx] = useState(0);       // calendar month index
  const [err,       setErr]       = useState('');
  const [tolerance, setTolerance] = useState(1);    // minutos — ignora marcações gêmeas abaixo desse limite
  const [jornada,   setJornada]   = useState(480);  // minutos — 480 = 8h padrão
  const [lineSearch,setLineSearch]= useState('');   // busca na Linha a Linha
  const [lineType,  setLineType]  = useState('all');// filtro de tipo na Linha a Linha
  const [lineDate,  setLineDate]  = useState('3dias'); // filtro de data na Linha a Linha
  const [showConf,  setShowConf]  = useState(false);// painel de configurações
  // Feature 1: Calendar day click
  const [calSelDay, setCalSelDay] = useState(null);
  // Feature 2: Justifications
  const [justifs,   setJustifs]   = useState({});   // key: `${cpf}_${date}` → {text, abonado}
  const [editJust,  setEditJust]  = useState(null);  // {cpf, date} being edited
  const [editText,  setEditText]  = useState('');
  // Feature 3: Banco de Horas filters
  const [bancoFilter,   setBancoFilter]   = useState('todos'); // hoje|ontem|3dias|7dias|30dias|todos
  const [bancoEmpMode,  setBancoEmpMode]  = useState('single'); // single|all
  const [bancoSearch,   setBancoSearch]   = useState('');       // Fix 1: separate search text
  const [bancoShowFilter,setBancoShowFilter]=useState('all');   // Fix 4: all|negative|justified
  const [calPage,       setCalPage]       = useState(0);        // calendar detail pagination
  const [calDaySort,    setCalDaySort]    = useState('az');     // az|ok|negative|positive
  const [userSearch,    setUserSearch]    = useState('');       // F1: users tab search
  const [calSearch,     setCalSearch]     = useState('');       // F3: calendar employee search
  const [calFilterEmps, setCalFilterEmps] = useState([]);       // F3: selected CPFs in calendar

  // Fixed colors (not theme-dependent, always readable)
  const ECOLS = ['#1E70B5','#5560C8','#0A9BB5','#C06090','#1A9C70','#B87010','#C04050','#2E8DD4'];

  /* ════════════════════════════════════════
     PARSER — suporta Portaria 671 e 1510
  ════════════════════════════════════════ */
  const parseAFD = (raw) => {
    const lines = raw.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.length >= 10);

    // Detecta formato pelo primeiro tipo 3 encontrado
    // 671: ISO datetime → char[14] = '-'   ex: 2026-05-16T16:03:00-0300
    // 1510: AAAAMMDD+HHMM → char[14] is digit  ex: 202605161603
    let fmt = '671';
    for (const line of lines) {
      if (line[9] === '3' && line.length >= 20) {
        fmt = line[14] === '-' ? '671' : '1510';
        break;
      }
    }

    let header = null;
    const nameMap  = {};           // cpf11 → name (do tipo 5)
    const excluded = new Set();    // CPFs excluídos (tipo 5 operação E)
    const marks    = [];           // todas as marcações tipo 3
    const rawRecs  = [];           // todos os registros para Linha a Linha

    for (const line of lines) {
      const tipo = line[9];
      const nsr  = line.substring(0, 9);

      /* ── Tipo 1: Cabeçalho ── */
      if (tipo === '1' && line.length > 50) {
        const cnpj  = line.substring(10, 24);
        const bloco = line.substring(36, 200);
        const nm    = bloco.match(/[A-Za-záéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ][A-Za-záéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ\s\.]{3,}/);
        const razao = nm ? nm[0].trim() : cnpj;
        const dts   = [...line.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]);
        const mdl   = line.match(/iD[\w\s\-]+|[A-Z]{2}[A-Za-z][\w\s]{4,18}(?=\s{3,})/);
        header = { cnpj, razao, inicio:dts[0]||'', fim:dts[1]||'', gerado:dts[2]||'', modelo:mdl?mdl[0].trim():'—', fmt };
      }

      /* ── Tipo 3: Marcação de Ponto ── */
      // Datetime: 24 chars (YYYY-MM-DDTHH:MM:SS-0300) em pos 10-33
      // CPF: 12 chars em pos 34-45, com dígito indicador; sem indicador = pos 35-45
      else if (tipo === '3') {
        let date='', time='', cpf='';
        if (fmt === '671' && line.length >= 46) {
          date = line.substring(10, 20);   // YYYY-MM-DD (pos 10-19)
          time = line.substring(21, 26);   // HH:MM (T em pos 20, hora em 21-25)
          const cpfRaw = line.substring(34, 46); // 12 chars: indicador + 11 CPF/PIS
          cpf  = cpfRaw.substring(1);            // 11 dígitos sem o indicador
        } else if (fmt === '1510' && line.length >= 34) {
          const rd = line.substring(10, 18);
          const rt = line.substring(18, 22);
          date = `${rd.slice(0,4)}-${rd.slice(4,6)}-${rd.slice(6,8)}`;
          time = `${rt.slice(0,2)}:${rt.slice(2,4)}`;
          const cpfRaw = line.substring(22, 34);
          cpf  = cpfRaw.substring(1);
        }
        if (date && time && cpf.length >= 10) {
          marks.push({ nsr, date, time, cpf });
          rawRecs.push({ nsr, date, time, cpf, label:'Marcação de Ponto', tipo:'3' });
        }
      }

      /* ── Tipo 4: Ajuste de relógio ── */
      else if (tipo === '4') {
        const date = fmt==='671' ? line.substring(10,20) : '';
        const time = fmt==='671' ? line.substring(21,26) : '';
        rawRecs.push({ nsr, date, time, cpf:'—', label:'Ajuste de Data/Hora', tipo:'4' });
      }

      /* ── Tipo 5: Empregado ── */
      // Datetime: pos 10-33 (24 chars)
      // Op: pos 34 (I=Inclusão, A=Alteração, E=Exclusão)
      // CPF: pos 35-46 (12 chars com indicador), sem indicador = pos 36-46
      // Nome: pos 47+ (52 chars)
      else if (tipo === '5') {
        let op='', cpf='', nome='', date='', time='';
        if (fmt === '671' && line.length >= 47) {
          date = line.substring(10, 20);
          time = line.substring(21, 26);
          op   = line[34];                               // I, A ou E em pos 34
          const cpfRaw = line.substring(35, 47);        // 12 chars com indicador
          cpf  = cpfRaw.substring(1);                   // 11 dígitos
          nome = line.length > 47 ? line.substring(47, Math.min(line.length-4, 99)).trim() : '';
        } else if (fmt === '1510' && line.length >= 37) {
          const rd = line.substring(10, 18), rt = line.substring(18, 22);
          date = `${rd.slice(0,4)}-${rd.slice(4,6)}-${rd.slice(6,8)}`;
          time = `${rt.slice(0,2)}:${rt.slice(2,4)}`;
          op   = line[24];
          const cpfRaw = line.substring(25, 37);
          cpf  = cpfRaw.substring(1);
          nome = line.length > 37 ? line.substring(37, Math.min(line.length-4, 89)).trim() : '';
        }
        if (cpf && nome && op !== 'E') nameMap[cpf] = nome;
        if (cpf && op === 'E')         excluded.add(cpf);
        const opLabel = op==='I' ? 'Inclusão' : op==='A' ? 'Alteração' : op==='E' ? 'Exclusão' : op;
        rawRecs.push({ nsr, date, time, cpf, label:`${opLabel} de Cadastro${nome?' — '+nome:''}`, tipo:'5' });
      }

      /* ── Tipo 2/6/outros ── */
      else if (tipo === '2' || tipo === '6') {
        const date = line.length >= 35 ? line.substring(10,20) : '';
        const time = line.length >= 35 ? line.substring(21,26) : '';
        rawRecs.push({ nsr, date, time, cpf:'—', label: tipo==='2'?'Edição do Empregador':'Evento do Sistema', tipo });
      }
    }

    /* ── Construir mapa de funcionários ── */
    const empMap = {};
    for (const m of marks) {
      if (!empMap[m.cpf]) empMap[m.cpf] = { cpf:m.cpf, marks:[] };
      empMap[m.cpf].marks.push(m);
    }
    // Garantir que TODOS os nomes do nameMap sejam aplicados
    for (const [cpf, name] of Object.entries(nameMap)) {
      if (!empMap[cpf]) empMap[cpf] = { cpf, marks:[] };
      empMap[cpf].name = name;
    }

    /* ── Processar dias / banco de horas ── */
    // jornada vem do estado do componente (configurável)

    const employees = Object.values(empMap)
      .filter(e => e.marks.length > 0)
      .sort((a,b) => (a.name||a.cpf).localeCompare(b.name||b.cpf))
      .map((emp, ei) => {
        const name  = emp.name || nameMap[emp.cpf] || '';
        const color = ECOLS[ei % ECOLS.length];
        const byDay = {};
        for (const m of emp.marks) {
          if (!byDay[m.date]) byDay[m.date] = [];
          byDay[m.date].push(m.time);
        }
        const days = Object.entries(byDay).sort(([a],[b])=>a<b?-1:1).map(([date, rawTimes])=>{
          const times = [...rawTimes].sort();
          const pairs=[], issues=[];
          let totalMin=0;
          for (let i=0; i<times.length; i+=2) {
            if (i+1 < times.length) {
              const [eh,em]=times[i].split(':').map(Number);
              const [xh,xm]=times[i+1].split(':').map(Number);
              const diff=(xh*60+xm)-(eh*60+em);
              if (diff<=0)    issues.push(`Marcação duplicada: ${times[i]}`);
              else if(diff<tolerance) issues.push(`Marcação gêmea (${diff}min): ${times[i]} ↔ ${times[i+1]} — auto-ignorada`);
              // Tolerância automática: se dentro do limite, não conta o tempo
              totalMin += (diff > 0 && diff < tolerance) ? 0 : Math.max(0,diff);
              pairs.push({entry:times[i],exit:times[i+1],min:diff,twin:diff>0&&diff<tolerance});
            } else {
              pairs.push({entry:times[i],exit:null,min:0});
              issues.push(`Marcação sem par às ${times[i]}`);
            }
          }
          if (times.length%2!==0 && !issues.some(x=>x.includes('sem par'))) issues.push('Número ímpar de marcações');
          const wknd    = isWknd_p(date);
          const expected = wknd ? 0 : jornada;
          const balance  = totalMin - expected;
          return { date, times, pairs, totalMin, expected, balance, issues, wknd };
        });
        let cumBal=0;
        const daysWithCum = days.map(d=>{ cumBal+=d.balance; return {...d,cumBal}; });
        const totMin    = days.reduce((s,d)=>s+d.totalMin,0);
        const totBal    = days.reduce((s,d)=>s+d.balance,0);
        const totIssues = days.reduce((s,d)=>s+d.issues.length,0);
        const sortedDates = emp.marks.map(m=>m.date).sort();
        return { cpf:emp.cpf, name, color, marks:emp.marks, days:daysWithCum, totMin, totBal, totIssues, firstMark:sortedDates[0], lastMark:sortedDates[sortedDates.length-1], excluded:excluded.has(emp.cpf) };
      });

    // Funcionários excluídos sem marcações
    const excludedEmployees = [...excluded]
      .filter(cpf => !employees.find(e=>e.cpf===cpf))
      .map(cpf => ({ cpf, name:nameMap[cpf]||'', excluded:true }));

    const totalMarks  = employees.reduce((s,e)=>s+e.marks.length,0);
    const totalIssues = employees.reduce((s,e)=>s+e.totIssues,0);
    const allDates    = [...new Set(employees.flatMap(e=>e.days.map(d=>d.date)))].sort();
    const calDates    = [...new Set(marks.map(m=>m.date.substring(0,7)))].sort(); // YYYY-MM

    // Dados do calendário — enriquecidos com status por dia
    const calData = {};
    for (const emp of employees) {
      for (const day of emp.days) {
        if (!calData[day.date]) calData[day.date] = { count:0, hasOdd:false, hasTwins:false };
        calData[day.date].count += day.times.length;
        if (day.issues.some(x => x.includes('ímpar') || x.includes('sem par'))) calData[day.date].hasOdd = true;
        if (day.issues.some(x => x.includes('gêmeas') || x.includes('duplicada'))) calData[day.date].hasTwins = true;
      }
    }

    // Validação de NSR — detecta gaps na sequência (indício de adulteração)
    const nsrList = rawRecs.map(r => parseInt(r.nsr, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
    const nsrGaps = [];
    for (let i=1;i<nsrList.length;i++) {
      if (nsrList[i] - nsrList[i-1] > 1) nsrGaps.push({from:nsrList[i-1], to:nsrList[i], gap:nsrList[i]-nsrList[i-1]-1});
    }

    return { header, employees, excludedEmployees, totalMarks, totalIssues, allDates, rawRecs, calDates, calData, nameMap, nsrGaps };
  };

  /* ── Processar arquivo ── */
  const processFile = (file) => {
    if (!file) return;
    const n = file.name.toLowerCase();
    if (!n.endsWith('.txt') && !n.endsWith('.afd')) { setErr('Formato inválido. Use .txt ou .afd do relógio de ponto.'); return; }
    setErr(''); setLoad(true);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parseAFD(e.target.result);
        if (!parsed.employees.length) { setErr('Nenhuma marcação encontrada. Verifique se é um AFD válido (Portaria 671 ou 1510).'); setLoad(false); return; }
        setAfd(parsed);
        setTab('usuarios');
        setSelEmp(parsed.employees[0]?.cpf || null);
        setCalIdx(0);
      } catch(ex) { console.error('AFD error:', ex); setErr('Erro ao processar o arquivo: '+ex.message); }
      setLoad(false);
    };
    reader.onerror = () => { setErr('Erro ao ler o arquivo.'); setLoad(false); };
    reader.readAsText(file, 'ISO-8859-1');
  };

  const onDrop  = e => { e.preventDefault(); setDrag(false); processFile(e.dataTransfer.files[0]); };
  const onDragO = e => { e.preventDefault(); setDrag(true); };

  /* ── Formatadores ── */
  const fmtMin  = m => { const a=Math.abs(m),h=Math.floor(a/60),mm=a%60; return `${m<0?'-':''}${h}h${mm.toString().padStart(2,'0')}`; };
  const fmtDate = d => { if(!d)return'—'; const[y,mo,dd]=d.split('-'); return `${dd}/${mo}/${y}`; };
  const fmtCPF  = c => c?c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'):c;
  const fmtCNPJ = c => c?`${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`:'—';
  const initials = n => { const p=(n||'').trim().split(' ').filter(Boolean); return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():(p[0]?.[0]||'?').toUpperCase(); };
  const diaSem  = d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(d+'T12:00:00').getDay()];
  const displayName = (emp) => emp.name || `PIS/CPF: ${emp.cpf}`;
  const tabSt = t => ({ padding:'8px 18px',borderRadius:9,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:tab===t?600:400,background:tab===t?T.goldGl:'transparent',color:tab===t?T.gold:T.textS,border:`1px solid ${tab===t?T.goldLine+'44':'transparent'}`,transition:'all .15s',whiteSpace:'nowrap' });

  /* ── Detecção de modo escuro e fundos adaptativos ── */
  const isDark = !!T.page; // temas escuros definem T.page; temas claros não
  const cardBg   = isDark ? T.surface : (T.surfaceW||'rgba(255,255,255,0.85)');
  const headerBg = isDark ? `${T.surface}ee` : (T.surfaceW||'rgba(255,255,255,0.80)');
  const tabsBg   = isDark ? `${T.surface}cc` : (T.surfaceW||'rgba(255,255,255,0.70)');

  const displayRazao = (r) => {
    if (!r) return 'EMPRESA';
    const u = r.toUpperCase();
    if (u.includes('SERV')&&(u.includes('GESTAO')||u.includes('GESTÃO'))&&u.includes('BENEFICIO')) return '7SERV GESTÃO BENEFÍCIOS';
    return u;
  };
  /* ── PDF: Comprovante Banco de Horas (filtrado) ── */
  const printBancoFiltrado = (emp, days) => {
    const rows = days.map(day => {
      const jv = justifs[`${emp.cpf}_${day.date}`];
      return `<tr style="border-bottom:1px solid #eee;background:${day.balance<0?'#fff5f5':day.wknd?'#f9f9f9':'white'}">
        <td style="padding:7px 10px">${fmtDate(day.date)}</td><td style="padding:7px 10px;color:#666">${diaSem(day.date)}</td>
        <td style="padding:7px 10px">${day.times.map((t,i)=>`<span style="padding:1px 6px;border-radius:3px;font-size:11px;background:${i%2===0?'#e8f5e9':'#e3f2fd'};color:${i%2===0?'#1A9C70':'#1E70B5'};font-weight:600">${t}</span>`).join(' ')||'—'}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700">${fmtMin(day.totalMin)}</td>
        <td style="padding:7px 10px;text-align:right;color:#666">${day.wknd?'Folga':fmtMin(day.expected)}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700;color:${day.balance>=0?'#1A9C70':'#C04050'}">${day.balance>=0?'+':''}${fmtMin(day.balance)}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700;color:${day.cumBal>=0?'#1A9C70':'#C04050'}">${day.cumBal>=0?'+':''}${fmtMin(day.cumBal)}</td>
        <td style="padding:7px 10px;font-size:11px;color:#996600;max-width:160px">${jv?.text||'—'}</td>
      </tr>`;
    }).join('');
    const totMin=days.reduce((s,d)=>s+d.totalMin,0), totBal=days.reduce((s,d)=>s+d.balance,0);
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Banco de Horas — ${emp.name||emp.cpf}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:20px}
      h1{font-size:17px;margin-bottom:3px}h2{font-size:13px;font-weight:normal;color:#555;margin-bottom:14px}
      .meta{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:16px;padding:10px 14px;background:#f5f9ff;border-radius:6px;border:1px solid #d0e0f0}
      .meta div{display:flex;flex-direction:column;gap:2px}.meta span{font-size:10px;color:#888;text-transform:uppercase}.meta strong{font-size:13px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#1A9C70;color:white}
      thead th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;font-weight:700}
      .tr{background:#f5f9f5;font-weight:700;border-top:2px solid #1A9C70}
      @media print{body{padding:10px}}</style></head><body>
      <h1>Comprovante Banco de Horas</h1>
      <h2>${displayRazao(afd?.header?.razao)} — CNPJ: ${fmtCNPJ(afd?.header?.cnpj)}</h2>
      <div class="meta">
        <div><span>Funcionário</span><strong>${emp.name||'—'}</strong></div>
        <div><span>PIS/CPF</span><strong>${emp.cpf}</strong></div>
        <div><span>Período</span><strong>${days.length>0?fmtDate(days[0].date)+' a '+fmtDate(days[days.length-1].date):'—'}</strong></div>
        <div><span>Total período</span><strong>${fmtMin(totMin)}</strong></div>
        <div><span>Saldo período</span><strong style="color:${totBal>=0?'#1A9C70':'#C04050'}">${totBal>=0?'+':''}${fmtMin(totBal)}</strong></div>
        <div><span>Banco acumulado</span><strong style="color:${emp.totBal>=0?'#1A9C70':'#C04050'}">${emp.totBal>=0?'+':''}${fmtMin(emp.totBal)}</strong></div>
      </div>
      <table><thead><tr><th>Data</th><th>Dia</th><th>Marcações</th><th>Trabalhado</th><th>Esperado</th><th>Saldo</th><th>Banco Acum.</th><th>Observação</th></tr></thead>
      <tbody>${rows}<tr class="tr"><td colspan="3" style="padding:8px 10px">TOTAL</td><td style="padding:8px 10px">${fmtMin(totMin)}</td><td></td><td style="padding:8px 10px;color:${totBal>=0?'#1A9C70':'#C04050'}">${totBal>=0?'+':''}${fmtMin(totBal)}</td><td colspan="2"></td></tr></tbody>
      </table><div style="font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px">Gerado em ${new Date().toLocaleString('pt-BR')} · Crescent Hub</div>
    </body></html>`;
    const w=window.open('','_blank','width=900,height=700'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400);
  };

  /* ── PDF: Comprovante Calendário — dia específico ── */
  const printCalDia = (date, dayEmps) => {
    const rows = dayEmps.map(({emp,day})=>{
      const jv=justifs[`${emp.cpf}_${date}`];
      const marks=day.pairs.map(p=>`${p.entry}${p.exit?' → '+p.exit:' → ?'}`).join('  |  ');
      return `<tr style="border-bottom:1px solid #eee;background:${day.issues.length>0?'#fff5f5':'white'}">
        <td style="padding:7px 10px;font-weight:600">${emp.name||emp.cpf}</td><td style="padding:7px 10px;font-size:11px;color:#666">${emp.cpf}</td>
        <td style="padding:7px 10px">${marks||'—'}</td><td style="padding:7px 10px;text-align:right;font-weight:700">${fmtMin(day.totalMin)}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700;color:${day.balance>=0?'#1A9C70':'#C04050'}">${day.balance>=0?'+':''}${fmtMin(day.balance)}</td>
        <td style="padding:7px 10px;font-size:11px;color:${day.issues.length>0?'#C04050':'#1A9C70'}">${day.issues.join('; ')||'✓ OK'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#996600">${jv?.text||'—'}</td>
      </tr>`;
    }).join('');
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Marcações ${fmtDate(date)}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:20px}
      h1{font-size:17px;margin-bottom:3px}h2{font-size:13px;font-weight:normal;color:#555;margin-bottom:14px}
      table{width:100%;border-collapse:collapse}thead tr{background:#1A9C70;color:white}
      thead th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;font-weight:700}
      @media print{body{padding:10px}}</style></head><body>
      <h1>Marcações do Dia — ${fmtDate(date)} (${diaSem(date)})</h1>
      <h2>${displayRazao(afd?.header?.razao)} · ${dayEmps.length} funcionário${dayEmps.length!==1?'s':''}</h2>
      <table style="margin-top:14px"><thead><tr><th>Funcionário</th><th>PIS/CPF</th><th>Marcações</th><th>Trabalhado</th><th>Saldo</th><th>Inconsistências</th><th>Observação</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div style="font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;margin-top:16px">Gerado em ${new Date().toLocaleString('pt-BR')} · Crescent Hub</div>
    </body></html>`;
    const w=window.open('','_blank','width=900,height=700'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400);
  };

  const getBancoDateRange = () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const fmt = d => d.toISOString().slice(0,10);
    if (bancoFilter==='hoje')   return {from:fmt(today), to:fmt(today)};
    if (bancoFilter==='ontem')  { const d=new Date(today); d.setDate(d.getDate()-1); return {from:fmt(d),to:fmt(d)}; }
    if (bancoFilter==='3dias')  { const d=new Date(today); d.setDate(d.getDate()-2); return {from:fmt(d),to:fmt(today)}; }
    if (bancoFilter==='7dias')  { const d=new Date(today); d.setDate(d.getDate()-6); return {from:fmt(d),to:fmt(today)}; }
    if (bancoFilter==='30dias') { const d=new Date(today); d.setDate(d.getDate()-29);return {from:fmt(d),to:fmt(today)}; }
    return {from:'0000-00-00',to:'9999-99-99'};
  };

  /* ── Salvar justificativa ── */
  const saveJustif = () => {
    if (!editJust) return;
    const key = `${editJust.cpf}_${editJust.date}`;
    setJustifs(prev => ({...prev, [key]: {text:editText, abonado:editText.trim().length>0}}));
    setEditJust(null); setEditText('');
  };

  /* ── Estilo de cabeçalho de aba (opaco, legível) ── */
  const SecHead = ({title, sub, icon}) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'16px 20px',borderRadius:14,
      background:cardBg,
      backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',
      border:`1px solid ${T.border}`,boxShadow:T.shM}}>
      <div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>{title}</div>
        <div style={{fontSize:13,color:T.textS,marginTop:3}}>{sub}</div>
      </div>
      {icon||<Moon size={24} color={T.goldL} opacity={0.35} float/>}
    </div>
  );

  /* ── Imprimir Espelho de Ponto ── */
  const printEspelho = (emp) => {
    const rows = emp.days.map(day => `
      <tr style="border-bottom:1px solid #e0e0e0;background:${day.issues.length>0?'#fff3f3':day.wknd?'#f5f5f5':'white'}">
        <td style="padding:8px 12px;font-weight:500">${fmtDate(day.date)}</td>
        <td style="padding:8px 12px;color:#666">${diaSem(day.date)}</td>
        <td style="padding:8px 12px">
          ${day.times.map((t,i)=>`<span style="display:inline-block;margin:1px;padding:2px 8px;border-radius:4px;font-size:12px;background:${i%2===0?'#e8f5e9':'#e3f2fd'};color:${i%2===0?'#1A9C70':'#1E70B5'};font-weight:600">${t}</span>`).join(' ')}
          ${day.times.length===0?'<span style="color:#aaa;font-size:12px">Sem marcações</span>':''}
        </td>
        <td style="padding:8px 12px;font-weight:700;text-align:right">${fmtMin(day.totalMin)}</td>
        <td style="padding:8px 12px;text-align:right;color:#666">${day.wknd?'Folga':fmtMin(day.expected)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:${day.balance>=0?'#1A9C70':'#C04050'}">${day.balance>0?'+':''}${fmtMin(day.balance)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:${day.cumBal>=0?'#1A9C70':'#C04050'}">${day.cumBal>=0?'+':''}${fmtMin(day.cumBal)}</td>
        <td style="padding:8px 12px;font-size:11px;color:#C04050">${day.issues.join('; ')}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Espelho de Ponto — ${emp.name||emp.cpf}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#222;padding:24px}
      h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;font-weight:normal;color:#555;margin-bottom:16px}
      .meta{display:flex;gap:32px;margin-bottom:20px;padding:12px 16px;background:#f9f9f9;border-radius:6px;border:1px solid #ddd}
      .meta div{display:flex;flex-direction:column;gap:2px}.meta span{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em}.meta strong{font-size:14px}
      table{width:100%;border-collapse:collapse}thead tr{background:#1E70B5;color:white}
      thead th{padding:10px 12px;text-align:left;font-size:11px;letter-spacing:.07em;text-transform:uppercase;font-weight:700}
      .total{background:#1E70B5;color:white;font-weight:700;font-size:14px}
      .footer{margin-top:32px;padding-top:16px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:11px;color:#888}
      @media print{body{padding:12px}.footer{position:fixed;bottom:16px;left:24px;right:24px}}</style>
    </head><body>
      <h1>Espelho de Ponto Eletrônico</h1>
      <h2>${afd?.header?.razao||'Empresa'} — CNPJ: ${fmtCNPJ(afd?.header?.cnpj)}</h2>
      <div class="meta">
        <div><span>Funcionário</span><strong>${emp.name||'—'}</strong></div>
        <div><span>PIS/CPF</span><strong>${emp.cpf}</strong></div>
        <div><span>Período</span><strong>${fmtDate(emp.firstMark)} a ${fmtDate(emp.lastMark)}</strong></div>
        <div><span>Total Trabalhado</span><strong>${fmtMin(emp.totMin)}</strong></div>
        <div><span>Saldo Final</span><strong style="color:${emp.totBal>=0?'#1A9C70':'#C04050'}">${emp.totBal>=0?'+':''}${fmtMin(emp.totBal)}</strong></div>
        <div><span>Jornada Base</span><strong>${fmtMin(jornada)}/dia útil</strong></div>
      </div>
      <table>
        <thead><tr>
          <th>Data</th><th>Dia</th><th>Marcações</th><th style="text-align:right">Trabalhado</th>
          <th style="text-align:right">Esperado</th><th style="text-align:right">Saldo Dia</th>
          <th style="text-align:right">Banco Acum.</th><th>Observações</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="total">
          <td colspan="3" style="padding:10px 12px">TOTAIS</td>
          <td style="padding:10px 12px;text-align:right">${fmtMin(emp.totMin)}</td>
          <td></td>
          <td style="padding:10px 12px;text-align:right">${emp.totBal>=0?'+':''}${fmtMin(emp.totBal)}</td>
          <td style="padding:10px 12px;text-align:right">${emp.totBal>=0?'+':''}${fmtMin(emp.totBal)}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <div class="footer">
        <span>Gerado pelo Crescent Hub em ${new Date().toLocaleString('pt-BR')} | Portaria 671/2021</span>
        <span>___________________________________ Assinatura do Colaborador</span>
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
    const w = window.open('','_blank','width=900,height=700');
    w.document.write(html);
    w.document.close();
  };

  /* ════════════════════════════════════════
     TELA DE UPLOAD
  ════════════════════════════════════════ */
  if (!afd) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,position:'relative',zIndex:1,fontFamily:'var(--font-body)'}}>

      {/* Moons decorativas nos cantos */}
      <div style={{position:'absolute',top:24,right:40,opacity:.18,transform:'rotate(30deg)'}}><Moon size={72} color={T.goldL} float/></div>
      <div style={{position:'absolute',bottom:32,left:36,opacity:.12,transform:'rotate(-20deg) scaleX(-1)'}}><Moon size={54} color={T.goldV} float/></div>
      <div style={{position:'absolute',top:'38%',right:28,opacity:.08}}><Moon size={38} color={T.gold}/></div>
      <div style={{position:'absolute',top:'55%',left:24,opacity:.07,transform:'rotate(140deg)'}}><Moon size={30} color={T.goldL}/></div>

      {/* Botão voltar */}
      <div style={{position:'absolute',top:28,left:32}}>
        <button onClick={onBack} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'9px 18px',background:T.surfaceSub||'rgba(0,0,0,0.04)',border:`1px solid ${T.border}`,borderRadius:10,cursor:'pointer',color:T.textS,outline:'none',fontFamily:'var(--font-body)',fontSize:14,transition:'all .15s'}}
          onMouseEnter={e=>e.currentTarget.style.color=T.gold} onMouseLeave={e=>e.currentTarget.style.color=T.textS}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          Módulos
        </button>
      </div>

      {/* Logo + Título */}
      <div className="fsu" style={{textAlign:'center',marginBottom:28}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
          <Logo size={72}/>
        </div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:11,fontWeight:400,color:T.textD,letterSpacing:'.35em',textTransform:'uppercase',marginBottom:10}}>
          Crescent Hub
        </div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:36,fontWeight:700,color:T.text,letterSpacing:'.06em',lineHeight:1,marginBottom:6}}>
          Ponto Eletrônico
        </div>
        <div style={{fontSize:14,color:T.textT,letterSpacing:'.04em',marginBottom:22}}>
          Leitor de AFD · Portaria 671 / 1510
        </div>
        <div style={{width:420,margin:'0 auto'}}><StarDivider my={0}/></div>
      </div>
      <div className="fsu2" onDragOver={onDragO} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
        onClick={()=>document.getElementById('_afd_input_').click()}
        style={{width:'100%',maxWidth:520,border:`2px dashed ${drag?T.goldLine:T.border}`,borderRadius:22,padding:'52px 44px',textAlign:'center',cursor:'pointer',background:drag?T.goldGl:(T.surface||'rgba(255,255,255,0.9)'),boxShadow:drag?`0 0 0 4px ${T.goldLine}22,${T.shM}`:T.sh,transition:'all .22s'}}>
        <input id="_afd_input_" type="file" accept=".txt,.afd" style={{display:'none'}} onChange={e=>processFile(e.target.files[0])}/>
        {load ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
            <div style={{width:48,height:48,border:`3px solid ${T.goldLine}33`,borderTop:`3px solid ${T.goldLine}`,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
            <div style={{fontSize:16,color:T.textS,fontWeight:500}}>Processando AFD...</div>
          </div>
        ) : (
          <>
            <div style={{width:72,height:72,borderRadius:18,margin:'0 auto 20px',background:drag?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),border:`1.5px solid ${drag?T.goldLine+'66':T.border}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={drag?T.gold:T.textD} strokeWidth="1.4" strokeLinecap="round" style={{transition:'stroke .2s'}}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/>
              </svg>
            </div>
            <div style={{fontSize:19,fontWeight:600,color:drag?T.gold:T.text,marginBottom:10}}>{drag?'Solte para processar':'Arraste o arquivo AFD aqui'}</div>
            <div style={{fontSize:14,color:T.textT,lineHeight:1.9}}>ou <span style={{color:T.gold,fontWeight:600}}>clique para selecionar</span><br/><span style={{fontSize:13}}>Arquivo .txt do relógio de ponto (REP-C, REP-A, REP-P)</span></div>
          </>
        )}
      </div>
      {err&&<div style={{marginTop:16,maxWidth:520,width:'100%',padding:'12px 18px',background:'rgba(192,64,80,0.07)',border:'1px solid rgba(192,64,80,0.25)',borderRadius:12,display:'flex',alignItems:'center',gap:10}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C04050" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style={{fontSize:13,color:'#C04050'}}>{err}</span>
      </div>}
      {/* Info pills */}
      <div className="fsu3" style={{display:'flex',gap:10,marginTop:24,flexWrap:'wrap',justifyContent:'center'}}>
        {[{d:<polyline points="20 6 9 17 4 12"/>,t:'Portaria 671 e 1510'},{d:<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,t:'Processado localmente'},{d:<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>,t:'Qualquer marca de REP'}].map((it,i)=>(
          <div key={i} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:99,background:T.surface||'rgba(255,255,255,0.9)',border:`1px solid ${T.border}`,boxShadow:T.sh}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.9" strokeLinecap="round">{it.d}</svg>
            <span style={{fontSize:13,color:T.textS}}>{it.t}</span>
          </div>
        ))}
      </div>

      {/* Footer Crescent Hub */}
      <div className="fsu4" style={{position:'absolute',bottom:24,display:'flex',alignItems:'center',gap:10,opacity:.35}}>
        <Logo size={20}/>
        <span style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT}}>
          Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
        </span>
      </div>
    </div>
  );

  /* ════════════════════════════════════════
     DASHBOARD
  ════════════════════════════════════════ */
  const { header, employees, excludedEmployees, totalMarks, totalIssues, allDates, rawRecs, calDates, calData } = afd;
  const curEmp = employees.find(e=>e.cpf===selEmp) || employees[0];

  return (
    <div style={{minHeight:'100vh',background:'transparent',fontFamily:'var(--font-body)',position:'relative'}}>
      <style>{`
        @keyframes blobGrad { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes blobGradRed { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes hdrBlob1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(28px,-8px) scale(1.15)} 66%{transform:translate(-12px,10px) scale(0.92)} }
        @keyframes hdrBlob2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-22px,12px) scale(1.08)} 80%{transform:translate(16px,-6px) scale(0.9)} }
        @keyframes hdrBlob3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,14px) scale(1.12)} }
        .blob-green { background:linear-gradient(270deg,#1A9C70,#2dd4a0,#0f7a56); background-size:200% 200%; animation:blobGrad 3s ease infinite; color:white; }
        .blob-red   { background:linear-gradient(270deg,#C04050,#e8566a,#9a2030); background-size:200% 200%; animation:blobGradRed 3s ease infinite; color:white; }
        .blob-amber { background:linear-gradient(270deg,#D89030,#f0b050,#b06820); background-size:200% 200%; animation:blobGrad 3s ease infinite; color:white; }
        .ponto-dropdown { box-shadow:0 8px 24px rgba(0,0,0,0.18); }
      `}</style>
      <div style={{position:'relative',zIndex:1}}>

      {/* ── TopBar ── */}
      <div style={{height:56,background:T.topbarBg||(isDark?`${T.surface}ee`:'rgba(245,250,255,0.75)'),backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 24px',gap:12,position:'sticky',top:0,zIndex:200,boxShadow:`0 1px 24px ${T.goldLine}11`}}>
        <button onClick={onBack} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 14px',background:T.surfaceSub||'rgba(0,0,0,0.04)',border:`1px solid ${T.border}`,borderRadius:9,cursor:'pointer',color:T.textS,outline:'none',fontFamily:'var(--font-body)',fontSize:13,transition:'all .15s'}}
          onMouseEnter={e=>e.currentTarget.style.color=T.gold} onMouseLeave={e=>e.currentTarget.style.color=T.textS}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          Módulos
        </button>
        <div style={{width:1,height:22,background:T.border}}/>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.7" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Ponto Eletrônico</span>
        {header?.razao&&<><div style={{width:1,height:22,background:T.border}}/><span style={{fontSize:13,color:T.textT,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'.03em'}}>{displayRazao(header.razao)}</span></>}
        {isAdmin&&<Tag color="#C04050" style={{marginLeft:4}}>Modo Admin</Tag>}
        <div style={{flex:1}}/>
        {header?.fmt&&<Tag color={T.green} style={{fontSize:11}}>AFD · Portaria {header.fmt==='671'?'671':'1510'}</Tag>}
        <button onClick={()=>setShowConf(v=>!v)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',background:showConf?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.04)'),border:`1px solid ${showConf?T.goldLine+'44':T.border}`,borderRadius:9,cursor:'pointer',color:showConf?T.gold:T.textS,outline:'none',fontFamily:'var(--font-body)',fontSize:13,transition:'all .15s'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          Config
        </button>
        <button onClick={()=>{setAfd(null);setErr('');}} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 16px',background:T.goldGl,border:`1px solid ${T.goldLine}44`,borderRadius:9,cursor:'pointer',color:T.gold,outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:500}}
          onMouseEnter={e=>e.currentTarget.style.background=`${T.goldLine}20`} onMouseLeave={e=>e.currentTarget.style.background=T.goldGl}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Novo arquivo
        </button>
      </div>

      <div style={{padding:'24px 32px',maxWidth:1400,margin:'0 auto'}}>

        {/* Header da empresa com identidade visual */}
        <div style={{marginBottom:6,padding:'18px 22px',borderRadius:16,
          background:headerBg,
          backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
          border:`1px solid ${T.border}`,boxShadow:T.sh,
          display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:20,fontWeight:700,color:T.text,letterSpacing:'.05em',lineHeight:1,textTransform:'uppercase'}}>
              {displayRazao(header?.razao)}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:18,marginTop:8}}>
              {[
                {l:'CNPJ',       v:fmtCNPJ(header?.cnpj)},
                {l:'Período',    v:`${fmtDate(header?.inicio)} — ${fmtDate(header?.fim)}`},
                {l:'Equipamento',v:header?.modelo||'—'},
                {l:'Formato',    v:`Portaria ${header?.fmt||'671'}`},
              ].map(({l,v})=>(
                <div key={l}>
                  <div style={{fontSize:10,color:T.textD,textTransform:'uppercase',letterSpacing:'.09em',fontWeight:600,marginBottom:2}}>{l}</div>
                  <div style={{fontSize:13,color:T.textS,fontWeight:500}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Moon size={28} color={T.goldL} opacity={0.4} float/>
            <Tag color={T.green}>REP · Portaria 671</Tag>
          </div>
        </div>
        {/* KPIs — apenas na aba Usuários (com divider) */}
        {tab==='usuarios'&&(
        <>
        <StarDivider my={14}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
          {[
            {l:'Funcionários',v:employees.length,sub:`${employees.filter(e=>e.name).length} identificados pelo nome`,c:'#1E70B5',icon:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>},
            {l:'Total de Marcações',v:totalMarks,sub:`${allDates.length} dias com registros`,c:T.gold,icon:<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></>},
            {l:'Banco de Horas',v:employees.length>0?fmtMin(employees.reduce((s,e)=>s+e.totBal,0)):'0h00',sub:`saldo total acumulado de todos`,c:'#1A9C70',icon:<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>},
            {l:'Inconsistências',v:totalIssues,sub:totalIssues===0?'Tudo em conformidade':'Requer atenção do RH',c:totalIssues>0?'#C04050':'#1A9C70',icon:totalIssues>0?<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>:<><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>},
          ].map(({l,v,sub,c,icon})=>(
            <Card key={l} style={{padding:'18px 20px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
              <div style={{width:40,height:40,borderRadius:10,background:`${c}18`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round">{icon}</svg>
              </div>
              <div style={{fontSize:28,fontWeight:700,color:T.text,lineHeight:1}}>{v}</div>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginTop:4}}>{l}</div>
              <div style={{fontSize:11,color:T.textT,marginTop:3,lineHeight:1.4}}>{sub}</div>
            </Card>
          ))}
        </div>
        </>
        )}

        {/* Divider simples para outras abas */}
        {tab!=='usuarios'&&<div style={{marginBottom:14}}/>}

        {/* Painel de Configurações */}
        {showConf&&(
          <Card style={{padding:'18px 22px',marginBottom:16,border:`1.5px solid ${T.goldLine}44`,background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
            <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Configurações do Cálculo
            </div>
            <div style={{display:'flex',gap:32,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div>
                <div style={{fontSize:11,color:T.textD,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                  Tolerância de Marcação Gêmea
                </div>
                <div style={{fontSize:12,color:T.textT,marginBottom:8}}>
                  Marcações dentro deste intervalo são auto-ignoradas no cálculo
                </div>
                <div style={{display:'flex',gap:6}}>
                  {[0,1,2,3,5,10].map(v=>(
                    <button key={v} onClick={()=>setTolerance(v)}
                      style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:tolerance===v?700:400,background:tolerance===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:tolerance===v?T.gold:T.textS,border:`1.5px solid ${tolerance===v?T.goldLine+'55':T.border}`,transition:'all .15s'}}>
                      {v===0?'Desligado':`${v} min`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:T.textD,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                  Jornada Diária
                </div>
                <div style={{fontSize:12,color:T.textT,marginBottom:8}}>
                  Horas esperadas por dia útil (afeta saldo e banco)
                </div>
                <div style={{display:'flex',gap:6}}>
                  {[[240,'4h'],[360,'6h'],[480,'8h'],[528,'8h48'],[540,'9h']].map(([v,l])=>(
                    <button key={v} onClick={()=>setJornada(v)}
                      style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:jornada===v?700:400,background:jornada===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:jornada===v?T.gold:T.textS,border:`1.5px solid ${jornada===v?T.goldLine+'55':T.border}`,transition:'all .15s'}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{fontSize:12,color:T.textT,padding:'10px 16px',borderRadius:10,background:T.surfaceSub||'rgba(0,0,0,0.03)',border:`1px solid ${T.border}`}}>
                <div style={{fontWeight:600,color:T.text,marginBottom:4}}>Configuração atual</div>
                <div>Tolerância: <strong style={{color:T.gold}}>{tolerance===0?'Desligada':`${tolerance} min`}</strong></div>
                <div>Jornada: <strong style={{color:T.gold}}>{fmtMin(jornada)}/dia</strong></div>
                <div style={{marginTop:4,fontSize:11,color:T.textD}}>⚠ Alterações aplicam no próximo upload</div>
              </div>
            </div>
          </Card>
        )}

        {/* Alerta de gaps no NSR */}
        {afd.nsrGaps?.length>0&&(
          <div style={{padding:'12px 18px',borderRadius:12,background:'rgba(192,64,80,0.08)',border:'1.5px solid rgba(192,64,80,0.30)',marginBottom:16,display:'flex',alignItems:'flex-start',gap:12}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C04050" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0,marginTop:1}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'#C04050',marginBottom:3}}>
                ⚠ Gaps detectados na sequência NSR — possível adulteração
              </div>
              <div style={{fontSize:12,color:T.textS}}>
                {afd.nsrGaps.map((g,i)=>`NSR ${g.from}→${g.to} (${g.gap} registro${g.gap>1?'s':''}  ausente${g.gap>1?'s':''})`).join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <StarDivider my={16} dim/>
        <div style={{display:'flex',gap:3,marginBottom:18,padding:4,width:'fit-content',
          background:tabsBg,
          backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',
          border:`1px solid ${T.border}`,borderRadius:13,boxShadow:T.sh,flexWrap:'wrap'}}>
          {[
            {id:'usuarios',   label:'Usuários'},
            {id:'banco',      label:'Banco de Horas'},
            {id:'calendario', label:'Calendário'},
            {id:'linhaLinha', label:'Linha a Linha'},
            {id:'issues',     label:`Inconsistências${totalIssues>0?' · '+totalIssues:''}`},
          ].map(({id,label})=>(<button key={id} onClick={()=>setTab(id)} style={tabSt(id)}>{label}</button>))}
        </div>

        {/* ════════════
            TAB: USUÁRIOS
        ════════════ */}
        {tab==='usuarios'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <SecHead title="Colaboradores no Relógio" sub="Clique em um colaborador para ver o banco de horas detalhado"/>
            {/* Barra de pesquisa global de usuários */}
            <div style={{position:'relative',maxWidth:380}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={userSearch} onChange={e=>setUserSearch(e.target.value)}
                placeholder="Pesquisar colaborador por nome ou CPF..."
                style={{paddingLeft:32,paddingRight:12,paddingTop:9,paddingBottom:9,border:`1.5px solid ${userSearch?T.goldLine+'88':T.border}`,borderRadius:10,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:cardBg,outline:'none',width:'100%',backdropFilter:'blur(8px)',transition:'border-color .15s'}}/>
              {userSearch&&<button onClick={()=>setUserSearch('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.textD,fontSize:16,lineHeight:1,padding:0}}>×</button>}
            </div>
            <div style={{borderRadius:16,overflow:'hidden'}}>
              <div style={{padding:'14px 22px',position:'relative',overflow:'hidden',background:'#1A9C70',display:'flex',alignItems:'center',gap:8}}>
                <div style={{position:'absolute',width:120,height:120,borderRadius:'50%',background:'#0a5c3a',filter:'blur(28px)',opacity:0.65,top:'-40px',left:'3%',animation:'hdrBlob1 5s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:80,height:80,borderRadius:'50%',background:'#2dd4a0',filter:'blur(18px)',opacity:0.6,top:'0px',left:'35%',animation:'hdrBlob2 6s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:100,height:100,borderRadius:'50%',background:'#40e8a0',filter:'blur(24px)',opacity:0.45,top:'-35px',left:'60%',animation:'hdrBlob3 7s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:70,height:70,borderRadius:'50%',background:'#0d9e5e',filter:'blur(16px)',opacity:0.55,top:'5px',left:'85%',animation:'hdrBlob1 8s ease-in-out infinite'}}/>
                <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:8}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  <span style={{fontSize:14,fontWeight:700,color:'white'}}>Nomes Ativos no Relógio</span>
                </div>
              </div>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderTop:'none'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                <thead>
                  <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                    {['Nro','Nome','PIS/CPF','Marcações','Primeira','Última','Total Horas','Saldo Banco'].map(h=>(
                      <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 16px'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.filter(emp=>!userSearch||(emp.name||'').toLowerCase().includes(userSearch.toLowerCase())||emp.cpf.includes(userSearch)).map((emp,i)=>(
                    <tr key={emp.cpf} style={{borderTop:`1px solid ${T.border}`,transition:'background .12s',cursor:'pointer'}}
                      onClick={()=>{setSelEmp(emp.cpf);setTab('banco');}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.02)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'12px 16px',fontSize:13,color:T.textT,fontWeight:500}}>{i+1}.</td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',boxShadow:`0 2px 8px ${emp.color}44`}}>{initials(emp.name||emp.cpf)}</div>
                          <div>
                            <div style={{fontSize:14,fontWeight:600,color:emp.name?T.blue:'#C04050'}}>{emp.name||'(sem nome no cadastro)'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'12px 16px',fontSize:13,color:T.textS,fontFamily:'monospace'}}>{emp.cpf}</td>
                      <td style={{padding:'12px 16px',fontSize:14,fontWeight:600,color:T.text}}>{emp.marks.length}</td>
                      <td style={{padding:'12px 16px',fontSize:13,color:T.textS}}>{fmtDate(emp.firstMark)}</td>
                      <td style={{padding:'12px 16px',fontSize:13,color:T.textS}}>{fmtDate(emp.lastMark)}</td>
                      <td style={{padding:'12px 16px',fontSize:14,fontWeight:600,color:T.text}}>{fmtMin(emp.totMin)}</td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <button onClick={e=>{e.stopPropagation();setSelEmp(emp.cpf);setBancoEmpMode('single');setTab('banco');}}
                            style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:500,background:T.goldGl,color:T.gold,border:`1px solid ${T.goldLine}44`}}>
                            Ver banco
                          </button>
                          <button onClick={e=>{e.stopPropagation();printEspelho(emp);}}
                            style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:500,background:'rgba(26,156,112,0.10)',color:'#1A9C70',border:'1px solid rgba(26,156,112,0.25)',display:'flex',alignItems:'center',gap:5}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            Espelho
                          </button>
                          <span className={emp.totBal>=0?'blob-green':'blob-red'}
                            style={{padding:'4px 10px',borderRadius:7,fontSize:12,fontWeight:700,minWidth:64,textAlign:'center'}}>
                            {emp.totBal>=0?'+':''}{fmtMin(emp.totBal)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Nomes Excluídos — sem borda do Card, blobs vermelhos mais ricos */}
            {excludedEmployees.length>0&&(
              <div style={{borderRadius:16,overflow:'hidden'}}>
                <div style={{padding:'14px 22px',position:'relative',overflow:'hidden',background:'#C04050',display:'flex',alignItems:'center',gap:8}}>
                  <div style={{position:'absolute',width:110,height:110,borderRadius:'50%',background:'#7a1020',filter:'blur(26px)',opacity:0.65,top:'-35px',left:'4%',animation:'hdrBlob2 5s ease-in-out infinite'}}/>
                  <div style={{position:'absolute',width:75,height:75,borderRadius:'50%',background:'#ff4060',filter:'blur(18px)',opacity:0.55,top:'5px',left:'40%',animation:'hdrBlob1 6.5s ease-in-out infinite'}}/>
                  <div style={{position:'absolute',width:90,height:90,borderRadius:'50%',background:'#e85568',filter:'blur(22px)',opacity:0.5,top:'-30px',left:'65%',animation:'hdrBlob3 7.5s ease-in-out infinite'}}/>
                  <div style={{position:'absolute',width:60,height:60,borderRadius:'50%',background:'#ff8080',filter:'blur(15px)',opacity:0.45,top:'8px',left:'88%',animation:'hdrBlob2 9s ease-in-out infinite'}}/>
                  <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:8}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="18" x2="17" y2="12"/><line x1="17" y1="18" x2="23" y2="12"/></svg>
                    <span style={{fontSize:14,fontWeight:700,color:'white'}}>Nomes Excluídos do Relógio</span>
                  </div>
                </div>
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderTop:'none'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                  <thead>
                    <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                      {['Nro','Nome','PIS/CPF'].map(h=>(
                        <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 16px'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excludedEmployees.map((emp,i)=>(
                      <tr key={emp.cpf} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:'12px 16px',fontSize:13,color:T.textT}}>{i+1}.</td>
                        <td style={{padding:'12px 16px',fontSize:14,color:T.textS}}>{emp.name||'—'}</td>
                        <td style={{padding:'12px 16px',fontSize:13,color:T.textS,fontFamily:'monospace'}}>{emp.cpf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{padding:'10px 16px',borderTop:`1px solid ${T.border}`,fontSize:12,color:T.textT}}>
                  * Funcionários com operação de exclusão (E) no arquivo AFD, sem marcações de ponto.
                </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════
            TAB: BANCO DE HORAS
        ════════════ */}
        {tab==='banco'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <SecHead title="Banco de Horas" sub={`Saldo diário vs. jornada de ${fmtMin(jornada)} · subtotais semanais`}/>

            {/* Filtros de período + funcionário + filtrar dias */}
            <Card style={{padding:'16px 20px', overflow:'visible'}} elevated>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {/* Linha 1: Período */}
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',flexShrink:0,width:90}}>Período:</div>
                  {[['hoje','Hoje'],['ontem','Ontem'],['3dias','3 dias'],['7dias','7 dias'],['30dias','30 dias'],['todos','Todos']].map(([v,l])=>(
                    <button key={v} onClick={()=>setBancoFilter(v)}
                      style={{padding:'5px 13px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:bancoFilter===v?700:400,background:bancoFilter===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:bancoFilter===v?T.gold:T.textS,border:`1.5px solid ${bancoFilter===v?T.goldLine+'55':T.border}`,transition:'all .12s'}}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Linha 2: Funcionário + busca */}
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',flexShrink:0,width:90}}>Funcionário:</div>
                  <button onClick={()=>{setBancoEmpMode('all');setBancoSearch('');}}
                    style={{padding:'5px 13px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:bancoEmpMode==='all'?700:400,background:bancoEmpMode==='all'?'rgba(30,112,181,0.12)':(T.surfaceSub||'rgba(0,0,0,0.03)'),color:bancoEmpMode==='all'?'#1E70B5':T.textS,border:`1.5px solid ${bancoEmpMode==='all'?'#1E70B588':T.border}`,transition:'all .12s',flexShrink:0}}>
                    Todos
                  </button>
                  {/* Busca com dropdown — overflow visible para não clipar */}
                  <div style={{position:'relative',flex:1,maxWidth:300,minWidth:160}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',zIndex:2,pointerEvents:'none'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      placeholder="Buscar por nome..."
                      value={bancoSearch}
                      onChange={e=>{setBancoSearch(e.target.value);if(!e.target.value.trim())setBancoEmpMode('all');}}
                      style={{paddingLeft:28,paddingRight:10,paddingTop:6,paddingBottom:6,border:`1.5px solid ${bancoSearch?T.goldLine+'88':T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface||'white',outline:'none',width:'100%',transition:'border-color .15s'}}/>
                    {bancoSearch.trim()&&(()=>{
                      const matches=employees.filter(e=>(e.name||'').toLowerCase().includes(bancoSearch.toLowerCase())||e.cpf.includes(bancoSearch));
                      return(
                        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:T.surface||'white',border:`1.5px solid ${T.goldLine}66`,borderRadius:10,overflow:'hidden',boxShadow:`0 8px 24px rgba(0,0,0,0.14)`,zIndex:9999}}>
                          {matches.length===0
                            ? <div style={{padding:'10px 14px',fontSize:12,color:T.textT}}>Nenhum resultado</div>
                            : matches.map(emp=>(
                              <div key={emp.cpf} onClick={()=>{setBancoEmpMode('single');setSelEmp(emp.cpf);setBancoSearch('');}}
                                style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',cursor:'pointer',transition:'background .1s'}}
                                onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                                <div>
                                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{emp.name||emp.cpf}</div>
                                  <div style={{fontSize:10,color:T.textT}}>{emp.cpf} · {emp.marks.length} marcações</div>
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Mini totalizador do funcionário selecionado */}
                {bancoEmpMode==='single'&&curEmp&&(()=>{
                  const range=getBancoDateRange();
                  const fd=curEmp.days.filter(d=>d.date>=range.from&&d.date<=range.to);
                  const totMin=fd.reduce((s,d)=>s+d.totalMin,0);
                  const totBal=fd.reduce((s,d)=>s+d.balance,0);
                  return(
                    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:`${curEmp.color}0A`,border:`1.5px solid ${curEmp.color}33`,flexWrap:'wrap'}}>
                      <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:`linear-gradient(135deg,${curEmp.color},${curEmp.color}cc)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',boxShadow:`0 3px 10px ${curEmp.color}44`}}>{initials(curEmp.name||curEmp.cpf)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{curEmp.name||curEmp.cpf}</div>
                        <div style={{fontSize:11,color:T.textT}}>{curEmp.cpf} · {curEmp.marks.length} marcações · {curEmp.days.length} dias</div>
                      </div>
                      <div style={{display:'flex',gap:16,alignItems:'center'}}>
                        {[
                          {l:'Trabalhado',v:fmtMin(totMin),c:T.text},
                          {l:'Saldo período',v:(totBal>=0?'+':'')+fmtMin(totBal),c:totBal>=0?'#1A9C70':'#C04050'},
                          {l:'Banco total',v:(curEmp.totBal>=0?'+':'')+fmtMin(curEmp.totBal),c:curEmp.totBal>=0?'#1A9C70':'#C04050'},
                        ].map(({l,v,c})=>(
                          <div key={l} style={{textAlign:'center'}}>
                            <div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                            <div style={{fontSize:10,color:T.textT}}>{l}</div>
                          </div>
                        ))}
                      </div>
                      <button onClick={()=>{setBancoEmpMode('all');setBancoSearch('');}}
                        style={{background:'none',border:`1px solid ${curEmp.color}44`,borderRadius:7,cursor:'pointer',color:curEmp.color,fontSize:13,lineHeight:1,padding:'5px 10px',fontWeight:600,outline:'none'}}>×</button>
                    </div>
                  );
                })()}

                {/* Linha 3: Filtrar dias (apenas quando funcionário selecionado) */}
                {bancoEmpMode==='single'&&curEmp&&(
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',paddingTop:2,borderTop:`1px solid ${T.border}`}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',flexShrink:0,width:90}}>Ver dias:</div>
                    {[['all','Todos os dias','#1E70B5'],['negative','Apenas negativos','#C04050'],['justified','Com justificativa',T.gold]].map(([v,l,c])=>(
                      <button key={v} onClick={()=>setBancoShowFilter(v)}
                        style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:bancoShowFilter===v?700:400,background:bancoShowFilter===v?`${c}14`:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:bancoShowFilter===v?c:T.textS,border:`1.5px solid ${bancoShowFilter===v?c+'55':T.border}`,transition:'all .12s'}}>
                        <div style={{width:7,height:7,borderRadius:'50%',background:bancoShowFilter===v?c:T.border,flexShrink:0,transition:'background .12s'}}/>
                        {l}
                      </button>
                    ))}
                    {bancoShowFilter==='justified'&&(()=>{
                      const count=Object.entries(justifs).filter(([k,v])=>v?.text&&k.startsWith(curEmp.cpf+'_')).length;
                      return <span style={{fontSize:11,color:T.textT,marginLeft:4}}>{count} justificativa{count!==1?'s':''} encontrada{count!==1?'s':''}</span>;
                    })()}
                  </div>
                )}
              </div>
            </Card>

            {/* ── Visão: TODOS os funcionários ── */}
            {bancoEmpMode==='all'&&(()=>{
              const range = getBancoDateRange();
              return(
                <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                  <div style={{padding:'14px 20px',background:`linear-gradient(135deg,${T.goldGl},transparent)`,borderBottom:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text}}>Todos os Funcionários — {bancoFilter==='todos'?'Período completo':bancoFilter==='hoje'?'Hoje':bancoFilter==='ontem'?'Ontem':bancoFilter==='3dias'?'Últimos 3 dias':bancoFilter==='7dias'?'Últimos 7 dias':'Últimos 30 dias'}</div>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                    <thead>
                      <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                        {['Funcionário','Marcações no período','Total Horas','Saldo'].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 16px'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp=>{
                        const filtDays = emp.days.filter(d=>d.date>=range.from&&d.date<=range.to);
                        const tot = filtDays.reduce((s,d)=>s+d.totalMin,0);
                        const bal = filtDays.reduce((s,d)=>s+d.balance,0);
                        const marks = filtDays.reduce((s,d)=>s+d.times.length,0);
                        return(
                          <tr key={emp.cpf} style={{borderTop:`1px solid ${T.border}`}}
                            onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.02)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={{padding:'12px 16px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:9}}>
                                <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                                <div>
                                  <div style={{fontSize:14,fontWeight:600,color:T.text}}>{emp.name||'—'}</div>
                                  <div style={{fontSize:11,color:T.textT}}>{emp.cpf}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{padding:'12px 16px',fontSize:13,color:T.text}}>{marks} marcação{marks!==1?'es':''} em {filtDays.length} dia{filtDays.length!==1?'s':''}</td>
                            <td style={{padding:'12px 16px',fontSize:14,fontWeight:700,color:T.text}}>{fmtMin(tot)}</td>
                            <td style={{padding:'12px 16px'}}>
                              <span style={{fontSize:13,fontWeight:700,color:bal>=0?'#1A9C70':'#C04050',background:bal>=0?'rgba(26,156,112,0.10)':'rgba(192,64,80,0.10)',padding:'3px 10px',borderRadius:6}}>
                                {bal>=0?'+':''}{fmtMin(bal)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              );
            })()}

            {curEmp&&bancoEmpMode==='single'&&(()=>{
              const range = getBancoDateRange();
              const filtDaysRaw = curEmp.days.filter(d=>
                bancoShowFilter==='justified'
                  ? true                              // ignora período, mostra todos com justif
                  : d.date>=range.from&&d.date<=range.to
              );
              const filtDays = filtDaysRaw.filter(d=>{
                if(bancoShowFilter==='negative') return d.balance < 0;
                if(bancoShowFilter==='justified') return !!justifs[`${curEmp.cpf}_${d.date}`]?.text;
                return true;
              });
              return(
              <>
                {/* Tabela diária */}
                {bancoShowFilter==='justified'&&(()=>{
                  const jvEntries=Object.entries(justifs).filter(([k,v])=>v?.text&&k.startsWith(curEmp.cpf+'_')).map(([k,v])=>({date:k.split('_')[1],text:v.text})).sort((a,b)=>a.date.localeCompare(b.date));
                  return jvEntries.length>0?(
                    <Card style={{padding:'14px 18px'}} elevated>
                      <div style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Todas as justificativas · {jvEntries.length}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {jvEntries.map(({date,text})=>(
                          <div key={date} style={{padding:'10px 14px',borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}44`,display:'flex',gap:12,alignItems:'flex-start'}}>
                            <div style={{flexShrink:0,minWidth:70}}>
                              <div style={{fontSize:12,fontWeight:700,color:T.gold}}>{fmtDate(date)}</div>
                              <div style={{fontSize:10,color:T.textT}}>{diaSem(date)}</div>
                            </div>
                            <div style={{flex:1,fontSize:13,color:T.text,lineHeight:1.5,borderLeft:`2px solid ${T.goldLine}55`,paddingLeft:12}}>{text}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ):null;
                })()}
                <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                  <div style={{padding:'14px 22px',borderBottom:`1px solid ${T.border}`,background:`linear-gradient(135deg,${T.goldGl},transparent)`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Detalhamento Diário — Banco de Horas</div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{fontSize:12,color:T.textT}}>Jornada base: {fmtMin(jornada)}/dia útil</div>
                      <button onClick={()=>printBancoFiltrado(curEmp,filtDays)}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:500,background:'rgba(26,156,112,0.10)',color:'#1A9C70',border:'1px solid rgba(26,156,112,0.25)'}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Baixar PDF
                      </button>
                    </div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                      <thead>
                        <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                          {['Data','Dia','Marcações','Trabalhado','Esperado','Saldo','Banco Acum.','Justificativa'].map(h=>(
                            <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 14px'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const rows = [];
                          let weekDays = [], weekIdx = 0;
                          filtDays.forEach((day, i) => {
                            weekDays.push(day);
                            const dayOfWeek = new Date(day.date+'T12:00:00').getDay();
                            const isLast = i === curEmp.days.length - 1;
                            const nextDayOfWeek = !isLast ? new Date(curEmp.days[i+1].date+'T12:00:00').getDay() : -1;
                            const endOfWeek = isLast || nextDayOfWeek <= dayOfWeek;
                            const balColor = day.issues.length>0?'#C04050':day.balance>=0?'#1A9C70':T.gold;
                            const cumColor = day.cumBal>=0?'#1A9C70':'#C04050';
                            rows.push(
                              <tr key={day.date} style={{borderTop:`1px solid ${T.border}`,background:day.wknd?'rgba(85,96,200,0.05)':i%2===0?'transparent':T.surfaceSub||'rgba(0,0,0,0.01)'}}>
                                <td style={{padding:'11px 16px',fontSize:13,fontWeight:500,color:T.text}}>{fmtDate(day.date)}</td>
                                <td style={{padding:'11px 16px'}}>
                                  <span style={{fontSize:11,fontWeight:600,color:day.wknd?'#5560C8':'#1E70B5',background:day.wknd?'rgba(85,96,200,0.10)':'rgba(30,112,181,0.08)',borderRadius:5,padding:'2px 7px'}}>{diaSem(day.date)}</span>
                                </td>
                                <td style={{padding:'11px 16px'}}>
                                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                    {day.times.map((t,ti)=>(
                                      <span key={ti} style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:ti%2===0?'rgba(26,156,112,0.12)':'rgba(30,112,181,0.10)',color:ti%2===0?'#1A9C70':'#1E70B5'}}>{t}</span>
                                    ))}
                                    {day.times.length===0&&<span style={{fontSize:12,color:T.textD}}>—</span>}
                                  </div>
                                </td>
                                <td style={{padding:'11px 14px',fontSize:14,fontWeight:600,color:T.text}}>{fmtMin(day.totalMin)}</td>
                                <td style={{padding:'11px 14px',fontSize:13,color:T.textT}}>{day.wknd?'Folga':fmtMin(day.expected)}</td>
                                <td style={{padding:'11px 14px'}}>
                                  <span style={{fontSize:13,fontWeight:700,color:balColor,background:`${balColor}12`,borderRadius:6,padding:'2px 9px'}}>{day.balance>0?'+':''}{fmtMin(day.balance)}{day.issues.length>0?' ⚠':''}</span>
                                </td>
                                <td style={{padding:'11px 14px'}}>
                                  <span style={{fontSize:14,fontWeight:700,color:cumColor}}>{day.cumBal>=0?'+':''}{fmtMin(day.cumBal)}</span>
                                </td>
                                <td style={{padding:'8px 14px',minWidth:190}}>
                                  {editJust?.cpf===curEmp.cpf&&editJust?.date===day.date ? (
                                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                      <textarea value={editText} onChange={e=>setEditText(e.target.value)} placeholder="Descreva a justificativa..."
                                        style={{width:'100%',minHeight:50,padding:'5px 8px',fontSize:11,fontFamily:'var(--font-body)',borderRadius:7,border:`1.5px solid ${T.goldLine}77`,outline:'none',resize:'vertical',background:T.surface||'white',color:T.text}}/>
                                      <div style={{display:'flex',gap:4}}>
                                        <button onClick={saveJustif} style={{flex:1,padding:'4px 0',borderRadius:6,background:'#1A9C70',color:'white',border:'none',cursor:'pointer',fontSize:11,fontWeight:600}}>Salvar</button>
                                        <button onClick={()=>{setEditJust(null);setEditText('');}} style={{padding:'4px 8px',borderRadius:6,background:T.surfaceSub||'rgba(0,0,0,0.05)',color:T.textS,border:`1px solid ${T.border}`,cursor:'pointer',fontSize:11}}>✕</button>
                                      </div>
                                    </div>
                                  ):(()=>{
                                    const jk=`${curEmp.cpf}_${day.date}`;
                                    const jv=justifs[jk];
                                    return(<div style={{display:'flex',alignItems:'flex-start',gap:5}}>
                                      {jv?.text?<div style={{flex:1,fontSize:11,color:T.textS,padding:'3px 7px',background:`${T.gold}10`,borderRadius:5,border:`1px solid ${T.gold}33`,lineHeight:1.4}}>✓ {jv.text}</div>:<span style={{fontSize:11,color:T.textD}}>—</span>}
                                      {isAdmin&&<button onClick={()=>{setEditJust({cpf:curEmp.cpf,date:day.date});setEditText(jv?.text||'');}}
                                        style={{flexShrink:0,padding:'3px 8px',borderRadius:5,background:T.goldGl,color:T.gold,border:`1px solid ${T.goldLine}44`,cursor:'pointer',fontSize:10,fontWeight:600,outline:'none'}}>
                                        {jv?.text?'Editar':'Justificar'}
                                      </button>}
                                    </div>);
                                  })()}
                                </td>
                              </tr>
                            );
                            if (endOfWeek) {
                              const wMin = weekDays.reduce((s,d)=>s+d.totalMin,0);
                              const wBal = weekDays.reduce((s,d)=>s+d.balance,0);
                              weekIdx++;
                              rows.push(
                                <tr key={`wk-${weekIdx}`} style={{background:T.goldGl,borderTop:`2px solid ${T.goldLine}33`,borderBottom:`2px solid ${T.goldLine}33`}}>
                                  <td colSpan={3} style={{padding:'7px 14px',fontSize:12,fontWeight:700,color:T.gold}}>★ Subtotal Semana {weekIdx} ({weekDays.length} dia{weekDays.length!==1?'s':''})</td>
                                  <td style={{padding:'7px 14px',fontSize:13,fontWeight:700,color:T.text}}>{fmtMin(wMin)}</td>
                                  <td style={{padding:'7px 14px',fontSize:13,color:T.textT}}>{fmtMin(jornada*weekDays.filter(d=>!d.wknd).length)}</td>
                                  <td style={{padding:'7px 14px',fontSize:13,fontWeight:700,color:wBal>=0?'#1A9C70':'#C04050'}}>{wBal>=0?'+':''}{fmtMin(wBal)}</td>
                                  <td style={{padding:'7px 14px',fontSize:13,fontWeight:700,color:day.cumBal>=0?'#1A9C70':'#C04050'}}>{day.cumBal>=0?'+':''}{fmtMin(day.cumBal)}</td>
                                  <td/>
                                </tr>
                              );
                              weekDays = [];
                            }
                          });
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
              );
            })()}
          </div>
        )}

        {/* ════════════
            TAB: CALENDÁRIO
        ════════════ */}
        {tab==='calendario'&&(()=>{
          const monthStr = calDates[Math.max(0,Math.min(calIdx,calDates.length-1))];
          if (!monthStr) return <Card style={{padding:40,textAlign:'center'}}><div style={{color:T.textT}}>Sem dados.</div></Card>;
          const [cy,cm] = monthStr.split('-').map(Number);
          const monthLabel = new Date(cy,cm-1,1).toLocaleString('pt-BR',{month:'long',year:'numeric'});
          const firstDay = new Date(cy,cm-1,1).getDay();
          const daysInMonth = new Date(cy,cm,0).getDate();
          const cells = [];
          for (let i=0;i<firstDay;i++) cells.push(null);
          for (let d=1;d<=daysInMonth;d++) cells.push(d);
          while (cells.length%7!==0) cells.push(null);

          return(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <SecHead title="Calendário" sub="Clique em um dia para ver todas as marcações · verde, laranja e vermelho por status"/>
              {/* Filtro de funcionários no calendário */}
              <Card style={{padding:'12px 16px',overflow:'visible'}} elevated>
                <div style={{display:'flex',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
                  {/* Busca */}
                  <div style={{position:'relative',flex:'0 0 220px'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',zIndex:1}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input value={calSearch} onChange={e=>setCalSearch(e.target.value)}
                      placeholder="Filtrar por nome..."
                      style={{paddingLeft:27,paddingRight:10,paddingTop:6,paddingBottom:6,border:`1.5px solid ${calSearch?T.goldLine+'88':T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface,outline:'none',width:'100%',transition:'border-color .15s'}}/>
                    {/* Dropdown de seleção */}
                    {calSearch.trim()&&(()=>{
                      const matches=employees.filter(e=>(e.name||'').toLowerCase().includes(calSearch.toLowerCase())||e.cpf.includes(calSearch));
                      return(
                        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:T.surface,border:`1.5px solid ${T.goldLine}66`,borderRadius:9,overflow:'hidden',boxShadow:`0 8px 24px rgba(0,0,0,0.14)`,zIndex:9999}}>
                          {matches.length===0
                            ? <div style={{padding:'8px 12px',fontSize:12,color:T.textT}}>Nenhum resultado</div>
                            : matches.map(emp=>(
                              <div key={emp.cpf} onClick={()=>{
                                setCalFilterEmps(prev=>prev.includes(emp.cpf)?prev:[...prev,emp.cpf]);
                                setCalSearch('');
                              }} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',cursor:'pointer',transition:'background .1s',opacity:calFilterEmps.includes(emp.cpf)?0.4:1}}
                                onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                <div style={{width:22,height:22,borderRadius:6,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                                <span style={{fontSize:12,fontWeight:500,color:T.text}}>{emp.name||emp.cpf}</span>
                                {calFilterEmps.includes(emp.cpf)&&<span style={{fontSize:10,color:'#1A9C70',marginLeft:'auto'}}>✓ selecionado</span>}
                              </div>
                            ))
                          }
                        </div>
                      );
                    })()}
                  </div>
                  {/* Chips dos selecionados */}
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,flex:1,alignItems:'center'}}>
                    {calFilterEmps.length===0
                      ? <span style={{fontSize:12,color:T.textT,fontStyle:'italic'}}>Todos os funcionários — clique na busca para filtrar</span>
                      : <>
                        {calFilterEmps.map(cpf=>{
                          const emp=employees.find(e=>e.cpf===cpf);
                          if(!emp) return null;
                          return(
                            <div key={cpf} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:7,background:`${emp.color}14`,border:`1.5px solid ${emp.color}44`}}>
                              <div style={{width:16,height:16,borderRadius:4,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                              <span style={{fontSize:11,fontWeight:600,color:emp.color}}>{emp.name||cpf}</span>
                              <button onClick={()=>setCalFilterEmps(prev=>prev.filter(c=>c!==cpf))} style={{background:'none',border:'none',cursor:'pointer',color:emp.color,fontSize:13,lineHeight:1,padding:0,marginLeft:1}}>×</button>
                            </div>
                          );
                        })}
                        <button onClick={()=>setCalFilterEmps([])} style={{fontSize:11,color:T.textD,background:'none',border:`1px solid ${T.border}`,borderRadius:6,padding:'2px 8px',cursor:'pointer',outline:'none'}}>Limpar</button>
                      </>
                    }
                  </div>
                </div>
              </Card>
              <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                {/* ── Calendário (lado esquerdo) ── */}
                <div style={{flex:'0 0 auto',width:'min(520px,100%)'}}>
                <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
              <div style={{padding:'14px 22px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(135deg,${T.goldGl},transparent)`}}>
                <button onClick={()=>setCalIdx(Math.max(0,calIdx-1))} disabled={calIdx===0}
                  style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.03)',cursor:calIdx===0?'not-allowed':'pointer',color:T.textS,display:'flex',alignItems:'center',justifyContent:'center',outline:'none',opacity:calIdx===0?0.3:1}}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                </button>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <svg width="10" height="10" viewBox="0 0 14 14" style={{animation:'starPulse 2s ease-in-out infinite'}}>
                    <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z" fill={T.goldV}/>
                  </svg>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:16,fontWeight:700,color:T.text,textTransform:'capitalize',letterSpacing:'.04em'}}>{monthLabel}</div>
                  <svg width="10" height="10" viewBox="0 0 14 14" style={{animation:'starPulse 2s ease-in-out infinite',animationDelay:'.5s'}}>
                    <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z" fill={T.goldV}/>
                  </svg>
                </div>
                <button onClick={()=>setCalIdx(Math.min(calDates.length-1,calIdx+1))} disabled={calIdx===calDates.length-1}
                  style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.03)',cursor:calIdx===calDates.length-1?'not-allowed':'pointer',color:T.textS,display:'flex',alignItems:'center',justifyContent:'center',outline:'none',opacity:calIdx===calDates.length-1?0.3:1}}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                </button>
              </div>
              {/* Header dias da semana — blob verde */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',position:'relative',overflow:'hidden',background:'#1A9C70'}}>
                <div style={{position:'absolute',width:100,height:100,borderRadius:'50%',background:'#0f7a56',filter:'blur(25px)',opacity:0.5,top:'-40px',left:'15%',animation:'hdrBlob1 5s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:80,height:80,borderRadius:'50%',background:'#2dd4a0',filter:'blur(20px)',opacity:0.45,top:'-20px',left:'65%',animation:'hdrBlob2 7s ease-in-out infinite'}}/>
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>(
                  <div key={d} style={{padding:'7px 0',textAlign:'center',fontSize:11,fontWeight:700,color:'white',letterSpacing:'.05em',position:'relative',zIndex:1}}>{d}</div>
                ))}
              </div>
              {/* Grid de dias */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:0}}>
                {cells.map((day,i)=>{
                  if (day===null) return <div key={i} style={{minHeight:80,borderRight:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.015)'}}/>;
                  const dateStr = `${cy}-${String(cm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const count = calData[dateStr]?.count||0;
                  const hasOdd   = calData[dateStr]?.hasOdd||false;
                  const hasTwins = calData[dateStr]?.hasTwins||false;
                  const wknd = isWknd_p(dateStr);
                  const hasMarks = count>0;
                  const isSelected = calSelDay === dateStr;
                  const cellColor = hasOdd ? '#C04050' : hasTwins ? '#D89030' : hasMarks ? '#1A9C70' : null;
                  // Animated gradient backgrounds for green/red
                  const animBg = hasOdd
                    ? 'linear-gradient(270deg,#C04050,#e06070,#C04050)'
                    : hasTwins
                    ? 'linear-gradient(270deg,#D89030,#f0b050,#D89030)'
                    : hasMarks
                    ? 'linear-gradient(270deg,#1A9C70,#2dd4a0,#1A9C70)'
                    : null;
                  return(
                    <div key={i} onClick={()=>{if(hasMarks){setCalSelDay(isSelected?null:dateStr);setCalPage(0);}}}
                      style={{minHeight:56,borderRight:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,
                        padding:'5px 7px',cursor:hasMarks?'pointer':'default',
                        background: isSelected
                          ? (hasOdd?'rgba(192,64,80,0.18)':hasTwins?'rgba(216,144,48,0.18)':'rgba(26,156,112,0.18)')
                          : (hasOdd?'rgba(192,64,80,0.07)':hasTwins?'rgba(216,144,48,0.07)':hasMarks?(wknd?'rgba(85,96,200,0.07)':'rgba(26,156,112,0.06)'):(wknd?'rgba(85,96,200,0.03)':'transparent')),
                        borderTop: isSelected ? `3px solid ${cellColor||'#ccc'}` : hasOdd?'3px solid #C04050':hasTwins?'3px solid #D89030':hasMarks?'3px solid #1A9C70':'none',
                        outline: isSelected ? `2px solid ${cellColor||'#1A9C70'}` : 'none',
                        transition:'all .15s'}}>
                      <div style={{fontSize:12,fontWeight:hasMarks?700:400,color:isSelected?(cellColor||'#1A9C70'):cellColor||(wknd?'#5560C8':T.textT),marginBottom:4}}>
                        {String(day).padStart(2,'0')}
                      </div>
                      {hasMarks&&(
                        <div>
                          <div style={{
                            fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,display:'inline-block',color:'white',
                            background:animBg,backgroundSize:'200% 200%',
                            animation:hasMarks?'blobGrad 3s ease infinite':'none'}}>
                            {count} {count===1?'batida':'batidas'}
                          </div>
                          {hasOdd&&<div style={{color:'#C04050',fontWeight:700,fontSize:10,marginTop:2}}>⚠ Incompleto</div>}
                          {!hasOdd&&hasTwins&&<div style={{color:'#D89030',fontSize:10,marginTop:2}}>⚡ Gêmea</div>}
                          {!hasOdd&&!hasTwins&&<div style={{color:'#1A9C70',fontSize:10,marginTop:2}}>✓ {Math.floor(count/2)} par{Math.floor(count/2)!==1?'es':''}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legenda */}
            <div style={{padding:'8px 16px',borderTop:`1px solid ${T.border}`,display:'flex',gap:14,flexWrap:'wrap',alignItems:'center'}}>
              {[{c:'#1A9C70',l:'Completo'},{c:'#D89030',l:'Gêmea'},{c:'#C04050',l:'Incompleto'},{c:'#5560C8',l:'Fim de semana'}].map(({c,l})=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:10,height:3,borderRadius:2,background:c}}/>
                  <span style={{fontSize:10,color:T.textT}}>{l}</span>
                </div>
              ))}
              {!calSelDay&&<span style={{fontSize:10,color:T.textT,marginLeft:'auto',fontStyle:'italic'}}>Clique em um dia para ver detalhes →</span>}
            </div>
          </Card>
                </div>

                {/* ── Detalhe do dia (lado direito) ── */}
                <div style={{flex:1,minWidth:0}}>
                {(()=>{
                  if (!calSelDay) return (
                    <div style={{height:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,color:T.textD,fontSize:13,opacity:0.6}}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 5l7 7-7 7"/></svg>
                      Clique em um dia no calendário
                    </div>
                  );
                  const dayEmpsRaw = employees
                    .filter(emp=>calFilterEmps.length===0||calFilterEmps.includes(emp.cpf))
                    .map(emp=>{
                    const d = emp.days.find(x=>x.date===calSelDay);
                    return d&&d.times.length>0 ? {emp,day:d} : null;
                  }).filter(Boolean);
                  // Ordenação
                  const dayEmps = [...dayEmpsRaw].sort((a,b)=>{
                    if(calDaySort==='az')       return (a.emp.name||a.emp.cpf).localeCompare(b.emp.name||b.emp.cpf);
                    if(calDaySort==='ok')       return a.day.issues.length - b.day.issues.length;
                    if(calDaySort==='negative') return a.day.balance - b.day.balance;
                    if(calDaySort==='positive') return b.day.balance - a.day.balance;
                    return 0;
                  });
                  const PAGE_SIZE = 8;
                  const totalPages = Math.max(1,Math.ceil(dayEmps.length/PAGE_SIZE));
                  const safePage = Math.min(calPage, totalPages-1);
                  const pageEmps = dayEmps.slice(safePage*PAGE_SIZE, (safePage+1)*PAGE_SIZE);
                  return(
                    <Card style={{padding:0,overflow:'hidden',height:'100%'}} elevated>
                      <div style={{padding:'12px 16px',background:`linear-gradient(135deg,${T.goldGl},transparent)`,borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div>
                          <div style={{fontFamily:'var(--font-brand)',fontSize:14,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>
                            {fmtDate(calSelDay)} — {diaSem(calSelDay)}
                          </div>
                          <div style={{fontSize:11,color:T.textT,marginTop:1}}>{dayEmps.length} funcionário{dayEmps.length!==1?'s':''} com marcações{calFilterEmps.length>0?` · ${calFilterEmps.length} filtrado${calFilterEmps.length>1?'s':''}`:''}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <button onClick={()=>printCalDia(calSelDay,dayEmps)}
                            style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:11,fontWeight:500,background:'rgba(26,156,112,0.10)',color:'#1A9C70',border:'1px solid rgba(26,156,112,0.25)'}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            PDF
                          </button>
                          <button onClick={()=>setCalSelDay(null)}
                            style={{width:24,height:24,borderRadius:7,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.04)',cursor:'pointer',color:T.textS,display:'flex',alignItems:'center',justifyContent:'center',outline:'none',fontSize:15}}>×</button>
                        </div>
                      </div>
                      {dayEmps.length===0
                        ? <div style={{padding:24,textAlign:'center',color:T.textT,fontSize:13}}>Nenhuma marcação neste dia.</div>
                        : <>
                          {/* Barra de ordenação */}
                          <div style={{padding:'8px 12px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                            <span style={{fontSize:10,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',marginRight:4}}>Ordenar:</span>
                            {[['az','A → Z','#1E70B5'],['ok','Ponto OK','#1A9C70'],['negative','Saldo −','#C04050'],['positive','Saldo +','#1A9C70']].map(([v,l,c])=>(
                              <button key={v} onClick={()=>setCalDaySort(v)}
                                style={{padding:'3px 10px',borderRadius:6,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:11,fontWeight:calDaySort===v?700:400,background:calDaySort===v?`${c}18`:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:calDaySort===v?c:T.textS,border:`1.5px solid ${calDaySort===v?c+'55':T.border}`,transition:'all .12s'}}>
                                {l}
                              </button>
                            ))}
                          </div>
                          <div style={{overflowY:'auto',maxHeight:360}}>
                            <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                              <thead>
                                <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                                  {['Funcionário','Marcações','Total','Saldo','Observação'].map(h=>(
                                    <th key={h} style={{textAlign:'left',fontSize:10,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'7px 12px',position:'sticky',top:0,background:T.surface}}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {pageEmps.map(({emp,day})=>{
                                  const jKey=`${emp.cpf}_${calSelDay}`;
                                  const jv=justifs[jKey];
                                  const hasIssue=day.issues.length>0;
                                  return(
                                  <tr key={emp.cpf} style={{borderTop:`1px solid ${T.border}`,background:hasIssue?'rgba(192,64,80,0.03)':'transparent'}}>
                                    <td style={{padding:'9px 12px'}}>
                                      <div style={{display:'flex',alignItems:'center',gap:7}}>
                                        <div style={{width:26,height:26,borderRadius:7,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                                        <div>
                                          <div style={{fontSize:12,fontWeight:600,color:T.text}}>{emp.name||'—'}</div>
                                          <div style={{fontSize:9,color:T.textT}}>{emp.cpf}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{padding:'9px 12px'}}>
                                      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                                        {day.pairs.map((pair,pi)=>(
                                          <div key={pi} style={{display:'flex',alignItems:'center',gap:2}}>
                                            {pi>0&&<span style={{color:T.textD,fontSize:9}}>·</span>}
                                            <span style={{fontSize:11,fontWeight:700,color:'#1A9C70',background:'rgba(26,156,112,0.10)',padding:'1px 5px',borderRadius:4}}>{pair.entry}</span>
                                            {pair.exit&&<><span style={{color:T.textD,fontSize:9}}>→</span><span style={{fontSize:11,fontWeight:700,color:'#1E70B5',background:'rgba(30,112,181,0.10)',padding:'1px 5px',borderRadius:4}}>{pair.exit}</span></>}
                                            {!pair.exit&&<span style={{fontSize:10,color:'#C04050',background:'rgba(192,64,80,0.08)',padding:'1px 5px',borderRadius:4}}>✗</span>}
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                    <td style={{padding:'9px 12px',fontSize:12,fontWeight:700,color:T.text,whiteSpace:'nowrap'}}>{fmtMin(day.totalMin)}</td>
                                    <td style={{padding:'9px 12px'}}>
                                      <span style={{fontSize:11,fontWeight:700,color:day.balance>=0?'#1A9C70':'#C04050',background:day.balance>=0?'rgba(26,156,112,0.10)':'rgba(192,64,80,0.10)',padding:'2px 7px',borderRadius:5}}>
                                        {day.balance>=0?'+':''}{fmtMin(day.balance)}
                                      </span>
                                    </td>
                                    <td style={{padding:'9px 12px',maxWidth:160}}>
                                      {jv?.text
                                        ? <div style={{fontSize:11,color:T.textS,background:`${T.gold}10`,border:`1px solid ${T.gold}33`,borderRadius:6,padding:'3px 8px',lineHeight:1.4,display:'flex',gap:5,alignItems:'flex-start'}}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" style={{marginTop:1,flexShrink:0}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            {jv.text}
                                          </div>
                                        : <span style={{fontSize:10,color:T.textD}}>—</span>
                                      }
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {totalPages>1&&(
                            <div style={{padding:'8px 12px',borderTop:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                              <button onClick={()=>setCalPage(p=>Math.max(0,p-1))} disabled={safePage===0}
                                style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.03)',cursor:safePage===0?'not-allowed':'pointer',color:T.textS,fontSize:11,outline:'none',opacity:safePage===0?0.4:1}}>← Anterior</button>
                              <span style={{fontSize:11,color:T.textT}}>Pág {safePage+1}/{totalPages}</span>
                              <button onClick={()=>setCalPage(p=>Math.min(totalPages-1,p+1))} disabled={safePage===totalPages-1}
                                style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.03)',cursor:safePage===totalPages-1?'not-allowed':'pointer',color:T.textS,fontSize:11,outline:'none',opacity:safePage===totalPages-1?0.4:1}}>Próxima →</button>
                            </div>
                          )}
                        </>
                      }
                    </Card>
                  );
                })()}
                </div>
              </div>
            </div>
          );
          })()}

        {/* ════════════
            TAB: LINHA A LINHA
        ════════════ */}
        {tab==='linhaLinha'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <SecHead title="Linha a Linha" sub="Auditoria completa de todos os registros do arquivo AFD"/>
          <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
            <div style={{padding:'12px 18px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text,flex:1,minWidth:120}}>Registros do AFD</div>
              {/* Filtro de data */}
              <div style={{display:'flex',gap:4}}>
                {[['hoje','Hoje'],['3dias','3 dias'],['7dias','7 dias'],['30dias','30 dias'],['todos','Todos']].map(([v,l])=>(
                  <button key={v} onClick={()=>setLineDate(v)}
                    style={{padding:'5px 10px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:11,fontWeight:lineDate===v?700:400,background:lineDate===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:lineDate===v?T.gold:T.textS,border:`1.5px solid ${lineDate===v?T.goldLine+'55':T.border}`,transition:'all .12s'}}>
                    {l}
                  </button>
                ))}
              </div>
              {/* Busca */}
              <div style={{position:'relative'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={lineSearch} onChange={e=>setLineSearch(e.target.value)} placeholder="Buscar nome ou CPF..."
                  style={{paddingLeft:28,paddingRight:10,paddingTop:6,paddingBottom:6,border:`1px solid ${T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface||'white',outline:'none',width:180}}/>
              </div>
              {/* Filtro de tipo */}
              <select value={lineType} onChange={e=>setLineType(e.target.value)}
                style={{padding:'6px 8px',border:`1px solid ${T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface||'white',outline:'none',cursor:'pointer'}}>
                <option value="all">Todos os tipos</option>
                <option value="3">Marcação de Ponto</option>
                <option value="5">Cadastro</option>
                <option value="4">Ajuste de Data/Hora</option>
                <option value="other">Eventos do Sistema</option>
              </select>
              <Tag color={T.blue} style={{fontSize:11}}>{rawRecs.filter(r=>{
                const today=new Date(); today.setHours(0,0,0,0);
                const rDate=r.date?new Date(r.date+'T00:00:00'):null;
                const daysAgo=(d)=>{const x=new Date(today);x.setDate(x.getDate()-d);return x;};
                const matchDate=lineDate==='todos'||!rDate||(lineDate==='hoje'?rDate>=today:lineDate==='3dias'?rDate>=daysAgo(2):lineDate==='7dias'?rDate>=daysAgo(6):rDate>=daysAgo(29));
                const empM=r.cpf&&r.cpf!=='—'?employees.find(e=>e.cpf===r.cpf):null;
                const nm=empM?.name||r.nome||'';
                const matchSearch=!lineSearch||(nm.toLowerCase().includes(lineSearch.toLowerCase())||r.cpf?.includes(lineSearch));
                const matchType=lineType==='all'||(lineType==='other'?!['3','4','5'].includes(r.tipo):r.tipo===lineType);
                return matchDate&&matchSearch&&matchType;
              }).length} registros</Tag>
            </div>
            <div style={{overflowX:'auto',maxHeight:600,overflowY:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                <thead style={{position:'sticky',top:0,zIndex:1}}>
                  <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.03)'}}>
                    {['#','NSR','Data','Hora','PIS/CPF','Nome','Tipo de Registro','Observação'].map(h=>(
                      <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 14px',whiteSpace:'nowrap',background:T.surface,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRecs.filter(rec=>{
                    const today2=new Date(); today2.setHours(0,0,0,0);
                    const rDate2=rec.date?new Date(rec.date+'T00:00:00'):null;
                    const daysAgo2=(d)=>{const x=new Date(today2);x.setDate(x.getDate()-d);return x;};
                    const matchDate=lineDate==='todos'||!rDate2||(lineDate==='hoje'?rDate2>=today2:lineDate==='3dias'?rDate2>=daysAgo2(2):lineDate==='7dias'?rDate2>=daysAgo2(6):rDate2>=daysAgo2(29));
                    const emp=rec.cpf&&rec.cpf!=='—'?employees.find(e=>e.cpf===rec.cpf):null;
                    const nm=emp?.name||rec.nome||'';
                    const matchSearch=!lineSearch||(nm.toLowerCase().includes(lineSearch.toLowerCase())||rec.cpf?.includes(lineSearch));
                    const matchType=lineType==='all'||(lineType==='other'?!['3','4','5'].includes(rec.tipo):rec.tipo===lineType);
                    return matchDate&&matchSearch&&matchType;
                  }).map((rec,i)=>{
                    const emp = rec.cpf&&rec.cpf!=='—' ? employees.find(e=>e.cpf===rec.cpf) : null;
                    const name = emp?.name || (rec.nome||'');
                    const tipoColor = rec.tipo==='3'?'#1A9C70':rec.tipo==='5'?'#1E70B5':rec.tipo==='4'?T.gold:'#9AA8B8';
                    const jvLine = rec.tipo==='3'&&rec.cpf&&rec.cpf!=='—'&&rec.date ? justifs[`${rec.cpf}_${rec.date}`] : null;
                    return(
                      <tr key={i} style={{borderTop:`1px solid ${T.border}`,background:i%2===0?'transparent':(T.surfaceSub||'rgba(0,0,0,0.015)')}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.03)'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'transparent':(T.surfaceSub||'rgba(0,0,0,0.015)')}>
                        <td style={{padding:'9px 14px',fontSize:12,color:T.textD,fontWeight:500}}>{i+1}</td>
                        <td style={{padding:'9px 14px',fontSize:12,color:T.textT,fontFamily:'monospace'}}>{rec.nsr}</td>
                        <td style={{padding:'9px 14px',fontSize:12,color:T.textS}}>{rec.date?fmtDate(rec.date):'—'}</td>
                        <td style={{padding:'9px 14px',fontSize:13,fontWeight:600,color:T.text}}>{rec.time||'—'}</td>
                        <td style={{padding:'9px 14px',fontSize:12,color:T.textS,fontFamily:'monospace'}}>{rec.cpf&&rec.cpf!=='—'?rec.cpf:'—'}</td>
                        <td style={{padding:'9px 14px'}}>
                          {emp?(
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                              <div style={{width:24,height:24,borderRadius:6,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#fff',flexShrink:0}}>{initials(emp.name||emp.cpf)}</div>
                              <span style={{fontSize:13,fontWeight:500,color:emp.name?T.text:'#C04050'}}>{emp.name||emp.cpf}</span>
                            </div>
                          ):(name?<span style={{fontSize:12,color:T.textS}}>{name}</span>:<span style={{fontSize:11,color:T.textD}}>—</span>)}
                        </td>
                        <td style={{padding:'9px 14px'}}>
                          <span style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:5,background:`${tipoColor}14`,color:tipoColor}}>{rec.label}</span>
                        </td>
                        <td style={{padding:'9px 14px',maxWidth:180}}>
                          {jvLine?.text
                            ? <div style={{fontSize:11,color:T.textS,background:`${T.gold}10`,border:`1px solid ${T.gold}33`,borderRadius:6,padding:'3px 8px',lineHeight:1.4,display:'flex',gap:5,alignItems:'flex-start'}}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" style={{marginTop:2,flexShrink:0}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                {jvLine.text}
                              </div>
                            : <span style={{fontSize:10,color:T.textD}}>—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          </div>
        )}

        {/* ════════════
            TAB: INCONSISTÊNCIAS
        ════════════ */}
        {tab==='issues'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <SecHead title="Inconsistências" sub="Marcações irregulares detectadas automaticamente"/>
            {totalIssues===0?(
              <Card style={{padding:'60px',textAlign:'center'}} elevated>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="1.3" strokeLinecap="round" style={{margin:'0 auto 20px',display:'block'}}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <div style={{fontSize:22,fontWeight:700,color:T.text,marginBottom:10}}>Sem inconsistências detectadas</div>
                <div style={{fontSize:15,color:T.textT}}>Todos os registros de ponto estão em conformidade.</div>
              </Card>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={{padding:'16px 20px',borderRadius:14,background:T.surface||'white',border:'2px solid #C04050',boxShadow:`0 4px 16px rgba(192,64,80,0.15)`,display:'flex',alignItems:'center',gap:14}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C04050" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:'#C04050'}}>{totalIssues} inconsistência{totalIssues>1?'s':''} encontrada{totalIssues>1?'s':''}</div>
                    <div style={{fontSize:12,color:T.textS,marginTop:2}}>Verifique os registros abaixo e corrija no sistema de ponto</div>
                  </div>
                </div>
                {employees.filter(e=>e.totIssues>0).map(emp=>(
                  <Card key={emp.cpf} style={{padding:'18px 22px'}} elevated>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                      <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}cc)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:emp.name?T.text:'#C04050'}}>{emp.name||emp.cpf}</div>
                        <div style={{fontSize:11,color:T.textT}}>{emp.cpf} · {emp.totIssues} inconsistência{emp.totIssues>1?'s':''}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {emp.days.filter(d=>d.issues.length>0).map(day=>{
                        const jvIss = justifs[`${emp.cpf}_${day.date}`];
                        return(
                        <div key={day.date} style={{borderRadius:10,padding:'12px 16px',background:jvIss?.text?'rgba(212,160,0,0.06)':'rgba(192,64,80,0.06)',border:`1px solid ${jvIss?.text?T.goldLine+'44':'rgba(192,64,80,0.20)'}`}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontSize:13,fontWeight:600,color:T.text}}>{fmtDate(day.date)}</span>
                              <Tag color={T.blue} style={{fontSize:10,padding:'1px 7px'}}>{diaSem(day.date)}</Tag>
                            </div>
                            <span style={{fontSize:12,color:T.textS}}>{fmtMin(day.totalMin)} trabalhadas</span>
                          </div>
                          {day.issues.map((iss,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:'#C04050',marginBottom:i<day.issues.length-1?4:0}}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                              {iss}
                            </div>
                          ))}
                          <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:5}}>
                            {day.times.map((t,ti)=>(<span key={ti} style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:5,background:`${T.gold}14`,border:`1px solid ${T.gold}30`,color:T.gold}}>{t}</span>))}
                          </div>
                          {/* Observação/Justificativa */}
                          {jvIss?.text
                            ? <div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:`${T.gold}10`,border:`1.5px solid ${T.gold}44`,display:'flex',gap:8,alignItems:'flex-start'}}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" style={{marginTop:1,flexShrink:0}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <div>
                                  <div style={{fontSize:10,fontWeight:600,color:T.gold,marginBottom:2,textTransform:'uppercase',letterSpacing:'.06em'}}>Observação do RH</div>
                                  <div style={{fontSize:12,color:T.textS,lineHeight:1.5}}>{jvIss.text}</div>
                                </div>
                              </div>
                            : <div style={{marginTop:8,display:'flex',alignItems:'center',gap:5,fontSize:11,color:T.textD,opacity:0.6}}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Sem observação — adicione via Banco de Horas
                              </div>
                          }
                        </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
      </div>
    </div>
  );
};
/* ── fim PontoEletronico ── */

/* ══════════════════════════════════════════════════
   CENTRAL ALEXA — Festival · Mural · Recados
══════════════════════════════════════════════════ */
const MOCK_QUEUE = [
  {id:1,title:'Blinding Lights',artist:'The Weeknd',addedBy:'Ander',addedColor:'#1E70B5',votes:0,cover:'🎵',duration:'3:20'},
  {id:2,title:'As It Was',artist:'Harry Styles',addedBy:'Victor',addedColor:'#9B59B6',votes:1,cover:'🎶',duration:'2:47'},
  {id:3,title:'Flowers',artist:'Miley Cyrus',addedBy:'Maria',addedColor:'#E91E8C',votes:0,cover:'🎵',duration:'3:21'},
  {id:4,title:'Anti-Hero',artist:'Taylor Swift',addedBy:'Fernanda',addedColor:'#E67E22',votes:2,cover:'🎶',duration:'3:20'},
  {id:5,title:'Levitating',artist:'Dua Lipa',addedBy:'João',addedColor:'#1A9C70',votes:0,cover:'🎵',duration:'3:23'},
];
const MOCK_MSGS = [
  {id:1,from:'Mariana Costa',fromColor:'#E91E8C',to:'Você',msg:'Oi! Você viu o e-mail sobre a reunião de amanhã? Confirma presença!',time:'09:32',ouvido:false},
  {id:2,from:'Carlos TI',fromColor:'#1E70B5',to:'Você',msg:'Valeu pela ajuda com o sistema ontem! 👏',time:'08:15',ouvido:true},
  {id:3,from:'Você',fromColor:'#1A9C70',to:'Fernanda',msg:'Bom dia! Os relatórios já estão prontos.',time:'Ontem',ouvido:true},
];
const MOCK_BDAYS = [
  {name:'Carlos Mendes',dept:'TI',date:'Hoje',emoji:'🎂'},
  {name:'Ana Souza',dept:'Comercial',date:'Amanhã',emoji:'🎁'},
  {name:'Rafael Lima',dept:'Operações',date:'28/05',emoji:'🎉'},
];


const DOKO_WAVE_IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAQABAADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/AMcCigUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUd6KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooo/GgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAo70UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAkHfNFFFAwoxiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigANGaKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoxRRQACiiigAooooAKKKKACiiigAooxRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFJ3paTHNAC0UUUAFFFFABRRRQAUUUUAFFFFABwO1FFFABRRRQAUfSiigAooooAKKMCigAooooAKKKKACiiigAooooAKOfWiigTCiiigYUUUd6ACiiigAooooAKKKKACiiigAooooAKKKKACkBNLRigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooNIKAFooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACigZooAKKKKACiiigAo70fjSd+tAhaKKKACij2oJxQMKKQMG6GloAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKBxRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRR+FABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUDPeigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACkFLRjnNABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABijFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUmKWjFAB0ooooAKKKKACiikLUAIWOcA9O9IWK9+/pTWbAwOtNLE9TQA4yYPWk8w+pptFADvNb1/SgSsO9NooAkVjjjFPDZFQhiOhNG5v7xoAnyPWioQ5HQml8xh3/SgCXNAqISt6ClE3tQBJRTFlBOKcHU/xCgQtFFFABRRRQMKKKKBBRRRQCCiiigYUc0UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAB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b3mVn/8AQjXd0VDrVpbyf3sOWPY57T/hR8NNKAGn+AtHhx0KadHn9RWva6Ppljn7Fp1vDntFCq4/IVaoqG5PdjskIF4xmjbj7vFLRSGIFAOaAAKWigAooooAKKKKACiiigAooooAKKKKACjHpRRQAUmMjmlooEJjHTik2nsfwxTvrRigY3bg8E0mwjv+dPxjpRigCPYeu6jaeDnpT8UAUANCnP8AKlCEHNLigDtQAgQDoD+dAjAAFO6dKMelACUtFFAgo/GiigYUUUUAFFFFABRRRQAUUUUAFFH1ooAKKKKACiiigAo70YoxQIKKKKBhRRRQAUUUUAFFFFAkFFFFAwooooAKKKKACiiigAooooAKKKO9ACCloooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKO9FABRRRQAUUUUAFFAooAKKKKACiiigAoooAxQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFHNFFABRRRQAUUUUAFFFFABRRRQAY5zRRRQAUUUUAFFFFABRiiigA5ooooAKKKKACiiigAooooAKKKKAYUUUUAFFFFAgooooGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAJ15NLmjrRigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACijNAzQAUZopMUALRQBiigAoooxQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQDCiiigAooooAKMc0UUAA4ooooAKKKKACiiigAooooAKKKKACiiigAoFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAH4UCiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooxRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAYxRRR3oEFFFFAwooooAKKKKACg0UUAFHeiigAooooAKKKKACiiigAooooAKKKKACiig0AFFFHSgBOlKKTmlxjpQAUUUUAFFFFABRRRQAUUUUAFFFFAAc0fjRSZoAWiiigAooBo70AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUgCiiimAUUUUAFFFGPagAooooABxRRRQAUUUUAFFFFABRmijHNACDNLSAUuKACiiigAooooAKKKKACiiigAooxRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRjFFFABRRRQAUUUUAFFFFAB9aTrS0YoAKB0oooAKKKKACiiigAooooAKKKKACiiigAooooAKM0UYoADRRRQAdOlFA6UfjQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAB9KAOKKKACiiigAooowKACiiigAooooAKKKDQAUUUUAFIetLRQAUUUUAGKKKKBBRRRQMKKKKACiiigAooooAKM80UYoAQigUtGKACiiigAooooAKKKKACiiigAooooAKKKBQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABQKKKACiiigAooooAKKBRQAUUUUAFFFFABRRRQAUUUUAFFFFAB3ooFFAgooooGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABjFFBpMUALRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFHaigAooooAKKKKACiiigAooooAKKKKADvRSL0paAD6UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUZoAKKQHtS0AFFFFABgelAGKKKACiiigAooo70AFFHeigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACijmigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAMUUUUCCiiigYUUUUAFFFFABRRRQAUUUUAFFFFABRR3ooAKKKKACiiigAooooAKKKKACijmigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z";

const DOKO_MSGS_IDLE = [
  "Bora colocar aquela música massa! 🎵",
  "Fila tá quente hoje! 🔥",
  "Qual vai ser a próxima? 👀",
  "A vibe tá boa! Continua assim 🎶",
  "Que tal um bossanova? 😎",
];
const DOKO_MSGS_ADD = (name, song) => [
  `${name} adicionou "${song}" na fila! 🎵`,
  `Boa escolha, ${name}! "${song}" chegando! 🔥`,
  `Preparem os ouvidos: "${song}" em breve! 🎧`,
];
const DOKO_MSGS_SKIP = (name) => [
  `${name} pulou a música! Coragem! ⏭`,
  `Skip! ${name} não tava curtindo 😅`,
  `${name}: "Próxima!" ⏭🎵`,
];
const DOKO_MSGS_VETO = (song, v, lim) => v >= lim
  ? [`Fora! "${song}" foi vetada democraticamente! 🗳️`]
  : [`${v} voto(s) contra "${song}". Mais ${lim - v} e ela sai! 🗳️`];

const ALEXA_RESPONSES = [
  { pat: /(tempo|previsão|clima|chuva|sol)/i, resp: "🌤 Em Fortaleza agora são 29°C com céu parcialmente nublado. Máxima de 32°C e mínima de 26°C hoje. Não precisa de guarda-chuva!" },
  { pat: /(hora|horas|que horas)/i, resp: () => `🕐 São ${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} agora.` },
  { pat: /(ponto|bater ponto|marcar ponto)/i, resp: "📍 Lembrete de ponto enviado para todos os colaboradores! Eles vão receber uma notificação." },
  { pat: /(aniversário|aniversariante)/i, resp: "🎂 Hoje Carlos Mendes do TI faz aniversário! Já anunciei para toda a equipe de manhã." },
  { pat: /(música|tocando|fila|festival)/i, resp: "🎵 Estou com Festival mode ligado! A fila tem várias músicas incríveis esperando. Vai rolar muito bom!" },
  { pat: /(reunião|meeting|agenda)/i, resp: "📅 Você tem reunião de planejamento hoje às 14h. Vou lembrar você 15 minutos antes!" },
  { pat: /(piada|conta uma|engraçado)/i, resp: "😄 Por que o programador saiu do bar? Porque ele não encontrou nenhum bug na cerveja!" },
  { pat: /(oi|olá|hello|ei alexa)/i, resp: "👋 Olá! Estou aqui e pronta pra ajudar. O que você precisa?" },
  { pat: /(obrigad)/i, resp: "😊 Por nada! Sempre aqui pra ajudar a equipe da 7SERV!" },
];

const CentralAlexa = ({onBack}) => {
  const isDark   = !!T.page;
  const cardBg   = isDark ? T.surface : (T.surfaceW||"rgba(255,255,255,0.78)");
  const headerBg = isDark ? `${T.surface}ee` : (T.surfaceW||"rgba(255,255,255,0.82)");

  // ── UI state ─────────────────────────────────────────────
  const [tab, setTab]             = useState("festival");
  const [dokoMsg, setDokoMsg]     = useState(DOKO_MSGS_IDLE[0]);
  const [voiceVal, setVoiceVal]   = useState("");
  const [voiceFocus, setVoiceFocus] = useState(false);
  const [alexaConvo, setAlexaConvo] = useState([
    {role:"alexa",text:"👋 Olá, equipe! Estou online e pronta. Pode falar!",ts:"agora"}
  ]);
  const [alexaInput, setAlexaInput]   = useState("");
  const [alexaTyping, setAlexaTyping] = useState(false);
  const [myName, setMyName] = useState(() => {
    const auth = getAuthUser();
    return auth?.name || USER.name || 'Colaborador';
  });

  // ── Festival: estado real (Spotify + Supabase) ───────────
  const [queue, setQueue]               = useState([]);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [currentSong, setCurrentSong]   = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching]   = useState(false);
  const [isAdding, setIsAdding]         = useState(null); // track.id sendo adicionado
  const [skipVotes, setSkipVotes]       = useState({});   // song_id → contagem
  const [myVotedSongs, setMyVotedSongs] = useState(new Set());
  const [spotifyOk, setSpotifyOk]       = useState(false);
  const [devices, setDevices]           = useState([]);
  const [showDevices, setShowDevices]   = useState(false);
  const [festLoading, setFestLoading]   = useState(true);
  const [serverMsg, setServerMsg]       = useState("");
  const searchTimer = useRef(null);

  // ID único por sessão (para sistema de votos)
  const [userId] = useState(() => {
    let id = sessionStorage.getItem('ch_festival_uid');
    if (!id) {
      const auth = getAuthUser();
      const base = (auth?.name || USER.name || 'user').replace(/\s+/g,'_');
      id = `${base}_${Math.random().toString(36).substr(2,6)}`;
      sessionStorage.setItem('ch_festival_uid', id);
    }
    return id;
  });

  // ── Helpers de API ───────────────────────────────────────
  const api = async (method, path, body) => {
    try {
      const opts = { method, headers: {'Content-Type':'application/json'} };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(`${SERVER_URL}${path}`, opts);
      return r.json();
    } catch (e) {
      return { error: 'Servidor offline. Inicie o servidor Node.' };
    }
  };

  // ── Carrega dados do Supabase ────────────────────────────
  const loadQueue = async () => {
    const { data } = await _supabase
      .from('queue').select('*')
      .in('status', ['pending','playing'])
      .order('position', { ascending: true });
    setQueue(data || []);
    setFestLoading(false);
  };

  const loadPlayerState = async () => {
    const { data } = await _supabase
      .from('player_state').select('*, current:queue!player_state_current_song_id_fkey(*)')
      .eq('id', 1).single();
    if (data) {
      setIsPlaying(!!data.is_playing);
      setCurrentSong(data.current || null);
    }
  };

  const loadSkipVotes = async (queueData) => {
    const ids = (queueData || queue).filter(s=>['pending','playing'].includes(s.status)).map(s=>s.id);
    if (!ids.length) { setSkipVotes({}); return; }
    const { data } = await _supabase.from('skip_votes').select('song_id').in('song_id', ids);
    const counts = {};
    (data||[]).forEach(v => { counts[v.song_id] = (counts[v.song_id]||0) + 1; });
    setSkipVotes(counts);
  };

  const checkSpotify = async () => {
    const r = await api('get', '/api/status').catch(()=>({ok:false}));
    setSpotifyOk(!!r?.ok);
  };

  const [festColors, setFestColors]     = useState(null);
  const [blobsVisible, setBlobsVisible] = useState(true);

  // ── Supabase realtime ────────────────────────────────────
  useEffect(() => {
    checkSpotify();
    loadQueue();
    loadPlayerState();

    const qSub = _supabase.channel('ch_queue_rt')
      .on('postgres_changes', {event:'*',schema:'public',table:'queue'}, () => loadQueue())
      .subscribe();

    const pSub = _supabase.channel('ch_player_rt')
      .on('postgres_changes', {event:'*',schema:'public',table:'player_state'}, () => loadPlayerState())
      .subscribe();

    const vSub = _supabase.channel('ch_votes_rt')
      .on('postgres_changes', {event:'*',schema:'public',table:'skip_votes'}, () => loadSkipVotes())
      .subscribe();

    const idleTimer = setInterval(() => {
      setDokoMsg(m => {
        const opts = DOKO_MSGS_IDLE.filter(x=>x!==m);
        return opts[Math.floor(Math.random()*opts.length)];
      });
    }, 14000);

    return () => {
      _supabase.removeChannel(qSub);
      _supabase.removeChannel(pSub);
      _supabase.removeChannel(vSub);
      clearInterval(idleTimer);
    };
  }, []);

  useEffect(() => { loadSkipVotes(queue); }, [queue]);

  // Extrai cores da capa quando a música muda
  useEffect(() => {
    if (!currentSong?.album_art) return;
    setBlobsVisible(false);
    const t = setTimeout(() => {
      extractAlbumColors(currentSong.album_art).then(colors => {
        if (colors) setFestColors(colors);
        setBlobsVisible(true);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [currentSong?.album_art]);

  // ── Ações do Festival ────────────────────────────────────
  const handleSearch = (val) => {
    setVoiceVal(val);
    clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      const r = await api('get', `/api/search?q=${encodeURIComponent(val)}`);
      setSearchResults(r.tracks || []);
      setIsSearching(false);
    }, 450);
  };

  const addToQueue = async (track) => {
    if (isAdding) return;
    setIsAdding(track.id);
    setSearchResults([]);
    setVoiceVal('');
    const r = await api('post', '/api/queue', {
      uri: track.uri, spotify_id: track.id,
      title: track.title, artist: track.artist,
      album_art: track.album_art, requested_by: myName,
      duration_ms: track.duration_ms, duration_str: track.duration_str,
    });
    if (!r.error) {
      const msgs = DOKO_MSGS_ADD(myName, track.title);
      setDokoMsg(msgs[Math.floor(Math.random()*msgs.length)]);
      setServerMsg('');
      if (!isPlaying && !currentSong) api('post', '/api/player/play');
    } else {
      setServerMsg(r.error);
      setTimeout(()=>setServerMsg(''), 4000);
    }
    setIsAdding(null);
  };

  const handleVote = async (song) => {
    if (myVotedSongs.has(song.id)) {
      setServerMsg('Você já votou para pular essa música');
      setTimeout(()=>setServerMsg(''), 3000);
      return;
    }
    const r = await api('post', '/api/vote/skip', { user_id: userId, song_id: song.id });
    if (r.error === 'Você já votou') { setMyVotedSongs(s=>new Set([...s,song.id])); return; }
    if (!r.error) {
      setMyVotedSongs(s=>new Set([...s,song.id]));
      const msgs = DOKO_MSGS_VETO(song.title, r.votes, r.needed||3);
      setDokoMsg(msgs[0]);
      if (r.skipped) {
        const skipMsgs = DOKO_MSGS_SKIP(myName);
        setTimeout(()=>setDokoMsg(skipMsgs[Math.floor(Math.random()*skipMsgs.length)]),600);
      }
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      const r = await api('post', '/api/player/pause');
      if (!r.error) setIsPlaying(false);
    } else if (currentSong || queue.length) {
      const r = await api('post', currentSong ? '/api/player/resume' : '/api/player/play');
      if (!r.error) setIsPlaying(true);
    }
  };

  const handleNext = async () => {
    const r = await api('post', '/api/player/next');
    if (!r.error) {
      const msgs = DOKO_MSGS_SKIP(myName);
      setDokoMsg(msgs[Math.floor(Math.random()*msgs.length)]);
    }
  };

  const handleLoadDevices = async () => {
    const r = await api('get', '/api/devices');
    setDevices(r.devices || []);
    setShowDevices(true);
  };

  const sendAlexa = () => {
    if(!alexaInput.trim()) return;
    const userMsg = {role:"user",text:alexaInput,ts:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};
    setAlexaConvo(c=>[...c,userMsg]);
    setAlexaInput(""); setAlexaTyping(true);
    const found = ALEXA_RESPONSES.find(r=>r.pat.test(alexaInput));
    const resp = found ? (typeof found.resp==="function" ? found.resp() : found.resp) :
      "🤔 Hmm, não tenho certeza sobre isso. Mas posso te ajudar com previsão do tempo, horários, músicas e comunicados!";
    setTimeout(()=>{
      setAlexaConvo(c=>[...c,{role:"alexa",text:resp,ts:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}]);
      setAlexaTyping(false);
    }, 1200);
  };

  const VETO    = 3;
  const cur     = currentSong || queue.find(s=>s.status==='playing') || queue[0];
  const curIdx  = queue.findIndex(s=>s.id===cur?.id);

  const EqBar = ({i}) => (
    <div style={{width:3,borderRadius:2,background:T.gold,
      animation:isPlaying?`alexaEq${(i%5)+1} ${0.5+i*0.07}s ease-in-out infinite alternate`:"none",
      height:isPlaying?undefined:4,minHeight:4,maxHeight:22}}/>
  );

  return (
    <div style={{minHeight:"100vh",background:"transparent",fontFamily:"var(--font-body)",position:"relative"}}>

      {/* ── Festival ambient background — Apple Music style ── */}
      {tab==="festival"&&festColors&&(
        <div style={{position:"fixed",inset:0,zIndex:1,pointerEvents:"none",opacity:blobsVisible?1:0,transition:"opacity 0.9s ease"}}>
          {/* Base color wash */}
          <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${festColors[0]}55,${festColors[1]}45,${festColors[2]}38,${festColors[3]}30)`,transition:"background 2s ease"}}/>
          {/* Blob 1 — top left */}
          <div style={{position:"absolute",width:"55vw",height:"55vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[0]}99 0%,transparent 65%)`,top:"-15vw",left:"-10vw",filter:"blur(90px)",animation:"festBlob1 14s ease-in-out infinite"}}/>
          {/* Blob 2 — top right */}
          <div style={{position:"absolute",width:"50vw",height:"50vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[1]}88 0%,transparent 65%)`,top:"-10vw",right:"-8vw",filter:"blur(85px)",animation:"festBlob2 17s ease-in-out infinite"}}/>
          {/* Blob 3 — bottom center */}
          <div style={{position:"absolute",width:"45vw",height:"45vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[2]}80 0%,transparent 62%)`,bottom:"-10vw",left:"22%",filter:"blur(80px)",animation:"festBlob3 12s ease-in-out infinite"}}/>
          {/* Blob 4 — bottom right */}
          <div style={{position:"absolute",width:"42vw",height:"42vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[3]}77 0%,transparent 65%)`,bottom:"5vw",right:"-5vw",filter:"blur(78px)",animation:"festBlob4 15s ease-in-out infinite"}}/>
          {/* Center glow */}
          <div style={{position:"absolute",width:"35vw",height:"35vw",borderRadius:"50%",background:`radial-gradient(circle,${festColors[4]}66 0%,transparent 65%)`,top:"35%",left:"32%",filter:"blur(70px)",animation:"festBlob2 20s ease-in-out infinite reverse"}}/>
        </div>
      )}      <style>{`
        @keyframes alexaEq1{0%{height:5px}100%{height:18px}}
        @keyframes alexaEq2{0%{height:14px}100%{height:6px}}
        @keyframes alexaEq3{0%{height:4px}100%{height:20px}}
        @keyframes alexaEq4{0%{height:18px}100%{height:8px}}
        @keyframes alexaEq5{0%{height:9px}100%{height:16px}}
        @keyframes voiceGlow{0%,100%{box-shadow:0 0 0 2px ${T.gold}44,0 0 12px ${T.gold}22}50%{box-shadow:0 0 0 3px ${T.gold}88,0 0 32px ${T.gold}44}}
        @keyframes voicePulse{0%,100%{border-color:${T.goldLine}55}50%{border-color:${T.gold}}}
        @keyframes dokoFloat{0%,100%{transform:translateY(0px)}50%{transform:translateY(-8px)}}
        @keyframes bubblePop{0%{opacity:0;transform:scale(0.7) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes alexaOrb{0%,100%{box-shadow:0 0 20px ${T.gold}44,0 0 40px ${T.gold}22}50%{box-shadow:0 0 40px ${T.gold}88,0 0 80px ${T.gold}33}}
        @keyframes hdrBlob1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(28px,-8px) scale(1.15)}66%{transform:translate(-12px,10px) scale(0.92)}}
        @keyframes hdrBlob2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-18px,14px) scale(1.08)}}
        @keyframes typingDot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
        @keyframes festBlob1{0%,100%{transform:translate(0,0) scale(1) rotate(0deg)}33%{transform:translate(60px,-40px) scale(1.2) rotate(120deg)}66%{transform:translate(-30px,50px) scale(0.85) rotate(240deg)}}
        @keyframes festBlob2{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-70px,30px) scale(1.15)}80%{transform:translate(40px,-20px) scale(0.9)}}
        @keyframes festBlob3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(50px,60px) scale(1.1)}}
        @keyframes festBlob4{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(-40px,-50px) scale(1.18)}70%{transform:translate(30px,20px) scale(0.88)}}
      `}</style>

      {/* Topbar */}
      <div style={{height:56,background:T.topbarBg||headerBg,backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 24px",gap:12,position:"sticky",top:0,zIndex:200,boxShadow:`0 1px 20px ${T.goldLine}22`}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:T.textS,fontSize:13,fontFamily:"var(--font-body)",padding:"4px 8px",borderRadius:7}}
          onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||"rgba(0,0,0,0.04)"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Módulos
        </button>
        <div style={{width:1,height:20,background:T.border}}/>
        <span style={{fontSize:16}}>🎵</span>
        <span style={{fontSize:14,fontWeight:700,color:T.text,fontFamily:"var(--font-brand)",letterSpacing:".04em"}}>Central Alexa</span>
        <Tag color={T.gold}>Novo</Tag>
        <div style={{flex:1}}/>
        {isPlaying&&cur&&(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 14px",borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
            <div style={{display:"flex",alignItems:"flex-end",gap:2,height:20}}>
              {[1,2,3,4,5].map(i=><EqBar key={i} i={i}/>)}
            </div>
            <span style={{fontSize:12,fontWeight:600,color:T.gold,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur.title} — {cur.artist}</span>
          </div>
        )}
        <Logo size={28}/>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"24px",position:"relative",zIndex:2}}>
        {/* Tabs */}
        <div style={{display:"flex",gap:6,marginBottom:20,padding:4,width:"fit-content",background:isDark?`${T.surface}cc`:(T.surfaceW||"rgba(255,255,255,0.70)"),backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${T.border}`,borderRadius:13,boxShadow:T.sh}}>
          {[["festival","🎵 Festival"],["alexa","🔵 Alexa"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              padding:"9px 22px",borderRadius:9,cursor:"pointer",outline:"none",
              fontFamily:"var(--font-body)",fontSize:13,fontWeight:tab===id?700:400,
              background:tab===id?T.goldGl:"transparent",color:tab===id?T.gold:T.textS,
              border:`1.5px solid ${tab===id?T.goldLine+"55":T.border}`,transition:"all .15s"
            }}>{label}</button>
          ))}
        </div>

        {/* ══════════ FESTIVAL TAB ══════════ */}
        {tab==="festival"&&(
          <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",gap:20,alignItems:"flex-start",position:"relative",zIndex:1}}>

            {/* Left: DokoWave + Player */}
            <div style={{width:280,flexShrink:0,display:"flex",flexDirection:"column",gap:16}}>
              {/* DokoWave mascot */}
              <div style={{borderRadius:20,overflow:"hidden",background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,padding:"16px",boxShadow:T.shM,position:"relative"}}>
                <div style={{position:"absolute",width:80,height:80,borderRadius:"50%",background:T.gold,filter:"blur(30px)",opacity:0.08,top:0,left:"20%"}}/>
                {/* Speech bubble */}
                <div key={dokoMsg} style={{marginBottom:12,padding:"10px 14px",borderRadius:"14px 14px 14px 4px",background:`linear-gradient(135deg,${T.goldGl},${T.gold}18)`,border:`1.5px solid ${T.goldLine}55`,fontSize:12,color:T.text,lineHeight:1.5,fontWeight:500,animation:"bubblePop .3s ease-out",position:"relative",zIndex:1}}>
                  {dokoMsg}
                  <div style={{position:"absolute",bottom:-8,left:16,width:0,height:0,borderLeft:"8px solid transparent",borderRight:"8px solid transparent",borderTop:`8px solid ${T.goldLine}55`}}/>
                </div>
                {/* DokoWave image */}
                <div style={{display:"flex",justifyContent:"center",animation:"dokoFloat 3s ease-in-out infinite",position:"relative",zIndex:1}}>
                  <div style={{
                    width:160,height:160,borderRadius:"50%",overflow:"hidden",
                    border:`3px solid ${festColors?.[0]||T.gold}BB`,
                    boxShadow:`0 0 0 7px ${festColors?.[0]||T.gold}44, 0 0 0 14px ${festColors?.[0]||T.gold}18, 0 0 28px 6px ${festColors?.[0]||T.gold}33`,
                    animation:"dokoTalk 2s ease-in-out infinite",
                    "--doko-color":festColors?.[0]||T.gold,
                    transition:"border-color 1.5s ease, box-shadow 1.5s ease",
                  }}>
                    <img src={DOKO_WAVE_IMG} alt="DokoWave DJ" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                  </div>
                </div>
                <div style={{textAlign:"center",fontSize:10,color:T.textD,marginTop:6,fontWeight:600,letterSpacing:".08em"}}>DOKOWAVE · DJ DA FIRMA</div>
              </div>

              {/* Player controls */}
              <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1px solid ${T.border}`,padding:"16px 20px",boxShadow:T.sh}}>
                {/* Spotify connect banner */}
                {!spotifyOk&&(
                  <div style={{marginBottom:12,padding:"10px 14px",borderRadius:10,background:`rgba(192,64,80,0.06)`,border:`1px solid rgba(192,64,80,0.2)`,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11}}>⚠️</span>
                    <span style={{fontSize:11,color:"#C04050",flex:1}}>Spotify desconectado</span>
                    <a href={`${SERVER_URL}/login`} target="_blank" rel="noreferrer"
                      style={{fontSize:11,fontWeight:700,color:"#1DB954",textDecoration:"none",padding:"3px 9px",borderRadius:6,background:"rgba(29,185,84,0.1)",border:"1px solid rgba(29,185,84,0.3)"}}>
                      Conectar ↗
                    </a>
                  </div>
                )}
                <div style={{fontSize:11,color:T.textD,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>▶ Tocando Agora</div>
                {cur
                  ? <>
                      {cur.album_art&&(
                        <div style={{width:"100%",aspectRatio:"1/1",borderRadius:12,overflow:"hidden",marginBottom:12,boxShadow:`0 8px 24px rgba(0,0,0,0.2)`}}>
                          <img src={cur.album_art} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                        </div>
                      )}
                      <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur.title}</div>
                      <div style={{fontSize:13,color:T.textS,marginBottom:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur.artist}</div>
                    </>
                  : <div style={{fontSize:13,color:T.textT,marginBottom:12,textAlign:"center",padding:"24px 0"}}>
                      <div style={{fontSize:32,marginBottom:8}}>🎵</div>
                      Nenhuma música tocando
                    </div>
                }
                {/* Controls */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:10}}>
                  <button onClick={handlePlayPause} disabled={!spotifyOk}
                    style={{width:46,height:46,borderRadius:12,border:"none",
                      background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
                      cursor:spotifyOk?"pointer":"not-allowed",color:"white",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      outline:"none",boxShadow:`0 4px 16px ${T.goldLine}55`,opacity:spotifyOk?1:0.5}}>
                    {isPlaying
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                  </button>
                  <button onClick={handleNext} disabled={!spotifyOk||queue.length<2}
                    style={{width:36,height:36,borderRadius:9,border:`1px solid ${T.border}`,background:"transparent",cursor:(spotifyOk&&queue.length>=2)?"pointer":"not-allowed",color:T.textS,display:"flex",alignItems:"center",justifyContent:"center",outline:"none",opacity:(spotifyOk&&queue.length>=2)?1:0.4}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                  </button>
                  <button onClick={handleLoadDevices} disabled={!spotifyOk} title="Selecionar dispositivo"
                    style={{width:36,height:36,borderRadius:9,border:`1px solid ${T.border}`,background:"transparent",cursor:spotifyOk?"pointer":"not-allowed",color:T.textS,display:"flex",alignItems:"center",justifyContent:"center",outline:"none",opacity:spotifyOk?1:0.4}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  </button>
                </div>
                {/* Device selector */}
                {showDevices&&(
                  <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:4}}>
                    <div style={{fontSize:10,fontWeight:600,color:T.textD,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Dispositivos</div>
                    {devices.length===0
                      ? <div style={{fontSize:11,color:T.textT}}>Nenhum dispositivo ativo no Spotify</div>
                      : devices.map(d=>(
                          <div key={d.id} onClick={()=>selectDevice(d.id)}
                            style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,cursor:"pointer",background:d.is_active?T.goldGl:"transparent",border:`1px solid ${d.is_active?T.goldLine+"44":T.border}`,marginBottom:4}}>
                            <span style={{fontSize:13}}>{d.type==='Speaker'?'🔊':d.type==='Computer'?'💻':'📱'}</span>
                            <span style={{fontSize:12,fontWeight:d.is_active?700:400,color:d.is_active?T.gold:T.text,flex:1}}>{d.name}</span>
                            {d.is_active&&<span style={{fontSize:9,color:T.gold,fontWeight:700}}>ATIVO</span>}
                          </div>
                        ))
                    }
                    <button onClick={()=>setShowDevices(false)} style={{width:"100%",marginTop:4,padding:"5px",borderRadius:7,border:`1px solid ${T.border}`,background:"transparent",cursor:"pointer",color:T.textD,fontSize:11,outline:"none"}}>Fechar</button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Search bar + Queue */}
            <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:16}}>

              {/* Server error message */}
              {serverMsg&&(
                <div style={{padding:"10px 14px",borderRadius:10,background:"rgba(192,64,80,0.07)",border:"1px solid rgba(192,64,80,0.25)",fontSize:12,color:"#C04050"}}>
                  ⚠️ {serverMsg}
                </div>
              )}

              {/* Search Bar */}
              <div style={{borderRadius:18,background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,padding:"20px 24px",boxShadow:T.shM,position:"relative",overflow:"visible",zIndex:10}}>
                <div style={{position:"absolute",width:100,height:100,borderRadius:"50%",background:T.gold,filter:"blur(35px)",opacity:0.07,top:"-20px",right:"10%",animation:"hdrBlob1 5s ease-in-out infinite"}}/>
                <div style={{fontSize:11,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:".10em",marginBottom:12,position:"relative",zIndex:1}}>🔍 Pesquisar música</div>
                <div style={{position:"relative",zIndex:2}}>
                  <div style={{
                    display:"flex",alignItems:"center",gap:12,
                    padding:"14px 18px",borderRadius:14,
                    border:`2px solid ${voiceFocus?T.gold:T.border}`,
                    background:isDark?T.surfaceSub||"rgba(255,255,255,0.04)":T.surface||"white",
                    boxShadow:voiceFocus?`0 0 0 4px ${T.goldLine}33,0 0 24px ${T.gold}22`:"0 2px 8px rgba(0,0,0,0.04)",
                    transition:"all .2s ease",
                  }}>
                    <div style={{width:32,height:32,borderRadius:9,flexShrink:0,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 3px 10px ${T.goldLine}44`}}>
                      {isSearching
                        ? <div style={{width:14,height:14,borderRadius:"50%",border:"2px solid white",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      }
                    </div>
                    <input
                      value={voiceVal}
                      onChange={e=>handleSearch(e.target.value)}
                      onFocus={()=>setVoiceFocus(true)}
                      onBlur={()=>setTimeout(()=>setVoiceFocus(false),200)}
                      placeholder="Shape of You, Waka Waka, Anti-Hero..."
                      style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:15,color:T.text,fontFamily:"var(--font-body)",caretColor:T.gold,fontWeight:voiceVal?500:400}}/>
                    {voiceVal&&(
                      <button onClick={()=>{setVoiceVal('');setSearchResults([]);}}
                        style={{padding:"4px 8px",borderRadius:6,border:"none",cursor:"pointer",color:T.textD,background:"transparent",fontSize:16,lineHeight:1,outline:"none"}}>×</button>
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {searchResults.length>0&&(
                    <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,borderRadius:14,background:isDark?T.surface:"white",border:`1px solid ${T.border}`,boxShadow:T.shL,overflow:"hidden",zIndex:50}}>
                      {searchResults.map(t=>(
                        <div key={t.id} onClick={()=>addToQueue(t)}
                          style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${T.divider}`,transition:"background .12s"}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          {t.album_art
                            ? <img src={t.album_art} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                            : <div style={{width:40,height:40,borderRadius:8,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎵</div>
                          }
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                            <div style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.artist}</div>
                          </div>
                          <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:10,color:T.textD}}>{t.duration_str}</span>
                            {isAdding===t.id
                              ? <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                              : <div style={{width:24,height:24,borderRadius:6,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                </div>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Name display — usa nome real do usuário logado */}
                <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8,position:"relative",zIndex:1}}>
                  <span style={{fontSize:11,color:T.textD}}>Pedindo como:</span>
                  <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:6,background:T.goldGl,border:`1px solid ${T.goldLine}33`}}>
                    <span style={{fontSize:11,fontWeight:600,color:T.gold}}>{myName}</span>
                  </div>
                </div>
              </div>

              {/* Queue */}
              <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:T.sh}}>
                <div style={{padding:"13px 20px",borderBottom:`1px solid ${T.border}`,background:`linear-gradient(135deg,${T.goldGl},transparent)`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontFamily:"var(--font-brand)",fontSize:14,fontWeight:700,color:T.text}}>Fila Democrática</div>
                  <span style={{fontSize:11,color:T.textT}}>{queue.length} músicas · {VETO} votos = skip automático</span>
                </div>
                {festLoading
                  ? <div style={{padding:"32px",textAlign:"center",color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${T.gold}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite",margin:"0 auto 8px"}}/>
                      Carregando fila...
                    </div>
                  : queue.length===0
                    ? <div style={{padding:"32px",textAlign:"center",color:T.textT,fontSize:13}}>Fila vazia! Pesquise uma música acima. 🎵</div>
                    : queue.map((s,i)=>{
                        const votes = skipVotes[s.id]||0;
                        const iAmPlaying = s.status==='playing';
                        const voted = myVotedSongs.has(s.id);
                        return (
                          <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderTop:i===0?"none":`1px solid ${T.border}`,background:iAmPlaying?T.goldGl:"transparent",transition:"background .15s"}}>
                            {/* Position / EQ */}
                            <div style={{width:22,textAlign:"center",flexShrink:0}}>
                              {iAmPlaying
                                ? <div style={{display:"flex",alignItems:"flex-end",gap:1,height:14,justifyContent:"center"}}>
                                    {[1,2,3].map(j=><div key={j} style={{width:2,borderRadius:1,background:T.gold,animation:`alexaEq${j} ${0.4+j*0.1}s ease-in-out infinite alternate`,minHeight:3}}/>)}
                                  </div>
                                : <span style={{fontSize:11,color:T.textD}}>{i+1}</span>
                              }
                            </div>
                            {/* Album art */}
                            {s.album_art
                              ? <img src={s.album_art} alt="" style={{width:36,height:36,borderRadius:7,objectFit:"cover",flexShrink:0}}/>
                              : <div style={{width:36,height:36,borderRadius:7,background:T.goldGl,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎵</div>
                            }
                            {/* Title + artist */}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:iAmPlaying?700:500,color:iAmPlaying?T.gold:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</div>
                              <div style={{fontSize:11,color:T.textT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.artist}</div>
                            </div>
                            {/* Requested by */}
                            <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                              <div style={{width:18,height:18,borderRadius:5,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}bb)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:"#fff"}}>
                                {(s.requested_by||'?')[0].toUpperCase()}
                              </div>
                              <span style={{fontSize:10,color:T.textT,maxWidth:48,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.requested_by}</span>
                            </div>
                            {/* Vote to skip */}
                            <button onClick={()=>handleVote(s)} disabled={voted}
                              style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:6,
                                border:`1.5px solid ${votes>0?"rgba(192,64,80,0.4)":T.border}`,
                                background:voted?"rgba(192,64,80,0.04)":votes>0?"rgba(192,64,80,0.06)":"transparent",
                                color:votes>0?"#C04050":T.textD,
                                cursor:voted?"default":"pointer",
                                fontSize:11,fontWeight:votes>0?700:400,outline:"none",transition:"all .15s",
                                opacity:voted?0.6:1}}>
                              👎 {votes}/{VETO}
                            </button>
                            <span style={{fontSize:10,color:T.textD,minWidth:28,textAlign:"right"}}>{s.duration_str||"—"}</span>
                          </div>
                        );
                      })
                }
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ══════════ ALEXA TAB ══════════ */}
        {tab==="alexa"&&(
          <div style={{display:"flex",gap:20,alignItems:"flex-start",maxWidth:900,margin:"0 auto"}}>
            {/* Chat interface */}
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:16}}>
              {/* Alexa orb header */}
              <div style={{borderRadius:20,background:cardBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.border}`,padding:"28px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:16,position:"relative",overflow:"hidden",boxShadow:T.shM}}>
                <div style={{position:"absolute",width:140,height:140,borderRadius:"50%",background:T.gold,filter:"blur(40px)",opacity:0.08,top:"-30px",left:"20%",animation:"hdrBlob1 5s ease-in-out infinite"}}/>
                <div style={{position:"absolute",width:100,height:100,borderRadius:"50%",background:T.goldL||T.gold,filter:"blur(30px)",opacity:0.06,bottom:"-10px",right:"15%",animation:"hdrBlob2 7s ease-in-out infinite"}}/>
                {/* Orb */}
                <div style={{width:80,height:80,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${T.goldL||T.gold}cc,${T.gold})`,animation:"alexaOrb 2.5s ease-in-out infinite",boxShadow:`0 0 30px ${T.gold}55`,position:"relative",zIndex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 12a4 4 0 008 0"/><line x1="8" y1="8" x2="8.01" y2="8" strokeWidth="2.5"/><line x1="16" y1="8" x2="16.01" y2="8" strokeWidth="2.5"/></svg>
                </div>
                <div style={{textAlign:"center",position:"relative",zIndex:1}}>
                  <div style={{fontFamily:"var(--font-brand)",fontSize:20,fontWeight:700,color:T.text,letterSpacing:".04em"}}>Alexa</div>
                  <div style={{fontSize:12,color:T.textS,marginTop:2}}>Pergunte sobre tempo, eventos, músicas, lembretes...</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:8,background:T.goldGl,border:`1px solid ${T.goldLine}44`,position:"relative",zIndex:1}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:"#1A9C70"}}/>
                  <span style={{fontSize:11,fontWeight:600,color:"#1A9C70"}}>Alexa Online</span>
                </div>
              </div>

              {/* Conversation */}
              <div style={{borderRadius:16,background:cardBg,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:T.sh}}>
                <div style={{maxHeight:360,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
                  {alexaConvo.map((m,i)=>(
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",justifyContent:m.role==="user"?"flex-end":"flex-start",animation:"bubblePop .25s ease-out"}}>
                      {m.role==="alexa"&&(
                        <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,background:`radial-gradient(circle at 35% 35%,${T.goldL||T.gold}cc,${T.gold})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 13a3.5 3.5 0 007 0"/></svg>
                        </div>
                      )}
                      <div style={{maxWidth:"70%"}}>
                        <div style={{
                          padding:"10px 14px",borderRadius:m.role==="alexa"?"4px 14px 14px 14px":"14px 4px 14px 14px",
                          background:m.role==="alexa"?T.goldGl:(T.surfaceSub||"rgba(0,0,0,0.05)"),
                          border:`1px solid ${m.role==="alexa"?T.goldLine+"44":T.border}`,
                          fontSize:13,color:T.text,lineHeight:1.5,
                        }}>
                          {m.text}
                        </div>
                        <div style={{fontSize:10,color:T.textD,marginTop:3,textAlign:m.role==="user"?"right":"left"}}>{m.ts}</div>
                      </div>
                      {m.role==="user"&&(
                        <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white"}}>
                          {myName[0]||"E"}
                        </div>
                      )}
                    </div>
                  ))}
                  {alexaTyping&&(
                    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,background:`radial-gradient(circle at 35% 35%,${T.goldL||T.gold}cc,${T.gold})`}}/>
                      <div style={{padding:"12px 16px",borderRadius:"4px 14px 14px 14px",background:T.goldGl,border:`1px solid ${T.goldLine}44`,display:"flex",gap:4,alignItems:"center"}}>
                        {[0,0.15,0.3].map((d,i)=>(
                          <div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.gold,animation:`typingDot 1.4s ${d}s ease-in-out infinite`}}/>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Input */}
                <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 16px",display:"flex",gap:10}}>
                  <input value={alexaInput} onChange={e=>setAlexaInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&sendAlexa()}
                    placeholder="Alexa, qual a previsão do tempo hoje?"
                    style={{flex:1,padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:10,fontFamily:"var(--font-body)",fontSize:13,color:T.text,background:T.surface,outline:"none",transition:"border-color .15s"}}
                    onFocus={e=>e.target.style.borderColor=T.gold}
                    onBlur={e=>e.target.style.borderColor=T.border}/>
                  <button onClick={sendAlexa} disabled={!alexaInput.trim()}
                    style={{padding:"10px 18px",borderRadius:10,border:"none",cursor:alexaInput.trim()?"pointer":"not-allowed",fontFamily:"var(--font-body)",fontSize:13,fontWeight:700,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:"white",opacity:alexaInput.trim()?1:0.5}}>
                    Perguntar
                  </button>
                </div>
              </div>

              {/* Quick actions */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["Previsão do tempo","Que horas são?","Lembrar de bater ponto","Contar uma piada","Próxima reunião"].map(q=>(
                  <button key={q} onClick={()=>{setAlexaInput(q);setTimeout(()=>{document.querySelector("input[placeholder*=previsão]")?.focus()},50);}}
                    style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:T.goldGl,color:T.gold,cursor:"pointer",fontSize:12,fontWeight:500,outline:"none"}}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
  const [screen, ss]       = useState('landing');
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Verifica token salvo ao carregar o app
  useEffect(() => {
    const token = localStorage.getItem('ch_token');
    if (!token) { setAuthChecked(true); return; }
    fetch(`${SERVER_URL}/api/auth/me`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) { setAuthUser(d.user); ss('modules'); }
        else localStorage.removeItem('ch_token');
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = (user) => { setAuthUser(user); ss('modules'); };

  const handleLogout = () => {
    localStorage.removeItem('ch_token');
    setAuthUser(null);
    ss('login');
  };

  const handleModuleSelect = (id) => {
    const adminOnly = ['dashboard','ponto'];
    if (adminOnly.includes(id) && authUser?.role !== 'admin') return;
    ss(id);
  };

  if (!authChecked) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:T.page||'#F0F6FC'}}>
      <div style={{width:32,height:32,borderRadius:'50%',border:`3px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <>
      <style>{FONTS}</style>
      <div style={{minHeight:'100vh',background:T.page,color:T.text,fontFamily:'var(--font-body)',position:'relative'}}>
        <LavaLamp/>
        <div style={{position:'relative',zIndex:1,minHeight:'100vh'}}>
          {screen==='landing'     && <LandingPage    onStart={()=>ss('login')}/>}
          {screen==='login'       && <LoginScreen    onLogin={handleLogin}/>}
          {screen==='modules'     && <ModuleSelector onSelect={handleModuleSelect} authUser={authUser} onLogout={handleLogout}/>}
          {screen==='colaborador' && <Portal         onBack={()=>ss('modules')}/>}
          {screen==='ponto'       && authUser?.role==='admin' && <PontoEletronico onBack={()=>ss('modules')} isAdmin={true}/>}
          {screen==='dashboard'   && authUser?.role==='admin' && <DashboardRH onBack={()=>ss('modules')} adminName={authUser.name}/>}
          {screen==='alexa'       && <CentralAlexa  onBack={()=>ss('modules')}/>}
        </div>
      </div>
    </>
  );
}
