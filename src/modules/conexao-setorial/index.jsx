import React, { useState, useRef, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';

// ─── Dados ───────────────────────────────────────────────────────────────────

const USERS = {
  nicolas: { name:'Nicolas Andrade', initials:'NA', color:'#1A6FB5', sector:'Faturamento',         online:true  },
  ana:     { name:'Ana Clara',       initials:'AC', color:'#9B59B6', sector:'Admin',               online:true  },
  rafael:  { name:'Rafael Santos',   initials:'RS', color:'#27AE60', sector:'Suporte Contratual',  online:false },
  mariana: { name:'Mariana Lopes',   initials:'ML', color:'#E87C22', sector:'Recursos Humanos',    online:true  },
  pedro:   { name:'Pedro Oliveira',  initials:'PO', color:'#C0392B', sector:'TI',                  online:false },
};
const ME = 'nicolas';

const INIT_GROUP = [
  { id:1,  from:'ana',     type:'text',    text:'Bom dia, pessoal! 👋 Novo colaborador cadastrado: João Lima – Setor Financeiro. Acesso liberado no sistema.', time:'09:12' },
  { id:2,  from:'nicolas', type:'text',    text:'Ótimo, Ana! Vou alinhar com ele sobre os primeiros passos no sistema.', time:'09:15' },
  { id:3,  from:'rafael',  type:'text',    text:'Precisamos atualizar o manual de boas-vindas — a versão atual está desatualizada.', time:'09:42' },
  { id:4,  from:'mariana', type:'text',    text:'Concordo! Vou separar um tempo hoje à tarde para revisar. 📄', time:'09:44' },
  { id:5,  from:'nicolas', type:'command', text:'/solicitar_bloqueio Tabuleiro do Norte @rafael amanhã às 8 horas', time:'10:55',
    cmdData:{ municipio:'Tabuleiro do Norte', mentions:['rafael'], desbloqueio:'Amanhã às 08:00' } },
  { id:6,  type:'system',  text:'✅ Notificação enviada para @Rafael Santos (Suporte Contratual)  •  Adicionado a Atividades Pendentes', time:'10:55' },
  { id:7,  from:'rafael',  type:'text',    text:'Recebi! Confirmado para amanhã às 8h. ✅', time:'11:02' },
  { id:8,  from:'pedro',   type:'file',    name:'Relatório_Backup_Jun.pdf', size:1242880, ext:'pdf', time:'14:08' },
  { id:9,  from:'pedro',   type:'text',    text:'Servidor de backup com 90% de capacidade. Segue relatório. Vou ampliar o espaço ainda hoje.', time:'14:10' },
  { id:10, from:'ana',     type:'text',    text:'Obrigada pelo aviso, Pedro! Pode prosseguir. 👍', time:'14:12' },
  { id:11, from:'mariana', type:'image',   src:null, name:'manual_preview.png', caption:'Prévia do manual revisado', time:'16:27' },
  { id:12, from:'mariana', type:'text',    text:'Terminei de revisar o manual! 🎉', time:'16:28' },
];

const INIT_DM = {
  dm_rafael: [
    { id:1, from:'nicolas', type:'text', text:'Rafael, você recebeu a notificação do bloqueio de Tabuleiro do Norte?', time:'10:56' },
    { id:2, from:'rafael',  type:'text', text:'Sim, apareceu aqui agora mesmo!', time:'10:58' },
    { id:3, from:'nicolas', type:'text', text:'Ótimo! O município solicitou até amanhã às 8h.', time:'10:59' },
    { id:4, from:'rafael',  type:'text', text:'Confirmado, vou desbloquear amanhã. ✅', time:'11:02' },
  ],
  dm_ana: [
    { id:1, from:'ana',     type:'text', text:'Nicolas, o João Lima já conseguiu logar no sistema?', time:'14:18' },
    { id:2, from:'nicolas', type:'text', text:'Sim! Acabei de confirmar com ele.', time:'14:20' },
    { id:3, from:'ana',     type:'text', text:'Perfeito, pode fechar o chamado então.', time:'14:21' },
    { id:4, from:'ana',     type:'text', text:'Obrigada pelo retorno rápido! 😊', time:'14:22' },
  ],
  dm_mariana: [
    { id:1, from:'mariana', type:'text', text:'Nicolas, terminei a revisão do manual. Pode conferir?', time:'16:28' },
    { id:2, from:'nicolas', type:'text', text:'Claro! Vou dar uma olhada.', time:'16:29' },
    { id:3, from:'mariana', type:'text', text:'Manual atualizado e revisado! ✅', time:'16:30' },
  ],
};

const INIT_DM_META = [
  { id:'dm_rafael', user:'rafael', lastMsg:'Confirmado, vou desbloquear amanhã. ✅', lastTime:'11:02', unread:0 },
  { id:'dm_ana',    user:'ana',    lastMsg:'Obrigada pelo retorno rápido! 😊',       lastTime:'14:22', unread:2 },
  { id:'dm_mariana',user:'mariana',lastMsg:'Manual atualizado e revisado! ✅',        lastTime:'16:30', unread:0 },
];

const GROUP_META = { id:'group', lastMsg:'Mariana: Manual atualizado! 🎉', lastTime:'16:28', unread:3 };

const INIT_ACTIVITIES = [
  { id:1, icon:'⏰', title:'Desbloquear manutenção de Tabuleiro do Norte', desc:'Solicitado por Nicolas Andrade via /solicitar_bloqueio', when:'Amanhã • 08:00', color:'#E67E22', sector:'Suporte Contratual', urgent:false },
  { id:2, icon:'📋', title:'Revisar manual de boas-vindas', desc:'Comprometida por Mariana Lopes no grupo', when:'Hoje', color:'#1A6FB5', sector:'RH', urgent:false },
  { id:3, icon:'🖥️', title:'Ampliar espaço do servidor backup', desc:'Pedro Oliveira — uso em 90%', when:'Hoje', color:'#C0392B', sector:'TI', urgent:true },
];

const COMMANDS = [
  { cmd:'/solicitar_bloqueio',
    desc:'Notifica o setor responsável e cria uma atividade pendente',
    params:['Cliente / Município', 'Categoria: Abastecimento, Manutenção ou Patrimônio', '@Responsável', 'Quando desbloquear'] },
  { cmd:'/aviso',
    desc:'Envia um aviso urgente para todos no grupo',
    params:['Mensagem do aviso'] },
  { cmd:'/atribuir',
    desc:'Atribui uma tarefa a um usuário específico',
    params:['@Usuário', 'Descrição da tarefa'] },
];

const EXT_ICONS = {
  pdf:{ bg:'#E74C3C',icon:'PDF' }, docx:{ bg:'#2980B9',icon:'DOC' }, doc:{ bg:'#2980B9',icon:'DOC' },
  xlsx:{ bg:'#27AE60',icon:'XLS' }, xls:{ bg:'#27AE60',icon:'XLS' }, pptx:{ bg:'#E67E22',icon:'PPT' },
  zip:{ bg:'#8E44AD',icon:'ZIP' }, mp3:{ bg:'#16A085',icon:'MP3' }, mp4:{ bg:'#2C3E50',icon:'MP4' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt     = (b) => b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB';
const fmtDur  = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const nowTime = ()  => new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Sao_Paulo'});

function parseBloqueio(raw) {
  const mentions = [];
  let m; const re = /@(\S+)/g;
  while ((m=re.exec(raw))!==null) {
    const s=m[1].toLowerCase().replace(/[,.:;!?]/g,'');
    for (const [id,u] of Object.entries(USERS)) {
      if(id.startsWith(s)||u.name.toLowerCase().replace(/\s+/g,'').startsWith(s)){if(!mentions.includes(id))mentions.push(id);break;}
    }
  }
  const municipio=(raw.split(/@/)[0]||'').replace(/^(eu\s+quero\s+bloquear\s+(manuten[cç][aã]o\s+(de\s+)?)?)/i,'').replace(/,\s*$/,'').trim()||'Não especificado';
  const tm=/(amanhã|hoje|segunda|terça|quarta|quinta|sexta)[^\n@]*(às?\s+\d{1,2}[h:]\d{0,2}|\d{1,2}\s*hora)/i.exec(raw);
  const hm=/às?\s+(\d{1,2})[h:](\d{0,2})/i.exec(raw);
  let desbloqueio='A definir';
  if(tm){desbloqueio=tm[0].trim();desbloqueio=desbloqueio[0].toUpperCase()+desbloqueio.slice(1);}
  else if(hm) desbloqueio=`Às ${hm[1]}h${hm[2]||'00'}`;
  const rawLow=raw.toLowerCase();
  let categoria=null;
  if(rawLow.includes('abastecimento'))  categoria='Abastecimento';
  else if(rawLow.includes('manut'))     categoria='Manutenção';
  else if(rawLow.includes('patrim'))    categoria='Patrimônio';
  return {municipio,mentions,desbloqueio,categoria};
}

// ─── Cores semânticas ─────────────────────────────────────────────────────────
const sbBg  = () => T.sidebarBg || T.surface;
const sbBrd = () => T.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
const sbSel = () => `${T.gold}18`;
const recvBg = () => T.dark ? `${T.text}12` : `${T.text}08`;

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ userId, size=36 }) {
  const u=USERS[userId]; if(!u) return <div style={{width:size,height:size,flexShrink:0}}/>;
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',background:u.color,flexShrink:0,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:Math.round(size*.36),fontWeight:700,color:'#fff',userSelect:'none',
      fontFamily:'var(--font-body)' }}>
      {u.initials}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function UnreadBadge({ n }) {
  return (
    <div style={{ background:T.gold,color:'#fff',fontSize:9,fontWeight:700,
      minWidth:18,height:18,borderRadius:9,padding:'0 4px',display:'flex',alignItems:'center',
      justifyContent:'center',flexShrink:0,marginLeft:6,fontFamily:'var(--font-body)' }}>{n}</div>
  );
}

