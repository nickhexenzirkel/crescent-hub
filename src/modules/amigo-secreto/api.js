import { supabase } from '../../contexts/user';

const TABLE = 'amigo_secreto_2026';
const ID = '2026';

export async function carregarAmigoSecreto() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('participantes, atualizado_em')
    .eq('id', ID)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar a lista: ${error.message}`);
  return data || null;
}

export async function publicarAmigoSecreto(participantes) {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({
      id: ID,
      participantes,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('participantes, atualizado_em')
    .single();
  if (error) throw new Error(`Não foi possível publicar a lista: ${error.message}`);
  return data;
}
