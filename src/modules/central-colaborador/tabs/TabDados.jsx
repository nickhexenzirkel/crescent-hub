import React from 'react';
import { T } from '../../../contexts/theme';
import { USER } from '../../../contexts/user';
import { Card, Btn, StarDivider, SHead } from '../../../shared/components';

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


export { TabDados };
