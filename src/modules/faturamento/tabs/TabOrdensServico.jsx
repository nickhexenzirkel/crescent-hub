import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { T } from '../../../contexts/theme';
import { SERVER_URL } from '../../../contexts/user';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const CURRENT_YEAR = new Date().getFullYear();
const ANOS = Array.from({length:5}, (_, i) => CURRENT_YEAR - i);

const readXLSX = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      resolve(rows);
    } catch (err) { reject(err); }
  };
  reader.readAsArrayBuffer(file);
});

/* ── Drop Zone ──────────────────────────────────────────────── */
const DropZoneXLSX = ({ onFile }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handle = useCallback((files) => {
    const f = files.find(f => /\.(xlsx|xls)$/i.test(f.name));
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle([...e.dataTransfer.files]); }}
      style={{
        border:`2px dashed ${drag ? T.gold : T.border}`,
        borderRadius:12,padding:'32px 24px',textAlign:'center',cursor:'pointer',
        background:drag ? T.goldGl : T.surface,transition:'all .18s',
      }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={drag?T.gold:T.textD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:12}}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
      <div style={{fontSize:14,fontWeight:500,color:T.text,marginBottom:4}}>
        Relatório de retenção de tributos
      </div>
      <div style={{fontSize:12,color:T.textT}}>Arraste ou clique para selecionar · .xlsx, .xls</div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{display:'none'}}
        onChange={e => { if (e.target.files[0]) handle([e.target.files[0]]); }}/>
    </div>
  );
};

/* ── Section ────────────────────────────────────────────────── */
const Section = ({n, title, done, children}) => (
  <div style={{marginBottom:28}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
      <div style={{width:28,height:28,borderRadius:'50%',
        background:done?T.gold:T.goldGl,border:`2px solid ${done?T.gold:T.gold+'44'}`,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:12,fontWeight:700,color:done?'#fff':T.gold,flexShrink:0,transition:'all .2s'}}>
        {done
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          : n}
      </div>
      <span style={{fontSize:15,fontWeight:600,color:T.text}}>{title}</span>
    </div>
    <div style={{paddingLeft:40}}>{children}</div>
  </div>
);

/* ── Log ────────────────────────────────────────────────────── */
const Log = ({lines}) => {
  const ref = useRef();
  React.useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{background:'#0D1117',borderRadius:10,padding:'16px',height:220,
      overflowY:'auto',fontFamily:'monospace',fontSize:12.5,lineHeight:1.7,border:`1px solid ${T.border}`}}>
      {lines.length === 0
        ? <span style={{color:'#4A5568'}}>// aguardando início...</span>
        : lines.map((l,i) => (
          <div key={i} style={{color:l.type==='error'?'#FC8181':l.type==='ok'?'#68D391':l.type==='info'?'#90CDF4':'#CBD5E0'}}>
            {l.text}
          </div>
        ))}
    </div>
  );
};

