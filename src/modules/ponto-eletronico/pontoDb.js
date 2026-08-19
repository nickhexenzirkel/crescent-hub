import { supabase, getAuthUser } from '../../contexts/user';

/* ══════════════════════════════════════════════════════════════════
   PONTO ELETRÔNICO — acesso ao Supabase
   Tabelas: ponto_marcacoes, ponto_funcionarios, ponto_justificativas,
            ponto_empresa  (ver supabase_ponto_eletronico.sql)
══════════════════════════════════════════════════════════════════ */

const nowISO = () => new Date().toISOString();
const justKey = (cpf, data) => `${cpf}_${data}`;

/* Busca paginada — Supabase devolve no máx. 1000 linhas por request */
async function fetchAll(table, columns) {
  const PAGE = 1000;
  let from = 0, out = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out = out.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/* Carrega tudo do banco e devolve no formato que o dashboard consome */
export async function loadPonto() {
  const [marcacoes, funcionarios, justificativas, empresaRes] = await Promise.all([
    fetchAll('ponto_marcacoes', 'cpf,data,hora,nsr'),
    fetchAll('ponto_funcionarios', 'cpf,nome,excluido'),
    fetchAll('ponto_justificativas', 'cpf,data,texto,abonado,autor,updated_at'),
    supabase.from('ponto_empresa').select('cnpj,razao,modelo,fmt').eq('id', 1).maybeSingle(),
  ]);

  const marks = marcacoes.map(m => ({ cpf: m.cpf, date: m.data, time: m.hora, nsr: m.nsr || '' }));

  const nameMap = {};
  const excluded = new Set();
  for (const f of funcionarios) {
    if (f.nome) nameMap[f.cpf] = f.nome;
    if (f.excluido) excluded.add(f.cpf);
  }

  const justifs = {};
  for (const j of justificativas) {
    justifs[justKey(j.cpf, j.data)] = {
      text: j.texto || '', abonado: !!j.abonado, autor: j.autor || '', updatedAt: j.updated_at,
    };
  }

  const empresa = empresaRes?.data || null;
  const header = empresa
    ? { cnpj: empresa.cnpj || '', razao: empresa.razao || '', modelo: empresa.modelo || '—',
        fmt: empresa.fmt || '671', inicio: '', fim: '', gerado: '' }
    : null;

  return { marks, nameMap, excluded, justifs, header, hasData: marks.length > 0 };
}

/* Upsert em lotes (Supabase recomenda ≤ ~1000 por request) */
async function upsertChunks(table, rows, options) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), options);
    if (error) throw error;
  }
}

/* Grava o conteúdo de um AFD: funcionários, marcações (dedup) e empresa.
   Devolve { total } = nº de marcações enviadas do arquivo. */
export async function savePontoSnapshot({ marks, nameMap, excluded, header }) {
  const ts = nowISO();

  // Funcionários — grava o nome SÓ de quem tem nome neste arquivo (tipo 5),
  // pra nunca sobrescrever um nome já salvo com null. Quem só foi excluído
  // (op. E, sem nome) é gravado sem a coluna `nome`, preservando o existente.
  const nomeRows = Object.entries(nameMap).map(([cpf, nome]) => ({
    cpf, nome, excluido: excluded.has(cpf), updated_at: ts,
  }));
  if (nomeRows.length) await upsertChunks('ponto_funcionarios', nomeRows, { onConflict: 'cpf' });

  const exclRows = [...excluded]
    .filter(cpf => !nameMap[cpf])
    .map(cpf => ({ cpf, excluido: true, updated_at: ts }));
  if (exclRows.length) await upsertChunks('ponto_funcionarios', exclRows, { onConflict: 'cpf' });

  // Marcações — dedup por (cpf, data, hora); ignora as que já existem
  const markRows = marks.map(m => ({ cpf: m.cpf, data: m.date, hora: m.time, nsr: m.nsr || null }));
  if (markRows.length) {
    await upsertChunks('ponto_marcacoes', markRows, { onConflict: 'cpf,data,hora', ignoreDuplicates: true });
  }

  // Empresa (linha única)
  if (header) {
    const { error } = await supabase.from('ponto_empresa').upsert({
      id: 1, cnpj: header.cnpj || null, razao: header.razao || null,
      modelo: header.modelo || null, fmt: header.fmt || null, updated_at: ts,
    }, { onConflict: 'id' });
    if (error) throw error;
  }

  return { total: markRows.length };
}

