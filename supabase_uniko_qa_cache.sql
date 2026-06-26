-- Cache / aprendizado do assistente UNIKO.
-- Guarda as perguntas que a FAQ do cliente NÃO soube responder e foram pra IA (Groq), junto da
-- resposta. Serve pra dois fins:
--   1) CACHE: a mesma pergunta (normalizada) não chama a IA de novo → menos requisições no Groq.
--   2) APRENDIZADO: lista pra revisar e promover ao FAQ curado (marque in_faq = true ao adicionar).
-- Rodar uma vez no SQL Editor do Supabase.

create table if not exists uniko_qa_cache (
  qkey       text primary key,                 -- pergunta normalizada (minúsculas, sem acento/pontuação)
  question   text not null,                     -- pergunta original (pra exibir/revisar)
  answer     text not null,                     -- resposta dada pela IA
  hits       int  not null default 1,           -- quantas vezes essa pergunta apareceu
  in_faq     boolean not null default false,    -- já foi adicionada ao FAQ curado?
  created_at timestamptz not null default now(),
  last_asked timestamptz not null default now()
);

-- Mais perguntadas primeiro (prioridade pra virar FAQ curado).
create index if not exists uniko_qa_cache_hits_idx on uniko_qa_cache (hits desc);
