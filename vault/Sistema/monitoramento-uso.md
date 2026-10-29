---
title: Monitoramento de Uso
---
# Monitoramento de Uso

A aba **Monitoramento de Uso**, exclusiva de administradores no Dashboard RH, reúne:

- presença recente e módulo aberto;
- tempo ativo geral, por módulo e por colaborador, em períodos de 7, 30 ou 90 dias;
- detalhamento por módulo acompanha a pessoa selecionada em **Uso individual**; sem pessoa selecionada, mostra o agregado de todos os colaboradores;
- médias e maior tempo individual no período;
- último tema registrado por colaborador e distribuição desses temas;
- coleção de Unikos capturados e os itens ainda não registrados na coleção.
- histórico de vitórias em Uniko Games, situação do resgate e recuperação de prêmios pendentes ou vitórias que não foram registradas.

## Coleta e banco

O cliente autenticado chama `record_uniko_usage_heartbeat` a cada 20 segundos e quando muda o módulo, o foco da janela ou o tema. O tempo só acumula quando a aba está visível e em foco. Abas abertas em paralelo no mesmo navegador usam um bloqueio local para evitar somar tempo duplicado. A presença é considerada online enquanto há heartbeat recente (até 3 minutos), inclusive com o Uniko aberto em uma aba em segundo plano; isso não significa que a pessoa esteja interagindo com o sistema nesse momento.

O banco agrega o tempo por pessoa e dia nas tabelas `uniko_usage_daily` e `uniko_usage_presence`. A leitura dessas tabelas é restrita por RLS a administradores; o registro é feito por função SQL que valida o colaborador pelo token de autenticação existente.

## Implantação

Execute `supabase_monitoramento_uso.sql` no SQL Editor do projeto Supabase **principal**. O script depende das funções de autenticação de `supabase_seguranca_auth_helper.sql`, já usadas pelo restante do sistema.

O histórico começa após a execução do script e o novo deploy do front-end; não há dados retroativos. As capturas e o catálogo de Unikos existentes são consultados para compor o inventário.

## Limites de interpretação

- “Online” significa Uniko aberto no navegador com conexão recente, não comprovação de interação humana ou de que a aba está em primeiro plano.
- Se a aba fechar ou perder a conexão sem enviar o último heartbeat, a presença pode permanecer online por até 3 minutos.
- O tema exibido é o último tema observado para aquele colaborador; o tema salvo atualmente no navegador só passa a ser conhecido quando ele abre o sistema.
- A coleção usa os registros de `capture_uniko_captures`; mudanças de nome anteriores que não tenham sido sincronizadas podem não ser associadas ao nome atual.
