// Roda DENTRO da página do Gmail (aba que a extensão abre em segundo plano).
// Para cada número de nota: busca `filename:<número>`, abre as conversas que
// aparecem, expande as mensagens e baixa os PDFs cujo NOME traz o número.
// Não interpreta o PDF: entrega os bytes ao Uniko, que confere número e CNPJ
// do cliente (o mesmo número existe em municípios e anos diferentes).

(() => {
  'use strict';
  if (window.__notasMailCarregado) return;
  window.__notasMailCarregado = true;

  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  // Espera `fn()` devolver algo verdadeiro (ou estourar o tempo). Devolve o valor.
  const aguardar = async (fn, timeout = 10000, intervalo = 300) => {
    const fim = Date.now() + timeout;
    while (Date.now() < fim) {
      const v = fn();
      if (v) return v;
      await esperar(intervalo);
    }
    return null;
  };

  // Mesma regra do Controle de Notas (observacoesNotas.js): só arquivos "NF..."
  // e o número (3 a 9 dígitos, sem zeros à esquerda) que aparece no nome.
  const numerosDoNome = (nome) => {
    const base = String(nome).replace(/\.pdf$/i, '');
    if (!/(^|[^A-Za-z])(NFES?|NFSE|NOTA|NF)(?![A-Za-z])/i.test(base)) return [];
    return [...base.matchAll(/(?<!\d)0*(\d{3,9})(?!\d)/g)].map((m) => m[1]);
  };

  const emailDaConta = () => (document.title.match(/[\w.+-]+@[\w.-]+\.\w+/) || [''])[0];

  const linhas = () => [...document.querySelectorAll('tr.zA')].filter((r) => r.offsetParent !== null);
  const chaveLinha = (r) =>
    r.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id') ||
    (r.querySelector('.bog')?.textContent || '') + '|' + (r.querySelector('td.xW span')?.getAttribute('title') || '');
  const dataLinha = (r) => r.querySelector('td.xW span')?.getAttribute('title') || '';

  const conversaAberta = () => document.querySelector('h2.hP') && location.hash.split('/').length > 2;

  const clicar = (el) => {
    for (const t of ['mousedown', 'mouseup', 'click'])
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
  };

  const paraBase64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };

  // Vai para a lista de resultados de `filename:<numero>` e espera ela assentar.
  const irParaBusca = async (numero) => {
    const q = `filename:${numero}`;
    const alvo = '#search/' + encodeURIComponent(q);
    if (location.hash !== alvo) location.hash = alvo;
    // a caixa de busca mostra a consulta nova → a lista abaixo já é a certa
    await aguardar(() => {
      const box = document.querySelector('input[name="q"]');
      return !conversaAberta() && box && box.value.replace(/\s+/g, '') === q;
    }, 8000, 200);
    await esperar(1200);
    // lista estável (mesmo nº de linhas em duas leituras seguidas)
    let ultimo = -1;
    await aguardar(() => {
      const n = linhas().length;
      const estavel = n === ultimo;
      ultimo = n;
      return estavel;
    }, 8000, 700);
  };

  // Abre a conversa, expande todas as mensagens e devolve os anexos.
  const lerConversa = async (linha) => {
    const celula = linha.querySelector('td.xY.a4W') || linha.querySelector('.y6') || linha;
    clicar(celula);
    if (!(await aguardar(conversaAberta, 10000))) return null;
    await esperar(800);
    const botao = document.querySelector('button[aria-label="Expandir todos"], button[aria-label="Expand all"]');
    if (botao) {
      clicar(botao);
      await esperar(1200);
    }
    let ultimo = -1;
    await aguardar(() => {
      const n = document.querySelectorAll('[download_url]').length;
      const estavel = n === ultimo && n > 0;
      ultimo = n;
      return estavel;
    }, 8000, 700);
    const assunto = (document.querySelector('h2.hP')?.textContent || '').trim();
    const anexos = [...document.querySelectorAll('[download_url]')]
      .map((e) => {
        const m = (e.getAttribute('download_url') || '').match(/^([^:]+):(.*?):(https:\/\/mail\.google\.com\/.+)$/);
        if (!m) return null;
        let nome = m[2];
        try { nome = decodeURIComponent(nome); } catch { /* mantém o nome cru */ }
        return { mime: m[1], nome, url: m[3] };
      })
      .filter(Boolean);
    return { assunto, anexos };
  };

  /**
   * Procura todos os `numeros` nesta conta. `enviar(msg)` recebe cada PDF
   * achado e o andamento. Devolve { encontrados, arquivos }.
   */
  const buscar = async ({ jobId, conta, numeros }, enviar, cancelado = () => false) => {
    const pedidos = new Set(numeros.map((n) => String(n).replace(/^0+/, '')));
    const conversasLidas = new Set();
    const baixados = new Set();
    const comArquivo = new Set();
    let arquivos = 0;
    const email = emailDaConta();

    let feitos = 0;
    for (const numero of numeros) {
      if (cancelado()) break;
      await irParaBusca(numero);
      // até 8 conversas por número; as já lidas (que serviram a outra nota) são puladas
      for (let tentativa = 0; tentativa < 8 && !cancelado(); tentativa++) {
        const linha = linhas().slice(0, 8).find((r) => !conversasLidas.has(chaveLinha(r)));
        if (!linha) break;
        const chaveConv = chaveLinha(linha);
        const data = dataLinha(linha);
        conversasLidas.add(chaveConv);
        const conversa = await lerConversa(linha);
        if (conversa) {
          for (const a of conversa.anexos) {
            if (!/pdf/i.test(a.mime) && !/\.pdf$/i.test(a.nome)) continue;
            const nums = numerosDoNome(a.nome).filter((n) => pedidos.has(n));
            if (nums.length === 0) continue;
            const id = chaveConv + '|' + a.nome;
            if (baixados.has(id)) continue;
            baixados.add(id);
            try {
              const resp = await fetch(a.url, { credentials: 'include' });
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              const bytes = new Uint8Array(await resp.arrayBuffer());
              if (String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') throw new Error('não é PDF');
              enviar({
                type: 'NOTASMAIL_G_ARQUIVO', jobId, conta, email, numeros: nums,
                nome: a.nome, assunto: conversa.assunto, dataEmail: data, base64: paraBase64(bytes),
              });
              arquivos++;
              nums.forEach((n) => comArquivo.add(n));
            } catch (e) {
              enviar({ type: 'NOTASMAIL_G_LOG', jobId, texto: `Anexo ${a.nome}: ${e.message}` });
            }
          }
        }
        await irParaBusca(numero); // volta para a lista e segue nas próximas conversas
      }
      feitos++;
      enviar({ type: 'NOTASMAIL_G_PROGRESSO', jobId, conta, feitos, total: numeros.length });
    }
    return { encontrados: [...comArquivo], arquivos };
  };

  // Registro no navegador: só aceita mensagens da própria extensão.
  const cancelados = new Set();
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, responder) => {
      if (sender.id !== chrome.runtime.id || !msg?.type?.startsWith('NOTASMAIL_G_')) return;
      if (msg.type === 'NOTASMAIL_G_PING') {
        responder({ ok: true, email: emailDaConta(), url: location.href });
        return;
      }
      if (msg.type === 'NOTASMAIL_G_CANCELAR') {
        cancelados.add(msg.jobId);
        return;
      }
      if (msg.type === 'NOTASMAIL_G_BUSCAR') {
        buscar(msg, (m) => chrome.runtime.sendMessage(m).catch(() => {}), () => cancelados.has(msg.jobId))
          .then(responder)
          .catch((e) => responder({ erro: e?.message || 'falha ao buscar no Gmail' }));
        return true; // resposta assíncrona
      }
    });
  } else {
    window.__notasMail = { buscar, numerosDoNome }; // só para testes fora da extensão
  }
})();
