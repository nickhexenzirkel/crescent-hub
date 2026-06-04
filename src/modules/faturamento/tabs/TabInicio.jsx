import React from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';

const FEATURES = [
  {
    id: 'xml',
    color: '#1A6FB5',
    bg: 'rgba(26,111,181,0.08)',
    title: 'Leitor de XML',
    desc: 'Importa arquivos XML (NF-e) e exporta para Excel no formato padrão da planilha de faturamento. Suporta múltiplos arquivos de uma vez.',
    steps: ['Selecione os arquivos .xml', 'Visualize os dados na tabela', 'Exporte para Excel (.xlsx)'],
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
        <line x1="9" y1="17" x2="13" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'consumo',
    color: '#1A9C70',
    bg: 'rgba(26,156,112,0.08)',
    title: 'Relatório de Consumo',
    desc: 'Acessa o sistema 7Benefícios automaticamente e baixa os PDFs de Relatório de Consumo para cada secretaria identificada no relatório de retenção.',
    steps: ['Envie o relatório de retenção XLSX', 'Configure mês e pasta de saída', 'Inicie o download automático'],
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
  {
    id: 'ordens',
    color: '#8B5FE8',
    bg: 'rgba(139,95,232,0.08)',
    title: 'Ordens de Serviço',
    desc: 'Baixa automaticamente os PDFs de Ordens de Serviço do sistema 7Benefícios com base no relatório de retenção de manutenção ou abastecimento.',
    steps: ['Envie o relatório de retenção XLSX', 'Configure o período de referência', 'Inicie o download automático'],
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },
];

export const TabInicio = ({ setTab }) => {
  return (
    <div style={{minHeight:'100vh',fontFamily:'var(--font-body)'}}>
      {/* Hero */}
      <div style={{
        padding:'60px 48px 48px',
        background:`linear-gradient(135deg,${T.page},${T.surface})`,
        borderBottom:`1px solid ${T.border}`,
        position:'relative',overflow:'hidden',
      }}>
        <div style={{position:'absolute',top:'-40px',right:'-60px',width:320,height:320,borderRadius:'50%',
          background:`radial-gradient(circle,${T.goldGl} 0%,transparent 70%)`,filter:'blur(40px)',pointerEvents:'none'}}/>
        <div style={{position:'relative',zIndex:1,maxWidth:700}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
            <div style={{width:44,height:44,borderRadius:12,background:T.goldGl,border:`1px solid ${T.gold}22`,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <span style={{fontSize:12,fontWeight:600,color:T.gold,letterSpacing:'.08em',textTransform:'uppercase'}}>Módulo de Automação</span>
          </div>
          <h1 style={{fontSize:34,fontWeight:700,color:T.text,marginBottom:12,lineHeight:1.2}}>
            Faturamento
          </h1>
          <p style={{fontSize:16,color:T.textS,lineHeight:1.7,marginBottom:0,maxWidth:560}}>
            Central de automação para o setor de faturamento. Baixe relatórios do sistema 7Benefícios, processe XMLs de nota fiscal e organize seus arquivos de forma automatizada.
          </p>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{padding:'48px'}}>
        <div style={{fontSize:12,fontWeight:600,color:T.textD,letterSpacing:'.09em',textTransform:'uppercase',marginBottom:20}}>
          FUNCIONALIDADES
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:20,marginBottom:48}}>
          {FEATURES.map(f => (
            <div key={f.id}
              onClick={() => setTab(f.id)}
              style={{
                background:T.surface,border:`1px solid ${T.border}`,
                borderRadius:16,padding:'28px',cursor:'pointer',
                transition:'all .2s cubic-bezier(.16,1,.3,1)',
                boxShadow:T.sh,position:'relative',overflow:'hidden',
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow=T.shL;e.currentTarget.style.borderColor=f.color+'44';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=T.sh;e.currentTarget.style.borderColor=T.border;}}>
              <div style={{position:'absolute',top:0,left:'10%',right:'10%',height:2,
                background:`linear-gradient(90deg,transparent,${f.color}88,transparent)`,borderRadius:999}}/>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
                <div style={{width:52,height:52,borderRadius:14,background:f.bg,
                  border:`1px solid ${f.color}22`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {f.icon(f.color)}
                </div>
                <div style={{padding:'3px 10px',borderRadius:20,background:f.bg,
                  fontSize:11,fontWeight:600,color:f.color,letterSpacing:'.04em'}}>
                  Acessar →
                </div>
              </div>
              <div style={{fontSize:17,fontWeight:600,color:T.text,marginBottom:8}}>{f.title}</div>
              <div style={{fontSize:14,color:T.textS,lineHeight:1.6,marginBottom:20}}>{f.desc}</div>
              <div style={{borderTop:`1px solid ${T.divider}`,paddingTop:16}}>
                <div style={{fontSize:11,fontWeight:600,color:T.textD,letterSpacing:'.07em',marginBottom:10}}>COMO USAR</div>
                {f.steps.map((s, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <div style={{width:20,height:20,borderRadius:'50%',background:f.bg,
                      border:`1px solid ${f.color}33`,display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:10,fontWeight:700,color:f.color,flexShrink:0}}>
                      {i + 1}
                    </div>
                    <span style={{fontSize:13,color:T.textS}}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Info box */}
        <div style={{background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:14,padding:'20px 24px',display:'flex',gap:16,alignItems:'flex-start'}}>
          <div style={{flexShrink:0,marginTop:2}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:4}}>Sobre a automação de downloads</div>
            <div style={{fontSize:13,color:T.textS,lineHeight:1.6}}>
              As funções de <strong>Relatório de Consumo</strong> e <strong>Ordens de Serviço</strong> requerem o servidor local ativo (backend).
              O servidor acessa o sistema 7Benefícios e realiza os downloads em segundo plano, sem abrir o navegador.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
