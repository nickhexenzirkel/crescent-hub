/* ══════════════════════════════════════════════════════════════════════════
   NOVIDADES — os cartões deitados que giram no widget do layout novo do menu

   Cada entrada é um aviso curto do tipo "Uniko Paint: temas novos". Vive em
   código por enquanto (não há tela no Dashboard pra escrever isso): pra
   anunciar algo, é só pôr uma entrada no topo da lista.

     id       — único
     titulo   — o nome do lugar, curto ("Uniko Paint")
     texto    — a novidade em uma frase curta (cabe em duas linhas)
     detalhe  — (opcional) uma linha menor embaixo
     destino  — pra onde o clique leva: [módulo, aba?]. Abas do Portal usam
                o módulo 'colaborador'; a Prisma Store aceita 'checkin' etc.
     acao     — (no lugar de destino) abre uma ação da própria tela de
                módulos, pelo id do botão do card de perfil: 'tema',
                'ordem', 'tamanho', 'cor', 'atalhos'
     arte     — qual animação acompanha: 'pincel' | 'presente' | 'ondas' |
                'paleta' | 'grade'
     cor      — cor da arte (o texto continua na cor do tema)
     ate      — (opcional) AAAA-MM-DD; depois disso o cartão some sozinho

   A Prisma Store NÃO precisa de entrada aqui: o widget monta o cartão dela
   com o catálogo de verdade (quantos prêmios, qual está em destaque, se o
   catálogo mudou nos últimos dias).
══════════════════════════════════════════════════════════════════════════ */
export const NOVIDADES = [
  { id:'temas-novos-2026-09', titulo:'Temas novos', texto:'Novas cores pra deixar o Uniko com a sua cara.',
    detalhe:'Lilás, Sakura, Bege, Preto e Cinza', acao:'tema', arte:'paleta', cor:'#9BA0FA', ate:'2026-10-31' },
  { id:'modulos-personalizaveis-2026-09', titulo:'Seus módulos', texto:'Ordem, tamanho e cor, do seu jeito.',
    detalhe:'Ajuste pelo seu card de perfil', acao:'tamanho', arte:'grade', cor:'#34C759', ate:'2026-10-31' },
  { id:'paint-temas-2026-09', titulo:'Uniko Paint', texto:'Temas novos adicionados.',
    detalhe:'Chame a equipe pra desenhar', destino:['colaborador','unikopaint'], arte:'pincel', cor:'#EC4899', ate:'2026-10-15' },
  { id:'wave-descubra-2026-09', titulo:'Uniko Wave', texto:'Descubra novas músicas.',
    detalhe:'Tem seleção nova na sua biblioteca', destino:['colaborador','unikowave'], arte:'ondas', cor:'#8B5CF6', ate:'2026-10-15' },
];

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* Só o que ainda está no prazo. Comparação de string funciona porque as
   datas estão todas em AAAA-MM-DD. */
export const novidadesAtivas = () => {
  const hoje = hojeISO();
  return NOVIDADES.filter(n => !n.ate || n.ate >= hoje);
};
