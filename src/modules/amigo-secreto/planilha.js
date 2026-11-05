const normalizar = (valor) => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

const textoCelula = (celula) => {
  const valor = celula?.value;
  if (valor == null) return '';
  if (typeof valor === 'object' && 'text' in valor) return String(valor.text || '').trim();
  if (Array.isArray(valor)) return valor.map((parte) => parte.text || '').join('').trim();
  return String(celula.text || valor).trim();
};

const mapearColunas = (cabecalhos) => {
  const procurar = (trecho) => cabecalhos.findIndex((h) => normalizar(h).includes(trecho));
  return {
    nome: procurar('seu nome'),
    presente: procurar('presentes que voce gostaria de ganhar'),
    gostos: procurar('gostos pessoais'),
    cores: procurar('cores favoritas'),
    roupa: cabecalhos.findIndex((h) => normalizar(h).includes('em caso de roupa')),
    calcado: procurar('tamanho voce usa'),
  };
};

export async function lerPlanilhaAmigoSecreto(arquivo) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await arquivo.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('A planilha não tem uma aba com respostas.');

  const cabecalhos = sheet.getRow(1).values.slice(1).map((v) => String(v ?? '').trim());
  const colunas = mapearColunas(cabecalhos);
  const nomesColunas = {
    nome: 'nome',
    presente: 'presentes desejados',
    gostos: 'gostos pessoais',
    cores: 'cores favoritas',
    roupa: 'tamanho de roupa',
    calcado: 'tamanho de calçado',
  };
  const faltantes = Object.entries(colunas)
    .filter(([, indice]) => indice < 0)
    .map(([campo]) => nomesColunas[campo]);
  if (faltantes.length) throw new Error(`Não encontrei estas colunas: ${faltantes.join(', ')}.`);

  const participantes = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const participante = Object.fromEntries(
      Object.entries(colunas).map(([campo, indice]) => [campo, textoCelula(row.getCell(indice + 1))]),
    );
    if (!participante.nome) continue;
    participantes.push(participante);
  }
  if (!participantes.length) throw new Error('Não encontrei participantes com nome na planilha.');
  return participantes;
}
