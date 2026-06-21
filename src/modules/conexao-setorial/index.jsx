import React, { useState, useRef, useEffect } from 'react';
import { T } from '../../contexts/theme';

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
  { id:8,  from:'pedro',   type:'text',    text:'Pessoal, o servidor de backup está com 90% de capacidade. Vou ampliar o espaço ainda hoje.', time:'14:10' },
  { id:9,  from:'ana',     type:'text',    text:'Obrigada pelo aviso, Pedro! Pode prosseguir. 👍', time:'14:12' },
  { id:10, from:'mariana', type:'text',    text:'Terminei de revisar o manual de boas-vindas — ficou muito mais completo! 🎉', time:'16:28' },
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

// ─────────── Parse /solicitar_bloqueio ───────────
function parseBloqueioCMD(raw) {
  const mentionedIds = [];
  const mentionRe = /@(\S+)/g;
  let m;
  while ((m = mentionRe.exec(raw)) !== null) {
    const slug = m[1].toLowerCase().replace(/[,.:;!?]/g, '');
    for (const [id, u] of Object.entries(USERS)) {
      if (id.startsWith(slug) ||
          u.name.toLowerCase().replace(/\s+/g,'').startsWith(slug) ||
          u.sector.toLowerCase().replace(/\s+/g,'').includes(slug)) {
        if (!mentionedIds.includes(id)) mentionedIds.push(id);
        break;
      }
    }
  }

  let municipio = (raw.split(/@/)[0] || '')
    .replace(/^(eu\s+quero\s+bloquear\s+(manuten[cç][aã]o\s+(de\s+)?)?)/i, '')
    .replace(/,\s*$/, '').trim();
  if (!municipio) municipio = 'Não especificado';

  const timeRe = /(amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo)[^\n@]*(às?\s+\d{1,2}[h:]\d{0,2}|\d{1,2}\s*hora)/i;
  const hourRe = /às?\s+(\d{1,2})[h:](\d{0,2})/i;
  const timeM = timeRe.exec(raw);
  const hourM = hourRe.exec(raw);

  let desbloqueio = 'A definir';
  if (timeM) {
    desbloqueio = timeM[0].trim();
    desbloqueio = desbloqueio.charAt(0).toUpperCase() + desbloqueio.slice(1);
  } else if (hourM) {
    desbloqueio = `Às ${hourM[1]}h${hourM[2] || '00'}`;
  }

  return { municipio, mentions: mentionedIds, desbloqueio };
}

function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'America/Sao_Paulo' });
}

// ─────────── Avatar ───────────
function Avatar({ userId, size = 34 }) {
  const u = USERS[userId];
  if (!u) return null;
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:u.color, flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center', userSelect:'none',
      fontSize:Math.round(size * 0.36), fontWeight:700, color:'#fff', fontFamily:'var(--font-body)' }}>
      {u.initials}
    </div>
  );
}

