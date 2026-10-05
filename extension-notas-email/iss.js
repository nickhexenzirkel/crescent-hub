// Roda na página de consulta de NFS-e da Prefeitura de Fortaleza
// (iss.fortaleza.ce.gov.br/grpfor/pagesPublic/consultarNota.seam?codigo=…&chave=…&numero=…).
// A página embute o PDF da nota num <object>; este script espera o PDF aparecer,
// baixa os bytes (mesma origem, com a sessão do próprio Chrome) e entrega ao serviço
// da extensão. Não clica em nada nem preenche formulário.

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const paraBase64 = (bytes) => {
  let bin = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  return btoa(bin);
};

const entregar = (dados) =>
  chrome.runtime.sendMessage({ type: 'NOTASMAIL_I_RESULTADO', ...dados }).catch(() => {});

(async () => {
  const fim = Date.now() + 25000;
  let alvo = null;
  while (Date.now() < fim) {
    alvo = document.querySelector('object[data*="UserResource"], embed[src*="UserResource"]');
    if (alvo) break;
    await esperar(400);
  }
  if (!alvo) {
    const texto = (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    await entregar({ erro: texto ? `A página não trouxe o PDF (${texto})` : 'A página não trouxe o PDF.' });
    return;
  }
  try {
    const r = await fetch(alvo.data || alvo.src, { credentials: 'include' });
    const bytes = new Uint8Array(await r.arrayBuffer());
    const ehPdf = bytes.length > 4 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
    if (!r.ok || !ehPdf) {
      await entregar({ erro: `Resposta inesperada do ISS (status ${r.status}).` });
      return;
    }
    await entregar({ base64: paraBase64(bytes) });
  } catch (e) {
    await entregar({ erro: e?.message || 'Falha ao baixar o PDF.' });
  }
})();
