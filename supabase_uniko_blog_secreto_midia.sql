-- Blog Secreto — permite anexar imagem/gif/vídeo nas mensagens (além de texto/emoji,
-- que não precisam de coluna nova). Roda depois de supabase_uniko_blog_secreto.sql.
-- Mesmo padrão já usado na Oficina de Uniko: mídia como base64 (dataURL) direto na
-- coluna, sem Supabase Storage.

alter table public.uniko_blog_secreto
  add column if not exists media_url  text,               -- dataURL base64 (imagem/gif/vídeo) ou null
  add column if not exists media_type text;                -- 'image' | 'gif' | 'video' | null

-- `text` pode ficar vazio quando a mensagem é só mídia (sem legenda) — remove a
-- restrição not null original (supabase_uniko_blog_secreto.sql criou como not null).
alter table public.uniko_blog_secreto alter column text drop not null;
