import React, { useState } from 'react';
import { T } from '../../../contexts/theme';
import { Card, Btn, Tag, StarDivider, SHead } from '../../../shared/components';

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


export { TabGames };