/* Persiste o RESUMO de presença por funcionário e MÊS (saldo em min + nº de inconsistências).
   Usado pela missão "Presença Impecável" da Prisma Store (saldo 0 e 0 inconsistências no mês).
   Tabela: ponto_presenca (ver supabase_ponto_presenca.sql). */
export async function savePontoPresenca(employees) {
  if (!Array.isArray(employees) || !employees.length) return;
  const ts = nowISO();
  const acc = {}; // `${cpf}|${YYYY-MM}` → { cpf, month, saldo, issues }
  for (const emp of employees) {
    for (const d of (emp.days || [])) {
      const month = (d.date || '').slice(0, 7);
      if (!month) continue;
      const k = emp.cpf + '|' + month;
      if (!acc[k]) acc[k] = { cpf: emp.cpf, month, saldo: 0, issues: 0 };
      acc[k].saldo  += (d.balance || 0);
      acc[k].issues += (d.issues ? d.issues.length : 0);
    }
  }
  const rows = Object.values(acc).map(r => ({ ...r, updated_at: ts }));
  if (rows.length) await upsertChunks('ponto_presenca', rows, { onConflict: 'cpf,month' });
}

/* Persiste os DIAS NEGATIVOS por funcionário (saldo < 0, em MINUTOS) — pro colaborador ver
   no "Banco de Horas" quais dias ficou negativo. Dias abonados já vêm com saldo 0 (não entram).
   Regrava do zero por CPF (apaga os antigos e insere os atuais). Tabela: ponto_negativos. */
export async function savePontoNegativos(employees) {
  if (!Array.isArray(employees) || !employees.length) return;
  const ts = nowISO();
  for (const emp of employees) {
    const negs = (emp.days || [])
      .filter(d => Number(d.balance) < 0)
      .map(d => ({ cpf: emp.cpf, data: d.date, saldo: Math.round(Number(d.balance)), updated_at: ts }));
    try {
      await supabase.from('ponto_negativos').delete().eq('cpf', emp.cpf);
      if (negs.length) await upsertChunks('ponto_negativos', negs, { onConflict: 'cpf,data' });
    } catch {}
  }
}

/* Carrega as SOLICITAÇÕES de justificativa que os colaboradores enviaram (motivo + anexo,
   ex.: atestado em PDF/foto), pra o RH ver ao justificar o dia. Tabela: ponto_solicitacoes. */
export async function loadSolicitacoes() {
  try {
    return await fetchAll('ponto_solicitacoes', 'id,cpf,ponto_cpf,nome,titulo,descricao,data_ref,file_url,file_name,status,created_at');
  } catch { return []; }
}

/* Cria/atualiza ou remove uma justificativa. Texto vazio = apaga. */
export async function saveJustificativa({ cpf, date, text }) {
  const clean = (text || '').trim();
  if (!clean) {
    const { error } = await supabase.from('ponto_justificativas').delete().eq('cpf', cpf).eq('data', date);
    if (error) throw error;
    return null;
  }
  const autor = getAuthUser()?.name || 'Admin';
  const updatedAt = nowISO();
  const { error } = await supabase.from('ponto_justificativas').upsert({
    cpf, data: date, texto: clean, abonado: true, autor, updated_at: updatedAt,
  }, { onConflict: 'cpf,data' });
  if (error) throw error;
  return { text: clean, abonado: true, autor, updatedAt };
}
