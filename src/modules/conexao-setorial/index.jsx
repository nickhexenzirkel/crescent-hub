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

const SIDEBAR_BG = '#141928';

const EXT_ICONS = {
  pdf:  { bg:'#E74C3C', icon:'PDF' },
  docx: { bg:'#2980B9', icon:'DOC' },
  doc:  { bg:'#2980B9', icon:'DOC' },
  xlsx: { bg:'#27AE60', icon:'XLS' },
  xls:  { bg:'#27AE60', icon:'XLS' },
  pptx: { bg:'#E67E22', icon:'PPT' },
  zip:  { bg:'#8E44AD', icon:'ZIP' },
  mp3:  { bg:'#16A085', icon:'MP3' },
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
  const mentionRe = /@(\S+)/g;
  let m;
  while ((m = mentionRe.exec(raw)) !== null) {
    const slug = m[1].toLowerCase().replace(/[,.:;!?]/g,'');
    for (const [id,u] of Object.entries(USERS)) {
      if (id.startsWith(slug)||u.name.toLowerCase().replace(/\s+/g,'').startsWith(slug)||
          u.sector.toLowerCase().replace(/\s+/g,'').includes(slug)) {
        if (!mentionedIds.includes(id)) mentionedIds.push(id);
        break;
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

// ─────────── Avatar ───────────
function Avatar({ userId, size = 34 }) {
  const u = USERS[userId];
  if (!u) return null;
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:u.color, flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center', userSelect:'none',
      fontSize:Math.round(size*0.36), fontWeight:700, color:'#fff', fontFamily:'var(--font-body)' }}>
      {u.initials}
    </div>
  );
}

// ─────────── BubbleWrap ───────────
function BubbleWrap({ msg, mobile, children }) {
  const isMe = msg.from === ME;
  const u = USERS[msg.from];
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:6,
      flexDirection: isMe ? 'row-reverse' : 'row',
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      maxWidth: mobile ? '85%' : '72%', marginBottom:6 }}>
      {!isMe && <Avatar userId={msg.from} size={mobile ? 28 : 26}/>}
      <div>
        {!isMe && (
          <div style={{ fontSize:11, fontWeight:600, color:u?.color||'#666', marginBottom:2, fontFamily:'var(--font-body)' }}>
            {u?.name}<span style={{ fontSize:10, fontWeight:400, color:T.textS, marginLeft:6 }}>{u?.sector}</span>
          </div>
        )}
        {children}
        <div style={{ fontSize:10, color:T.textT, marginTop:2, fontFamily:'var(--font-body)',
          textAlign: isMe ? 'right' : 'left' }}>
          {msg.time}{isMe ? ' ✓✓' : ''}
        </div>
      </div>
    </div>
  );
}

// ─────────── Bubbles ───────────
function TextBubble({ msg, mobile }) {
  const isMe = msg.from === ME;
  return (
    <BubbleWrap msg={msg} mobile={mobile}>
      <div style={{
        background: isMe ? 'linear-gradient(135deg,#1A6FB5,#2196F3)' : T.surface,
        color: isMe ? '#fff' : T.text,
        border: isMe ? 'none' : `1px solid ${T.border}`,
        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: mobile ? '9px 13px' : '8px 12px',
        fontSize: mobile ? 14 : 13, lineHeight:1.5, fontFamily:'var(--font-body)',
        boxShadow:'0 1px 3px rgba(0,0,0,0.07)', wordBreak:'break-word',
      }}>{msg.text}</div>
    </BubbleWrap>
  );
}

