---
name: email-uniko
description: "Modulo administrativo de consulta do Gmail no Uniko"
metadata:
  type: project
---

# E-mail no Uniko

O modulo independente **E-mail** aparece somente para usuarios com `role === 'admin'`. O bloqueio existe na lista de modulos, na navegacao e nas rotas do servidor (`requireAdmin`); permissao de cargo ou moderador nao libera o acesso.

Cada administrador conecta sua propria conta Google. O OAuth pede somente `https://www.googleapis.com/auth/gmail.readonly`. Busca, leitura e download de anexos consultam o Gmail sob demanda. O Uniko nao grava copias de mensagens nem anexos; guarda no Supabase `settings` apenas o token OAuth de cada administrador, criptografado com AES-256-GCM.

## Configuracao necessaria no servidor

No Google Cloud:

1. Habilitar a Gmail API e configurar a tela de consentimento OAuth.
2. Criar um cliente OAuth do tipo aplicacao web.
3. Adicionar como URI de redirecionamento autorizada: `https://api.centraluniko.com.br/api/email/oauth/callback`.
4. Se a politica da conta Google exigir verificacao para o escopo sensivel do Gmail, concluir a verificacao ou limitar os usuarios de teste conforme as regras do Google.

Configurar no ambiente da VPS, sem colocar os valores no repositorio:

- `GMAIL_GOOGLE_CLIENT_ID`
- `GMAIL_GOOGLE_CLIENT_SECRET`
- `GMAIL_GOOGLE_REDIRECT_URI=https://api.centraluniko.com.br/api/email/oauth/callback`
- `GMAIL_TOKEN_ENCRYPTION_KEY`: chave aleatoria de 32 bytes em hexadecimal (64 caracteres). Gerar diretamente no ambiente seguro, por exemplo com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, e nao compartilhar ou salvar em arquivos versionados.

O servidor precisa ser atualizado e reiniciado para carregar as rotas e variaveis. **Nao e necessario rodar SQL**: a integracao usa a tabela `settings` existente. Trocar ou perder a chave de criptografia impede a leitura dos tokens guardados; nesse caso, definir uma chave segura e conectar novamente as contas.

## Escopo atual

- Conectar e desconectar uma conta Gmail por administrador.
- Pesquisar mensagens usando a consulta do Gmail, abrir mensagens, visualizar anexos PDF/imagem e baixar qualquer anexo diretamente pela Gmail API. Uma busca sem resultados retorna lista vazia sem enviar lote de metadados vazio ao Gmail.
- Ocultar respostas (cabeçalhos de resposta ou assunto começando com "Re:") e mensagens do Mailsuite/Mailtrack, com filtro no servidor e no cliente.
- A lista tem cabeçalho fixo “Caixa de Entrada” com ícone e seletor de mensagens recebidas, enviadas ou ambas; a opção ambas consulta as duas pastas numa única busca e mantém a ordenação mais recente do Gmail. Cada linha posiciona o avatar de iniciais ao lado do assunto e do remetente, como na referência visual. O assunto é padronizado em formato de título e identifica municípios, órgãos/instituições e empresas do catálogo de clientes pelo endereço ou nome do remetente. Também reconhece nomes concatenados como `obrascapistrano` e `institutosaovicente`. A padronização do assunto é apenas visual; o conteúdo original da mensagem não é alterado. Detalhes completos aparecem ao abrir a mensagem. Os anexos ficam em cartões alinhados com tipo, tamanho e ações; por padrão, até três cartões são exibidos e há um controle para expandir/recolher os demais.
- O corpo do e-mail preserva parágrafos, ênfases e conteúdo, usa a fonte Inter e adapta fundo e cor-base ao tema ativo do Uniko, neutralizando cores de fundo/texto embutidas para manter contraste.
- A caixa segue o tema visual do Uniko com camadas translúcidas, realce colorido na mensagem selecionada, data da sidebar em formato relativo/curto (hoje, ontem ou `9 de nov.`), avatar maior e cartões destacados para cabeçalho, destinatários, data e anexos. A lista rola independentemente; a mensagem aberta tem uma área de rolagem própria que inclui cabeçalho, todos os anexos e o conteúdo, sem ultrapassar o painel.
- A pesquisa agrupa a leitura dos metadados em uma chamada batch à Gmail API para reduzir esperas de rede. Ao trocar de pasta ou pesquisar, a lista não carrega automaticamente o corpo completo do primeiro e-mail; o corpo e os anexos só são buscados quando uma mensagem é selecionada.
- A barra de pesquisa executa a consulta automaticamente após 500 ms sem digitação; resultados de consultas antigas são descartados se uma busca mais nova já estiver em andamento.
- O botão “Adicionar filtros” abre filtros combináveis por cliente (com sugestões do catálogo), destinatário, intervalo inclusivo de datas e campo de número da nota/município. Ao preenchê-lo, a busca inclui termos fiscais e consulta Recebidos e Enviados, selecionando automaticamente a pasta dos resultados com base nos marcadores Gmail. Os filtros são aplicados automaticamente e não alteram a mensagem original.
- Sem envio de e-mails, armazenamento de mensagens/anexos ou notificacoes. Notificacoes ficam para uma etapa futura.
- A tela precisa ser testada com uma conta Google autorizada depois de configurar OAuth e publicar o servidor.
