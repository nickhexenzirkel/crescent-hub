// Dashboard RH → Contracheques → modo "Gerado pelo Uniko". Monta o "Recibo
// de Pagamento" (ver ReciboPagamento.jsx, réplica do modelo do contador) com
// os dados já cadastrados do funcionário, tira um PDF (html2canvas + jsPDF,
// mesma técnica de faturamento/tabs/TabOficinaEstelar.jsx) e anexa na MESMA
// tabela/bucket `contracheques` que o modo manual usa — o resto do app
// (Portal → Financeiro) não precisa saber de onde o PDF veio.
//
// ⚠️ INSS/IRRF ainda são os valores digitados no cadastro do funcionário
// (Gerenciar Usuários → Editar Perfil), não uma tabela progressiva oficial —
// isso fica pra quando o dono confirmar as faixas vigentes. FGTS (8%) é
// cálculo fixo, esse sim seguro de automatizar.
import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { T } from '../../contexts/theme';
import { supabase, SERVER_URL } from '../../contexts/user';
import { ReciboPagamento, PAGE_W } from './ReciboPagamento';
import { loadContrachequeDados, saveContrachequeDados } from '../../shared/contrachequeDados';

// Dados fixos da empresa — tirados do próprio modelo enviado (Julho/2026).
// Muda raríssimo; se precisar trocar um dia, é só editar aqui.
const EMPREGADOR = { nome: '7SERV GESTAO DE BENEFICIOS LTDA', cnpj: '13.858.769/0001-97' };

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const safeKeyPart = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[\\/]/g, '-').replace(/\s+/g, '_').replace(/[^\w.-]/g, '');

const formatCpf = (v) => {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (v || '');
};

const authHeader = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` });

const inputSt = (T, ok) => ({
  width: '100%', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${ok ? T.goldLine + '88' : T.border}`,
  fontFamily: 'var(--font-body)', fontSize: 13, color: T.text, background: T.surface || '#fff', outline: 'none', boxSizing: 'border-box',
});

