import { supabase, getAuthUser } from '../../contexts/user';

/* ══════════════════════════════════════════════════════════════════
   OFICINA ESTELAR — Histórico de Assinatura Automática
   Tabela: assinatura_historico  (ver supabase_oficina_assinaturas.sql)
══════════════════════════════════════════════════════════════════ */

/* Registra uma assinatura. Pega a identidade do token de acesso atual.
   `tipo` diferencia a origem (assinatura_automatica | carta_correcao, etc.)
   `arquivoUrl` é opcional — link do documento no Storage, se foi guardado
   (permite ao admin ver/baixar depois pelo Histórico de Assinatura). */
export async function logAssinatura({ arquivo, tipo = 'assinatura_automatica', arquivoUrl = null } = {}) {
  const auth = getAuthUser();
  const row = {
    usuario: auth?.name || 'Desconhecido',
    login:   auth?.cpf || auth?.login || auth?.email || '—',
    arquivo: arquivo || '',
    tipo,
    arquivo_url: arquivoUrl,
    assinado_em: new Date().toISOString(),
  };
  const { error } = await supabase.from('assinatura_historico').insert(row);
  if (error) throw error;
}

/* Carrega o histórico mais recente primeiro. */
export async function loadAssinaturas() {
  const { data, error } = await supabase
    .from('assinatura_historico')
    .select('id,usuario,login,arquivo,tipo,arquivo_url,assinado_em')
    .order('assinado_em', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}
