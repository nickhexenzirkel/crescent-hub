---
name: whatsapp-financeiro-chamadas-armazenamento
description: Chamadas de celular não tocavam nos PCs vinculados do WhatsApp Business do financeiro — causa real era armazenamento cheio do celular principal (08/out/2026)
metadata:
  type: reference
---

Sintoma (08/out/2026): número do Financeiro (Business, coexistência com Dualhook, antes WhatsApp comum) só tocava nos PCs vinculados (Web/desktop) quando a ligação vinha de computador; de celular tocava só no celular principal e nem entrava nos recentes dos PCs. Faturamento e outros setores, configurados igual, funcionavam.

**Causa real: armazenamento do celular principal cheio/baixo.** Resolvido liberando espaço.

**Why:** gastamos horas em hipóteses erradas (Dualhook, conversão comum→Business, Web vs app, permissões Meta). Suporte Dualhook confirmou que chamadas não passam pela API em coexistência; não existe configuração de chamadas no Gerenciador do WhatsApp.

**How to apply:** se de novo "chamada toca no celular mas não nos aparelhos vinculados", checar PRIMEIRO armazenamento livre e bateria/dados em segundo plano do celular principal, antes de mexer em Dualhook/Meta. Não desconectar Dualhook (desvincula aparelhos e gera nova chave de API).
