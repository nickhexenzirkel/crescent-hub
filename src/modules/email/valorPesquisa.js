const TOKEN_VALOR = /(?:R\$\s*)?-?(?:\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:[,.]\d{1,2})?/i;

export function valorEmCentavos(valor) {
  let texto = String(valor || '').trim().replace(/[^\d,.-]/g, '');
  if (!texto || !/\d/.test(texto)) return null;

  const negativo = texto.startsWith('-');
  texto = texto.replace(/-/g, '');
  const ultimaVirgula = texto.lastIndexOf(',');
  const ultimoPonto = texto.lastIndexOf('.');
  let inteiro = texto;
  let centavos = '';

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const separadorDecimal = ultimaVirgula > ultimoPonto ? ',' : '.';
    const posicaoDecimal = texto.lastIndexOf(separadorDecimal);
    const casas = texto.length - posicaoDecimal - 1;
    if (casas < 1 || casas > 2) return null;
    inteiro = texto.slice(0, posicaoDecimal).replace(/[.,]/g, '');
    centavos = texto.slice(posicaoDecimal + 1);
  } else if (ultimaVirgula >= 0 || ultimoPonto >= 0) {
    const separador = ultimaVirgula >= 0 ? ',' : '.';
    const posicaoDecimal = texto.lastIndexOf(separador);
    const casas = texto.length - posicaoDecimal - 1;
    if (casas > 0 && casas <= 2) {
      inteiro = texto.slice(0, posicaoDecimal).replace(/[.,]/g, '');
      centavos = texto.slice(posicaoDecimal + 1);
    } else {
      inteiro = texto.replace(/[.,]/g, '');
    }
  }

  if (!/^\d+$/.test(inteiro)) return null;
  const total = Number(inteiro) * 100 + Number(centavos.padEnd(2, '0') || 0);
  if (!Number.isSafeInteger(total)) return null;
  return negativo ? -total : total;
}

export function detectarValorPesquisa(consulta, valorFiltro = '') {
  const filtro = String(valorFiltro || '').trim();
  if (filtro) {
    const centavos = valorEmCentavos(filtro);
    if (centavos !== null) return { centavos, consulta: String(consulta || '').trim() };
  }

  const texto = String(consulta || '');
  const encontrados = [...texto.matchAll(new RegExp(TOKEN_VALOR.source, 'gi'))];
  for (const encontrado of encontrados) {
    const token = encontrado[0];
    if (!/R\$/i.test(token) && !/[.,]/.test(token)) continue;
    if (!/R\$/i.test(token) && !/[,.]\d{2}$/.test(token)) continue;
    const centavos = valorEmCentavos(token);
    if (centavos === null) continue;
    const consultaSemValor = texto
      .replace(encontrado[0], ' ')
      .replace(/\bvalor\s+(?:bruto|bruta|liquido|liquida|líquido|líquida)\b\s*[:=]?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { centavos, consulta: consultaSemValor };
  }
  return { centavos: null, consulta: texto.trim() };
}

export function textoContemValor(texto, centavosProcurados) {
  const normalizado = String(texto || '').replace(/([.,])\s+(?=\d)/g, '$1');
  const padroes = [
    /(?<![\p{L}\d])R\$[ \t]*-?\d[\d., \t]*/giu,
    /(?<![\p{L}\d])-?(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:,\d{3})+\.\d{1,2}|\d+(?:[,.]\d{1,2}))(?![\p{L}\d])/gu,
  ];
  return padroes.some(padrao => {
    for (const encontrado of normalizado.matchAll(padrao)) {
      if (valorEmCentavos(encontrado[0]) === centavosProcurados) return true;
    }
    return false;
  });
}
