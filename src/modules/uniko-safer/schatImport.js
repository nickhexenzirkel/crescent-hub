import { supabase } from './saferSupabase.js';

const SCHAT_GERAL = 'geral';

const CAMPOS = ['protocolo', 'remetente', 'mensagem', 'contato', 'canal', 'criado_em'];
const TAMANHO_LOTE = 500;

const normalizar = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

function textoCelula(celula, aparar = true) {
  const valor = celula.value;
  if (valor == null) return '';
  if (valor instanceof Date) return valor.toISOString();
  let texto;
  if (typeof valor === 'object' && 'result' in valor) texto = String(valor.result ?? '');
  else if (typeof valor === 'object' && 'text' in valor) texto = String(valor.text ?? '');
  else if (Array.isArray(valor)) texto = valor.map((parte) => parte.text || '').join('');
  else texto = String(valor);
  return aparar ? texto.trim() : texto;
}

function dataIso(celula) {
  const valor = celula.value;
  let data;
  if (valor instanceof Date) {
    data = valor;
  } else if (typeof valor === 'number') {
    data = new Date((valor - 25569) * 86400000);
  } else {
    const texto = textoCelula(celula).replace(/\s*\([^)]*\)\s*$/, '');
    data = new Date(texto);
  }
  if (!Number.isFinite(data.getTime())) return null;
  return data.toISOString();
}

function chaveThread(contato) {
  return String(contato);
}

function normalizarContato(valor) {
  const numero = String(valor ?? '').replace(/\D/g, '');
  return numero.startsWith('55') && numero.length > 11 ? numero.slice(2) : numero;
}

function extrairNomeContato(mensagem, remetente) {
  if (normalizar(remetente) !== 'bot') return null;
  const saudacao = String(mensagem ?? '').match(/^\s*ol[áa]\s*[,!:–—-]?\s*/i);
  if (!saudacao) return null;

  const restante = String(mensagem).slice(saudacao[0].length).trim();
  const virgula = restante.indexOf(',');
  if (virgula < 0) return null;

  const trechoNome = restante.slice(0, virgula).trim();
  const nome = trechoNome.split(/\s+[-–—]\s+/)[0].trim();
  const contexto = normalizar(restante.slice(virgula + 1));
  const temContextoDeBoasVindas = /^(?:bom dia|boa tarde|boa noite|seja bem[- ]vind[oa]|seja muito bem[- ]vind[oa]|tudo bem|como vai)\b/.test(contexto);
  const nomeParecePessoa = /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,4}$/u.test(nome);
  const termosGenericos = new Set(['bom', 'boa', 'como', 'ola', 'seja', 'senhor', 'senhora', 'tudo', 'voce']);

  if (!temContextoDeBoasVindas || !nomeParecePessoa || termosGenericos.has(normalizar(nome).split(/\s+/)[0])) return null;
  return nome;
}

