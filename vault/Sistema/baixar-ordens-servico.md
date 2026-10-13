---
name: baixar-ordens-servico
description: "Oficina Estelar (admin) \"Baixar Ordens de Serviço\" — extensão Uniko Notas por e-mail v1.4.x baixa PDFs da Wowlet no Chrome logado; por que NÃO é servidor"
metadata:
  type: project
---

Aba admin-only `baixar-os` da Oficina Estelar (`TabBaixarOS.jsx`). Lê a planilha de manutenção da Wowlet (colunas ID da Ordem de Serviço, Credenciado, Setor, Cliente) e a extensão `extension-notas-email` (v1.4.1+, `ordens.js` + `wowlet.js`) baixa o PDF de cada OS em `app.7beneficiosgestao.com.br`, gravando `Secretaria/Setor/OS_<id>.pdf` numa pasta escolhida UMA vez (handle guardado em IndexedDB).

**Why:** a Wowlet pede captcha no login, então robô na VPS (Playwright) falhou — por isso roda no Chrome logado do usuário. Salvar via chrome.downloads abria "Salvar como" (config do Chrome), então o Uniko grava via File System Access (pasta nova: Downloads/Documentos/OneDrive raiz são bloqueados).

**How to apply:** o filtro de credenciado é GET `/providers?business_name=<opção do select>` (select2, não digitar); logout do credenciado = link `/impersonations` (data-method delete); PDF = `Page.printToPDF` via chrome.debugger (Ctrl+P). Sempre subir a versão do manifest ao mudar a extensão (senão o usuário roda código antigo) e exigir no `VERSAO_MIN` da aba. Plano B local: `ferramentas/baixar-os/baixar-os.mjs` (Playwright).