// ─── Wrapper WhatsApp-style ────────────────────────────────────────────────────
function BubbleRow({ msg, showHeader, mobile, children }) {
  const isMe = msg.from===ME;
  const u = USERS[msg.from];
  const av = mobile ? 38 : 34;
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:9,
      flexDirection: isMe ? 'row-reverse' : 'row',
      marginBottom: showHeader ? 10 : 4 }}>
      {/* Avatar esquerda para recebidas */}
      {!isMe
        ? <div style={{ width:av, flexShrink:0, alignSelf:'flex-end' }}>
            {showHeader ? <Avatar userId={msg.from} size={av}/> : null}
          </div>
        : <div style={{ width:av, flexShrink:0 }}/>
      }
      <div style={{ display:'flex', flexDirection:'column',
        alignItems: isMe ? 'flex-end' : 'flex-start',
        maxWidth: mobile ? '78%' : '65%', minWidth:0 }}>
        {/* Nome + setor (só recebidas, só primeira da sequência) */}
        {!isMe && showHeader && u && (
          <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:3, paddingLeft:2 }}>
            <span style={{ fontSize:12, fontWeight:700, color:u.color, fontFamily:'var(--font-body)' }}>{u.name}</span>
            <span style={{ fontSize:10, color:T.textS, fontFamily:'var(--font-body)' }}>{u.sector}</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────
function TextBubble({ msg, showHeader, mobile }) {
  const isMe = msg.from===ME;
  return (
    <BubbleRow msg={msg} showHeader={showHeader} mobile={mobile}>
      <div style={{
        background: isMe ? T.gold : recvBg(),
        color: isMe ? '#fff' : T.text,
        border: isMe ? 'none' : `1px solid ${T.border}`,
        borderRadius: isMe ? '18px 18px 5px 18px' : '5px 18px 18px 18px',
        padding: mobile ? '10px 14px' : '9px 13px',
        fontSize: mobile ? 15 : 14, lineHeight:1.5,
        fontFamily:'var(--font-body)', wordBreak:'break-word',
        boxShadow: isMe ? `0 2px 8px ${T.gold}33` : `0 1px 3px rgba(0,0,0,0.06)`,
      }}>
        {msg.text}
        <span style={{ float:'right', marginLeft:6, marginBottom:-3, marginTop:5,
          fontSize:10, lineHeight:1, whiteSpace:'nowrap', fontFamily:'var(--font-body)',
          color: isMe ? 'rgba(255,255,255,0.65)' : T.textT }}>
          {msg.time}{isMe ? ' ✓✓' : ''}
        </span>
        <span style={{ display:'block', clear:'both', height:0 }}/>
      </div>
    </BubbleRow>
  );
}

function ImageBubble({ msg, showHeader, mobile }) {
  const isMe=msg.from===ME; const maxW=mobile?230:210;
  return (
    <BubbleRow msg={msg} showHeader={showHeader} mobile={mobile}>
      <div style={{ borderRadius: isMe?'18px 18px 5px 18px':'5px 18px 18px 18px',
        overflow:'hidden', border:`1px solid ${T.border}`, maxWidth:maxW, boxShadow:`0 1px 4px rgba(0,0,0,0.10)`,
        position:'relative' }}>
        {msg.src
          ? <img src={msg.src} alt={msg.name||'imagem'} style={{ width:'100%',display:'block',maxHeight:200,objectFit:'cover' }}/>
          : <div style={{ width:maxW,height:140,background: isMe?T.gold:recvBg(),
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8 }}>
              <span style={{ fontSize:30 }}>🖼️</span>
              <span style={{ fontSize:11,color: isMe?'rgba(255,255,255,0.7)':T.textS,fontFamily:'var(--font-body)' }}>{msg.name||'Imagem'}</span>
            </div>
        }
        {msg.caption && (
          <div style={{ padding:'6px 12px',background: isMe?`${T.gold}cc`:T.surface,
            fontSize:11,color: isMe?'rgba(255,255,255,0.85)':T.textS,fontFamily:'var(--font-body)' }}>{msg.caption}</div>
        )}
        {/* Horário sobreposto no canto inferior direito */}
        <div style={{ position:'absolute', bottom:6, right:8,
          fontSize:10, color:'rgba(255,255,255,0.88)', whiteSpace:'nowrap',
          background:'rgba(0,0,0,0.32)', padding:'2px 6px', borderRadius:6,
          fontFamily:'var(--font-body)', lineHeight:1.4 }}>
          {msg.time}{isMe ? ' ✓✓' : ''}
        </div>
      </div>
    </BubbleRow>
  );
}

function FileBubble({ msg, showHeader, mobile }) {
  const isMe=msg.from===ME;
  const info=EXT_ICONS[msg.ext?.toLowerCase()]||{bg:'#636E72',icon:'FILE'};
  return (
    <BubbleRow msg={msg} showHeader={showHeader} mobile={mobile}>
      <div style={{ background: isMe?T.gold:T.surface, border: isMe?'none':`1px solid ${T.border}`,
        borderRadius: isMe?'18px 18px 5px 18px':'5px 18px 18px 18px',
        padding:'11px 14px 9px',display:'flex',flexDirection:'column',gap:8,
        minWidth:190,maxWidth: mobile?250:230,
        boxShadow: isMe?`0 2px 8px ${T.gold}33`:`0 1px 3px rgba(0,0,0,0.06)`,cursor:'pointer' }}>
        {/* Linha principal: ícone + info + download */}
        <div style={{ display:'flex',alignItems:'center',gap:11 }}>
          <div style={{ width:42,height:42,borderRadius:11,background:info.bg,flexShrink:0,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:9,fontWeight:800,color:'#fff',letterSpacing:'.05em',fontFamily:'monospace' }}>{info.icon}</div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:12,fontWeight:600,color: isMe?'#fff':T.text,
              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontFamily:'var(--font-body)' }}>{msg.name}</div>
            <div style={{ fontSize:10,color: isMe?'rgba(255,255,255,0.6)':T.textS,marginTop:2,fontFamily:'var(--font-body)' }}>
              {fmt(msg.size||0)} · {(msg.ext||'arquivo').toUpperCase()}</div>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke={isMe?'rgba(255,255,255,0.7)':T.textS} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        {/* Horário dentro do balão */}
        <div style={{ display:'flex',justifyContent:'flex-end' }}>
          <span style={{ fontSize:10,color: isMe?'rgba(255,255,255,0.6)':T.textT,
            fontFamily:'var(--font-body)',lineHeight:1,whiteSpace:'nowrap' }}>
            {msg.time}{isMe ? ' ✓✓' : ''}
          </span>
        </div>
      </div>
    </BubbleRow>
  );
}