// ─────────── Sidebar ───────────
function Sidebar({ selected, onSelect, dmMeta }) {
  const totalUnread = dmMeta.reduce((s, c) => s + c.unread, 0);
  const row = (id) => ({
    display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:9,
    background: selected === id ? 'rgba(255,255,255,0.11)' : 'transparent',
    cursor:'pointer', transition:'background .15s', marginBottom:2,
  });
  return (
    <div style={{ width:268, flexShrink:0, background:SIDEBAR_BG,
      borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#1A6FB5,#2196F3)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:17 }}>
            💬
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#fff', fontFamily:'var(--font-body)', lineHeight:1.2 }}>Conexão Setorial</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:'var(--font-body)', marginTop:2, letterSpacing:'.04em' }}>Comunicação Interna · Admin</div>
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
          {totalUnread > 0 && (
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
                background: USERS[conv.user].online ? '#27AE60' : '#636E72',
                border:`1.5px solid ${SIDEBAR_BG}` }}/>
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
                {conv.unread > 0 && (
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
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
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

// ─────────── Mensagens ───────────
function TextBubble({ msg }) {
  const isMe = msg.from === ME;
  const u = USERS[msg.from];
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:8,
      flexDirection: isMe ? 'row-reverse' : 'row',
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      maxWidth:'72%', marginBottom:7 }}>
      {!isMe && <Avatar userId={msg.from} size={26}/>}
      <div>
        {!isMe && (
          <div style={{ fontSize:11, fontWeight:600, color:u?.color || '#666',
            marginBottom:3, fontFamily:'var(--font-body)' }}>
            {u?.name}
            <span style={{ fontSize:10, fontWeight:400, color:T.textS, marginLeft:6 }}>{u?.sector}</span>
          </div>
        )}
        <div style={{
          background: isMe ? 'linear-gradient(135deg,#1A6FB5,#2196F3)' : T.surface,
          color: isMe ? '#fff' : T.text,
          border: isMe ? 'none' : `1px solid ${T.border}`,
          borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          padding:'8px 12px', fontSize:13, lineHeight:1.5, fontFamily:'var(--font-body)',
          boxShadow:'0 1px 3px rgba(0,0,0,0.07)', wordBreak:'break-word',
        }}>
          {msg.text}
        </div>
        <div style={{ fontSize:10, color:T.textT, marginTop:2, fontFamily:'var(--font-body)',
          textAlign: isMe ? 'right' : 'left' }}>
          {msg.time}{isMe ? ' ✓✓' : ''}
        </div>
      </div>
    </div>
  );
}

function CommandBubble({ msg }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:8, flexDirection:'row-reverse',
      alignSelf:'flex-end', maxWidth:'78%', marginBottom:7 }}>
      <Avatar userId={ME} size={26}/>
      <div>
        <div style={{
          background:'linear-gradient(135deg,#0D1628,#162040)',
          border:'1px solid rgba(26,111,181,0.45)', borderRadius:'14px 14px 4px 14px',
          padding:'11px 14px', minWidth:224,
          boxShadow:'0 4px 14px rgba(26,111,181,0.2)', fontFamily:'var(--font-body)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
            <div style={{ background:'linear-gradient(135deg,#B04800,#E67E22)', borderRadius:6, padding:'2px 8px',
              fontSize:9, fontWeight:800, color:'#fff', letterSpacing:'.06em', flexShrink:0 }}>⚡ COMANDO</div>
            <code style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:500 }}>/solicitar_bloqueio</code>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { icon:'📍', label:'Município',   val: msg.cmdData.municipio, valColor:'#fff' },
              { icon:'👥', label:'Notificar',   val: msg.cmdData.mentions.map(u => '@' + USERS[u]?.name).join(', ') || '—', valColor:'#5DCC80' },
              { icon:'⏰', label:'Desbloqueio', val: msg.cmdData.desbloqueio, valColor:'#E67E22' },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
                <span style={{ fontSize:14, flexShrink:0, lineHeight:1.3 }}>{row.icon}</span>
                <div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.32)', fontWeight:700,
                    textTransform:'uppercase', letterSpacing:'.08em', marginBottom:1 }}>{row.label}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:row.valColor }}>{row.val}</div>
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

