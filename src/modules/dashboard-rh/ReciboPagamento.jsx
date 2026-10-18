// "Recibo de Pagamento" (Folha de Pagamento) — réplica do modelo que o
// contador usa (PDF de referência enviado pelo dono, 17/10/2026). Renderizado
// fora da tela (ver contrachequeGerador.js: html2canvas captura este
// componente e vira o PDF de verdade) — por isso tudo em px/preto no branco,
// sem depender do tema T do resto do app.
import React from 'react';

const PAGE_W = 760; // px — vira mm no jsPDF (96dpi), mesmo padrão de TabOficinaEstelar.jsx

const borda = '1px solid #000';
const base = { fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', boxSizing: 'border-box' };

/* Célula com rótulo pequeno em cima + valor embaixo — o padrão que se repete
   em quase toda a parte de cabeçalho do recibo. */
const Campo = ({ label, value, w, shaded, borderRight = true, borderBottom = true, align }) => (
  <div style={{
    ...base, flex: w ? `0 0 ${w}` : '1 1 0', minWidth: 0, padding: '3px 6px',
    borderRight: borderRight ? borda : 'none', borderBottom: borderBottom ? borda : 'none',
    background: shaded ? '#d9d9d9' : 'transparent',
  }}>
    <div style={{ fontSize: 7.5, fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 9.5, marginTop: 2, textAlign: align || 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{value || ' '}</div>
  </div>
);

const money = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* `verbas`: [{ cod, descricao, referencia, provento, desconto }] — provento/desconto
   em número (0/undefined = célula vazia, não "0,00", igual ao modelo real). */
const ReciboPagamento = ({
  id, empregador, empregado, verbas = [], linhasMinimas = 18,
}) => {
  const totalProventos = verbas.reduce((s, v) => s + (Number(v.provento) || 0), 0);
  const totalDescontos = verbas.reduce((s, v) => s + (Number(v.desconto) || 0), 0);
  const liquido = totalProventos - totalDescontos;
  const linhas = [...verbas];
  while (linhas.length < linhasMinimas) linhas.push(null);

  const COL = { cod: '40px', desc: '1 1 0', ref: '90px', prov: '110px', desc2: '110px' };

  return (
    <div id={id} style={{ ...base, width: PAGE_W, border: borda, background: '#fff' }}>
      {/* ── Linha 1: título + data/assinatura ── */}
      <div style={{ display: 'flex', borderBottom: borda }}>
        <div style={{ flex: '1 1 0', padding: '10px 6px', borderRight: borda, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Recibo de Pagamento</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>( Folha de Pagamento )</div>
        </div>
        <div style={{ flex: '0 0 300px', padding: '6px 10px' }}>
          <div style={{ fontSize: 8.5, fontWeight: 700 }}>Data e Assinatura</div>
          <div style={{ fontSize: 10, marginTop: 14, whiteSpace: 'nowrap' }}>
            ___/___/____&nbsp;&nbsp;&nbsp;______________________________
          </div>
        </div>
      </div>

      {/* ── Linha 2: empregador / inscrição / admissão / competência ── */}
      <div style={{ display: 'flex' }}>
        <Campo label="Empregador" value={empregador.nome} w="280px"/>
        <Campo label="Inscrição" value={empregador.cnpj} w="170px"/>
        <Campo label="Admissão" value={empregado.admissao} w="130px"/>
        <Campo label="Competência" value={empregado.competencia} w="180px" borderRight={false}/>
      </div>

      {/* ── Linha 3: empregado (destacado) / cargo / lotação ── */}
      <div style={{ display: 'flex' }}>
        <Campo label="Empregado" value={`${empregado.matricula || ''} ${empregado.nome}`.trim()} w="450px" shaded/>
        <Campo label="Cargo" value={empregado.cargo} w="170px"/>
        <Campo label="Lotação" value={empregado.lotacao} w="140px" borderRight={false}/>
      </div>

      {/* ── Linha 4: CPF / banco / agência / conta / tipo de conta ── */}
      <div style={{ display: 'flex', borderBottom: borda }}>
        <div style={{ ...base, flex: '0 0 170px', padding: '3px 6px', borderRight: borda }}>
          <div style={{ fontSize: 7.5, fontWeight: 700 }}>CPF:</div>
          <div style={{ fontSize: 9.5, marginTop: 2 }}>{empregado.cpf}</div>
        </div>
        <Campo label="Banco" value={empregado.banco} w="150px"/>
        <Campo label="Agência" value={empregado.agencia} w="120px"/>
        <Campo label="Conta" value={empregado.conta} w="120px"/>
        <Campo label="Tipo de Conta" value={empregado.tipoConta} w="200px" borderRight={false}/>
      </div>

      {/* ── Discriminação das Verbas ── */}
      <div style={{ ...base, textAlign: 'center', fontSize: 10, fontWeight: 700, padding: '4px 0', borderBottom: borda }}>
        Discriminação das Verbas
      </div>

      {/* header da tabela */}
      <div style={{ display: 'flex', borderBottom: borda, fontSize: 8.5, fontWeight: 700 }}>
        <div style={{ ...base, flex: `0 0 ${COL.cod}`, padding: '3px 6px', borderRight: borda }}>Cod.</div>
        <div style={{ ...base, flex: COL.desc, padding: '3px 6px', borderRight: borda }}>Descrição</div>
        <div style={{ ...base, flex: `0 0 ${COL.ref}`, padding: '3px 6px', borderRight: borda, textAlign: 'center' }}>Referência</div>
        <div style={{ ...base, flex: `0 0 ${COL.prov}`, padding: '3px 6px', borderRight: borda, textAlign: 'right' }}>Provento</div>
        <div style={{ ...base, flex: `0 0 ${COL.desc2}`, padding: '3px 6px', textAlign: 'right' }}>Desconto</div>
      </div>

      {/* linhas de verba (+ vazias, até preencher a altura do modelo) */}
      {linhas.map((v, i) => (
        <div key={i} style={{ display: 'flex', fontSize: 9, minHeight: 16, borderBottom: i === linhas.length - 1 ? borda : '1px solid #eee' }}>
          <div style={{ ...base, flex: `0 0 ${COL.cod}`, padding: '2px 6px', borderRight: borda }}>{v?.cod || ''}</div>
          <div style={{ ...base, flex: COL.desc, padding: '2px 6px', borderRight: borda }}>{v?.descricao || ''}</div>
          <div style={{ ...base, flex: `0 0 ${COL.ref}`, padding: '2px 6px', borderRight: borda, textAlign: 'center' }}>{v?.referencia || ''}</div>
          <div style={{ ...base, flex: `0 0 ${COL.prov}`, padding: '2px 6px', borderRight: borda, textAlign: 'right' }}>{v?.provento ? money(v.provento) : ''}</div>
          <div style={{ ...base, flex: `0 0 ${COL.desc2}`, padding: '2px 6px', textAlign: 'right' }}>{v?.desconto ? money(v.desconto) : ''}</div>
        </div>
      ))}

      {/* totais, alinhados sob Provento/Desconto */}
      <div style={{ display: 'flex', borderBottom: borda }}>
        <div style={{ flex: `0 0 ${COL.cod}` }}/>
        <div style={{ flex: COL.desc }}/>
        <div style={{ flex: `0 0 ${COL.ref}` }}/>
        <div style={{ ...base, flex: `0 0 ${COL.prov}`, padding: '3px 6px', borderLeft: borda, borderRight: borda, textAlign: 'center' }}>
          <div style={{ fontSize: 8, fontWeight: 700 }}>Total de Proventos</div>
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>{money(totalProventos)}</div>
        </div>
        <div style={{ ...base, flex: `0 0 ${COL.desc2}`, padding: '3px 6px', textAlign: 'center' }}>
          <div style={{ fontSize: 8, fontWeight: 700 }}>Total de Descontos</div>
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>{money(totalDescontos)}</div>
        </div>
      </div>

      {/* líquido a receber, faixa cinza */}
      <div style={{ display: 'flex', borderBottom: borda }}>
        <div style={{ flex: `0 0 ${COL.cod}` }}/>
        <div style={{ flex: COL.desc }}/>
        <div style={{ flex: `0 0 ${COL.ref}` }}/>
        <div style={{ ...base, flex: `0 0 calc(${COL.prov} + ${COL.desc2})`, padding: '5px 6px', borderLeft: borda, background: '#d9d9d9', textAlign: 'center' }}>
          <div style={{ fontSize: 8.5, fontWeight: 700 }}>Líquido a Receber</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 2 }}>{money(liquido)}</div>
        </div>
      </div>

      {/* ── Rodapé: bases de cálculo ── */}
      <div style={{ display: 'flex' }}>
        <Campo label="Salário Contratual" value={money(empregado.salarioContratual)} w="125px" align="center"/>
        <Campo label="Base de Cálculo do INSS" value={money(empregado.baseInss)} w="135px" align="center"/>
        <Campo label="Base de Cálculo do FGTS" value={money(empregado.baseFgts)} w="135px" align="center"/>
        <Campo label="FGTS" value={money(empregado.fgts)} w="95px" align="center"/>
        <Campo label="FGTS Contribuição Social" value={empregado.fgtsContribSocial ? money(empregado.fgtsContribSocial) : ''} w="130px" align="center"/>
        <Campo label="Base de Cálculo do IRRF(S)" value={empregado.baseIrrf ? money(empregado.baseIrrf) : ''} w="140px" align="center" borderRight={false}/>
      </div>
    </div>
  );
};

export { ReciboPagamento, PAGE_W };
