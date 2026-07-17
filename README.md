# Auditoria de Carros de Emergência

Aplicativo web single-file (HTML/CSS/JS) para auditoria dos carros de
emergência do **Hospital Maternidade São Vicente de Paulo**. Permite à
equipe registrar, acompanhar e organizar em ciclos as conferências
periódicas de todos os setores do hospital, pelos tablets em campo.

**Link em produção:** https://prisato.github.io/auditoria-carro-emergencia/

## Arquivo principal
`Auditoria_Carro_de_Emergencia.html` — contém toda a interface, estilos e
lógica do app (não há build step; é servido como está).

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

## Funcionalidades

### Auditoria
- Checklist de 25 itens, organizados em 9 categorias (Acesso/Limpeza,
  Lacre, Desfibrilador, Registros, Via Aérea, Oxigênio, Medicamentos,
  Reposição, Localização).
- Cada item aceita Conforme / Parcial / Não Conforme, observação e
  fotos; uma caixinha ao lado do texto fica verde assim que o item é
  respondido (substituiu a numeração).
- Campos obrigatórios para salvar (rascunho ou finalizado): data,
  setor, carro (quando o setor tiver mais de um), auditor e enfermeiro
  responsável.
- Opção **"Carro não disponível"** no cabeçalho: dispensa o checklist
  item a item e registra a auditoria como não conformidade total do
  setor.
- Item de medicamentos/validade tem um seletor de **perfil do carro**
  (Adulto / Misto / Infantil) que abre a lista completa de
  medicamentos e insumos daquele perfil (extraída das planilhas da
  farmácia), para conferir a validade item a item (válido / próximo do
  vencimento / vencido).
- Auditorias já salvas (rascunho ou finalizada) podem ser **editadas**
  a partir do Histórico — útil principalmente para preencher itens do
  checklist que foram adicionados depois que a auditoria foi feita.

### Setores com múltiplos carros
Setores que têm mais de um carro de emergência (hoje, as UTIs) usam o
recurso **"Adicionar carro"**: cada carro é rastreado separadamente
para fins de conclusão do ciclo, mas a conformidade exibida no
Dashboard e em Setores é sempre do setor como um todo (soma de todos os
seus carros).

### Ciclos de auditoria
Agrupa as auditorias em ciclos que cobrem todos os setores previstos do
hospital. A tela **Ciclos** mostra o progresso do ciclo atual (setores
auditados vs. pendentes), permite concluir o ciclo (ao atingir 100%) e
mantém o histórico completo de ciclos anteriores, com duração e
conformidade média. Setores inativos (unidade fechada/reformada) podem
ser desativados/reativados sem perder o histórico de auditorias já
feitas para eles.

### Dashboard, Histórico e Setores
- Dashboard geral com indicadores, evolução de conformidade, ranking de
  itens mais não conformes e gráfico de conformidade por setor.
- Histórico com filtros por setor, ciclo, status e período.
- Detalhe por setor com tendência e não conformidades recorrentes.
- **Gerar Relatório**: baixa em PDF ou copia um resumo em texto para a
  área de transferência (com modal de fallback caso o navegador bloqueie
  a cópia automática).

### Perfil e presença
Cada login tem um perfil básico (nome de exibição, editável), com
avatar de iniciais. A barra lateral mostra em tempo real quem mais da
equipe está com o app aberto ("Online agora"), via Supabase Realtime.

## Estrutura de dados (Supabase)
Tudo fica em duas tabelas simples:
- `kv_store` (`key text primary key`, `value jsonb`) — guarda, por
  chave: `audit_index` (índice resumido de todas as auditorias),
  `audit_<id>` (detalhe completo de cada auditoria), `cycles` (ciclos),
  `inactive_sectors` (setores desativados) e `sector_carts` (carros
  cadastrados por setor).
- `profiles` (`id` = `auth.users.id`, `name`) — nome de exibição de
  cada usuário.

RLS restringe leitura/escrita a usuários autenticados; ver
`supabase_schema.sql` para o schema completo e as políticas.

## Histórico de versões
Ver histórico de commits do git para acompanhar a evolução do app.