function AudioBubble({ msg, showHeader, mobile }) {
  const isMe=msg.from===ME;
  const [playing,setPlaying]=useState(false);
  const [progress,setProgress]=useState(0);
  const [cur,setCur]=useState(0);
  const aRef=useRef(null);
  const toggle=()=>{const a=aRef.current;if(!a)return;playing?(a.pause(),setPlaying(false)):(a.play(),setPlaying(true));};
  const onTU=()=>{const a=aRef.current;if(!a||!a.duration)return;setCur(Math.floor(a.currentTime));setProgress(a.currentTime/a.duration);};
  const onEnd=()=>{setPlaying(false);setProgress(0);setCur(0);};
  const onBar=(e)=>{const a=aRef.current;if(!a||!a.duration)return;const r=e.currentTarget.getBoundingClientRect();a.currentTime=(e.clientX-r.left)/r.width*a.duration;};
  const accent=isMe?'#fff':T.gold; const trackBg=isMe?'rgba(255,255,255,0.28)':T.border;
  const BARS=[4,7,12,8,15,6,18,10,14,5,9,16,11,7,13,8,17,6,12,9,15,7,11,5];
  return (
    <BubbleRow msg={msg} showHeader={showHeader} mobile={mobile}>
      <div style={{ background: isMe?T.gold:T.surface, border: isMe?'none':`1px solid ${T.border}`,
        borderRadius: isMe?'18px 18px 5px 18px':'5px 18px 18px 18px',
        padding:'10px 13px',display:'flex',alignItems:'center',gap:10,
        minWidth: mobile?200:185,maxWidth: mobile?260:240,
        boxShadow: isMe?`0 2px 8px ${T.gold}33`:`0 1px 3px rgba(0,0,0,0.06)` }}>
        {msg.src && <audio ref={aRef} src={msg.src} onTimeUpdate={onTU} onEnded={onEnd}/>}
        <button onClick={toggle} style={{ width:38,height:38,borderRadius:'50%',flexShrink:0,
          background: isMe?'rgba(255,255,255,0.2)':`${T.gold}15`,
          border:`1.5px solid ${isMe?'rgba(255,255,255,0.5)':T.gold}`,
          cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          WebkitTapHighlightColor:'transparent' }}>
          {playing
            ?<svg width="12" height="12" viewBox="0 0 24 24" fill={accent}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            :<svg width="12" height="12" viewBox="0 0 24 24" fill={accent}><polygon points="5 3 19 12 5 21 5 3"/></svg>}
        </button>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:1,height:24,marginBottom:5 }}>
            {BARS.map((h,i)=>(
              <div key={i} style={{ flex:1,height:`${h}px`,borderRadius:2,
                background: i/24<=progress?accent:trackBg,transition:'background .1s' }}/>
            ))}
          </div>
          <div onClick={onBar} style={{ height:3,background:trackBg,borderRadius:2,cursor:'pointer',position:'relative' }}>
            <div style={{ position:'absolute',left:0,top:0,height:'100%',background:accent,
              borderRadius:2,width:`${progress*100}%`,transition:'width .1s' }}/>
          </div>
          <div style={{ marginTop:4,fontSize:9,fontFamily:'var(--font-body)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <span style={{ color: isMe?'rgba(255,255,255,0.6)':T.textS }}>{fmtDur(cur)}</span>
            <span style={{ color: isMe?'rgba(255,255,255,0.65)':T.textT, fontSize:10, whiteSpace:'nowrap' }}>
              {msg.time}{isMe ? ' ✓✓' : ''}
            </span>
          </div>
        </div>
      </div>
    </BubbleRow>
  );
}

