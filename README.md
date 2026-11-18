# Auditorias do Serviço de Qualidade Hospitalar

App web single-file (HTML/CSS/JS, sem build) para as auditorias do Serviço
de Qualidade do **Hospital Maternidade São Vicente de Paulo**, usado pelos
tablets em campo — hoje **15 módulos de auditoria** independentes num só app.

**Produção:** https://prisato.github.io/auditoria-carro-emergencia/
**Hospedagem:** GitHub Pages, deploy automático a cada push na `master`.

## Arquivos
- `Auditoria_Carro_de_Emergencia.html` — todo o app (interface, estilos, lógica). Nome histórico (começou só com carros de emergência); já cobre todos os módulos.
- `index.html` — só redireciona a raiz do GitHub Pages para o arquivo acima.
- `supabase_schema.sql` — schema e RLS originais do banco.
- `supabase_rbac_schema.sql` — controle de acesso por papéis (tabela `user_roles`, RLS por papel). Substitui as policies abertas do `kv_store`.
- `supabase/functions/admin-users/index.ts` — Edge Function que cria usuários e define papéis (usa a service_role key no servidor).

## Stack
- **Frontend:** HTML/CSS/JS puro. Chart.js (gráficos), jsPDF + jspdf-autotable (PDF).
- **Backend:** [Supabase](https://supabase.com) — Postgres (tabela `kv_store` chave/valor genérica + `profiles` + `user_roles`), Auth (e-mail/senha, **sem autocadastro**: só o administrador cria usuários), Edge Function `admin-users`, Realtime (presença "Online agora"). Todos os usuários autenticados compartilham os mesmos dados (sem times/organizações).

## Módulos de auditoria
A pessoa escolhe o módulo na barra lateral (agrupada em **QUALIDADE** e
**SEGURANÇA DO PACIENTE**, seções recolhíveis) ou no seletor "Nova
Auditoria". Cada módulo tem checklist, setores, ciclo e dados
(`storagePrefix` no `kv_store`) completamente isolados dos demais.

### Qualidade

| Módulo (`storagePrefix`) | Setores | Checklist | Ciclo |
|---|---|---|---|
| Carro de Emergência (` `) | 31 fixos + Outro | 23 itens / 8 categorias, todos com "Não se Aplica"; item de medicamentos tem conferência de validade item a item por perfil de carro (Adulto/Misto/Infantil/Neonatal) | Cobertura (100% dos setores) |
| Carro de Medicação (`med_`) | 9 + Outro | 14 itens / 4 categorias | Cobertura |
| Engenharia Clínica (`eng_`) | 34 + Outro, auditado por **equipamento individual** (Setor→Equipamento→checklist) | 2 itens (prazo de calibração e de manutenção preventiva), com "Não se Aplica" | Cobertura |
| Equipamento Hospitalar (`equipHosp_`) | Mesmos setores e equipamentos da Engenharia Clínica, com dados e ciclos próprios | 5 itens de conferência do equipamento (rede elétrica, funcionamento, higiene, armazenamento e controle registrado), com "Não se Aplica" | Cobertura |
| Processo Transfusional (`transf_`) | 19 fixos | 8 categorias (perguntas do protocolo) / 32 itens (subcritérios auditados individualmente) | Mensal, sem meta |
| Registro da SAEP (`saep_`) | 11 reais + Outro, **por fase** (campo "Fase" próprio, antes de "Setor") | 3 fases (Pré/Trans/Pós-operatório) × 7 etapas / 21 itens; finalizar exige as 3 fases completas, cada uma com seu setor | Cobertura |
| Unidade Oncológica Iguatu (`oncoIguatu_`) | 3 "setores" pseudônimos = as 3 auditorias em si (campo "Setor" vira "Auditoria") | Reaproveita, sem duplicar, os checklists originais de Carro de Emergência, Meta 1 (pulseiras) e Meta 1 (adesão) — troca conforme a auditoria escolhida | Cobertura (fecha ao completar as 3 auditorias) |
| Unidades Assistenciais (`unidadesAssist_`) | 40 setores reais, cada um com o **checklist do seu tipo de unidade** (22 checklists ao todo: Ambulatórios, Centro Cirúrgico, CCMI, CME, Enfermarias/Blocos/Oncologia, Alojamento Conjunto/Maternidade, Pronto Socorro, UCINCO, UTI Adulto, UTI Neonatal, UTI Pediátrica, Endoscopia, Hemodinâmica, SND, CDI, Agência Transfusional, Laboratório Clínico, OPME, Quimioterapia, Radioterapia, Recepção de PS — compartilhado por PS Adulto e PS Infantil —, e Farmácia — compartilhado pelos 8 setores de farmácia central/satélite/CAF) | 37 a 87 itens por checklist (6 a 12 categorias, conforme o tipo de unidade), sempre com os mesmos 22 itens padrão de **Higiene** (10) e **Manutenção** (12) no início — apurados como indicador próprio, separado do resultado do setor (ver Subindicadores, abaixo) | Cobertura |

### Segurança do Paciente

| Módulo (`storagePrefix`) | Setores | Checklist | Ciclo mensal |
|---|---|---|---|
| Meta 1 – pulseiras (`meta1_`) | 17 (`SETORES_ASSISTENCIAIS`) | Recepção (3 itens) x assistencial (4 itens, pulseira/quadro leito) conforme o setor | Meta por setor: UTI Neo 1/2, UTI Ped., UCINCO, UCINCA = 10; Bloco 1/2/4/5, Maternidade = 30; demais = 20 (total 340) |
| Meta 1 – adesão (`meta1adesao_`) | 7 | 1 item (3 identificadores) | 20/setor (total 140) |
| Meta 2 – SBAR (`meta2_`) | 30 + Outro | 2 itens: origem (Preenchimento) e destino (Validação, sem "Parcial") | Sem meta fixa |
| Meta 2 – censo (`meta2censo_`) | 17 (`SETORES_ASSISTENCIAIS`) | 1 item (preenchimento do censo) | 20/setor (total 340) |
| Meta 4 – Time Out (`meta4_`) | 10 salas (1CC-8CC, 1CCMI, 2CCMI) | 17 itens / 2 categorias; 3 itens com "Não se Aplica" (demarcação sítio, profilaxia, reserva hemocomponentes) | Por grupo: salas "CC" = 30, "CCMI" = 10 (total 40) |
| Meta 6 – QUEDAS (`meta6_`) | 7 | 2 itens | 20/setor (total 140) |
| Meta 6 – LP (`meta6lp_`) | 3 (UTIs) | 6 itens; 1 com "Não se Aplica" (calcâneos flutuantes) | 20/setor (total 60) |

### Regras gerais do checklist
- Status padrão: Conforme / Parcial / Não Conforme + observação/fotos. Itens podem restringir opções (`statusOptions`, ex.: só Conforme/Não Conforme) ou ganhar **"Não se Aplica"**, sempre **excluída do numerador e denominador** da conformidade e dos gráficos por item.
- Observação/fotos só abrem quando o status precisa de justificativa (não abre em Conforme/Não se Aplica).
- Campos obrigatórios: data, setor, auditor, enfermeiro (ou os dois em SBAR/origem-destino).
- Checkbox **"[módulo] não disponível no setor"** — só nos módulos que auditam um carro/equipamento físico (Emergência, Medicação, Engenharia); zera o checklist item a item como não conformidade total.
- Setores que começam com "Recepção" trocam o rótulo do campo "Enfermeiro Responsável" para "Recepcionista".
- Auditorias salvas (rascunho ou finalizada) podem ser reabertas e editadas pelo Histórico.
- **Checklist dependente do setor** (`sectorDependentItems`/`phases`): a escolha do setor (ou, na Unidade Oncológica Iguatu, da "Auditoria") troca as categorias/itens em uso, sem duplicar módulo. Usado por Meta 1 (Recepção × Assistencial), Unidade Oncológica Iguatu (3 auditorias) e Unidades Assistenciais (22 checklists, um por tipo de unidade).
- **Subindicadores** (`SUBINDICATOR_CATS`, hoje `higiene`/`manutencao`): itens dessas categorias são auditados junto com o setor, mas apurados à parte — não entram na contagem, no percentual nem no resultado geral do setor; ganham seu próprio indicador (score/contagem), vinculado ao mesmo setor e visível no detalhe da auditoria e no detalhe do setor. Hoje só existem em Unidades Assistenciais.

### Equipamento emprestado (só Equipamento Hospitalar)
Ao marcar "Equipamento Hospitalar não disponível no setor", pede o motivo: **não rastreado** ou **emprestado**; se emprestado, o setor para onde foi. O equipamento passa a aparecer na lista do setor de destino, marcado "EMPRESTADO de X" (e na origem como "EMPRESTADO p/ Y"), e a auditoria feita lá fica identificada como emprestado. Não há tabela de empréstimos: o estado é derivado da auditoria mais recente do equipamento no setor de origem (uma auditoria normal depois, na origem, encerra o empréstimo). A auditoria "emprestado" na origem conta para a cobertura do ciclo (como as demais "não disponível": não conformidade total); a feita no destino não entra na cobertura do ciclo do destino.

### Ciclos de auditoria (dois modos, por módulo)
- **Cobertura** (padrão): ciclo cobre todos os setores previstos; fecha manualmente ao atingir 100%, abre o próximo automaticamente. Setores podem ser desativados/reativados sem perder histórico.
- **Mensal** (`cycleMode:'monthly'`): abre um ciclo novo a cada mês corrido (`ensureCurrentCycle` reaproveita um ciclo já existente do mesmo mês, se houver, em vez de duplicar). A virada do mês só particiona os dados — **não** significa mais "ciclo bem-sucedido"; isso é `cycleProgress().metaAtingida` (true quando todos os setores/grupos do ciclo atingiram o mínimo estabelecido), usado no banner, no card do ciclo atual e no histórico de ciclos encerrados ("meta atingida" vs. "incompleto"). Um botão **"Finalizar Ciclo Agora"** encerra o ciclo manualmente a qualquer momento, independente do mês ou da meta, e abre o próximo em seguida. Uma auditoria é atribuída ao ciclo certo pelo **instante real em que foi salva** (`updatedAt`/`createdAt`), não pela data preenchida no formulário — isso evita que auditorias do mesmo dia de um "Finalizar Ciclo Agora" se espalhem para o ciclo errado. Meta numérica opcional: total simples (`monthlyTargetTotal`), por setor uniforme (`monthlyTargetPerSector`), por setor customizada (`monthlyTargetPerSectorMap`, com fallback pro valor uniforme) ou por grupo de setores via regex (`monthlyTargetGroups`, ex.: Meta 4). Banner e tela Ciclos mostram barra de progresso e placar por setor/grupo quando há meta.

### Ferramentas de integridade de dados (tela Ciclos)
Todos os dados do app ficam numa única tabela `kv_store` (uma chave por módulo/recurso, ver "Estrutura de dados" abaixo), sem transação entre sessões — uma leitura desatualizada podia, antes de uma correção aplicada em 2026-09, gravar de volta auditorias já excluídas ou vazar auditorias de um módulo para o índice de outro. A causa já foi corrigida (o servidor passou a ser a única fonte de verdade quando a leitura funciona, sem "curar" com a cópia local), mas os dados que já tinham sido contaminados antes disso continuam no banco. Três ferramentas, todas na tela **Ciclos**, ajudam a limpá-los — todas pedem confirmação explícita e mostram o que será afetado antes de remover:
- **Remover ciclos vazios (todos os módulos)** — varre o índice de ciclos de todos os módulos (direto pela chave de armazenamento de cada um, sem precisar trocar de módulo na interface) e remove ciclos já fechados sem nenhuma auditoria no seu período. Nunca mexe no ciclo atualmente aberto.
- **Verificar auditorias duplicadas entre módulos** — encontra ids de auditoria presentes no índice de mais de um módulo; usa o conjunto exato de ids de itens do registro de detalhe pra decidir qual módulo é o dono de verdade. Remove só da lista do(s) módulo(s) errado(s) — nunca o registro de detalhe, que continua pertencendo ao módulo certo.
- **Auditorias fora da lista de setores** (card por módulo) — sinaliza auditorias cujo setor não está na lista atual daquele módulo (outro sintoma do mesmo vazamento); mostra a contagem por setor antes de remover.

### Dashboard, Histórico e Setores
- Indicadores, evolução de conformidade, ranking de itens mais não conformes.
- Gráfico "Conformidade média": por setor (padrão); por item (`dashboardByItem`, ex.: Meta 4); por categoria/tópico agrupando vários itens (`dashboardGroupBy:'category'`, ex.: Processo Transfusional — 8 tópicos em vez de 32 subcritérios).
- Histórico com filtros (setor, ciclo, status, período). Detalhe por setor com tendência.
- **Gerar Relatório** e PDF por auditoria: versão Resumo (só status) e Completo (observações + fotos; texto copiado só lista os itens **Não Conforme**).

### Perfil e presença
Login com perfil básico (nome, avatar de iniciais) e lista "Online agora" em tempo real (Supabase Realtime).

### Controle de acesso (RBAC)
| Papel | Acesso |
|---|---|
| **Administrador** (`admin`) | Tudo: todos os módulos, ferramentas de integridade e a aba **Usuários** (criar usuário, trocar papel, redefinir senha, ativar/desativar). |
| **Coordenação** (`coordenacao`) | Somente o módulo **Equipamento Hospitalar** (dentro dele, usa tudo: auditar, histórico, setores, ciclos, dashboard e relatórios). |
| Sem papel / desativado | Entra, mas vê só a tela "Sem acesso". |

- Não existe mais "Criar conta" na tela de login. Contas são criadas pelo administrador (Edge Function `admin-users`, slug real no Supabase: ver `ADMIN_USERS_FN` no HTML).
- Senha criada/redefinida pelo admin é **provisória**: no próximo login o usuário é obrigado a cadastrar a própria (flag `must_change_password` no `user_metadata`).
- O app "Núcleos e Comissões" (`nucleos-comissoes.html`) também não tem mais "Criar conta"; a leitura das tabelas `ncom_*` exige perfil de administrador (seção 5c do `supabase_rbac_schema.sql`).
- Aba Usuários também permite **editar nome** e **excluir** usuário que nunca entrou no sistema (quem já acessou só pode ser inativado, para preservar o histórico).
- A barreira real é a **RLS** (`supabase_rbac_schema.sql`): `admin` acessa todo o `kv_store`; `coordenacao` só as chaves que começam com `equipHosp_`. A interface apenas esconde o que o papel não pode usar.
- Setup (uma vez): (1) rodar `supabase_rbac_schema.sql` no SQL Editor (todos os usuários existentes viram admin; `prikams@yahoo.com.br` garantido como admin); (2) publicar a Edge Function `admin-users`; (3) em Authentication > Sign In / Providers, desligar **Allow new users to sign up**.

## Estrutura de dados (Supabase)
Tabelas:
- `kv_store` (`key text primary key`, `value jsonb`) — por módulo (chave prefixada por `storagePrefix`, ver tabelas acima): `audit_index`, `cycles`, `inactive_sectors`, `sector_carts`. Detalhes de auditoria (`audit_<id>`) não levam prefixo nos módulos antigos — o id já é globalmente único. **Exceção:** o Equipamento Hospitalar guarda em `equipHosp_audit_<id>` (`detailKeyPrefix`), para a RLS liberar só essas chaves à Coordenação.
- `profiles` (`id` = `auth.users.id`, `name`).
- `user_roles` (`user_id`, `email`, `role` = `admin` | `coordenacao`, `active`) — papéis; só a Edge Function grava.

RLS: ver `supabase_schema.sql` (profiles) e `supabase_rbac_schema.sql` (kv_store e user_roles por papel).

## Histórico de versões
Ver histórico de commits do git.
