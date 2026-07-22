# Auditorias do Serviço de Qualidade Hospitalar

Aplicativo web single-file (HTML/CSS/JS) para as auditorias do Serviço
de Qualidade do **Hospital Maternidade São Vicente de Paulo**. Permite à
equipe registrar, acompanhar e organizar em ciclos as conferências
periódicas de todos os setores do hospital, pelos tablets em campo —
hoje reunindo **5 módulos de auditoria** diferentes num único app.

**Link em produção:** https://prisato.github.io/auditoria-carro-emergencia/

## Arquivo principal
`Auditoria_Carro_de_Emergencia.html` — contém toda a interface, estilos e
lógica do app (não há build step; é servido como está). O nome do
arquivo é histórico (o projeto começou como só a auditoria dos carros
de emergência); o título e o conteúdo já cobrem todos os módulos.

`index.html` só existe para redirecionar a raiz do GitHub Pages para o
arquivo principal.

## Stack
- **Frontend:** HTML/CSS/JS puro, sem framework. Fonte Montserrat.
  Chart.js (gráficos), jsPDF + jspdf-autotable (exportação em PDF).
- **Backend:** [Supabase](https://supabase.com) — Postgres (tabela
  `kv_store` genérica chave/valor, mais a tabela `profiles`), Auth
  (login por e-mail/senha) e Realtime (presença "quem está online").
  Configuração (URL do projeto e chave pública) e todo o schema SQL
  ficam no próprio `Auditoria_Carro_de_Emergencia.html` e em
  `supabase_schema.sql`, respectivamente.
- **Hospedagem:** GitHub Pages, deploy automático a cada push na
  branch `master`.

## Contas e acesso
Login por e-mail/senha via Supabase Auth. Autocadastro está liberado
(qualquer pessoa com o link pode criar a própria conta) e a confirmação
por e-mail está desativada, para permitir cadastro instantâneo direto
no tablet. Todos os usuários autenticados compartilham os mesmos dados
(não há times/organizações separadas).

## Módulos de auditoria
Antes de iniciar qualquer auditoria (ou ao trocar de módulo pela barra
lateral), a pessoa escolhe qual das 5 auditorias vai preencher. Cada
módulo tem checklist, setores e dados próprios — completamente
independentes entre si, sem misturar histórico, ciclos ou indicadores.

| Módulo | Setores | Checklist |
|---|---|---|
| **Carro de Emergência** | 30 setores fixos + "Outro" | 25 itens em 9 categorias (Acesso/Limpeza, Lacre, Desfibrilador, Registros, Via Aérea, Oxigênio, Medicamentos, Reposição, Localização) |
| **Carro de Medicação** | 9 setores + "Outro" | 22 itens em 4 categorias (Segurança/Acesso, Identificação, Limpeza/Conservação, Descarte de Resíduos) |
| **Equipamentos da Engenharia Clínica** | 34 setores + "Outro" | 7 itens (Calibração, Manutenção Preventiva, Rede Elétrica, Funcionamento, Higiene, Armazenamento, Registro); auditado por **equipamento individual** (ver abaixo) |
| **Meta 2 (SBAR)** | mesmos 30 setores da Carro de Emergência + "Outro" | 2 itens — um para o **setor de origem** (Preenchimento adequado) e outro para o **setor de destino** (Validação com carimbo e assinatura, sem opção "Parcial") |
| **Meta 1** | 56 setores próprios (recepções + setores assistenciais) | Muda conforme o setor: **Recepções** (16 setores) têm 3 itens (só Conforme/Não Conforme); **demais setores** (40) têm 1 item (Conforme/Parcial/Não Conforme) |

### Checklist — regras gerais (valem para todos os módulos)
- Cada item aceita, por padrão, Conforme / Parcial / Não Conforme,
  observação e fotos; uma caixinha ao lado do texto fica verde assim
  que o item é respondido. Alguns itens restringem as opções (ex.: só
  Conforme/Não Conforme) ou, na Engenharia Clínica, ganham uma 4ª opção
  **"Não se Aplica"** (pintada em cinza-escuro), que é **excluída do
  numerador e do denominador** do cálculo de conformidade.
- Selecionar **Conforme** (ou "Não se Aplica") não abre o campo de
  observações/fotos — só aparece quando o item precisa de justificativa
  (Parcial ou Não Conforme).
