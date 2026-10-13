// Núcleo (sem dependências) do "Imagens do Site": troca uma imagem do Uniko em TODO o
// site sem mexer no código. O mapa é { "/UNIKO_NEW.png": "https://…/nova.png" }.
// A troca acontece na hora em que o React define o `src` de um <img> (antes de o
// navegador baixar a original), e reaplica nos <img> que já estavam na tela quando o
// mapa muda. Imagens com ?__orig na URL nunca são trocadas (usado pra mostrar a original
// no painel de admin). Arquivo separado e puro pra poder ser testado fora do navegador.

export function criarReescritor(lerMapa, origem) {
  return function reescrever(valor) {
    if (typeof valor !== 'string' || !valor) return valor;
    try {
      const u = new URL(valor, origem);
      if (u.origin !== new URL(origem).origin || u.searchParams.has('__orig')) return valor;
      const alvo = lerMapa()[u.pathname];
      return alvo || valor;
    } catch { return valor; }
  };
}

// Instala os "ganchos" nos <img>. `env` = { HTMLImageElement, Element } (injetável p/ teste).
export function instalarGanchos(env, reescrever) {
  const { HTMLImageElement, Element } = env;
  if (!HTMLImageElement || HTMLImageElement.prototype.__siteImagens) return false;
  HTMLImageElement.prototype.__siteImagens = true;
  const setAttrNativo = Element.prototype.setAttribute;
  HTMLImageElement.prototype.setAttribute = function (nome, valor) {
    if (String(nome).toLowerCase() === 'src') { this.__srcOriginal = valor; valor = reescrever(valor); }
    return setAttrNativo.call(this, nome, valor);
  };
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (d && d.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set(valor) { this.__srcOriginal = valor; d.set.call(this, reescrever(valor)); },
    });
  }
  return setAttrNativo;   // o painel usa pra reaplicar sem sobrescrever __srcOriginal
}

// Reaplica o mapa nos <img> que já estão na página.
export function reaplicar(imgs, reescrever, setAttrNativo) {
  for (const img of imgs) {
    const original = img.__srcOriginal ?? img.getAttribute('src');
    const novo = reescrever(original);
    if (novo !== img.getAttribute('src')) { img.__srcOriginal = original; setAttrNativo.call(img, 'src', novo); }
  }
}
