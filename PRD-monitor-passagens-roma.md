# PRD — Monitor de Passagens Aéreas (multi-rota)

## 1. Objetivo

App que busca automaticamente, 2x por dia durante 170 dias, preços de passagens aéreas entre origem(ns) e destino(s) configuráveis pelo usuário via interface visual, varrendo janelas de 7 dias de viagem dentro de meses específicos do ano, e registra/alerta quando encontrar preços baixos.

## 2. Escopo

- **Origem e destino:** configuráveis via interface (não hardcoded). Default inicial: Fortaleza (FOR) → Roma (FCO/CIA)
- **Múltiplas rotas:** suporte a até N rotas ativas simultaneamente (default N=2; configurável, ver seção 8 sobre limite de chamadas)
- **Duração da viagem:** sempre 7 dias (ida + volta), janela deslizante dia a dia (ver seção 4.2)
- **Meses permitidos para busca:** março, abril, maio, setembro, outubro — exclui meses frios (jan, fev, nov, dez) e alta temporada (jun, jul, ago). Lista de meses permitidos deve ser configurável na interface, com esses 5 como default.
- **Frequência de busca:** 2x/dia (ex: 06h e 18h, horário de Fortaleza)
- **Duração do monitoramento:** 170 dias corridos a partir do deploy

## 3. Fonte de dados

**Amadeus for Developers — tier Self-Service (grátis)**
- Limite: ~2.000 chamadas/mês, 10 req/s
- Ambiente: `test.api.amadeus.com`

**Fluxo de busca (2 etapas):**
1. `GET /v1/shopping/flight-dates` (Cheapest Date Search) — varre um range de datas de ida dentro de um mês permitido e retorna os preços mais baratos por data.
2. Para as datas mais promissoras (top 3), confirmar preço real com `GET /v2/shopping/flight-offers` (Flight Offers Search), calculando data de volta = data de ida + 7 dias (janela deslizante — ver 4.2).

⚠️ Validar na implementação se `flight-dates` cobre rotas com conexão (ex: FOR→FCO); se não cobrir, pular direto para `flight-offers` fazendo loop de datas.

### 3.1 Estratégia de rotação de meses (para caber no limite grátis)

Com 5 meses permitidos × múltiplas rotas × 2 execuções/dia, varrer **todos** os meses em **toda** execução estoura o limite grátis rapidamente (estimativa: ~6.800 chamadas/mês com 2 rotas — muito acima do limite).

**Solução: dividir os meses permitidos entre as duas execuções diárias.**
- Execução da manhã: varre metade dos meses permitidos (ex: mar, abr, mai)
- Execução da noite: varre a outra metade (ex: set, out) + reconfirma o melhor achado do dia
- Ao longo de cada semana, todos os meses permitidos acabam cobertos várias vezes
- Regra de divisão deve ser configurável (ou automática, alternando os meses entre as execuções par/ímpar)

**Estimativa de uso revisada (2 rotas ativas, 2x/dia, 170 dias):**
- ~3 chamadas de Cheapest Date Search por execução por rota (metade dos meses)
- ~3 chamadas de confirmação (top achados) por execução por rota
- Total: ~12 chamadas/execução × 2x/dia × 30 dias ≈ **720 chamadas/mês**
- Dentro do limite grátis, com folga para 2-3 rotas simultâneas.

## 4. Funcionalidades (MVP)

### 4.1 Job agendado (cron)
- Roda 2x/dia
- Para cada rota ativa: executa busca conforme fluxo da seção 3, usando o subconjunto de meses da rotação daquela execução
- Salva resultados no banco (histórico de preços por rota, data de ida/volta)

### 4.2 Janela de 7 dias (deslizante)
- Dentro de cada mês permitido, testar toda combinação consecutiva:
  - 1→8, 2→9, 3→10, 4→11 ... até o fim do intervalo de meses permitidos
- Não pular dias: a janela avança 1 dia por vez, não de 7 em 7
- O Cheapest Date Search cobre o mês inteiro de uma vez (retorna preço por data de ida); a partir do resultado, calcular data de volta = data de ida + 7 e confirmar via Flight Offers Search apenas para as datas de ida mais baratas

### 4.3 Armazenamento
- Banco simples (SQLite ou Postgres) com tabela tipo:
  - `route_id`, `search_date`, `departure_date`, `return_date`, `price`, `currency`, `airline`, `stops`, `raw_response` (opcional)
- Manter histórico completo (não sobrescrever) para permitir análise de tendência de preço por rota

### 4.4 Alerta de preço baixo
- Definir um preço-alvo por rota (ex: threshold configurável em R$ ou EUR)
- Quando encontrar preço abaixo do threshold: destacar no dashboard (badge/cor de alerta na listagem e no gráfico)
- Canal de notificação: apenas destaque visual no dashboard (sem e-mail/WhatsApp no MVP)
- Opcional: alertar também sobre queda percentual em relação à média histórica da rota

### 4.5 Dashboard e interface de configuração
- **Gestão de rotas:** interface para adicionar/editar/remover rotas (origem, destino, ativa/inativa), respeitando o limite máximo de rotas simultâneas
- **Gestão de meses permitidos:** interface para marcar quais meses do ano entram na busca (default: mar, abr, mai, set, out)
- **Visualização de preços:** listar menores preços encontrados por rota e período
- **Gráfico de evolução de preço** ao longo do tempo, por rota e por janela de 7 dias
- **Filtro** por rota, mês, e janela de datas

## 5. Fora de escopo (MVP)

- Compra/checkout automático de passagem
- Múltiplas durações de viagem (só 7 dias por enquanto)
- Login multi-usuário (uso pessoal)
- Rotas ilimitadas (há teto configurável para não estourar limite grátis da Amadeus)

## 6. Stack definida

- **Backend:** Node.js + TypeScript (job de busca + client Amadeus), integrado ao projeto Next.js
- **Banco:** SQLite, versionado no próprio repositório (commitado a cada execução do job)
- **Scheduler:** GitHub Actions (workflow agendado 2x/dia via `schedule: cron`), sem servidor 24/7
- **Notificação:** nenhuma ativa — apenas destaque visual no dashboard (ver 4.4)
- **Frontend:** Next.js, lendo o SQLite versionado (build estático ou rota de API server-side lendo o arquivo do repo)
- **Deploy do dashboard:** Vercel (ou similar) fazendo redeploy a cada push do GitHub Actions, para refletir os dados mais recentes

## 7. Variáveis de configuração

**Fixas (ambiente/.env):**
- `AMADEUS_API_KEY`, `AMADEUS_API_SECRET`
- `RUN_SCHEDULE` (ex: "0 6,18 * * *")
- `MAX_ACTIVE_ROUTES` (teto de rotas simultâneas, default 2-3)

**Editáveis via interface (persistidas em banco):**
- Rotas ativas (par origem/destino cada, até `MAX_ACTIVE_ROUTES`)
- Meses permitidos (default: mar, abr, mai, set, out)
- `TRIP_DURATION_DAYS` (default 7, fixo no MVP mas já no banco para facilitar evolução futura)
- `PRICE_THRESHOLD` por rota (valor de alerta)
- `SEARCH_HORIZON_DAYS` (quantos dias à frente buscar, ex: 365)

## 8. Critérios de sucesso

- App roda sem intervenção manual por 170 dias
- Usuário consegue adicionar/trocar rota e meses permitidos pela interface sem mexer em código
- Nunca estoura o limite de 2.000 chamadas/mês da Amadeus (rotação de meses entre execuções garante isso)
- Histórico de preços fica consultável e não se perde
- Alerta dispara corretamente quando preço cai abaixo do threshold
