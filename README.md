# Auditorias do Serviço de Qualidade Hospitalar

App web single-file (HTML/CSS/JS, sem build) para as auditorias do Serviço
de Qualidade do **Hospital Maternidade São Vicente de Paulo**, usado pelos
tablets em campo — hoje **14 módulos de auditoria** independentes num só app.

**Produção:** https://prisato.github.io/auditoria-carro-emergencia/
**Hospedagem:** GitHub Pages, deploy automático a cada push na `master`.

## Arquivos
- `Auditoria_Carro_de_Emergencia.html` — todo o app (interface, estilos, lógica). Nome histórico (começou só com carros de emergência); já cobre todos os módulos.
- `index.html` — só redireciona a raiz do GitHub Pages para o arquivo acima.
- `supabase_schema.sql` — schema e RLS do banco.

## Stack
- **Frontend:** HTML/CSS/JS puro. Chart.js (gráficos), jsPDF + jspdf-autotable (PDF).
- **Backend:** [Supabase](https://supabase.com) — Postgres (tabela `kv_store` chave/valor genérica + `profiles`), Auth (e-mail/senha, autocadastro liberado, sem confirmação por e-mail), Realtime (presença "Online agora"). Todos os usuários autenticados compartilham os mesmos dados (sem times/organizações).

## Módulos de auditoria
A pessoa escolhe o módulo na barra lateral (agrupada em **QUALIDADE** e
**SEGURANÇA DO PACIENTE**, seções recolhíveis) ou no seletor "Nova
Auditoria". Cada módulo tem checklist, setores, ciclo e dados
(`storagePrefix` no `kv_store`) completamente isolados dos demais.

### Qualidade

| Módulo (`storagePrefix`) | Setores | Checklist | Ciclo |
|---|---|---|---|
| Carro de Emergência (` `) | 30 fixos + Outro | 25 itens / 9 categorias | Cobertura (100% dos setores) |
| Carro de Medicação (`med_`) | 9 + Outro | 22 itens / 4 categorias | Cobertura |
| Engenharia Clínica (`eng_`) | 34 + Outro, auditado por **equipamento individual** (Setor→Equipamento→checklist) | 7 itens, com "Não se Aplica" | Cobertura |
| Processo Transfusional (`transf_`) | 19 fixos | 8 categorias (perguntas do protocolo) / 37 itens (subcritérios auditados individualmente) | Mensal, sem meta |
| Registro da SAEP (`saep_`) | 11 reais + Outro, **por fase** (campo "Fase" próprio, antes de "Setor") | 3 fases (Pré/Trans/Pós-operatório) × 7 etapas / 21 itens; finalizar exige as 3 fases completas, cada uma com seu setor | Cobertura |
| Unidade Oncológica Iguatu (`oncoIguatu_`) | 3 "setores" pseudônimos = as 3 auditorias em si (campo "Setor" vira "Auditoria") | Reaproveita, sem duplicar, os checklists originais de Carro de Emergência, Meta 1 (pulseiras) e Meta 1 (adesão) — troca conforme a auditoria escolhida | Cobertura (fecha ao completar as 3 auditorias) |
| Unidades Assistenciais (`unidadesAssist_`) | 25 setores reais, cada um com o **checklist do seu tipo de unidade** (15 checklists diferentes ao todo: Ambulatórios, Centro Cirúrgico, CCMI, CME, Enfermarias/Blocos/Oncologia, Alojamento Conjunto/Maternidade, Pronto Socorro, UCINCO, UTI Adulto, UTI Neonatal, UTI Pediátrica, Endoscopia, Hemodinâmica, SND, CDI) | 41 a 65 itens por checklist, 7 a 10 categorias cada, conforme o tipo de unidade | Cobertura |

### Segurança do Paciente

| Módulo (`storagePrefix`) | Setores | Checklist | Ciclo mensal |
|---|---|---|---|
| Meta 1 – pulseiras (`meta1_`) | 17 (`SETORES_ASSISTENCIAIS`) | Recepção (3 itens) x assistencial (4 itens, pulseira/quadro leito) conforme o setor | Meta por setor: UTI Neo 1/2, UTI Ped., UCINCO, UCINCA = 10; Bloco 1/2/4/5, Maternidade = 30; demais = 20 (total 340) |
| Meta 1 – adesão (`meta1adesao_`) | 7 | 1 item (3 identificadores) | PS Adulto = 10; UTI 1/2 = 25; demais = 20 (total 140) |
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
- **Checklist dependente do setor** (`sectorDependentItems`/`phases`): a escolha do setor (ou, na Unidade Oncológica Iguatu, da "Auditoria") troca as categorias/itens em uso, sem duplicar módulo. Usado por Meta 1 (Recepção × Assistencial), Unidade Oncológica Iguatu (3 auditorias) e Unidades Assistenciais (15 checklists, um por tipo de unidade).

### Ciclos de auditoria (dois modos, por módulo)
- **Cobertura** (padrão): ciclo cobre todos os setores previstos; fecha manualmente ao atingir 100%, abre o próximo automaticamente. Setores podem ser desativados/reativados sem perder histórico.
- **Mensal** (`cycleMode:'monthly'`): abre/fecha sozinho por mês corrido, sem exigir cobertura. Opcionalmente tem meta numérica: total simples (`monthlyTargetTotal`), por setor uniforme (`monthlyTargetPerSector`), por setor customizada (`monthlyTargetPerSectorMap`, com fallback pro valor uniforme) ou por grupo de setores via regex (`monthlyTargetGroups`, ex.: Meta 4). Banner e tela Ciclos mostram barra de progresso e placar por setor/grupo quando há meta.

### Dashboard, Histórico e Setores
- Indicadores, evolução de conformidade, ranking de itens mais não conformes.
- Gráfico "Conformidade média": por setor (padrão); por item (`dashboardByItem`, ex.: Meta 4); por categoria/tópico agrupando vários itens (`dashboardGroupBy:'category'`, ex.: Processo Transfusional — 8 tópicos em vez de 37 subcritérios).
- Histórico com filtros (setor, ciclo, status, período). Detalhe por setor com tendência.
- **Gerar Relatório** e PDF por auditoria: versão Resumo (só status) e Completo (observações + fotos; texto copiado só lista os itens **Não Conforme**).

### Perfil e presença
Login com perfil básico (nome, avatar de iniciais) e lista "Online agora" em tempo real (Supabase Realtime).

## Estrutura de dados (Supabase)
Duas tabelas:
- `kv_store` (`key text primary key`, `value jsonb`) — por módulo (chave prefixada por `storagePrefix`, ver tabelas acima): `audit_index`, `cycles`, `inactive_sectors`, `sector_carts`. Detalhes de auditoria (`audit_<id>`) **não** levam prefixo — o id já é globalmente único.
- `profiles` (`id` = `auth.users.id`, `name`).

RLS restringe leitura/escrita a usuários autenticados; ver `supabase_schema.sql`.

## Histórico de versões
Ver histórico de commits do git.
