import { T } from '../../../contexts/theme';
import { StarDivider, Card } from '../../../shared/components';
import { StellarHero } from '../StellarHero';

const FEATURES = [
  {
    id: 'xml',
    color: '#1A6FB5',
    bg: 'rgba(26,111,181,0.10)',
    title: 'Leitor de XML',
    desc: 'Importa arquivos XML (NF-e / NFS-e) e exporta para Excel no formato padrão da planilha de faturamento. Suporta múltiplos arquivos de uma vez.',
    steps: ['Selecione os arquivos .xml', 'Visualize os dados na tabela', 'Exporte para Excel (.xlsx)'],
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
    bg: 'rgba(26,156,112,0.10)',
    title: 'Relatório de Consumo',
    desc: 'Acessa o 7Benefícios pela extensão e baixa os PDFs de Relatório de Consumo de cada secretaria, organizados na pasta que você escolher.',
    steps: ['Envie o relatório de retenção XLSX', 'Selecione secretarias e período', 'Baixe os PDFs automaticamente'],
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
  {
    id: 'ordens',
    color: '#8B5FE8',
    bg: 'rgba(139,95,232,0.10)',
    title: 'Ordens de Serviço',
    desc: 'Baixa os PDFs de cada Ordem de Serviço do 7Benefícios, organizados em uma subpasta por secretaria. Sem precisar informar período.',
    steps: ['Envie o relatório de retenção XLSX', 'Confira a pré-visualização das pastas', 'Baixe as OS automaticamente'],
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },
];

export const TabInicio = ({ setTab }) => {
  return (
    <div style={{padding:'32px 40px 48px',fontFamily:'var(--font-body)'}}>
      <StellarHero
        eyebrow="Módulo de Automação"
        title="Faturamento"
        subtitle="Baixe relatórios do 7Benefícios, processe XMLs de nota fiscal e organize seus arquivos — tudo de forma automatizada."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
        )}
      />

      {/* Funcionalidades */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        <span style={{fontSize:12,fontWeight:700,color:T.textD,letterSpacing:'.1em',textTransform:'uppercase'}}>Funcionalidades</span>
        <div style={{flex:1}}><StarDivider my={0} dim/></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:20,marginBottom:36}}>
        {FEATURES.map(f => (
          <Card key={f.id} onClick={() => setTab(f.id)} style={{padding:'26px'}}>
            <div style={{position:'absolute',top:0,left:'10%',right:'10%',height:2,
              background:`linear-gradient(90deg,transparent,${f.color}99,transparent)`,borderRadius:999}}/>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
              <div style={{width:52,height:52,borderRadius:14,background:f.bg,
                border:`1px solid ${f.color}26`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {f.icon(f.color)}
              </div>
              <div style={{padding:'4px 11px',borderRadius:20,background:f.bg,
                fontSize:11,fontWeight:600,color:f.color,letterSpacing:'.04em'}}>Acessar →</div>
            </div>
            <div style={{fontSize:17,fontWeight:600,color:T.text,marginBottom:8}}>{f.title}</div>
            <div style={{fontSize:13.5,color:T.textS,lineHeight:1.6,marginBottom:18}}>{f.desc}</div>
            <div style={{borderTop:`1px solid ${T.divider}`,paddingTop:16}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',marginBottom:10}}>COMO USAR</div>
              {f.steps.map((s, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{width:20,height:20,borderRadius:'50%',background:f.bg,
                    border:`1px solid ${f.color}38`,display:'flex',alignItems:'center',
                    justifyContent:'center',fontSize:10,fontWeight:700,color:f.color,flexShrink:0}}>{i + 1}</div>
                  <span style={{fontSize:13,color:T.textS}}>{s}</span>
                </div>
              ))}
            </div>
          </Card>
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
            O <strong>Relatório de Consumo</strong> e as <strong>Ordens de Serviço</strong> usam a extensão
            <strong> Uniko Faturamento</strong> no Chrome/Opera. Ela acessa o 7Benefícios em uma aba, baixa os PDFs
            e os organiza na pasta que você escolher — sem servidor local.
          </div>
        </div>
      </div>
    </div>
  );
};
