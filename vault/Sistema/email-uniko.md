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
- Pesquisar mensagens usando a consulta do Gmail, abrir mensagens, visualizar anexos PDF/imagem e baixar qualquer anexo diretamente pela Gmail API.
- Ocultar respostas (cabeçalhos de resposta ou assunto começando com "Re:") e mensagens do Mailsuite/Mailtrack, com filtro no servidor e no cliente.
- A lista mostra assunto, remetente com avatar de iniciais e, quando identificável, o município/cliente extraído do domínio institucional ou nome do remetente. Detalhes completos aparecem ao abrir a mensagem. Os anexos ficam em cartões alinhados com tipo, tamanho e ações.
- O corpo do e-mail preserva parágrafos, ênfases e conteúdo, usa a fonte Inter e adapta fundo e cor-base ao tema ativo do Uniko, neutralizando cores de fundo/texto embutidas para manter contraste.
- A pesquisa agrupa a leitura dos metadados em uma chamada batch à Gmail API para reduzir esperas de rede.
- Sem envio de e-mails, armazenamento de mensagens/anexos ou notificacoes. Notificacoes ficam para uma etapa futura.
- A tela precisa ser testada com uma conta Google autorizada depois de configurar OAuth e publicar o servidor.
