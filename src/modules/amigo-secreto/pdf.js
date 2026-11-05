import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const LARGURA_PAGINA = 842;
const ALTURA_PAGINA = 595;
const MARGEM = 34;
const ALTURA_CABECALHO = 112;
const LIMITE_INFERIOR = 42;
const ESPACO_CARTOES = 12;

const CORES = {
  azul: rgb(0.02, 0.43, 0.76),
  ciano: rgb(0.02, 0.68, 0.88),
  azulClaro: rgb(0.92, 0.96, 0.99),
  forma: rgb(0.87, 0.95, 0.99),
  texto: rgb(0.12, 0.2, 0.29),
  secundario: rgb(0.35, 0.43, 0.51),
  borda: rgb(0.78, 0.86, 0.92),
  branco: rgb(1, 1, 1),
};

const AJUSTES_UNICODE = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2026': '...',
};

function textoCompativel(texto, caracteres) {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n/)
    .map((trecho) => [...trecho].map((caractere) => {
      if (caracteres.has(caractere.codePointAt(0))) return caractere;
      if (AJUSTES_UNICODE[caractere]) return AJUSTES_UNICODE[caractere];
      const semAcentos = caractere.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return [...semAcentos].every((parte) => caracteres.has(parte.codePointAt(0))) ? semAcentos : '?';
    }).join(''))
    .join('\n');
}

function quebrarTexto(texto, fonte, tamanho, largura, caracteres) {
  const linhas = [];
  const trechos = textoCompativel(texto, caracteres).split('\n');

  trechos.forEach((trecho) => {
    let linha = '';
    const palavras = trecho.split(/\s+/).filter(Boolean);
    if (!palavras.length) {
      linhas.push('');
      return;
    }

    palavras.forEach((palavra) => {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
        linha = tentativa;
        return;
      }

      if (linha) linhas.push(linha);
      linha = '';
      [...palavra].forEach((caractere) => {
        const parte = linha + caractere;
        if (linha && fonte.widthOfTextAtSize(parte, tamanho) > largura) {
          linhas.push(linha);
          linha = caractere;
        } else {
          linha = parte;
        }
      });
    });

    if (linha) linhas.push(linha);
  });

  return linhas.length ? linhas : [''];
}

function desenharLinhas(pagina, linhas, fonte, tamanho, x, topo, alturaLinha, cor) {
  linhas.forEach((linha, indice) => {
    pagina.drawText(linha, {
      x,
      y: topo - tamanho - indice * alturaLinha,
      size: tamanho,
      font: fonte,
      color: cor,
    });
  });
}

function prepararCampo(valor, rotulo, fonte, tamanho, largura, caracteres) {
  const linhas = quebrarTexto(String(valor ?? '').trim() || 'Não informado', fonte, tamanho, largura, caracteres);
  return { rotulo, linhas };
}

function prepararCartao(participante, indice, fontes, caracteres) {
  const larguraInterna = LARGURA_PAGINA - 2 * MARGEM - 28;
  const espacoPrincipal = 18;
  const larguraPrincipal = (larguraInterna - espacoPrincipal) / 2;
  const espacoDetalhe = 14;
  const larguraDetalhe = (larguraInterna - 2 * espacoDetalhe) / 3;
  const camposPrincipais = [
    prepararCampo(participante.presente, 'PRESENTE DESEJADO', fontes.regular, 10.5, larguraPrincipal - 18, caracteres),
    prepararCampo(participante.gostos, 'GOSTOS PESSOAIS', fontes.regular, 10.5, larguraPrincipal - 18, caracteres),
  ];
  const camposDetalhes = [
    prepararCampo(participante.cores, 'COR FAVORITA', fontes.regular, 10, larguraDetalhe - 18, caracteres),
    prepararCampo(participante.roupa, 'TAMANHO DE ROUPA', fontes.regular, 10, larguraDetalhe - 18, caracteres),
    prepararCampo(participante.calcado, 'TAMANHO DE CALÇADO', fontes.regular, 10, larguraDetalhe - 18, caracteres),
  ];
  const nome = quebrarTexto(participante.nome || 'Participante', fontes.negrito, 14, larguraInterna - 42, caracteres);
  const alturaCabecalho = Math.max(26, nome.length * 17);
  const alturaPrincipais = Math.max(...camposPrincipais.map((campo) => campo.linhas.length * 13 + 19));
  const alturaDetalhes = Math.max(...camposDetalhes.map((campo) => campo.linhas.length * 12.5 + 19));
  const altura = 12 + alturaCabecalho + 10 + alturaPrincipais + 10 + alturaDetalhes + 12;

  return {
    indice,
    nome,
    altura,
    camposPrincipais,
    camposDetalhes,
    larguraInterna,
    larguraPrincipal,
    larguraDetalhe,
    espacoPrincipal,
    espacoDetalhe,
    alturaCabecalho,
    alturaPrincipais,
    alturaDetalhes,
  };
}

