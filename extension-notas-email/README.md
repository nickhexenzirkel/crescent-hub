# Uniko — Notas por e-mail (extensão do Chrome)

Complementa o **Controle de Notas → Observações (Finanças + PDFs)** do Uniko.
Para as notas cujo PDF **não veio nos ZIPs do OneDrive**, ela procura o PDF nos
e-mails (Gmail) e devolve o arquivo para o Uniko ler.

## Como instalar (uma vez)
1. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor** (canto superior direito).
2. Clique em **Carregar sem compactação** e escolha esta pasta (`extension-notas-email`).
3. Recarregue o Uniko (F5). Se aparecer erro de "Extensão não encontrada", confira se o
   endereço do Uniko é um dos de `manifest.json → content_scripts[0].matches`.

## Como usar
1. No Uniko: Controle de Notas → **Observações (Finanças + PDFs)** → anexe a planilha e os ZIPs do OneDrive.
2. Fique logado no Gmail das contas que serão pesquisadas (as duas que guardam as notas: adm7serv e faturamento).
3. Em **Procurar as N que faltam nos e-mails**, informe o número de cada conta como aparece na URL
   (`mail.google.com/mail/u/`**2**`/` → `2`). Ex.: `1,2`. Clique em **Procurar nos e-mails**.
4. Abre-se uma janela do Gmail por conta. **Deixe-a visível** até terminar (o Chrome desacelera muito
   janelas escondidas). A extensão fecha a janela sozinha.
5. Os PDFs achados aparecem na tabela do Uniko; depois é só **Baixar Excel**.

## Como funciona
- Para cada número de nota busca `filename:<número>` no Gmail, abre as conversas encontradas,
  expande as mensagens e baixa os PDFs cujo **nome** traz o número (`NF_51755_…`, `nfes_28698 - …`, `NF 4324`).
- **Não interpreta o PDF.** O Uniko lê o corpo, confere o **número** e o **CNPJ do cliente** e só então aceita
  (o mesmo número existe em municípios e anos diferentes — por isso a extensão entrega todos os candidatos).
- O **assunto do e-mail** só é usado quando o corpo da nota não traz o período/categoria (ex.: notas de
  Fortaleza de 2025); nesse caso o Uniko avisa "tirado do assunto do e-mail".

## Segurança e privacidade
- Usa a sessão do Gmail que **você já tem aberta**; nunca vê nem guarda senha.
- Só aceita comandos vindos da própria página do Uniko (mesma origem) e **só números de nota**
  (3 a 9 dígitos, no máximo 600 por vez) — não busca texto livre nos seus e-mails.
- Entrega apenas anexos **PDF** cujo nome traz o número pedido. Nada é enviado a servidor: os PDFs vão
  do Gmail para a sua aba do Uniko, dentro do navegador.

## Limites conhecidos
- Depende da página do Gmail (busca `filename:`, o botão "Expandir todos" e o atributo `download_url` dos
  anexos). Se o Google mudar a página, a extensão pode precisar de ajuste.
- Uma busca por vez. Se o Gmail pedir login ou verificação, a conta é pulada (aparece no andamento).

## Download em lote das NFS-e (ISS Fortaleza) — v1.3.0
No **Controle de Notas → Leitor de XML**, solte o XML (GINFES) e clique em **Baixar PDFs em lote**.
Para cada nota da 7Serv a extensão abre
`iss.fortaleza.ce.gov.br/grpfor/pagesPublic/consultarNota.seam?codigo=<CodigoVerificacao>&chave=951862&numero=<Numero>`
numa janelinha, baixa o PDF embutido na página (sessão do próprio Chrome) e o Uniko grava cada PDF (`NFSe_<número>.pdf`) direto na pasta que você escolher (sem janela "Salvar como"). A `chave` 951862 é fixa (inscrição da 7Serv); notas de outro prestador são ignoradas.
Depois de atualizar os arquivos, clique em **Recarregar** em `chrome://extensions` (a v1.3.0 pede acesso ao ISS) e F5 no Uniko.

## Baixar Ordens de Serviço da Wowlet — v1.4.0 (só admin, Oficina Estelar)
Na **Oficina Estelar → Baixar Ordens de Serviço**, envie a planilha de manutenção da Wowlet e escolha uma pasta.
A extensão abre uma janela da Wowlet **no seu Chrome (já logado — sem captcha)** e, para cada credenciado:
Credenciados → Nome Fantasia (digita e escolhe a opção) → Buscar → linha → Acessar → `/provider_orders` →
ID da ordem → abre a ordem → imprime em PDF (Ctrl+P) → Logout (`/impersonations`) → próximo credenciado.
Os PDFs vão para `Secretaria / Setor / OS_<id>.pdf` na pasta escolhida; nada passa por servidor.
- **Permissão nova: `debugger`** (digitar com teclas reais e imprimir a página em PDF). O Chrome mostra a faixa
  "depurando este navegador" enquanto roda — é normal. Depois de atualizar os arquivos: **Recarregar** em `chrome://extensions` e F5 no Uniko.
- Deixe a janela da Wowlet aberta e visível até terminar. Se a sessão cair, a extensão avisa e espera você entrar nela.
