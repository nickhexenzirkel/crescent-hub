import React, { useState, useRef, useEffect } from 'react';
import { T } from '../../contexts/theme';

// ─────────── Dados fictícios ───────────

const USERS = {
  nicolas: { name: 'Nicolas Andrade', initials: 'NA', color: '#1A6FB5', sector: 'Admin',              online: true  },
  ana:     { name: 'Ana Clara',       initials: 'AC', color: '#9B59B6', sector: 'Admin',              online: true  },
  rafael:  { name: 'Rafael Santos',   initials: 'RS', color: '#27AE60', sector: 'Suporte Contratual', online: false },
  mariana: { name: 'Mariana Lopes',   initials: 'ML', color: '#E87C22', sector: 'Recursos Humanos',   online: true  },
  pedro:   { name: 'Pedro Oliveira',  initials: 'PO', color: '#C0392B', sector: 'TI',                 online: false },
};

const ME = 'nicolas';

const GROUP_MSGS = [
  { id:1,  from:'ana',     type:'text',    text:'Bom dia, pessoal! 👋 Novo colaborador cadastrado: João Lima – Setor Financeiro. Acesso liberado no sistema.', time:'09:12' },
  { id:2,  from:'nicolas', type:'text',    text:'Ótimo, Ana! Vou alinhar com ele sobre os primeiros passos no sistema.', time:'09:15' },
  { id:3,  from:'rafael',  type:'text',    text:'Precisamos atualizar o manual de boas-vindas — a versão atual está desatualizada com os novos fluxos.', time:'09:42' },
  { id:4,  from:'mariana', type:'text',    text:'Concordo! Vou separar um tempo hoje à tarde para revisar. 📄', time:'09:44' },
  { id:5,  from:'nicolas', type:'command', text:'/solicitar_bloqueio Eu quero bloquear manutenção de Tabuleiro do Norte, @Suporte Contratual você pode desbloquear amanhã às 8 horas', time:'10:55',
    cmdData:{ municipio:'Tabuleiro do Norte', mentions:['rafael'], desbloqueio:'Amanhã às 08:00' } },
  { id:6,  type:'system',  text:'✅ Notificação enviada para @Rafael Santos (Suporte Contratual)  •  Adicionado a Atividades Pendentes', time:'10:55' },
  { id:7,  from:'rafael',  type:'text',    text:'Recebi a notificação! Confirmado, vou registrar aqui e desbloquear amanhã às 8h. ✅', time:'11:02' },
  { id:8,  from:'pedro',   type:'text',    text:'Pessoal, o servidor de backup está com 90% de capacidade. Vou ampliar o espaço ainda hoje.', time:'14:10' },
  { id:9,  from:'ana',     type:'text',    text:'Obrigada pelo aviso, Pedro! Pode prosseguir. 👍', time:'14:12' },
  { id:10, from:'mariana', type:'text',    text:'Terminei de revisar o manual de boas-vindas — ficou muito mais completo! 🎉', time:'16:28' },
];

