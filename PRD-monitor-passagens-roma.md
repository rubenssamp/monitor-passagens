# PRD — Monitor de Passagens Aéreas (multi-rota)

> **Atualização (ago/2026):** a Amadeus descontinuou o tier Self-Service em 17/jul/2026 (só
> restou o portal Enterprise, pago/via vendas). O projeto foi migrado para a
> **Travelpayouts/Aviasales Data API** (grátis, sem mínimo de usuários) — ver seção 3 atualizada
> mais abaixo. Como essa API não tem um limite de chamadas apertado como a Amadeus tinha, a
> estratégia de rotação de meses entre execuções (antiga seção 3.1) foi removida: cada execução
> busca todos os meses permitidos, para todas as rotas ativas. Também não existe mais etapa
> separada de "confirmar preço" — a API já devolve preço, cia e paradas numa chamada só.

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

**Travelpayouts/Aviasales Data API (grátis, sem mínimo de usuários)**
- Endpoint: `GET /aviasales/v3/prices_for_dates`
- Limite: 300 requisições/minuto — bem acima do necessário, sem rotação de cota
- Dados vêm de cache de buscas reais de usuários do Aviasales (até 48h), não de cotação ao vivo — adequado para detectar tendência/queda de preço, mas rotas menos populares podem ter menos dados em cache

**Fluxo de busca (1 chamada por mês/rota):**
- Para cada mês permitido: `origin`, `destination`, `departure_at=YYYY-MM`, `one_way=false` — retorna as passagens mais baratas já encontradas por usuários naquele mês, com preço, cia, paradas e datas de ida/volta na mesma resposta (sem etapa de confirmação separada)
- Como a API não garante duração exata da viagem, filtra-se o resultado pelos que têm duração de ida+volta próxima de `trip_duration_days` (tolerância de 1 dia)
- Top 3 resultados mais baratos (dentro da tolerância) são gravados no histórico

**Uso (2 rotas ativas, 5 meses permitidos, 2x/dia):** ~10 chamadas/execução × 2x/dia × 30 dias ≈ 600 chamadas/mês — bem dentro do limite de 300/min.

## 4. Funcionalidades (MVP)

### 4.1 Job agendado (cron)
- Roda 2x/dia
- Para cada rota ativa: executa busca conforme fluxo da seção 3, cobrindo todos os meses permitidos em toda execução
- Salva resultados no banco (histórico de preços por rota, data de ida/volta)

### 4.2 Janela de 7 dias
- A API já devolve, por mês, as combinações de ida/volta mais baratas encontradas em cache
- Filtra-se para as combinações com duração de viagem próxima de `trip_duration_days` (tolerância de 1 dia), em vez de testar cada janela deslizante manualmente

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
- Rotas ilimitadas (há teto configurável, `max_active_routes`)

## 6. Stack definida

- **Backend:** Node.js + TypeScript (job de busca + client Travelpayouts), integrado ao projeto Next.js
- **Banco:** SQLite, versionado no próprio repositório (commitado a cada execução do job)
- **Scheduler:** GitHub Actions (workflow agendado 2x/dia via `schedule: cron`), sem servidor 24/7
- **Notificação:** nenhuma ativa — apenas destaque visual no dashboard (ver 4.4)
- **Frontend:** Next.js exportado como site estático (`output: "export"`), lendo o SQLite e o `config.json` do repo em build time
- **Deploy do dashboard:** GitHub Pages, republicado automaticamente a cada push (workflow separado, `.github/workflows/pages.yml`) — sem conta em nenhum serviço externo

## 7. Variáveis de configuração

**Fixas (ambiente/.env, apenas o job do GitHub Actions usa):**
- `TRAVELPAYOUTS_TOKEN`

**Editáveis em `data/config.json` (local ou pela interface web do GitHub, commitado no repo):**
- Rotas ativas (par origem/destino cada, até `max_active_routes`)
- Meses permitidos (default: mar, abr, mai, set, out)
- `trip_duration_days` (default 7)
- `price_threshold` por rota (valor de alerta)
- `search_horizon_days` (quantos dias à frente buscar, ex: 365)

O dashboard publicado no GitHub Pages é somente-leitura (site estático); a edição da config é feita diretamente no arquivo, não por um formulário no site.

## 8. Critérios de sucesso

- App roda sem intervenção manual por 170 dias
- Usuário consegue adicionar/trocar rota e meses permitidos editando `data/config.json` (local ou pela interface do GitHub) sem mexer no código do app
- Histórico de preços fica consultável e não se perde
- Alerta dispara corretamente quando preço cai abaixo do threshold
