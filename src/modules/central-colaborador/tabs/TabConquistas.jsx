import React from 'react';
import { T } from '../../../contexts/theme';
import { USER, getAuthUser } from '../../../contexts/user';
import { Card, Tag, StarDivider, SHead } from '../../../shared/components';

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

export { TabConquistas };
