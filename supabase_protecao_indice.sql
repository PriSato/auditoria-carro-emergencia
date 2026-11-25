-- ============================================================
-- Trava de segurança das listas de auditorias (kv_store, chaves *audit_index)
--
-- Em 25/11/2026 centenas de auditorias da Meta 1 sumiram da lista porque o
-- app regravava a lista a partir de uma cópia local quando a leitura falhava.
-- O app foi corrigido; esta trava protege também contra aparelhos que ainda
-- estejam com a versão antiga aberta.
--
-- Efeito: uma gravação não pode retirar mais de 1 auditoria da lista de uma
-- vez (a exclusão individual continua funcionando). As remoções em massa da
-- aba Ciclos ficam bloqueadas; para usá-las, desative a trava temporariamente:
--   alter table public.kv_store disable trigger trg_protege_audit_index;
--   alter table public.kv_store enable trigger trg_protege_audit_index;
--
-- Idempotente (pode rodar de novo). O conteúdo de cada auditoria fica nas
-- chaves 'audit_<id>' e não é apagado quando ela sai da lista.
-- ============================================================
create or replace function public.protege_audit_index()
returns trigger language plpgsql as $$
declare removidas int;
begin
  if old.key ~ 'audit_index$' then
    select count(*) into removidas from (
      select e->>'id' from jsonb_array_elements(old.value) as a(e)
      except
      select e->>'id' from jsonb_array_elements(new.value) as b(e)
    ) x;
    if removidas > 1 then
      raise exception 'Bloqueado: a gravação removeria % auditorias de %', removidas, old.key;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protege_audit_index on public.kv_store;
create trigger trg_protege_audit_index
  before update on public.kv_store
  for each row execute function public.protege_audit_index();
