/* Visitante — acesso sem login/cadastro, 100% no navegador (sem token, sem
   linha no Supabase). `authUser` do visitante nunca tem `id`/`cpf` reais —
   é só isso que o resto do app usa pra saber que não é um colaborador de
   verdade (ver App.jsx: o efeito de cargos já pula quando `authUser?.id` é
   vazio). O número aleatório no nome existe só pra não confundir dois
   visitantes concorrentes nos mesmos jogos/Colegas (ambos se chamariam
   "Visitante" sem ele) — sorteado uma vez por aba (sessionStorage), nunca
   persistido em lugar nenhum do banco.
*/
const NUM_KEY = 'uniko_visitante_num';

const numeroVisitante = () => {
  try {
    let n = sessionStorage.getItem(NUM_KEY);
    if (!n) {
      n = String(Math.floor(1000 + Math.random() * 9000));
      sessionStorage.setItem(NUM_KEY, n);
    }
    return n;
  } catch {
    return String(Math.floor(1000 + Math.random() * 9000));
  }
};

const criarUsuarioVisitante = () => {
  const nome = `Visitante ${numeroVisitante()}`;
  return { id: null, cpf: null, role: 'visitante', name: nome };
};

const isVisitante = (authUser) => authUser?.role === 'visitante';

export { criarUsuarioVisitante, isVisitante };