const ContrachequeGeradoUniko = ({ cardBg, empList, onGerado }) => {
  const agora = new Date();
  const [empId, setEmpId] = useState('');
  const [mes, setMes] = useState(MESES[agora.getMonth()]);
  const [ano, setAno] = useState(String(agora.getFullYear()));

  const [carregando, setCarregando] = useState(false);
  const [emp, setEmp] = useState(null);      // registro completo (CPF/nome/cargo/admissão — só leitura aqui)
  const [matricula, setMatricula] = useState('');
  const [lotacao, setLotacao] = useState('GERAL');
  const [salvandoDados, setSalvandoDados] = useState(false);
  // Valores do contracheque — pedido explícito: CPF e nome ficam travados no
  // que já está cadastrado, mas salário/INSS/IRRF/matrícula o admin pode
  // digitar na hora (pré-preenchidos com o que está no cadastro, só como
  // ponto de partida — o mês pode ter sido diferente do cadastro padrão).
  const [salarioInput, setSalarioInput] = useState('');
  const [inssInput, setInssInput] = useState('');
  const [irInput, setIrInput] = useState('');

  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState('');
  const previewId = 'recibo-uniko-preview';

  // Carrega o funcionário escolhido: registro completo (CPF/nome/salário/INSS
  // não vêm na listagem — precisa buscar /api/employees/:id, mesmo padrão já
  // usado pro Banco Extra) + matrícula/lotação (tabela própria, ver
  // contrachequeDados.js). Os campos de valor só usam isso como SUGESTÃO
  // inicial — depois de carregado, o admin edita livremente.
  useEffect(() => {
    if (!empId) { setEmp(null); setMatricula(''); setLotacao('GERAL'); setSalarioInput(''); setInssInput(''); setIrInput(''); return; }
    let vivo = true;
    setCarregando(true);
    Promise.all([
      fetch(`${SERVER_URL}/api/employees/${empId}`, { headers: authHeader() }).then(r => r.json()).catch(() => null),
      loadContrachequeDados(empId),
    ]).then(([d, dados]) => {
      if (!vivo) return;
      const ficha = d?.employee || null;
      setEmp(ficha);
      setMatricula(dados.matricula);
      setLotacao(dados.lotacao);
      setSalarioInput(ficha?.salary ? String(ficha.salary) : '');
      setInssInput(ficha?.inss ? String(ficha.inss) : '');
      setIrInput(ficha?.ir ? String(ficha.ir) : '');
    }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [empId]);

  const salvarMatriculaLotacao = async () => {
    if (!empId) return;
    setSalvandoDados(true);
    try { await saveContrachequeDados(empId, { matricula, lotacao }); }
    catch { setMsg('❌ Não consegui salvar matrícula/lotação.'); setTimeout(() => setMsg(''), 3500); }
    setSalvandoDados(false);
  };

  const salario = Number(salarioInput.replace(',', '.')) || 0;
  const inss = Number(inssInput.replace(',', '.')) || 0;
  const ir = Number(irInput.replace(',', '.')) || 0;
  const fgts = +(salario * 0.08).toFixed(2);

  // 1K Service NUNCA entra no contracheque (pedido explícito do dono,
  // 17/10/2026) — mesmo que o funcionário tenha o campo `vt` preenchido.
  const verbas = [
    salario > 0 && { cod: '011', descricao: 'Salário-Base', referencia: '30 dia(s)', provento: salario },
    inss > 0 && { cod: '310', descricao: 'INSS', referencia: salario ? `${((inss / salario) * 100).toFixed(0)}%` : '', desconto: inss },
    ir > 0 && { cod: '', descricao: 'IRRF', referencia: '', desconto: ir },
  ].filter(Boolean);

  const competenciaDoc = `${mes} de ${ano}`;       // mostrado no PDF, igual ao modelo
  const competenciaSalva = `${mes}/${ano}`;         // gravado no banco, mesmo formato do modo manual

  const empregadoProps = emp ? {
    nome: emp.name || '', matricula, cargo: emp.cargo || '', lotacao,
    admissao: emp.admission || '', competencia: competenciaDoc,
    cpf: formatCpf(emp.cpf), banco: '', agencia: '', conta: '', tipoConta: '',
    salarioContratual: salario, baseInss: salario, baseFgts: salario, fgts,
    fgtsContribSocial: 0, baseIrrf: 0,
  } : null;

  const podeGerar = !!emp && salario > 0 && !!mes && !!ano;

  const gerarEAnexar = async () => {
    if (!podeGerar) return;
    setGerando(true); setMsg('');
    try {
      const src = document.getElementById(previewId);
      if (!src) throw new Error('Pré-visualização não encontrada.');
      // Captura uma CÓPIA solta no <body>, na largura exata do papel, longe de
      // qualquer ancestral com overflow/scroll/zoom: com a prévia dentro do
      // painel (que é mais estreito que o recibo e rola pro lado), o
      // html2canvas cortava tudo que passava da borda visível do painel — o
      // PDF saía sem Competência, Provento, Desconto, totais etc. (bug de
      // 18/10/2026).
      const copia = src.cloneNode(true);
      copia.removeAttribute('id');
      const suporte = document.createElement('div');
      suporte.style.cssText = `position:fixed;left:0;top:0;width:${PAGE_W}px;z-index:-9999;pointer-events:none;background:#fff`;
      suporte.appendChild(copia);
      document.body.appendChild(suporte);
      let canvas, wMm, hMm;
      try {
        await new Promise(r => setTimeout(r, 60)); // setTimeout (não rAF): rAF congela com a aba em segundo plano
        const wPx = PAGE_W, hPx = copia.offsetHeight;
        canvas = await html2canvas(copia, { scale: 3, useCORS: true, backgroundColor: '#ffffff', x: 0, y: 0, scrollX: 0, scrollY: 0, width: wPx, height: hPx, windowWidth: wPx, windowHeight: hPx });
        wMm = wPx * 25.4 / 96; hMm = hPx * 25.4 / 96;
      } finally { suporte.remove(); }
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'mm', format: [wMm, hMm] });
      pdf.addImage(imgData, 'PNG', 0, 0, wMm, hMm);
      const blob = pdf.output('blob');

      const safeName = safeKeyPart(emp.name);
      const safeComp = safeKeyPart(competenciaSalva);
      const filePath = `${safeName}/${safeComp}_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from('contracheques').upload(filePath, blob, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw new Error('Erro no upload: ' + upErr.message);
      const { data: urlData } = supabase.storage.from('contracheques').getPublicUrl(filePath);
      const { error: insErr } = await supabase.from('contracheques').insert({
        employee_name: emp.name, competencia: competenciaSalva, file_url: urlData.publicUrl, storage_path: filePath, created_at: new Date().toISOString(),
      });
      if (insErr) throw new Error('Erro ao salvar: ' + insErr.message);

      setMsg('✅ Contracheque gerado e anexado com sucesso!');
      onGerado?.();
    } catch (e) {
      setMsg('❌ ' + (e.message || 'Falha ao gerar o contracheque.'));
    }
    setGerando(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(200,150,10,0.08)', border: '1px solid rgba(200,150,10,0.3)', fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>
        ⚠️ Salário-Base/INSS/IRRF vêm pré-preenchidos do cadastro do funcionário, mas são editáveis na hora — mudar aqui
        não altera o cadastro, vale só pra este contracheque. Ainda não é o cálculo automático pela tabela oficial de
        INSS/IRRF (falta confirmar as faixas vigentes); FGTS (8% do Salário-Base digitado) esse sim é calculado sozinho.
        Confira o PDF gerado contra um contracheque real antes de confiar nele de olhos fechados.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Formulário ── */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Gerar contracheque</div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Funcionário</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} style={inputSt(T, !!empId)}>
              <option value="">Selecione…</option>
              {empList.filter(e => e.active !== false).sort((a, b) => a.name.localeCompare(b.name)).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Mês</label>
              <select value={mes} onChange={e => setMes(e.target.value)} style={inputSt(T, true)}>
                {MESES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Ano</label>
              <input value={ano} onChange={e => setAno(e.target.value.replace(/\D/g, '').slice(0, 4))} style={inputSt(T, true)}/>
            </div>
          </div>

          {carregando && <div style={{ fontSize: 12.5, color: T.textT }}>Carregando dados do funcionário…</div>}

          {emp && !carregando && (
            <>
              {/* CPF e nome ficam travados no que já está cadastrado — pedido explícito. */}
              <div style={{ fontSize: 12.5, color: T.textS, background: T.surfaceSub || 'rgba(0,0,0,0.04)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.7 }}>
                {emp.name}<br/>CPF {formatCpf(emp.cpf)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Matrícula</label>
                  <input value={matricula} onChange={e => setMatricula(e.target.value)} onBlur={salvarMatriculaLotacao}
                    placeholder="Ex: 000012" style={inputSt(T, !!matricula)}/>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Lotação</label>
                  <input value={lotacao} onChange={e => setLotacao(e.target.value)} onBlur={salvarMatriculaLotacao}
                    style={inputSt(T, true)}/>
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.textT }}>
                {salvandoDados ? 'Salvando matrícula/lotação…' : 'Matrícula/lotação ficam salvas pro próximo contracheque deste funcionário.'}
              </div>

              {/* Valores do mês — pré-preenchidos com o cadastro, editáveis na hora
                  (não gravam no cadastro do funcionário, só valem pra este PDF). */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Salário-Base (R$)</label>
                  <input value={salarioInput} onChange={e => setSalarioInput(e.target.value.replace(/[^\d.,]/g, ''))}
                    placeholder="0,00" style={inputSt(T, !!salarioInput)}/>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Desconto INSS (R$)</label>
                  <input value={inssInput} onChange={e => setInssInput(e.target.value.replace(/[^\d.,]/g, ''))}
                    placeholder="0,00" style={inputSt(T, !!inssInput)}/>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }}>Desconto IRRF (R$)</label>
                <input value={irInput} onChange={e => setIrInput(e.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00 (deixe em branco se não houver)" style={inputSt(T, !!irInput)}/>
              </div>

              <div style={{ fontSize: 12, color: T.textT }}>FGTS (8% do Salário-Base, calculado sozinho): <strong style={{ color: T.text }}>R$ {fgts.toFixed(2)}</strong></div>
              {salario === 0 && <div style={{ fontSize: 12, color: T.danger }}>Preencha o Salário-Base pra gerar o contracheque.</div>}
            </>
          )}

          {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('✅') ? '#16a34a' : '#C04050', padding: '8px 12px', borderRadius: 9, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)' }}>{msg}</div>}

          <button onClick={gerarEAnexar} disabled={!podeGerar || gerando}
            style={{ padding: '12px', borderRadius: 10, border: 'none', cursor: podeGerar && !gerando ? 'pointer' : 'not-allowed',
              background: podeGerar ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : T.border, color: podeGerar ? '#fff' : T.textT,
              fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)', opacity: gerando ? 0.7 : 1 }}>
            {gerando ? 'Gerando…' : '📄 Gerar e Anexar Contracheque'}
          </button>
        </div>

        {/* ── Pré-visualização ── */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Pré-visualização</div>
          {empregadoProps ? (
            // Sem transform:scale aqui de propósito — html2canvas captura o
            // elemento pelo layout real (offsetWidth/Height), e um ancestral
            // escalado pode bagunçar essa leitura (mesmo cuidado do
            // downloadCartaPdf em faturamento/tabs/TabOficinaEstelar.jsx).
            // Quem não couber na tela rola pro lado (overflowX:auto no pai).
            <ReciboPagamento id={previewId} empregador={EMPREGADOR} empregado={empregadoProps} verbas={verbas}/>
          ) : (
            <div style={{ fontSize: 13, color: T.textT, padding: '40px 0', textAlign: 'center' }}>Escolha um funcionário pra ver o recibo.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContrachequeGeradoUniko;
