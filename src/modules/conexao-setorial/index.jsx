import React, { useState, useRef, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';

// ─────────── Dados base ───────────

const USERS = {
  nicolas: { name: 'Nicolas Andrade', initials: 'NA', color: '#1A6FB5', sector: 'Admin',              online: true  },
  ana:     { name: 'Ana Clara',       initials: 'AC', color: '#9B59B6', sector: 'Admin',              online: true  },
  rafael:  { name: 'Rafael Santos',   initials: 'RS', color: '#27AE60', sector: 'Suporte Contratual', online: false },
  mariana: { name: 'Mariana Lopes',   initials: 'ML', color: '#E87C22', sector: 'Recursos Humanos',   online: true  },
  pedro:   { name: 'Pedro Oliveira',  initials: 'PO', color: '#C0392B', sector: 'TI',                 online: false },
};
const ME = 'nicolas';

const INIT_GROUP = [
  { id:1,  from:'ana',     type:'text',    text:'Bom dia, pessoal! 👋 Novo colaborador cadastrado: João Lima – Setor Financeiro. Acesso liberado no sistema.', time:'09:12' },
  { id:2,  from:'nicolas', type:'text',    text:'Ótimo, Ana! Vou alinhar com ele sobre os primeiros passos no sistema.', time:'09:15' },
  { id:3,  from:'rafael',  type:'text',    text:'Precisamos atualizar o manual de boas-vindas — a versão atual está desatualizada com os novos fluxos.', time:'09:42' },
  { id:4,  from:'mariana', type:'text',    text:'Concordo! Vou separar um tempo hoje à tarde para revisar. 📄', time:'09:44' },
  { id:5,  from:'nicolas', type:'command', text:'/solicitar_bloqueio Tabuleiro do Norte @rafael amanhã às 8 horas', time:'10:55',
    cmdData:{ municipio:'Tabuleiro do Norte', mentions:['rafael'], desbloqueio:'Amanhã às 08:00' } },
  { id:6,  type:'system',  text:'✅ Notificação enviada para @Rafael Santos (Suporte Contratual)  •  Adicionado a Atividades Pendentes', time:'10:55' },
  { id:7,  from:'rafael',  type:'text',    text:'Recebi a notificação! Confirmado, vou registrar e desbloquear amanhã às 8h. ✅', time:'11:02' },
  { id:8,  from:'pedro',   type:'file',    name:'Relatório_Backup_Jun.pdf', size:1242880, ext:'pdf', time:'14:08' },
  { id:9,  from:'pedro',   type:'text',    text:'Pessoal, o servidor de backup está com 90% de capacidade. Segue relatório em anexo. Vou ampliar o espaço ainda hoje.', time:'14:10' },
  { id:10, from:'ana',     type:'text',    text:'Obrigada pelo aviso, Pedro! Pode prosseguir. 👍', time:'14:12' },
  { id:11, from:'mariana', type:'image',   src:null, name:'manual_preview.png', caption:'Prévia do manual revisado', time:'16:27' },
  { id:12, from:'mariana', type:'text',    text:'Terminei de revisar o manual de boas-vindas — ficou muito mais completo! 🎉', time:'16:28' },
];

const INIT_DM_MSGS = {
  dm_rafael: [
    { id:1, from:'nicolas', type:'text', text:'Rafael, você recebeu a notificação do bloqueio de Tabuleiro do Norte?', time:'10:56' },
    { id:2, from:'rafael',  type:'text', text:'Sim, apareceu no desktop agora mesmo!', time:'10:58' },
    { id:3, from:'nicolas', type:'text', text:'Ótimo! O município solicitou até amanhã às 8h. Consegue garantir?', time:'10:59' },
    { id:4, from:'rafael',  type:'text', text:'Confirmado, vou desbloquear amanhã. ✅', time:'11:02' },
  ],
  dm_ana: [
    { id:1, from:'ana',     type:'text', text:'Nicolas, o João Lima já conseguiu logar no sistema?', time:'14:18' },
    { id:2, from:'nicolas', type:'text', text:'Sim! Acabei de confirmar com ele. Está acessando normalmente.', time:'14:20' },
    { id:3, from:'ana',     type:'text', text:'Perfeito, pode fechar o chamado então.', time:'14:21' },
    { id:4, from:'ana',     type:'text', text:'Obrigada pelo retorno rápido! 😊', time:'14:22' },
  ],
  dm_mariana: [
    { id:1, from:'mariana', type:'text', text:'Nicolas, terminei a revisão do manual. Pode conferir quando puder?', time:'16:28' },
    { id:2, from:'nicolas', type:'text', text:'Claro! Vou dar uma olhada.', time:'16:29' },
    { id:3, from:'mariana', type:'text', text:'Manual atualizado e revisado! ✅', time:'16:30' },
  ],
};

const DM_META = [
  { id:'dm_rafael', user:'rafael', lastMsg:'Confirmado, vou desbloquear amanhã. ✅', lastTime:'11:02', unread:0 },
  { id:'dm_ana',    user:'ana',    lastMsg:'Obrigada pelo retorno rápido! 😊',       lastTime:'14:22', unread:2 },
  { id:'dm_mariana',user:'mariana',lastMsg:'Manual atualizado e revisado! ✅',        lastTime:'16:30', unread:0 },
];

const INIT_ACTIVITIES = [
  { id:1, icon:'⏰', title:'Desbloquear manutenção de Tabuleiro do Norte',
    desc:'Solicitado por Nicolas Andrade via /solicitar_bloqueio',
    when:'Amanhã • 08:00', color:'#E67E22', sector:'Suporte Contratual', urgent:false },
  { id:2, icon:'📋', title:'Revisar manual de boas-vindas',
    desc:'Comprometida por Mariana Lopes no grupo',
    when:'Hoje', color:'#1A6FB5', sector:'RH', urgent:false },
  { id:3, icon:'🖥️', title:'Ampliar espaço do servidor backup',
    desc:'Pedro Oliveira — uso em 90%',
    when:'Hoje', color:'#C0392B', sector:'TI', urgent:true },
];

const COMMANDS = [
  { cmd:'/solicitar_bloqueio', desc:'Notifica setor e cria atividade pendente',  hint:'[município] @[usuário] [desbloqueio]' },
  { cmd:'/aviso',              desc:'Envia aviso urgente ao grupo',               hint:'[mensagem]' },
  { cmd:'/atribuir',           desc:'Atribui tarefa a um usuário',                hint:'@[usuário] [tarefa]' },
];

const EXT_ICONS = {
  pdf:  { bg:'#E74C3C', icon:'PDF' }, docx: { bg:'#2980B9', icon:'DOC' },
  doc:  { bg:'#2980B9', icon:'DOC' }, xlsx: { bg:'#27AE60', icon:'XLS' },
  xls:  { bg:'#27AE60', icon:'XLS' }, pptx: { bg:'#E67E22', icon:'PPT' },
  zip:  { bg:'#8E44AD', icon:'ZIP' }, mp3:  { bg:'#16A085', icon:'MP3' },
  mp4:  { bg:'#2C3E50', icon:'MP4' },
};

function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function formatDur(sec) {
  const m = Math.floor(sec/60), s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function nowTime() {
  return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Sao_Paulo'});
}
function parseBloqueioCMD(raw) {
  const mentionedIds = [];
  const mentionRe = /@(\S+)/g; let m;
  while ((m = mentionRe.exec(raw)) !== null) {
    const slug = m[1].toLowerCase().replace(/[,.:;!?]/g,'');
    for (const [id,u] of Object.entries(USERS)) {
      if (id.startsWith(slug)||u.name.toLowerCase().replace(/\s+/g,'').startsWith(slug)||
          u.sector.toLowerCase().replace(/\s+/g,'').includes(slug)) {
        if (!mentionedIds.includes(id)) mentionedIds.push(id); break;
      }
    }
  }
  let municipio = (raw.split(/@/)[0]||'')
    .replace(/^(eu\s+quero\s+bloquear\s+(manuten[cç][aã]o\s+(de\s+)?)?)/i,'')
    .replace(/,\s*$/,'').trim()||'Não especificado';
  const timeM = /(amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo)[^\n@]*(às?\s+\d{1,2}[h:]\d{0,2}|\d{1,2}\s*hora)/i.exec(raw);
  const hourM = /às?\s+(\d{1,2})[h:](\d{0,2})/i.exec(raw);
  let desbloqueio = 'A definir';
  if (timeM) { desbloqueio = timeM[0].trim(); desbloqueio = desbloqueio[0].toUpperCase()+desbloqueio.slice(1); }
  else if (hourM) desbloqueio = `Às ${hourM[1]}h${hourM[2]||'00'}`;
  return { municipio, mentions:mentionedIds, desbloqueio };
}

// ─── cores semânticas (calculadas de T em tempo de render) ───
const sbBg  = () => T.sidebarBg  || T.surface;
const sbBrd = () => T.dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
const sbSel = () => `${T.gold}18`;
const sentBg   = () => T.gold;
const recvBg   = () => T.dark ? `${T.text}14` : `${T.text}08`;
const recvBrd  = () => T.border;

// ─────────── Avatar ───────────
function Avatar({ userId, size=34 }) {
  const u = USERS[userId]; if (!u) return null;
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:u.color, flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center', userSelect:'none',
      fontSize:Math.round(size*0.36), fontWeight:700, color:'#fff', fontFamily:'var(--font-body)' }}>
      {u.initials}
    </div>
  );
}