- Campos obrigatórios para salvar (rascunho ou finalizado): data,
  setor, auditor e enfermeiro responsável (ou, na Meta 2, os dois
  enfermeiros — origem e destino).
- Opção **"Carro não disponível"** no cabeçalho: dispensa o checklist
  item a item e registra a auditoria como não conformidade total do
  setor.
- Auditorias já salvas (rascunho ou finalizada) podem ser **editadas**
  a partir do Histórico — útil principalmente para preencher itens do
  checklist que foram adicionados depois que a auditoria foi feita.

### Setores com múltiplos carros/equipamentos
Setores que têm mais de um "carro" usam o recurso **"Adicionar
carro"**: cada carro é rastreado separadamente para fins de conclusão
do ciclo, mas a conformidade exibida no Dashboard e em Setores é do
setor como um todo. Também é possível **remover** um carro/equipamento
do setor (o histórico das auditorias já feitas para ele é mantido, só
deixa de aparecer para novas auditorias).

Na **Engenharia Clínica** esse mecanismo vira o fluxo principal:
Setor → Equipamento → checklist. O checklist só abre depois que um
equipamento é escolhido. O catálogo inicial (337 equipamentos em 27 dos
34 setores, identificados por nome + nº de patrimônio/tag) foi
extraído dos planos de manutenção 2026 da engenharia clínica; novos
equipamentos podem ser cadastrados pela própria tela.

### Meta 2 (SBAR) — origem e destino
Cada auditoria avalia a passagem de caso entre dois setores: o
preenchimento no setor de origem e a validação no setor de destino
(campos, enfermeiros e itens separados). O Dashboard mostra os dois
indicadores de conformidade (Origem/Destino) separadamente, e o
gráfico "conformidade por setor" separa as médias por papel — um
mesmo setor pode ser origem em uma auditoria e destino em outra.

### Ciclos de auditoria
Agrupa as auditorias em ciclos que cobrem todos os setores previstos do
módulo atual. A tela **Ciclos** mostra o progresso do ciclo (setores
auditados vs. pendentes), permite concluir o ciclo (ao atingir 100%) e
mantém o histórico completo de ciclos anteriores, com duração e
conformidade média. Setores inativos (unidade fechada/reformada) podem
ser desativados/reativados sem perder o histórico de auditorias já
feitas para eles.

### Dashboard, Histórico e Setores
- Dashboard com indicadores, evolução de conformidade, ranking de itens
  mais não conformes e gráfico de conformidade por setor.
- Histórico com filtros por setor, ciclo, status e período.
- Detalhe por setor com tendência e não conformidades recorrentes.
- **Gerar Relatório** e o **PDF de cada auditoria** têm duas versões:
  **Resumo** (rápido, só os status) e **Completo** (inclui as
  observações digitadas e as fotos anexadas de cada item — as fotos só
  aparecem no PDF; no texto copiado entra a contagem de fotos com
  indicação de ver o PDF).

### Perfil e presença
Cada login tem um perfil básico (nome de exibição, editável), com
avatar de iniciais. A barra lateral mostra em tempo real quem mais da
equipe está com o app aberto ("Online agora"), via Supabase Realtime.

## Estrutura de dados (Supabase)
Tudo fica em duas tabelas simples:
- `kv_store` (`key text primary key`, `value jsonb`) — guarda, por
  chave: `audit_index` (índice resumido das auditorias), `audit_<id>`
  (detalhe completo de cada auditoria), `cycles` (ciclos),
  `inactive_sectors` (setores desativados) e `sector_carts` (carros/
  equipamentos cadastrados por setor). Essas chaves são as usadas pelo
  módulo **Carro de Emergência** (o original, sem prefixo); os demais
  módulos usam as mesmas chaves com um prefixo próprio —
  `med_` (Carro de Medicação), `eng_` (Engenharia Clínica), `meta2_`
  (Meta 2/SBAR) e `meta1_` (Meta 1) — mantendo os dados de cada módulo
  completamente isolados dentro da mesma tabela.
- `profiles` (`id` = `auth.users.id`, `name`) — nome de exibição de
  cada usuário.

RLS restringe leitura/escrita a usuários autenticados; ver
`supabase_schema.sql` para o schema completo e as políticas.

## Histórico de versões
Ver histórico de commits do git para acompanhar a evolução do app.