function ImageBubble({ msg, mobile }) {
  const isMe = msg.from === ME;
  const w = mobile ? 240 : 220;
  return (
    <BubbleWrap msg={msg} mobile={mobile}>
      <div style={{ borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        overflow:'hidden', border:`1px solid ${T.border}`, maxWidth:w }}>
        {msg.src
          ? <img src={msg.src} alt={msg.name||'imagem'} style={{ width:'100%', display:'block', maxHeight:220, objectFit:'cover' }}/>
          : <div style={{ width:w, height:150, background: isMe ? 'linear-gradient(135deg,#1A3A60,#1A6FB5)' : T.surface,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span style={{ fontSize:34 }}>🖼️</span>
              <span style={{ fontSize:11, color: isMe ? 'rgba(255,255,255,0.6)' : T.textS, fontFamily:'var(--font-body)' }}>
                {msg.name||'Imagem'}
              </span>
            </div>
        }
        {msg.caption && (
          <div style={{ padding:'6px 10px', background: isMe ? 'rgba(0,0,0,0.25)' : T.page,
            fontSize:11, color: isMe ? 'rgba(255,255,255,0.8)' : T.textS, fontFamily:'var(--font-body)' }}>
            {msg.caption}
          </div>
        )}
      </div>
    </BubbleWrap>
  );
}

function FileBubble({ msg, mobile }) {
  const isMe = msg.from === ME;
  const extInfo = EXT_ICONS[msg.ext?.toLowerCase()]||{ bg:'#636E72', icon:(msg.ext||'FILE').toUpperCase().slice(0,3) };
  return (
    <BubbleWrap msg={msg} mobile={mobile}>
      <div style={{
        background: isMe ? 'linear-gradient(135deg,#1A6FB5,#2196F3)' : T.surface,
        border: isMe ? 'none' : `1px solid ${T.border}`,
        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding:'10px 13px', display:'flex', alignItems:'center', gap:12,
        minWidth: mobile ? 200 : 190, maxWidth: mobile ? 260 : 240,
        boxShadow:'0 1px 3px rgba(0,0,0,0.07)', cursor:'pointer',
      }}>
        <div style={{ width:42, height:42, borderRadius:10, background:extInfo.bg, flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:10, fontWeight:800, color:'#fff', letterSpacing:'.04em', fontFamily:'monospace' }}>
          {extInfo.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, color: isMe ? '#fff' : T.text,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:'var(--font-body)' }}>
            {msg.name}
          </div>
          <div style={{ fontSize:10, color: isMe ? 'rgba(255,255,255,0.65)' : T.textS, marginTop:2, fontFamily:'var(--font-body)' }}>
            {formatSize(msg.size||0)} · {(msg.ext||'arquivo').toUpperCase()}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={isMe ? 'rgba(255,255,255,0.7)' : T.textS} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
    </BubbleWrap>
  );
}

function AudioBubble({ msg, mobile }) {
  const isMe = msg.from === ME;
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); }
  };
  const onTimeUpdate = () => {
    const a = audioRef.current; if (!a||!a.duration) return;
    setCurrentTime(Math.floor(a.currentTime)); setProgress(a.currentTime/a.duration);
  };
  const onEnded = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
  const onBarClick = (e) => {
    const a = audioRef.current; if (!a||!a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX-rect.left)/rect.width;
    a.currentTime = ratio*a.duration; setProgress(ratio);
  };
  const accent  = isMe ? 'rgba(255,255,255,0.9)' : T.gold;
  const trackBg = isMe ? 'rgba(255,255,255,0.25)' : T.border;
  const w = mobile ? 260 : 200;
  return (
    <BubbleWrap msg={msg} mobile={mobile}>
      <div style={{
        background: isMe ? 'linear-gradient(135deg,#1A6FB5,#2196F3)' : T.surface,
        border: isMe ? 'none' : `1px solid ${T.border}`,
        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding:'10px 13px', display:'flex', alignItems:'center', gap:10,
        minWidth:w, maxWidth: mobile ? 280 : 260, boxShadow:'0 1px 3px rgba(0,0,0,0.07)',
      }}>
        {msg.src && <audio ref={audioRef} src={msg.src} onTimeUpdate={onTimeUpdate} onEnded={onEnded}/>}
        <button onClick={toggle} style={{ width:38, height:38, borderRadius:'50%', flexShrink:0,
          background: isMe ? 'rgba(255,255,255,0.2)' : `${T.gold}22`,
          border:`1.5px solid ${isMe ? 'rgba(255,255,255,0.4)' : T.gold}`,
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:accent,
          WebkitTapHighlightColor:'transparent' }}>
          {playing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill={accent}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill={accent}><polygon points="5 3 19 12 5 21 5 3"/></svg>}
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:2, height:28, marginBottom:4 }}>
            {Array.from({length:24}).map((_,i) => {
              const h = [4,7,12,8,15,6,18,10,14,5,9,16,11,7,13,8,17,6,12,9,15,7,11,5][i];
              return <div key={i} style={{ flex:1, height:`${h}px`, borderRadius:2,
                background: i/24<=progress ? accent : trackBg, transition:'background .1s' }}/>;
            })}
          </div>
          <div onClick={onBarClick} style={{ height:3, background:trackBg, borderRadius:2, cursor:'pointer', position:'relative' }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', background:accent,
              borderRadius:2, width:`${progress*100}%`, transition:'width .1s' }}/>
          </div>
          <div style={{ marginTop:4, fontSize:10, color: isMe ? 'rgba(255,255,255,0.65)' : T.textS,
            fontFamily:'var(--font-body)', display:'flex', justifyContent:'space-between' }}>
            <span>{formatDur(currentTime)}</span>
            <span>{msg.duration ? formatDur(msg.duration) : '🎙️ Áudio'}</span>
          </div>
        </div>
      </div>
    </BubbleWrap>
  );
}

function CommandBubble({ msg, mobile }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:7, flexDirection:'row-reverse',
      alignSelf:'flex-end', maxWidth: mobile ? '90%' : '78%', marginBottom:7 }}>
      <Avatar userId={ME} size={mobile ? 28 : 26}/>
      <div>
        <div style={{
          background:'linear-gradient(135deg,#0D1628,#162040)',
          border:'1px solid rgba(26,111,181,0.45)', borderRadius:'14px 14px 4px 14px',
          padding:'11px 14px', minWidth: mobile ? 200 : 224,
          boxShadow:'0 4px 14px rgba(26,111,181,0.2)', fontFamily:'var(--font-body)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
            <div style={{ background:'linear-gradient(135deg,#B04800,#E67E22)', borderRadius:6, padding:'2px 8px',
              fontSize:9, fontWeight:800, color:'#fff', letterSpacing:'.06em', flexShrink:0 }}>⚡ COMANDO</div>
            <code style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>/solicitar_bloqueio</code>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { icon:'📍', label:'Município',   val:msg.cmdData.municipio,                                          valColor:'#fff'    },
              { icon:'👥', label:'Notificar',   val:msg.cmdData.mentions.map(u=>'@'+USERS[u]?.name).join(', ')||'—',valColor:'#5DCC80' },
              { icon:'⏰', label:'Desbloqueio', val:msg.cmdData.desbloqueio,                                        valColor:'#E67E22' },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
                <span style={{ fontSize:14, flexShrink:0, lineHeight:1.3 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.32)', fontWeight:700,
                    textTransform:'uppercase', letterSpacing:'.08em', marginBottom:1 }}>{r.label}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:r.valColor }}>{r.val}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:8,
            display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#27AE60', flexShrink:0 }}/>
            <span style={{ fontSize:10, color:'#5DCC80', fontWeight:600 }}>Notificação enviada · Atividade registrada</span>
          </div>
        </div>
        <div style={{ fontSize:10, color:T.textT, marginTop:2, textAlign:'right', fontFamily:'var(--font-body)' }}>
          {msg.time} ✓✓
        </div>
      </div>
    </div>
  );
}