// ─────────── iMessage bubble wrapper ───────────
function iBubble({ msg, mobile, children }) {
  const isMe = msg.from === ME;
  const u = USERS[msg.from];
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:7,
      flexDirection: isMe ? 'row-reverse' : 'row',
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      maxWidth: mobile ? '82%' : '70%', marginBottom:8 }}>
      {!isMe && <Avatar userId={msg.from} size={mobile ? 32 : 28}/>}
      <div style={{ display:'flex', flexDirection:'column', gap:2,
        alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        {!isMe && (
          <div style={{ fontSize:11, fontWeight:600, color:u?.color||T.gold,
            paddingLeft:2, fontFamily:'var(--font-body)' }}>
            {u?.name}
            <span style={{ fontSize:10, fontWeight:400, color:T.textS, marginLeft:5 }}>{u?.sector}</span>
          </div>
        )}
        {children}
        <div style={{ fontSize:10, color:T.textT, paddingRight: isMe ? 2 : 0, paddingLeft: isMe ? 0 : 2,
          fontFamily:'var(--font-body)' }}>
          {msg.time}{isMe ? ' ✓✓' : ''}
        </div>
      </div>
    </div>
  );
}

// ─────────── Text bubble — iMessage style ───────────
function TextBubble({ msg, mobile }) {
  const isMe = msg.from === ME;
  return (
    <iBubble msg={msg} mobile={mobile}>
      <div style={{
        background: isMe ? sentBg() : recvBg(),
        color: isMe ? '#fff' : T.text,
        border: isMe ? 'none' : `1px solid ${recvBrd()}`,
        borderRadius: isMe ? '18px 18px 5px 18px' : '5px 18px 18px 18px',
        padding: mobile ? '10px 14px' : '9px 13px',
        fontSize: mobile ? 15 : 14, lineHeight:1.5,
        fontFamily:'var(--font-body)', wordBreak:'break-word',
        boxShadow: isMe ? `0 2px 8px ${sentBg()}44` : `0 1px 2px rgba(0,0,0,0.04)`,
      }}>
        {msg.text}
      </div>
    </iBubble>
  );
}

