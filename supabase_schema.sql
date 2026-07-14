-- Tabela chave-valor que espelha o formato usado hoje pelo app
-- (window.storage: 'audit_index' e 'audit_<id>')
create table if not exists public.kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Mantém updated_at em dia a cada alteração
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kv_store_updated_at on public.kv_store;
create trigger trg_kv_store_updated_at
  before update on public.kv_store
  for each row execute function public.set_updated_at();

-- Row Level Security: o app usa Supabase Auth (login por email/senha).
-- Só usuários autenticados (com sessão válida) podem ler/escrever.
-- Todos os usuários autenticados compartilham os mesmos dados (equipe única),
-- não há isolamento por usuário.
alter table public.kv_store enable row level security;

drop policy if exists "kv_store_select_all" on public.kv_store;
drop policy if exists "kv_store_select_authenticated" on public.kv_store;
create policy "kv_store_select_authenticated" on public.kv_store
  for select using (auth.role() = 'authenticated');

drop policy if exists "kv_store_insert_all" on public.kv_store;
drop policy if exists "kv_store_insert_authenticated" on public.kv_store;
create policy "kv_store_insert_authenticated" on public.kv_store
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "kv_store_update_all" on public.kv_store;
drop policy if exists "kv_store_update_authenticated" on public.kv_store;
create policy "kv_store_update_authenticated" on public.kv_store
  for update using (auth.role() = 'authenticated');

drop policy if exists "kv_store_delete_all" on public.kv_store;
drop policy if exists "kv_store_delete_authenticated" on public.kv_store;
create policy "kv_store_delete_authenticated" on public.kv_store
  for delete using (auth.role() = 'authenticated');