function desenharCampo(pagina, campo, x, topo, largura, altura, fontes, tamanhoTexto, alturaLinha) {
  const y = topo - altura;
  pagina.drawRectangle({
    x,
    y,
    width: largura,
    height: altura,
    color: CORES.azulClaro,
    borderColor: CORES.borda,
    borderWidth: 0.6,
  });
  pagina.drawText(campo.rotulo, {
    x: x + 9,
    y: topo - 12,
    size: 7.7,
    font: fontes.negrito,
    color: CORES.azul,
  });
  desenharLinhas(pagina, campo.linhas, fontes.regular, tamanhoTexto, x + 9, topo - 18, alturaLinha, CORES.texto);
}

function desenharCartao(pagina, cartao, topo, fontes) {
  const x = MARGEM;
  const y = topo - cartao.altura;
  const largura = LARGURA_PAGINA - 2 * MARGEM;
  pagina.drawRectangle({
    x,
    y,
    width: largura,
    height: cartao.altura,
    color: CORES.branco,
    borderColor: CORES.borda,
    borderWidth: 0.8,
  });

  const topoInterno = topo - 12;
  const centroBolinha = topoInterno - cartao.alturaCabecalho / 2;
  pagina.drawCircle({ x: x + 13, y: centroBolinha, size: 11, color: CORES.azul });
  const numero = String(cartao.indice + 1).padStart(2, '0');
  pagina.drawText(numero, {
    x: x + 13 - fontes.negrito.widthOfTextAtSize(numero, 7) / 2,
    y: centroBolinha - 2.5,
    size: 7,
    font: fontes.negrito,
    color: CORES.branco,
  });
  desenharLinhas(pagina, cartao.nome, fontes.negrito, 14, x + 42, topoInterno, 17, CORES.azul);

  let topoCampos = topoInterno - cartao.alturaCabecalho - 10;
  const larguraCartao = (cartao.larguraInterna - cartao.espacoPrincipal) / 2;
  cartao.camposPrincipais.forEach((campo, indice) => {
    const campoX = x + 14 + indice * (larguraCartao + cartao.espacoPrincipal);
    desenharCampo(pagina, campo, campoX, topoCampos, larguraCartao, cartao.alturaPrincipais, fontes, 10.5, 13);
  });

  topoCampos -= cartao.alturaPrincipais + 10;
  cartao.camposDetalhes.forEach((campo, indice) => {
    const campoX = x + 14 + indice * (cartao.larguraDetalhe + cartao.espacoDetalhe);
    desenharCampo(pagina, campo, campoX, topoCampos, cartao.larguraDetalhe, cartao.alturaDetalhes, fontes, 10, 12.5);
  });
}