const DM_LIST = [
  {
    id:'dm_rafael', user:'rafael', lastMsg:'Confirmado, vou desbloquear amanhã. ✅', lastTime:'11:02', unread:0,
    msgs:[
      { id:1, from:'nicolas', type:'text', text:'Rafael, você recebeu a notificação do bloqueio de Tabuleiro do Norte?', time:'10:56' },
      { id:2, from:'rafael',  type:'text', text:'Sim, apareceu no desktop agora mesmo!', time:'10:58' },
      { id:3, from:'nicolas', type:'text', text:'Ótimo! O município solicitou até amanhã às 8h. Consegue garantir?', time:'10:59' },
      { id:4, from:'rafael',  type:'text', text:'Confirmado, vou desbloquear amanhã. ✅', time:'11:02' },
    ],
  },
  {
    id:'dm_ana', user:'ana', lastMsg:'Obrigada pelo retorno rápido! 😊', lastTime:'14:22', unread:2,
    msgs:[
      { id:1, from:'ana',     type:'text', text:'Nicolas, o João Lima já conseguiu logar no sistema?', time:'14:18' },
      { id:2, from:'nicolas', type:'text', text:'Sim! Acabei de confirmar com ele. Está acessando normalmente.', time:'14:20' },
      { id:3, from:'ana',     type:'text', text:'Perfeito, pode fechar o chamado então.', time:'14:21' },
      { id:4, from:'ana',     type:'text', text:'Obrigada pelo retorno rápido! 😊', time:'14:22' },
    ],
  },
  {
    id:'dm_mariana', user:'mariana', lastMsg:'Manual atualizado e revisado! ✅', lastTime:'16:30', unread:0,
    msgs:[
      { id:1, from:'mariana', type:'text', text:'Nicolas, terminei a revisão do manual. Pode conferir quando puder?', time:'16:28' },
      { id:2, from:'nicolas', type:'text', text:'Claro! Vou dar uma olhada.', time:'16:29' },
      { id:3, from:'mariana', type:'text', text:'Manual atualizado e revisado! ✅', time:'16:30' },
    ],
  },
];