// ─────────── Image bubble ───────────
function ImageBubble({ msg, mobile }) {
  const isMe = msg.from === ME;
  const maxW = mobile ? 240 : 220;
  return (
    <iBubble msg={msg} mobile={mobile}>
      <div style={{ borderRadius: isMe ? '18px 18px 5px 18px' : '5px 18px 18px 18px',
        overflow:'hidden', border:`1px solid ${recvBrd()}`, maxWidth:maxW,
        boxShadow:`0 1px 4px rgba(0,0,0,0.10)` }}>
        {msg.src
          ? <img src={msg.src} alt={msg.name||'imagem'} style={{ width:'100%', display:'block', maxHeight:220, objectFit:'cover' }}/>
          : <div style={{ width:maxW, height:150, background: isMe ? sentBg() : recvBg(),
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span style={{ fontSize:34 }}>🖼️</span>
              <span style={{ fontSize:12, color: isMe ? 'rgba(255,255,255,0.7)' : T.textS, fontFamily:'var(--font-body)' }}>
                {msg.name||'Imagem'}
              </span>
            </div>
        }
        {msg.caption && (
          <div style={{ padding:'6px 12px', background: isMe ? `${sentBg()}cc` : T.surface,
            fontSize:12, color: isMe ? 'rgba(255,255,255,0.85)' : T.textS, fontFamily:'var(--font-body)' }}>
            {msg.caption}
          </div>
        )}
      </div>
    </iBubble>
  );
}

// ─────────── File bubble ───────────
function FileBubble({ msg, mobile }) {
  const isMe = msg.from === ME;
  const extInfo = EXT_ICONS[msg.ext?.toLowerCase()]||{ bg:'#636E72', icon:(msg.ext||'FILE').toUpperCase().slice(0,3) };
  return (
    <iBubble msg={msg} mobile={mobile}>
      <div style={{
        background: isMe ? sentBg() : T.surface,
        border: isMe ? 'none' : `1px solid ${recvBrd()}`,
        borderRadius: isMe ? '18px 18px 5px 18px' : '5px 18px 18px 18px',
        padding:'11px 14px', display:'flex', alignItems:'center', gap:12,
        minWidth: mobile ? 195 : 185, maxWidth: mobile ? 260 : 240,
        boxShadow: isMe ? `0 2px 8px ${sentBg()}44` : `0 1px 2px rgba(0,0,0,0.04)`,
        cursor:'pointer',
      }}>
        <div style={{ width:44, height:44, borderRadius:12, background:extInfo.bg, flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:10, fontWeight:800, color:'#fff', letterSpacing:'.05em', fontFamily:'monospace' }}>
          {extInfo.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color: isMe ? '#fff' : T.text,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:'var(--font-body)' }}>
            {msg.name}
          </div>
          <div style={{ fontSize:11, color: isMe ? 'rgba(255,255,255,0.6)' : T.textS, marginTop:2, fontFamily:'var(--font-body)' }}>
            {formatSize(msg.size||0)} · {(msg.ext||'arquivo').toUpperCase()}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={isMe ? 'rgba(255,255,255,0.7)' : T.textS} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
    </iBubble>
  );
}

// ─────────── Audio bubble ───────────
function AudioBubble({ msg, mobile }) {
  const isMe = msg.from === ME;
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const toggle = () => { const a=audioRef.current; if(!a) return; if(playing){a.pause();setPlaying(false);}else{a.play();setPlaying(true);} };
  const onTU = () => { const a=audioRef.current; if(!a||!a.duration) return; setCurrentTime(Math.floor(a.currentTime)); setProgress(a.currentTime/a.duration); };
  const onEnd = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
  const onBar = (e) => { const a=audioRef.current; if(!a||!a.duration) return; const r=e.currentTarget.getBoundingClientRect(); const ratio=(e.clientX-r.left)/r.width; a.currentTime=ratio*a.duration; setProgress(ratio); };
  const accent = isMe ? '#fff' : T.gold;
  const trackBg = isMe ? 'rgba(255,255,255,0.3)' : T.border;
  return (
    <iBubble msg={msg} mobile={mobile}>
      <div style={{
        background: isMe ? sentBg() : T.surface,
        border: isMe ? 'none' : `1px solid ${recvBrd()}`,
        borderRadius: isMe ? '18px 18px 5px 18px' : '5px 18px 18px 18px',
        padding:'11px 14px', display:'flex', alignItems:'center', gap:11,
        minWidth: mobile ? 210 : 190, maxWidth: mobile ? 270 : 250,
        boxShadow: isMe ? `0 2px 8px ${sentBg()}44` : `0 1px 2px rgba(0,0,0,0.04)`,
      }}>
        {msg.src && <audio ref={audioRef} src={msg.src} onTimeUpdate={onTU} onEnded={onEnd}/>}
        <button onClick={toggle} style={{ width:40, height:40, borderRadius:'50%', flexShrink:0,
          background: isMe ? 'rgba(255,255,255,0.22)' : `${T.gold}18`,
          border:`1.5px solid ${isMe ? 'rgba(255,255,255,0.5)' : T.gold}`,
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          WebkitTapHighlightColor:'transparent' }}>
          {playing
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill={accent}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill={accent}><polygon points="5 3 19 12 5 21 5 3"/></svg>}
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:2, height:26, marginBottom:6 }}>
            {Array.from({length:24}).map((_,i) => {
              const h = [4,7,12,8,15,6,18,10,14,5,9,16,11,7,13,8,17,6,12,9,15,7,11,5][i];
              return <div key={i} style={{ flex:1, height:`${h}px`, borderRadius:2,
                background: i/24<=progress ? accent : trackBg, transition:'background .1s' }}/>;
            })}
          </div>
          <div onClick={onBar} style={{ height:3, background:trackBg, borderRadius:2, cursor:'pointer', position:'relative' }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', background:accent,
              borderRadius:2, width:`${progress*100}%`, transition:'width .1s' }}/>
          </div>
          <div style={{ marginTop:4, fontSize:10, color: isMe ? 'rgba(255,255,255,0.65)' : T.textS,
            fontFamily:'var(--font-body)', display:'flex', justifyContent:'space-between' }}>
            <span>{formatDur(currentTime)}</span>
            <span>{msg.duration ? formatDur(msg.duration) : '🎙️'}</span>
          </div>
        </div>
      </div>
    </iBubble>
  );
}

