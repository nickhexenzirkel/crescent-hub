// Roda dentro do sistema da Wowlet (app.7beneficiosgestao.com.br), na janela que o
// serviço da extensão abre para "Baixar Ordens de Serviço". Responde a comandos do
// background (WOW_*) — cada um faz UMA coisa simples na página (achar campo, clicar,
// ler a lista). Não guarda estado entre páginas e não lê/guarda senha: a sessão é a
// que o próprio Chrome já tem aberta. Quem digita (teclas reais) é o background.

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const visivel = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

const clicarReal = (el) => {
  el.scrollIntoView({ block: 'center' });
  for (const t of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
  }
};
// Clique que pode trocar de página: responde antes, clica logo depois (a resposta não se perde na navegação).
const clicarDepois = (el) => setTimeout(() => { el.scrollIntoView({ block: 'center' }); el.click(); }, 60);

const porRotulo = (rotulo) => {
  const alvo = norm(rotulo);
  for (const l of document.querySelectorAll('label')) {
    if (!norm(l.textContent).includes(alvo)) continue;
    const c = l.control || (l.htmlFor && document.getElementById(l.htmlFor)) || l.querySelector('input,select,textarea');
    if (c && visivel(c)) return c;
  }
  return [...document.querySelectorAll('input')].find((i) => visivel(i) && norm(i.placeholder).includes(alvo)) || null;
};
const comRotulo = () => [...document.querySelectorAll('input,select,textarea')].filter((c) => visivel(c) && c.labels?.length);

const botaoBuscar = (raiz = document) =>
  [...raiz.querySelectorAll('button, input[type=submit], input[type=button], a.button')]
    .find((b) => visivel(b) && norm(b.textContent || b.value) === 'BUSCAR') || null;

// Opções do autocompletar: elementos "folha" visíveis, curtos, que contêm o termo.
const SEL_OPCOES = '[role=option], li, .dropdown-item, [class*=option], [class*=suggest], [class*=autocomplete] *';
const opcoesDe = (termo) => {
  const t = norm(termo.split(/\s+/)[0]);
  const todas = [...document.querySelectorAll(SEL_OPCOES)]
    .filter((el) => visivel(el) && el.textContent.trim().length < 200 && norm(el.textContent).includes(t));
  return todas.filter((el) => !todas.some((o) => o !== el && el.contains(o)));
};

const linhasDe = (termo) => [...document.querySelectorAll('tr')].filter((tr) => visivel(tr) && norm(tr.textContent).includes(norm(termo)));

const linkOrdem = (os) =>
  [...document.querySelectorAll('a')].find((a) => visivel(a) && a.textContent.trim().toLowerCase().startsWith(String(os).toLowerCase())) || null;

const comandos = {
  WOW_PING: () => ({ ok: true }),

  WOW_ESTADO: () => ({
    ok: true,
    url: location.href,
    logado: !location.pathname.startsWith('/sessions'),
    temAcessar: [...document.querySelectorAll('a')].some((a) => visivel(a) && norm(a.textContent) === 'ACESSAR'),
    temLogoutImp: !!document.querySelector('a[href="/impersonations"][data-method="delete"], a[data-to="/impersonations"]'),
    temOrdem: /Ordem de Serviço:/i.test(document.body.innerText),
    temCampoOrdem: !!document.querySelector('input[name="order_id"]'),
    captcha: /desafio de verifica/i.test(document.body.innerText),
  }),

  // 1º clique na gravação = Razão Social; 2º = Nome Fantasia (o foco fica nele para o background digitar).
  WOW_CLICAR_CAMPOS: async () => {
    let razao = porRotulo('Razao Social');
    let fantasia = porRotulo('Nome Fantasia');
    let via = 'rótulos';
    if (!fantasia) {
      const lista = comRotulo();
      razao = lista[2]; fantasia = lista[3]; via = 'ordem dos campos (gravação)';
      if (!fantasia) {
        return { ok: false, erro: 'Não achei o campo Nome Fantasia.', campos: [...document.querySelectorAll('input,select')].filter(visivel).map((c) => `${c.tagName}[${c.name || c.id || ''}|${c.placeholder || ''}]`) };
      }
    }
    if (razao) { clicarReal(razao); await esperar(700); }
    clicarReal(fantasia); fantasia.focus();
    await esperar(500);
    const foco = document.activeElement;
    if (foco && 'value' in foco) { foco.value = ''; foco.dispatchEvent(new Event('input', { bubbles: true })); }
    return { ok: true, via, foco: `${foco?.tagName}[${foco?.name || foco?.id || ''}]` };
  },

  WOW_OPCOES: ({ termo }) => ({ ok: true, textos: opcoesDe(termo).slice(0, 12).map((o) => o.textContent.trim().replace(/\s+/g, ' ')) }),

  WOW_CLICAR_OPCAO: ({ termo, idx }) => {
    const o = opcoesDe(termo)[idx];
    if (!o) return { ok: false, erro: 'Opção sumiu da lista.' };
    clicarReal(o);
    return { ok: true };
  },

  WOW_BUSCAR: () => {
    const b = botaoBuscar();
    if (!b) return { ok: false, erro: 'Botão Buscar não encontrado.' };
    clicarDepois(b);
    return { ok: true };
  },

  WOW_LINHAS: ({ termo, alvo }) => ({
    ok: true,
    linhas: linhasDe(termo).map((tr, i) => ({ i, texto: tr.textContent.trim().replace(/\s+/g, ' ').slice(0, 140), exata: norm(tr.textContent).includes(norm(alvo)) })),
  }),

  WOW_ACESSAR: async ({ termo, i }) => {
    const tr = linhasDe(termo)[i];
    if (!tr) return { ok: false, erro: 'Linha do credenciado sumiu.' };
    tr.scrollIntoView({ block: 'center' });
    (tr.querySelector('td') || tr).click();
    await esperar(1200);
    const a = [...tr.querySelectorAll('a')].find((x) => norm(x.textContent) === 'ACESSAR');
    if (!a) return { ok: false, erro: 'Não achei o botão Acessar nessa linha.' };
    clicarDepois(a);
    return { ok: true };
  },

  WOW_BUSCAR_OS: ({ os }) => {
    const campo = document.querySelector('input[name="order_id"]');
    if (!campo) return { ok: false, erro: 'Campo do ID da ordem não encontrado.' };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    campo.focus(); setter.call(campo, os);
    campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
    const b = botaoBuscar(campo.form || document);
    if (!b) return { ok: false, erro: 'Botão Buscar não encontrado.' };
    clicarDepois(b);
    return { ok: true };
  },

  WOW_ABRIR_ORDEM: ({ os }) => {
    const a = linkOrdem(os);
    if (!a) return { ok: false, erro: 'não achei' };
    clicarDepois(a);
    return { ok: true };
  },

  WOW_LOGOUT: () => {
    const a = document.querySelector('a[href="/impersonations"][data-method="delete"], a[data-to="/impersonations"]');
    if (!a) return { ok: false, erro: 'Link de logout não encontrado.' };
    clicarDepois(a);
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  const fn = msg?.type && comandos[msg.type];
  if (!fn) return false;
  Promise.resolve().then(() => fn(msg)).then(responder).catch((e) => responder({ ok: false, erro: e?.message || 'falha' }));
  return true;
});