function desenharCartaoLongo(cartao, fontes, novaPagina, estado) {
  const desenharNome = (continuacao = false) => {
    const altura = Math.max(26, cartao.nome.length * 17);
    if (estado.topo - altura < LIMITE_INFERIOR + 31) novaPagina();
    const centro = estado.topo - altura / 2;
    estado.pagina.drawCircle({ x: MARGEM + 13, y: centro, size: 11, color: CORES.azul });
    const numero = String(cartao.indice + 1).padStart(2, '0');
    estado.pagina.drawText(numero, {
      x: MARGEM + 13 - fontes.negrito.widthOfTextAtSize(numero, 7) / 2,
      y: centro - 2.5,
      size: 7,
      font: fontes.negrito,
      color: CORES.branco,
    });
    desenharLinhas(estado.pagina, cartao.nome, fontes.negrito, 14, MARGEM + 42, estado.topo - 5, 17, CORES.azul);
    if (continuacao) {
      estado.pagina.drawText('(continuação)', {
        x: MARGEM + 42,
        y: estado.topo - altura + 1,
        size: 8,
        font: fontes.regular,
        color: CORES.secundario,
      });
    }
    estado.topo -= altura + 10;
  };

  desenharNome();
  const campos = [
    ...cartao.camposPrincipais.map((campo) => ({ campo, tamanho: 10.5, alturaLinha: 13 })),
    ...cartao.camposDetalhes.map((campo) => ({ campo, tamanho: 10, alturaLinha: 12.5 })),
  ];
  campos.forEach(({ campo, tamanho, alturaLinha }) => {
    let inicio = 0;
    while (inicio < campo.linhas.length) {
      const linhasPossiveis = Math.floor((estado.topo - LIMITE_INFERIOR - 19) / alturaLinha);
      if (linhasPossiveis < 1) {
        novaPagina();
        desenharNome(true);
        continue;
      }

      const linhas = campo.linhas.slice(inicio, inicio + linhasPossiveis);
      const altura = 19 + linhas.length * alturaLinha;
      desenharCampo(
        estado.pagina,
        { ...campo, linhas },
        MARGEM + 14,
        estado.topo,
        cartao.larguraInterna,
        altura,
        fontes,
        tamanho,
        alturaLinha,
      );
      estado.topo -= altura + 8;
      inicio += linhas.length;
      if (inicio < campo.linhas.length) {
        novaPagina();
        desenharNome(true);
      }
    }
  });
}

function desenharCabecalho(pagina, total, fontes, marca) {
  pagina.drawRectangle({
    x: 0,
    y: ALTURA_PAGINA - ALTURA_CABECALHO,
    width: LARGURA_PAGINA,
    height: ALTURA_CABECALHO,
    color: CORES.branco,
  });
  pagina.drawLine({
    start: { x: -18, y: ALTURA_PAGINA - 5 },
    end: { x: 70, y: ALTURA_PAGINA - ALTURA_CABECALHO },
    thickness: 26,
    color: CORES.forma,
  });
  pagina.drawLine({
    start: { x: LARGURA_PAGINA - 176, y: ALTURA_PAGINA + 8 },
    end: { x: LARGURA_PAGINA - 98, y: ALTURA_PAGINA - ALTURA_CABECALHO + 2 },
    thickness: 32,
    color: CORES.forma,
  });
  pagina.drawLine({
    start: { x: LARGURA_PAGINA - 80, y: ALTURA_PAGINA + 6 },
    end: { x: LARGURA_PAGINA - 8, y: ALTURA_PAGINA - ALTURA_CABECALHO },
    thickness: 24,
    color: CORES.azulClaro,
  });

  if (marca) {
    pagina.drawImage(marca, { x: 72, y: ALTURA_PAGINA - 88, width: 52, height: 52 });
  }
  pagina.drawText('BENEFÍCIOS', {
    x: 132,
    y: ALTURA_PAGINA - 53,
    size: 25,
    font: fontes.negrito,
    color: CORES.azul,
  });
  pagina.drawText('AMIGO SECRETO 2026', {
    x: 134,
    y: ALTURA_PAGINA - 76,
    size: 10,
    font: fontes.negrito,
    color: CORES.ciano,
  });
  const rotulo = 'LISTA DE PARTICIPANTES';
  const quantidade = `${total} ${total === 1 ? 'PARTICIPANTE' : 'PARTICIPANTES'}`;
  pagina.drawText(rotulo, {
    x: LARGURA_PAGINA - MARGEM - fontes.negrito.widthOfTextAtSize(rotulo, 8),
    y: ALTURA_PAGINA - 45,
    size: 8,
    font: fontes.negrito,
    color: CORES.azul,
  });
  pagina.drawText(quantidade, {
    x: LARGURA_PAGINA - MARGEM - fontes.regular.widthOfTextAtSize(quantidade, 9),
    y: ALTURA_PAGINA - 62,
    size: 9,
    font: fontes.regular,
    color: CORES.secundario,
  });
  pagina.drawLine({
    start: { x: MARGEM, y: ALTURA_PAGINA - ALTURA_CABECALHO },
    end: { x: LARGURA_PAGINA - MARGEM, y: ALTURA_PAGINA - ALTURA_CABECALHO },
    thickness: 1.4,
    color: CORES.ciano,
  });
}

