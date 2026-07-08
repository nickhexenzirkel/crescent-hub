-- Oficina de Uniko — cenário personalizado (OPCIONAL). Se o admin anexar uma imagem,
-- ela aparece como fundo quando o Uniko spawnar no Capture o Uniko, em vez da cor
-- gradiente padrão. Se não anexar nada, continua igual a antes (só a cor). Rode no
-- SQL Editor do Supabase.

alter table public.custom_unikos add column if not exists img_scene text;
