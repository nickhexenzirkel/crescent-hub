---
name: ponto-justificativa-modal
description: Modal grande de justificativa no módulo admin do Ponto (mostra motivo + anexo do colaborador)
metadata: 
  type: project
---

**Justificar dia = modal grande** (ago/2026, `ponto-eletronico/index.jsx`): o botão "Justificar/Editar" na coluna Justificativa do Banco de Horas **não** abre mais um textarea inline — abre um card grande (`editJust` vira o gatilho do modal) que mostra a **solicitação do colaborador** (título, descrição e **prévia do anexo**: imagem inline `<img>`, PDF em `<iframe>`, outros como link) + textarea da justificativa do RH (Salvar e abonar / Remover / Cancelar). A célula mantém a **prévia** do motivo (e badge 📎 quando há anexo).

**Afastamento (ago/2026):** no painel do banco de horas INDIVIDUAL (`bancoEmpMode==='single'`) tem o botão **"Atribuir afastamento"** (admin) → modal com período (início/fim), motivo e anexo. `atribuirAfastamento` sobe o anexo UMA vez (`uploadJustifAnexo`) e chama `saveJustificativa` pra CADA dia útil do período (pula fim de semana/feriado via `isDayOff_p`), com texto `Afastamento (data a data): motivo` — abona o período todo de uma vez. Estados `afastModal`/`afastForm`/`afastFile`. Reusa as colunas de anexo de `ponto_justificativas` (mesma migration).

- Solicitações carregadas via `loadSolicitacoes()` (novo em `pontoDb.js`) da tabela `ponto_solicitacoes`; casadas por `ponto_cpf`==cpf(PIS) OU nome (`findSolic`). Helpers de módulo: `anexoTipo(url,name)`, `_normNome`. Remover justificativa: `removeJustif`.

**Anexo do RH** (ago/2026): quando o colaborador NÃO enviou solicitação, o Admin/Moderador pode **anexar o documento** direto no modal. Colunas novas `file_url`/`file_name` em `ponto_justificativas` (**rodar `supabase_ponto_justificativa_anexo.sql`**); upload via `uploadJustifAnexo()` (pontoDb) pro bucket `ponto-anexos` (reusa o das solicitações). Estado `justFile` (File novo | `'remove'` | null=mantém) + `justSaving`. O anexo aparece pro colaborador em "Justificativas abonadas" (TabMeuPonto) e `pontoCalc.loadColaboradorPonto` passou a selecionar file_url/file_name.

Relacionado: [[ponto-eletronico-persistencia]] (fluxo solicitação→RH→abono).