export async function gerarPdfAmigoSecreto(participantes, marcaUrl) {
  if (!participantes.length) throw new Error('Não há participantes para exportar.');

  const documento = await PDFDocument.create();
  documento.setTitle('Amigo Secreto 2026');
  documento.setSubject('Lista de sugestões dos participantes');
  documento.setCreator('Uniko - 7 Benefícios');

  const fontes = {
    regular: await documento.embedFont(StandardFonts.Helvetica),
    negrito: await documento.embedFont(StandardFonts.HelveticaBold),
  };
  let marca = null;
  if (marcaUrl) {
    const resposta = await fetch(marcaUrl);
    if (!resposta.ok) throw new Error('Não foi possível carregar a marca para o cabeçalho.');
    marca = await documento.embedPng(await resposta.arrayBuffer());
  }
  const caracteres = new Set(fontes.regular.getCharacterSet());
  const cartoes = participantes.map((participante, indice) => prepararCartao(participante, indice, fontes, caracteres));
  let pagina;
  let topo;

  const novaPagina = () => {
    pagina = documento.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
    desenharCabecalho(pagina, participantes.length, fontes, marca);
    topo = ALTURA_PAGINA - ALTURA_CABECALHO - 18;
  };
  const estadoPagina = {
    get pagina() { return pagina; },
    get topo() { return topo; },
    set topo(valor) { topo = valor; },
  };

  novaPagina();
  cartoes.forEach((cartao) => {
    const alturaMaxima = ALTURA_PAGINA - ALTURA_CABECALHO - 18 - LIMITE_INFERIOR;
    if (cartao.altura > alturaMaxima) {
      novaPagina();
      desenharCartaoLongo(cartao, fontes, novaPagina, estadoPagina);
      return;
    }
    if (topo - cartao.altura < LIMITE_INFERIOR) {
      novaPagina();
    }
    desenharCartao(pagina, cartao, topo, fontes);
    topo -= cartao.altura + ESPACO_CARTOES;
  });

  documento.getPages().forEach((paginaAtual, indice) => {
    const textoPagina = `Página ${indice + 1} de ${documento.getPageCount()}`;
    paginaAtual.drawText('Lista de consulta | Amigo Secreto 2026', {
      x: MARGEM,
      y: 22,
      size: 8,
      font: fontes.regular,
      color: CORES.secundario,
    });
    paginaAtual.drawText(textoPagina, {
      x: LARGURA_PAGINA - MARGEM - fontes.regular.widthOfTextAtSize(textoPagina, 8),
      y: 22,
      size: 8,
      font: fontes.regular,
      color: CORES.secundario,
    });
  });

  return documento.save();
}
