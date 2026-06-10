import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { T } from '../../../contexts/theme';
import { StellarHero } from '../StellarHero';

/* ── GINFES NFS-e Parser ──────────────────────────────── */
const GINFES_NS = 'http://www.ginfes.com.br/tipos_v03.xsd';

const getEl = (parent, tag) =>
  parent?.getElementsByTagNameNS(GINFES_NS, tag)[0]
  || parent?.getElementsByTagName(tag)[0]
  || null;

const getText = (parent, tag) => getEl(parent, tag)?.textContent?.trim() || '';

const fmtData = (s) => {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return s; }
};

const fmtCNPJ = (s) => {
  const n = (s || '').replace(/\D/g, '');
  if (n.length === 14) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
  if (n.length === 11) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
  return s || '';
};

// "MUNICIPIO DE EUSEBIO" → "Eusebio"
const fmtMunicipio = (s) =>
  (s || '')
    .replace(/^MUNICIPIO\s+DE\s+/i, '')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

/* ── Município por código IBGE ──────────────────────────
   <CodigoMunicipio>2302404</CodigoMunicipio> → "Boa Viagem"
   Consulta a API pública do IBGE e guarda em cache no localStorage. */
const MUNI_CACHE_KEY = 'crescent_ibge_municipios';

const loadMuniCache = () => {
  try { return JSON.parse(localStorage.getItem(MUNI_CACHE_KEY) || '{}'); }
  catch { return {}; }
};
const saveMuniCache = (m) => {
  try { localStorage.setItem(MUNI_CACHE_KEY, JSON.stringify(m)); } catch { /* ignora */ }
};
const fetchMunicipioIBGE = async (cod) => {
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cod}`);
  if (!res.ok) throw new Error(`IBGE ${res.status}`);
  const j = await res.json();
  return j?.nome || '';
};

// XML usa ponto decimal ("23047.98"); textos BR usam vírgula ("22.685,53")
const parseBRLorXML = (s) => {
  const str = String(s ?? '').trim();
  if (!str) return NaN;
  return str.includes(',')
    ? parseFloat(str.replace(/\./g, '').replace(',', '.'))
    : parseFloat(str);
};

const fmtValorNum = (s) => {
  const n = parseBRLorXML(s);
  if (isNaN(n)) return s || '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
};

/* Extrai valor monetário do texto: "R$ 194,45" → "194,45" */
const pickBRL = (disc, pattern) => {
  const m = disc.match(pattern);
  return m?.[1]?.trim() || '0,00';
};

/* ── Extração da Discriminação ──────────────────────────
   Exemplo:
   PERIODO: 01/04/2026 a 30/04/2026 - SECRETARIA DE GOVERNO E DESENVOLVIMENTO
   REEMBOLSO DE SERVICOS DE MANUT: R$ 23.047,98
   DESCONTO DO CLIENTE: 0% ( R$ 0,00 )
   VALOR DO IR RETIDO ... 1,20% = R$ 194,45
   VALOR DO IR RETIDO ... 4,80% = R$ 168,00
   VALOR DO IR RETIDO ... 0,24% = R$ 0,00
   VALOR LIQUIDO A RECEBER DO CLIENTE: R$ 22.685,53
──────────────────────────────────────────────────────── */
const extractDisc = (disc) => {
  // Período e secretaria/setor
  const pmatch = disc.match(/PERIODO:\s*([\d\/]+)\s*a\s*([\d\/]+)\s*-\s*([^\n\r]+)/);
  const inicio = pmatch?.[1]?.trim() || '';
  const fim    = pmatch?.[2]?.trim() || '';
  const resto  = pmatch?.[3]?.trim() || '';

  const dashIdx    = resto.indexOf(' - ');
  const secretaria = dashIdx >= 0 ? resto.slice(0, dashIdx).trim() : resto;
  const setor      = dashIdx >= 0 ? resto.slice(dashIdx + 3).trim() : '';

  const tipo = /SERVICOS DE MANUT/i.test(disc) ? 'MANUTENÇÃO'
             : /SERVICOS DE ABAST/i.test(disc) ? 'ABASTECIMENTO' : '';

  // IR retidos (cada alíquota em linha separada)
  const irAbast  = pickBRL(disc, /0[,.]24%\s*=\s*R\$\s*([\d.,]+)/);  // 0,24% — abastecimento
  const irPeca   = pickBRL(disc, /1[,.]20%\s*=\s*R\$\s*([\d.,]+)/);  // 1,20% — peças
  const irServico= pickBRL(disc, /4[,.]80%\s*=\s*R\$\s*([\d.,]+)/);  // 4,80% — serviços manutenção

  // Desconto do cliente / taxa administrativa.
  // Aceita sinal negativo: "DESCONTO DO CLIENTE: 0,0% ( R$ 0,00 )" e
  // "DESCONTO DO CLIENTE: -23,5% ( R$ 5.464,69 )"
  const descMatch  = disc.match(/DESCONTO DO CLIENTE:\s*(-?[\d.,]+%)\s*\(\s*R\$\s*(-?[\d.,]+)/);
  const taxaAdm    = descMatch?.[1] || '0%';
  let   valorDesc  = descMatch?.[2] || '0,00';
  // Se a taxa é negativa mas o valor entre parênteses veio sem sinal, propaga o sinal
  if (taxaAdm.trim().startsWith('-') && !valorDesc.trim().startsWith('-') && parseBRLorXML(valorDesc) > 0)
    valorDesc = '-' + valorDesc.trim();

  // Valor líquido a receber pelo cliente (após IR retido)
  const vlrComRetencao = pickBRL(disc, /VALOR LIQUIDO A RECEBER DO CLIENTE:\s*R\$\s*([\d.,]+)/);

  return { inicio, fim, secretaria, setor, tipo, irAbast, irPeca, irServico, taxaAdm, valorDesc, vlrComRetencao };
};

const parseGinfes = (xmlStr, filename) => {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlStr, 'text/xml');

  if (doc.querySelector('parsererror'))
    return [{ error: true, filename, errorMsg: 'XML inválido ou corrompido' }];

  let infList = doc.getElementsByTagNameNS(GINFES_NS, 'InfNfse');
  if (!infList.length) infList = doc.getElementsByTagName('InfNfse');
  if (!infList.length)
    return [{ error: true, filename, errorMsg: 'Formato não reconhecido (esperado NFS-e GINFES)' }];

  return Array.from(infList).map(inf => {
    const prestador       = getEl(inf, 'PrestadorServico');
    const tomador         = getEl(inf, 'TomadorServico');
    const servico         = getEl(inf, 'Servico');
    const valores         = getEl(servico, 'Valores');
    const cpfCnpj         = getEl(tomador, 'CpfCnpj');
    const prestadorIdentif = getEl(prestador, 'IdentificacaoPrestador');

    const disc = getText(inf, 'Discriminacao');
    const d    = extractDisc(disc);

    return {
      error:          false,
      filename,
      // identificação
      numero:         getText(inf, 'Numero'),
      codigoVerif:    getText(inf, 'CodigoVerificacao'),
      chaveAcesso:    getText(inf, 'ChaveAcesso'),
      dataEmissao:    fmtData(getText(inf, 'DataEmissao')),
      // do extractDisc
      ...d,
      // tomador
      tomadorNome:    getText(tomador, 'RazaoSocial'),
      tomadorCNPJ:    getText(cpfCnpj, 'Cnpj') || getText(cpfCnpj, 'Cpf'),
      codMunicipio:   getText(tomador, 'CodigoMunicipio'),
      // prestador
      prestadorNome:  getText(prestador, 'RazaoSocial') || getText(prestador, 'NomeFantasia'),
      prestadorCNPJ:  getText(prestadorIdentif, 'Cnpj'),
      // valores NFS-e
      valorServicos:  getText(valores, 'ValorServicos'),
      valorLiquido:   getText(valores, 'ValorLiquidoNfse'),
    };
  });
};

/* ── Drop Zone ────────────────────────────────────────── */
const DropZone = ({ onFiles }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const handle = useCallback((files) => {
    const xml = [...files].filter(f => f.name.toLowerCase().endsWith('.xml'));
    if (xml.length) onFiles(xml);
  }, [onFiles]);
  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle([...e.dataTransfer.files]); }}
      style={{
        border:`2px dashed ${drag ? T.gold : T.border}`,
        borderRadius:14,padding:'40px 32px',textAlign:'center',cursor:'pointer',
        background:drag ? T.goldGl : T.surface,transition:'all .18s',
      }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
        stroke={drag ? T.gold : T.textD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
        style={{marginBottom:12}}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <div style={{fontSize:15,fontWeight:500,color:T.text,marginBottom:6}}>
        Solte os arquivos aqui ou clique para selecionar
      </div>
      <div style={{fontSize:13,color:T.textT}}>Formato aceito: <strong style={{color:T.textS}}>.xml</strong> (NFS-e GINFES) · pode soltar vários de uma vez ou ir adicionando aos poucos — tudo acumula</div>
      <input ref={inputRef} type="file" accept=".xml" multiple style={{display:'none'}}
        onChange={e => { if (e.target.files.length) handle([...e.target.files]); e.target.value=''; }}/>
    </div>
  );
};

const TipoBadge = ({ tipo }) => {
  if (!tipo) return <span style={{color:T.textD,fontSize:12}}>—</span>;
  const isManut = tipo === 'MANUTENÇÃO';
  return (
    <span style={{
      padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:600,
      background: isManut ? 'rgba(139,95,232,0.1)' : 'rgba(26,156,112,0.1)',
      color:      isManut ? '#8B5FE8' : '#1A9C70',
    }}>{tipo}</span>
  );
};

/* ── Main Tab ─────────────────────────────────────────── */
export const TabLeitorXML = () => {
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [municipios, setMunicipios] = useState(loadMuniCache);

  // Resolve nomes de município (IBGE) para os códigos ainda não conhecidos
  useEffect(() => {
    const codes = [...new Set(rows.map(r => r.codMunicipio).filter(Boolean))]
      .filter(c => !(c in municipios));
    if (!codes.length) return;
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const c of codes) {
        try { updates[c] = await fetchMunicipioIBGE(c); }
        catch { /* deixa sem resolver; usa fallback da razão social */ }
      }
      if (!cancelled && Object.keys(updates).length) {
        setMunicipios(prev => {
          const next = { ...prev, ...updates };
          saveMuniCache(next);
          return next;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [rows, municipios]);

  // Nome do município: prioriza IBGE pelo código; senão deriva da razão social
  const muniName = (r) =>
    ((r.codMunicipio && municipios[r.codMunicipio]) || fmtMunicipio(r.tomadorNome)).toUpperCase();

  const processFiles = async (files) => {
    setLoading(true);
    const results = await Promise.all(files.map(f => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(parseGinfes(e.target.result, f.name));
      reader.readAsText(f, 'UTF-8');
    })));
    const all = results.flat();
    setRows(prev => {
      const existing = new Set(prev.map(r => r.chaveAcesso || `${r.filename}_${r.numero}`));
      return [...prev, ...all.filter(r => !existing.has(r.chaveAcesso || `${r.filename}_${r.numero}`))];
    });
    setLoading(false);
  };

  const exportXLSX = () => {
    const valid = rows.filter(r => !r.error);
    if (!valid.length) return;

    const data = valid.map(r => ({
      'INICIO':            r.inicio,
      'FINAL':             r.fim,
      'CNPJ':              fmtCNPJ(r.tomadorCNPJ),
      'MUNICIPIO':         muniName(r),
      'SECRETARIA / SETOR': r.setor ? `${r.secretaria} - ${r.setor}` : r.secretaria,
      'VALOR BRUTO':       fmtValorNum(r.valorServicos),
      'CATEGORIA':         r.tipo,
      'IR ABAST':          r.irAbast,
      'IR PEÇA':           r.irPeca,
      'IR SERVIÇO':        r.irServico,
      'TAXA ADM':          r.taxaAdm,
      'VALOR DESCONTO':    r.valorDesc,
      'VALOR LÍQUIDO':     fmtValorNum(r.valorLiquido),
      'VALOR BRUTO ':      fmtValorNum(r.valorServicos),   // espaço extra para evitar col duplicada no XLSX
      'VALOR C/ RETENÇÃO': r.vlrComRetencao,
      'NOTA':              r.numero,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      {wch:12},{wch:12},{wch:20},{wch:28},{wch:42},
      {wch:14},{wch:14},{wch:12},{wch:12},{wch:12},
      {wch:10},{wch:14},{wch:14},{wch:14},{wch:16},{wch:10},
    ];

    // Cabeçalho em negrito (linha 1)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r:0, c:C })];
      if (cell) cell.s = { font:{ bold:true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faturamento');
    XLSX.writeFile(wb, `nfse_faturamento_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
  };

  const valid     = rows.filter(r => !r.error);
  const errors    = rows.filter(r => r.error);
  const fileCount = new Set(rows.map(r => r.filename)).size;
  const filtered = valid.filter(r => {
    if (filterTipo !== 'todos' && r.tipo !== filterTipo) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.secretaria||'').toLowerCase().includes(q)
        || (r.setor||'').toLowerCase().includes(q)
        || (r.tomadorNome||'').toLowerCase().includes(q)
        || (muniName(r)||'').toLowerCase().includes(q)
        || (r.numero||'').includes(q)
        || (r.inicio||'').includes(q);
  });

  return (
    <div>
      <StellarHero compact
        eyebrow="Nota Fiscal · Excel"
        title="Leitor de XML"
        subtitle="Importa arquivos NFS-e (formato GINFES) e exporta para Excel no formato da planilha de faturamento."
        icon={(
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
        )}
      />


      <div style={{marginBottom:24}}>
        <DropZone onFiles={processFiles}/>
      </div>

      {loading && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 18px',background:T.goldGl,borderRadius:10,marginBottom:20,fontSize:14,color:T.textS}}>
          <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite'}}/>
          Processando arquivos...
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Toolbar */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,flex:1,minWidth:200}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar por secretaria, município, número..."
                style={{flex:1,border:'none',background:'transparent',outline:'none',fontSize:14,color:T.text,fontFamily:'var(--font-body)'}}/>
            </div>

            <select value={filterTipo} onChange={e=>setFilterTipo(e.target.value)}
              style={{padding:'8px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',cursor:'pointer',outline:'none'}}>
              <option value="todos">Todos os tipos</option>
              <option value="MANUTENÇÃO">Manutenção</option>
              <option value="ABASTECIMENTO">Abastecimento</option>
            </select>

            <div style={{padding:'6px 14px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:10,fontSize:13,color:T.textS}}>
              <strong style={{color:T.text}}>{valid.length}</strong> NFS-e carregada{valid.length!==1?'s':''}
              <span style={{color:T.textT,marginLeft:6}}>· {fileCount} arquivo{fileCount!==1?'s':''}</span>
              {errors.length > 0 && <span style={{color:T.danger,marginLeft:6}}>· {errors.length} erro{errors.length!==1?'s':''}</span>}
            </div>

            <button onClick={exportXLSX} disabled={!valid.length}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 20px',borderRadius:10,border:'none',
                background:valid.length?T.gold:'transparent',color:valid.length?'#fff':T.textD,
                fontSize:14,fontWeight:600,cursor:valid.length?'pointer':'not-allowed',
                fontFamily:'var(--font-body)',transition:'all .15s'}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar Excel
            </button>

            <button onClick={()=>setRows([])}
              style={{padding:'9px 14px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',color:T.textS,fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>
              Limpar
            </button>
          </div>

          {errors.length > 0 && (
            <div style={{background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:T.danger,marginBottom:6}}>Arquivos com erro:</div>
              {errors.map((e,i) => (
                <div key={i} style={{fontSize:13,color:T.textS,marginBottom:2}}>
                  <strong>{e.filename}</strong> — {e.errorMsg}
                </div>
              ))}
            </div>
          )}

          {/* Tabela de preview (colunas resumidas para visualização) */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:'hidden',boxShadow:T.sh}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)',fontSize:13}}>
                <thead>
                  <tr style={{background:T.goldGl,borderBottom:`1px solid ${T.border}`}}>
                    {['Nota','Início','Fim','Município','Secretaria / Setor','Categoria','V. Bruto','IR Abast','IR Peça','IR Serviço','V. Líquido','V. c/ Retenção'].map(h => (
                      <th key={h} style={{padding:'12px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:T.textS,letterSpacing:'.05em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.chaveAcesso||i}
                      style={{borderBottom:`1px solid ${T.divider}`,transition:'background .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'10px 14px',color:T.text,fontWeight:600}}>{r.numero}</td>
                      <td style={{padding:'10px 14px',color:T.textS,whiteSpace:'nowrap'}}>{r.inicio}</td>
                      <td style={{padding:'10px 14px',color:T.textS,whiteSpace:'nowrap'}}>{r.fim}</td>
                      <td style={{padding:'10px 14px',color:T.text,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.tomadorNome}>{muniName(r)}</td>
                      <td style={{padding:'10px 14px',color:T.text,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                        title={r.setor ? `${r.secretaria} - ${r.setor}` : r.secretaria}>
                        {r.setor ? <>{r.secretaria} <span style={{color:T.textT}}>/ {r.setor}</span></> : r.secretaria}
                      </td>
                      <td style={{padding:'10px 14px'}}><TipoBadge tipo={r.tipo}/></td>
                      <td style={{padding:'10px 14px',color:T.text,fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{fmtValorNum(r.valorServicos)}</td>
                      <td style={{padding:'10px 14px',color:T.textS,textAlign:'right',whiteSpace:'nowrap'}}>{r.irAbast}</td>
                      <td style={{padding:'10px 14px',color:T.textS,textAlign:'right',whiteSpace:'nowrap'}}>{r.irPeca}</td>
                      <td style={{padding:'10px 14px',color:T.textS,textAlign:'right',whiteSpace:'nowrap'}}>{r.irServico}</td>
                      <td style={{padding:'10px 14px',color:T.textS,textAlign:'right',whiteSpace:'nowrap'}}>{fmtValorNum(r.valorLiquido)}</td>
                      <td style={{padding:'10px 14px',color:T.text,fontWeight:500,textAlign:'right',whiteSpace:'nowrap'}}>{r.vlrComRetencao}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={12} style={{padding:'32px',textAlign:'center',color:T.textT,fontSize:14}}>
                        {search || filterTipo !== 'todos' ? 'Nenhum resultado para o filtro aplicado' : 'Nenhuma NFS-e carregada'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div style={{padding:'12px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:28,fontSize:13,background:T.goldGl,flexWrap:'wrap'}}>
                <span style={{color:T.textS}}>
                  <strong style={{color:T.text}}>{filtered.length}</strong> NFS-e
                </span>
                <span style={{color:T.textS}}>
                  Total bruto: <strong style={{color:T.text}}>
                    {fmtValorNum(String(filtered.reduce((s,r)=>s+(parseBRLorXML(r.valorServicos)||0),0)))}
                  </strong>
                </span>
                <span style={{color:T.textS}}>
                  Total c/ retenção: <strong style={{color:T.text}}>
                    {fmtValorNum(String(
                      filtered.reduce((s,r) => s + (parseBRLorXML(r.vlrComRetencao) || 0), 0)
                    ))}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {rows.length === 0 && !loading && (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 32px',textAlign:'center'}}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.1" strokeLinecap="round" style={{marginBottom:14}}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
          <div style={{fontSize:15,fontWeight:500,color:T.textT,marginBottom:4}}>Nenhum arquivo carregado</div>
          <div style={{fontSize:13,color:T.textD}}>Selecione os arquivos .xml acima para começar</div>
        </div>
      )}
    </div>
  );
};