// ─────────── Chat area ───────────
function ChatArea({ msgs, selected, onSend }) {
  const [input, setInput]         = useState('');
  const [cmdMenu, setCmdMenu]     = useState(false);
  const [cmdFilter, setCmdFilter] = useState('');
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  const isGroup = selected === 'group';
  const conv    = DM_META.find(c => c.id === selected);
  const hdrUser = conv ? USERS[conv.user] : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [msgs]);

  const handleInput = (e) => {
    const val = e.target.value;
    setInput(val);
    if (val === '/') {
      setCmdMenu(true);
      setCmdFilter('');
    } else if (val.startsWith('/') && !val.includes(' ')) {
      setCmdMenu(true);
      setCmdFilter(val.slice(1).toLowerCase());
    } else {
      setCmdMenu(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
    if (e.key === 'Escape') setCmdMenu(false);
  };

  const doSend = () => {
    const txt = input.trim();
    if (!txt) return;
    onSend(txt);
    setInput('');
    setCmdMenu(false);
    inputRef.current?.focus();
  };

  const pickCmd = (cmd) => {
    setInput(cmd + ' ');
    setCmdMenu(false);
    inputRef.current?.focus();
  };

  const filteredCmds = COMMANDS.filter(c => c.cmd.includes(cmdFilter));
  const showHint = input.startsWith('/solicitar_bloqueio ');

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden', background:T.page }}>

      {/* Header */}
      <div style={{ padding:'10px 18px', borderBottom:`1px solid ${T.border}`, background:T.surface,
        display:'flex', alignItems:'center', gap:11, flexShrink:0 }}>
        {isGroup ? (
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
        ) : hdrUser && (
          <>
            <div style={{ position:'relative' }}>
              <Avatar userId={conv.user} size={38}/>
              <div style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:'50%',
                background: hdrUser.online ? '#27AE60' : '#636E72',
                border:`2px solid ${T.surface}` }}/>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>{hdrUser.name}</div>
              <div style={{ fontSize:11, color: hdrUser.online ? '#27AE60' : T.textS, fontFamily:'var(--font-body)' }}>
                {hdrUser.online ? '● Online' : '○ Offline'} · {hdrUser.sector}
              </div>
            </div>
          </>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:7 }}>
          {[
            <svg key="s" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
            <svg key="m" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
          ].map((ico, i) => (
            <button key={i} style={{ width:32, height:32, borderRadius:8, border:`1px solid ${T.border}`,
              background:'transparent', cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', color:T.textS }}>
              {ico}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column' }}>
        <div style={{ textAlign:'center', margin:'0 0 14px', fontFamily:'var(--font-body)' }}>
          <span style={{ fontSize:11, color:T.textS, background:T.page,
            padding:'2px 12px', borderRadius:20, border:`1px solid ${T.border}` }}>Hoje</span>
        </div>
        {msgs.map(msg => {
          if (msg.type === 'system')  return <SystemMsg   key={msg.id} msg={msg}/>;
          if (msg.type === 'command') return <CommandBubble key={msg.id} msg={msg}/>;
          return <TextBubble key={msg.id} msg={msg}/>;
        })}
        <div ref={endRef}/>
      </div>

      {/* Input bar */}
      <div style={{ flexShrink:0, padding:'10px 16px 12px', borderTop:`1px solid ${T.border}`, background:T.surface }}>
        <div style={{ position:'relative' }}>

          {/* Command suggestion popup */}
          {cmdMenu && filteredCmds.length > 0 && (
            <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0, right:0,
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:10,
              overflow:'hidden', boxShadow:'0 -8px 24px rgba(0,0,0,0.14)', zIndex:10 }}>
              <div style={{ padding:'6px 12px 4px', fontSize:9, fontWeight:700,
                color:T.textT, textTransform:'uppercase', letterSpacing:'.1em', fontFamily:'var(--font-body)' }}>
                Comandos disponíveis
              </div>
              {filteredCmds.map(c => (
                <div key={c.cmd} onClick={() => pickCmd(c.cmd)}
                  style={{ padding:'8px 12px', cursor:'pointer', display:'flex', gap:10, alignItems:'center',
                    borderTop:`1px solid ${T.border}`,
                    ':hover': { background:T.page } }}
                  onMouseEnter={e => e.currentTarget.style.background = T.page}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <code style={{ fontSize:12, color:T.gold, fontFamily:'monospace', fontWeight:700, flexShrink:0 }}>{c.cmd}</code>
                  <span style={{ fontSize:11, color:T.textS, fontFamily:'var(--font-body)' }}>{c.desc}</span>
                  <span style={{ fontSize:10, color:T.textT, fontFamily:'monospace', marginLeft:'auto', flexShrink:0 }}>{c.hint}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:9, alignItems:'flex-end' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem ou / para comandos..."
              style={{ flex:1, background:T.page, borderRadius:10, border:`1px solid ${input.startsWith('/solicitar_bloqueio') ? T.gold + '88' : T.border}`,
                padding:'9px 13px', fontSize:13, color:T.text, fontFamily:'var(--font-body)',
                outline:'none', transition:'border-color .15s', boxSizing:'border-box' }}
            />
            <button onClick={doSend}
              style={{ width:40, height:40, borderRadius:10, flexShrink:0,
                background: input.trim() ? 'linear-gradient(135deg,#1A6FB5,#2196F3)' : T.border,
                border:'none', cursor: input.trim() ? 'pointer' : 'default',
                display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

          {showHint && (
            <div style={{ marginTop:5, fontSize:11, color:T.gold, fontFamily:'var(--font-body)', paddingLeft:2 }}>
              ⚡ Formato: <code style={{ fontFamily:'monospace' }}>/solicitar_bloqueio [município] @[usuário] desbloquear [quando]</code>
            </div>
          )}
          {!showHint && !cmdMenu && (
            <div style={{ marginTop:4, fontSize:10, color:T.textT, fontFamily:'var(--font-body)', paddingLeft:1 }}>
              Digite <strong style={{ color:T.textS }}>/</strong> para ver comandos · <strong style={{ color:T.textS }}>Enter</strong> para enviar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────── Painel de atividades ───────────
function ActivitiesPanel({ activities }) {
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
          justifyContent:'center', fontFamily:'var(--font-body)' }}>
          {activities.length}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:9, minHeight:0 }}>
        {activities.map(act => (
          <div key={act.id} style={{ background:T.page, borderRadius:10,
            border:`1px solid ${act.urgent ? act.color + '3C' : T.border}`,
            padding:'10px 12px', position:'relative', overflow:'hidden', flexShrink:0 }}>
            <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3,
              background:act.color, borderRadius:'10px 0 0 10px' }}/>
            <div style={{ paddingLeft:7 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:5 }}>
                <span style={{ fontSize:16, flexShrink:0, lineHeight:1.2 }}>{act.icon}</span>
                <div style={{ fontSize:11, fontWeight:700, color:T.text, lineHeight:1.3, fontFamily:'var(--font-body)' }}>
                  {act.title}
                </div>
              </div>
              <div style={{ fontSize:10, color:T.textS, lineHeight:1.4, marginBottom:7, fontFamily:'var(--font-body)' }}>
                {act.desc}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:9, fontWeight:700, color:act.color,
                  background:`${act.color}18`, padding:'2px 7px', borderRadius:5, fontFamily:'var(--font-body)' }}>
                  {act.when}
                </span>
                <span style={{ fontSize:9, color:T.textT, fontFamily:'var(--font-body)' }}>{act.sector}</span>
              </div>
              {act.urgent && (
                <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:act.color, flexShrink:0 }}/>
                  <span style={{ fontSize:9, color:act.color, fontWeight:700, fontFamily:'var(--font-body)' }}>Urgente</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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
    </div>
  );
}

// ─────────── Toast de notificação ───────────
function NotifToast({ data, onDismiss }) {
  const mentionNames = data.mentions.map(u => USERS[u]?.name || u).join(', ');
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:9999,
      background:'#0F1520', borderRadius:14, padding:'13px 15px 15px',
      boxShadow:'0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)',
      width:310, fontFamily:'var(--font-body)', animation:'csSlideIn .35s cubic-bezier(.16,1,.3,1)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}>
        <div style={{ width:18, height:18, borderRadius:4, background:'linear-gradient(135deg,#1A6FB5,#2196F3)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0 }}>🔔</div>
        <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.38)',
          letterSpacing:'.07em', textTransform:'uppercase', flex:1 }}>Conexão Setorial</span>
        <button onClick={onDismiss} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)',
          cursor:'pointer', fontSize:17, lineHeight:1, padding:0 }}>×</button>
      </div>
      <div style={{ display:'flex', gap:11, alignItems:'flex-start' }}>
        <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>⚡</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:4, lineHeight:1.25 }}>
            Solicitação de Bloqueio de Manutenção
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.5 }}>
            <strong style={{ color:'#7EC8F8' }}>Nicolas Andrade</strong> solicitou bloqueio de{' '}
            <strong style={{ color:'#E67E22' }}>{data.municipio}</strong>.
            {mentionNames && <><br/>Responsável: <strong style={{ color:'#5DCC80' }}>{mentionNames}</strong></>}
            <br/>Desbloqueio: <strong style={{ color:'#E67E22' }}>{data.desbloqueio}</strong>
          </div>
        </div>
      </div>
      <div style={{ marginTop:11, display:'flex', gap:7 }}>
        <button onClick={onDismiss} style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none',
          background:'linear-gradient(135deg,#1A6FB5,#2196F3)', color:'#fff',
          fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Ver Atividade
        </button>
        <button onClick={onDismiss} style={{ flex:1, padding:'6px 0', borderRadius:8,
          border:'1px solid rgba(255,255,255,0.12)', background:'transparent',
          color:'rgba(255,255,255,0.55)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// ─────────── Componente principal ───────────
export default function ConexaoSetorial({ onBack }) {
  const [selected,    setSelected]    = useState('group');
  const [groupMsgs,   setGroupMsgs]   = useState(INIT_GROUP);
  const [dmMsgsMap,   setDmMsgsMap]   = useState(INIT_DM_MSGS);
  const [activities,  setActivities]  = useState(INIT_ACTIVITIES);
  const [notifToast,  setNotifToast]  = useState(null);
  const nextId = useRef(100);

  const getMsgs = () => selected === 'group' ? groupMsgs : (dmMsgsMap[selected] || []);

  const sendMessage = (text) => {
    const t = text.trim();
    if (!t) return;
    const id1 = nextId.current++;
    const time = nowTime();

    if (t.toLowerCase().startsWith('/solicitar_bloqueio')) {
      const raw = t.slice('/solicitar_bloqueio'.length).trim();
      const cmdData = parseBloqueioCMD(raw);

      const cmdMsg = { id: id1, from: ME, type: 'command', text: t, time, cmdData };
      const mentioned = cmdData.mentions.map(u => '@' + USERS[u]?.name).join(', ') || '@Setor';
      const sysMsg = {
        id: nextId.current++, type: 'system',
        text: `✅ Notificação enviada para ${mentioned}  •  Adicionado a Atividades Pendentes`,
        time,
      };
      setGroupMsgs(p => [...p, cmdMsg, sysMsg]);

      const sector = cmdData.mentions.map(u => USERS[u]?.sector).filter(Boolean).join(', ') || 'Geral';
      setActivities(p => [{
        id: nextId.current++, icon:'⏰',
        title: `Desbloquear manutenção de ${cmdData.municipio}`,
        desc: 'Solicitado por Nicolas Andrade via /solicitar_bloqueio',
        when: cmdData.desbloqueio, color:'#E67E22', sector, urgent: false,
      }, ...p]);

      setNotifToast(cmdData);

    } else {
      const msg = { id: id1, from: ME, type: 'text', text: t, time };
      if (selected === 'group') {
        setGroupMsgs(p => [...p, msg]);
      } else {
        setDmMsgsMap(p => ({ ...p, [selected]: [...(p[selected] || []), msg] }));
      }
    }
  };

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:T.page }}>
      <style>{`
        @keyframes csSlideIn {
          from { opacity:0; transform:translateX(40px) scale(.96); }
          to   { opacity:1; transform:translateX(0) scale(1); }
        }
        input::placeholder { color: var(--cs-ph, #999); }
      `}</style>

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
          padding:'2px 8px', borderRadius:5, fontFamily:'var(--font-body)', letterSpacing:'.04em' }}>
          SOMENTE ADMIN
        </div>
        {notifToast && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
            fontSize:11, color:'#5DCC80', fontFamily:'var(--font-body)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#27AE60' }}/>
            Notificação enviada para {notifToast.mentions.map(u => USERS[u]?.name).join(', ') || 'Setor'}
          </div>
        )}
      </div>

      {/* Layout */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        <Sidebar selected={selected} onSelect={setSelected} dmMeta={DM_META}/>
        <ChatArea msgs={getMsgs()} selected={selected} onSend={sendMessage}/>
        <ActivitiesPanel activities={activities}/>
      </div>

      {notifToast && <NotifToast data={notifToast} onDismiss={() => setNotifToast(null)}/>}
    </div>
  );
}