/* ── Main Tab ───────────────────────────────────────────────── */
export const TabOrdensServico = () => {
  const [mainFile, setMainFile]     = useState(null);
  const [fileInfo, setFileInfo]     = useState(null);
  const [mes, setMes]               = useState(new Date().getMonth());
  const [ano, setAno]               = useState(CURRENT_YEAR);
  const [outputPath, setOutputPath] = useState('');
  const [log, setLog]               = useState([]);
  const [running, setRunning]       = useState(false);
  const [done, setDone]             = useState(false);

  const addLog = (text, type='normal') => setLog(prev => [...prev, {text, type}]);

  const loadFile = async (f) => {
    setMainFile(f);
    setFileInfo(null);
    try {
      const rows = await readXLSX(f);
      const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));
      setFileInfo({ name: f.name, rows: dataRows.length });
    } catch { addLog('Erro ao ler o arquivo XLSX.', 'error'); }
  };

  const startDownload = async () => {
    if (!mainFile) return;
    setRunning(true);
    setDone(false);
    setLog([]);
    addLog(`[${new Date().toLocaleTimeString('pt-BR')}] Iniciando download de Ordens de Serviço...`, 'info');
    addLog(`Período: ${MESES[mes]}/${ano}`, 'normal');
    if (outputPath) addLog(`Pasta de saída: ${outputPath}`, 'normal');
    addLog('Conectando ao servidor...', 'normal');

    try {
      const form = new FormData();
      form.append('mainFile', mainFile);
      form.append('mes', String(mes + 1));
      form.append('ano', String(ano));
      form.append('outputPath', outputPath);

      const res = await fetch(`${SERVER_URL}/api/faturamento/ordens/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ch_token')}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addLog(`Erro do servidor: ${err.message || res.statusText}`, 'error');
        setRunning(false); return;
      }

      const { jobId } = await res.json();
      addLog(`Job criado: ${jobId}`, 'info');
      addLog('Processando ordens...', 'normal');

      const poll = setInterval(async () => {
        try {
          const s = await fetch(`${SERVER_URL}/api/faturamento/ordens/status/${jobId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('ch_token')}` },
          }).then(r => r.json());

          if (s.logs?.length) s.logs.forEach(l => addLog(l.text, l.type || 'normal'));

          if (s.status === 'done') {
            clearInterval(poll);
            addLog(`[${new Date().toLocaleTimeString('pt-BR')}] Concluído! ${s.total || ''} arquivo(s) baixado(s).`, 'ok');
            setRunning(false); setDone(true);
          }
          if (s.status === 'error') {
            clearInterval(poll);
            addLog(s.message || 'Erro durante o download.', 'error');
            setRunning(false);
          }
        } catch { clearInterval(poll); addLog('Perda de conexão com o servidor.', 'error'); setRunning(false); }
      }, 2000);

    } catch {
      addLog(`Servidor não encontrado em ${SERVER_URL}. Verifique se o servidor está ativo.`, 'error');
      setRunning(false);
    }
  };

  const step1Done = !!mainFile && !!fileInfo;
  const step2Done = step1Done;

  return (
    <div>
      <div style={{marginBottom:28}}>
        <h2 style={{fontSize:22,fontWeight:700,color:T.text,marginBottom:6}}>Ordens de Serviço</h2>
        <p style={{fontSize:14,color:T.textS,lineHeight:1.6}}>
          Baixa automaticamente os PDFs de Ordens de Serviço do sistema 7Benefícios com base no relatório de retenção de tributos.
        </p>
      </div>

      {/* Step 1 — Upload */}
      <Section n={1} title="Envie o Relatório de Retenção de Tributos" done={step1Done}>
        {!mainFile
          ? <DropZoneXLSX onFile={loadFile}/>
          : (
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:12}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500,color:T.text}}>{mainFile.name}</div>
                {fileInfo && <div style={{fontSize:12,color:T.textT}}>{fileInfo.rows} linha{fileInfo.rows!==1?'s':''} de dados</div>}
              </div>
              <button onClick={()=>{setMainFile(null);setFileInfo(null);}}
                style={{background:'none',border:'none',cursor:'pointer',color:T.danger,fontSize:12,fontFamily:'var(--font-body)'}}>Remover</button>
            </div>
          )}
      </Section>

      {/* Step 2 — Config */}
      {step1Done && (
        <Section n={2} title="Configure o período e pasta de saída" done={step2Done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:16,alignItems:'end'}}>
            <div>
              <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Mês de referência</label>
              <select value={mes} onChange={e=>setMes(Number(e.target.value))}
                style={{width:'100%',padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',cursor:'pointer',outline:'none'}}>
                {MESES.map((m,i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Ano</label>
              <select value={ano} onChange={e=>setAno(Number(e.target.value))}
                style={{width:'100%',padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',cursor:'pointer',outline:'none'}}>
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Pasta de destino <span style={{fontWeight:400,color:T.textD}}>(opcional)</span></label>
              <input
                value={outputPath} onChange={e=>setOutputPath(e.target.value)}
                placeholder="Ex: C:\Relatórios\Ordens de Serviço"
                style={{width:'100%',padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
        </Section>
      )}

      {/* Step 3 — Start */}
      {step2Done && (
        <Section n={3} title="Iniciar download automático" done={done}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20,flexWrap:'wrap'}}>
            <button
              onClick={startDownload}
              disabled={running}
              style={{
                display:'flex',alignItems:'center',gap:10,padding:'12px 28px',borderRadius:12,
                border:'none',background:running?T.textD:T.gold,color:'#fff',
                fontSize:15,fontWeight:700,cursor:running?'not-allowed':'pointer',
                fontFamily:'var(--font-body)',transition:'all .15s',
                boxShadow:running?'none':`0 4px 16px ${T.gold}44`,
              }}>
              {running
                ? <><div style={{width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',animation:'spin .7s linear infinite'}}/> Baixando...</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Iniciar Download</>}
            </button>
            {done && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#1A9C70',fontSize:14,fontWeight:500}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Download concluído!
              </div>
            )}
          </div>
          <Log lines={log}/>
        </Section>
      )}
    </div>
  );
};
