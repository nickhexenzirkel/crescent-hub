// Fila de "Pedidos de Ajuste" (tabela uniko_pedidos_ajuste, Supabase principal).
// Usado pelo comando /pedidos do Claude Code:
//   node scripts/pedidos.mjs list                 → mostra os pendentes/reabertos
//   node scripts/pedidos.mjs done <id> "nota"     → marca como feito, com o que foi mudado
//   node scripts/pedidos.mjs skip <id> "motivo"   → descarta (não dá/não deve fazer)
// Usa a chave anon pública (a mesma do site) — não há segredo aqui.
import { createClient } from '@supabase/supabase-js';

const URL = 'https://iqsufxvuufkaswellisy.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxc3VmeHZ1dWZrYXN3ZWxsaXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTQ5MzUsImV4cCI6MjA5NTY3MDkzNX0.Cl6h-HM_RK0In5UTn2Hc-mhPQ2p8iOsG23EYfG8PX4c';
const sb = createClient(URL, ANON);
const [cmd, id, ...resto] = process.argv.slice(2);

if (cmd === 'list') {
  const { data, error } = await sb.from('uniko_pedidos_ajuste').select('*').in('status', ['pendente', 'reaberto']).order('created_at');
  if (error) { console.error('ERRO:', error.message, '\n(Se a tabela não existe: rodar supabase_pedidos_ajuste.sql no Supabase principal.)'); process.exit(1); }
  if (!data.length) { console.log('Nenhum pedido pendente.'); process.exit(0); }
  for (const p of data) {
    console.log(`\n#${p.id} [${p.status}] ${p.titulo}${p.area ? `  (tela: ${p.area})` : ''}`);
    if (p.descricao) console.log(p.descricao);
    if (p.status === 'reaberto') console.log(`>> REABERTO. Feito antes: ${p.nota_ia || '—'} | Comentário do dono: ${p.comentario || '—'}`);
  }
} else if (cmd === 'done' || cmd === 'skip') {
  if (!id) { console.error('Faltou o id.'); process.exit(1); }
  const nota = resto.join(' ').trim() || null;
  const patch = cmd === 'done' ? { status: 'feito', nota_ia: nota } : { status: 'descartado', nota_ia: nota };
  const { error } = await sb.from('uniko_pedidos_ajuste').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { console.error('ERRO:', error.message); process.exit(1); }
  console.log(`Pedido #${id} atualizado (${patch.status}).`);
} else {
  console.log('Uso: node scripts/pedidos.mjs list | done <id> "nota" | skip <id> "motivo"');
}
