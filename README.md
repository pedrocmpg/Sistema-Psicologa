# Site de psicóloga + agendamento

Site institucional + sistema de agendamento (demo) para psicóloga clínica.

> **Trocar de cliente:** todos os dados pessoais (nome, CRP, telefone, endereço, horário, avaliação)
> ficam em `src/config/profissional.ts`. Edite só esse arquivo; o `index.html` também lê dele.

> ⚠️ **Isto é uma versão de demonstração.** O `index.html` tem `<meta name="robots" content="noindex, nofollow">`
> e o `public/robots.txt` bloqueia toda indexação. Remova os dois quando o site for publicado de verdade.

## Stack

- **Frontend:** Vite + React + TypeScript, deploy no Netlify.
- **Backend/dados:** Supabase (Postgres + Auth), plano gratuito.
- Sem gateway de pagamento nesta versão.

## Como funciona o agendamento

- A psicóloga cadastra horários livres no painel `/admin`.
- O paciente vê só os horários com status `disponivel` na página pública e envia um pedido
  (nome, telefone, e-mail — **sem** perguntas de saúde).
- O pedido entra como `pendente`. O horário some da lista pública imediatamente (fica `reservado`),
  mas só é liberado de vez (ou volta a ficar disponível) quando a psicóloga confirma ou recusa no painel.
- Toda a lógica de "reservar sem duplicar" roda dentro de uma função SQL (`solicitar_agendamento`,
  veja `supabase/migrations/0001_init.sql`) que trava a linha do horário antes de confirmar — evita
  que dois pacientes reservem o mesmo horário ao mesmo tempo.
- RLS (Row Level Security) garante que:
  - qualquer pessoa só lê horários `disponivel`;
  - ninguém lê a tabela de agendamentos (nome/telefone/e-mail dos pacientes) sem estar logado como a psicóloga;
  - só a psicóloga autenticada confirma, recusa ou gerencia a agenda.

## 1. Configurar um projeto Supabase gratuito (do zero)

