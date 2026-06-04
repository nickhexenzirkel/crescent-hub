import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { T } from '../../../contexts/theme';

/* ── NF-e XML Parser ──────────────────────────────────── */
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

const getEl = (parent, tag) => {
  return parent?.getElementsByTagNameNS(NFE_NS, tag)[0]
      || parent?.getElementsByTagName(tag)[0]
      || null;
};

const getText = (parent, tag) => getEl(parent, tag)?.textContent?.trim() || '';

const fmtData = (s) => {
  if (!s) return '';
  try {
    const d = s.length > 10 ? new Date(s) : new Date(s + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch { return s; }
};

const fmtCNPJ = (s) => {
  const n = s.replace(/\D/g, '');
  if (n.length === 14) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
  if (n.length === 11) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
  return s;
};

const fmtValor = (s) => {
  const n = parseFloat(s);
  if (isNaN(n)) return s || '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseNFe = (xmlStr, filename) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'text/xml');

  if (doc.querySelector('parsererror')) {
    return { error: true, filename, errorMsg: 'XML inválido ou corrompido' };
  }

  const infNFe = getEl(doc, 'infNFe');
  if (!infNFe) {
    return { error: true, filename, errorMsg: 'Formato NF-e não reconhecido' };
  }

  const ide   = getEl(infNFe, 'ide');
  const emit  = getEl(infNFe, 'emit');
  const dest  = getEl(infNFe, 'dest');
  const total = getEl(infNFe, 'total');
  const infProt = getEl(doc, 'infProt');

  const chave = infProt
    ? getText(infProt, 'chNFe')
    : (infNFe.getAttribute('Id') || '').replace(/^NFe/, '');

  return {
    error: false,
    filename,
    chave,
    numero:    getText(ide, 'nNF'),
    serie:     getText(ide, 'serie'),
    data:      fmtData(getText(ide, 'dhEmi') || getText(ide, 'dEmi')),
    natureza:  getText(ide, 'natOp'),
    nomeEmit:  getText(emit, 'xNome'),
    cnpjEmit:  getText(emit, 'CNPJ') || getText(emit, 'CPF'),
    nomeDest:  getText(dest, 'xNome'),
    cnpjDest:  getText(dest, 'CNPJ') || getText(dest, 'CPF'),
    valor:     getText(total, 'vNF') || getText(infNFe, 'vNF'),
  };
};

/* ── Drop Zone ──────────────────────────────────────────── */
const DropZone = ({ onFiles, accept = '.xml', multiple = true, label = 'Solte os arquivos aqui ou clique para selecionar' }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
    const files = [...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.xml'));
    if (files.length) onFiles(files);
  }, [onFiles]);

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${drag ? T.gold : T.border}`,
        borderRadius: 14, padding: '40px 32px',
        textAlign: 'center', cursor: 'pointer',
        background: drag ? T.goldGl : T.surface,
        transition: 'all .18s',
      }}>
      <div style={{fontSize:36,marginBottom:12}}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={drag ? T.gold : T.textD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div style={{fontSize:15,fontWeight:500,color:T.text,marginBottom:6}}>{label}</div>
      <div style={{fontSize:13,color:T.textT}}>Formatos aceitos: <strong style={{color:T.textS}}>.xml</strong> (NF-e)</div>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} style={{display:'none'}}
        onChange={e => { if (e.target.files.length) onFiles([...e.target.files]); }}/>
    </div>
  );
};

/* ── Main Tab ───────────────────────────────────────────── */
export const TabLeitorXML = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const processFiles = async (files) => {
    setLoading(true);
    const results = await Promise.all(files.map(f => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(parseNFe(e.target.result, f.name));
      reader.readAsText(f, 'UTF-8');
    })));
    setRows(prev => {
      const existing = new Set(prev.map(r => r.chave || r.filename));
      const novas = results.filter(r => !existing.has(r.chave || r.filename));
      return [...prev, ...novas];
    });
    setLoading(false);
  };

  const exportXLSX = () => {
    if (!rows.length) return;
    const valid = rows.filter(r => !r.error);
    const data = valid.map(r => ({
      'Nº NF':            r.numero,
      'Série':            r.serie,
      'Data Emissão':     r.data,
      'Natureza':         r.natureza,
      'Emitente':         r.nomeEmit,
      'CNPJ Emitente':    fmtCNPJ(r.cnpjEmit),
      'Destinatário':     r.nomeDest,
      'CNPJ Destinatário':fmtCNPJ(r.cnpjDest),
      'Valor (R$)':       fmtValor(r.valor),
      'Chave NF-e':       r.chave,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faturamento');
    const wscols = [
      {wch:8},{wch:6},{wch:13},{wch:24},{wch:32},{wch:20},{wch:32},{wch:20},{wch:14},{wch:48},
    ];
    ws['!cols'] = wscols;
    XLSX.writeFile(wb, `faturamento_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.nomeEmit||'').toLowerCase().includes(q)
        || (r.nomeDest||'').toLowerCase().includes(q)
        || (r.numero||'').includes(q)
        || (r.data||'').includes(q);
  });

  const valid = rows.filter(r => !r.error);
  const errors = rows.filter(r => r.error);

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:700,color:T.text,marginBottom:6}}>Leitor de XML</h2>
        <p style={{fontSize:14,color:T.textS,lineHeight:1.6}}>
          Importe arquivos NF-e (.xml) e exporte os dados para Excel no formato da planilha de faturamento.
        </p>
      </div>

      {/* Upload zone */}
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
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,flex:1,minWidth:220}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar por emitente, destinatário ou Nº NF..."
                style={{flex:1,border:'none',background:'transparent',outline:'none',fontSize:14,color:T.text,fontFamily:'var(--font-body)'}}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 14px',background:T.goldGl,borderRadius:10,fontSize:13,color:T.textS,border:`1px solid ${T.gold}22`}}>
              <strong style={{color:T.text}}>{valid.length}</strong> NF{valid.length !== 1 ? 's' : ''} carregadas
              {errors.length > 0 && <span style={{color:T.danger,marginLeft:6}}> · {errors.length} erro{errors.length !== 1 ? 's' : ''}</span>}
            </div>
            <button
              onClick={exportXLSX}
              disabled={valid.length === 0}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 20px',borderRadius:10,border:'none',background:valid.length?T.gold:'transparent',color:valid.length?'#fff':T.textD,fontSize:14,fontWeight:600,cursor:valid.length?'pointer':'not-allowed',fontFamily:'var(--font-body)',transition:'all .15s'}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar Excel
            </button>
            {rows.length > 0 && (
              <button
                onClick={() => setRows([])}
                style={{padding:'9px 16px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',color:T.textS,fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>
                Limpar
              </button>
            )}
          </div>

          {/* Errors */}
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

          {/* Table */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:'hidden',boxShadow:T.sh}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)',fontSize:13}}>
                <thead>
                  <tr style={{background:T.goldGl,borderBottom:`1px solid ${T.border}`}}>
                    {['Nº','Série','Data','Emitente','CNPJ Emit.','Destinatário','CNPJ Dest.','Valor (R$)'].map(h => (
                      <th key={h} style={{padding:'12px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:T.textS,letterSpacing:'.05em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.filter(r=>!r.error).map((r, i) => (
                    <tr key={r.chave||i} style={{borderBottom:`1px solid ${T.divider}`,transition:'background .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'11px 14px',color:T.text,fontWeight:500,whiteSpace:'nowrap'}}>{r.numero}</td>
                      <td style={{padding:'11px 14px',color:T.textS}}>{r.serie}</td>
                      <td style={{padding:'11px 14px',color:T.textS,whiteSpace:'nowrap'}}>{r.data}</td>
                      <td style={{padding:'11px 14px',color:T.text,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.nomeEmit}>{r.nomeEmit}</td>
                      <td style={{padding:'11px 14px',color:T.textT,fontFamily:'monospace',fontSize:12,whiteSpace:'nowrap'}}>{fmtCNPJ(r.cnpjEmit)}</td>
                      <td style={{padding:'11px 14px',color:T.text,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.nomeDest}>{r.nomeDest}</td>
                      <td style={{padding:'11px 14px',color:T.textT,fontFamily:'monospace',fontSize:12,whiteSpace:'nowrap'}}>{fmtCNPJ(r.cnpjDest)}</td>
                      <td style={{padding:'11px 14px',color:T.text,fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{fmtValor(r.valor)}</td>
                    </tr>
                  ))}
                  {filtered.filter(r=>!r.error).length === 0 && (
                    <tr>
                      <td colSpan={8} style={{padding:'32px',textAlign:'center',color:T.textT,fontSize:14}}>
                        Nenhum resultado encontrado para "<strong>{search}</strong>"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {rows.length === 0 && !loading && (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 32px',color:T.textD,textAlign:'center'}}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" style={{marginBottom:14,opacity:.4}}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
          <div style={{fontSize:15,fontWeight:500,color:T.textT,marginBottom:4}}>Nenhum arquivo carregado</div>
          <div style={{fontSize:13,color:T.textD}}>Selecione os arquivos XML acima para começar</div>
        </div>
      )}
    </div>
  );
};