async function hashMensagem(linha) {
  const identidade = JSON.stringify([
    linha.protocolo,
    linha.sent_at,
    linha.sender,
    linha.message,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identidade));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function prepararPlanilha(arquivo) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await arquivo.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('A planilha não tem uma aba de dados.');

  const cabecalho = sheet.getRow(1);
  const colunas = new Map();
  for (let indice = 1; indice <= sheet.columnCount; indice++) {
    const nome = normalizar(textoCelula(cabecalho.getCell(indice)));
    if (nome) colunas.set(nome, indice);
  }
  const indices = Object.fromEntries(CAMPOS.map((campo) => [campo, colunas.get(campo)]));
  const faltantes = CAMPOS.filter((campo) => !indices[campo]);
  if (faltantes.length) {
    throw new Error(`Não encontrei estas colunas obrigatórias: ${faltantes.join(', ')}.`);
  }

  const linhas = [];
  const threads = new Map();
  const nomesEncontrados = new Map();
  const ausentes = Object.fromEntries(CAMPOS.filter((campo) => campo !== 'mensagem').map((campo) => [campo, 0]));
  let semMensagem = 0;
  let mensagensValidas = 0;
  let primeiraLinhaInvalida = null;

  sheet.eachRow({ includeEmpty: false }, (row, numeroLinha) => {
    if (numeroLinha === 1) return;
    const campos = Object.fromEntries(CAMPOS.map((campo) => [campo, textoCelula(row.getCell(indices[campo]))]));
    campos.contato = normalizarContato(campos.contato);
    if (!CAMPOS.some((campo) => campos[campo])) return;

    const faltantesLinha = CAMPOS.filter((campo) => campo !== 'mensagem' && !campos[campo]);
    if (faltantesLinha.length) {
      faltantesLinha.forEach((campo) => { ausentes[campo] += 1; });
      primeiraLinhaInvalida ??= numeroLinha;
      return;
    }

    const sentAt = dataIso(row.getCell(indices.criado_em));
    if (!sentAt) {
      ausentes.criado_em += 1;
      primeiraLinhaInvalida ??= numeroLinha;
      return;
    }

    if (!campos.mensagem) {
      semMensagem += 1;
      return;
    }

    const nomeSugerido = extrairNomeContato(campos.mensagem, campos.remetente);
    linhas.push(numeroLinha);
    mensagensValidas += 1;
    const chave = chaveThread(campos.contato);
    const existente = threads.get(chave);
    if (existente) {
      if (sentAt > existente.last_message_at) existente.last_message_at = sentAt;
    } else {
      threads.set(chave, {
        sector: SCHAT_GERAL,
        contact: campos.contato,
        channel: SCHAT_GERAL,
        contact_name: null,
        contact_name_at: null,
        last_message_at: sentAt,
      });
    }
    if (nomeSugerido) {
      const nomeAtual = nomesEncontrados.get(chave);
      if (!nomeAtual || sentAt >= nomeAtual.contact_name_at) {
        nomesEncontrados.set(chave, { contact_name: nomeSugerido, contact_name_at: sentAt });
        threads.get(chave).contact_name = nomeSugerido;
        threads.get(chave).contact_name_at = sentAt;
      }
    }
  });

  const invalidos = Object.values(ausentes).reduce((total, quantidade) => total + quantidade, 0);
  if (invalidos) {
    const resumo = Object.entries(ausentes).filter(([, quantidade]) => quantidade)
      .map(([campo, quantidade]) => `${campo}: ${quantidade}`).join(', ');
    throw new Error(`Há campos obrigatórios vazios ou datas inválidas (${resumo}). Primeira linha com problema: ${primeiraLinhaInvalida}.`);
  }
  if (!mensagensValidas) throw new Error('Não encontrei mensagens com texto na planilha.');

  return { workbook, sheet, indices, linhas, threads, mensagensValidas, semMensagem };
}

export async function resumirPlanilhaSchat(arquivo) {
  const preparada = await prepararPlanilha(arquivo);
  return {
    mensagens: preparada.mensagensValidas,
    contatos: preparada.threads.size,
    semMensagem: preparada.semMensagem,
  };
}

async function carregarThreadsExistentes() {
  const existentes = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await supabase.from('uniko_safer_schat_threads')
      .select('id, contact, channel, last_message_at, contact_name, contact_name_at')
      .eq('sector', SCHAT_GERAL)
      .order('id')
      .range(inicio, inicio + 999);
    if (error) throw new Error(`Não foi possível carregar as conversas do SCHAT: ${error.message}`);
    existentes.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return existentes;
}

