-- ============================================================
-- Proteção das listas de auditorias (kv_store, chaves *audit_index)
--
-- Em 25/11/2026 centenas de auditorias sumiram da lista porque o app
-- regravava a lista inteira a partir de uma cópia do aparelho. Com este
-- script:
--   1) cada salvamento altera só a própria auditoria, dentro do banco, em
--      fila (funções idx_upsert / idx_patch / idx_remove);
--   2) nenhuma outra gravação consegue retirar auditoria alguma de uma
--      lista, nem apagar a lista (trava). Só a exclusão individual (idx_remove).
--
-- Aparelhos com o app antigo aberto não conseguem excluir auditorias até
-- recarregar (salvar continua funcionando).
--
-- Manutenção manual pelo SQL Editor que precise retirar itens: dentro de uma
-- transação, antes do update, rode:
--   select set_config('app.remocao_autorizada','sim',true);
--
-- Como rodar: SQL Editor > New query > cole tudo > Run. Pode rodar de novo.
-- No fim há um teste automático; se algo falhar, NADA é alterado.
-- ============================================================
begin;

-- Inclui ou substitui UMA auditoria
create or replace function public.idx_upsert(p_key text, p_entry jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_key is null or p_key !~ 'audit_index$' or coalesce(p_entry->>'id','') = '' then
    raise exception 'idx_upsert: parâmetros inválidos';
  end if;
  insert into public.kv_store(key, value) values (p_key, '[]'::jsonb) on conflict (key) do nothing;
  perform 1 from public.kv_store where key = p_key for update;  -- um salvamento por vez
  update public.kv_store k set value = (
      select coalesce(jsonb_agg(t.e order by t.o), '[]'::jsonb)
      from jsonb_array_elements(k.value) with ordinality as t(e, o)
      where t.e->>'id' is distinct from p_entry->>'id'
    ) || jsonb_build_array(p_entry)
  where k.key = p_key;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'idx_upsert: sem permissão para %', p_key; end if;
end $$;

-- Altera campos de UMA auditoria (ex.: o ciclo)
create or replace function public.idx_patch(p_key text, p_id text, p_patch jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_key is null or p_key !~ 'audit_index$' or coalesce(p_id,'') = '' or p_patch is null then
    raise exception 'idx_patch: parâmetros inválidos';
  end if;
  perform 1 from public.kv_store where key = p_key for update;
  update public.kv_store k set value = (
      select coalesce(jsonb_agg(case when t.e->>'id' = p_id then t.e || (p_patch - 'id') else t.e end order by t.o), '[]'::jsonb)
      from jsonb_array_elements(k.value) with ordinality as t(e, o)
    )
  where k.key = p_key;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'idx_patch: lista % não encontrada ou sem permissão', p_key; end if;
end $$;

-- Exclui UMA auditoria (único caminho permitido para retirar da lista)
create or replace function public.idx_remove(p_key text, p_id text)
returns void language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_key is null or p_key !~ 'audit_index$' or coalesce(p_id,'') = '' then
    raise exception 'idx_remove: parâmetros inválidos';
  end if;
  perform 1 from public.kv_store where key = p_key for update;
  perform set_config('app.remocao_autorizada', 'sim', true);
  update public.kv_store k set value = (
      select coalesce(jsonb_agg(t.e order by t.o), '[]'::jsonb)
      from jsonb_array_elements(k.value) with ordinality as t(e, o)
      where t.e->>'id' is distinct from p_id
    )
  where k.key = p_key;
  get diagnostics n = row_count;
  perform set_config('app.remocao_autorizada', 'nao', true);
  if n = 0 then raise exception 'idx_remove: lista % não encontrada ou sem permissão', p_key; end if;
end $$;

revoke all on function public.idx_upsert(text, jsonb) from public, anon;
revoke all on function public.idx_patch(text, text, jsonb) from public, anon;
revoke all on function public.idx_remove(text, text) from public, anon;
grant execute on function public.idx_upsert(text, jsonb) to authenticated;
grant execute on function public.idx_patch(text, text, jsonb) to authenticated;
grant execute on function public.idx_remove(text, text) to authenticated;

-- Trava: ninguém retira auditoria de lista nem apaga lista fora de idx_remove
create or replace function public.protege_audit_index()
returns trigger language plpgsql as $$
declare removidas int;
begin
  if old.key !~ 'audit_index$' or current_setting('app.remocao_autorizada', true) = 'sim' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Bloqueado: a lista % não pode ser apagada', old.key;
  end if;
  select count(*) into removidas from (
    select e->>'id' from jsonb_array_elements(old.value) as a(e)
    except
    select e->>'id' from jsonb_array_elements(new.value) as b(e)
  ) x;
  if removidas > 0 then
    raise exception 'Bloqueado: a gravação removeria % auditoria(s) de %. Recarregue o app.', removidas, old.key;
  end if;
  return new;
end $$;

drop trigger if exists trg_protege_audit_index on public.kv_store;
create trigger trg_protege_audit_index
  before update or delete on public.kv_store
  for each row execute function public.protege_audit_index();

-- Teste automático numa lista de mentira (apagada ao final)
do $$
declare v jsonb; bloqueou boolean := false;
begin
  perform public.idx_upsert('zz_teste_audit_index', '{"id":"a","n":1}');
  perform public.idx_upsert('zz_teste_audit_index', '{"id":"b","n":1}');
  perform public.idx_upsert('zz_teste_audit_index', '{"id":"a","n":2}');
  perform public.idx_patch('zz_teste_audit_index', 'b', '{"n":3}');
  select value into v from public.kv_store where key = 'zz_teste_audit_index';
  if v <> '[{"id":"b","n":3},{"id":"a","n":2}]'::jsonb then
    raise exception 'Teste de gravação falhou: %', v;
  end if;
  begin
    update public.kv_store set value = '[]'::jsonb where key = 'zz_teste_audit_index';
  exception when raise_exception then bloqueou := true;
  end;
  if not bloqueou then raise exception 'Teste falhou: a trava não bloqueou a remoção'; end if;
  perform public.idx_remove('zz_teste_audit_index', 'a');
  select value into v from public.kv_store where key = 'zz_teste_audit_index';
  if v <> '[{"id":"b","n":3}]'::jsonb then raise exception 'Teste de exclusão falhou: %', v; end if;
  perform set_config('app.remocao_autorizada', 'sim', true);
  delete from public.kv_store where key = 'zz_teste_audit_index';
  perform set_config('app.remocao_autorizada', 'nao', true);
end $$;

commit;

select 'Proteção instalada e testada' as resultado;
