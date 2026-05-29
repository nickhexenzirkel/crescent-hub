import React, { useState } from 'react';
import { T } from '../../../contexts/theme';
import { SERVER_URL } from '../../../contexts/user';
import { Card, Btn, StarDivider, SHead } from '../../../shared/components';

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


export { TabFeedback };
