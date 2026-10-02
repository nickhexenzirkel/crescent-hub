-- Uniko Safer — novos setores: Suporte Técnico e Contratual.
-- Remove a trava antiga (só faturamento/financeiro) e põe uma nova com os 4 setores.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.uniko_safer_contacts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.uniko_safer_contacts drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.uniko_safer_contacts
  add constraint uniko_safer_contacts_category_check
  check (category in ('faturamento','financeiro','suporte_tecnico','contratual'));