function SystemMsg({ msg }) {
  return (
    <div style={{ textAlign:'center', margin:'4px 0 8px', fontFamily:'var(--font-body)' }}>
      <span style={{ fontSize:11, color:T.textS, background:T.page,
        padding:'3px 12px', borderRadius:20, border:`1px solid ${T.border}` }}>
        {msg.text}
      </span>
    </div>
  );
}

function MsgList({ msgs, mobile }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);
  return (
    <div style={{ flex:1, overflowY:'auto', padding: mobile ? '12px 14px' : '16px 20px',
      display:'flex', flexDirection:'column', WebkitOverflowScrolling:'touch' }}>
      <div style={{ textAlign:'center', margin:'0 0 12px', fontFamily:'var(--font-body)' }}>
        <span style={{ fontSize:11, color:T.textS, background:T.page,
          padding:'2px 12px', borderRadius:20, border:`1px solid ${T.border}` }}>Hoje</span>
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

// ─────────── Input Bar (shared desktop + mobile) ───────────
function InputBar({ onSend, mobile }) {
  const [input, setInput]       = useState('');
  const [cmdMenu, setCmdMenu]   = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [recording, setRecording]   = useState(false);
  const [recTime, setRecTime]       = useState(0);
  const inputRef     = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef  = useRef(null);
  const audioFileRef  = useRef(null);
  const mrRef    = useRef(null);
  const timerRef = useRef(null);

  const handleInput = (e) => {
    const val = e.target.value; setInput(val);
    setCmdMenu(val === '/' || (val.startsWith('/') && !val.includes(' ')));
  };
  const handleKeyDown = (e) => {
    if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); doSend(); }
    if (e.key==='Escape') { setCmdMenu(false); setAttachOpen(false); }
  };
  const doSend = () => {
    const txt = input.trim(); if (!txt) return;
    onSend({ type:'text', text:txt });
    setInput(''); setCmdMenu(false); setAttachOpen(false);
    inputRef.current?.focus();
  };
  const pickCmd = (cmd) => { setInput(cmd+' '); setCmdMenu(false); inputRef.current?.focus(); };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSend({ type:'image', src:ev.target.result, name:file.name, size:file.size });
    reader.readAsDataURL(file); e.target.value=''; setAttachOpen(false);
  };
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    onSend({ type:'file', name:file.name, size:file.size, ext:file.name.split('.').pop()?.toLowerCase()||'' });
    e.target.value=''; setAttachOpen(false);
  };
  const handleAudioFileSelect = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSend({ type:'audio', src:ev.target.result, name:file.name, size:file.size, ext:file.name.split('.').pop() });
    reader.readAsDataURL(file); e.target.value=''; setAttachOpen(false);
  };
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type:'audio/webm' });
        onSend({ type:'audio', src:URL.createObjectURL(blob), duration:recTime });
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start(); mrRef.current = mr;
      setRecording(true); setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t=>t+1), 1000);
      setAttachOpen(false);
    } catch { alert('Permissão de microfone negada.'); }
  };
  const stopRecording = () => { mrRef.current?.stop(); clearInterval(timerRef.current); setRecording(false); };
  const cancelRecording = () => {
    if (mrRef.current) {
      mrRef.current.ondataavailable=null; mrRef.current.onstop=null;
      mrRef.current.stop(); mrRef.current.stream?.getTracks().forEach(t=>t.stop());
    }
    clearInterval(timerRef.current); setRecording(false); setRecTime(0);
  };

  const filteredCmds = COMMANDS.filter(c => c.cmd.includes(input.replace('/','').split(' ')[0]||''));
  const showHint = input.startsWith('/solicitar_bloqueio ');

  // Padding inferior para safe area no iPhone
  const safeBottom = mobile ? 'max(10px, env(safe-area-inset-bottom))' : '12px';

  return (
    <div style={{ flexShrink:0, background:T.surface,
      borderTop:`1px solid ${T.border}`,
      paddingTop:8, paddingLeft:12, paddingRight:12,
      paddingBottom:safeBottom }}>

      <input ref={imageInputRef} type="file" accept="image/*"        style={{display:'none'}} onChange={handleImageSelect}/>
      <input ref={fileInputRef}  type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.zip,.txt" style={{display:'none'}} onChange={handleFileSelect}/>
      <input ref={audioFileRef}  type="file" accept="audio/*"        style={{display:'none'}} onChange={handleAudioFileSelect}/>

      {recording ? (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#E74C3C',
              animation:'recPulse 1s ease-in-out infinite', flexShrink:0 }}/>
            <span style={{ fontSize:14, fontWeight:700, color:'#E74C3C', fontFamily:'var(--font-body)' }}>Gravando</span>
            <span style={{ fontSize:14, fontWeight:600, color:T.text, fontFamily:'monospace' }}>{formatDur(recTime)}</span>
          </div>
          <button onClick={cancelRecording}
            style={{ padding:'8px 14px', borderRadius:20, border:`1px solid ${T.border}`,
              background:'transparent', cursor:'pointer', fontSize:13, color:T.textS,
              fontFamily:'var(--font-body)', WebkitTapHighlightColor:'transparent' }}>
            Cancelar
          </button>
          <button onClick={stopRecording}
            style={{ padding:'8px 16px', borderRadius:20, border:'none',
              background:'linear-gradient(135deg,#E74C3C,#C0392B)', cursor:'pointer',
              fontSize:13, fontWeight:700, color:'#fff', fontFamily:'var(--font-body)',
              WebkitTapHighlightColor:'transparent' }}>
            ⏹ Enviar
          </button>
        </div>
      ) : (
        <div style={{ position:'relative' }}>

          {/* Attach menu — bottom sheet no mobile, popup no desktop */}
          {attachOpen && (
            mobile ? (
              <div style={{ position:'fixed', inset:0, zIndex:100 }}
                onClick={() => setAttachOpen(false)}>
                <div onClick={e => e.stopPropagation()} style={{
                  position:'absolute', bottom:0, left:0, right:0,
                  background:T.surface, borderRadius:'20px 20px 0 0',
                  paddingBottom:'max(20px, env(safe-area-inset-bottom))',
                  boxShadow:'0 -8px 40px rgba(0,0,0,0.2)',
                  border:`1px solid ${T.border}` }}>
                  <div style={{ width:36, height:4, borderRadius:2, background:T.border,
                    margin:'12px auto 16px' }}/>
                  <div style={{ padding:'0 8px 8px' }}>
                    {[
                      { emoji:'📷', label:'Foto / Imagem',    action:() => imageInputRef.current?.click() },
                      { emoji:'📎', label:'Arquivo / Documento', action:() => fileInputRef.current?.click() },
                      { emoji:'🎵', label:'Arquivo de Áudio', action:() => audioFileRef.current?.click() },
                      { emoji:'🎙️', label:'Gravar Áudio',     action:startRecording },
                    ].map((item,i) => (
                      <div key={i} onClick={() => { item.action(); setAttachOpen(false); }}
                        style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                          borderRadius:12, cursor:'pointer', WebkitTapHighlightColor:'transparent',
                          borderBottom: i<3 ? `1px solid ${T.border}` : 'none' }}>
                        <div style={{ width:44, height:44, borderRadius:12, background:T.page,
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                          {item.emoji}
                        </div>
                        <span style={{ fontSize:15, color:T.text, fontFamily:'var(--font-body)', fontWeight:500 }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0,
                background:T.surface, border:`1px solid ${T.border}`, borderRadius:12,
                overflow:'hidden', boxShadow:'0 -8px 24px rgba(0,0,0,0.14)', zIndex:10, minWidth:200 }}>
                {[
                  { label:'📷  Foto / Imagem',      action:() => imageInputRef.current?.click() },
                  { label:'📎  Arquivo / Documento', action:() => fileInputRef.current?.click() },
                  { label:'🎵  Arquivo de Áudio',    action:() => audioFileRef.current?.click() },
                  { label:'🎙️  Gravar Áudio',        action:startRecording },
                ].map((item,i) => (
                  <div key={i} onClick={() => { item.action(); setAttachOpen(false); }}
                    onMouseEnter={e => e.currentTarget.style.background=T.page}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    style={{ padding:'10px 16px', cursor:'pointer', fontSize:13, color:T.text,
                      fontFamily:'var(--font-body)', borderBottom:i<3?`1px solid ${T.border}`:'none',
                      display:'flex', alignItems:'center', gap:8, transition:'background .12s' }}>
                    {item.label}
                  </div>
                ))}
              </div>
            )
          )}

          {/* Command menu */}
          {cmdMenu && filteredCmds.length > 0 && (
            <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left: mobile ? 0 : 40, right: mobile ? 0 : 50,
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:10,
              overflow:'hidden', boxShadow:'0 -8px 24px rgba(0,0,0,0.14)', zIndex:10 }}>
              <div style={{ padding:'5px 12px 3px', fontSize:9, fontWeight:700, color:T.textT,
                textTransform:'uppercase', letterSpacing:'.1em', fontFamily:'var(--font-body)' }}>Comandos</div>
              {filteredCmds.map(c => (
                <div key={c.cmd} onClick={() => pickCmd(c.cmd)}
                  style={{ padding:'10px 12px', cursor:'pointer', display:'flex', gap:10, alignItems:'center',
                    borderTop:`1px solid ${T.border}`, WebkitTapHighlightColor:'transparent' }}>
                  <code style={{ fontSize:12, color:T.gold, fontFamily:'monospace', fontWeight:700, flexShrink:0 }}>{c.cmd}</code>
                  <span style={{ fontSize:11, color:T.textS, fontFamily:'var(--font-body)' }}>{c.desc}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {/* Attach */}
            <button onClick={() => { setAttachOpen(o=>!o); setCmdMenu(false); }}
              style={{ width: mobile ? 42 : 38, height: mobile ? 42 : 38, borderRadius:mobile?'50%':10, flexShrink:0,
                background: attachOpen ? `${T.gold}18` : 'transparent',
                border:`1px solid ${attachOpen ? T.gold+'55' : T.border}`,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                color: attachOpen ? T.gold : T.textS, transition:'all .15s',
                WebkitTapHighlightColor:'transparent' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            {/* Input */}
            <input ref={inputRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
              placeholder={mobile ? 'Mensagem...' : 'Digite uma mensagem ou / para comandos...'}
              style={{ flex:1, background:T.page, borderRadius: mobile ? 22 : 10,
                border:`1px solid ${input.startsWith('/solicitar_bloqueio') ? T.gold+'88' : T.border}`,
                padding: mobile ? '11px 16px' : '9px 13px',
                fontSize: mobile ? 16 : 13, /* 16px evita zoom no iOS */
                color:T.text, fontFamily:'var(--font-body)', outline:'none',
                transition:'border-color .15s', boxSizing:'border-box' }}
            />

            {/* Mic (quando vazio) ou Send (quando tem texto) */}
            {!input.trim() ? (
              <button onClick={startRecording}
                style={{ width: mobile ? 42 : 38, height: mobile ? 42 : 38, borderRadius:'50%', flexShrink:0,
                  background:'transparent', border:`1px solid ${T.border}`,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  color:T.textS, WebkitTapHighlightColor:'transparent' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            ) : (
              <button onClick={doSend}
                style={{ width: mobile ? 42 : 38, height: mobile ? 42 : 38, borderRadius:'50%', flexShrink:0,
                  background:'linear-gradient(135deg,#1A6FB5,#2196F3)', border:'none',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  WebkitTapHighlightColor:'transparent' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            )}
          </div>

          {!mobile && showHint && (
            <div style={{ marginTop:5, fontSize:11, color:T.gold, fontFamily:'var(--font-body)', paddingLeft:2 }}>
              ⚡ Formato: <code style={{fontFamily:'monospace'}}>/solicitar_bloqueio [município] @[usuário] desbloquear [quando]</code>
            </div>
          )}
          {!mobile && !showHint && !cmdMenu && !attachOpen && (
            <div style={{ marginTop:4, fontSize:10, color:T.textT, fontFamily:'var(--font-body)', paddingLeft:1 }}>
              <b style={{color:T.textS}}>📎</b> anexar &nbsp;·&nbsp;
              <b style={{color:T.textS}}>🎙️</b> gravar áudio &nbsp;·&nbsp;
              <b style={{color:T.textS}}>/</b> comandos &nbsp;·&nbsp;
              <b style={{color:T.textS}}>Enter</b> enviar
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────── Sidebar (desktop) ───────────
function Sidebar({ selected, onSelect, dmMeta }) {
  const totalUnread = dmMeta.reduce((s,c) => s+c.unread, 0);
  const row = (id) => ({
    display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:9,
    background: selected===id ? 'rgba(255,255,255,0.11)' : 'transparent',
    cursor:'pointer', transition:'background .15s', marginBottom:2,
  });
  return (
    <div style={{ width:268, flexShrink:0, background:SIDEBAR_BG,
      borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#1A6FB5,#2196F3)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:17 }}>💬</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#fff', fontFamily:'var(--font-body)', lineHeight:1.2 }}>Conexão Setorial</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:'var(--font-body)', marginTop:2 }}>Comunicação Interna · Admin</div>
          </div>
        </div>
      </div>
      <div style={{ padding:'8px 12px', flexShrink:0 }}>
        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 10px',
          display:'flex', alignItems:'center', gap:7, border:'1px solid rgba(255,255,255,0.04)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.24)', fontFamily:'var(--font-body)' }}>Pesquisar...</span>
        </div>
      </div>
      <div style={{ padding:'0 12px 6px', flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:'.12em',
          textTransform:'uppercase', marginBottom:4, fontFamily:'var(--font-body)' }}>Grupos</div>
        <div onClick={() => onSelect('group')} style={row('group')}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid rgba(26,111,181,0.35)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7EC8F8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#fff', fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>7 SERV - Comunicação Interna</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>
              Mariana: Manual atualizado! 🎉
            </div>
          </div>
        </div>
      </div>
      <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'0 12px 6px' }}/>
      <div style={{ padding:'0 12px', flex:1, overflowY:'auto', minHeight:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:'.12em',
            textTransform:'uppercase', fontFamily:'var(--font-body)' }}>Mensagens Diretas</div>
          {totalUnread>0 && (
            <div style={{ background:'#E74C3C', color:'#fff', fontSize:9, fontWeight:700,
              width:16, height:16, borderRadius:'50%', display:'flex', alignItems:'center',
              justifyContent:'center', fontFamily:'var(--font-body)' }}>{totalUnread}</div>
          )}
        </div>
        {dmMeta.map(conv => (
          <div key={conv.id} onClick={() => onSelect(conv.id)} style={row(conv.id)}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <Avatar userId={conv.user} size={35}/>
              <div style={{ position:'absolute', bottom:0, right:0, width:8, height:8, borderRadius:'50%',
                background:USERS[conv.user].online?'#27AE60':'#636E72', border:`1.5px solid ${SIDEBAR_BG}` }}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:600, color:'#fff', fontFamily:'var(--font-body)' }}>
                  {USERS[conv.user].name}
                </span>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.28)', fontFamily:'var(--font-body)', flexShrink:0, marginLeft:4 }}>
                  {conv.lastTime}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:1 }}>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontFamily:'var(--font-body)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:136 }}>
                  {conv.lastMsg}
                </span>
                {conv.unread>0 && (
                  <div style={{ background:'#1A6FB5', color:'#fff', fontSize:9, fontWeight:700,
                    width:16, height:16, borderRadius:'50%', display:'flex', alignItems:'center',
                    justifyContent:'center', flexShrink:0, marginLeft:4, fontFamily:'var(--font-body)' }}>
                    {conv.unread}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'8px 12px 12px', borderTop:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:'.12em',
          textTransform:'uppercase', marginBottom:7, fontFamily:'var(--font-body)' }}>Online agora</div>
        <div style={{ display:'flex', gap:5 }}>
          {Object.entries(USERS).filter(([,u]) => u.online).map(([id]) => (
            <div key={id} style={{ position:'relative' }}>
              <Avatar userId={id} size={26}/>
              <div style={{ position:'absolute', bottom:0, right:0, width:7, height:7, borderRadius:'50%',
                background:'#27AE60', border:`1.5px solid ${SIDEBAR_BG}` }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── Activities Panel ───────────
function ActivitiesPanel({ activities, mobile, onBack }) {
  const content = (
    <>
      <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:9, minHeight:0, WebkitOverflowScrolling:'touch' }}>
        {activities.map(act => (
          <div key={act.id} style={{ background:T.page, borderRadius:12,
            border:`1px solid ${act.urgent ? act.color+'3C' : T.border}`,
            padding:'12px 14px', position:'relative', overflow:'hidden', flexShrink:0 }}>
            <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3,
              background:act.color, borderRadius:'12px 0 0 12px' }}/>
            <div style={{ paddingLeft:9 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:18, flexShrink:0, lineHeight:1.2 }}>{act.icon}</span>
                <div style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.3, fontFamily:'var(--font-body)' }}>{act.title}</div>
              </div>
              <div style={{ fontSize:12, color:T.textS, lineHeight:1.4, marginBottom:9, fontFamily:'var(--font-body)' }}>{act.desc}</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:700, color:act.color,
                  background:`${act.color}18`, padding:'3px 8px', borderRadius:6, fontFamily:'var(--font-body)' }}>{act.when}</span>
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
      {!mobile && (
        <div style={{ padding:'10px 12px', borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
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
      )}
    </>
  );

  if (mobile) {
    return (
      <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
        <div style={{ padding:'12px 16px 10px', borderBottom:`1px solid ${T.border}`,
          display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:'var(--font-body)', flex:1 }}>
            Atividades Pendentes
          </span>
          <div style={{ background:`${T.gold}20`, color:T.gold, fontSize:11, fontWeight:700,
            width:22, height:22, borderRadius:11, display:'flex', alignItems:'center',
            justifyContent:'center', fontFamily:'var(--font-body)' }}>{activities.length}</div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={{ width:266, flexShrink:0, background:T.surface,
      borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 16px 10px', borderBottom:`1px solid ${T.border}`,
        display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:'var(--font-body)', flex:1 }}>Atividades Pendentes</span>
        <div style={{ background:`${T.gold}20`, color:T.gold, fontSize:10, fontWeight:700,
          minWidth:20, height:20, borderRadius:10, padding:'0 5px', display:'flex', alignItems:'center',
          justifyContent:'center', fontFamily:'var(--font-body)' }}>{activities.length}</div>
      </div>
      {content}
    </div>
  );
}

// ─────────── Toast ───────────
function NotifToast({ data, onDismiss, mobile }) {
  const mentionNames = data.mentions.map(u => USERS[u]?.name||u).join(', ');
  return (
    <div style={{ position:'fixed', top: mobile ? 'auto' : 24, bottom: mobile ? 80 : 'auto',
      right: mobile ? 12 : 24, left: mobile ? 12 : 'auto',
      zIndex:9999, background:'#0F1520', borderRadius:14, padding:'13px 15px 15px',
      boxShadow:'0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)',
      maxWidth: mobile ? '100%' : 310, fontFamily:'var(--font-body)',
      animation:'csSlideIn .35s cubic-bezier(.16,1,.3,1)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}>
        <div style={{ width:18, height:18, borderRadius:4, background:'linear-gradient(135deg,#1A6FB5,#2196F3)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0 }}>🔔</div>
        <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.38)',
          letterSpacing:'.07em', textTransform:'uppercase', flex:1 }}>Conexão Setorial</span>
        <button onClick={onDismiss} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)',
          cursor:'pointer', fontSize:20, lineHeight:1, padding:'0 4px',
          WebkitTapHighlightColor:'transparent' }}>×</button>
      </div>
      <div style={{ display:'flex', gap:11, alignItems:'flex-start' }}>
        <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>⚡</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:4, lineHeight:1.25 }}>
            Solicitação de Bloqueio de Manutenção
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.5 }}>
            <b style={{color:'#7EC8F8'}}>Nicolas Andrade</b> solicitou bloqueio de{' '}
            <b style={{color:'#E67E22'}}>{data.municipio}</b>.
            {mentionNames && <><br/>Responsável: <b style={{color:'#5DCC80'}}>{mentionNames}</b></>}
            <br/>Desbloqueio: <b style={{color:'#E67E22'}}>{data.desbloqueio}</b>
          </div>
        </div>
      </div>
      <div style={{ marginTop:11, display:'flex', gap:7 }}>
        <button onClick={onDismiss} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none',
          background:'linear-gradient(135deg,#1A6FB5,#2196F3)', color:'#fff',
          fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          WebkitTapHighlightColor:'transparent' }}>Ver Atividade</button>
        <button onClick={onDismiss} style={{ flex:1, padding:'8px 0', borderRadius:8,
          border:'1px solid rgba(255,255,255,0.12)', background:'transparent',
          color:'rgba(255,255,255,0.55)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          WebkitTapHighlightColor:'transparent' }}>Fechar</button>
      </div>
    </div>
  );
}

// ─────────── Chat header (mobile) ───────────
function MobileChatHeader({ selected, onBack }) {
  const isGroup = selected === 'group';
  const conv = DM_META.find(c => c.id === selected);
  const u = conv ? USERS[conv.user] : null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
      background:SIDEBAR_BG, flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
      <button onClick={onBack}
        style={{ width:36, height:36, borderRadius:'50%', background:'transparent', border:'none',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          color:'rgba(255,255,255,0.7)', flexShrink:0, WebkitTapHighlightColor:'transparent' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
        </svg>
      </button>
      {isGroup ? (
        <>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7EC8F8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>7 SERV - Comunicação Interna</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', fontFamily:'var(--font-body)' }}>5 participantes · 3 online</div>
          </div>
        </>
      ) : u && (
        <>
          <div style={{ position:'relative', flexShrink:0 }}>
            <Avatar userId={conv.user} size={40}/>
            <div style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:'50%',
              background:u.online?'#27AE60':'#636E72', border:`2px solid ${SIDEBAR_BG}` }}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:'var(--font-body)' }}>{u.name}</div>
            <div style={{ fontSize:11, color: u.online?'#5DCC80':'rgba(255,255,255,0.4)', fontFamily:'var(--font-body)' }}>
              {u.online ? '● Online' : '○ Offline'} · {u.sector}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────── Conversations list (mobile) ───────────
function MobileConvList({ selected, onSelect, dmMeta, onBack }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>

      {/* Header */}
      <div style={{ padding:'14px 16px 10px', background:SIDEBAR_BG,
        borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer',
            color:'rgba(255,255,255,0.55)', display:'flex', alignItems:'center', gap:4,
            fontSize:13, fontFamily:'var(--font-body)', padding:0, WebkitTapHighlightColor:'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 12L6 8L10 4"/>
            </svg>
            Módulos
          </button>
          <span style={{ fontSize:16, fontWeight:700, color:'#fff', fontFamily:'var(--font-body)', flex:1 }}>
            Conexão Setorial
          </span>
          <div style={{ background:'rgba(26,111,181,0.25)', color:'#7EC8F8', fontSize:9, fontWeight:700,
            padding:'2px 7px', borderRadius:5, fontFamily:'var(--font-body)' }}>ADMIN</div>
        </div>
        {/* Search */}
        <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:12, padding:'8px 12px',
          display:'flex', alignItems:'center', gap:8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize:14, color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-body)' }}>Pesquisar...</span>
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto', background:SIDEBAR_BG, WebkitOverflowScrolling:'touch' }}>

        {/* Section: Grupos */}
        <div style={{ padding:'10px 16px 4px' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.28)',
            letterSpacing:'.12em', textTransform:'uppercase', fontFamily:'var(--font-body)' }}>Grupos</span>
        </div>
        <div onClick={() => onSelect('group')}
          style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
            background: selected==='group' ? 'rgba(255,255,255,0.08)' : 'transparent',
            WebkitTapHighlightColor:'transparent', cursor:'pointer',
            borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7EC8F8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
              <span style={{ fontSize:14, fontWeight:600, color:'#fff', fontFamily:'var(--font-body)' }}>
                7 SERV - Comunicação Interna
              </span>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-body)', flexShrink:0, marginLeft:8 }}>
                16:28
              </span>
            </div>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.38)', fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>
              Mariana: Manual atualizado! 🎉
            </span>
          </div>
        </div>

        {/* Section: DMs */}
        <div style={{ padding:'12px 16px 4px' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.28)',
            letterSpacing:'.12em', textTransform:'uppercase', fontFamily:'var(--font-body)' }}>Mensagens Diretas</span>
        </div>
        {dmMeta.map(conv => {
          const u = USERS[conv.user];
          return (
            <div key={conv.id} onClick={() => onSelect(conv.id)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
                background: selected===conv.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                WebkitTapHighlightColor:'transparent', cursor:'pointer',
                borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <Avatar userId={conv.user} size={48}/>
                <div style={{ position:'absolute', bottom:1, right:1, width:11, height:11, borderRadius:'50%',
                  background:u.online?'#27AE60':'#636E72', border:`2px solid ${SIDEBAR_BG}` }}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'#fff', fontFamily:'var(--font-body)' }}>
                    {u.name}
                  </span>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-body)', flexShrink:0, marginLeft:8 }}>
                    {conv.lastTime}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.38)', fontFamily:'var(--font-body)',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                    {conv.lastMsg}
                  </span>
                  {conv.unread>0 && (
                    <div style={{ background:'#1A6FB5', color:'#fff', fontSize:10, fontWeight:700,
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

        {/* Online */}
        <div style={{ padding:'14px 16px 10px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:'.12em',
            textTransform:'uppercase', marginBottom:10, fontFamily:'var(--font-body)' }}>Online agora</div>
          <div style={{ display:'flex', gap:10 }}>
            {Object.entries(USERS).filter(([,u]) => u.online).map(([id,u]) => (
              <div key={id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                <div style={{ position:'relative' }}>
                  <Avatar userId={id} size={40}/>
                  <div style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:'50%',
                    background:'#27AE60', border:`2px solid ${SIDEBAR_BG}` }}/>
                </div>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontFamily:'var(--font-body)',
                  maxWidth:44, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
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

// ─────────── Bottom Nav (mobile) ───────────
function BottomNav({ tab, onChange, actCount }) {
  const tabs = [
    { id:'chats', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ), label:'Chats' },
    { id:'activities', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ), label:'Atividades', badge: actCount },
  ];
  return (
    <div style={{ display:'flex', background:SIDEBAR_BG, borderTop:'1px solid rgba(255,255,255,0.08)',
      paddingBottom:'max(10px, env(safe-area-inset-bottom))', flexShrink:0 }}>
      {tabs.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              padding:'10px 0 6px', background:'none', border:'none', cursor:'pointer',
              color: active ? '#7EC8F8' : 'rgba(255,255,255,0.38)',
              fontFamily:'var(--font-body)', fontSize:11, fontWeight: active ? 700 : 400,
              WebkitTapHighlightColor:'transparent', position:'relative' }}>
            {t.badge > 0 && (
              <div style={{ position:'absolute', top:6, left:'calc(50% + 8px)',
                width:16, height:16, borderRadius:'50%', background:'#E67E22',
                fontSize:9, fontWeight:700, color:'#fff', display:'flex',
                alignItems:'center', justifyContent:'center', fontFamily:'var(--font-body)' }}>
                {t.badge}
              </div>
            )}
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────── Componente principal ───────────
export default function ConexaoSetorial({ onBack }) {
  const isMobile = useIsMobile();
  const [selected,   setSelected]   = useState('group');
  const [groupMsgs,  setGroupMsgs]  = useState(INIT_GROUP);
  const [dmMsgsMap,  setDmMsgsMap]  = useState(INIT_DM_MSGS);
  const [activities, setActivities] = useState(INIT_ACTIVITIES);
  const [notifToast, setNotifToast] = useState(null);
  // Mobile navigation: 'chats' | 'chat' | 'activities'
  const [mobileTab, setMobileTab] = useState('chats');
  const nextId = useRef(200);

  const getMsgs = () => selected==='group' ? groupMsgs : (dmMsgsMap[selected]||[]);

  const openConv = (id) => { setSelected(id); setMobileTab('chat'); };

  const sendMessage = (data) => {
    const id1 = nextId.current++;
    const time = nowTime();
    if (data.type==='text' && data.text.toLowerCase().startsWith('/solicitar_bloqueio')) {
      const raw = data.text.slice('/solicitar_bloqueio'.length).trim();
      const cmdData = parseBloqueioCMD(raw);
      const cmdMsg = { id:id1, from:ME, type:'command', text:data.text, time, cmdData };
      const mentioned = cmdData.mentions.map(u=>'@'+USERS[u]?.name).join(', ')||'@Setor';
      const sysMsg = { id:nextId.current++, type:'system',
        text:`✅ Notificação enviada para ${mentioned}  •  Adicionado a Atividades Pendentes`, time };
      setGroupMsgs(p => [...p, cmdMsg, sysMsg]);
      const sector = cmdData.mentions.map(u=>USERS[u]?.sector).filter(Boolean).join(', ')||'Geral';
      setActivities(p => [{ id:nextId.current++, icon:'⏰',
        title:`Desbloquear manutenção de ${cmdData.municipio}`,
        desc:'Solicitado por Nicolas Andrade via /solicitar_bloqueio',
        when:cmdData.desbloqueio, color:'#E67E22', sector, urgent:false }, ...p]);
      setNotifToast(cmdData);
    } else {
      const msg = { id:id1, from:ME, time, ...data };
      if (selected==='group') setGroupMsgs(p => [...p, msg]);
      else setDmMsgsMap(p => ({ ...p, [selected]:[...(p[selected]||[]), msg] }));
    }
  };

  const STYLES = `
    @keyframes csSlideIn { from{opacity:0;transform:translateX(40px) scale(.96)} to{opacity:1;transform:translateX(0) scale(1)} }
    @keyframes recPulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.85)} }
  `;

  // ── MOBILE LAYOUT ──────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height:'100svh', display:'flex', flexDirection:'column', overflow:'hidden', background:T.page }}>
        <style>{STYLES}</style>

        {/* Chat view — ocupa toda a tela */}
        {mobileTab === 'chat' && (
          <>
            <MobileChatHeader selected={selected} onBack={() => setMobileTab('chats')}/>
            <MsgList msgs={getMsgs()} mobile/>
            <InputBar onSend={sendMessage} mobile/>
          </>
        )}

        {/* Chats list view */}
        {mobileTab === 'chats' && (
          <>
            <MobileConvList selected={selected} onSelect={openConv} dmMeta={DM_META} onBack={onBack}/>
            <BottomNav tab="chats" onChange={t => t==='activities' ? setMobileTab('activities') : null} actCount={activities.length}/>
          </>
        )}

        {/* Activities view */}
        {mobileTab === 'activities' && (
          <>
            <div style={{ background:SIDEBAR_BG, padding:'10px 16px 10px', flexShrink:0,
              borderBottom:'1px solid rgba(255,255,255,0.08)',
              display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer',
                color:'rgba(255,255,255,0.55)', display:'flex', alignItems:'center', gap:4,
                fontSize:13, fontFamily:'var(--font-body)', padding:0, WebkitTapHighlightColor:'transparent' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 12L6 8L10 4"/>
                </svg>
                Módulos
              </button>
            </div>
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', background:T.page }}>
              <ActivitiesPanel activities={activities} mobile/>
            </div>
            <BottomNav tab="activities" onChange={t => setMobileTab(t)} actCount={activities.length}/>
          </>
        )}

        {notifToast && <NotifToast data={notifToast} onDismiss={() => setNotifToast(null)} mobile/>}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:T.page }}>
      <style>{STYLES}</style>

      {/* Top bar */}
      <div style={{ height:48, background:T.surface, borderBottom:`1px solid ${T.border}`,
        display:'flex', alignItems:'center', paddingLeft:18, paddingRight:22, gap:12, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
            cursor:'pointer', color:T.textS, fontSize:13, fontFamily:'var(--font-body)', padding:0 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={T.textS} strokeWidth="1.8">
            <path d="M10 12L6 8L10 4"/>
          </svg>
          Módulos
        </button>
        <div style={{ width:1, height:16, background:T.border }}/>
        <span style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>Conexão Setorial</span>
        <div style={{ background:`${T.gold}18`, color:T.gold, fontSize:9, fontWeight:700,
          padding:'2px 8px', borderRadius:5, fontFamily:'var(--font-body)', letterSpacing:'.04em' }}>SOMENTE ADMIN</div>
        {notifToast && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
            fontSize:11, color:'#5DCC80', fontFamily:'var(--font-body)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#27AE60' }}/>
            Notificação enviada para {notifToast.mentions.map(u=>USERS[u]?.name).join(', ')||'Setor'}
          </div>
        )}
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        <Sidebar selected={selected} onSelect={setSelected} dmMeta={DM_META}/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden', background:T.page }}>
          {/* Desktop chat header */}
          <div style={{ padding:'10px 18px', borderBottom:`1px solid ${T.border}`, background:T.surface,
            display:'flex', alignItems:'center', gap:11, flexShrink:0 }}>
            {selected==='group' ? (
              <>
                <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7EC8F8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                  <Avatar userId={conv.user} size={38}/>
                  <div style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:'50%',
                    background:u.online?'#27AE60':'#636E72', border:`2px solid ${T.surface}` }}/>
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

      {notifToast && <NotifToast data={notifToast} onDismiss={() => setNotifToast(null)} mobile={false}/>}
    </div>
  );
}
