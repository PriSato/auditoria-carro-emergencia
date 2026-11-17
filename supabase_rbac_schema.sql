-- ============================================================
-- Controle de acesso por papéis (RBAC) — app de auditorias
--
-- Papéis:
--   admin        → vê e faz tudo; cria usuários e define papéis.
--   coordenacao  → acessa SOMENTE o módulo "Equipamento Hospitalar"
--                  (chaves do kv_store que começam com 'equipHosp_').
--   (sem papel)  → não acessa nada.
--
-- Ao rodar, TODOS os usuários que já existem viram administradores (não
-- perdem o acesso). Coordenadores são criados depois, pela aba "Usuários".
--
-- Como rodar: painel do Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (idempotente). Se nenhum administrador
-- existir ao final, o script aborta e NADA é alterado (evita travar todo mundo).
-- ============================================================

-- 1) Papéis dos usuários (uma linha por usuário de auth.users)
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null check (role in ('admin','coordenacao')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- 2) Papel do usuário logado (security definer: lê user_roles sem depender de RLS).
--    Retorna null se o usuário não tem papel ou está desativado.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.role from public.user_roles r
  where r.user_id = auth.uid() and r.active
$$;

revoke all on function public.app_role() from public;
grant execute on function public.app_role() to authenticated;

-- 3) ADMINISTRADORES INICIAIS: todos os usuários que já existem hoje viram
--    admin (mantêm o acesso que têm). Novos usuários (coordenação) serão
--    criados depois, pela aba "Usuários" do app.
insert into public.user_roles (user_id, email, role, active)
select u.id, u.email, 'admin', true
from auth.users u
where u.email is not null
on conflict (user_id) do update set role = 'admin', active = true;

-- 3a) Garante também o admin principal (caso o e-mail exista em auth.users).
insert into public.user_roles (user_id, email, role, active)
select u.id, u.email, 'admin', true
from auth.users u
where lower(u.email) = lower('prikams@yahoo.com.br')
on conflict (user_id) do update set role = 'admin', active = true;

-- 3b) Trava de segurança: aborta (e desfaz tudo) se não houver nenhum admin ativo.
do $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin' and active) then
    raise exception 'Nenhum administrador ativo: não há usuários em auth.users. Crie/entre com um usuário e rode de novo.';
  end if;
end $$;

-- 4) RLS de user_roles: cada um lê só a própria linha; admin lê todas.
--    Não há policy de escrita: só a Edge Function "admin-users" (service role) altera.
alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select" on public.user_roles;
create policy "user_roles_select" on public.user_roles
  for select using (user_id = auth.uid() or public.app_role() = 'admin');

grant select on public.user_roles to authenticated;

-- 5) RLS de kv_store: admin acessa tudo; coordenação só as chaves do módulo
--    Equipamento Hospitalar (prefixo 'equipHosp_', incluindo os detalhes
--    'equipHosp_audit_<id>').
alter table public.kv_store enable row level security;

drop policy if exists "kv_store_select_authenticated" on public.kv_store;
drop policy if exists "kv_store_insert_authenticated" on public.kv_store;
drop policy if exists "kv_store_update_authenticated" on public.kv_store;
drop policy if exists "kv_store_delete_authenticated" on public.kv_store;
drop policy if exists "kv_store_select_rbac" on public.kv_store;
drop policy if exists "kv_store_insert_rbac" on public.kv_store;
drop policy if exists "kv_store_update_rbac" on public.kv_store;
drop policy if exists "kv_store_delete_rbac" on public.kv_store;

create policy "kv_store_select_rbac" on public.kv_store
  for select using (
    public.app_role() = 'admin'
    or (public.app_role() = 'coordenacao' and starts_with(key, 'equipHosp_'))
  );

create policy "kv_store_insert_rbac" on public.kv_store
  for insert with check (
    public.app_role() = 'admin'
    or (public.app_role() = 'coordenacao' and starts_with(key, 'equipHosp_'))
  );

create policy "kv_store_update_rbac" on public.kv_store
  for update using (
    public.app_role() = 'admin'
    or (public.app_role() = 'coordenacao' and starts_with(key, 'equipHosp_'))
  ) with check (
    public.app_role() = 'admin'
    or (public.app_role() = 'coordenacao' and starts_with(key, 'equipHosp_'))
  );

create policy "kv_store_delete_rbac" on public.kv_store
  for delete using (
    public.app_role() = 'admin'
    or (public.app_role() = 'coordenacao' and starts_with(key, 'equipHosp_'))
  );

grant select, insert, update, delete on public.kv_store to authenticated;

-- 5b) Perfis (nome de exibição). Já estava em supabase_schema.sql, mas se aquela
--     parte nunca foi rodada o app dá "Could not find the table 'public.profiles'"
--     e a aba Usuários não mostra os nomes. Idempotente.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

-- 5c) App "Núcleos e Comissões" (tabelas ncom_*): antes qualquer usuário
--     autenticado LIA os dados. Agora que existem usuários de Coordenação (e
--     para que ninguém que se cadastre por fora leia nada), a leitura passa a
--     exigir perfil de administrador. A escrita continua só para ncom_admins.
--     Só é aplicado se as tabelas ncom_* existirem. ATENÇÃO: se você rodar de
--     novo o supabase_ncom_schema.sql, ele recria a policy aberta — rode este
--     arquivo (supabase_rbac_schema.sql) novamente em seguida.
do $$
begin
  if to_regclass('public.ncom_store') is not null then
    execute 'drop policy if exists "ncom_store_select" on public.ncom_store';
    execute $p$create policy "ncom_store_select" on public.ncom_store
              for select using (public.app_role() = 'admin')$p$;
  end if;
  if to_regclass('public.ncom_admins') is not null then
    execute 'drop policy if exists "ncom_admins_select" on public.ncom_admins';
    execute $p$create policy "ncom_admins_select" on public.ncom_admins
              for select using (public.app_role() = 'admin')$p$;
  end if;
end $$;

-- 6) Conferência: deve listar você como admin.
select email, role, active from public.user_roles order by role, email;