const ACTIVITIES = [
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

const SIDEBAR_BG = '#141928';

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
function Sidebar({ selected, onSelect }) {
  const totalUnread = DM_LIST.reduce((s, c) => s + c.unread, 0);
  const rowStyle = (id) => ({
    display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:9,
    background: selected === id ? 'rgba(255,255,255,0.10)' : 'transparent',
    cursor:'pointer', transition:'background .15s', marginBottom:2,
  });
  return (
    <div style={{ width:282, flexShrink:0, background:SIDEBAR_BG,
      borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#1A6FB5,#2196F3)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>
            💬
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:'var(--font-body)', lineHeight:1.2 }}>
              Conexão Setorial
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.38)', fontFamily:'var(--font-body)', marginTop:2 }}>
              Comunicação Interna · Admin
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding:'10px 14px' }}>
        <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:8, padding:'7px 12px',
          display:'flex', alignItems:'center', gap:8, border:'1px solid rgba(255,255,255,0.05)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.28)', fontFamily:'var(--font-body)' }}>
            Pesquisar conversa...
          </span>
        </div>
      </div>

      {/* Grupos */}
      <div style={{ padding:'0 14px 6px' }}>
        <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.12em',
          textTransform:'uppercase', marginBottom:5, fontFamily:'var(--font-body)' }}>
          Grupos
        </div>
        <div onClick={() => onSelect('group')} style={rowStyle('group')}>
          <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            border:'1px solid rgba(26,111,181,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7EC8F8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#fff', fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              7 SERV - Comunicação Interna
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)', fontFamily:'var(--font-body)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>
              Mariana: Manual atualizado! 🎉
            </div>
          </div>
        </div>
      </div>

      <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'2px 14px 6px' }}/>

      {/* DMs */}
      <div style={{ padding:'0 14px', flex:1, overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.12em',
            textTransform:'uppercase', fontFamily:'var(--font-body)' }}>
            Mensagens Diretas
          </div>
          {totalUnread > 0 && (
            <div style={{ background:'#E74C3C', color:'#fff', fontSize:9, fontWeight:700,
              width:17, height:17, borderRadius:'50%', display:'flex', alignItems:'center',
              justifyContent:'center', fontFamily:'var(--font-body)' }}>
              {totalUnread}
            </div>
          )}
        </div>
        {DM_LIST.map(conv => (
          <div key={conv.id} onClick={() => onSelect(conv.id)} style={rowStyle(conv.id)}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <Avatar userId={conv.user} size={37}/>
              <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%',
                background: USERS[conv.user].online ? '#27AE60' : '#636E72',
                border:`2px solid ${SIDEBAR_BG}` }}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:600, color:'#fff', fontFamily:'var(--font-body)' }}>
                  {USERS[conv.user].name}
                </span>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-body)', flexShrink:0, marginLeft:4 }}>
                  {conv.lastTime}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:1 }}>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.38)', fontFamily:'var(--font-body)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:148 }}>
                  {conv.lastMsg}
                </span>
                {conv.unread > 0 && (
                  <div style={{ background:'#1A6FB5', color:'#fff', fontSize:9, fontWeight:700,
                    width:17, height:17, borderRadius:'50%', display:'flex', alignItems:'center',
                    justifyContent:'center', flexShrink:0, marginLeft:4, fontFamily:'var(--font-body)' }}>
                    {conv.unread}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Online now */}
      <div style={{ padding:'10px 14px 14px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.12em',
          textTransform:'uppercase', marginBottom:8, fontFamily:'var(--font-body)' }}>
          Online agora
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {Object.entries(USERS).filter(([,u]) => u.online).map(([id]) => (
            <div key={id} style={{ position:'relative' }}>
              <Avatar userId={id} size={28}/>
              <div style={{ position:'absolute', bottom:0, right:0, width:7, height:7, borderRadius:'50%',
                background:'#27AE60', border:`1.5px solid ${SIDEBAR_BG}` }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── Message bubbles ───────────
function TextBubble({ msg }) {
  const isMe = msg.from === ME;
  const u = USERS[msg.from];
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:8,
      flexDirection: isMe ? 'row-reverse' : 'row',
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      maxWidth:'74%', marginBottom:8 }}>
      {!isMe && <Avatar userId={msg.from} size={28}/>}
      <div>
        {!isMe && (
          <div style={{ fontSize:11, fontWeight:600, color:u?.color || '#666',
            marginBottom:3, fontFamily:'var(--font-body)' }}>
            {u?.name}
            <span style={{ fontSize:10, fontWeight:400, color:T.textS, marginLeft:6 }}>
              {u?.sector}
            </span>
          </div>
        )}
        <div style={{
          background: isMe ? 'linear-gradient(135deg,#1A6FB5,#2196F3)' : T.surface,
          color: isMe ? '#fff' : T.text,
          border: isMe ? 'none' : `1px solid ${T.border}`,
          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding:'9px 13px', fontSize:13, lineHeight:1.55, fontFamily:'var(--font-body)',
          boxShadow:'0 1px 4px rgba(0,0,0,0.08)',
        }}>
          {msg.text}
        </div>
        <div style={{ fontSize:10, color:T.textT, marginTop:3, fontFamily:'var(--font-body)',
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
      alignSelf:'flex-end', maxWidth:'80%', marginBottom:8 }}>
      <Avatar userId={ME} size={28}/>
      <div>
        <div style={{
          background:'linear-gradient(135deg,#0D1628,#162040)',
          border:'1px solid rgba(26,111,181,0.45)',
          borderRadius:'16px 16px 4px 16px',
          padding:'12px 16px', minWidth:240,
          boxShadow:'0 4px 16px rgba(26,111,181,0.18)',
          fontFamily:'var(--font-body)',
        }}>
          {/* Command header */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ background:'linear-gradient(135deg,#C0530A,#E67E22)', borderRadius:7, padding:'3px 10px',
              fontSize:10, fontWeight:800, color:'#fff', letterSpacing:'.06em', flexShrink:0 }}>
              ⚡ COMANDO
            </div>
            <code style={{ fontSize:12, color:'rgba(255,255,255,0.55)', fontWeight:500 }}>
              /solicitar_bloqueio
            </code>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <span style={{ fontSize:16, flexShrink:0 }}>📍</span>
              <div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontWeight:700,
                  textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Município</div>
                <div style={{ fontSize:13, color:'#fff', fontWeight:700 }}>{msg.cmdData.municipio}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <span style={{ fontSize:16, flexShrink:0 }}>👥</span>
              <div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontWeight:700,
                  textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Notificar</div>
                <div style={{ fontSize:13, fontWeight:600, display:'flex', gap:4, flexWrap:'wrap' }}>
                  {msg.cmdData.mentions.map(u => (
                    <span key={u} style={{ color:'#5DCC80', background:'rgba(93,204,128,0.12)',
                      padding:'1px 7px', borderRadius:5 }}>
                      @{USERS[u]?.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <span style={{ fontSize:16, flexShrink:0 }}>⏰</span>
              <div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontWeight:700,
                  textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Desbloqueio</div>
                <div style={{ fontSize:13, color:'#E67E22', fontWeight:700 }}>{msg.cmdData.desbloqueio}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop:12, borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:10,
            display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#27AE60', flexShrink:0 }}/>
            <span style={{ fontSize:11, color:'#5DCC80', fontWeight:600 }}>
              Notificação enviada · Atividade registrada
            </span>
          </div>
        </div>
        <div style={{ fontSize:10, color:T.textT, marginTop:3, textAlign:'right', fontFamily:'var(--font-body)' }}>
          {msg.time} ✓✓
        </div>
      </div>
    </div>
  );
}

function SystemMsg({ msg }) {
  return (
    <div style={{ textAlign:'center', margin:'6px 0 10px', fontFamily:'var(--font-body)' }}>
      <span style={{ fontSize:11, color:T.textS, background:T.page,
        padding:'3px 14px', borderRadius:20, border:`1px solid ${T.border}` }}>
        {msg.text}
      </span>
    </div>
  );
}

// ─────────── Chat area ───────────
function ChatArea({ selected }) {
  const isGroup  = selected === 'group';
  const conv     = DM_LIST.find(c => c.id === selected);
  const msgs     = isGroup ? GROUP_MSGS : (conv?.msgs || []);
  const hdrUser  = conv ? USERS[conv.user] : null;
  const endRef   = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [selected]);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:T.page }}>

      {/* Header */}
      <div style={{ padding:'11px 20px', borderBottom:`1px solid ${T.border}`, background:T.surface,
        display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        {isGroup ? (
          <>
            <div style={{ width:40, height:40, borderRadius:11, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7EC8F8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>
                7 SERV - Comunicação Interna
              </div>
              <div style={{ fontSize:12, color:T.textS, fontFamily:'var(--font-body)' }}>
                5 participantes · 3 online agora
              </div>
            </div>
          </>
        ) : hdrUser && (
          <>
            <div style={{ position:'relative' }}>
              <Avatar userId={conv.user} size={40}/>
              <div style={{ position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:'50%',
                background: hdrUser.online ? '#27AE60' : '#636E72',
                border:`2px solid ${T.surface}` }}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>
                {hdrUser.name}
              </div>
              <div style={{ fontSize:12, color: hdrUser.online ? '#27AE60' : T.textS, fontFamily:'var(--font-body)' }}>
                {hdrUser.online ? '● Online' : '○ Offline'} · {hdrUser.sector}
              </div>
            </div>
          </>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          {[
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
          ].map((ico, i) => (
            <button key={i} style={{ width:34, height:34, borderRadius:8, border:`1px solid ${T.border}`,
              background:T.surface, cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', color:T.textS }}>
              {ico}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column' }}>
        <div style={{ textAlign:'center', margin:'0 0 16px', fontFamily:'var(--font-body)' }}>
          <span style={{ fontSize:11, color:T.textS, background:T.page,
            padding:'3px 14px', borderRadius:20, border:`1px solid ${T.border}` }}>
            Hoje
          </span>
        </div>

        {msgs.map(msg => {
          if (msg.type === 'system')  return <SystemMsg  key={msg.id} msg={msg}/>;
          if (msg.type === 'command') return <CommandBubble key={msg.id} msg={msg}/>;
          return <TextBubble key={msg.id} msg={msg}/>;
        })}
        <div ref={endRef}/>
      </div>

      {/* Input bar */}
      <div style={{ padding:'12px 20px', borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ flex:1, background:T.page, borderRadius:12, border:`1px solid ${T.border}`,
            padding:'10px 14px', display:'flex', alignItems:'center', gap:9, cursor:'text',
            color:T.textT, fontSize:13, fontFamily:'var(--font-body)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Digite uma mensagem ou <strong>/</strong> para comandos...
          </div>
          <button style={{ width:42, height:42, borderRadius:10, flexShrink:0,
            background:'linear-gradient(135deg,#1A6FB5,#2196F3)',
            border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize:10, color:T.textT, marginTop:6, fontFamily:'var(--font-body)' }}>
          Use <strong style={{ color:T.textS }}>/solicitar_bloqueio</strong> para notificar setores
          &nbsp;·&nbsp; <strong style={{ color:T.textS }}>@nome</strong> para mencionar usuários
        </div>
      </div>
    </div>
  );
}

// ─────────── Painel de atividades ───────────
function ActivitiesPanel() {
  return (
    <div style={{ width:282, flexShrink:0, background:T.surface,
      borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column' }}>

      <div style={{ padding:'14px 18px 12px', borderBottom:`1px solid ${T.border}`,
        display:'flex', alignItems:'center', gap:9 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:'var(--font-body)', flex:1 }}>
          Atividades Pendentes
        </span>
        <div style={{ background:`${T.gold}20`, color:T.gold, fontSize:10, fontWeight:700,
          width:20, height:20, borderRadius:'50%', display:'flex', alignItems:'center',
          justifyContent:'center', fontFamily:'var(--font-body)' }}>
          {ACTIVITIES.length}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
        {ACTIVITIES.map(act => (
          <div key={act.id} style={{ background:T.page, borderRadius:12,
            border:`1px solid ${act.urgent ? act.color + '40' : T.border}`,
            padding:'12px 14px', position:'relative', overflow:'hidden' }}>
            {/* left accent bar */}
            <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3,
              background:act.color, borderRadius:'12px 0 0 12px' }}/>
            <div style={{ paddingLeft:8 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{act.icon}</span>
                <div style={{ fontSize:12, fontWeight:700, color:T.text, lineHeight:1.35, fontFamily:'var(--font-body)' }}>
                  {act.title}
                </div>
              </div>
              <div style={{ fontSize:11, color:T.textS, lineHeight:1.45, marginBottom:8, fontFamily:'var(--font-body)' }}>
                {act.desc}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:700, color:act.color,
                  background:`${act.color}18`, padding:'2px 8px', borderRadius:6, fontFamily:'var(--font-body)' }}>
                  {act.when}
                </span>
                <span style={{ fontSize:10, color:T.textT, fontFamily:'var(--font-body)' }}>
                  {act.sector}
                </span>
              </div>
              {act.urgent && (
                <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:act.color, flexShrink:0 }}/>
                  <span style={{ fontSize:10, color:act.color, fontWeight:700, fontFamily:'var(--font-body)' }}>
                    Urgente
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Command reference */}
      <div style={{ padding:'12px 14px', borderTop:`1px solid ${T.border}` }}>
        <div style={{ fontSize:10, fontWeight:700, color:T.textT, textTransform:'uppercase',
          letterSpacing:'.08em', marginBottom:8, fontFamily:'var(--font-body)' }}>
          Comandos disponíveis
        </div>
        {[
          { cmd:'/solicitar_bloqueio', desc:'Notifica setor + cria atividade' },
          { cmd:'/aviso',              desc:'Envia aviso para o grupo' },
          { cmd:'/atribuir',           desc:'Atribui tarefa a usuário' },
        ].map(c => (
          <div key={c.cmd} style={{ marginBottom:6 }}>
            <code style={{ fontSize:11, color:T.gold, fontFamily:'monospace', background:`${T.gold}12`,
              padding:'1px 5px', borderRadius:4 }}>
              {c.cmd}
            </code>
            <span style={{ fontSize:10, color:T.textT, marginLeft:6, fontFamily:'var(--font-body)' }}>
              {c.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── Toast de notificação desktop (mockup visual) ───────────
function NotifToast({ onDismiss }) {
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:9999,
      background:'#0F1520', borderRadius:14, padding:'14px 16px 16px',
      boxShadow:'0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.07)',
      width:320, fontFamily:'var(--font-body)', animation:'csSlideIn .35s cubic-bezier(.16,1,.3,1)' }}>

      {/* Chrome-style top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:20, height:20, borderRadius:5, background:'linear-gradient(135deg,#1A6FB5,#2196F3)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>
          🔔
        </div>
        <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)',
          letterSpacing:'.06em', textTransform:'uppercase', flex:1 }}>
          crescent-hub · Conexão Setorial
        </span>
        <button onClick={onDismiss} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)',
          cursor:'pointer', fontSize:18, lineHeight:1, padding:0, fontFamily:'inherit' }}>
          ×
        </button>
      </div>

      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
        <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#1A3A60,#1A6FB5)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20 }}>
          ⚡
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:4, lineHeight:1.25 }}>
            Solicitação de Bloqueio de Manutenção
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>
            <strong style={{ color:'#7EC8F8' }}>Nicolas Andrade</strong> solicitou bloqueio de{' '}
            <strong style={{ color:'#E67E22' }}>Tabuleiro do Norte</strong>.
            <br/>Desbloqueio previsto: amanhã às 08:00.
          </div>
        </div>
      </div>

      <div style={{ marginTop:12, display:'flex', gap:8 }}>
        <button style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none',
          background:'linear-gradient(135deg,#1A6FB5,#2196F3)', color:'#fff',
          fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Ver Atividade
        </button>
        <button onClick={onDismiss} style={{ flex:1, padding:'7px 0', borderRadius:8,
          border:'1px solid rgba(255,255,255,0.12)', background:'transparent',
          color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// ─────────── Componente principal ───────────
export default function ConexaoSetorial({ onBack }) {
  const [selected,  setSelected]  = useState('group');
  const [showNotif, setShowNotif] = useState(true);

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:T.page }}>
      <style>{`
        @keyframes csSlideIn {
          from { opacity:0; transform:translateX(40px) scale(.96); }
          to   { opacity:1; transform:translateX(0)    scale(1);   }
        }
      `}</style>

      {/* Top bar */}
      <div style={{ height:50, background:T.surface, borderBottom:`1px solid ${T.border}`,
        display:'flex', alignItems:'center', paddingLeft:20, paddingRight:24, gap:14, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
            cursor:'pointer', color:T.textS, fontSize:13, fontFamily:'var(--font-body)', padding:0 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke={T.textS} strokeWidth="1.8">
            <path d="M10 12L6 8L10 4"/>
          </svg>
          Módulos
        </button>
        <div style={{ width:1, height:18, background:T.border }}/>
        <span style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:'var(--font-body)' }}>
          Conexão Setorial
        </span>
        <div style={{ background:`${T.gold}18`, color:T.gold, fontSize:10, fontWeight:700,
          padding:'2px 9px', borderRadius:6, fontFamily:'var(--font-body)' }}>
          Somente Admin
        </div>
        {showNotif && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
            fontSize:11, color:'#5DCC80', fontFamily:'var(--font-body)' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#27AE60' }}/>
            Notificação enviada para Suporte Contratual
          </div>
        )}
      </div>

      {/* Layout principal */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <Sidebar selected={selected} onSelect={setSelected}/>
        <ChatArea selected={selected}/>
        <ActivitiesPanel/>
      </div>

      {showNotif && <NotifToast onDismiss={() => setShowNotif(false)}/>}
    </div>
  );
}