export async function importarBackupSchat(arquivo, aoProgredir = () => {}) {
  aoProgredir({ etapa: 'Lendo a planilha', concluidos: 0, total: 0 });
  const preparada = await prepararPlanilha(arquivo);
  const existentes = await carregarThreadsExistentes();
  const threadsExistentes = new Map(existentes.map((item) => [
    chaveThread(item.contact),
    item,
  ]));

  const threads = Array.from(preparada.threads.values(), (thread) => {
    const existente = threadsExistentes.get(chaveThread(thread.contact));
    const nomeNovoMaisRecente = thread.contact_name_at
      && (!existente?.contact_name_at || new Date(thread.contact_name_at) >= new Date(existente.contact_name_at));
    return {
      ...thread,
      sector: SCHAT_GERAL,
      channel: SCHAT_GERAL,
      contact_name: nomeNovoMaisRecente ? thread.contact_name : existente?.contact_name || null,
      contact_name_at: nomeNovoMaisRecente ? thread.contact_name_at : existente?.contact_name_at || null,
      last_message_at: existente && new Date(existente.last_message_at) > new Date(thread.last_message_at)
        ? existente.last_message_at
        : thread.last_message_at,
    };
  });
  const idsThreads = new Map();
  for (let inicio = 0; inicio < threads.length; inicio += TAMANHO_LOTE) {
    const lote = threads.slice(inicio, inicio + TAMANHO_LOTE);
    const { data, error } = await supabase.from('uniko_safer_schat_threads')
      .upsert(lote, { onConflict: 'sector,contact,channel' })
      .select('id, contact, channel');
    if (error) throw new Error(`Falha ao preparar conversas do SCHAT: ${error.message}`);
    (data || []).forEach((item) => idsThreads.set(chaveThread(item.contact, item.channel), item.id));
    aoProgredir({ etapa: 'Preparando conversas', concluidos: Math.min(inicio + lote.length, threads.length), total: threads.length });
  }

  const linhasPorThread = new Map(existentes.map((item) => [
    chaveThread(item.contact),
    item.id,
  ]));
  idsThreads.forEach((id, chave) => linhasPorThread.set(chaveThread(chave), id));

  const mensagens = [];
  let processadas = 0;
  let novas = 0;
  const enviarLote = async () => {
    if (!mensagens.length) return;
    const lote = mensagens.splice(0, mensagens.length);
    const preparadas = await Promise.all(lote.map(async (linha) => ({
      thread_id: linha.thread_id,
      protocol: linha.protocol,
      sender: linha.sender,
      message: linha.message,
      sent_at: linha.sent_at,
      message_hash: await hashMensagem(linha),
    })));
    const { data, error } = await supabase.from('uniko_safer_schat_messages')
      .upsert(preparadas, { onConflict: 'thread_id,message_hash', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`Falha ao gravar mensagens SCHAT: ${error.message}`);
    novas += data?.length || 0;
  };

  aoProgredir({ etapa: 'Importando mensagens', concluidos: 0, total: preparada.linhas.length });
  for (const numeroLinha of preparada.linhas) {
    const row = preparada.sheet.getRow(numeroLinha);
    const valores = Object.fromEntries(CAMPOS.map((campo) => [
      campo,
      textoCelula(row.getCell(preparada.indices[campo]), campo !== 'mensagem'),
    ]));
    valores.contato = normalizarContato(valores.contato);
    const sentAt = dataIso(row.getCell(preparada.indices.criado_em));
    const threadId = linhasPorThread.get(chaveThread(valores.contato));
    if (!threadId) throw new Error(`Não foi possível encontrar a conversa da linha ${numeroLinha}.`);
    mensagens.push({
      thread_id: threadId,
      protocol: valores.protocolo,
      sender: valores.remetente,
      message: valores.mensagem,
      sent_at: sentAt,
    });
    processadas += 1;
    if (mensagens.length >= TAMANHO_LOTE) {
      await enviarLote();
      aoProgredir({ etapa: 'Importando mensagens', concluidos: processadas, total: preparada.linhas.length });
    }
  }
  await enviarLote();
  aoProgredir({ etapa: 'Importando mensagens', concluidos: processadas, total: preparada.linhas.length });
  return {
    novas,
    processadas,
    ignoradas: preparada.semMensagem,
    conversas: preparada.threads.size,
  };
}