// ─────────── Command bubble ───────────
function CommandBubble({ msg, mobile }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:7, flexDirection:'row-reverse',
      alignSelf:'flex-end', maxWidth: mobile ? '90%' : '76%', marginBottom:8 }}>
      <Avatar userId={ME} size={mobile ? 32 : 28}/>
      <div>
        <div style={{
          background: T.dark ? '#0D1628' : '#1A2B4A',
          border:`1px solid ${T.gold}44`,
          borderRadius:'18px 18px 5px 18px',
          padding:'12px 15px', minWidth: mobile ? 200 : 218,
          boxShadow:`0 4px 16px ${T.gold}22`, fontFamily:'var(--font-body)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:11 }}>
            <div style={{ background:'linear-gradient(135deg,#B04800,#E67E22)', borderRadius:6, padding:'2px 8px',
              fontSize:9, fontWeight:800, color:'#fff', letterSpacing:'.06em', flexShrink:0 }}>⚡ COMANDO</div>
            <code style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>/solicitar_bloqueio</code>
          </div>
          {[
            { icon:'📍', label:'Município',   val:msg.cmdData.municipio,                                          color:'#fff'    },
            { icon:'👥', label:'Notificar',   val:msg.cmdData.mentions.map(u=>'@'+USERS[u]?.name).join(', ')||'—',color:'#5DCC80' },
            { icon:'⏰', label:'Desbloqueio', val:msg.cmdData.desbloqueio,                                        color:'#E67E22' },
          ].map(r => (
            <div key={r.label} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
              <span style={{ fontSize:15, flexShrink:0 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.28)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:1 }}>{r.label}</div>
                <div style={{ fontSize:13, fontWeight:700, color:r.color }}>{r.val}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:10, borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:8,
            display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#27AE60', flexShrink:0 }}/>
            <span style={{ fontSize:10, color:'#5DCC80', fontWeight:600 }}>Notificação enviada · Atividade registrada</span>
          </div>
        </div>
        <div style={{ fontSize:10, color:T.textT, marginTop:2, textAlign:'right', paddingRight:2, fontFamily:'var(--font-body)' }}>
          {msg.time} ✓✓
        </div>
      </div>
    </div>
  );
}

function SystemMsg({ msg }) {
  return (
    <div style={{ textAlign:'center', margin:'6px 0 10px', fontFamily:'var(--font-body)' }}>
      <span style={{ fontSize:11, color:T.textS, background:T.surface,
        padding:'3px 14px', borderRadius:20, border:`1px solid ${T.border}` }}>
        {msg.text}
      </span>
    </div>
  );
}

// ─────────── Lista de mensagens ───────────
function MsgList({ msgs, mobile }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);
  return (
    <div style={{ flex:1, overflowY:'auto', padding: mobile ? '14px 12px' : '18px 22px',
      display:'flex', flexDirection:'column', WebkitOverflowScrolling:'touch', background:T.page }}>
      <div style={{ textAlign:'center', margin:'0 0 14px', fontFamily:'var(--font-body)' }}>
        <span style={{ fontSize:11, color:T.textT, background:T.surface,
          padding:'3px 14px', borderRadius:20, border:`1px solid ${T.border}` }}>Hoje</span>
      </div>
      {msgs.map(msg => {
        if (msg.type==='system')  return <SystemMsg     key={msg.id} msg={msg}/>;
        if (msg.type==='command') return <CommandBubble key={msg.id} msg={msg} mobile={mobile}/>;
        if (msg.type==='image')   return <ImageBubble   key={msg.id} msg={msg} mobile={mobile}/>;
        if (msg.type==='file')    return <FileBubble    key={msg.id} msg={msg} mobile={mobile}/>;
        if (msg.type==='audio')   return <AudioBubble   key={msg.id} msg={msg} mobile={mobile}/>;
        return <TextBubble key={msg.id} msg={msg} mobile={mobile}/>;
      })}
      <div ref={endRef}/>
    </div>
  );
}

// ─────────── Input bar ───────────
function InputBar({ onSend, mobile }) {
  const [input, setInput]           = useState('');
  const [cmdMenu, setCmdMenu]       = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [recording, setRecording]   = useState(false);
  const [recTime, setRecTime]       = useState(0);
  const inputRef      = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef  = useRef(null);
  const audioFileRef  = useRef(null);
  const mrRef    = useRef(null);
  const timerRef = useRef(null);

  const handleInput = (e) => { const v=e.target.value; setInput(v); setCmdMenu(v==='/'||(v.startsWith('/')&&!v.includes(' '))); };
  const handleKeyDown = (e) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}; if(e.key==='Escape'){setCmdMenu(false);setAttachOpen(false);} };
  const doSend = () => { const t=input.trim(); if(!t) return; onSend({type:'text',text:t}); setInput(''); setCmdMenu(false); setAttachOpen(false); inputRef.current?.focus(); };
  const pickCmd = (cmd) => { setInput(cmd+' '); setCmdMenu(false); inputRef.current?.focus(); };

  const handleImageSelect = (e) => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=(ev)=>onSend({type:'image',src:ev.target.result,name:f.name,size:f.size}); r.readAsDataURL(f); e.target.value=''; setAttachOpen(false); };
  const handleFileSelect  = (e) => { const f=e.target.files?.[0]; if(!f) return; onSend({type:'file',name:f.name,size:f.size,ext:f.name.split('.').pop()?.toLowerCase()||''}); e.target.value=''; setAttachOpen(false); };
  const handleAudioFileSelect = (e) => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=(ev)=>onSend({type:'audio',src:ev.target.result,name:f.name,size:f.size,ext:f.name.split('.').pop()}); r.readAsDataURL(f); e.target.value=''; setAttachOpen(false); };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const chunks = []; const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if(e.data.size) chunks.push(e.data); };
      mr.onstop = () => { onSend({type:'audio',src:URL.createObjectURL(new Blob(chunks,{type:'audio/webm'})),duration:recTime}); stream.getTracks().forEach(t=>t.stop()); };
      mr.start(); mrRef.current=mr; setRecording(true); setRecTime(0);
      timerRef.current = setInterval(()=>setRecTime(t=>t+1),1000); setAttachOpen(false);
    } catch { alert('Permissão de microfone negada.'); }
  };
  const stopRecording   = () => { mrRef.current?.stop(); clearInterval(timerRef.current); setRecording(false); };
  const cancelRecording = () => { if(mrRef.current){mrRef.current.ondataavailable=null;mrRef.current.onstop=null;mrRef.current.stop();mrRef.current.stream?.getTracks().forEach(t=>t.stop());} clearInterval(timerRef.current); setRecording(false); setRecTime(0); };

  const filteredCmds = COMMANDS.filter(c => c.cmd.includes(input.replace('/','').split(' ')[0]||''));
  const hasText = input.trim().length > 0;

  const btnStyle = (active) => ({
    width: mobile ? 44 : 38, height: mobile ? 44 : 38, borderRadius:'50%', flexShrink:0,
    background: active ? `${T.gold}18` : 'transparent',
    border:`1.5px solid ${active ? T.gold : T.border}`,
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    color: active ? T.gold : T.textS, transition:'all .15s',
    WebkitTapHighlightColor:'transparent',
  });

  const safeBottom = mobile ? 'max(12px, env(safe-area-inset-bottom))' : '12px';

  return (
    <div style={{ flexShrink:0, background:T.surface, borderTop:`1px solid ${T.border}`,
      paddingTop:10, paddingLeft:12, paddingRight:12, paddingBottom:safeBottom }}>

      <input ref={imageInputRef} type="file" accept="image/*"                          style={{display:'none'}} onChange={handleImageSelect}/>
      <input ref={fileInputRef}  type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.zip,.txt" style={{display:'none'}} onChange={handleFileSelect}/>
      <input ref={audioFileRef}  type="file" accept="audio/*"                          style={{display:'none'}} onChange={handleAudioFileSelect}/>

      {recording ? (
        /* Recording UI */
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 2px' }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#E74C3C', flexShrink:0,
            animation:'recPulse 1s ease-in-out infinite' }}/>
          <span style={{ fontSize:14, fontWeight:700, color:'#E74C3C', fontFamily:'var(--font-body)' }}>Gravando</span>
          <span style={{ fontSize:14, fontWeight:600, color:T.text, fontFamily:'monospace', minWidth:40 }}>{formatDur(recTime)}</span>
          <div style={{ flex:1 }}/>
          <button onClick={cancelRecording} style={{ ...btnStyle(false), borderRadius:22, padding:'0 16px', width:'auto', height:38, fontSize:13, color:T.textS }}>
            Cancelar
          </button>
          <button onClick={stopRecording} style={{ height:38, padding:'0 18px', borderRadius:22, border:'none',
            background:T.gold, cursor:'pointer', fontSize:13, fontWeight:700, color:'#fff',
            fontFamily:'var(--font-body)', WebkitTapHighlightColor:'transparent' }}>
            ⏹ Enviar
          </button>
        </div>
      ) : (
        <div style={{ position:'relative' }}>

          {/* Attach — bottom sheet mobile / popup desktop */}
          {attachOpen && (
            mobile ? (
              <div style={{ position:'fixed', inset:0, zIndex:100 }} onClick={()=>setAttachOpen(false)}>
                <div onClick={e=>e.stopPropagation()} style={{
                  position:'absolute', bottom:0, left:0, right:0,
                  background:T.surface, borderRadius:'22px 22px 0 0',
                  paddingBottom:'max(24px, env(safe-area-inset-bottom))',
                  boxShadow:`0 -8px 40px rgba(0,0,0,${T.dark?'0.4':'0.12'})`,
                  border:`1px solid ${T.border}` }}>
                  <div style={{ width:40, height:4, borderRadius:2, background:T.border, margin:'12px auto 14px' }}/>
                  <div style={{ padding:'0 8px 8px' }}>
                    {[
                      {emoji:'📷', label:'Foto / Imagem',       action:()=>imageInputRef.current?.click()},
                      {emoji:'📎', label:'Arquivo / Documento', action:()=>fileInputRef.current?.click()},
                      {emoji:'🎵', label:'Arquivo de Áudio',    action:()=>audioFileRef.current?.click()},
                      {emoji:'🎙️', label:'Gravar Áudio',        action:startRecording},
                    ].map((item,i)=>(
                      <div key={i} onClick={()=>{item.action();setAttachOpen(false);}}
                        style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 16px',
                          borderRadius:14, cursor:'pointer', WebkitTapHighlightColor:'transparent',
                          borderBottom:i<3?`1px solid ${T.border}`:'none' }}>
                        <div style={{ width:48, height:48, borderRadius:14, background:T.page,
                          border:`1px solid ${T.border}`,
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
                          {item.emoji}
                        </div>
                        <span style={{ fontSize:16, color:T.text, fontFamily:'var(--font-body)', fontWeight:500 }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0,
                background:T.surface, border:`1px solid ${T.border}`, borderRadius:14,
                overflow:'hidden', boxShadow:`0 -8px 28px rgba(0,0,0,${T.dark?'0.3':'0.1'})`, zIndex:10, minWidth:210 }}>
                {[
                  {label:'📷  Foto / Imagem',       action:()=>imageInputRef.current?.click()},
                  {label:'📎  Arquivo / Documento', action:()=>fileInputRef.current?.click()},
                  {label:'🎵  Arquivo de Áudio',    action:()=>audioFileRef.current?.click()},
                  {label:'🎙️  Gravar Áudio',        action:startRecording},
                ].map((item,i)=>(
                  <div key={i} onClick={()=>{item.action();setAttachOpen(false);}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.page}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    style={{ padding:'11px 16px', cursor:'pointer', fontSize:13, color:T.text,
                      fontFamily:'var(--font-body)', borderBottom:i<3?`1px solid ${T.border}`:'none',
                      display:'flex', alignItems:'center', gap:9, transition:'background .12s' }}>
                    {item.label}
                  </div>
                ))}
              </div>
            )
          )}

          {/* Command menu */}
          {cmdMenu && filteredCmds.length > 0 && (
            <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left: mobile ? 0 : 44, right: mobile ? 0 : 48,
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:12,
              overflow:'hidden', boxShadow:`0 -8px 28px rgba(0,0,0,${T.dark?'0.35':'0.1'})`, zIndex:10 }}>
              <div style={{ padding:'6px 14px 4px', fontSize:9, fontWeight:700, color:T.textT,
                textTransform:'uppercase', letterSpacing:'.1em', fontFamily:'var(--font-body)' }}>Comandos</div>
              {filteredCmds.map(c => (
                <div key={c.cmd} onClick={()=>pickCmd(c.cmd)}
                  style={{ padding:'10px 14px', cursor:'pointer', display:'flex', gap:10, alignItems:'center',
                    borderTop:`1px solid ${T.border}`, WebkitTapHighlightColor:'transparent' }}>
                  <code style={{ fontSize:12, color:T.gold, fontFamily:'monospace', fontWeight:700, flexShrink:0 }}>{c.cmd}</code>
                  <span style={{ fontSize:11, color:T.textS, fontFamily:'var(--font-body)' }}>{c.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Row */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {/* Attach */}
            <button onClick={()=>{setAttachOpen(o=>!o);setCmdMenu(false);}} style={btnStyle(attachOpen)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            {/* Input */}
            <input ref={inputRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
              placeholder={mobile ? 'iMessage...' : 'Mensagem ou / para comandos...'}
              style={{ flex:1, background:T.page, borderRadius:24,
                border:`1.5px solid ${input.startsWith('/solicitar_bloqueio') ? T.gold+'AA' : T.border}`,
                padding: mobile ? '11px 16px' : '9px 15px',
                fontSize: mobile ? 16 : 14, color:T.text, fontFamily:'var(--font-body)',
                outline:'none', transition:'border-color .15s', boxSizing:'border-box' }}
            />

            {/* Mic ou Send */}
            {!hasText ? (
              <button onClick={startRecording} style={btnStyle(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            ) : (
              <button onClick={doSend} style={{ ...btnStyle(true), background:T.gold, borderColor:'transparent', color:'#fff' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            )}
          </div>

          {/* Hint */}
          {!mobile && input.startsWith('/solicitar_bloqueio ') && (
            <div style={{ marginTop:5, fontSize:11, color:T.gold, fontFamily:'var(--font-body)', paddingLeft:2 }}>
              ⚡ <code style={{fontFamily:'monospace'}}>/solicitar_bloqueio [município] @[usuário] desbloquear [quando]</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────── Sidebar (desktop) — theme-aware ───────────
function Sidebar({ selected, onSelect, dmMeta }) {
  const bg  = sbBg();
  const brd = sbBrd();
  const selBg = sbSel();
  const row = (id) => ({
    display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10,
    background: selected===id ? selBg : 'transparent',
    cursor:'pointer', transition:'background .15s', marginBottom:2,
    WebkitTapHighlightColor:'transparent',
  });
  return (
    <div style={{ width:272, flexShrink:0, background:bg,
      borderRight:`1px solid ${brd}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'14px 16px 10px', borderBottom:`1px solid ${brd}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:11, background:`${T.gold}18`,
            border:`1px solid ${T.gold}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:17 }}>💬</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:'var(--font-body)', lineHeight:1.2 }}>Conexão Setorial</div>
            <div style={{ fontSize:9, color:T.textT, fontFamily:'var(--font-body)', marginTop:2 }}>Comunicação Interna · Admin</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding:'8px 12px', flexShrink:0 }}>
        <div style={{ background:T.page, borderRadius:10, padding:'7px 11px',
          display:'flex', alignItems:'center', gap:7, border:`1px solid ${T.border}` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize:12, color:T.textT, fontFamily:'var(--font-body)' }}>Pesquisar...</span>
        </div>
      </div>

      {/* Grupos */}
      <div style={{ padding:'0 12px 6px', flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:700, color:T.textT, letterSpacing:'.12em',
          textTransform:'uppercase', marginBottom:5, fontFamily:'var(--font-body)' }}>Grupos</div>
        <div onClick={()=>onSelect('group')} style={row('group')}>
          <div style={{ width:38, height:38, borderRadius:11, background:`${T.gold}15`,
            border:`1px solid ${T.gold}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:T.text, fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>7 SERV - Comunicação Interna</div>
            <div style={{ fontSize:11, color:T.textS, fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>
              Mariana: Manual atualizado! 🎉
            </div>
          </div>
        </div>
      </div>

      <div style={{ height:1, background:brd, margin:'0 12px 6px' }}/>

      {/* DMs */}
      <div style={{ padding:'0 12px', flex:1, overflowY:'auto', minHeight:0 }}>
        <div style={{ fontSize:9, fontWeight:700, color:T.textT, letterSpacing:'.12em',
          textTransform:'uppercase', marginBottom:5, fontFamily:'var(--font-body)' }}>Mensagens Diretas</div>
        {dmMeta.map(conv => (
          <div key={conv.id} onClick={()=>onSelect(conv.id)} style={row(conv.id)}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <Avatar userId={conv.user} size={36}/>
              <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%',
                background:USERS[conv.user].online?'#27AE60':'#A0A0A8', border:`2px solid ${bg}` }}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:600, color:T.text, fontFamily:'var(--font-body)' }}>
                  {USERS[conv.user].name}
                </span>
                <span style={{ fontSize:10, color:T.textT, fontFamily:'var(--font-body)', flexShrink:0, marginLeft:4 }}>
                  {conv.lastTime}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:1 }}>
                <span style={{ fontSize:11, color:T.textS, fontFamily:'var(--font-body)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                  {conv.lastMsg}
                </span>
                {conv.unread > 0 && (
                  <div style={{ background:T.gold, color:'#fff', fontSize:9, fontWeight:700,
                    minWidth:18, height:18, borderRadius:9, padding:'0 4px', display:'flex', alignItems:'center',
                    justifyContent:'center', flexShrink:0, marginLeft:6, fontFamily:'var(--font-body)' }}>
                    {conv.unread}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Online agora */}
      <div style={{ padding:'10px 14px 12px', borderTop:`1px solid ${brd}`, flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:700, color:T.textT, letterSpacing:'.12em',
          textTransform:'uppercase', marginBottom:8, fontFamily:'var(--font-body)' }}>Online agora</div>
        <div style={{ display:'flex', gap:6 }}>
          {Object.entries(USERS).filter(([,u])=>u.online).map(([id])=>(
            <div key={id} style={{ position:'relative' }}>
              <Avatar userId={id} size={28}/>
              <div style={{ position:'absolute', bottom:0, right:0, width:8, height:8, borderRadius:'50%',
                background:'#27AE60', border:`2px solid ${bg}` }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── Activities panel ───────────
function ActivitiesPanel({ activities, mobile }) {
  const body = (
    <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10,
      minHeight:0, WebkitOverflowScrolling:'touch' }}>
      {activities.map(act => (
        <div key={act.id} style={{ background:T.surface, borderRadius:12,
          border:`1px solid ${act.urgent ? act.color+'44' : T.border}`,
          padding:'12px 14px', position:'relative', overflow:'hidden', flexShrink:0,
          boxShadow:`0 1px 4px rgba(0,0,0,${T.dark?'0.12':'0.04'})` }}>
          <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3,
            background:act.color, borderRadius:'12px 0 0 12px' }}/>
          <div style={{ paddingLeft:9 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
              <span style={{ fontSize:17, flexShrink:0 }}>{act.icon}</span>
              <div style={{ fontSize:12, fontWeight:700, color:T.text, lineHeight:1.3, fontFamily:'var(--font-body)' }}>{act.title}</div>
            </div>
            <div style={{ fontSize:11, color:T.textS, lineHeight:1.4, marginBottom:8, fontFamily:'var(--font-body)' }}>{act.desc}</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:10, fontWeight:700, color:act.color,
                background:`${act.color}18`, padding:'2px 8px', borderRadius:6, fontFamily:'var(--font-body)' }}>{act.when}</span>
              <span style={{ fontSize:10, color:T.textT, fontFamily:'var(--font-body)' }}>{act.sector}</span>
            </div>
            {act.urgent && (
              <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:act.color }}/>
                <span style={{ fontSize:10, color:act.color, fontWeight:700, fontFamily:'var(--font-body)' }}>Urgente</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (mobile) {
    return (
      <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
        <div style={{ padding:'12px 16px 10px', borderBottom:`1px solid ${T.border}`,
          display:'flex', alignItems:'center', gap:10, flexShrink:0, background:T.surface }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:'var(--font-body)', flex:1 }}>Atividades Pendentes</span>
          <div style={{ background:`${T.gold}18`, color:T.gold, fontSize:11, fontWeight:700,
            width:22, height:22, borderRadius:11, display:'flex', alignItems:'center',
            justifyContent:'center', fontFamily:'var(--font-body)' }}>{activities.length}</div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div style={{ width:262, flexShrink:0, background:T.surface,
      borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 16px 10px', borderBottom:`1px solid ${T.border}`,
        display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:'var(--font-body)', flex:1 }}>Atividades Pendentes</span>
        <div style={{ background:`${T.gold}18`, color:T.gold, fontSize:10, fontWeight:700,
          minWidth:20, height:20, borderRadius:10, padding:'0 5px', display:'flex', alignItems:'center',
          justifyContent:'center', fontFamily:'var(--font-body)' }}>{activities.length}</div>
      </div>
      {body}
      <div style={{ padding:'10px 14px', borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:700, color:T.textT, textTransform:'uppercase',
          letterSpacing:'.08em', marginBottom:6, fontFamily:'var(--font-body)' }}>Comandos</div>
        {COMMANDS.map(c => (
          <div key={c.cmd} style={{ marginBottom:5, display:'flex', alignItems:'baseline', gap:6 }}>
            <code style={{ fontSize:10, color:T.gold, fontFamily:'monospace', background:`${T.gold}12`,
              padding:'1px 5px', borderRadius:4, flexShrink:0 }}>{c.cmd}</code>
            <span style={{ fontSize:9, color:T.textT, fontFamily:'var(--font-body)' }}>{c.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── Toast ───────────
function NotifToast({ data, onDismiss, mobile }) {
  const mentionNames = data.mentions.map(u=>USERS[u]?.name||u).join(', ');
  return (
    <div style={{ position:'fixed', top:mobile?'auto':20, bottom:mobile?76:'auto',
      right:mobile?12:20, left:mobile?12:'auto', zIndex:9999,
      background: T.dark ? '#0F1520' : T.surface,
      borderRadius:16, padding:'13px 15px 15px',
      boxShadow:`0 12px 40px rgba(0,0,0,${T.dark?'0.5':'0.15'}), 0 0 0 1px ${T.border}`,
      maxWidth: mobile ? '100%' : 310, fontFamily:'var(--font-body)',
      animation:'csSlideIn .35s cubic-bezier(.16,1,.3,1)' }}>
    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}>
      <div style={{ width:18, height:18, borderRadius:5, background:T.gold,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0 }}>🔔</div>
      <span style={{ fontSize:9, fontWeight:700, color:T.textT,
        letterSpacing:'.07em', textTransform:'uppercase', flex:1 }}>Conexão Setorial</span>
      <button onClick={onDismiss} style={{ background:'none', border:'none', color:T.textT,
        cursor:'pointer', fontSize:20, lineHeight:1, padding:'0 4px', WebkitTapHighlightColor:'transparent' }}>×</button>
    </div>
    <div style={{ display:'flex', gap:11, alignItems:'flex-start' }}>
      <div style={{ width:40, height:40, borderRadius:12, background:`${T.gold}18`, border:`1px solid ${T.gold}44`,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20 }}>⚡</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:4, lineHeight:1.3 }}>
          Solicitação de Bloqueio de Manutenção
        </div>
        <div style={{ fontSize:11, color:T.textS, lineHeight:1.5 }}>
          <b style={{color:T.gold}}>Nicolas Andrade</b> solicitou bloqueio de{' '}
          <b style={{color:'#E67E22'}}>{data.municipio}</b>.
          {mentionNames && <><br/>Responsável: <b style={{color:'#27AE60'}}>{mentionNames}</b></>}
          <br/>Desbloqueio: <b style={{color:'#E67E22'}}>{data.desbloqueio}</b>
        </div>
      </div>
    </div>
    <div style={{ marginTop:11, display:'flex', gap:8 }}>
      <button onClick={onDismiss} style={{ flex:1, padding:'9px 0', borderRadius:10, border:'none',
        background:T.gold, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer',
        fontFamily:'inherit', WebkitTapHighlightColor:'transparent' }}>Ver Atividade</button>
      <button onClick={onDismiss} style={{ flex:1, padding:'9px 0', borderRadius:10,
        border:`1px solid ${T.border}`, background:'transparent',
        color:T.textS, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
        WebkitTapHighlightColor:'transparent' }}>Fechar</button>
    </div>
  </div>
  );
}

// ─────────── Mobile: chat header ───────────
function MobileChatHeader({ selected, onBack }) {
  const bg  = sbBg();
  const brd = sbBrd();
  const isGroup = selected==='group';
  const conv = DM_META.find(c=>c.id===selected);
  const u = conv ? USERS[conv.user] : null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
      background:bg, flexShrink:0, borderBottom:`1px solid ${brd}` }}>
      <button onClick={onBack} style={{ width:38, height:38, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        color:T.gold, flexShrink:0, WebkitTapHighlightColor:'transparent' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
        </svg>
      </button>
      {isGroup ? (
        <>
          <div style={{ width:42, height:42, borderRadius:12, background:`${T.gold}18`,
            border:`1px solid ${T.gold}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>7 SERV - Comunicação Interna</div>
            <div style={{ fontSize:11, color:T.textS, fontFamily:'var(--font-body)' }}>5 participantes · 3 online</div>
          </div>
        </>
      ) : u && (
        <>
          <div style={{ position:'relative', flexShrink:0 }}>
            <Avatar userId={conv.user} size={42}/>
            <div style={{ position:'absolute', bottom:1, right:1, width:11, height:11, borderRadius:'50%',
              background:u.online?'#27AE60':'#A0A0A8', border:`2px solid ${bg}` }}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>{u.name}</div>
            <div style={{ fontSize:11, color:u.online?'#27AE60':T.textS, fontFamily:'var(--font-body)' }}>
              {u.online ? '● Online' : '○ Offline'} · {u.sector}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────── Mobile: lista de conversas ───────────
function MobileConvList({ selected, onSelect, dmMeta, onBack }) {
  const bg  = sbBg();
  const brd = sbBrd();
  const selBg = sbSel();
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, background:bg }}>

      <div style={{ padding:'14px 16px 12px', borderBottom:`1px solid ${brd}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer',
            color:T.textS, display:'flex', alignItems:'center', gap:4, fontSize:13,
            fontFamily:'var(--font-body)', padding:0, WebkitTapHighlightColor:'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 12L6 8L10 4"/>
            </svg>
            Módulos
          </button>
          <span style={{ fontSize:16, fontWeight:700, color:T.text, fontFamily:'var(--font-body)', flex:1 }}>Conexão Setorial</span>
          <div style={{ background:`${T.gold}18`, color:T.gold, fontSize:9, fontWeight:700,
            padding:'2px 7px', borderRadius:5, fontFamily:'var(--font-body)' }}>ADMIN</div>
        </div>
        <div style={{ background:T.page, borderRadius:12, padding:'8px 12px', border:`1px solid ${T.border}`,
          display:'flex', alignItems:'center', gap:8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize:14, color:T.textT, fontFamily:'var(--font-body)' }}>Pesquisar...</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        <div style={{ padding:'10px 16px 5px' }}>
          <span style={{ fontSize:10, fontWeight:700, color:T.textT,
            letterSpacing:'.12em', textTransform:'uppercase', fontFamily:'var(--font-body)' }}>Grupos</span>
        </div>
        <div onClick={()=>onSelect('group')}
          style={{ display:'flex', alignItems:'center', gap:13, padding:'10px 16px',
            background: selected==='group' ? selBg : 'transparent',
            cursor:'pointer', WebkitTapHighlightColor:'transparent',
            borderBottom:`1px solid ${brd}` }}>
          <div style={{ width:50, height:50, borderRadius:15, background:`${T.gold}15`,
            border:`1px solid ${T.gold}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
              <span style={{ fontSize:14, fontWeight:600, color:T.text, fontFamily:'var(--font-body)' }}>7 SERV - Comunicação Interna</span>
              <span style={{ fontSize:11, color:T.textT, fontFamily:'var(--font-body)', flexShrink:0, marginLeft:8 }}>16:28</span>
            </div>
            <span style={{ fontSize:12, color:T.textS, fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>
              Mariana: Manual atualizado! 🎉
            </span>
          </div>
        </div>

        <div style={{ padding:'12px 16px 5px' }}>
          <span style={{ fontSize:10, fontWeight:700, color:T.textT,
            letterSpacing:'.12em', textTransform:'uppercase', fontFamily:'var(--font-body)' }}>Mensagens Diretas</span>
        </div>
        {dmMeta.map(conv => {
          const u = USERS[conv.user];
          return (
            <div key={conv.id} onClick={()=>onSelect(conv.id)}
              style={{ display:'flex', alignItems:'center', gap:13, padding:'10px 16px',
                background: selected===conv.id ? selBg : 'transparent',
                cursor:'pointer', WebkitTapHighlightColor:'transparent',
                borderBottom:`1px solid ${brd}` }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <Avatar userId={conv.user} size={50}/>
                <div style={{ position:'absolute', bottom:1, right:1, width:12, height:12, borderRadius:'50%',
                  background:u.online?'#27AE60':'#A0A0A8', border:`2px solid ${bg}` }}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:T.text, fontFamily:'var(--font-body)' }}>{u.name}</span>
                  <span style={{ fontSize:11, color:T.textT, fontFamily:'var(--font-body)', flexShrink:0, marginLeft:8 }}>{conv.lastTime}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:T.textS, fontFamily:'var(--font-body)',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>{conv.lastMsg}</span>
                  {conv.unread > 0 && (
                    <div style={{ background:T.gold, color:'#fff', fontSize:10, fontWeight:700,
                      minWidth:20, height:20, borderRadius:10, padding:'0 5px', display:'flex', alignItems:'center',
                      justifyContent:'center', flexShrink:0, marginLeft:8, fontFamily:'var(--font-body)' }}>
                      {conv.unread}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ padding:'14px 16px 12px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.textT, letterSpacing:'.12em',
            textTransform:'uppercase', marginBottom:10, fontFamily:'var(--font-body)' }}>Online agora</div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {Object.entries(USERS).filter(([,u])=>u.online).map(([id,u])=>(
              <div key={id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                <div style={{ position:'relative' }}>
                  <Avatar userId={id} size={42}/>
                  <div style={{ position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:'50%',
                    background:'#27AE60', border:`2px solid ${bg}` }}/>
                </div>
                <span style={{ fontSize:10, color:T.textS, fontFamily:'var(--font-body)',
                  maxWidth:46, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {u.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── Bottom Nav ───────────
function BottomNav({ tab, onChange, actCount }) {
  const bg  = sbBg();
  const brd = sbBrd();
  const tabs = [
    { id:'chats', label:'Chats', icon:(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    )},
    { id:'activities', label:'Atividades', badge:actCount, icon:(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
  ];
  return (
    <div style={{ display:'flex', background:bg, borderTop:`1px solid ${brd}`,
      paddingBottom:'max(10px, env(safe-area-inset-bottom))', flexShrink:0 }}>
      {tabs.map(t => {
        const active = tab===t.id;
        return (
          <button key={t.id} onClick={()=>onChange(t.id)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              padding:'10px 0 6px', background:'none', border:'none', cursor:'pointer',
              color: active ? T.gold : T.textT, fontFamily:'var(--font-body)',
              fontSize:11, fontWeight: active ? 700 : 400,
              WebkitTapHighlightColor:'transparent', position:'relative' }}>
            {t.badge > 0 && (
              <div style={{ position:'absolute', top:6, left:'calc(50% + 8px)',
                width:16, height:16, borderRadius:'50%', background:'#E67E22',
                fontSize:9, fontWeight:700, color:'#fff', display:'flex',
                alignItems:'center', justifyContent:'center', fontFamily:'var(--font-body)' }}>{t.badge}</div>
            )}
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────── Componente raiz ───────────
export default function ConexaoSetorial({ onBack }) {
  const isMobile = useIsMobile();
  const [selected,   setSelected]   = useState('group');
  const [groupMsgs,  setGroupMsgs]  = useState(INIT_GROUP);
  const [dmMsgsMap,  setDmMsgsMap]  = useState(INIT_DM_MSGS);
  const [activities, setActivities] = useState(INIT_ACTIVITIES);
  const [notifToast, setNotifToast] = useState(null);
  const [mobileTab,  setMobileTab]  = useState('chats');
  const nextId = useRef(200);

  const getMsgs = () => selected==='group' ? groupMsgs : (dmMsgsMap[selected]||[]);
  const openConv = (id) => { setSelected(id); setMobileTab('chat'); };

  const sendMessage = (data) => {
    const id1=nextId.current++; const time=nowTime();
    if (data.type==='text' && data.text.toLowerCase().startsWith('/solicitar_bloqueio')) {
      const raw=data.text.slice('/solicitar_bloqueio'.length).trim();
      const cmdData=parseBloqueioCMD(raw);
      const mentioned=cmdData.mentions.map(u=>'@'+USERS[u]?.name).join(', ')||'@Setor';
      setGroupMsgs(p=>[...p,{id:id1,from:ME,type:'command',text:data.text,time,cmdData},{id:nextId.current++,type:'system',text:`✅ Notificação enviada para ${mentioned}  •  Adicionado a Atividades Pendentes`,time}]);
      setActivities(p=>[{id:nextId.current++,icon:'⏰',title:`Desbloquear manutenção de ${cmdData.municipio}`,desc:'Solicitado por Nicolas Andrade via /solicitar_bloqueio',when:cmdData.desbloqueio,color:'#E67E22',sector:cmdData.mentions.map(u=>USERS[u]?.sector).filter(Boolean).join(', ')||'Geral',urgent:false},...p]);
      setNotifToast(cmdData);
    } else {
      const msg={id:id1,from:ME,time,...data};
      if(selected==='group') setGroupMsgs(p=>[...p,msg]);
      else setDmMsgsMap(p=>({...p,[selected]:[...(p[selected]||[]),msg]}));
    }
  };

  const CSS = `
    @keyframes csSlideIn{from{opacity:0;transform:translateX(32px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes recPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.82)}}
  `;

  // ── MOBILE ──
  if (isMobile) {
    return (
      <div style={{ height:'100svh', display:'flex', flexDirection:'column', overflow:'hidden', background:T.page }}>
        <style>{CSS}</style>
        {mobileTab==='chat' && (
          <>
            <MobileChatHeader selected={selected} onBack={()=>setMobileTab('chats')}/>
            <MsgList msgs={getMsgs()} mobile/>
            <InputBar onSend={sendMessage} mobile/>
          </>
        )}
        {mobileTab==='chats' && (
          <>
            <MobileConvList selected={selected} onSelect={openConv} dmMeta={DM_META} onBack={onBack}/>
            <BottomNav tab="chats" onChange={t=>t==='activities'&&setMobileTab('activities')} actCount={activities.length}/>
          </>
        )}
        {mobileTab==='activities' && (
          <>
            <div style={{ background:sbBg(), padding:'10px 16px', flexShrink:0, borderBottom:`1px solid ${sbBrd()}`,
              display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer',
                color:T.textS, display:'flex', alignItems:'center', gap:4, fontSize:13,
                fontFamily:'var(--font-body)', padding:0, WebkitTapHighlightColor:'transparent' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 12L6 8L10 4"/></svg>
                Módulos
              </button>
            </div>
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', background:T.page }}>
              <ActivitiesPanel activities={activities} mobile/>
            </div>
            <BottomNav tab="activities" onChange={t=>setMobileTab(t)} actCount={activities.length}/>
          </>
        )}
        {notifToast && <NotifToast data={notifToast} onDismiss={()=>setNotifToast(null)} mobile/>}
      </div>
    );
  }

  // ── DESKTOP ──
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:T.page }}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{ height:50, background:T.surface, borderBottom:`1px solid ${T.border}`,
        display:'flex', alignItems:'center', paddingLeft:18, paddingRight:22, gap:12, flexShrink:0 }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none',
          cursor:'pointer', color:T.textS, fontSize:13, fontFamily:'var(--font-body)', padding:0 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={T.textS} strokeWidth="1.8">
            <path d="M10 12L6 8L10 4"/>
          </svg>
          Módulos
        </button>
        <div style={{ width:1, height:16, background:T.border }}/>
        <span style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>Conexão Setorial</span>
        <div style={{ background:`${T.gold}12`, color:T.gold, fontSize:9, fontWeight:700,
          padding:'2px 8px', borderRadius:5, fontFamily:'var(--font-body)', letterSpacing:'.04em' }}>SOMENTE ADMIN</div>
        {notifToast && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
            fontSize:11, color:'#27AE60', fontFamily:'var(--font-body)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#27AE60' }}/>
            Notificação enviada para {notifToast.mentions.map(u=>USERS[u]?.name).join(', ')||'Setor'}
          </div>
        )}
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        <Sidebar selected={selected} onSelect={setSelected} dmMeta={DM_META}/>
        {/* Chat column */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
          {/* Chat header */}
          <div style={{ padding:'11px 18px', borderBottom:`1px solid ${T.border}`, background:T.surface,
            display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            {selected==='group' ? (
              <>
                <div style={{ width:40, height:40, borderRadius:12, background:`${T.gold}15`,
                  border:`1px solid ${T.gold}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>7 SERV - Comunicação Interna</div>
                  <div style={{ fontSize:11, color:T.textS, fontFamily:'var(--font-body)' }}>5 participantes · 3 online agora</div>
                </div>
              </>
            ) : (() => { const conv=DM_META.find(c=>c.id===selected); const u=conv?USERS[conv.user]:null; return u && (
              <>
                <div style={{ position:'relative' }}>
                  <Avatar userId={conv.user} size={40}/>
                  <div style={{ position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:'50%',
                    background:u.online?'#27AE60':'#A0A0A8', border:`2px solid ${T.surface}` }}/>
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>{u.name}</div>
                  <div style={{ fontSize:11, color:u.online?'#27AE60':T.textS, fontFamily:'var(--font-body)' }}>
                    {u.online?'● Online':'○ Offline'} · {u.sector}
                  </div>
                </div>
              </>
            ); })()}
          </div>
          <MsgList msgs={getMsgs()} mobile={false}/>
          <InputBar onSend={sendMessage} mobile={false}/>
        </div>
        <ActivitiesPanel activities={activities} mobile={false}/>
      </div>

      {notifToast && <NotifToast data={notifToast} onDismiss={()=>setNotifToast(null)} mobile={false}/>}
    </div>
  );
}
