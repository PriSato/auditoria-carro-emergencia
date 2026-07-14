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

-- Perfis de usuário: nome de exibição.
-- Uma linha por usuário autenticado (id = auth.users.id).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Qualquer usuário autenticado pode ver o nome de todos (equipe única),
-- mas só pode criar/editar a própria linha.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
