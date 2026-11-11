function removerPrefixoResposta(assunto) {
  return String(assunto || '').replace(/^\s*(?:(?:re|res|fw|fwd)\s*:\s*)+/i, '').trim();
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function formatarDataFaturamento(dia, mes, ano) {
  const diaFormatado = String(dia).padStart(2, '0');
  const mesFormatado = String(mes).padStart(2, '0');
  return ano ? `${diaFormatado}/${mesFormatado}/${ano.length === 2 ? `20${ano}` : ano}` : `${diaFormatado}/${mesFormatado}`;
}

function extrairIntervalo(assunto) {
  const data = '(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?';
  const intervalo = assunto.match(new RegExp(`\\b${data}\\s*(?:at[eé]|a|[-–—])\\s*${data}\\b`, 'i'));
  if (!intervalo) return '';
  const anoInicial = intervalo[3] || intervalo[6] || '';
  const anoFinal = intervalo[6] || intervalo[3] || '';
  return `${formatarDataFaturamento(intervalo[1], intervalo[2], anoInicial)} a ${formatarDataFaturamento(intervalo[4], intervalo[5], anoFinal)}`;
}

export function municipioExibidoNoAssunto(assunto, municipio) {
  const cidade = String(municipio || '').trim();
  const assuntoNormalizado = normalizarTexto(assunto);
  const instituicao = `camara municipal de ${normalizarTexto(cidade)}`;
  return cidade && assuntoNormalizado.includes(instituicao)
    ? `Câm. de ${cidade}`
    : cidade;
}

export function assuntoIndicaFaturamento(assunto) {
  const texto = normalizarTexto(assunto);
  return /\b(?:fat|fatura|faturamento|refaturamento|nota fiscal(?: eletronica)?|nf[\s-]?e|danfe)\b/.test(texto);
}

export function periodoFaturadoDoAssunto(assuntoOriginal) {
  const assunto = removerPrefixoResposta(assuntoOriginal);
  const assuntoNormalizado = normalizarTexto(assunto);
  const categoriaEncontrada = assuntoNormalizado.match(/\b(abast(?:ec(?:imento)?)?|manut(?:encao)?)\b/)?.[1] || '';
  const categoria = categoriaEncontrada.startsWith('abast')
    ? 'Abastecimento'
    : categoriaEncontrada ? 'Manutenção' : '';
  const intervalo = extrairIntervalo(assunto);
  const dataUnica = intervalo ? '' : assunto.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/);
  const data = dataUnica
    ? formatarDataFaturamento(dataUnica[1], dataUnica[2], dataUnica[3])
    : '';
  return [categoria, intervalo || data].filter(Boolean).join(' · ');
}

export function agruparMensagensPorConversa(mensagens) {
  const conversas = new Map();
  for (const mensagem of mensagens) {
    const chave = mensagem.threadId || mensagem.id;
    const atual = conversas.get(chave);
    if (!atual) {
      conversas.set(chave, { ...mensagem, quantidadeNaConversa: 1 });
      continue;
    }

    atual.quantidadeNaConversa += 1;
    if (new Date(mensagem.date).getTime() > new Date(atual.date).getTime()) {
      conversas.set(chave, { ...mensagem, quantidadeNaConversa: atual.quantidadeNaConversa });
    }
  }
  return [...conversas.values()];
}
