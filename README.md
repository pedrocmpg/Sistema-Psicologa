# Site — Psicóloga Daniele Walczak

Site institucional + sistema de agendamento (demo) para a psicóloga clínica Daniele Walczak
(CRP 07/36785), em Bento Gonçalves, RS.

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
4. Vá em **SQL Editor** → **New query**, cole todo o conteúdo de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e clique em **Run**.
   Isso cria as tabelas, as políticas de RLS e as funções de agendamento.
   - Alternativa via CLI: `npx supabase link --project-ref SEU_PROJECT_REF` e depois
     `npx supabase db push`.
5. Crie o usuário administrador (a psicóloga):
   - Vá em **Authentication → Users → Add user**.
   - Preencha e-mail e senha, e marque **Auto Confirm User** (assim ela não precisa confirmar por e-mail).
   - Esse é o único login que acessa `/admin`.
6. Pegue a URL e a chave pública do projeto em **Project Settings → API**:
   - `Project URL` → vai em `VITE_SUPABASE_URL`
   - `anon public` key → vai em `VITE_SUPABASE_ANON_KEY`

## 2. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os valores do passo anterior:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-CHAVE-ANON-PUBLICA
```

O `.env` nunca é commitado (está no `.gitignore`).

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

## Estrutura do banco

- `horarios_disponiveis` — horários cadastrados pela psicóloga. `status`: `disponivel` | `reservado` | `confirmado`.
- `agendamentos` — pedidos dos pacientes. `status`: `pendente` | `confirmado` | `recusado`.
- Funções RPC (`solicitar_agendamento`, `confirmar_agendamento`, `recusar_agendamento`) concentram
  as transições de estado para manter a consistência entre as duas tabelas.

Veja o SQL comentado em [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## Próximos passos (fora do escopo desta versão)

- Notificação automática por e-mail/WhatsApp quando um pedido chega ou é confirmado.
- Gateway de pagamento.
- Reagendamento/cancelamento pelo próprio paciente.