1. Crie uma conta em [supabase.com](https://supabase.com) (pode entrar com GitHub).
2. Clique em **New project**. Escolha um nome (ex.: `daniele-psicologa`), uma senha para o banco
   (guarde-a) e a região mais próxima (ex.: South America).
3. Aguarde o projeto provisionar (1–2 minutos).
4. Vá em **SQL Editor** → **New query**, cole o conteúdo de cada arquivo de
   [`supabase/migrations/`](supabase/migrations/) **na ordem** (`0001` a `0004`) e clique em **Run**
   em cada um. Isso cria as tabelas, as políticas de RLS e as funções de agendamento.
   - Alternativa via CLI: `npx supabase link --project-ref SEU_PROJECT_REF` e depois
     `npx supabase db push`.
5. Crie o usuário administrador (a psicóloga):
   - Vá em **Authentication → Users → Add user**.
   - Preencha e-mail e senha, e marque **Auto Confirm User** (assim ela não precisa confirmar por e-mail).
   - Esse é o único login que acessa `/admin`.
   - Depois, em **Authentication → Sign In / Providers**, **desligue "Allow new users to sign up"**.
     As políticas de RLS tratam qualquer usuário logado como a psicóloga; com o cadastro aberto,
     qualquer pessoa poderia criar uma conta pela API e ler os agendamentos.
6. Pegue a URL e a chave pública do projeto em **Project Settings → API**:
   - `Project URL` → vai em `VITE_SUPABASE_URL`
   - `anon public` key → vai em `VITE_SUPABASE_ANON_KEY`

## 2. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os valores do passo anterior:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-CHAVE-ANON-PUBLICA
```

O `.env` nunca é commitado (está no `.gitignore`). Ele só tem as duas variáveis **públicas** do
site; os segredos do WhatsApp ficam nos secrets do Supabase (veja a seção 5).

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. O painel administrativo fica em `http://localhost:5173/admin`.

### Rodar contra um Supabase local (opcional, via Docker)

Se preferir testar sem depender de um projeto na nuvem, o repositório já tem a configuração do
Supabase CLI (`supabase/config.toml`) e as migrations em `supabase/migrations/`:

```bash
npx supabase start   # sobe Postgres + Auth + Studio local via Docker
```

Ao final, o comando imprime a `API URL` e a `anon key` locais — use-as no `.env`. Para criar o
usuário administrador localmente, use o Supabase Studio local (link impresso pelo `supabase start`,
normalmente `http://localhost:54323`) em **Authentication → Users**.

Para parar: `npx supabase stop`.

## 4. Deploy

### Backend (Supabase)

Já feito no passo 1 — o projeto na nuvem do Supabase **é** o backend de produção, não precisa de
outro deploy.

### Frontend (Netlify)

1. Suba este repositório para o GitHub.
2. No Netlify: **Add new site → Import an existing project** e conecte o repositório.
3. Build command: `npm run build` — Publish directory: `dist` (já configurado em `netlify.toml`,
   incluindo o redirect de SPA para as rotas do React Router funcionarem, ex. `/admin`).
4. Em **Site settings → Environment variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (os mesmos valores do seu `.env`, do projeto Supabase de produção).
5. Deploy.

## 5. Confirmação automática por WhatsApp

Quando o status de um agendamento muda (confirmado, recusado, cancelado), o paciente recebe uma
mensagem de WhatsApp. Tudo roda no servidor:

```
agendamentos (INSERT/UPDATE)
  └─ Database Webhook ──(header x-webhook-secret)──► Edge Function notify-whatsapp
                                                       ├─ grava em `notificacoes` ANTES de enviar
                                                       └─ provedor: mock | Evolution API | Z-API
painel /admin ──(login da psicóloga)──► Edge Function whatsapp-admin (conexão, teste, reenviar)
```

- **Falha no WhatsApp nunca quebra o agendamento.** O webhook dispara depois do commit, de forma
  assíncrona; a função nunca lança erro, só registra `falhou` na tabela.
- **Uma mensagem por evento.** `notificacoes` tem `unique (agendamento_id, evento)` e um unique
  parcial `(recorrencia_id, evento)`: webhook repetido ou concorrente não gera mensagem duplicada, e
  uma série semanal de 8 semanas gera **uma** mensagem ("toda terça-feira, às 14h, a partir de 14/10,
  por 8 semanas"). Cancelar a série inteira gera uma; cancelar só uma ocorrência gera "cancelado"
  com aquela data.
- **Não envia** (registra `ignorado`, com o motivo) quando o envio está desativado no painel, o
  checkbox "Enviar confirmação por WhatsApp" foi desmarcado, o telefone não é celular brasileiro
  válido (fixo/curto/sem o 9 → `telefone_invalido`; o sistema não adivinha o nono dígito), o número
  não tem WhatsApp (`sem_whatsapp`) ou o modelo tem termo clínico.
- **Limites anti-bloqueio:** no máximo 20 envios por hora (acima disso fica `pendente`, motivo
  `limite_horario`, e sai pelo botão "Reenviar"); atraso aleatório de 1 a 3 s antes de cada envio;
  uma retentativa automática após 60 s só em erro de rede/timeout.
- **Privacidade:** os modelos nunca podem ter termos clínicos (terapia, sessão, diagnóstico,
  psicóloga...) — a mensagem pode ser vista por outras pessoas no celular do paciente. O painel
  bloqueia ao salvar e a função recusa ao enviar. Os logs mostram só o telefone mascarado
  (`+55 54 9****-1234`) e nunca o texto da mensagem.
- **Só mensagens transacionais**, ligadas a uma ação da própria psicóloga. Não há lembrete em massa,
  promoção nem robô de resposta: a mensagem orienta o paciente a falar com o número principal.

> ⚠️ **Provedor não-oficial.** Evolution API e Z-API usam uma sessão do WhatsApp Web, não a API
> oficial da Meta. O WhatsApp pode bloquear o número. Por isso: use um **número dedicado** à
> automação (nunca o pessoal/principal) e mantenha o plano B "Enviar manualmente" do painel.

### 5.1 Publicar as Edge Functions

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy notify-whatsapp
npx supabase functions deploy whatsapp-admin
```

O `supabase/config.toml` já define `verify_jwt = false` para `notify-whatsapp` (ela é protegida pelo
`WEBHOOK_SECRET`) e `verify_jwt = true` para `whatsapp-admin` (exige o login da psicóloga).

### 5.2 Configurar os secrets

Todos documentados no [`.env.example`](.env.example). Eles ficam **só** no Supabase — nunca no `.env`
do site, no Netlify ou no repositório (o frontend só importa os módulos puros de texto/telefone; o
build não contém nenhuma dessas chaves).

| Secret | Para quê |
| --- | --- |
| `WHATSAPP_PROVIDER` | `mock` (padrão), `evolution` ou `zapi` |
| `WHATSAPP_DRY_RUN` | `true` = grava tudo sem chamar o provedor |
| `WEBHOOK_SECRET` | segredo do header `x-webhook-secret` (gere com `openssl rand -hex 32`) |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` | Evolution API |
| `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` | Z-API |

```bash
npx supabase secrets set WHATSAPP_PROVIDER=evolution WHATSAPP_DRY_RUN=true \
  WEBHOOK_SECRET=... EVOLUTION_API_URL=https://... EVOLUTION_API_KEY=... EVOLUTION_INSTANCE=consultorio
# ou: npx supabase secrets set --env-file ./arquivo-fora-do-git.env
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente nas funções.

### 5.3 Criar o Database Webhook

No painel do Supabase: **Database → Webhooks → Create a new hook** (se pedir, clique em
"Enable webhooks").

1. **Name:** `notify-whatsapp`
2. **Table:** `agendamentos` — **Events:** marque **Insert** e **Update**.
3. **Type of webhook:** *Supabase Edge Functions* → função `notify-whatsapp`, método `POST`,
   timeout `5000` ms.
4. **HTTP Headers:** adicione `x-webhook-secret` com o **mesmo valor** do secret `WEBHOOK_SECRET`.
5. Salve.

Sem esse header (ou com valor errado) a função responde 401 e não faz nada. Se `WEBHOOK_SECRET` não
estiver configurado, ela recusa todas as chamadas.

<details>
<summary>Alternativa por SQL (o mesmo que o painel cria)</summary>

```sql
create extension if not exists pg_net;
create trigger notify_whatsapp
  after insert or update on public.agendamentos
  for each row execute function supabase_functions.http_request(
    'https://SEU-PROJETO.supabase.co/functions/v1/notify-whatsapp',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"SEU_WEBHOOK_SECRET"}',
    '{}',
    '5000'
  );
```

Não coloque isso numa migration: o segredo iria para o repositório.
</details>

### 5.4 Evolution API (self-hosted, recomendado)

Exemplo pronto em [`docs/evolution-api/`](docs/evolution-api/): Evolution API v2 + Postgres, sem
guardar conversas. Precisa de um servidor com HTTPS acessível pela internet.

```bash
cd docs/evolution-api
cp .env.example .env      # SERVER_URL, AUTHENTICATION_API_KEY, POSTGRES_PASSWORD
docker compose up -d
```

Criar a instância e conectar o número **dedicado** por QR code:

```bash
curl -X POST "$SERVER_URL/instance/create" -H "apikey: $AUTHENTICATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"consultorio","integration":"WHATSAPP-BAILEYS","qrcode":true}'
```

Abra o gerenciador em `$SERVER_URL/manager` (login com a `AUTHENTICATION_API_KEY`), entre na
instância `consultorio` e escaneie o QR code com o celular do número dedicado (WhatsApp →
Aparelhos conectados → Conectar um aparelho). Depois configure os secrets
`EVOLUTION_API_URL=$SERVER_URL`, `EVOLUTION_API_KEY=$AUTHENTICATION_API_KEY` e
`EVOLUTION_INSTANCE=consultorio`.

### 5.5 Z-API (alternativa paga, sem servidor)

1. Crie uma conta em [z-api.io](https://z-api.io) e uma instância.
2. No painel da Z-API, escaneie o QR code com o número **dedicado**.
3. Copie **Instance ID** e **Token** da instância e o **Client-Token** (aba Segurança da conta).
4. Secrets: `WHATSAPP_PROVIDER=zapi`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`.

### 5.6 Mock, dry-run e produção

| Modo | Secrets | O que acontece |
| --- | --- | --- |
| Desenvolvimento | `WHATSAPP_PROVIDER=mock` (ou nada) | registra no log, nada sai |
| Ensaio em produção | provedor real + `WHATSAPP_DRY_RUN=true` | grava tudo em `notificacoes` (motivo `dry_run`) sem chamar o provedor |
| Produção | provedor real + `WHATSAPP_DRY_RUN=false` | envia de verdade |

Depois de configurar: no painel, **Configurações › WhatsApp** → preencha nome, telefone de contato
(seu número principal) e endereço → ative → **Enviar mensagem de teste** (vai para o seu telefone
de contato). O indicador de conexão mostra o estado do provedor.

Rodar local: `npx supabase start`, depois
`npx supabase functions serve --env-file supabase/functions/.env` (com `WHATSAPP_PROVIDER=mock`) e
crie o trigger da seção 5.3 apontando para
`http://supabase_kong_<project_id>:8000/functions/v1/notify-whatsapp`.

### 5.7 Número bloqueado ou sessão caída

O painel mostra um **banner vermelho** quando o envio está ativo e a sessão do provedor caiu.

1. **Enquanto isso, nada para:** os agendamentos funcionam normalmente. Em cada card, use
   **"Enviar manualmente"**: abre o seu WhatsApp (`wa.me`) com a mensagem pronta para o paciente.
2. **Sessão caiu** (celular desconectado, logout): reconecte o número dedicado por QR code
   (Evolution: `/manager`; Z-API: painel da instância). Volte em **Configurações › WhatsApp →
   Verificar conexão**.
3. **Número bloqueado pelo WhatsApp:** coloque outro chip **dedicado** e conecte por QR code na mesma
   instância (ou crie outra e atualize `EVOLUTION_INSTANCE`). O número principal da psicóloga não é
   afetado, porque nunca foi usado na automação.
4. Mensagens que ficaram `falhou` ou `pendente` podem ser reenviadas pelo botão **"Reenviar"** do
   card.

### 5.8 Testes

```bash
npm test
```

Unitários (telefone, modelos, datas em America/Sao_Paulo, adapters com `fetch` falso) e integração
com o provider `mock` e um repositório em memória que impõe os mesmos uniques do banco (série de 8
semanas com webhooks concorrentes, idempotência, falhas do provedor, segredo do webhook). Só dados
fictícios ("Paciente Teste", `+55 54 90000-0001`); nenhuma mensagem real é enviada.

## Estrutura do banco

- `horarios_disponiveis` — horários cadastrados pela psicóloga. `status`: `disponivel` | `reservado` | `confirmado`.
- `agendamentos` — pedidos dos pacientes. `status`: `pendente` | `confirmado` | `recusado` | `cancelado`.
  `notificar_whatsapp` (padrão `true`) e `cancelado_em_serie` controlam a mensagem automática.
- `notificacoes` — uma linha por mensagem de WhatsApp (enviada, falhou, ignorada ou pendente), nunca
  com o texto da mensagem.
- `configuracoes_whatsapp` — linha única: liga/desliga, nome, telefone de contato, endereço e
  modelos editados.
- Funções RPC (`solicitar_agendamento`, `confirmar_agendamento`, `recusar_agendamento`) concentram
  as transições de estado para manter a consistência entre as duas tabelas.

Veja o SQL comentado em [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## Próximos passos (fora do escopo desta versão)

- Notificação por e-mail; aviso para a psicóloga quando chega um pedido novo.
- Gateway de pagamento.
- Reagendamento/cancelamento pelo próprio paciente.