function CommandBubble({ msg, mobile }) {
  const av=mobile?38:34;
  return (
    <div style={{ display:'flex',alignItems:'flex-end',gap:9,flexDirection:'row-reverse',marginBottom:10 }}>
      <div style={{ width:av,flexShrink:0 }}/>
      <div style={{ maxWidth: mobile?'85%':'70%' }}>
        <div style={{ background: T.dark?'#0D1628':'#1A2B4A', border:`1px solid ${T.gold}44`,
          borderRadius:'18px 18px 5px 18px', padding:'12px 15px',
          boxShadow:`0 4px 16px ${T.gold}22`, fontFamily:'var(--font-body)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:11 }}>
            <div style={{ background:'linear-gradient(135deg,#B04800,#E67E22)',borderRadius:6,padding:'2px 8px',
              fontSize:9,fontWeight:800,color:'#fff',letterSpacing:'.06em' }}>⚡ COMANDO</div>
            <code style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>/solicitar_bloqueio</code>
          </div>
          {[
            {icon:'📍',label:'Município',  val:msg.cmdData.municipio,                                          color:'#fff'    },
            {icon:'👥',label:'Notificar',  val:msg.cmdData.mentions.map(u=>'@'+USERS[u]?.name).join(', ')||'—',color:'#5DCC80' },
            {icon:'⏰',label:'Desbloqueio',val:msg.cmdData.desbloqueio,                                        color:'#E67E22' },
          ].map(r=>(
            <div key={r.label} style={{ display:'flex',gap:10,alignItems:'flex-start',marginBottom:8 }}>
              <span style={{ fontSize:14,flexShrink:0 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize:8,color:'rgba(255,255,255,0.28)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:1 }}>{r.label}</div>
                <div style={{ fontSize:12,fontWeight:700,color:r.color }}>{r.val}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:9,borderTop:'1px solid rgba(255,255,255,0.07)',paddingTop:8,display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:'#27AE60',flexShrink:0 }}/>
            <span style={{ fontSize:10,color:'#5DCC80',fontWeight:600 }}>Notificação enviada · Atividade registrada</span>
          </div>
          {/* Mensagem automática dentro do card */}
          {(()=>{
            const mentioned=msg.cmdData.mentions.map(u=>'@'+USERS[u]?.name).join(', ')||'@Setor';
            const catLine=msg.cmdData.categoria?`\n📋 Categoria: ${msg.cmdData.categoria}`:'';
            const autoText=`Olá, prezados! 👋 Estou solicitando o bloqueio de transações com as seguintes informações:\n\n📍 Cliente: ${msg.cmdData.municipio}${catLine}\n👤 Responsável: ${mentioned}\n⏰ Desbloqueio previsto: ${msg.cmdData.desbloqueio}\n\nAguardo a confirmação do recebimento. Obrigado! 🙏`;
            return (
              <div style={{ marginTop:10,borderTop:'1px solid rgba(255,255,255,0.07)',paddingTop:10 }}>
                <div style={{ fontSize:8,color:'rgba(255,255,255,0.28)',fontWeight:700,textTransform:'uppercase',
                  letterSpacing:'.08em',marginBottom:7,display:'flex',alignItems:'center',gap:5 }}>
                  <span>💬</span><span>MENSAGEM ENVIADA AO GRUPO</span>
                </div>
                <div style={{ fontSize: mobile?12:11, color:'rgba(255,255,255,0.85)', lineHeight:1.65,
                  whiteSpace:'pre-line', background:'rgba(255,255,255,0.05)',
                  borderRadius:9, padding:'9px 11px', borderLeft:'2px solid #27AE60',
                  fontFamily:'var(--font-body)' }}>
                  {autoText}
                </div>
              </div>
            );
          })()}
        </div>
        <div style={{ fontSize:10,color:T.textT,marginTop:3,textAlign:'right',paddingRight:2,fontFamily:'var(--font-body)' }}>
          {msg.time} ✓✓
        </div>
      </div>
    </div>
  );
}

function SystemMsg({ msg }) {
  return (
    <div style={{ textAlign:'center',margin:'6px 0 10px' }}>
      <span style={{ fontSize:11,color:T.textS,background:T.surface,
        padding:'3px 14px',borderRadius:20,border:`1px solid ${T.border}`,fontFamily:'var(--font-body)' }}>{msg.text}</span>
    </div>
  );
}

// ─── MsgList ──────────────────────────────────────────────────────────────────
function MsgList({ msgs, mobile }) {
  const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[msgs]);
  return (
    <div style={{ flex:1,overflowY:'auto',padding: mobile?'14px 10px':'18px 20px',
      display:'flex',flexDirection:'column',WebkitOverflowScrolling:'touch',background:T.page }}>
      <div style={{ textAlign:'center',marginBottom:14 }}>
        <span style={{ fontSize:11,color:T.textT,background:T.surface,
          padding:'3px 14px',borderRadius:20,border:`1px solid ${T.border}`,fontFamily:'var(--font-body)' }}>Hoje</span>
      </div>
      {msgs.map((msg,idx)=>{
        if(msg.type==='system')  return <SystemMsg     key={msg.id} msg={msg}/>;
        if(msg.type==='command') return <CommandBubble key={msg.id} msg={msg} mobile={mobile}/>;
        const prev=msgs[idx-1];
        const showHeader=!prev||prev.type==='system'||prev.from!==msg.from;
        if(msg.type==='image') return <ImageBubble key={msg.id} msg={msg} showHeader={showHeader} mobile={mobile}/>;
        if(msg.type==='file')  return <FileBubble  key={msg.id} msg={msg} showHeader={showHeader} mobile={mobile}/>;
        if(msg.type==='audio') return <AudioBubble key={msg.id} msg={msg} showHeader={showHeader} mobile={mobile}/>;
        return <TextBubble key={msg.id} msg={msg} showHeader={showHeader} mobile={mobile}/>;
      })}
      <div ref={endRef}/>
    </div>
  );
}

// ─── InputBar ─────────────────────────────────────────────────────────────────
function InputBar({ onSend, mobile }) {
  const [input,setInput]=useState('');
  const [cmdMenu,setCmdMenu]=useState(false);
  const [attachOpen,setAttachOpen]=useState(false);
  const [recording,setRecording]=useState(false);
  const [recTime,setRecTime]=useState(0);
  const inputRef=useRef(null); const imgRef=useRef(null);
  const fileRef=useRef(null); const audioFRef=useRef(null);
  const mrRef=useRef(null); const timerRef=useRef(null);

  const onChange=(e)=>{const v=e.target.value;setInput(v);setCmdMenu(v==='/'||(v.startsWith('/')&&!v.includes(' ')));};
  const onKey=(e)=>{
    if(e.key==='Tab'){
      if(cmdMenu&&filtCmds.length>0){e.preventDefault();pickCmd(filtCmds[0].cmd);}
      return;
    }
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}
    if(e.key==='Escape'){setCmdMenu(false);setAttachOpen(false);}
  };
  const doSend=()=>{const t=input.trim();if(!t)return;onSend({type:'text',text:t});setInput('');setCmdMenu(false);setAttachOpen(false);inputRef.current?.focus();};
  const pickCmd=(cmd)=>{setInput(cmd+' ');setCmdMenu(false);inputRef.current?.focus();};
  const onImg=(e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>onSend({type:'image',src:ev.target.result,name:f.name,size:f.size});r.readAsDataURL(f);e.target.value='';setAttachOpen(false);};
  const onFile=(e)=>{const f=e.target.files?.[0];if(!f)return;onSend({type:'file',name:f.name,size:f.size,ext:f.name.split('.').pop()?.toLowerCase()||''});e.target.value='';setAttachOpen(false);};
  const onAFile=(e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>onSend({type:'audio',src:ev.target.result,name:f.name,size:f.size});r.readAsDataURL(f);e.target.value='';setAttachOpen(false);};

  const startRec=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const chunks=[];const mr=new MediaRecorder(stream);
      mr.ondataavailable=(e)=>{if(e.data.size)chunks.push(e.data);};
      mr.onstop=()=>{onSend({type:'audio',src:URL.createObjectURL(new Blob(chunks,{type:'audio/webm'})),duration:recTime});stream.getTracks().forEach(t=>t.stop());};
      mr.start();mrRef.current=mr;setRecording(true);setRecTime(0);
      timerRef.current=setInterval(()=>setRecTime(t=>t+1),1000);setAttachOpen(false);
    }catch{alert('Permissão de microfone negada.');}
  };
  const stopRec=()=>{mrRef.current?.stop();clearInterval(timerRef.current);setRecording(false);};
  const cancelRec=()=>{if(mrRef.current){mrRef.current.ondataavailable=null;mrRef.current.onstop=null;mrRef.current.stop();}clearInterval(timerRef.current);setRecording(false);setRecTime(0);};

  const hasText=input.trim().length>0;
  const typedCmd=input.startsWith('/')?input.split(' ')[0].toLowerCase():'';
  const filtCmds=COMMANDS.filter(c=>c.cmd.startsWith(typedCmd));
  const activeCmd=COMMANDS.find(c=>input.startsWith(c.cmd+' '));
  const safeBot=mobile?'max(12px, env(safe-area-inset-bottom))':'12px';
  const circBtn=(active)=>({
    width: mobile?44:38,height: mobile?44:38,borderRadius:'50%',flexShrink:0,
    background: active?`${T.gold}18`:'transparent',
    border:`1.5px solid ${active?T.gold:T.border}`,
    cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
    color: active?T.gold:T.textS,WebkitTapHighlightColor:'transparent',transition:'all .15s',
  });

  return (
    <div style={{ flexShrink:0,background:T.surface,borderTop:`1px solid ${T.border}`,
      paddingTop:10,paddingLeft:12,paddingRight:12,paddingBottom:safeBot }}>
      <input ref={imgRef}    type="file" accept="image/*"    style={{display:'none'}} onChange={onImg}/>
      <input ref={fileRef}   type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.zip,.txt" style={{display:'none'}} onChange={onFile}/>
      <input ref={audioFRef} type="file" accept="audio/*"    style={{display:'none'}} onChange={onAFile}/>

      {recording?(
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:10,height:10,borderRadius:'50%',background:'#E74C3C',flexShrink:0,animation:'recPulse 1s ease-in-out infinite' }}/>
          <span style={{ fontSize:14,fontWeight:700,color:'#E74C3C',fontFamily:'var(--font-body)' }}>Gravando</span>
          <span style={{ fontSize:14,fontFamily:'monospace',color:T.text,minWidth:40 }}>{fmtDur(recTime)}</span>
          <div style={{ flex:1 }}/>
          <button onClick={cancelRec} style={{ ...circBtn(false),borderRadius:22,padding:'0 16px',width:'auto',height:38,fontSize:13 }}>Cancelar</button>
          <button onClick={stopRec} style={{ height:38,padding:'0 18px',borderRadius:22,border:'none',
            background:T.gold,cursor:'pointer',fontSize:13,fontWeight:700,color:'#fff',
            fontFamily:'var(--font-body)',WebkitTapHighlightColor:'transparent' }}>⏹ Enviar</button>
        </div>
      ):(
        <div style={{ position:'relative' }}>
          {/* Attach mobile */}
          {attachOpen&&mobile&&(
            <div style={{ position:'fixed',inset:0,zIndex:100 }} onClick={()=>setAttachOpen(false)}>
              <div onClick={e=>e.stopPropagation()} style={{ position:'absolute',bottom:0,left:0,right:0,
                background:T.surface,borderRadius:'22px 22px 0 0',
                paddingBottom:'max(24px, env(safe-area-inset-bottom))',
                boxShadow:`0 -8px 40px rgba(0,0,0,${T.dark?'0.4':'0.12'})`,border:`1px solid ${T.border}` }}>
                <div style={{ width:40,height:4,borderRadius:2,background:T.border,margin:'12px auto 14px' }}/>
                {[
                  {emoji:'📷',label:'Foto / Imagem',       fn:()=>imgRef.current?.click()},
                  {emoji:'📎',label:'Arquivo / Documento', fn:()=>fileRef.current?.click()},
                  {emoji:'🎵',label:'Arquivo de Áudio',    fn:()=>audioFRef.current?.click()},
                  {emoji:'🎙️',label:'Gravar Áudio',        fn:startRec},
                ].map((item,i)=>(
                  <div key={i} onClick={()=>{item.fn();setAttachOpen(false);}}
                    style={{ display:'flex',alignItems:'center',gap:14,padding:'13px 16px',
                      borderBottom:i<3?`1px solid ${T.border}`:'none',
                      cursor:'pointer',WebkitTapHighlightColor:'transparent' }}>
                    <div style={{ width:48,height:48,borderRadius:14,background:T.page,border:`1px solid ${T.border}`,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0 }}>{item.emoji}</div>
                    <span style={{ fontSize:16,color:T.text,fontFamily:'var(--font-body)',fontWeight:500 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Attach desktop */}
          {attachOpen&&!mobile&&(
            <div style={{ position:'absolute',bottom:'calc(100% + 8px)',left:0,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,
              overflow:'hidden',boxShadow:`0 -8px 28px rgba(0,0,0,${T.dark?'0.3':'0.1'})`,zIndex:10,minWidth:210 }}>
              {[
                {label:'📷  Foto / Imagem',       fn:()=>imgRef.current?.click()},
                {label:'📎  Arquivo / Documento', fn:()=>fileRef.current?.click()},
                {label:'🎵  Arquivo de Áudio',    fn:()=>audioFRef.current?.click()},
                {label:'🎙️  Gravar Áudio',        fn:startRec},
              ].map((item,i)=>(
                <div key={i} onClick={()=>{item.fn();setAttachOpen(false);}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.page}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  style={{ padding:'11px 16px',cursor:'pointer',fontSize:13,color:T.text,
                    fontFamily:'var(--font-body)',borderBottom:i<3?`1px solid ${T.border}`:'none',transition:'background .12s' }}>
                  {item.label}
                </div>
              ))}
            </div>
          )}
          {/* Dropdown: seleção de comando (enquanto digita) */}
          {cmdMenu&&filtCmds.length>0&&(
            <div style={{ position:'absolute',bottom:'calc(100% + 8px)',left: mobile?0:44,right: mobile?0:48,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,
              overflow:'hidden',boxShadow:`0 -8px 28px rgba(0,0,0,${T.dark?'0.35':'0.1'})`,zIndex:10 }}>
              <div style={{ padding:'8px 14px 5px',fontSize:9,fontWeight:700,color:T.textT,
                textTransform:'uppercase',letterSpacing:'.1em',fontFamily:'var(--font-body)',
                display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <span>Comandos disponíveis</span>
                <span style={{ background:T.page,border:`1px solid ${T.border}`,borderRadius:4,
                  padding:'1px 6px',fontSize:9,fontFamily:'monospace',color:T.textS }}>Tab ⇥ para completar</span>
              </div>
              {filtCmds.map(c=>(
                <div key={c.cmd} onClick={()=>pickCmd(c.cmd)}
                  style={{ padding:'10px 14px',cursor:'pointer',
                    borderTop:`1px solid ${T.border}`,WebkitTapHighlightColor:'transparent' }}>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:5,alignItems:'center',marginBottom:4 }}>
                    <code style={{ fontSize:12,color:T.gold,fontFamily:'monospace',fontWeight:700,flexShrink:0 }}>{c.cmd}</code>
                    {c.params.map((p,i)=>(
                      <span key={i} style={{ fontSize:10,color:'#E67E22',background:'#E67E2214',
                        border:'1px solid #E67E2228',padding:'1px 6px',borderRadius:4,fontFamily:'monospace' }}>
                        [{p}]
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize:11,color:T.textS,fontFamily:'var(--font-body)' }}>{c.desc}</div>
                </div>
              ))}
            </div>
          )}
          {/* Card de uso: aparece após digitar o comando completo + espaço */}
          {activeCmd&&!cmdMenu&&(
            <div style={{ position:'absolute',bottom:'calc(100% + 8px)',left: mobile?0:44,right: mobile?0:48,
              background: T.dark?'#0C1628':'#EFF6FF',
              border:`1.5px solid ${T.gold}55`,borderRadius:14,padding:'13px 16px',
              boxShadow:`0 -8px 24px rgba(0,0,0,${T.dark?'0.28':'0.08'})`,
              zIndex:10,fontFamily:'var(--font-body)' }}>
              <div style={{ fontSize:9,fontWeight:700,color:T.gold,textTransform:'uppercase',
                letterSpacing:'.1em',marginBottom:9,display:'flex',alignItems:'center',gap:6 }}>
                <span>⚡</span><span>Como usar</span>
              </div>
              <div style={{ display:'flex',flexWrap:'wrap',gap:6,alignItems:'center',marginBottom:9 }}>
                <code style={{ fontSize:12,color:T.gold,fontFamily:'monospace',fontWeight:800 }}>{activeCmd.cmd}</code>
                {activeCmd.params.map((p,i)=>(
                  <span key={i} style={{ fontSize:mobile?11:10,color:'#C0500A',background:'#E67E2215',
                    border:'1px solid #E67E2230',padding:'2px 8px',borderRadius:5,fontFamily:'monospace',lineHeight:1.6 }}>
                    [{p}]
                  </span>
                ))}
              </div>
              <div style={{ fontSize:11,color:T.textS,lineHeight:1.5 }}>{activeCmd.desc}</div>
              <div style={{ marginTop:9,paddingTop:8,borderTop:`1px solid ${T.border}`,
                fontSize:10,color:T.textT,display:'flex',alignItems:'center',gap:5 }}>
                <kbd style={{ background:T.page,border:`1px solid ${T.border}`,borderRadius:4,
                  padding:'1px 6px',fontSize:9,fontFamily:'monospace' }}>Enter</kbd>
                <span>para enviar a solicitação</span>
              </div>
            </div>
          )}
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <button onClick={()=>{setAttachOpen(o=>!o);setCmdMenu(false);}} style={circBtn(attachOpen)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <input ref={inputRef} value={input} onChange={onChange} onKeyDown={onKey}
              placeholder={mobile?'Mensagem...':'Mensagem ou / para comandos...'}
              style={{ flex:1,background:T.page,borderRadius:24,
                border:`1.5px solid ${input.startsWith('/solicitar_bloqueio')?T.gold+'AA':T.border}`,
                padding: mobile?'11px 16px':'9px 15px',
                fontSize: mobile?16:14,color:T.text,fontFamily:'var(--font-body)',
                outline:'none',transition:'border-color .15s' }}
            />
            {!hasText
              ?<button onClick={startRec} style={circBtn(false)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                    <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
              :<button onClick={doSend} style={{ ...circBtn(true),background:T.gold,borderColor:'transparent',color:'#fff' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal: Colegas Online ─────────────────────────────────────────────────────
function OnlineModal({ onClose }) {
  const [search, setSearch] = useState('');
  const all = Object.entries(USERS);
  const filtered = search.trim()===''
    ? all
    : all.filter(([,u]) => {
        const q=search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.sector.toLowerCase().includes(q);
      });
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:2000,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.surface,borderRadius:18,width:400,maxWidth:'92vw',
        boxShadow:`0 24px 64px rgba(0,0,0,${T.dark?'0.5':'0.2'})`,border:`1px solid ${T.border}`,overflow:'hidden',
        display:'flex',flexDirection:'column',maxHeight:'80vh' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
          <div style={{ width:32,height:32,borderRadius:9,background:`${T.gold}18`,border:`1px solid ${T.gold}44`,
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>👥</div>
          <span style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:'var(--font-body)',flex:1 }}>Colegas</span>
          <button onClick={onClose} style={{ background:'none',border:'none',color:T.textS,
            cursor:'pointer',fontSize:22,lineHeight:1,padding:'0 4px',WebkitTapHighlightColor:'transparent' }}>×</button>
        </div>
        {/* Barra de pesquisa */}
        <div style={{ padding:'10px 16px',borderBottom:`1px solid ${T.border}`,flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:9,background:T.page,
            borderRadius:12,padding:'9px 13px',border:`1px solid ${T.border}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou setor..."
              autoFocus
              style={{ flex:1,background:'transparent',border:'none',outline:'none',
                fontSize:14,color:T.text,fontFamily:'var(--font-body)' }}
            />
            {search && (
              <button onClick={()=>setSearch('')} style={{ background:'none',border:'none',color:T.textT,cursor:'pointer',fontSize:16,lineHeight:1,padding:0 }}>×</button>
            )}
          </div>
        </div>
        {/* Lista */}
        <div style={{ overflowY:'auto',WebkitOverflowScrolling:'touch' }}>
          {filtered.length===0 && (
            <div style={{ padding:'32px 20px',textAlign:'center',color:T.textT,fontSize:13,fontFamily:'var(--font-body)' }}>
              Nenhum colega encontrado
            </div>
          )}
          {filtered.map(([id,u])=>(
            <div key={id} style={{ display:'flex',alignItems:'center',gap:13,padding:'11px 20px',
              borderBottom:`1px solid ${T.border}` }}>
              <div style={{ position:'relative',flexShrink:0 }}>
                <Avatar userId={id} size={44}/>
                <div style={{ position:'absolute',bottom:1,right:1,width:11,height:11,borderRadius:'50%',
                  background:u.online?'#27AE60':'#A0A0A8',border:`2px solid ${T.surface}` }}/>
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:'var(--font-body)' }}>{u.name}</div>
                <div style={{ fontSize:11,color:T.textS,fontFamily:'var(--font-body)',marginTop:1 }}>Setor de {u.sector}</div>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:5,flexShrink:0 }}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:u.online?'#27AE60':'#A0A0A8' }}/>
                <span style={{ fontSize:11,fontWeight:600,color:u.online?'#27AE60':T.textS,fontFamily:'var(--font-body)' }}>
                  {u.online?'Online':'Offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar (desktop) ────────────────────────────────────────────────────────
function Sidebar({ selected, onSelect, dmMeta, convTab, setConvTab, setShowOnlineModal }) {
  const bg=sbBg(),brd=sbBrd(),sel=sbSel();
  const onlineUsers=Object.entries(USERS).filter(([,u])=>u.online);
  const allConvs=[{...GROUP_META,type:'group'},...dmMeta.map(d=>({...d,type:'dm'}))];
  const convs=convTab==='unread'?allConvs.filter(c=>c.unread>0):allConvs;
  const unreadCount=allConvs.filter(c=>c.unread>0).length;

  const rowStyle=(id)=>({
    display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,
    background: selected===id?sel:'transparent',
    cursor:'pointer',transition:'background .12s',marginBottom:2,
    WebkitTapHighlightColor:'transparent',
  });

  return (
    <div style={{ width:272,flexShrink:0,background:bg,borderRight:`1px solid ${brd}`,
      display:'flex',flexDirection:'column',overflow:'hidden' }}>

      <div style={{ padding:'13px 14px 10px',borderBottom:`1px solid ${brd}`,flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:10,background:`${T.gold}18`,border:`1px solid ${T.gold}44`,
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16 }}>💬</div>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:'var(--font-body)',lineHeight:1.2 }}>Conexão Setorial</div>
            <div style={{ fontSize:9,color:T.textT,fontFamily:'var(--font-body)',marginTop:1 }}>Admin</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex',padding:'8px 12px 6px',gap:6,flexShrink:0 }}>
        {[{id:'all',label:'Todas'},{id:'unread',label:`Não lidas${convTab!=='unread'&&unreadCount>0?` (${unreadCount})`:''}`}].map(tab=>(
          <button key={tab.id} onClick={()=>setConvTab(tab.id)}
            style={{ flex:1,padding:'6px 0',borderRadius:8,border:'none',cursor:'pointer',
              background: convTab===tab.id?T.gold:T.page,
              color: convTab===tab.id?'#fff':T.textS,
              fontSize:11,fontWeight:700,fontFamily:'var(--font-body)',
              transition:'all .15s',WebkitTapHighlightColor:'transparent' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding:'0 12px 8px',flexShrink:0 }}>
        <div style={{ background:T.page,borderRadius:10,padding:'7px 11px',
          display:'flex',alignItems:'center',gap:7,border:`1px solid ${T.border}` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize:12,color:T.textT,fontFamily:'var(--font-body)' }}>Pesquisar...</span>
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex:1,overflowY:'auto',padding:'0 12px',minHeight:0 }}>
        {convs.length===0&&(
          <div style={{ textAlign:'center',padding:'24px 0',color:T.textT,fontSize:12,fontFamily:'var(--font-body)' }}>
            Nenhuma mensagem não lida
          </div>
        )}
        {convs.map(conv=>{
          if(conv.type==='group') return (
            <div key="group" onClick={()=>onSelect('group')} style={rowStyle('group')}>
              <div style={{ width:38,height:38,borderRadius:11,background:`${T.gold}15`,border:`1px solid ${T.gold}33`,
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <span style={{ fontSize:12,fontWeight:600,color:T.text,fontFamily:'var(--font-body)',
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:135 }}>7 SERV - Comunicação Interna</span>
                  <span style={{ fontSize:10,color:T.textT,fontFamily:'var(--font-body)',flexShrink:0,marginLeft:4 }}>{conv.lastTime}</span>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2 }}>
                  <span style={{ fontSize:11,color:T.textS,fontFamily:'var(--font-body)',
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1 }}>{conv.lastMsg}</span>
                  {conv.unread>0&&<UnreadBadge n={conv.unread}/>}
                </div>
              </div>
            </div>
          );
          const u=USERS[conv.user];
          return (
            <div key={conv.id} onClick={()=>onSelect(conv.id)} style={rowStyle(conv.id)}>
              <div style={{ position:'relative',flexShrink:0 }}>
                <Avatar userId={conv.user} size={36}/>
                <div style={{ position:'absolute',bottom:0,right:0,width:9,height:9,borderRadius:'50%',
                  background:u.online?'#27AE60':'#A0A0A8',border:`2px solid ${bg}` }}/>
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <span style={{ fontSize:12,fontWeight:600,color:T.text,fontFamily:'var(--font-body)' }}>{u.name}</span>
                  <span style={{ fontSize:10,color:T.textT,fontFamily:'var(--font-body)',flexShrink:0,marginLeft:4 }}>{conv.lastTime}</span>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2 }}>
                  <span style={{ fontSize:11,color:T.textS,fontFamily:'var(--font-body)',
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1 }}>{conv.lastMsg}</span>
                  {conv.unread>0&&<UnreadBadge n={conv.unread}/>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Online agora */}
      <div style={{ padding:'10px 14px 14px',borderTop:`1px solid ${brd}`,flexShrink:0 }}>
        <button onClick={()=>setShowOnlineModal(true)}
          style={{ display:'flex',alignItems:'center',gap:6,marginBottom:10,background:'none',
            border:'none',cursor:'pointer',padding:0,WebkitTapHighlightColor:'transparent' }}>
          <span style={{ fontSize:9,fontWeight:700,color:T.gold,letterSpacing:'.12em',
            textTransform:'uppercase',fontFamily:'var(--font-body)' }}>Colegas Online</span>
          <div style={{ width:5,height:5,borderRadius:'50%',background:'#27AE60',flexShrink:0 }}/>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
          {onlineUsers.map(([id,u])=>(
            <div key={id} style={{ display:'flex',alignItems:'center',gap:9 }}>
              <div style={{ position:'relative',flexShrink:0 }}>
                <Avatar userId={id} size={30}/>
                <div style={{ position:'absolute',bottom:0,right:0,width:8,height:8,borderRadius:'50%',
                  background:'#27AE60',border:`2px solid ${bg}` }}/>
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:11,fontWeight:600,color:T.text,fontFamily:'var(--font-body)',
                  whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{u.name}</div>
                <div style={{ fontSize:9,color:T.textS,fontFamily:'var(--font-body)' }}>Setor de {u.sector}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ActivitiesPanel ──────────────────────────────────────────────────────────
function ActivitiesPanel({ activities, mobile }) {
  const body=(
    <div style={{ flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10,
      minHeight:0,WebkitOverflowScrolling:'touch' }}>
      {activities.map(act=>(
        <div key={act.id} style={{ background:T.surface,borderRadius:12,
          border:`1px solid ${act.urgent?act.color+'44':T.border}`,
          padding:'12px 14px',position:'relative',overflow:'hidden',flexShrink:0 }}>
          <div style={{ position:'absolute',top:0,left:0,bottom:0,width:3,background:act.color,borderRadius:'12px 0 0 12px' }}/>
          <div style={{ paddingLeft:9 }}>
            <div style={{ display:'flex',alignItems:'flex-start',gap:8,marginBottom:6 }}>
              <span style={{ fontSize:16,flexShrink:0 }}>{act.icon}</span>
              <div style={{ fontSize:12,fontWeight:700,color:T.text,lineHeight:1.3,fontFamily:'var(--font-body)' }}>{act.title}</div>
            </div>
            <div style={{ fontSize:11,color:T.textS,lineHeight:1.4,marginBottom:8,fontFamily:'var(--font-body)' }}>{act.desc}</div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{ fontSize:10,fontWeight:700,color:act.color,background:`${act.color}18`,
                padding:'2px 8px',borderRadius:6,fontFamily:'var(--font-body)' }}>{act.when}</span>
              <span style={{ fontSize:10,color:T.textT,fontFamily:'var(--font-body)' }}>{act.sector}</span>
            </div>
            {act.urgent&&(
              <div style={{ marginTop:6,display:'flex',alignItems:'center',gap:5 }}>
                <div style={{ width:5,height:5,borderRadius:'50%',background:act.color }}/>
                <span style={{ fontSize:10,color:act.color,fontWeight:700,fontFamily:'var(--font-body)' }}>Urgente</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
  if(mobile) return (
    <div style={{ display:'flex',flexDirection:'column',flex:1,minHeight:0 }}>
      <div style={{ padding:'12px 16px 10px',borderBottom:`1px solid ${T.border}`,
        display:'flex',alignItems:'center',gap:10,flexShrink:0,background:T.surface }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:'var(--font-body)',flex:1 }}>Atividades Pendentes</span>
        <div style={{ background:`${T.gold}18`,color:T.gold,fontSize:11,fontWeight:700,
          width:22,height:22,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center' }}>{activities.length}</div>
      </div>
      {body}
    </div>
  );
  return (
    <div style={{ width:260,flexShrink:0,background:T.surface,borderLeft:`1px solid ${T.border}`,
      display:'flex',flexDirection:'column',overflow:'hidden' }}>
      <div style={{ padding:'12px 16px 10px',borderBottom:`1px solid ${T.border}`,
        display:'flex',alignItems:'center',gap:9,flexShrink:0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:'var(--font-body)',flex:1 }}>Atividades Pendentes</span>
        <div style={{ background:`${T.gold}18`,color:T.gold,fontSize:10,fontWeight:700,
          minWidth:20,height:20,borderRadius:10,padding:'0 5px',display:'flex',alignItems:'center',
          justifyContent:'center',fontFamily:'var(--font-body)' }}>{activities.length}</div>
      </div>
      {body}
      <div style={{ padding:'10px 14px 12px',borderTop:`1px solid ${T.border}`,flexShrink:0 }}>
        <div style={{ fontSize:9,fontWeight:700,color:T.textT,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6,fontFamily:'var(--font-body)' }}>Comandos rápidos</div>
        {COMMANDS.map(c=>(
          <div key={c.cmd} style={{ marginBottom:5,display:'flex',alignItems:'baseline',gap:6 }}>
            <code style={{ fontSize:10,color:T.gold,fontFamily:'monospace',background:`${T.gold}12`,padding:'1px 5px',borderRadius:4,flexShrink:0 }}>{c.cmd}</code>
            <span style={{ fontSize:9,color:T.textT,fontFamily:'var(--font-body)' }}>{c.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NotifToast ───────────────────────────────────────────────────────────────
function NotifToast({ data, onDismiss, mobile }) {
  return (
    <div style={{ position:'fixed',top:mobile?'auto':20,bottom:mobile?76:'auto',
      right:mobile?12:20,left:mobile?12:'auto',zIndex:9999,
      background: T.dark?'#0F1520':T.surface,borderRadius:16,padding:'13px 15px 15px',
      boxShadow:`0 12px 40px rgba(0,0,0,${T.dark?'0.5':'0.15'}), 0 0 0 1px ${T.border}`,
      maxWidth: mobile?'100%':310,fontFamily:'var(--font-body)',
      animation:'csSlideIn .35s cubic-bezier(.16,1,.3,1)' }}>
      <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:9 }}>
        <div style={{ width:18,height:18,borderRadius:5,background:T.gold,
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,flexShrink:0 }}>🔔</div>
        <span style={{ fontSize:9,fontWeight:700,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',flex:1 }}>Conexão Setorial</span>
        <button onClick={onDismiss} style={{ background:'none',border:'none',color:T.textT,
          cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 4px',WebkitTapHighlightColor:'transparent' }}>×</button>
      </div>
      <div style={{ display:'flex',gap:11,alignItems:'flex-start' }}>
        <div style={{ width:40,height:40,borderRadius:12,background:`${T.gold}18`,border:`1px solid ${T.gold}44`,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:20 }}>⚡</div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:4,lineHeight:1.3 }}>Solicitação de Bloqueio de Manutenção</div>
          <div style={{ fontSize:11,color:T.textS,lineHeight:1.5 }}>
            <b style={{color:T.gold}}>Nicolas Andrade</b> solicitou bloqueio de <b style={{color:'#E67E22'}}>{data.municipio}</b>.
            {data.mentions.length>0&&<><br/>Responsável: <b style={{color:'#27AE60'}}>{data.mentions.map(u=>USERS[u]?.name).join(', ')}</b></>}
            <br/>Desbloqueio: <b style={{color:'#E67E22'}}>{data.desbloqueio}</b>
          </div>
        </div>
      </div>
      <div style={{ marginTop:11,display:'flex',gap:8 }}>
        <button onClick={onDismiss} style={{ flex:1,padding:'9px 0',borderRadius:10,border:'none',
          background:T.gold,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',
          fontFamily:'inherit',WebkitTapHighlightColor:'transparent' }}>Ver Atividade</button>
        <button onClick={onDismiss} style={{ flex:1,padding:'9px 0',borderRadius:10,
          border:`1px solid ${T.border}`,background:'transparent',
          color:T.textS,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
          WebkitTapHighlightColor:'transparent' }}>Fechar</button>
      </div>
    </div>
  );
}

// ─── Mobile: chat header ───────────────────────────────────────────────────────
function MobileChatHeader({ selected, onBack }) {
  const bg=sbBg(),brd=sbBrd();
  const conv=INIT_DM_META.find(c=>c.id===selected);
  const u=conv?USERS[conv.user]:null;
  return (
    <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
      background:bg,flexShrink:0,borderBottom:`1px solid ${brd}` }}>
      <button onClick={onBack} style={{ width:38,height:38,borderRadius:'50%',background:'transparent',
        border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
        color:T.gold,flexShrink:0,WebkitTapHighlightColor:'transparent' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
        </svg>
      </button>
      {selected==='group'?(
        <>
          <div style={{ width:42,height:42,borderRadius:12,background:`${T.gold}18`,border:`1px solid ${T.gold}44`,
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:'var(--font-body)' }}>7 SERV - Comunicação Interna</div>
            <div style={{ fontSize:11,color:T.textS,fontFamily:'var(--font-body)' }}>5 participantes · 3 online</div>
          </div>
        </>
      ):u&&(
        <>
          <div style={{ position:'relative',flexShrink:0 }}>
            <Avatar userId={conv.user} size={42}/>
            <div style={{ position:'absolute',bottom:1,right:1,width:11,height:11,borderRadius:'50%',
              background:u.online?'#27AE60':'#A0A0A8',border:`2px solid ${bg}` }}/>
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:'var(--font-body)' }}>{u.name}</div>
            <div style={{ fontSize:11,color:u.online?'#27AE60':T.textS,fontFamily:'var(--font-body)' }}>
              {u.online?'● Online':'○ Offline'} · {u.sector}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Mobile: lista de conversas ────────────────────────────────────────────────
function MobileConvList({ selected, onSelect, dmMeta, onBack, convTab, setConvTab, setShowOnlineModal }) {
  const bg=sbBg(),brd=sbBrd(),sel=sbSel();
  const onlineUsers=Object.entries(USERS).filter(([,u])=>u.online);
  const allConvs=[{...GROUP_META,type:'group'},...dmMeta.map(d=>({...d,type:'dm'}))];
  const convs=convTab==='unread'?allConvs.filter(c=>c.unread>0):allConvs;
  const unreadCount=allConvs.filter(c=>c.unread>0).length;

  return (
    <div style={{ display:'flex',flexDirection:'column',flex:1,minHeight:0,background:bg }}>
      <div style={{ padding:'14px 16px 10px',borderBottom:`1px solid ${brd}`,flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
          <button onClick={onBack} style={{ background:'none',border:'none',cursor:'pointer',
            color:T.textS,display:'flex',alignItems:'center',gap:4,fontSize:13,
            fontFamily:'var(--font-body)',padding:0,WebkitTapHighlightColor:'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 12L6 8L10 4"/></svg>
            Módulos
          </button>
          <span style={{ fontSize:16,fontWeight:700,color:T.text,fontFamily:'var(--font-body)',flex:1 }}>Mensagens</span>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          {[{id:'all',label:'Todas'},{id:'unread',label:`Não lidas${unreadCount>0?` (${unreadCount})`:''}`}].map(tab=>(
            <button key={tab.id} onClick={()=>setConvTab(tab.id)}
              style={{ flex:1,padding:'8px 0',borderRadius:10,border:'none',cursor:'pointer',
                background: convTab===tab.id?T.gold:T.page,
                color: convTab===tab.id?'#fff':T.textS,
                fontSize:13,fontWeight:700,fontFamily:'var(--font-body)',
                WebkitTapHighlightColor:'transparent',transition:'all .15s' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'8px 14px 4px',flexShrink:0 }}>
        <div style={{ background:T.page,borderRadius:12,padding:'9px 13px',border:`1px solid ${T.border}`,
          display:'flex',alignItems:'center',gap:8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize:14,color:T.textT,fontFamily:'var(--font-body)' }}>Pesquisar...</span>
        </div>
      </div>

      <div style={{ flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch' }}>
        {convs.length===0&&(
          <div style={{ textAlign:'center',padding:'40px 20px',color:T.textT,fontSize:14,fontFamily:'var(--font-body)' }}>
            Nenhuma mensagem não lida 🎉
          </div>
        )}
        {convs.map(conv=>{
          if(conv.type==='group') return (
            <div key="group" onClick={()=>onSelect('group')}
              style={{ display:'flex',alignItems:'center',gap:13,padding:'12px 16px',
                background: selected==='group'?sel:'transparent',
                cursor:'pointer',WebkitTapHighlightColor:'transparent',borderBottom:`1px solid ${brd}` }}>
              <div style={{ width:52,height:52,borderRadius:15,background:`${T.gold}15`,border:`1px solid ${T.gold}33`,
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3 }}>
                  <span style={{ fontSize:15,fontWeight:600,color:T.text,fontFamily:'var(--font-body)' }}>7 SERV - Comunicação Interna</span>
                  <span style={{ fontSize:11,color:T.textT,fontFamily:'var(--font-body)',flexShrink:0,marginLeft:8 }}>{conv.lastTime}</span>
                </div>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <span style={{ fontSize:13,color:T.textS,fontFamily:'var(--font-body)',
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1 }}>{conv.lastMsg}</span>
                  {conv.unread>0&&<UnreadBadge n={conv.unread}/>}
                </div>
              </div>
            </div>
          );
          const u=USERS[conv.user];
          return (
            <div key={conv.id} onClick={()=>onSelect(conv.id)}
              style={{ display:'flex',alignItems:'center',gap:13,padding:'12px 16px',
                background: selected===conv.id?sel:'transparent',
                cursor:'pointer',WebkitTapHighlightColor:'transparent',borderBottom:`1px solid ${brd}` }}>
              <div style={{ position:'relative',flexShrink:0 }}>
                <Avatar userId={conv.user} size={52}/>
                <div style={{ position:'absolute',bottom:1,right:1,width:13,height:13,borderRadius:'50%',
                  background:u.online?'#27AE60':'#A0A0A8',border:`2.5px solid ${bg}` }}/>
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3 }}>
                  <span style={{ fontSize:15,fontWeight:600,color:T.text,fontFamily:'var(--font-body)' }}>{u.name}</span>
                  <span style={{ fontSize:11,color:T.textT,fontFamily:'var(--font-body)',flexShrink:0,marginLeft:8 }}>{conv.lastTime}</span>
                </div>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <span style={{ fontSize:13,color:T.textS,fontFamily:'var(--font-body)',
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1 }}>{conv.lastMsg}</span>
                  {conv.unread>0&&<UnreadBadge n={conv.unread}/>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Online agora (mobile) */}
        <div style={{ padding:'16px 16px 20px' }}>
          <button onClick={()=>setShowOnlineModal(true)}
            style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12,background:'none',
              border:'none',cursor:'pointer',padding:0,WebkitTapHighlightColor:'transparent' }}>
            <span style={{ fontSize:11,fontWeight:700,color:T.gold,letterSpacing:'.1em',
              textTransform:'uppercase',fontFamily:'var(--font-body)' }}>Colegas Online</span>
            <div style={{ width:6,height:6,borderRadius:'50%',background:'#27AE60' }}/>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {onlineUsers.map(([id,u])=>(
              <div key={id} style={{ display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ position:'relative',flexShrink:0 }}>
                  <Avatar userId={id} size={40}/>
                  <div style={{ position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:'50%',
                    background:'#27AE60',border:`2px solid ${bg}` }}/>
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:T.text,fontFamily:'var(--font-body)' }}>{u.name}</div>
                  <div style={{ fontSize:11,color:T.textS,fontFamily:'var(--font-body)' }}>Setor de {u.sector}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
function BottomNav({ tab, onChange, actCount }) {
  const bg=sbBg(),brd=sbBrd();
  const tabs=[
    {id:'chats',label:'Chats',icon:(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    )},
    {id:'activities',label:'Atividades',badge:actCount,icon:(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
  ];
  return (
    <div style={{ display:'flex',background:bg,borderTop:`1px solid ${brd}`,
      paddingBottom:'max(10px, env(safe-area-inset-bottom))',flexShrink:0 }}>
      {tabs.map(t=>{
        const active=tab===t.id;
        return (
          <button key={t.id} onClick={()=>onChange(t.id)}
            style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,
              padding:'10px 0 6px',background:'none',border:'none',cursor:'pointer',
              color: active?T.gold:T.textT,fontFamily:'var(--font-body)',
              fontSize:11,fontWeight: active?700:400,
              WebkitTapHighlightColor:'transparent',position:'relative' }}>
            {t.badge>0&&(
              <div style={{ position:'absolute',top:6,left:'calc(50% + 8px)',
                width:16,height:16,borderRadius:'50%',background:'#E67E22',
                fontSize:9,fontWeight:700,color:'#fff',display:'flex',
                alignItems:'center',justifyContent:'center' }}>{t.badge}</div>
            )}
            {t.icon}{t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function ConexaoSetorial({ onBack }) {
  const isMobile=useIsMobile();
  const [selected,        setSelected]        = useState('group');
  const [groupMsgs,       setGroupMsgs]       = useState(INIT_GROUP);
  const [dmMsgsMap,       setDmMsgsMap]       = useState(INIT_DM);
  const [dmMeta,          setDmMeta]          = useState(INIT_DM_META);
  const [activities,      setActivities]      = useState(INIT_ACTIVITIES);
  const [notifToast,      setNotifToast]      = useState(null);
  const [mobileTab,       setMobileTab]       = useState('chats');
  const [convTab,         setConvTab]         = useState('all');
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const nextId=useRef(300);

  const getMsgs=()=>selected==='group'?groupMsgs:(dmMsgsMap[selected]||[]);

  const openConv=(id)=>{
    setSelected(id); setMobileTab('chat');
    if(id!=='group') setDmMeta(prev=>prev.map(c=>c.id===id?{...c,unread:0}:c));
  };

  const sendMessage=(data)=>{
    const time=nowTime(); const id1=nextId.current++;
    if(data.type==='text'&&data.text.toLowerCase().startsWith('/solicitar_bloqueio')){
      const raw=data.text.slice('/solicitar_bloqueio'.length).trim();
      const cmdData=parseBloqueio(raw);
      const mentioned=cmdData.mentions.map(u=>'@'+USERS[u]?.name).join(', ')||'@Setor';
      setGroupMsgs(p=>[...p,
        {id:id1,from:ME,type:'command',text:data.text,time,cmdData},
        {id:nextId.current++,type:'system',text:`✅ Notificação enviada para ${mentioned}  •  Adicionado a Atividades Pendentes`,time},
      ]);
      setActivities(p=>[{id:nextId.current++,icon:'⏰',
        title:`Desbloquear manutenção de ${cmdData.municipio}`,
        desc:'Solicitado por Nicolas Andrade via /solicitar_bloqueio',
        when:cmdData.desbloqueio,color:'#E67E22',
        sector:cmdData.mentions.map(u=>USERS[u]?.sector).filter(Boolean).join(', ')||'Geral',urgent:false},...p]);
      setNotifToast(cmdData);
    } else {
      const msg={id:id1,from:ME,time,...data};
      if(selected==='group') setGroupMsgs(p=>[...p,msg]);
      else setDmMsgsMap(p=>({...p,[selected]:[...(p[selected]||[]),msg]}));
    }
  };

  const CSS=`
    @keyframes csSlideIn{from{opacity:0;transform:translateX(32px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes recPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.82)}}
  `;

  if(isMobile) return (
    <div style={{ height:'100svh',display:'flex',flexDirection:'column',overflow:'hidden',background:T.page }}>
      <style>{CSS}</style>
      {mobileTab==='chat'&&<>
        <MobileChatHeader selected={selected} onBack={()=>setMobileTab('chats')}/>
        <MsgList msgs={getMsgs()} mobile/>
        <InputBar onSend={sendMessage} mobile/>
      </>}
      {mobileTab==='chats'&&<>
        <MobileConvList selected={selected} onSelect={openConv} dmMeta={dmMeta}
          onBack={onBack} convTab={convTab} setConvTab={setConvTab}
          setShowOnlineModal={setShowOnlineModal}/>
        <BottomNav tab="chats" onChange={t=>t==='activities'&&setMobileTab('activities')} actCount={activities.length}/>
      </>}
      {mobileTab==='activities'&&<>
        <div style={{ background:sbBg(),padding:'10px 16px',flexShrink:0,borderBottom:`1px solid ${sbBrd()}`,
          display:'flex',alignItems:'center',gap:10 }}>
          <button onClick={onBack} style={{ background:'none',border:'none',cursor:'pointer',
            color:T.textS,display:'flex',alignItems:'center',gap:4,fontSize:13,
            fontFamily:'var(--font-body)',padding:0,WebkitTapHighlightColor:'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 12L6 8L10 4"/></svg>
            Módulos
          </button>
        </div>
        <div style={{ flex:1,overflow:'hidden',display:'flex',flexDirection:'column',background:T.page }}>
          <ActivitiesPanel activities={activities} mobile/>
        </div>
        <BottomNav tab="activities" onChange={t=>setMobileTab(t)} actCount={activities.length}/>
      </>}
      {notifToast&&<NotifToast data={notifToast} onDismiss={()=>setNotifToast(null)} mobile/>}
      {showOnlineModal&&<OnlineModal onClose={()=>setShowOnlineModal(false)}/>}
    </div>
  );

  return (
    <div style={{ height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden',background:T.page }}>
      <style>{CSS}</style>
      <div style={{ height:50,background:T.surface,borderBottom:`1px solid ${T.border}`,
        display:'flex',alignItems:'center',paddingLeft:18,paddingRight:22,gap:12,flexShrink:0 }}>
        <button onClick={onBack} style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'none',
          cursor:'pointer',color:T.textS,fontSize:13,fontFamily:'var(--font-body)',padding:0 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={T.textS} strokeWidth="1.8"><path d="M10 12L6 8L10 4"/></svg>
          Módulos
        </button>
        <div style={{ width:1,height:16,background:T.border }}/>
        <span style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:'var(--font-body)' }}>Conexão Setorial</span>
        <div style={{ background:`${T.gold}12`,color:T.gold,fontSize:9,fontWeight:700,
          padding:'2px 8px',borderRadius:5,fontFamily:'var(--font-body)',letterSpacing:'.04em' }}>SOMENTE ADMIN</div>
      </div>

      <div style={{ flex:1,display:'flex',overflow:'hidden',minHeight:0 }}>
        <Sidebar selected={selected} onSelect={setSelected} dmMeta={dmMeta}
          convTab={convTab} setConvTab={setConvTab} setShowOnlineModal={setShowOnlineModal}/>

        <div style={{ flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden' }}>
          <div style={{ padding:'11px 18px',borderBottom:`1px solid ${T.border}`,background:T.surface,
            display:'flex',alignItems:'center',gap:12,flexShrink:0 }}>
            {selected==='group'?(
              <>
                <div style={{ width:40,height:40,borderRadius:12,background:`${T.gold}15`,border:`1px solid ${T.gold}33`,
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:'var(--font-body)' }}>7 SERV - Comunicação Interna</div>
                  <div style={{ fontSize:11,color:T.textS,fontFamily:'var(--font-body)' }}>5 participantes · 3 online agora</div>
                </div>
              </>
            ):(()=>{
              const conv=dmMeta.find(c=>c.id===selected);
              const u=conv?USERS[conv.user]:null;
              if(!u) return null;
              return (
                <>
                  <div style={{ position:'relative' }}>
                    <Avatar userId={conv.user} size={40}/>
                    <div style={{ position:'absolute',bottom:0,right:0,width:11,height:11,borderRadius:'50%',
                      background:u.online?'#27AE60':'#A0A0A8',border:`2px solid ${T.surface}` }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:'var(--font-body)' }}>{u.name}</div>
                    <div style={{ fontSize:11,color:u.online?'#27AE60':T.textS,fontFamily:'var(--font-body)' }}>
                      {u.online?'● Online':'○ Offline'} · {u.sector}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <MsgList msgs={getMsgs()} mobile={false}/>
          <InputBar onSend={sendMessage} mobile={false}/>
        </div>

        <ActivitiesPanel activities={activities} mobile={false}/>
      </div>

      {notifToast&&<NotifToast data={notifToast} onDismiss={()=>setNotifToast(null)} mobile={false}/>}
      {showOnlineModal&&<OnlineModal onClose={()=>setShowOnlineModal(false)}/>}
    </div>
  );
}
